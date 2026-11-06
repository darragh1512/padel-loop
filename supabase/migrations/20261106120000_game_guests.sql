-- Guests: friends who are playing but aren't on Padel Loop.
--
-- A common game is three friends looking for a fourth. The organiser says how
-- many people are already in, and anyone not on the app takes a spot as a guest,
-- so the game correctly shows "1 spot open". Every existing game starts at 0
-- guests, so no game's spots change.
--
-- Run order: after 20261105210000_game_length_and_court.sql. No pre-flight. Safe
-- before or after the app deploy: the app reads a missing column as no guests.
--
-- The check in section a) stops everything if a live function differs from the
-- version this file was written against, or if a table or column it needs is
-- missing. Nothing has changed if it stops. Re-running after success is safe.

-- ── a) stop if live isn't what this file expects ─────────────────────────
do $check$
declare
  r        record;
  v_body   text;
begin
  for r in
    select * from (values
      ('roll_recurring_games',  '9591b63d41ffce48e6d9feb7ffd2131e'),
      ('promote_from_waitlist', '73e39187bf4600f3e622ee79274e2408'),
      ('notify_player_left',    '9e596236223ceba70e4a751783c3b008')
    ) as expected(name, checksum)
  loop
    select replace(p.prosrc, chr(13), '') into v_body
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = r.name and p.pronargs = 0;

    if v_body is null then
      raise exception 'STOPPED, nothing changed: % does not exist. Send this message to Claude.', r.name;
    end if;
    -- Already has guests: a re-run of this file, which is fine.
    if position('guest_count' in v_body) = 0 and md5(v_body) <> r.checksum then
      raise exception 'STOPPED, nothing changed: the live % differs from the expected version. Send this message to Claude.', r.name;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'creator_notified'
  ) then
    raise exception 'STOPPED, nothing changed: games.creator_notified does not exist. Send this message to Claude.';
  end if;
end;
$check$;

-- ── b) the number of guests ──────────────────────────────────────────────
alter table public.games add column if not exists guest_count integer not null default 0;

-- The organiser always holds a spot, so guests can never fill the whole game.
alter table public.games drop constraint if exists games_guest_count_range;
alter table public.games add constraint games_guest_count_range
  check (guest_count >= 0 and guest_count < max_players);

-- ── c) weekly games keep the same number of guests ───────────────────────
-- Identical to the 20261105210000 version except the insert also copies
-- guest_count, and guests count towards a full game.
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
                       creator_notified, duration_mins, court_number, price_per_player, guest_count)
    values (g.venue, g.location, v_next, g.skill_level, g.max_players,
            g.created_by, g.group_id, 'active', true,
            coalesce(g.series_id, g.id),
            v_roster_count + g.guest_count >= g.max_players,
            g.duration_mins, g.court_number, g.price_per_player, g.guest_count)
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

-- ── d) the waitlist only moves someone in if a spot is really free ───────
-- Identical to the 20260910000000 version except guests count as taken spots.
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
  select id, venue, max_players, guest_count, is_manually_closed, status
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
  if spots + g.guest_count >= g.max_players then
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

-- ── e) "X left your game" counts guests when it says how many spots are open ─
-- Identical to the 20260928000000 version except for the spot count.
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
  select id, venue, max_players, guest_count, created_by
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

  select greatest(g.max_players - g.guest_count - count(*), 0)
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

-- ── f) tell the organiser when a game with guests fills up ───────────────
-- The existing full-game notice compares real players with the game's size, so
-- it can't fire while guests hold some of the spots. This separate rule only
-- ever acts on games with guests, and leaves the existing notice untouched.
-- creator_notified stops the organiser being told twice.
create or replace function public.notify_game_full_with_guests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g       record;
  players int;
begin
  select id, venue, max_players, guest_count, created_by, creator_notified
  into g
  from games where id = new.game_id;

  if not found or g.guest_count = 0 or g.created_by is null or g.creator_notified then
    return new;
  end if;

  select count(*) into players from game_players where game_id = new.game_id;
  if players + g.guest_count < g.max_players then
    return new;
  end if;

  insert into notifications (user_id, game_id, type, message)
  values (g.created_by, g.id, 'game_full', 'Your game at ' || g.venue || ' is now full.');

  update games set creator_notified = true where id = g.id;
  return new;
end;
$$;

drop trigger if exists trg_notify_game_full_with_guests on public.game_players;
create trigger trg_notify_game_full_with_guests
  after insert on public.game_players
  for each row
  execute function public.notify_game_full_with_guests();

revoke all on function public.notify_game_full_with_guests() from public, anon, authenticated;

-- ── g) notes ─────────────────────────────────────────────────────────────
-- Match results need four real players (start_match_result counts game_players),
-- so a game can't be scored while it has guests. If the friends join through the
-- app and the organiser lowers the number, it can.
