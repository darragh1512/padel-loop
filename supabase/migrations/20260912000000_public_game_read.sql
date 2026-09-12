-- supabase/migrations/20260912000000_public_game_read.sql
-- SHARED LINKS: let a signed-out person actually SEE a game.
--
-- Every statement is idempotent — a partial run can be retried from the top.
--
-- WHY THIS IS NEEDED
-- The app already lets a signed-out visitor reach /games/[id]: there is no
-- middleware, no auth wrapper in the root layout, and the route itself only
-- calls notFound() when the game comes back empty. The wall is not in the
-- code, it is in the database — every policy in this repo is scoped
-- `to authenticated`, so an anonymous request (the anon key, no session) is
-- filtered to zero rows. getGame() then returns null, notFound() fires, and a
-- link shared into a WhatsApp group reads as a DEAD LINK rather than a login
-- wall, which is worse: nobody asks for an account, they just leave.
--
-- WHAT IS BEING OPENED, AND WHAT IS NOT
-- Only the two tables needed to answer "is this game worth turning up to":
--
--   games        — venue, time, level, max_players, status.
--   game_players — the ROWS ONLY, which is what makes "1 spot left" true.
--                  Without this a shared game reads as 4 of 4 spots open,
--                  which is a lie that fails silently rather than erroring.
--
-- profiles is deliberately NOT opened. A stranger with a link can see the
-- game and how many places are left, but not WHO is playing — names and
-- photos stay behind a login. The visible consequence is that the roster
-- renders as generic "Player" avatars for a signed-out viewer, because
-- getPlayersForGame finds no profile rows to join. That is the intended
-- trade: the roster count is the part that sells the game, the identities are
-- not, and publishing a club's membership to anyone holding a URL is not a
-- thing to do by accident.
--
-- Nothing here grants any WRITE. An anonymous visitor can read a game and
-- nothing else; joining still requires an account, which is the point.

-- ── a) games: readable by anyone with the link ───────────────────────────
-- The existing authenticated read policy is left exactly as it is. This adds
-- a second, anon-only policy alongside it — policies are OR-ed, so this
-- widens read access without touching the rule signed-in users already get.
drop policy if exists "Games readable by anyone with the link" on public.games;
create policy "Games readable by anyone with the link"
  on public.games for select
  to anon
  using (true);

-- ── b) game_players: the count, not the people ───────────────────────────
-- Reading these rows is what makes spots-left correct. The rows carry only
-- game_id and user_id; without a matching profiles policy a signed-out viewer
-- gets opaque ids they cannot resolve into people.
drop policy if exists "Game rosters countable by anyone with the link" on public.game_players;
create policy "Game rosters countable by anyone with the link"
  on public.game_players for select
  to anon
  using (true);

-- ── c) notes ─────────────────────────────────────────────────────────────
-- PRE-FLIGHT, and it matters more than usual here: this file assumes both
-- tables ALREADY have RLS enabled with working policies for authenticated
-- users. Neither table's policies live in this repo — they were made in the
-- dashboard — so check before running:
--
--   select relname, relrowsecurity
--   from pg_class where relname in ('games','game_players');
--
--   select polname, polcmd, polroles::regrole[],
--          pg_get_expr(polqual, polrelid) as using_expr
--   from pg_policy
--   where polrelid in ('public.games'::regclass, 'public.game_players'::regclass);
--
-- If relrowsecurity is false for either table, adding a policy changes
-- nothing (the table is already wide open) and the signed-out path was never
-- blocked in the first place — in that case this file is a no-op and the real
-- job is deciding whether those tables should have RLS at all.
--
-- If there is no SELECT policy for `authenticated` on game_players, do not
-- run 20260909000000_player_leaves_game.sql either: it enables RLS on that
-- table, and enabling RLS with no SELECT policy stops EVERY read, signed in
-- or not, which breaks every screen in the app.
