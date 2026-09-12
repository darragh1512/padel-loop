-- supabase/migrations/20260909000000_player_leaves_game.sql
-- LEAVING A GAME: the database half of "a player gives up their spot".
--
-- The app already deletes the game_players row, and the spot frees itself
-- because every count is derived from that table. What is NOT in the database
-- yet is (a) a DELETE policy saying who may remove which row, (b) the two
-- refusals, and (c) telling the organiser someone dropped out.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- WHY THE TRIGGERS EXIST AT ALL: the client-side checks in leaveGame() are for
-- giving people a readable sentence. They are not a boundary — anyone can call
-- the REST API directly and skip them. These triggers are the actual rule.

-- ── a) who may delete a game_players row ─────────────────────────────────
-- A player may remove THEIR OWN row and nobody else's. `using` is the filter
-- Postgres applies to each candidate row, so a delete aimed at someone else's
-- row simply matches nothing — it does not error, it removes zero rows.
--
-- Note there is deliberately no organiser exception here: an organiser cannot
-- currently remove a player from their game, and this migration does not add
-- that. It only covers a player leaving of their own accord.
alter table public.game_players enable row level security;

drop policy if exists "Players can leave a game" on public.game_players;
create policy "Players can leave a game"
  on public.game_players for delete
  to authenticated
  using (user_id = auth.uid());

-- ── b) the two refusals ──────────────────────────────────────────────────
-- 1. The organiser cannot leave their own game. Leaving would strand a game
--    that still carries their name: they keep Edit, Cancel and chat access
--    (all keyed off games.created_by) while vanishing from the roster.
--    Cancelling is the honest action, and it tells everyone.
--
-- 2. Nobody can leave once a match result exists, in ANY state. Leaving does
--    not remove them from match_result_participants, and submit_result_entry
--    counts THAT table to decide when every scoresheet is in — so a departed
--    player is still required to submit, and a pending result would wait for
--    someone who has gone. It would never finalise.
--
-- The auth.uid() is null escape hatch matters: cascades (deleting a game, or
-- an auth user) and any service-role cleanup run without a signed-in user, and
-- must not be blocked by a rule about people leaving voluntarily.
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

  -- The game itself is on its way out (cascade); nothing to protect.
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

drop trigger if exists trg_check_player_may_leave on public.game_players;
create trigger trg_check_player_may_leave
  before delete on public.game_players
  for each row
  execute function public.check_player_may_leave();

-- ── c) tell the organiser ────────────────────────────────────────────────
-- SECURITY DEFINER for the same reason notify_game_full is: notifications has
-- a SELECT and an UPDATE policy but NO insert policy at all, so a normal
-- caller cannot write a row addressed to somebody else. The trigger can.
--
-- AFTER DELETE, so a refusal in (b) means no notification is sent.
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

  -- Game gone (cascade), or somehow ownerless — nobody to tell.
  if not found or g.created_by is null then
    return old;
  end if;

  -- Don't notify someone about their own action. The organiser can't leave
  -- (see b), but this also covers any future admin-side removal.
  if g.created_by = old.user_id then
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

drop trigger if exists trg_notify_player_left on public.game_players;
create trigger trg_notify_player_left
  after delete on public.game_players
  for each row
  execute function public.notify_player_left();

-- ── d) notes ─────────────────────────────────────────────────────────────
-- Chat needs no work here: membership is derived from game_players +
-- games.created_by (canUserChat / getConversationsFor in src/app/games.ts), so
-- deleting the row already removes their access and drops the thread off their
-- chat list. Their existing messages stay in the thread on purpose — leaving a
-- conversation is not the same as erasing what was said in it.
--
-- The freed spot needs no work either: the old games.current_players column is
-- unused, and every count is derived live from game_players.
