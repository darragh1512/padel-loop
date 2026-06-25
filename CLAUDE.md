# Padel Loop

## What this project is
Padel Loop is a mobile/web app that helps padel players **find and join a padel game near them, at their level**.

That single sentence is the whole goal for now. One core feature, done well:
- A player opens the app.
- They see padel games happening near them.
- The games shown match their skill level.
- They can join a game.

## Who is building it
- The owner (the user) has **zero coding experience**. This is their first software project.
- **How to work with them:**
  - Explain every step in plain English.
  - Never assume they know technical terms — define any term the first time it appears.
  - Go one small step at a time. Confirm each step works before moving on.
  - When suggesting a decision, give a clear recommendation rather than a list of options.

## The one core feature (for now)
"Find and join a padel game near you, at your level."

To deliver this, the app eventually needs to understand a few basic things:
- **Players** — who they are and what skill level they play at.
- **Games** — where and when a game is happening, what level it's for, and how many spots are open.
- **Location** — so we can show games that are *near* the player.
- **Joining** — a player taking an open spot in a game.

## What we are NOT doing yet
To stay focused, we are deliberately leaving these for later:
- Payments / booking court fees
- Chat / messaging between players
- Ratings, rankings, tournaments
- User accounts with passwords (we'll start simpler)

## Tech decisions (LOCKED)
- **Platform:** A **web app** that runs in a phone's web browser — NOT a native App Store / Play Store app. (A native app may come later.)
- **Framework:** **Next.js** — a popular toolkit for building web apps. It gives us pages, navigation, and a structure to build on.
- **Styling:** **Tailwind CSS** — a tool for making things look good (colours, spacing, layout) by adding short labels to elements.
- **Hosting / deploy:** **Vercel** — the service that puts the app on the internet so others can open it from a link.
- **Core user loop (LOCKED):** open app → see nearby games → tap one → join.

## Live links (the app on the internet)
- **Live public site:** https://padel-loop-one.vercel.app
- **Code (private GitHub repo):** https://github.com/darragh1512/padel-loop
- **Hosting:** Vercel, connected to the GitHub repo. Every `git push` to the
  `main` branch auto-rebuilds and updates the live site within ~1 minute.

## How to run the app on your computer
1. The project lives in `C:\Users\darra\Desktop\padel-loop`.
2. To start it: run `npm run dev` from inside that folder.
3. Then open a browser to **http://localhost:3000** to see it.
4. To stop it: close the terminal window running it (or press Ctrl+C in it).
- "Local" = running privately on your computer only (for testing changes).
  The public site is the Vercel link above, updated automatically on each push.

## Project status / progress log
- Match results (COMPLETE keystone): a full submit → confirm → finalise flow on
  the game detail page, across `src/app/match-results.ts` (data + RPC wrapper),
  `src/app/games/[id]/log-result.tsx` (entry + consensus UI), and three Supabase
  tables (`match_results`, `match_result_participants`, `match_result_sets`).
  The migrations live in `supabase/migrations/` (baseline schema + RLS, the
  consensus RPC, and the confirm-lock fix) as the source-of-truth record.
  - SUBMIT: players in a game get "Log result" (`log-result.tsx`). The form
    splits the roster into Team 1 / Team 2 and takes 1–3 set scores (0–7).
    `submitMatchResult` inserts the `match_results` row (submitted_by = me,
    status 'pending'), one `match_result_participants` row per player (team +
    confirmation; submitter 'confirmed', everyone else 'pending'), and the
    `match_result_sets` rows. One result per game (game_id unique) — a duplicate
    insert (23505) is handled gracefully.
  - SUBMIT VALIDATION (client, in `handleSubmit`): blocks any result that could
    never be finalised — exactly 2 players per team (true 2v2), every set
    untied with scores 0–7, and a strict overall winner (more sets won). The
    winner check mirrors the RPC exactly, so entry and finalisation can never
    disagree.
  - READ: `getResultDetail(gameId)` returns the full result — row status +
    `winning_team`, all participants joined to their profile name/avatar (same
    manual join as the roster/chat), and the sets in order. Drives the consensus
    view: score, both teams with each player's avatar + confirmation tick, and
    the current user's confirm action.
  - CONFIRM (server-authoritative): `confirmResult(gameId)` calls the
    `confirm_match_result(p_game_id)` Postgres RPC (security definer). The RPC
    flips the caller's confirmation and, once everyone has confirmed, computes
    the winner from the set scores (more sets won = winner; an exact tie is
    rejected) and finalises the result (status 'confirmed', `winning_team`,
    `confirmed_at`). It locks the `match_results` row up front (`for update`) so
    simultaneous confirms queue instead of racing. The UI shows the finalised
    result with the winning team highlighted and no confirm button.
  - SECURITY: the RPC owns every privileged write; the direct member-UPDATE RLS
    policies were dropped, closing the hole where any game member could finalise
    a result (set status/winning_team) unilaterally.
  - PROFILE STATS: `/players/[id]` "Played" and "Won" come from
    `getPlayerMatchStats(userId)` — counted from CONFIRMED results only (pending
    never counts); won = the player's team matched `winning_team`. Works for the
    owner's own profile and any other player's; zero confirmed matches shows 0/0.
- Home dashboard: home is now a dashboard (`src/components/HomeDashboard.tsx`,
  replaces the old HomeHero). Top: the "Your next game" hero (or a "Ready to
  play?" state when there's none). Below: two cards in a vertical stack — a
  prominent solid-vivid "Find a game" card (primary action → /discover) and a
  "Connections" card showing the connection count (→ /connections). Reuses
  `getUpcomingGamesFor` and `getConnectionCount`; no social feed. My Games,
  /discover, and the create flow untouched.
- Discover route: the "Games near you" joinable-games list (with its Level /
  Area / Time / Connections-only chips) now lives at `/discover`
  (`src/app/discover/page.tsx`), reusing `getGames`. `GameFilters` gained an
  `excludeOwnGames` prop that hides games the user has already joined or created
  (via `getJoinedOrCreatedGameIds` in `src/app/games.ts`), so Discover only
  shows genuinely joinable games. The list was removed from the home screen
  (home is now hero-only); the hero's "Find a game" / "Browse more games" links
  point to `/discover`. My Games and the create flow are untouched.
- Home screen reworked around one job — getting into a game fast. New
  `src/components/HomeHero.tsx` (client) leads the page: if the logged-in user
  has an upcoming game it shows "Your next game" prominently (links to the game);
  otherwise a "Find a game" / "Create a game" prompt. Create a game is a
  prominent primary action in both states. Below the hero, the existing
  joinable-games list + filter chips (`GameFilters`) is unchanged, wrapped in
  `#games` so the hero's "Find a game" scrolls to it. Reuses `getUpcomingGamesFor`
  and the `/create` flow — no new queries, no social feed.
- Player profile redesign (`/players/[id]`): layout/hierarchy only (data and
  queries unchanged). Prominent centred identity header — large avatar, name at
  the top of the type scale, and a single stats row (Skill · Connections ·
  Played · Won) built as an extensible list. (Played/Won now carry real
  confirmed-match data — see the Match results entry above.) Below: distinct
  "Upcoming games" then "About" (home club + bio) sections. Owner view keeps
  edit mode, the Settings gear, and the Connections entry; the connections count
  also lives in the stats row (links to /connections for the owner).
- Bottom nav restructured to four tabs: Home (`/`), My Games (`/my-games`),
  Chat (`/chat`), Profile (the user's avatar → their `/players/[id]`), plus the
  unchanged centre Create (+) button. The standalone Friends/Connections tab and
  the old Games-browse tab were removed. Connections is now surfaced in the
  profile hub: the owner's `/players/[id]` view has a "Connections" entry (with
  the count) linking to `/connections`, alongside a Settings gear (→ `/profile`).
- Chat avatars: each message author now shows their `PlayerAvatar` next to the
  name in the game chat thread (`chat-thread.tsx`). `getMessages` in
  `src/app/games.ts` now also looks up `avatar_url` (as `senderAvatarUrl` on
  `ChatMessage`), so chat shows the same DiceBear/photo avatar as everywhere
  else. Message layout, timestamp, and the author-name link are unchanged.
- Player search: new `/search` route (`src/app/search/page.tsx`) with a
  debounced (~300ms) text box that searches `profiles` by display name
  (case-insensitive partial match via `searchProfiles` in `src/app/profiles.ts`,
  excluding the current user). Results reuse `PlayerAvatar` and link to
  `/players/[id]`. Reachable via a "Find players by name" link on `/connections`.
- Connections ("padel friends"): a mutual connect system on top of the Supabase
  `connections` table (requester_id, addressee_id, status; PK on the pair). Data
  helpers live in `src/app/connections.ts`.
  - On someone else's `/players/[id]` profile there's a Connect / Connected
    button. Connecting inserts a row (requester = me, addressee = them,
    status `accepted`) — frictionless, no approval step. The button reads
    "Connected" when an accepted row exists in EITHER direction; tapping it then
    disconnects, which deletes the row whichever way round it was made.
  - Every profile (owner and visitor) shows a connections count — accepted
    connections involving that player in either direction. The owner's count
    links to `/connections`.
  - New `/connections` route (`src/app/connections/page.tsx`) lists the logged-in
    player's accepted connections (the "other person" in each row), reusing
    `PlayerAvatar` and linking each to their `/players/[id]`.
  - Supabase note: the `connections` table needs RLS policies allowing a
    signed-in user to select/insert/delete rows where they are the requester or
    addressee, for this to work live.
- Player profiles: added a public player profile page at `/players/[id]`
  (`src/app/players/[id]/page.tsx`). Shows avatar, name, skill level, home club,
  bio, and the player's upcoming games (joined games with a future game_time,
  via `getUpcomingGamesFor` in `src/app/games.ts`). The profile's owner gets an
  Edit mode: name, skill level (Beginner/Improver/Intermediate/Advanced/Pro),
  home club, bio, and avatar upload.
  - Avatars: if `profiles.avatar_url` is set we show that photo; otherwise a
    DiceBear avatar generated from the user id (DiceBear v9 `createAvatar` from
    `@dicebear/core` + `@dicebear/collection`). Rendered through a shadcn-style
    `Avatar` (`src/components/ui/avatar.tsx`, Radix-based) wrapped by
    `src/components/PlayerAvatar.tsx`, with an initials fallback.
  - Avatar upload writes to the public `avatars` storage bucket at the fixed
    path `${userId}/avatar` with `upsert` (overwrites — files don't pile up),
    then saves the public URL to `profiles.avatar_url`. See `uploadAvatar` /
    `savePlayerProfile` in `src/app/profiles.ts`.
  - Players are now clickable through to their profile everywhere a name/avatar
    shows: the game detail roster (`src/app/games/[id]/page.tsx`) and chat
    message authors (`chat-thread.tsx`) link to `/players/[user-id]`. The bottom
    nav's Profile tab now shows the logged-in user's own avatar and links to
    their `/players/[id]` page (logged out, it falls back to the old icon →
    `/profile`). Because of that, the owner's player profile gained a "Settings"
    link (to the older `/profile` page) and the "Log out" button.
  - The game-detail roster now renders each player through `PlayerAvatar` (same
    DiceBear/photo avatar as everywhere else), so `avatar_url` is now carried on
    the `Player` type and fetched in `src/lib/data.ts`. Open slots (no user id)
    keep the dashed-"+" fallback `Avatar`. Decorative avatar stacks on game
    cards (`AvatarStack`) are deliberately left as-is.
  - Supabase note: for this to work live, the `profiles` table needs a public
    (read) policy so anyone can view a profile, and the `avatars` bucket needs
    a policy letting a signed-in user write their own `${userId}/...` path.
- Day 1: Scaffolded the Next.js + Tailwind app and got it running locally.
- Day 2: Connected the app to the Supabase `games` table. List + detail screens
  now read REAL data from the database (verified working locally). Env vars are
  in `.env.local` (local only — still need to be added in Vercel for the live site).
  - `game_time` is now shown in friendly form (e.g. "Wed 10 Jun, 5:30 pm") via
    `formatGameTime()` in `src/app/games.ts`. Displayed in UTC (same timezone
    it's stored in) so the time typed in Supabase matches what's on screen.
- Day 1: Built the clickable core loop as placeholder screens (no database/login/payments):
  - `src/app/games.ts` — hand-made list of example games (the fake data).
  - `src/app/page.tsx` — the "nearby games" LIST screen (home, "/").
  - `src/app/games/[id]/page.tsx` — the game DETAIL screen ("/games/1", etc.).
  - `src/app/games/[id]/join-button.tsx` — the "Join" button (shows a
    confirmation when tapped; no real booking yet).
  - Navigation works: list → tap a game → detail → "Back to games" → list.

## Database (Supabase)
- The app reads games from a **Supabase** database (table: `games`).
- Library: `@supabase/supabase-js`. Connection set up in `src/lib/supabaseClient.ts`.
- Secrets live in `.env.local` (NOT committed to git). Two variables:
  - `NEXT_PUBLIC_SUPABASE_URL` = Supabase Project URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Supabase publishable key
- IMPORTANT: after editing `.env.local`, the dev server must be restarted to
  pick up the new values.
- `games` table columns: id, venue, location, game_time, skill_level,
  max_players, current_players.
  - "Spots left" is computed as `max_players - current_players`.
  - NOTE: there is no distance column, so the old "X km away" text was removed.
- For the live Vercel site to show data, the same two env vars must also be
  added in the Vercel project settings (Environment Variables) — not done yet.

## Key files (where things live)
- Data-fetching from Supabase: `src/app/games.ts` (`getGames`, `getGame`).
- Supabase connection: `src/lib/supabaseClient.ts`.
- List screen: `src/app/page.tsx`.
- Detail screen: `src/app/games/[id]/page.tsx`.
- Join button: `src/app/games/[id]/join-button.tsx`.

## Glossary (plain English)
- **CLAUDE.md** — this file; the project's memory notes for the AI assistant.
- **Padel** — the racquet sport this app is for (played in pairs on an enclosed court).
- (We'll add more terms here as they come up.)
