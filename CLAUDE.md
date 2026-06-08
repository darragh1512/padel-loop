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

## How to run the app on your computer
1. The project lives in `C:\Users\darra\Desktop\padel-loop`.
2. To start it: run `npm run dev` from inside that folder.
3. Then open a browser to **http://localhost:3000** to see it.
4. To stop it: close the terminal window running it (or press Ctrl+C in it).
- "Local" = running privately on your computer only. Putting it on the public
  internet (so others can visit) is a separate step using Vercel, done later.

## Project status / progress log
- Day 1: Scaffolded the Next.js + Tailwind app and got it running locally.
- Day 1: Built the clickable core loop as placeholder screens (no database/login/payments):
  - `src/app/games.ts` — hand-made list of example games (the fake data).
  - `src/app/page.tsx` — the "nearby games" LIST screen (home, "/").
  - `src/app/games/[id]/page.tsx` — the game DETAIL screen ("/games/1", etc.).
  - `src/app/games/[id]/join-button.tsx` — the "Join" button (shows a
    confirmation when tapped; no real booking yet).
  - Navigation works: list → tap a game → detail → "Back to games" → list.

## Key files (where things live)
- Example game data: `src/app/games.ts` (edit games here).
- List screen: `src/app/page.tsx`.
- Detail screen: `src/app/games/[id]/page.tsx`.
- Join button: `src/app/games/[id]/join-button.tsx`.

## Glossary (plain English)
- **CLAUDE.md** — this file; the project's memory notes for the AI assistant.
- **Padel** — the racquet sport this app is for (played in pairs on an enclosed court).
- (We'll add more terms here as they come up.)
