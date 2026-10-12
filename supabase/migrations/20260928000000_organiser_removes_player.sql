-- supabase/migrations/20260928000000_organiser_removes_player.sql
-- REMOVING A PLAYER: the organiser takes someone out of their own game.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- THE SHAPE: one SECURITY DEFINER function, remove_player_from_game(), is the
-- ONLY way to delete somebody else's game_players row. The DELETE policy from
-- 20260909000000_player_leaves_game.sql is deliberately left alone — it still
-- says "your own row and nobody else's" — so an organiser calling the REST API
-- directly to delete a player's row still removes zero rows. The rules live in
-- the function, where they can say no in a readable sentence:
--
--   • only the game's organiser may call it for that game;
--   • the organiser cannot remove themselves (they cancel the game instead);
--   • the person must actually be in the game;
--   • nobody can be removed once a match result exists, in ANY state — the
--     same reason leaving is refused then (see 20260909, section b).
--
-- A removal is RECORDED in game_removals, and that record is what stops the
-- person rejoining the same game or queueing for it. It is per-game: next
-- week's instance of a recurring game is a different game, and the roll only
-- copies the people still in the roster, so a removed player isn't carried.

-- ── a) the record of who was removed from what ──────────────────────────
create table if not exists public.game_removals (
  id          bigint generated always as identity primary key,
  game_id     bigint      not null references public.games (id) on delete cascade,
  user_id     uuid        not null references auth.users (id)   on delete cascade,
  removed_by  uuid        references auth.users (id) on delete set null,
  removed_at  timestamptz not null default now(),
  unique (game_id, user_id)
);

-- Readable by the two people it concerns: the organiser of that game, and
-- the removed player (so their game page can say what happened instead of
-- offering a Join button that would only fail). No insert/update/delete
-- policies at all — only remove_player_from_game() writes here.
alter table public.game_removals enable row level security;

drop policy if exists "Removals readable by organiser and removed player"
  on public.game_removals;
create policy "Removals readable by organiser and removed player"
  on public.game_removals for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.games g
      where g.id = game_removals.game_id and g.created_by = auth.uid()
    )
  );

-- ── b) the removal itself ────────────────────────────────────────────────
create or replace function public.remove_player_from_game(
  p_game_id bigint,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  g        record;
begin
  if v_caller is null then
    raise exception 'Not signed in';
  end if;

  -- Lock the game row so two removals (or a removal and an edit) queue up
  -- rather than interleave.
  select id, venue, created_by
  into g
  from games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found';
  end if;

  if g.created_by is distinct from v_caller then
    raise exception 'Only the organiser of this game can remove players'
      using errcode = 'insufficient_privilege';
  end if;

  if p_user_id = v_caller then
    raise exception
      'You can''t remove yourself from your own game — cancel the game instead'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from match_results where game_id = p_game_id) then
    raise exception
      'This game already has a match result, so its players are fixed'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from game_players
    where game_id = p_game_id and user_id = p_user_id
  ) then
    raise exception 'That player isn''t in this game'
      using errcode = 'check_violation';
  end if;

  -- Record FIRST, delete second. notify_player_left (below) looks for this
  -- row to tell a removal apart from a voluntary leave, and it runs as an
  -- AFTER DELETE trigger inside this same transaction, so it can see it.
  insert into game_removals (game_id, user_id, removed_by)
  values (p_game_id, p_user_id, v_caller)
  on conflict (game_id, user_id) do nothing;

  -- The existing delete triggers all still apply: check_player_may_leave
  -- (passes — not the organiser, no result), promote_from_waitlist (the
  -- freed spot goes to the front of the queue, exactly as when someone
  -- leaves), and notify_player_left (now silent for removals).
  delete from game_players
  where game_id = p_game_id and user_id = p_user_id;

  -- Tell the removed player. SECURITY DEFINER is what lets this write a row
  -- addressed to someone else — notifications has no insert policy.
  insert into notifications (user_id, game_id, type, message)
  values (
    p_user_id,
    g.id,
    'removed_from_game',
    'The organiser removed you from the game at ' || g.venue || '.'
  );
end;
$$;

revoke all on function public.remove_player_from_game(bigint, uuid) from public;
revoke all on function public.remove_player_from_game(bigint, uuid) from anon;
grant execute on function public.remove_player_from_game(bigint, uuid) to authenticated;

-- ── c) a removed player can't come back to the same game ─────────────────
-- Covers both doors in: joining the game, and queueing for it (a queued
-- person is promoted in automatically, so the queue is a way back in too).
-- No auth.uid() escape hatch here, unlike the leave check: nothing legitimate
-- ever needs to put a removed player back into that game's roster.
create or replace function public.check_not_removed_from_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from game_removals
    where game_id = new.game_id and user_id = new.user_id
  ) then
    raise exception 'The organiser removed you from this game'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_not_removed_join on public.game_players;
create trigger trg_check_not_removed_join
  before insert on public.game_players
  for each row
  execute function public.check_not_removed_from_game();

drop trigger if exists trg_check_not_removed_queue on public.game_waitlist;
create trigger trg_check_not_removed_queue
  before insert on public.game_waitlist
  for each row
  execute function public.check_not_removed_from_game();

-- ── d) don't tell the organiser "X left your game" about their own removal
-- Supersedes the version in 20260909000000_player_leaves_game.sql. The only
-- change is the early return when a removal record exists: the organiser did
-- this themselves, and the removed player gets their own notification in (b).
create or replace function public.notify_player_left()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g         record;
  leaver    text;
  spots_now int;
begin
  select id, venue, max_players, created_by
  into g
  from games where id = old.game_id;

  if not found or g.created_by is null then
    return old;
  end if;

  if g.created_by = old.user_id then
    return old;
  end if;

  -- Removed by the organiser, not a voluntary leave.
  if exists (
    select 1 from game_removals
    where game_id = old.game_id and user_id = old.user_id
  ) then
    return old;
  end if;

  select coalesce(nullif(btrim(name), ''), 'A player')
  into leaver
  from profiles where id = old.user_id;
  leaver := coalesce(leaver, 'A player');

  select g.max_players - count(*)
  into spots_now
  from game_players where game_id = old.game_id;

  insert into notifications (user_id, game_id, type, message)
  values (
    g.created_by,
    g.id,
    'player_left',
    leaver || ' left your game at ' || g.venue || '. '
      || spots_now || ' of ' || g.max_players || ' spots now open.'
  );

  return old;
end;
$$;

-- ── e) notes ─────────────────────────────────────────────────────────────
-- Chat: membership is derived from game_players, so the removed player loses
-- access to the game chat immediately, same as leaving. Their past messages
-- stay in the thread.
--
-- Known narrow race, shared with leaving: start_match_result does not lock
-- the games row, so a removal and a "Start match" tapped in the same instant
-- could both pass their checks. start_match_result also requires a full
-- 4-of-4 roster, so in practice the organiser (the only person who can do
-- either) would have to tap both at once.

comment on table public.game_removals is
  'Players an organiser removed from a game. A row here blocks rejoining or queueing for that game.';
