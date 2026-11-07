# Product

## Register

product

## Users

Padel players who want to get into a game. They're on their phone — often between things, sometimes courtside — looking for one answer: "is there a game near me, at my level, that I can join right now?" They range from beginners to advanced club players; many are social players for whom padel is as much about people as sport. The owner's own community is the first user base.

The job to be done: **find and join a padel game near you, at your level** — open the app, see nearby games, tap one, join. Secondary jobs: run the games you've created (roster, chat, logging results) and keep a light social graph of padel friends.

## Product Purpose

Padel Loop removes the coordination pain of getting a padel game together. Instead of WhatsApp group chaos, a player sees real games with real open spots, filtered to their level and area, and takes a spot in one tap. Game owners get their slots filled ("set one up once — the Loop fills the slots").

Success looks like: a player goes from opening the app to being confirmed in a game in under a minute, and comes back weekly because their games live here.

Deliberately out of scope for now: payments/court booking, rankings/tournaments, native app-store apps.

## Brand Personality

**Clear, familiar, useful.** Padel Loop should feel like an app that came with the iPhone: calm, quick and obvious, so attention stays on finding a game. Character comes from the padel court, which is how every game is shown, and from a voice that's plain, friendly and short. See DESIGN.md.

## Anti-references

- **Game-like or heavily themed looks.** They got in the way of finding and booking a game, so useful comes first.
- **Corporate, bland software.** Warmth comes from plain wording and real people, not decoration.
- **Sports-tech gloss.** No glow effects or neon.
- **Badge clutter, promo banners and engagement bait.** Screens carry real games and real people.

## Design Principles

1. **One job per screen.** Every screen answers one question (home: "what's my next game?"; discover: "what can I join?"). If an element doesn't serve the screen's job, it goes.
2. **Fast to a game.** The primary action (find, join or create a game) is the most prominent thing on screen. Minimise taps and decisions between "I want to play" and "I'm in".
3. **Build on what people know.** Use familiar iPhone patterns for navigation, lists, sheets and alerts, so nothing needs explaining.
4. **Tell the truth.** Real data only. Hide what isn't known, and never let a failed load look like an empty list.
5. **Explain like a friend.** UX copy is in plain, warm English, with no jargon or corporate voice. (This mirrors how the project is built: the owner is a first-time builder.)

## Accessibility & Inclusion

WCAG AA is the baseline: body text at least 4.5:1 contrast against its background and large text at least 3:1, with light, dark and increased-contrast values defined in `src/app/ios.css`. Every animation respects Reduce Motion. It's mobile-first and one-hand usable, with primary actions in thumb reach and tap targets of at least 44 points. Colour never carries meaning alone: a winning team also gets the word "Winner", and a taken spot is a solid disc where an open one is a ring.
