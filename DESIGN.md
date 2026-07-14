---
name: Padel Loop
description: Find and join padel games near you, at your level.
colors:
  clubhouse-bone: "#FAF8F3"
  court-white: "#FFFFFF"
  pressed-bone: "#F1EEE6"
  evening-ink: "#1C1B17"
  quiet-ink: "#6E6A5E"
  faint-ink: "#A8A395"
  court-sage: "#5A6B4D"
  soft-sage: "#E8ECE2"
  soft-clay: "#EFE3D7"
  sage-mist: "#E4E7DC"
  bone-hairline: "#E7E3D8"
  clay-court-red: "#A65D4E"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "22px-40px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  field: "12px"
  card: "16px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.court-sage}"
    textColor: "{colors.court-white}"
    rounded: "{rounded.pill}"
    height: "48px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "{colors.pressed-bone}"
    textColor: "{colors.evening-ink}"
    rounded: "{rounded.pill}"
    height: "48px"
  chip:
    backgroundColor: "{colors.pressed-bone}"
    textColor: "{colors.quiet-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  chip-active:
    backgroundColor: "{colors.soft-sage}"
    textColor: "{colors.court-sage}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  card:
    backgroundColor: "{colors.court-white}"
    rounded: "{rounded.card}"
    padding: "16px"
  input:
    backgroundColor: "{colors.pressed-bone}"
    textColor: "{colors.evening-ink}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
---

# Design System: Padel Loop

## 1. Overview

**Creative North Star: "The Members' Club"**

Padel Loop looks and feels like a calm, well-kept club you're glad to belong to. Quiet quality, a warm welcome, nothing shouting. The ground everywhere is a warm bone — never pure white — with white cards resting on it like fresh linen on a clubhouse table. One deep sage accent speaks for the whole interface: it marks the door to a game (the join button, the active tab) and stays silent everywhere else. The serif wordmark and screen titles are the brand's voice; everything else steps back and lets them talk.

The system explicitly rejects the corporate / bland SaaS look — the generic blue-and-white dashboard this app was deliberately redesigned away from (the old navy `#1e5cff` "startup tech" skin is the named anti-reference). It also rejects noise in all forms: decorative drop shadows, badge clutter, promo banners, gamified streaks and confetti. Calm is the luxury.

Surfaces are quiet, but touch is not: this is a phone-first app and every pressable thing responds softly under the thumb — full-round pills, generous radii, a gentle press-scale. Soft and tactile, never stiff.

**Key Characteristics:**
- Warm bone ground (`#FAF8F3`), white cards, hairline borders — depth without shadows
- One deep sage accent (`#5A6B4D`) used scarcely, so it's unmissable
- Instrument Serif for the few words that matter; Instrument Sans for everything else
- Full-round pill buttons and chips; soft press feedback (`scale 0.98`) on everything tappable
- Mobile-first, one job per screen, primary action always in thumb reach

## 2. Colors

A warm, natural palette — bone, sage, clay — that reads more wellness club than sports tech.

### Primary
- **Court Sage** (`#5A6B4D`, token `--color-accent`): the single voice of action. Join/create buttons, active nav tab, active filter chips, key highlights. Also doubles as the success colour — in this club, success and action are the same green.
- **Soft Sage** (`#E8ECE2`, token `--color-accent-soft`): the sage whisper. Backgrounds of active chips and subtle highlights, always paired with Court Sage text.

### Neutral
- **Clubhouse Bone** (`#FAF8F3`, token `--color-bone`): the app background everywhere. Never pure white.
- **Court White** (`#FFFFFF`, token `--color-surface`): cards and sheets only — the layer that sits *on* the bone.
- **Pressed Bone** (`#F1EEE6`, token `--color-sunken`): sunken surfaces — inputs, inactive chips, secondary buttons.
- **Evening Ink** (`#1C1B17`, token `--color-ink`): primary text, a warm near-black.
- **Quiet Ink** (`#6E6A5E`, token `--color-ink-secondary`): secondary text, labels, timestamps.
- **Faint Ink** (`#A8A395`, token `--color-ink-faint`): placeholders and disabled states only.
- **Bone Hairline** (`#E7E3D8`, token `--color-line`): the 1px border that does the work shadows would do elsewhere.

### Tertiary
- **Clay Court Red** (`#A65D4E`, token `--color-danger`): destructive actions, muted terracotta — a warning in the palette's own voice, never an alarm-red.
- **Soft Clay** (`#EFE3D7`) and **Sage Mist** (`#E4E7DC`): decorative avatar tints only, cycled with Soft Sage and Pressed Bone.

### Named Rules
**The One Accent Rule.** Court Sage appears on at most ~10% of any screen — the primary action and active states, nothing else. Its rarity is what makes it unmissable.

**The Never-Pure-White Rule.** The page background is always Clubhouse Bone. Court White exists only on cards and sheets; a full-bleed white screen is a bug.

## 3. Typography

**Display Font:** Instrument Serif (with Georgia fallback) — regular weight only, sentence case
**Body Font:** Instrument Sans (with system-ui fallback) — weights 400 / 500 / 600

**Character:** A classic serif voice over a clean modern sans — the engraved club sign above a well-run front desk. The serif is warm and literary; the sans is quietly efficient.

### Hierarchy
- **Display** (400, 22–40px, line-height 1.1, tracking tight): Instrument Serif. Screen titles, hero numbers, the Home greeting, the lowercase "padel loop" wordmark. Nowhere else.
- **Title** (600, 15px): Instrument Sans semibold. Card titles (venue names), section labels.
- **Body** (400, 15px, relaxed leading): Instrument Sans. All reading text. Keep lines ≤ 70ch (rarely an issue on mobile widths).
- **Label** (500, 13px): Instrument Sans medium. Chips, metadata rows, buttons' smaller sibling. 11px only for the faintest annotations (e.g. "/ head") and nav labels (10px).

### Named Rules
**The Scarce Serif Rule.** Instrument Serif appears only where the brand speaks: screen titles, hero numbers, the greeting, the wordmark. Regular weight, sentence case, never bold, never uppercase. If the serif is everywhere, it's nowhere.

## 4. Elevation

This system is **flat by conviction**: depth comes from layering tones (Clubhouse Bone → Court White cards → Pressed Bone sunken fields) and 1px Bone Hairline borders, never from drop shadows. The single exception is the ambient sheet shadow.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 8px 32px rgba(28, 27, 23, 0.08)`, token `--shadow-sheet`): bottom sheets and modals only — the one surface that genuinely floats above the page.

### Named Rules
**The Hairline Rule.** If a surface needs separating, give it a 1px `#E7E3D8` border, not a shadow. One shadow exists in the whole app, and it belongs to sheets.

## 5. Components

Soft and tactile: quiet at rest, responsive under the thumb. Every tappable element gives a gentle press-scale (`active: scale 0.98`, 150ms ease-out).

### Buttons
- **Shape:** full-round pills (`border-radius: 9999px`), 48px tall, full width in forms
- **Primary:** Court Sage background, white text, medium 15px (`.bg-accent`)
- **Secondary:** Pressed Bone background, Evening Ink text — same shape, quieter voice
- **Destructive:** transparent with Clay Court Red text — dangerous actions never get a filled button
- **Press:** `active:scale-[0.98]` with a 150ms ease-out transform; no hover-dependent affordances (touch-first)

### Chips
- **Style:** pill-shaped, 13px medium, `6px 14px` padding
- **State:** inactive = Pressed Bone background + Quiet Ink text; active = Soft Sage background + Court Sage text. Filter rows scroll horizontally with hidden scrollbars (`.no-scrollbar`)

### Cards / Containers
- **Corner Style:** gently curved (16px, `--radius-card`)
- **Background:** Court White on the bone ground
- **Border:** 1px Bone Hairline (`.pl-card` = the canonical card primitive)
- **Shadow Strategy:** none (see Elevation)
- **Internal Padding:** 16px; cards stack with 12px gaps
- **Entrance:** `.pl-rise` — a 0.35s ease-out rise (opacity + 10px translate), staggered by ~animation-delay per card, disabled under reduced motion

### Inputs / Fields
- **Style:** Pressed Bone fill, 12px radius (`--radius-field`), no visible border at rest (`.pl-surface` carries a transparent 1px border so focus doesn't shift layout)
- **Focus:** border turns Court Sage (`focus:border-accent` / `focus-within:border-accent`)
- **Placeholder:** Faint Ink

### Navigation
- **Bottom nav, four tabs + centre Create (+) button.** Icons are 22px hand-drawn-feel 2px strokes; labels 10px medium. Active tab = Court Sage; inactive = Faint Ink; 150ms colour transition. The Profile tab renders the user's own avatar.

### Avatars (signature)
- DiceBear-generated (or uploaded photo) faces in circles, tinted with the decorative bone/sage/clay range. Initials fallback in Evening Ink on cycled tints; open slots render a dashed Faint Ink "+" circle. Overlapping stacks (-10px margin) with a 2px bone ring separate the faces.

## 6. Do's and Don'ts

### Do:
- **Do** keep Clubhouse Bone (`#FAF8F3`) as the page background of every screen — white belongs to cards only.
- **Do** reserve Court Sage (`#5A6B4D`) for the primary action and active states; if two things on a screen are sage, one of them is wrong.
- **Do** use Instrument Serif only for screen titles, hero numbers, the greeting, and the wordmark — regular weight, sentence case.
- **Do** give every tappable element the soft press response (`active:scale-[0.98]`, 150ms ease-out) — tactile is the personality.
- **Do** separate surfaces with 1px `#E7E3D8` hairlines, and check text contrast: Quiet Ink (`#6E6A5E`) is for secondary text only, never body copy on tinted surfaces.
- **Do** respect `prefers-reduced-motion` on every animation, as `.pl-rise` already does.

### Don't:
- **Don't** drift back toward "corporate / bland SaaS" — the navy `#1e5cff` blue-and-white startup look was explicitly rejected and replaced by this system.
- **Don't** add drop shadows as decoration. One shadow exists (`--shadow-sheet`, sheets/modals); everything else is flat with hairlines.
- **Don't** add badge clutter, promo banners, streaks, or confetti — "anything that makes a calm club feel like a busy marketplace" (PRODUCT.md).
- **Don't** use pure alarm-red for danger; destructive is always the muted Clay Court Red (`#A65D4E`), text-only buttons.
- **Don't** bold or uppercase the serif, and don't let it leak into body text, buttons, or labels.
- **Don't** invent new colours or radii inline — every value flows from the tokens in `src/app/globals.css` (`@theme`).
