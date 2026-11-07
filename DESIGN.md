# Design

Padel Loop looks and behaves like a native iPhone app, because that's what its users already know. Useful comes first: nothing on screen is decoration, and every screen helps someone find, join or run a game.

**Source of truth:** the images in `mockups/`. Every value in the code comes from them. Screens without a mockup follow the same components and rules.

**Tokens and components:** `src/app/ios.css`, with React components in `src/components/ios/`. Add to these rather than styling a screen by hand.

## Foundations

- **Type:** the device's own system font (San Francisco on iPhone), at Apple's Dynamic Type "Large" sizes and tracking: `.ios-lt` (large title), `.ios-t1` to `.ios-t3`, `.ios-hl`, `.ios-bd`, `.ios-sh`, `.ios-fn`. Titles and buttons use Title Case. Never ship SF Pro or SF Symbols; icons are our own SVGs in `ios/Icon.tsx`.
- **Colour:** one accent, padel-court blue (`--ios-accent`). Use only the `--ios-*` tokens. Light, dark and increased-contrast values are all defined in `ios.css`, and dark mode follows the phone's setting. There's no in-app appearance switch.
- **Shape:** inset grouped lists and cards with 26px corners (`.ios-list`, `.ios-card`), and full pills for controls.
- **Glass:** only on the floating layer: tab bar, top controls and the join bar. Never on content.
- **Motion:** short and purposeful. Sheets rise while the screen behind recedes, and Home's court flies into the game header. Reduce Motion keeps fades and drops scaling, sliding and blur.

## The signature

The court, seen from above (`ios/Court.tsx`), is how a game is shown everywhere: a solid disc is a taken spot, a hollow ring is an open one, and a grey "+1" is a guest who isn't on the app. Nothing else on screen competes with it.

## Components

- **Screens:** `ios/PageTitle` for a back button and large title; `BottomNav` for the tab bar.
- **Rows:** `ios/GameRow` for a game; `ios/PlayerRow` for a player.
- **People:** `ios/Monogram`, showing their photo, otherwise their initials on grey.
- **Decisions:** `ios/Alert` before anything that can't be undone; `ios/Sheet` for short tasks.
- **Empty and failed states:** `ios/MessageCard`, with `ios/RouteError` for whole pages.

## Rules

1. **Real data only.** If the database doesn't hold a detail, hide it. Never invent it.
2. **A failed read is not an empty result.** Say it couldn't load and offer Try Again. "No games yet" must only ever mean there are no games.
3. **Failures are visible.** If an action fails, say so where the person is looking.
4. **Colour never carries meaning alone.** Pair it with a word or shape, such as "Winner" or "Differs".
5. **Tap targets are at least 44 points.** Text meets WCAG AA contrast.
6. **Writing is plain and short.** Explain things the way a friend would, in plain English. Say what happened and what to do next.

## Technical notes

- `backdrop-filter` traps `position: fixed` children, so menus, alerts and sheets are portalled to `body`.
- The layout wrapper `.ios-behind` already applies the top safe area. Only fixed screens such as chat add it themselves.
- Screens are checked with phone-size screenshots in light and dark mode, at narrow widths, and in their empty and failed states.
