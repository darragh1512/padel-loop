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

**THE PEÑA: warm, loud, physical, social.** A neighbourhood Spanish padel club's corkboard, not a software product: blue court paint, riso-printed match posters, ticket stubs, the club stamp. Confidence comes from shouting the right things in condensed capitals and printing the details in letterspaced mono — never from gradients or gloss. Voice is plain, friendly and short, with a wink of club Spanish where natural ("Game on?", "¿Jugamos?", "+ you?", "Count me in"). See DESIGN.md — the peña system is final; the earlier wellness/Members' Club exploration is dead.

**Brand architecture:** Loop is the parent brand; Padel Loop = THE PEÑA. Future sibling products (e.g. a 5-a-side football app) get their own names and identities — the FLOODLIT direction in /design-lab is reserved for those, never Padel Loop.

## Anti-references

- **Corporate / bland SaaS**: the generic blue-and-white dashboard that could be any software product. The app's original navy `#1e5cff` "startup tech" look was explicitly rejected — never drift back toward it. (The peña's pista blue is court paint with grain and posters on it, not a SaaS ground.)
- **Sports-tech gloss**: glassy gradients, glow effects, dark-mode neon.
- Badge clutter, promo banners, confetti gamification — the board carries real games, not engagement bait.

## Design Principles

1. **One job per screen.** Every screen answers one question (home: "what's my next game?"; discover: "what can I join?"). If an element doesn't serve the screen's job, it goes.
2. **Fast to a game.** The primary action (find / join / create a game) is always the most prominent thing on screen. Minimise taps and decisions between "I want to play" and "I'm in".
3. **Everything is paper on the wall.** Content lives on papel posters — stapled, tilted, grained — against the painted court wall. Depth is the poster's shadow and the hard riso offset, never soft decorative glow.
4. **Shout the headline, print the details.** Bricolage Grotesque 800 caps for the few big words; Space Mono 700 caps for dates, labels and metadata; body stays sentence-case 500. Weight, case and family do all the contrast work — no italics, ever.
5. **Explain like a friend.** UX copy in plain, warm English — no jargon, no corporate voice. (Mirrors how the project itself is built: the owner is a first-time builder.)

## Accessibility & Inclusion

WCAG AA as the baseline: body text ≥ 4.5:1 contrast against its background (tinta on papel is ~15:1; watch reduced-alpha text — `tinta/70` on papel and `papel/80` on pista are the muted floors, and naranja-d, not naranja, is the orange for small text on papel), large text ≥ 3:1. Every animation respects `prefers-reduced-motion` (slap, stamp spin and marquee all render static). Mobile-first and one-hand usable: primary actions in thumb reach, tap targets ≥ 44px. No meaning carried by colour alone (e.g. confirmation states pair the tick with the tint; the winning team gets the word "Winner", not just lima).
