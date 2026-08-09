-- supabase/migrations/20260810000000_recurring_games.sql
-- Recurring weekly games. RUN in SQL editor, then save in repo.
--
-- PRE-FLIGHT (before running this file): Dashboard → Database → Extensions →
-- enable `pg_cron`. If it can't be enabled on this plan, run everything EXCEPT
-- section (e) and wire the on-app-open fallback instead (see plan notes).
--
-- A game with recurs_weekly = true "rolls": once its game_time passes, an
-- hourly cron job creates next week's instance — same venue/time-slot/roster —
-- and notifies every carried player ('recurring_game_created').
--
-- Rules encoded here:
--   • Cancelling an instance ends the chain (roll requires status = 'active').
--   • An empty roster ends the chain (no phantom empty games minted weekly).
--   • Chains dormant > 60 days never resurrect.
--   • After downtime the roll self-heals: ONE successor at the next weekly
--     slot strictly in the future — no catch-up spam of past instances.
--   • '+ 7 days' on timestamptz is 168 fixed hours. The app stores and shows
--     times in UTC everywhere, so this is self-consistent, but the local
--     wall-clock time will shift by an hour across a DST change. Documented,
--     deliberately not solved yet.

-- ── a) columns + one-instance-per-slot index ─────────────────────────────
alter table public.games
  add column if not exists recurs_weekly boolean not null default false;

-- The root game's id, carried by every instance in the chain (root included).
-- Deliberately NO foreign key: it's a grouping tag, and skipping the FK keeps
-- it out of the existing group_id ON DELETE CASCADE ordering entirely.
alter table public.games
  add column if not exists series_id bigint;

-- Database-enforced idempotency: one instance per series per timeslot. Two
-- overlapping cron runs can't double-create — the loser's insert conflicts.
create unique index if not exists games_series_occurrence_uidx
  on public.games (series_id, game_time)
  where series_id is not null;

-- ── b) root self-tag ─────────────────────────────────────────────────────
-- Identity values are assigned before BEFORE-row triggers run, so NEW.id is
-- already populated here. Plain trigger (only rewrites NEW), not SECDEF.
create or replace function public.set_series_root()
returns trigger
language plpgsql
as $$
begin
  if NEW.recurs_weekly and NEW.series_id is null then
    NEW.series_id := NEW.id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_series_root on public.games;
create trigger trg_set_series_root
  before insert on public.games
  for each row
  execute function public.set_series_root();

-- ── c) the roll ──────────────────────────────────────────────────────────
-- SECURITY DEFINER like every privileged multi-row write in this repo
-- (notifications has no INSERT policy at all — this bypass is the only way
-- its rows get created, exactly like the existing triggers). Returns how
-- many games it created, which makes SQL-editor testing obvious.
create or replace function public.roll_recurring_games()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created      int := 0;
  g              record;
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
    -- The next weekly slot strictly in the future (self-heals after downtime).
    v_next := g.game_time
      + (floor(extract(epoch from (now() - g.game_time)) / 604800)::int + 1)
        * interval '7 days';

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

    -- One notification per carried player, creator included (the creator
    -- wants confirmation the game rolled). Same (user_id, game_id, type,
    -- message) shape as every existing notification write.
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

revoke all on function public.roll_recurring_games() from public, anon;
-- Safe to grant: idempotent and deterministic — the worst a signed-in user
-- can do is run the roll up to an hour early. Also enables the on-app-open
-- fallback if pg_cron ever goes away.
grant execute on function public.roll_recurring_games() to authenticated;

-- ── d) don't double-notify group members on a rolled successor ───────────
-- Same body as 20260720010000_groups_phase2.sql plus ONE new early-return:
-- rolled successors are not "proposals" — the roll sends its own
-- 'recurring_game_created' to the roster instead. A successor is
-- recognisable from the row alone: series_id set and pointing at a
-- DIFFERENT game (the root tags itself, so root has series_id = id and
-- still fires the proposal notification as today).
create or replace function public.notify_group_game_proposed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_name text;
begin
  if NEW.group_id is null or NEW.created_by is null then
    return NEW;
  end if;

  if NEW.series_id is not null and NEW.series_id <> NEW.id then
    return NEW;
  end if;

  select name into v_group_name from groups where id = NEW.group_id;

  insert into notifications (user_id, game_id, type, message)
  select
    gm.user_id,
    NEW.id,
    'group_game_proposed',
    'New game proposed in "' || coalesce(v_group_name, 'your group') || '": ' ||
      coalesce(NEW.venue, 'a game') || '.'
  from group_members gm
  where gm.group_id = NEW.group_id
    and gm.user_id <> NEW.created_by;

  return NEW;
end;
$$;

-- (trigger trg_notify_group_game_proposed already exists and points at this
-- function name — no drop/create needed.)

-- ── e) schedule ──────────────────────────────────────────────────────────
-- REQUIRES the pg_cron extension (see pre-flight note at the top).
-- cron.schedule with a job NAME is an idempotent upsert — re-running this
-- file just refreshes the same job.
create extension if not exists pg_cron;

select cron.schedule(
  'roll-recurring-games',
  '15 * * * *',                                   -- hourly at :15
  $$select public.roll_recurring_games()$$
);
