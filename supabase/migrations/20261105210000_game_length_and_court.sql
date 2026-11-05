-- Game length and court number, and weekly games keeping their price.
--
-- The iPhone design shows how long a game runs ("90 min") and which court it's
-- on ("Court 3"). Neither was stored: the app assumed every game was 90 minutes.
-- Both are optional, so every existing game keeps NULL and simply shows neither.
--
-- Run order: any time. No pre-flight. Safe before or after the app deploy: the
-- app reads a missing column as "not set".

-- ── a) the two columns ───────────────────────────────────────────────────
alter table public.games add column if not exists duration_mins integer;
alter table public.games add column if not exists court_number text;

-- Text rather than a number, because clubs also name courts ("A", "Centre").
alter table public.games drop constraint if exists games_duration_mins_range;
alter table public.games add constraint games_duration_mins_range
  check (duration_mins is null or duration_mins between 15 and 360);

alter table public.games drop constraint if exists games_court_number_length;
alter table public.games add constraint games_court_number_length
  check (court_number is null or char_length(court_number) between 1 and 20);

-- ── b) weekly games keep them ────────────────────────────────────────────
-- Identical to the 20260811 version except that the insert also copies
-- duration_mins, court_number and price_per_player, so next week's game has the
-- same details. Until now a weekly game lost its price when it rolled forward.
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
                       creator_notified, duration_mins, court_number, price_per_player)
    values (g.venue, g.location, v_next, g.skill_level, g.max_players,
            g.created_by, g.group_id, 'active', true,
            coalesce(g.series_id, g.id),
            v_roster_count >= g.max_players,
            g.duration_mins, g.court_number, g.price_per_player)
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

revoke all on function public.roll_recurring_games() from public, anon;
grant execute on function public.roll_recurring_games() to authenticated;
