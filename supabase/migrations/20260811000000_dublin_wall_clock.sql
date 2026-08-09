-- supabase/migrations/20260811000000_dublin_wall_clock.sql
-- True-UTC storage + Europe/Dublin wall clock. RUN in SQL editor, then save
-- in repo. If 20260810000000_recurring_games.sql has NOT been run yet, run
-- that one first — this file supersedes its roll function (create or
-- replace), the same way consensus_entries superseded confirm_match_result.
--
-- What this fixes:
--   • game_time rows were written wall-clock-as-UTC (a game typed as 18:30
--     stored 18:30Z), while the app displays device-local time — so summer
--     games showed an hour late. From now on the client stores TRUE UTC
--     instants and presents everything pinned to Europe/Dublin
--     (src/lib/time.ts). Section (b) below is the one-shot backfill that
--     re-reads every existing row's stored wall clock as Dublin time.
--   • roll_recurring_games() added a flat 7×24h in UTC, so a weekly game's
--     Dublin wall-clock time shifted an hour across each GMT/IST change.
--     Section (a) recomputes the next occurrence in Dublin wall-clock space.
--
-- DEPLOY ORDER NOTE: run this migration and deploy the client change in the
-- same sitting. A game created by the OLD client after the backfill would be
-- wall-clock-as-UTC again (an hour off in summer until edited).

-- ── a) roll in Dublin wall-clock space ───────────────────────────────────
-- Identical to the 20260810 version except v_next: instead of adding fixed
-- 168-hour weeks to the timestamptz (session timezone = UTC on Supabase),
-- convert the predecessor to its Dublin wall clock, add calendar weeks
-- there (wall clock preserved across DST), and convert back to an instant.
-- The loop replaces the old epoch-arithmetic catch-up formula; it is bounded
-- by the 60-day staleness window in the eligibility query (≤ ~9 rounds).
create or replace function public.roll_recurring_games()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created      int := 0;
  g              record;
  v_local        timestamp;    -- Dublin wall clock (no timezone)
  v_next         timestamptz;
  v_new_id       bigint;
  v_roster_count int;
begin
  for g in
    select g0.*
    from games g0
    where g0.recurs_weekly
      and g0.status = 'active'
      and g0.game_time <= now()
      and g0.game_time >  now() - interval '60 days'   -- staleness bound
      and exists (select 1 from game_players gp        -- empty roster = dead chain
                  where gp.game_id = g0.id)
      and not exists (select 1 from games s            -- only the newest instance rolls
                      where s.series_id = coalesce(g0.series_id, g0.id)
                        and s.game_time > g0.game_time)
    order by g0.game_time
  loop
    -- Next weekly slot strictly in the future, keeping the DUBLIN wall
    -- clock fixed (18:30 stays 18:30 across GMT/IST changes).
    v_local := g.game_time at time zone 'Europe/Dublin';
    loop
      v_local := v_local + interval '7 days';
      v_next  := v_local at time zone 'Europe/Dublin';
      exit when v_next > now();
    end loop;

    select count(*) into v_roster_count
      from game_players where game_id = g.id;

    -- creator_notified is computed, not blanket true: when the copied roster
    -- already fills the game it suppresses the spurious 'game_full' the
    -- trg_notify_game_full trigger would fire on the last copied player; when
    -- the copy is partial it stays false so a later organic join still
    -- notifies the creator normally.
    insert into games (venue, location, game_time, skill_level, max_players,
                       created_by, group_id, status, recurs_weekly, series_id,
                       creator_notified)
    values (g.venue, g.location, v_next, g.skill_level, g.max_players,
            g.created_by, g.group_id, 'active', true,
            coalesce(g.series_id, g.id),
            v_roster_count >= g.max_players)
    on conflict (series_id, game_time) where series_id is not null
      do nothing
    returning id into v_new_id;

    if v_new_id is null then
      continue;  -- a concurrent run won the race; skip roster + notifications
    end if;

    -- Auto-join last week's roster.
    insert into game_players (game_id, user_id)
    select v_new_id, gp.user_id
    from game_players gp
    where gp.game_id = g.id;

    -- One notification per carried player, creator included.
    insert into notifications (user_id, game_id, type, message)
    select gp.user_id, v_new_id, 'recurring_game_created',
           'Weekly game: you''re in again at '
             || coalesce(g.venue, 'the usual spot')
             || ' next week. Tap to view — leave if you can''t make it.'
    from game_players gp
    where gp.game_id = g.id;

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

-- Grants carry over on create-or-replace, but restate them so this file
-- stands alone if it's ever run on a fresh database.
revoke all on function public.roll_recurring_games() from public, anon;
grant execute on function public.roll_recurring_games() to authenticated;

-- ── b) one-shot backfill of existing rows ────────────────────────────────
-- Existing game_time values are wall-clock-as-UTC; re-read each stored wall
-- clock as Europe/Dublin. Winter rows are unchanged (Dublin = UTC+0);
-- summer rows shift back an hour (18:30Z becomes 17:30Z, which displays as
-- 18:30 Dublin). ALL rows are converted, past games included, so history
-- keeps its wall clock.
--
-- The app_meta marker makes this a ONE-SHOT: running this file again is
-- harmless. That matters — applying the shift twice would move summer games
-- a second hour.
create table if not exists public.app_meta (
  key     text primary key,
  done_at timestamptz not null default now()
);

-- Invisible to clients: RLS on, no policies (the same stance as the
-- notifications table's write side — only definer-level SQL touches it).
alter table public.app_meta enable row level security;

do $$
begin
  if not exists (select 1 from public.app_meta
                 where key = 'dublin-wall-clock-backfill') then
    update public.games
       set game_time = (game_time at time zone 'utc') at time zone 'Europe/Dublin';

    insert into public.app_meta (key) values ('dublin-wall-clock-backfill');
  end if;
end;
$$;
