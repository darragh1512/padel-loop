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

**Calm, premium, welcoming.** A considered-club feel — closer to a wellness-lifestyle brand than to sporty tech. Quiet confidence: the serif speaks, the interface doesn't shout. Warmth comes from type, tone of voice, and the sage accent used sparingly — never from noise, badges, or gamification. Voice is plain, friendly, and short ("Ready to play?", "Your next game").

## Anti-references

- **Corporate / bland SaaS**: the generic blue-and-white dashboard that could be any software product. The app's original navy `#1e5cff` "startup tech" look was explicitly rejected and replaced — never drift back toward it.
- Drop shadows as decoration, badge clutter, promo banners, streaks/confetti gamification.
- Anything that makes a calm club feel like a busy marketplace.

## Design Principles

1. **One job per screen.** Every screen answers one question (home: "what's my next game?"; discover: "what can I join?"). If an element doesn't serve the screen's job, it goes.
2. **Fast to a game.** The primary action (find / join / create a game) is always the most prominent thing on screen. Minimise taps and decisions between "I want to play" and "I'm in".
3. **Quiet surfaces, one accent.** Depth from hairline borders, not shadows; sage reserved for the key action and active states. When everything is calm, the one accented thing is unmissable.
4. **The serif is the brand moment.** Instrument Serif appears only for screen titles, hero numbers, and the greeting — that scarcity is what makes it feel premium.
5. **Explain like a friend.** UX copy in plain, warm English — no jargon, no corporate voice. (Mirrors how the project itself is built: the owner is a first-time builder.)

## Accessibility & Inclusion

WCAG AA as the baseline: body text ≥ 4.5:1 contrast against its background (watch muted `ink-secondary` on tinted surfaces), large text ≥ 3:1. Every animation respects `prefers-reduced-motion` (the existing `.pl-rise` pattern already does this — keep it up). Mobile-first and one-hand usable: primary actions in thumb reach, tap targets ≥ 44px. No meaning carried by colour alone (e.g. confirmation states pair the tick with the tint).
