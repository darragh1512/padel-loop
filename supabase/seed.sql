-- Padel Loop — clean seed for the `games` table.
--
-- WHAT THIS DOES
--   Replaces ALL current games with 6 realistic Dublin-area games, all dated
--   within the next 7 days at sensible evening / weekend times. Areas, skill
--   levels and (derived) prices are varied so the filters have plenty to work
--   with.
--
-- HOW TO RUN IT
--   1. Open your project at https://supabase.com → SQL Editor → New query.
--   2. Paste this whole file in and click "Run".
--
-- ⚠️  WARNING: the two DELETE lines below wipe every existing game (and the
--     join records that point to them) so you start from a clean slate. This
--     is what clears out the old "jonny padel" / duplicate test rows. Only run
--     it if you're happy to lose the current example data.
--
-- NOTES
--   • `id` is a bigint that fills in automatically, so we don't set it.
--   • Times are written as Europe/Dublin wall-clock times and stored as the
--     true UTC instant they correspond to — the app presents every time on a
--     Dublin clock (src/lib/time.ts), so 19:30 below shows as 19:30 on
--     screen, summer or winter.
--   • There's no price column; the app works out the per-head price from the
--     skill level (Beginner €10 / Intermediate €13 / Advanced €16 at 4 players).
--   • The day offsets are relative to whenever you run this (CURRENT_DATE), so
--     the games always land in the coming week.

-- 1. Clear out old data (join records first — they reference games).
delete from game_players;
delete from games;

-- 2. Insert the 6 new games.
insert into games (venue, location, game_time, skill_level, max_players, current_players)
values
  ('Malahide Padel Club',      'Malahide',           ((current_date + 0) + time '19:30') at time zone 'Europe/Dublin', 'Intermediate', 4, 3),
  ('Swords Padel Arena',       'Swords',             ((current_date + 1) + time '10:00') at time zone 'Europe/Dublin', 'Beginner',     4, 1),
  ('The Padel Yard',           'Dublin City Centre', ((current_date + 1) + time '18:30') at time zone 'Europe/Dublin', 'Advanced',     4, 2),
  ('Dún Laoghaire Padel Club', 'Dún Laoghaire',      ((current_date + 2) + time '11:00') at time zone 'Europe/Dublin', 'Intermediate', 4, 2),
  ('Clontarf Padel Centre',    'Clontarf',           ((current_date + 4) + time '19:00') at time zone 'Europe/Dublin', 'Beginner',     4, 1),
  ('Sandyford Padel Club',     'Sandyford',          ((current_date + 6) + time '20:00') at time zone 'Europe/Dublin', 'Advanced',     4, 3);
