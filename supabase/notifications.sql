-- Padel Loop — fill-up notifications (database side of the feature)
--
-- WHAT THIS DOES
--   Sets up in-app alerts that tell a game's creator when their game fills up
--   (joined players reach max_players). It has three parts:
--     1. a `notifications` table (the creator's inbox), locked down so each
--        person can only read/update their own rows;
--     2. a `creator_notified` flag on `games` so each game alerts at most once;
--     3. a trigger on `game_players` that, after each join, checks whether the
--        game just became full and — if so — writes ONE notification for the
--        creator and flips the flag (so leave/rejoin can't re-fire it).
--
-- HOW TO RUN IT
--   Already applied to the live database via the Supabase SQL Editor. Kept here
--   as the source-of-truth record, and so it can be re-applied to a fresh
--   database. Safe to re-run: every statement is written to be idempotent.
--
-- NOTES
--   • `notifications.user_id` / `games.created_by` are uuids (Supabase auth
--     user ids); `games.id` / `game_players.game_id` are bigints.
--   • The trigger function is SECURITY DEFINER so it can insert a notification
--     FOR THE CREATOR even though the person who triggered it (the last player
--     to join) is someone else — Row Level Security would otherwise block it.

-- ── 1. The notifications inbox ──────────────────────────────────────────────
create table if not exists notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade, -- who the alert is for
  game_id     bigint      references games (id) on delete cascade,               -- which game it's about
  type        text        not null default 'game_full',                         -- kind of alert (room to add more later)
  message     text        not null,                                             -- the text the creator will read
  is_read     boolean     not null default false,                               -- have they seen it yet
  created_at  timestamptz not null default now()                                -- when it was made
);

-- Speeds up "show me my newest notifications first".
create index if not exists notifications_user_id_created_at_idx
  on notifications (user_id, created_at desc);

-- Row Level Security: locked down by default, then each person may read and
-- update ONLY their own notifications.
alter table notifications enable row level security;

drop policy if exists "Read own notifications" on notifications;
create policy "Read own notifications"
  on notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Update own notifications" on notifications;
create policy "Update own notifications"
  on notifications for update
  using (auth.uid() = user_id);

-- ── 2. The one-time "we've told the creator" flag ───────────────────────────
alter table games
  add column if not exists creator_notified boolean not null default false;

-- ── 3. The rule that alerts the creator once when a game fills up ────────────
create or replace function notify_game_full()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g            record;
  joined_count int;
begin
  -- The game this player just joined.
  select id, venue, max_players, created_by, creator_notified
    into g
    from games
    where id = NEW.game_id;

  -- Stop if: no such game, we've already alerted the creator, or there is no
  -- creator on record to alert.
  if g.id is null or g.creator_notified or g.created_by is null then
    return NEW;
  end if;

  -- How many players are now in this game?
  select count(*) into joined_count
    from game_players
    where game_id = NEW.game_id;

  -- Reached the limit → write ONE alert and flip the flag so it can't repeat.
  if joined_count >= g.max_players then
    insert into notifications (user_id, game_id, type, message)
    values (
      g.created_by,
      g.id,
      'game_full',
      'Your game at ' || coalesce(g.venue, 'your venue') || ' is full.'
    );

    update games set creator_notified = true where id = g.id;
  end if;

  return NEW;
end;
$$;

-- Run that function automatically after every new join.
drop trigger if exists trg_notify_game_full on game_players;

create trigger trg_notify_game_full
  after insert on game_players
  for each row
  execute function notify_game_full();
