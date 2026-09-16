---
name: Padel Loop
description: Find and join a padel game near you, at your level. THE PEÑA design system.
colors:
  pista: "#1A4FC4"
  pista-oscura: "#0F1C3F"
  papel: "#F4EEE0"
  tinta: "#10214A"
  naranja: "#FF5A1F"
  naranja-oscura: "#C93E0F"
  lima: "#C6E63F"
typography:
  display:
    fontFamily: "Archivo Black, Arial Black, system-ui, sans-serif"
    fontWeight: 400
    textTransform: uppercase
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Archivo, Helvetica, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  mono-label:
    fontFamily: "Space Mono, Courier New, monospace"
    fontSize: "10px-12px"
    fontWeight: 700
    textTransform: uppercase
    letterSpacing: "0.12em"
rounded:
  stamp: "2px"
  poster: "4px"
  field: "4px"
  pill: "9999px"
---

# Design System: Padel Loop — THE PEÑA

**Superseded the wellness/Club House exploration — peña is final.**

**`src/app/globals.css` (`@theme`) is the source of truth.** Every token, class
and spec below is read from it. The `design-lab/` prototypes seeded this system
and are still worth reading for intent, but the app has moved past them in
places — where they disagree, the code wins and this document follows the code.

## 0. Brand Architecture

**Loop is the parent brand. Padel Loop = THE PEÑA.** Future sibling products
(e.g. a 5-a-side football app) are SEPARATE products with their own
names/identities. The FLOODLIT direction in `/design-lab` is reserved for
those, NOT Padel Loop. Never mix them.

## 1. The idea

Padel wasn't born in a gym — it was born on blue courts in Marbella and Buenos
Aires, announced on riso-printed posters pinned to the club corkboard. **Every
screen IS the corkboard**: a court-blue painted wall, and everything on it is a
piece of paper — a match poster, a ticket stub, a stamped notice. Warm, loud,
physical, analogue and social. A neighbourhood club with regulars and in-jokes
— never sports-tech, never SaaS.

One refinement the build settled: the paper is **cut and squared**, not tossed
on. Posters sit flat with a hard ink edge and a print-register drop. See §4.

## 2. Colours (the only palette — no other hex values anywhere)

| Token | Hex | Role |
|---|---|---|
| `--color-pista` | `#1A4FC4` | Court paint. The wall — the `body` background. |
| `--color-pista-d` | `#0F1C3F` | Court paint, night. `<html>` background, PWA theme colour, splash screens. |
| `--color-papel` | `#F4EEE0` | Poster paper. Every card, sheet, nav bar, input; text on blue and on naranja. |
| `--color-tinta` | `#10214A` | Print ink. All text on papel, all borders, riso offset shadows, the marquee tape. |
| `--color-naranja` | `#FF5A1F` | Riso orange. The create FAB, venue strips, unread dots, accent punctuation. |
| `--color-naranja-d` | `#C93E0F` | Riso orange, dark cut. Small orange text ON papel (contrast), and the danger voice. |
| `--color-lima` | `#C6E63F` | Faded lime, second print pass. Primary CTAs, active chips, the active nav glyph, focus rings. |
| `--color-scrim` | `rgb(16 33 74 / 0.55)` | Behind dialogs. Tinta at alpha, not black. |

Derived tones are **always alpha of a token**, via Tailwind opacity modifiers —
never new hexes:
- Pressed paper / quiet fills on papel: `bg-tinta/6` – `bg-tinta/10`
- Secondary text on papel: `text-tinta/70`; faint/placeholders: `text-tinta/45`
- Secondary text on the blue wall: `text-papel/80`; faint: `text-papel/60`
- Hairlines inside papel cards: `border-tinta/15`
- The wall's halftone grain: `rgb(255 255 255 / 0.07)`; its painted lines:
  `rgb(255 255 255 / 0.1)`
- Skeleton ghosts: `rgb(244 238 224 / 0.25)`, shimmer at `/0.35`

**Named rules**
- **The Paper Rule.** Content lives on papel. The blue wall is background —
  headings, kickers and section labels sit directly on it in papel; everything
  else gets a piece of paper.
- **Ink, not grey.** There is no grey. Muted = tinta or papel at reduced alpha.
- **Danger speaks naranja-d** (`#C93E0F`) on papel — dark riso orange, never
  alarm red.

## 3. Typography

Three families, loaded via `next/font` in `layout.tsx` and exposed as the
`--font-*` tokens:

- **Archivo** (`--font-sans`; 400 / 500 / 600 / 700) — body, buttons' non-mono
  text, everything that isn't a shout or a label.
- **Archivo Black** (`--font-display`; single weight 400 — the family *is* the
  weight) — the poster shout.
- **Space Mono** (`--font-mono`; 400 / 700) — the printed-label voice: kickers,
  dates, venue strips, nav labels, stamps, section labels, button text.

### HARD type rules

Contrast comes from **FAMILY** (Archivo Black vs Archivo vs Space Mono),
**CASE** (caps vs sentence) and **TRACKING** (tight display vs wide mono).
Nothing else.

- **NO ITALICS ANYWHERE.** Not for emphasis, not for empty states, not for
  timestamps.
- **Display** (`.t-display`): Archivo Black, UPPERCASE, letter-spacing −0.02em.
  Pair with a size from the display scale. Screen titles, poster headlines,
  hero numbers, "Team 1 won".
- **Mono label** (`.t-mono`): Space Mono 700, UPPERCASE, letter-spacing 0.12em.
  Kickers, dates, metadata, nav labels, section labels, button text.
- **Eyebrow** (`.t-eyebrow`): Space Mono 400, UPPERCASE, letter-spacing 0.2em —
  the widest voice, for the small line above a title ("NEXT UP · TUE 21:00").
- **Body**: Archivo 500, sentence case, `text-body` (13px), line-height 1.5.
  Bold runs are **700** — Archivo's top weight; there is no 800.

### The size scale (fixed rem, in `@theme`)

| Token | px | Use |
|---|---|---|
| `text-nav` | 10 | bottom-nav mono labels only |
| `text-tiny` | 10 | stamped tags inside cards |
| `text-micro` | 11 | faintest mono annotations, chips |
| `text-label` | 12 | dense metadata under titles |
| `text-body` | 13 | all reading text |
| `text-title` | 15 | mono button/CTA text |
| `text-display-xs` | 17 | quiet display in tiles |
| `text-display-sm` | 22 | card display, hero numbers |
| `text-display-md` | 28 | screen titles |
| `text-display-lg` | 40 | the greeting / wordmark |
| `text-display-xl` | 48 | the biggest poster shout |

## 4. Signature devices

Classes live in `globals.css`; components in `src/components/brand.tsx`.

| Device | Class / component | Spec |
|---|---|---|
| Corkboard wall | `body` | Flat `pista` + a 6px halftone dot grain at `rgb(255 255 255/.07)` + two painted court-line gradients at `/0.1` (one vertical service line, cross-court lines every 340px). All `background-attachment: fixed`, so posters scroll over the paint. `<html>` is `pista-d`. |
| Pinned poster | `.pl-card` | Flat papel, **2px tinta border**, 4px radius, `--shadow-sheet` (`4px 4px 0 rgb(6 20 58/.45)`). **No grain, no blur** — cut paper, not textured. |
| Hard shadows | `--shadow-sheet` / `--shadow-poster` | `4px 4px 0` and `6px 6px 0`, both `rgb(6 20 58 / 0.45)`. The only two drop shadows in the system. |
| Riso offset | `.pena-riso` | `box-shadow: 4px 4px 0 tinta` on lima/naranja controls with a 2px tinta border. Hover lifts to `5px 5px 0` + `−1px −1px`; active presses to `1px 1px 0` + `3px 3px`. |
| Deep riso | `.pena-riso-lg` | `5px 5px 0` (hover 6, active 2). Reserved for the one loud CTA on a screen. |
| Lime tape | `.pena-tape` | A torn strip across a poster's top edge: 54×16px, `lima/.75`, 1.5px `tinta/.35` border, rotated −3°. Absolutely positioned, `pointer-events: none`. |
| Marquee tape | `.pena-cinta` | Full-bleed tinta band rotated −0.6°, `scale(1.02)`, 26s infinite `translateX` ticker, key words in lima. Decorative only (`aria-hidden`). |
| Rubber-stamp crest | `<ClubStamp />` | Double circle + Space Mono textPath "PADEL LOOP · EST. 2026 · LA PEÑA · DUBLIN ·" + dashed loop scribble + ball dot. 40s spin via `.pena-stamp`. |
| Court hero | `<CourtHero />` | The drawn court panel at the top of a game screen. |
| Loop ring | `<LoopRing />` / `<MiniLoop />` | The dashed loop-and-ball mark — profile avatars and the "this week" tile. Also the app icon (`scripts/generate-pwa-assets.mjs`). |
| Wordmark | `<Wordmark />` | The lockup with optional tagline. Auth screens and first-run. |
| Live pulse | `.pena-pulse` | One ink ring breathing out of a round icon, 2.4s. **One per screen**, on the single "go and look" affordance. |
| Slap entrance | `.pl-rise` | Posters land on the board: opacity 0 + scale .94 → 1 over 260ms `--ease-out-strong`, staggered ≤60ms via `animation-delay`. |
| Popover entrance | `.pl-pop` | Scales in from its trigger corner using `@starting-style`; origin set by `--pl-pop-origin`. |
| Exit | `.pl-fade-out` | 150ms — always faster than the entrance. |
| Press feedback | `.pl-press` | Colour transitions always; `scale(0.98)` only when motion is allowed. |
| Tap-target extension | `.pl-hit` | Invisible ::after guaranteeing 44×44px on small controls. |
| Skeleton | `.pl-skeleton` | `papel/25` block, 4px radius, shimmer sweep at `papel/35`. Never a spinner for content. |
| Hidden scrollbar | `.no-scrollbar` | Horizontal filter rows scroll without a visible bar. |
| Venue strip | pattern | Full-bleed naranja band across a poster, papel mono caps, space-between. |
| Spanish-club voice | copy | LA PEÑA, "¿Jugamos?", "Game on?", "+ you?", "Count me in". Sprinkled where natural — never at the cost of clarity. |

### Retired

Kept as empty hooks so un-swept screens conform automatically instead of
breaking. **Do not add them to new markup; strip them as you touch a screen.**

- **`.pena-staples`** — now `position: relative` and nothing else. Still in ~8
  files.
- **`.pena-tilt-a/-b/-c`** — now `rotate: 0deg`. Still in ~12 files. The
  prototype squared the cards up; tilt is gone.
- **`.pena-ticket`** and **`.o1`** (the one recoloured "o") — removed
  entirely. Neither exists in CSS or markup.
- **`<CourtPaint />`** — still exported from `brand.tsx`, used nowhere. The
  painted lines moved into the `body` background as gradients.

## 5. Components

- **Buttons** — **cut squares, not pills**: `rounded-card` (4px), the same
  radius as the posters they sit on. `h-12` (48px) standard, `h-9` small. Text
  is `.t-mono` uppercase.
  - *Primary*: lima fill, tinta text, 2px tinta border, `.pena-riso`. The one
    loud thing.
  - *Secondary*: papel fill, tinta text, 2px tinta border, flat; hover
    `bg-lima/40`.
  - *Destructive*: papel fill, naranja-d text, 2px **dashed** naranja-d border.
    Never lima, never a filled naranja.
- **Chips** (`Chip` / `ChipButton`): `.t-mono` at `text-micro`, `rounded-pill`,
  2px tinta border, papel fill. Active = lima fill. Filter rows use
  `.no-scrollbar`.
- **Inputs** (`.pl-surface`): papel fill, 2px tinta border, 4px radius; focus
  turns the border naranja; placeholders `text-tinta/45`. No borderless inputs.
- **Cards**: `.pl-card` posters. Depth is the hard offset shadow — no
  hairline-only cards on the wall.
- **Dialog**: a papel poster on the tinta scrim — **3px** tinta border,
  `shadow-poster`, `.pl-rise`, `.t-display` title. Confirmations stay centred;
  bottom sheets are for everything else.
- **Bottom nav**: papel bar, **2px tinta top border**, five columns. Active tab
  = a **tinta pill with a lima glyph** and tinta label; inactive = `tinta/50`.
  Centre create FAB = naranja circle, 3px tinta border, `0 5px 0 tinta` shadow,
  raised `−1.625rem`. Bottom padding clears the home indicator via
  `max(0.875rem, env(safe-area-inset-bottom))`.
- **Avatars**: DiceBear `thumbs`, seeded on the user id, backgrounds
  `F4EEE0` / `C6E63F` / `FF5A1F`. Initials fallback. Open slots = dashed
  naranja circle reading "+ you?".
- **The three list states** — different things, drawn differently, never
  conflated:
  - *Loading* — `.pl-skeleton` in the shape of the content, or `LoadingRows`.
    Never a spinner, never a message.
  - *Empty* — `EmptyState`: a lucide icon in a lima medallion, a `.t-display`
    heading, one line of body, and **one action that resolves the emptiness**.
    An empty screen points somewhere.
  - *Errored* — `ErrorState`: dashed naranja-d border, the same shape, and a
    retry. Says the loading **failed** — never phrased as absence. A failed
    fetch must never render as "no games yet".

## 6. Motion

- `--ease-out-strong: cubic-bezier(.23, 1, .32, 1)` for almost everything;
  `--ease-sheet: cubic-bezier(.32, .72, 0, 1)` for sheets.
- Entrances are the **slap** (`.pl-rise`); exits are faster fades
  (`.pl-fade-out`, 150ms). The stamp spins; the cinta scrolls; the pulse
  breathes.
- **Every animation is gated behind `prefers-reduced-motion`** — slap, spin,
  marquee, pulse, shimmer and the press scale all render static when reduced.
  Colour feedback never disappears.
- Tap targets ≥ 44px (`.pl-hit`).
- Focus rings: the shared `FOCUS` constant in `ui.tsx` is **3px lima, offset 2**.
  Screens outside the component kit currently use a 2px ring in lima or
  naranja — inconsistent, worth sweeping onto `FOCUS`.

## 7. The app shell (installable)

Padel Loop is installed to the home screen, so it runs with **no browser
chrome**. Two consequences that are design constraints, not implementation
details:

- **There is no back button.** Every screen needs its own way back — the bottom
  nav, or an explicit control. A screen with neither strands the person.
- **Safe areas are real.** `viewport-fit=cover` is set, so
  `env(safe-area-inset-*)` resolves. The status bar sits *on* the app
  (`black-translucent`), so the shell pads `env(safe-area-inset-top)` and the
  bottom nav pads `env(safe-area-inset-bottom)`. Anything `fixed inset-0` (the
  full-screen chats) handles both itself.
- Icons and splash screens are generated from the loop mark by
  `scripts/generate-pwa-assets.mjs` — regenerate the whole set from there
  rather than editing one size by hand.

## 8. Do's and Don'ts

### Do
- **Do** put every piece of content on papel, and every heading straight on the
  blue wall in papel.
- **Do** keep posters squared-up and flat — a hard 2px ink edge and the
  print-register drop.
- **Do** write labels in Space Mono 700 caps tracked wide; write headlines in
  Archivo Black caps.
- **Do** use the riso offset shadow + 2px tinta border on primary controls —
  print register, not glow.
- **Do** give every empty state one action, and draw errors differently from
  emptiness.
- **Do** respect `prefers-reduced-motion` on slap, spin, marquee and pulse.

### Don't
- **Don't** use italics. Ever.
- **Don't** invent hexes — every colour is a token or a token at alpha. No
  greys, no white (`#FFF` exists nowhere; paper is papel).
- **Don't** add `.pena-staples` or `.pena-tilt-*` to new markup — they are
  retired no-ops.
- **Don't** make buttons pills. Buttons are 4px cut squares; only chips and
  avatars are round.
- **Don't** use soft/blurred decorative shadows — shadows are the hard poster
  drop or the hard riso offset, nothing else.
- **Don't** reach for FLOODLIT (optic yellow / Anton) — that direction belongs
  to future sibling Loop products, never Padel Loop.
- **Don't** drift back to the wellness/Members' Club look (warm bone, sage,
  Instrument Serif) or the navy `#1e5cff` SaaS look — both are dead.
- **Don't** let the Spanish voice obscure meaning — flavour, not friction.
