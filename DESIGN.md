---
name: Padel Loop
description: Find and join a padel game near you, at your level. THE PEÑA design system.
colors:
  pista: "#1C5BBF"
  pista-oscura: "#14459A"
  papel: "#F3E9D2"
  tinta: "#191407"
  naranja: "#FF5A1F"
  naranja-oscura: "#C93E0F"
  lima: "#D8E24A"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Arial Black, sans-serif"
    fontWeight: 800
    textTransform: uppercase
    fontStretch: "90%"
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.6
  mono-label:
    fontFamily: "Space Mono, monospace"
    fontSize: "10px-13px"
    fontWeight: 700
    textTransform: uppercase
    letterSpacing: "0.12em-0.24em"
rounded:
  poster: "4px"
  field: "4px"
  pill: "9999px"
---

# Design System: Padel Loop — THE PEÑA

**Superseded the wellness/Club House exploration — peña is final.**

Source of truth for the identity: `design-lab/landing-pena.html` + `design-lab/wildcard-en.html`. This document is the law extracted from those two files; the live tokens are in `src/app/globals.css` (`@theme`). If this document and those source files ever disagree, the source files win.

## 0. Brand Architecture

**Loop is the parent brand. Padel Loop = THE PEÑA.** Future sibling products (e.g. a 5-a-side football app) are SEPARATE products with their own names/identities. The FLOODLIT direction in `/design-lab` is reserved for those, NOT Padel Loop. Never mix them.

## 1. The idea

Padel wasn't born in a gym — it was born on blue courts in Marbella and Buenos Aires, announced on riso-printed posters stapled to the club corkboard. **Every screen IS the corkboard**: a court-blue painted wall, and everything on it is a piece of paper — a match poster, a ticket stub, a stamped notice. Warm, loud, physical, analogue and social. A neighbourhood club with regulars and in-jokes — never sports-tech, never SaaS.

## 2. Colours (the only palette — no other hex values anywhere)

| Token | Hex | Role |
|---|---|---|
| `--color-pista` | `#1C5BBF` | Court paint. The wall — page background gradient start. |
| `--color-pista-d` | `#14459A` | Court paint, evening. Gradient end, `<html>` background, theme colour. |
| `--color-papel` | `#F3E9D2` | Poster paper. Every card, sheet, nav bar, input; text on blue and on naranja. |
| `--color-tinta` | `#191407` | Print ink. All text on papel, all borders, riso offset shadows, the marquee tape. |
| `--color-naranja` | `#FF5A1F` | Riso orange. THE active colour: active nav tab, the create FAB, venue strips, the coloured "o". |
| `--color-naranja-d` | `#C93E0F` | Riso orange, dark cut. Small orange text ON papel (contrast), and the danger voice. |
| `--color-lima` | `#D8E24A` | Faded lime, second print pass. Primary CTAs, active chips, your chat bubbles, highlights, focus rings. |

Derived tones are **always alpha of a token**, via Tailwind opacity modifiers — never new hexes:
- Pressed paper / quiet fills on papel: `bg-tinta/6` – `bg-tinta/10`
- Secondary text on papel: `text-tinta/70`; faint/placeholders: `text-tinta/45`
- Secondary text on the blue wall: `text-papel/80`; faint: `text-papel/60`
- Hairlines inside papel cards: `border-tinta/15`
- Scrim behind dialogs: `rgb(25 20 7 / 0.55)` (`--color-scrim`)
- The wall's dot grain: `rgb(255 255 255 / .06)`; paper grain & staples: `rgb(25 20 7 / .05–.35)`

**Named rules**
- **The Paper Rule.** Content lives on papel. The blue wall is background — headings, kickers and section labels sit directly on it in papel; everything else gets a piece of paper.
- **Ink, not grey.** There is no grey. Muted = tinta or papel at reduced alpha.
- **Danger speaks naranja-d** (`#C93E0F`) on papel — dark riso orange, never alarm red.

## 3. Typography

- **Bricolage Grotesque** (`--font-sans`, `--font-display`; weights 500 + 800, variable opsz/wdth) — everything.
- **Space Mono** (`--font-mono`; 400 + 700) — the "printed label" voice: kickers, dates, venue strips, tickets, nav labels, stamps, section labels.

### HARD type rules
Contrast comes from **WEIGHT** (500 vs 800), **CASE** (caps vs sentence), and **FAMILY** (grotesque vs mono). Nothing else.
- **NO ITALICS ANYWHERE.** Not for emphasis, not for empty states, not for timestamps.
- **Display** (`.t-display`): Bricolage 800, UPPERCASE, `font-stretch: 90%`, line-height 0.95, letter-spacing −0.02em. Screen titles, poster headlines, hero numbers, "Team 1 won".
- **Mono label** (`.t-mono`): Space Mono 700, UPPERCASE, letter-spacing 0.12–0.24em, 9–13px. Kickers, dates, metadata, nav labels, section labels, ticket text.
- **Body**: Bricolage 500, sentence case, 15px, line-height 1.6. Bold runs are **800**, never 600/700.
- The signature glyph: one "o" per big headline recoloured naranja (or lima on dark) — `<span class="o1">o</span>`. One per headline, maximum.

## 4. Signature devices (reusable patterns — classes in globals.css)

| Device | Class / component | Spec |
|---|---|---|
| Corkboard wall | `body` | `linear-gradient(174deg, pista → pista-d)` + halftone dot grain `radial-gradient(rgb(255 255 255/.06) 1px, transparent 1.2px) 0 0/16px 16px`, fixed. |
| Painted court lines | `<CourtPaint />` (brand.tsx) | Full-bleed fixed SVG: 3 slightly-skewed papel lines at `.16` alpha behind everything. |
| Pinned poster | `.pl-card` | Papel fill + paper grain (`9px` dot grid at `rgb(25 20 7/.05)`) + 4px radius + poster shadow `0 14px 34px -12px rgb(8 20 50/.7)`. |
| Tilt | `.pena-tilt-a/-b/-c` | `rotate: −1.2° / 1.1° / −0.8°`; interactive posters straighten on hover. Posters tilt; list rows and forms stay straight. |
| Staples | `.pena-staples` | Two drawn staple bars (`::before/::after`, `rgb(25 20 7/.35)`, rotated ∓24°/18°) at the top corners. |
| Perforated ticket | `.pena-ticket` pattern | Lima body + papel rip strip, scalloped edge via radial-gradient masks, barcode via repeating-linear-gradient. (Landing / brand moments.) |
| Rubber-stamp crest | `<ClubStamp />` (brand.tsx) | Double circle + Space Mono textPath "PADEL LOOP · EST. 2026 · LA PEÑA · DUBLIN ·" + dashed loop scribble + ball dot; 40s spin (reduced-motion: static). |
| Marquee tape | `.pena-cinta` | Full-bleed tinta band, rotated −0.6°, `scale(1.02)`, infinite translateX ticker, key words in lima. Decorative only (`aria-hidden`). |
| Venue strip | pattern | Full-bleed naranja band across a poster, papel mono caps, space-between. |
| Squad pills | `Chip` / open slot | Outlined tinta pills; the open slot is **dashed naranja** reading "+ you?". |
| Riso offset shadow | `.pena-riso` | `box-shadow: 3px 3px 0 tinta` on lima/naranja controls with a 2px tinta border; active presses to `1px 1px 0` + 2px translate. |
| Slap entrance | `.pl-rise` | Cards land on the board: opacity 0 + scale .94 → 1 over 260ms `cubic-bezier(.23,1,.32,1)`, staggered ≤60ms. Reduced motion: static. |
| Spanish-club voice | copy | LA PEÑA, Paso 1/2/3, "¿Jugamos?", "Game on?", "+ you?", "Count me in". Sprinkled where natural — never at the cost of clarity. |

## 5. Components

- **Buttons** (48px pills, mono 700 uppercase tracked):
  - *Primary*: lima fill, tinta text, 2px tinta border, riso shadow. The one loud thing.
  - *Secondary*: papel fill, tinta text, 2px tinta border, flat.
  - *Destructive*: papel fill, naranja-d text, 2px **dashed** naranja-d border. Never lima, never filled naranja.
  - Press: shadow collapses to 1px + 2px translate (`.pena-riso`), scale .98.
- **Chips**: papel fill, 1.5px tinta border, 13px Bricolage 600. Active = lima fill. Filter rows scroll with hidden scrollbars.
- **Inputs** (`.pl-surface`): papel fill, **2px tinta border**, 4px radius; focus turns the border naranja; placeholders `text-tinta/45`. No borderless inputs.
- **Cards**: `.pl-card` posters (see table). Depth = the poster shadow; no hairline-only cards on the wall.
- **Dialog**: a papel poster on the tinta scrim — 3px tinta border, staples, slight tilt, `.t-display` title.
- **Bottom nav**: papel bar, **3px tinta top border**; labels 9px mono caps; active = naranja, inactive = tinta; centre create FAB = **naranja** circle, 3px tinta border, riso shadow, raised.
- **Avatars**: DiceBear on papel/lima/naranja backgrounds (`F3E9D2`, `D8E24A`, `FF5A1F`); initials fallback tinta on lima; open slots = dashed naranja circle. Stacks separate with a 2px papel ring.
- **Skeletons** (`.pl-skeleton`): `papel/25` blocks on the wall, shimmer under motion; never spinners for content.
- **Empty states**: a stapled, tilted mini-poster with a `.t-display` headline that invites ("¿Jugamos?" energy), body 500, one action.

## 6. Motion

- `--ease: cubic-bezier(.23, 1, .32, 1)` for everything.
- Entrances are the **slap** (`.pl-rise`); exits are faster fades. The stamp spins slowly; the cinta scrolls.
- **Every animation is gated behind `prefers-reduced-motion`** — slap/spin/marquee all render static when reduced. Colour feedback never disappears.
- Tap targets ≥ 44px (`.pl-hit`); focus rings are 3px lima, offset.

## 7. Do's and Don'ts

### Do
- **Do** put every piece of content on papel, and every heading straight on the blue wall in papel.
- **Do** tilt and staple the posters (hero cards, empty states, dialogs) — and keep rows/forms straight.
- **Do** write labels in Space Mono 700 caps, tracked wide; write headlines in Bricolage 800 caps, condensed.
- **Do** use the riso offset shadow + 2px tinta border on primary controls — print register, not glow.
- **Do** colour one "o" per big headline.
- **Do** respect `prefers-reduced-motion` on slap, spin and marquee.

### Don't
- **Don't** use italics. Ever.
- **Don't** invent hexes — every colour is a token or a token at alpha. No greys, no white (#FFF exists nowhere; paper is papel).
- **Don't** use soft/blurred decorative shadows on controls — shadows are either the poster's deep drop or the hard riso offset.
- **Don't** reach for FLOODLIT (optic yellow / Anton) — that direction belongs to future sibling Loop products, never Padel Loop.
- **Don't** drift back to the wellness/Members' Club look (warm bone, sage, Instrument Serif) or the navy `#1e5cff` SaaS look — both are dead.
- **Don't** let the Spanish voice obscure meaning — flavour, not friction.
