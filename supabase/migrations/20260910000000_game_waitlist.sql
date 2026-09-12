-- supabase/migrations/20260910000000_game_waitlist.sql
-- WAITLIST: a fifth person can queue for a full game instead of bouncing off.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- WHY A SEPARATE TABLE, not a status column on game_players:
-- game_players is what the whole app counts. start_match_result requires
-- count(game_players) = max_players = 4, notify_game_full counts it, the
-- match_results RLS policies grant access from it, and roll_recurring_games
-- copies it into next week's game. Putting queued people in that table changes
-- the meaning of all of them at once, and leaves a permanent trap where any
-- future query must remember to filter. Queued people live in their own table,
-- so every existing behaviour stays correct without being touched.
--
-- The invariant: a row here means "waiting". A row in game_players means "in
-- the game". Nobody is ever in both — enforced by the trigger in (c).

-- ── a) the queue ─────────────────────────────────────────────────────────
-- joined_at is the queue order and the only ordering that matters. It is set
-- once on insert and never updated, so a promotion or a departure ahead of you
-- can never reshuffle the people behind.
create table if not exists public.game_waitlist (
  id         bigint generated always as identity primary key,
  game_id    bigint      not null references public.games (id) on delete cascade,
  user_id    uuid        not null references auth.users (id)   on delete cascade,
  joined_at  timestamptz not null default now(),
  unique (game_id, user_id)   -- you can only be in a queue once
);

-- "The queue for this game, in order" — the only read pattern there is.
create index if not exists game_waitlist_game_id_joined_at_idx
  on public.game_waitlist (game_id, joined_at);

-- ── b) who may read and write the queue ──────────────────────────────────
-- Readable by any signed-in user: the roster shows the queue to the organiser,
-- and a person needs to see their own position. Writes are your own row only,
-- exactly like game_players' INSERT policy.
alter table public.game_waitlist enable row level security;

drop policy if exists "Waitlist readable by authenticated" on public.game_waitlist;
create policy "Waitlist readable by authenticated"
  on public.game_waitlist for select
  to authenticated
  using (true);

drop policy if exists "Join a waitlist as yourself" on public.game_waitlist;
create policy "Join a waitlist as yourself"
  on public.game_waitlist for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Leave a waitlist you are on" on public.game_waitlist;
create policy "Leave a waitlist you are on"
  on public.game_waitlist for delete
  to authenticated
  using (user_id = auth.uid());

-- ── c) you cannot be queued and in the game at once ──────────────────────
-- The two tables can't express this with a constraint, so it is a trigger on
-- each side. Cheap: both checks are a single indexed lookup.
create or replace function public.check_not_already_in_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from game_players
    where game_id = new.game_id and user_id = new.user_id
  ) then
    raise exception 'You are already in this game'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_not_already_in_game on public.game_waitlist;
create trigger trg_check_not_already_in_game
  before insert on public.game_waitlist
  for each row
  execute function public.check_not_already_in_game();

-- The other direction: joining a game clears any queue row you hold for it.
-- Deleting rather than refusing, because being promoted (or a spot opening and
-- you tapping Join first) is a legitimate way to arrive.
create or replace function public.clear_waitlist_on_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from game_waitlist
  where game_id = new.game_id and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_clear_waitlist_on_join on public.game_players;
create trigger trg_clear_waitlist_on_join
  after insert on public.game_players
  for each row
  execute function public.clear_waitlist_on_join();

-- ── d) promotion, and the one rule that makes it conditional ─────────────
-- THE CRITICAL DISTINCTION. A spot opening up is not the same event as a spot
-- becoming AVAILABLE, and the difference is is_manually_closed:
--
--   • Genuinely full (4 of 4, is_manually_closed = false). A player leaves, so
--     there is a real empty spot. Promote the person at the front of the queue.
--
--   • Manually closed (is_manually_closed = true). The organiser closed the
--     game because they filled the last spot OUTSIDE the app — with someone who
--     is not in game_players at all. If a player now leaves, the freed row does
--     NOT correspond to a free spot in the real world; the off-app player is
--     still standing there holding it. Promoting here would invite a fifth
--     person to a court that already has four. So: do nothing, and leave the
--     queue intact so the organiser can reopen the game later and have it
--     promote then.
--
-- Anyone in the queue stays in the queue in the second case — they are not
-- dropped, not told anything, and keep their position.
create or replace function public.promote_from_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g        record;
  next_up  record;
  spots    int;
begin
  select id, venue, max_players, is_manually_closed, status
  into g
  from games where id = old.game_id;

  if not found then
    return old;  -- the game itself is being deleted
  end if;

  -- Cancelled games don't promote either: there is nothing to be promoted to.
  if coalesce(lower(btrim(g.status)), 'active') = 'cancelled' then
    return old;
  end if;

  -- THE RULE. A hand-closed game has no real spot to give away.
  if g.is_manually_closed then
    return old;
  end if;

  -- Only promote into an actually-empty spot.
  select count(*) into spots from game_players where game_id = old.game_id;
  if spots >= g.max_players then
    return old;
  end if;

  -- Front of the queue. FOR UPDATE SKIP LOCKED so two simultaneous departures
  -- promote two different people rather than racing for the same one.
  select id, user_id into next_up
  from game_waitlist
  where game_id = old.game_id
  order by joined_at
  limit 1
  for update skip locked;

  if not found then
    return old;  -- nobody waiting
  end if;

  -- Move them in. The clear_waitlist_on_join trigger removes the queue row, so
  -- it is not deleted here — one place owns that.
  insert into game_players (game_id, user_id)
  values (old.game_id, next_up.user_id);

  insert into notifications (user_id, game_id, type, message)
  values (
    next_up.user_id,
    g.id,
    'waitlist_promoted',
    'A spot opened up at ' || g.venue || ' — you are in the game.'
  );

  return old;
end;
$$;

-- AFTER DELETE, so a leave refused by check_player_may_leave promotes nobody.
drop trigger if exists trg_promote_from_waitlist on public.game_players;
create trigger trg_promote_from_waitlist
  after delete on public.game_players
  for each row
  execute function public.promote_from_waitlist();

-- ── e) leaving the QUEUE is always allowed ───────────────────────────────
-- Supersedes the version in 20260909000000_player_leaves_game.sql. That one
-- refuses a leave when a match result exists, which is right for a player in
-- the game — but a queued person was never in the match, so the same rule must
-- not trap them in a queue they want out of. game_waitlist deletes don't go
-- through this trigger at all (it is on game_players), so this is unchanged
-- except for the comment; it is re-issued here only so the two files can be
-- run in either order and end up the same.
create or replace function public.check_player_may_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  if auth.uid() is null then
    return old; -- cascade or service role, not somebody leaving
  end if;

  select created_by into v_created_by
  from games where id = old.game_id;

  if not found then
    return old;
  end if;

  if v_created_by = old.user_id then
    raise exception
      'The organiser cannot leave their own game — cancel the game instead'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from match_results where game_id = old.game_id) then
    raise exception
      'This game already has a match result, so its players are fixed'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

-- ── f) notes ─────────────────────────────────────────────────────────────
-- Nothing else is touched, which is the point of the separate table:
--   • start_match_result still counts game_players and still sees 4 of 4.
--   • notify_game_full still fires on the real fourth joiner.
--   • The match_results RLS policies still grant access to players only —
--     a queued person has no match-result access, which is correct.
--   • roll_recurring_games still copies the roster only. A queue does NOT
--     carry into next week's game; that is deliberate — queueing for one
--     evening is not queueing for every future Tuesday.
--
-- The 4/4 display is unaffected for the same reason: every count reads
-- game_players, and queued people are not in it.

comment on table public.game_waitlist is
  'People queued for a full game. A row here means waiting; a row in game_players means playing. Never both.';
