-- supabase/migrations/20261108150000_delete_cancelled_game.sql
-- DELETE A CANCELLED GAME: the organiser removes a cancelled game completely,
-- for everyone.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- Adds ONE new function, delete_cancelled_game(). It changes no existing row,
-- column, rule or function, and nothing is deleted when this file runs: games
-- are only deleted later, one at a time, when an organiser asks.
--
-- THE RULES, all checked here rather than trusted to the app:
--   • only the game's organiser can delete it;
--   • only once it is cancelled;
--   • never once it has a match result of any kind, because ratings are
--     built from results (a started but unfinished match counts too).
--
-- HOW IT DELETES. One statement removes the games row. The database then
-- removes everything attached to it, because every link to a game is set to
-- "delete with it" (confirmed on the live database on 2026-11-08 by the
-- read-only check): players, waitlist, removals, chat messages, notifications,
-- pins and archives. Section a) re-checks that before anything is added.
--
-- The automatic rules on game_players (check_player_may_leave,
-- notify_player_left, promote_from_waitlist) each look the game up first and
-- do nothing when it no longer exists. Because the game row goes first, they
-- stay quiet: no "player left" notices, nobody moved off the waitlist, and the
-- organiser's own place doesn't block the delete.
--
-- Reports are untouched: they keep their own copy of any reported message.

-- ── a) safety check: stop if any link would block or survive the delete ──
do $$
declare
  v_bad text;
begin
  select string_agg(conrelid::regclass::text || '.' || conname, ', ')
  into v_bad
  from pg_constraint
  where contype = 'f'
    and confrelid = 'public.games'::regclass
    and confdeltype <> 'c';

  if v_bad is not null then
    raise exception 'STOPPED, nothing changed: these links to games are not set to delete with the game: %', v_bad;
  end if;
end;
$$;

-- ── b) the function ──────────────────────────────────────────────────────
create or replace function public.delete_cancelled_game(p_game_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
begin
  if auth.uid() is null then
    raise exception 'Log in to delete a game.' using errcode = '42501';
  end if;

  -- Lock the row, so nothing can change the game while it's checked and deleted.
  select id, created_by, status into g
  from games where id = p_game_id
  for update;

  if not found then
    return; -- already gone: the end state they wanted is already true
  end if;

  if g.created_by is distinct from auth.uid() then
    raise exception 'Only the game’s organiser can delete it.' using errcode = '42501';
  end if;

  if lower(btrim(coalesce(g.status, ''))) <> 'cancelled' then
    raise exception 'Cancel the game before deleting it.' using errcode = 'P0001';
  end if;

  if exists (select 1 from match_results where game_id = p_game_id) then
    raise exception 'This game has a match result, so it can’t be deleted. Ratings depend on it.'
      using errcode = 'P0001';
  end if;

  delete from games where id = p_game_id;
end;
$$;

revoke all on function public.delete_cancelled_game(bigint) from public;
revoke all on function public.delete_cancelled_game(bigint) from anon;
grant execute on function public.delete_cancelled_game(bigint) to authenticated;

comment on function public.delete_cancelled_game(bigint) is
  'Organiser deletes their own CANCELLED game with no match result. Everything attached goes with it.';
