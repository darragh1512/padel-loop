---
target: Home dashboard (/) + Discover (/discover)
total_score: 23
p0_count: 1
p1_count: 2
timestamp: 2026-07-05T12-20-37Z
slug: home-and-discover
---
Method: dual-agent (A: design-director review sub-agent · B: detector + browser-evidence sub-agent)

# Critique: Home dashboard (/) + Discover (/discover)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Discover list mutated after paint (own-game exclusion race — FIXED post-critique); no result count rendered on Discover |
| 2 | Match System / Real World | 2 | Numeric level scale (2.5–3.5) never explained; "near you" without location (distanceKm always null) |
| 3 | User Control and Freedom | 3 | Escape didn't close filter menus (FIXED post-critique) |
| 4 | Consistency and Standards | 1→3 | One game, two clocks: home hero UTC/12h vs detail local/24h (P0 — FIXED post-critique: single local 24h policy) |
| 5 | Error Prevention | 2 | Wrong-arrival-time outcome (fixed with #4); vanishing tappable card (fixed) |
| 6 | Recognition Rather Than Recall | 3 | Tier-word ↔ numeric-level mapping carried in the user's head |
| 7 | Flexibility and Efficiency | 2 | Discover never defaults to the user's own level; filters not remembered |
| 8 | Aesthetic and Minimalist Design | 4 | Genuinely excellent — calm register is real and consistent |
| 9 | Error Recovery | 3 | Filtered-empty recovery is model; unfiltered empty had no create action (FIXED post-critique) |
| 10 | Help and Documentation | 1 | No level explainer, no "Connections only" hint, icon-only + in nav |
| **Total** | | **23/40 at review time** | **Acceptable band; visual system strong, behavior dragged it down. P0 + 2 P1s fixed same session.** |

## Anti-Patterns Verdict

**LLM assessment:** Not slop — "a designed system with behavioral cracks." Passes the Playtomic/Linear-fluent squint test: one accent obeyed, serif scarce, hairlines not shadows, skeletons mirror layout, empty states teach. Trust broke on behavior (time mismatch, vanishing card), not appearance.

**Deterministic scan:** 0 findings, exit 0 across all 10 target files.

**Runtime overlay (injected detector):** one warning on both pages — `cream-palette` on body (#FAF8F3). False positive in context: Clubhouse Bone is the DESIGN.md-mandated brand ground (identity preservation wins; the cream ban targets new-project defaults).

## Priority Issues (state after same-session fixes)

- **[P0] One game, two clocks — FIXED.** formatGameTime was UTC/12h while formatTimeRange/formatDay were local/24h; hero said "6:30 pm" for a 19:30 game. Now one policy: local, 24h, en-IE, both modules.
- **[P1] Discover flash-of-joinable-content — FIXED.** Own-game exclusion resolved client-side after paint, so cards appeared then vanished. The list now holds skeletons until the exclusion set resolves.
- **[P1] Tap targets under the 44px baseline — FIXED.** New `.pl-hit` primitive (invisible ≥44×44 hit extension) applied to filter chips, notification bell, search-clear, back chevrons, chat send, add/remove-set controls.
- **[P2] Level vocabulary split — OPEN.** Filters speak tiers, cards speak numbers. Suggested: "Intermediate · 2.5–3.5" on cards or default the Level chip to the user's tier. (/impeccable clarify)
- **[P2] Filter popover a11y — PARTIALLY FIXED.** Escape now closes menus; bell aria-label now carries unread count. Still open: real listbox roles/arrow keys, focus return, chip accessible name keeping its category, aria-live result count. (/impeccable harden)

## Persona Red Flags (at review time)

- **Casey (one-handed mobile):** vanishing card under her thumb (fixed); sub-30px bell/chips (fixed via .pl-hit); Clear-chip layout shift (open, minor).
- **Jordan (first-timer):** empty Discover was a dead end at peak intent — no create action (fixed); "Level 2.5–3.5" gibberish (open P2); "Join game" pill navigates rather than joins (open question).
- **Sam (screen reader):** bell count invisible to SR (fixed); popovers promise listbox semantics they don't have (open); empty h1 until hydration on Home; SectionLabel is a div, so heading nav goes h1 → void (open P2/P3).

## Minor Observations (open backlog)

- headlineText/allToday result-count logic in GameFilters is built but never rendered on Discover.
- Filter popovers use the sheet shadow; the Hairline Rule technically reserves it for sheets/modals.
- DESIGN.md describes horizontally scrolling filter rows; implementation wraps.
- matchesTime "This week" has no lower bound (past games pass).
- Home hero: "Malahide Padel Club" + "Malahide" redundant; that line could carry roster status ("3 of 4 confirmed").
- Home dashboard fully client-fetched → skeleton on every visit; Discover proves the server pattern.
- AvatarStack initials-tints vs real avatars elsewhere — deliberate, but preview faces ≠ detail faces.

## Questions to Consider

1. Why does the pill say "Join game" if tapping it can't join? Make it true (tap-to-join + confirm) or honest ("3 spots · View").
2. The app knows the user's level and area — why does Discover open unfiltered? "Near you, at your level" is the whole product sentence.
3. What is Home's job the day OF a game? A countdown/roster/directions hero would beat an identical card 18 days out and 18 minutes out.
