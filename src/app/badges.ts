// BADGES — the peña's honours board. Three families, all earned by things a
// player has already done:
//   • Connections  — 10 / 25 / 50 / 100 padel friends
//   • Games played — 5 / 10 / 25 / 50 / 100 CONFIRMED matches
//   • Win streaks  — 3 / 5 / 10 confirmed wins in a row (best run ever; once
//                    you've done it, it's yours)
//
// Badges are DERIVED, not stored: every tier is a pure function of data the
// app already holds (the connections table, confirmed match_results). That
// means no new table to drift out of sync, no award job to run — and
// "retroactive" is automatic, because an existing player's history is
// already the input. It also matches how the rest of the app treats earned
// numbers (see getPlayerMatchStats).
//
// Only CONFIRMED results count anywhere here, the same rule the profile
// stats, ratings and leaderboard all use.

import { getPlayerResultHistory, type PlayerResultOutcome } from "./match-results";

export type BadgeFamily = "connections" | "games" | "streak";

// One rung of a family: earned once `value` reaches `threshold`.
export type Badge = {
  id: string; // e.g. "games-25"
  family: BadgeFamily;
  threshold: number;
  title: string; // the badge face, e.g. "25 games"
  blurb: string; // what it took, in plain English
};

// A family with the player's standing in it.
export type BadgeProgress = {
  family: BadgeFamily;
  label: string; // "Connections"
  value: number; // where the player is now
  earned: Badge[]; // every tier cleared, lowest first
  next: Badge | null; // the next rung, or null once the family is maxed
};

const THRESHOLDS: Record<BadgeFamily, number[]> = {
  connections: [10, 25, 50, 100],
  games: [5, 10, 25, 50, 100],
  streak: [3, 5, 10],
};

const FAMILY_LABEL: Record<BadgeFamily, string> = {
  connections: "Connections",
  games: "Games played",
  streak: "Win streak",
};

function badgeTitle(family: BadgeFamily, n: number): string {
  if (family === "connections") return `${n} connections`;
  if (family === "games") return `${n} games`;
  return `${n} in a row`;
}

function badgeBlurb(family: BadgeFamily, n: number): string {
  if (family === "connections") return `Connected with ${n} players.`;
  if (family === "games") return `Played ${n} confirmed matches.`;
  return `Won ${n} confirmed matches back to back.`;
}

function tiersFor(family: BadgeFamily): Badge[] {
  return THRESHOLDS[family].map((threshold) => ({
    id: `${family}-${threshold}`,
    family,
    threshold,
    title: badgeTitle(family, threshold),
    blurb: badgeBlurb(family, threshold),
  }));
}

// The longest run of consecutive wins in a player's confirmed history.
// getPlayerResultHistory returns results oldest-first, so this is a single
// walk. A player's best run is kept for good — a later loss doesn't take an
// earned streak badge away.
export function longestWinStreak(history: PlayerResultOutcome[]): number {
  let best = 0;
  let run = 0;
  for (const r of history) {
    run = r.won ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

// Turn the three raw numbers into per-family standings. Pure — the profile
// page already knows its connection count and games played, so it passes
// them straight in rather than re-querying.
export function computeBadges(input: {
  connections: number;
  gamesPlayed: number;
  bestStreak: number;
}): BadgeProgress[] {
  const valueOf: Record<BadgeFamily, number> = {
    connections: input.connections,
    games: input.gamesPlayed,
    streak: input.bestStreak,
  };

  return (["games", "streak", "connections"] as BadgeFamily[]).map((family) => {
    const value = valueOf[family];
    const tiers = tiersFor(family);
    return {
      family,
      label: FAMILY_LABEL[family],
      value,
      earned: tiers.filter((t) => value >= t.threshold),
      next: tiers.find((t) => value < t.threshold) ?? null,
    };
  });
}

// The one query badges need that the profile page doesn't already run: the
// player's confirmed result history, reduced to their best winning run.
export async function getBestWinStreak(userId: string): Promise<number> {
  return longestWinStreak(await getPlayerResultHistory(userId));
}
