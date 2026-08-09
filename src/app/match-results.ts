// This file reads and writes MATCH RESULTS — consensus-verified scores — using
// the Supabase tables:
//   • match_results              — one row per game (game_id is UNIQUE). Holds
//                                  the status: 'pending' (waiting for
//                                  scoresheets), 'disputed' (they disagree) or
//                                  'confirmed' (everyone agreed — final).
//   • match_result_participants  — one row per player: which team they were on.
//   • match_result_entries       — each player's OWN scoresheet, one row per
//                                  set. Private to the match's participants.
//   • match_result_sets          — the agreed, canonical sets. Only written by
//                                  the server once every scoresheet matches.
//
// The flow: the game owner STARTS the match (fixing the 2v2 teams), then every
// participant independently submits set scores. Both writes go through
// security-definer RPCs — the server validates, compares the scoresheets when
// the last one lands, and either finalises the result or marks it disputed.
// Nothing client-side ever decides a winner.

import { supabase } from "@/lib/supabaseClient";

// One set's score: how many games each team won (0–7).
export type ResultSet = {
  setNumber: number;
  team1Games: number;
  team2Games: number;
};

// Start the match for a game: the owner fixes the teams (two user ids per
// side) and the server creates the 'pending' result plus one participant row
// per player. Owner-only and full-game-only — the RPC enforces both. If a
// result already exists the UNIQUE on game_id trips (23505) and we report it
// gracefully so the UI can just load the existing one.
export async function startMatch(params: {
  gameId: string;
  team1Ids: string[];
  team2Ids: string[];
}): Promise<{ ok: true } | { error: string; duplicate?: boolean }> {
  const { error } = await supabase.rpc("start_match_result", {
    p_game_id: Number(params.gameId),
    p_team1: params.team1Ids,
    p_team2: params.team2Ids,
  });

  if (error) {
    const duplicate = error.code === "23505";
    if (!duplicate) {
      console.error("Could not start the match:", error.message);
    }
    return {
      error: duplicate
        ? "A match has already been started for this game."
        : error.message || "Could not start the match.",
      duplicate,
    };
  }
  return { ok: true };
}

// What submit_result_entry reports back: the result's status after this
// scoresheet landed, and how many of the participants have submitted.
export type EntryOutcome = {
  status: string;
  submitted: number;
  total: number;
  winningTeam: number | null;
};

// Submit (or resubmit) the current user's scoresheet. The RPC validates the
// sets, stores them, and — once the last participant is in — compares all the
// scoresheets: identical finalises the result, any difference marks it
// disputed. Failures surface as a thrown Error so the form can show them.
export async function submitEntry(
  gameId: string,
  sets: ResultSet[],
): Promise<EntryOutcome> {
  const { data, error } = await supabase.rpc("submit_result_entry", {
    p_game_id: Number(gameId),
    p_sets: sets.map((s) => ({
      team1_games: s.team1Games,
      team2_games: s.team2Games,
    })),
  });

  if (error) {
    console.error("Could not submit the scoresheet:", error.message);
    throw new Error(error.message || "Could not submit your scores.");
  }

  const row = (data ?? {}) as {
    status?: string;
    submitted?: number;
    total?: number;
    winning_team?: number | null;
  };

  return {
    status: row.status ?? "pending",
    submitted: row.submitted ?? 0,
    total: row.total ?? 0,
    winningTeam: row.winning_team ?? null,
  };
}

// One participant in a result, paired with their profile name + avatar (the
// same fields the game roster and chat use). team is 1 or 2; hasSubmitted says
// whether their scoresheet is in (derived from match_result_entries).
export type ResultDetailParticipant = {
  userId: string;
  team: number;
  hasSubmitted: boolean;
  name: string;
  avatarUrl: string | null;
};

// One player's submitted scoresheet, in set order.
export type ResultEntry = {
  userId: string;
  sets: ResultSet[];
};

// The full result for a game: the row, every participant (team + submission
// state + profile), the canonical sets once confirmed, and — for participants
// only (RLS hides them from everyone else) — each player's own scoresheet.
export type ResultDetail = {
  id: string;
  status: string;
  winningTeam: number | null;
  confirmedAt: string | null;
  participants: ResultDetailParticipant[];
  sets: ResultSet[];
  entries: ResultEntry[];
};

// Read the complete result for a game. Returns null if the match hasn't been
// started (game_id is unique on match_results, so there's at most one).
//
// Profiles are joined the same way as the game roster: read the participant
// rows, then look their ids up in `profiles` in one more query and pair the
// name + avatar_url back (see getPlayersForGame in src/lib/data.ts).
export async function getResultDetail(
  gameId: string,
): Promise<ResultDetail | null> {
  // 1. The result row (at most one for this game).
  const { data: result, error } = await supabase
    .from("match_results")
    .select("id, status, winning_team, confirmed_at")
    .eq("game_id", gameId)
    .maybeSingle();

  if (error) {
    console.error("Could not load match result:", error.message);
    return null;
  }
  if (!result) return null;

  const resultId = result.id as string | number;

  // 2. Participants for this result.
  const { data: partRows, error: partError } = await supabase
    .from("match_result_participants")
    .select("user_id, team")
    .eq("result_id", resultId);
  if (partError) {
    console.error("Could not load result participants:", partError.message);
  }

  // 3. Every scoresheet row. RLS returns these only to the match's own
  //    participants — for anyone else this is just an empty list.
  const { data: entryRows, error: entryError } = await supabase
    .from("match_result_entries")
    .select("user_id, set_number, team1_games, team2_games")
    .eq("result_id", resultId)
    .order("set_number");
  if (entryError) {
    console.error("Could not load scoresheets:", entryError.message);
  }

  const setsByUser = new Map<string, ResultSet[]>();
  for (const r of entryRows ?? []) {
    const uid = r.user_id as string;
    const list = setsByUser.get(uid) ?? [];
    list.push({
      setNumber: r.set_number as number,
      team1Games: r.team1_games as number,
      team2Games: r.team2_games as number,
    });
    setsByUser.set(uid, list);
  }

  // Look the participants' names + avatars up in `profiles` (same manual join
  // as the roster), then pair them back to each participant.
  const ids = (partRows ?? []).map((r) => r.user_id as string);
  const { data: profiles } = ids.length
    ? await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", ids)
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, any>();
  for (const p of profiles ?? []) byId.set(p.id as string, p);

  const participants: ResultDetailParticipant[] = (partRows ?? []).map((r) => {
    const uid = r.user_id as string;
    const p = byId.get(uid);
    return {
      userId: uid,
      team: r.team as number,
      hasSubmitted: setsByUser.has(uid),
      name: p?.name ?? "Player",
      avatarUrl: p?.avatar_url ?? null,
    };
  });

  const entries: ResultEntry[] = participants
    .filter((p) => p.hasSubmitted)
    .map((p) => ({ userId: p.userId, sets: setsByUser.get(p.userId)! }));

  // 4. The canonical sets, in playing order (empty until confirmed).
  const { data: setRows, error: setsError } = await supabase
    .from("match_result_sets")
    .select("set_number, team1_games, team2_games")
    .eq("result_id", resultId)
    .order("set_number");
  if (setsError) {
    console.error("Could not load result sets:", setsError.message);
  }

  const sets: ResultSet[] = (setRows ?? []).map((s) => ({
    setNumber: s.set_number as number,
    team1Games: s.team1_games as number,
    team2Games: s.team2_games as number,
  }));

  return {
    id: String(result.id),
    status: result.status as string,
    winningTeam: (result.winning_team as number | null) ?? null,
    confirmedAt: (result.confirmed_at as string | null) ?? null,
    participants,
    sets,
    entries,
  };
}

// A player's match record, counted from FINALISED results only.
export type PlayerMatchStats = { played: number; won: number; lost: number };

// Work out a player's win/loss record across confirmed match results.
//   • played = confirmed results this user took part in,
//   • won    = those where their team was the winning team,
//   • lost   = played − won.
// Only status='confirmed' results count — pending/disputed ones never show
// up in the stat. Done as a manual two-step join (the same style the rest of
// the app uses instead of relying on a DB relationship), so it's two small
// queries, never N+1.
export async function getPlayerMatchStats(
  userId: string,
): Promise<PlayerMatchStats> {
  const empty: PlayerMatchStats = { played: 0, won: 0, lost: 0 };

  // 1. Every result this user was a participant in, and the team they were on.
  const { data: partRows, error: partError } = await supabase
    .from("match_result_participants")
    .select("result_id, team")
    .eq("user_id", userId);
  if (partError) {
    console.error("Could not load match participation:", partError.message);
    return empty;
  }
  if (!partRows || partRows.length === 0) return empty;

  // result_id → the team this user played on for that result.
  const teamByResult = new Map<string, number>();
  for (const r of partRows) {
    teamByResult.set(String(r.result_id), r.team as number);
  }

  // 2. Of those, keep only the CONFIRMED ones (status='confirmed' guarantees
  //    winning_team is set by the RPC) and read their winner — one query.
  const resultIds = Array.from(teamByResult.keys());
  const { data: results, error: resultError } = await supabase
    .from("match_results")
    .select("id, winning_team")
    .in("id", resultIds)
    .eq("status", "confirmed");
  if (resultError) {
    console.error("Could not load confirmed results:", resultError.message);
    return empty;
  }

  let played = 0;
  let won = 0;
  for (const res of results ?? []) {
    played += 1;
    const myTeam = teamByResult.get(String(res.id));
    const winner = res.winning_team as number | null;
    if (myTeam != null && winner != null && myTeam === winner) {
      won += 1;
    }
  }

  return { played, won, lost: played - won };
}

// One confirmed result in a player's history: when it was finalised and
// whether they won. Ordered oldest-first so streaks can be walked in playing
// order. Same two-query manual join as getPlayerMatchStats above.
export type PlayerResultOutcome = { confirmedAt: string | null; won: boolean };

export async function getPlayerResultHistory(
  userId: string,
): Promise<PlayerResultOutcome[]> {
  const { data: partRows, error: partError } = await supabase
    .from("match_result_participants")
    .select("result_id, team")
    .eq("user_id", userId);
  if (partError) {
    console.error("Could not load match participation:", partError.message);
    return [];
  }
  if (!partRows || partRows.length === 0) return [];

  const teamByResult = new Map<string, number>();
  for (const r of partRows) {
    teamByResult.set(String(r.result_id), r.team as number);
  }

  const { data: results, error: resultError } = await supabase
    .from("match_results")
    .select("id, winning_team, confirmed_at")
    .in("id", Array.from(teamByResult.keys()))
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: true });
  if (resultError) {
    console.error("Could not load confirmed results:", resultError.message);
    return [];
  }

  return (results ?? []).map((res) => ({
    confirmedAt: (res.confirmed_at as string | null) ?? null,
    won: teamByResult.get(String(res.id)) === (res.winning_team as number | null),
  }));
}
