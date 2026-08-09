// This file builds the LEADERBOARD — every player ranked by their earned
// rating (or by wins), with their confirmed-match record. Reads use the
// shared Supabase client and the repo's usual manual-join style: a few
// bounded queries, aggregated here in the browser — no per-player loops.
//
// Only CONFIRMED results count (same rule as profile stats and ratings);
// pending and disputed results don't exist as far as this board is concerned.

import { supabase } from "@/lib/supabaseClient";

// How many confirmed matches a player needs before they get a rank. Players
// below the bar still appear, in the "needs more matches" list.
export const RANKED_MIN_MATCHES = 3;

// One player's line on the board.
export type LeaderboardRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  home_club: string | null;
  rating: number | null; // null until the ratings migration has run
  played: number; // confirmed matches only
  won: number;
};

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  // 1. Every profile — the board lists the whole peña, ranked or not.
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, avatar_url, home_club, rating")
    .limit(500);
  if (profileError) {
    console.error("Could not load profiles:", profileError.message);
    return [];
  }
  if (!profiles || profiles.length === 0) return [];

  // 2. Every confirmed result's winner, and 3. who played on which team.
  const [{ data: results, error: resultError }, { data: parts, error: partError }] =
    await Promise.all([
      supabase
        .from("match_results")
        .select("id, winning_team")
        .eq("status", "confirmed"),
      supabase
        .from("match_result_participants")
        .select("result_id, user_id, team"),
    ]);
  if (resultError) {
    console.error("Could not load confirmed results:", resultError.message);
  }
  if (partError) {
    console.error("Could not load participants:", partError.message);
  }

  const winnerByResult = new Map<string, number | null>();
  for (const r of results ?? []) {
    winnerByResult.set(String(r.id), r.winning_team as number | null);
  }

  const played = new Map<string, number>();
  const won = new Map<string, number>();
  for (const p of parts ?? []) {
    const key = String(p.result_id);
    if (!winnerByResult.has(key)) continue; // not confirmed — doesn't count
    const uid = p.user_id as string;
    played.set(uid, (played.get(uid) ?? 0) + 1);
    if (winnerByResult.get(key) === (p.team as number)) {
      won.set(uid, (won.get(uid) ?? 0) + 1);
    }
  }

  return profiles.map((pr) => ({
    id: pr.id as string,
    name: (pr.name as string | null) ?? null,
    avatar_url: (pr.avatar_url as string | null) ?? null,
    home_club: (pr.home_club as string | null) ?? null,
    rating: (pr.rating as number | null) ?? null,
    played: played.get(pr.id as string) ?? 0,
    won: won.get(pr.id as string) ?? 0,
  }));
}
