// This file reads and writes MATCH RESULTS — the score a player logs after a
// game — using your Supabase tables:
//   • match_results              — one row per game (game_id is UNIQUE, so a
//                                  game can only ever have one result). Holds
//                                  who submitted it and the status.
//   • match_result_participants  — one row per player: which team they were on
//                                  and whether they've confirmed the result.
//   • match_result_sets          — one row per set: the games each team won.
//
// For now this only CAPTURES a submission: the result is stored as "pending",
// the submitter's own confirmation is "confirmed" and everyone else's is
// "pending". Working out the winner and flipping the result to confirmed is a
// later step — nothing here decides a winner.

import { supabase } from "@/lib/supabaseClient";

// One player's team assignment in a submitted result (team is 1 or 2).
export type ResultParticipant = { userId: string; team: number };

// One set's score: how many games each team won (0–7).
export type ResultSet = {
  setNumber: number;
  team1Games: number;
  team2Games: number;
};

// The existing result for a game, if any. game_id is unique on match_results,
// so there's at most one. Returns null if none has been logged yet.
export async function getExistingResult(
  gameId: string,
): Promise<{ id: string; submitted_by: string; status: string } | null> {
  const { data, error } = await supabase
    .from("match_results")
    .select("id, submitted_by, status")
    .eq("game_id", gameId)
    .maybeSingle();

  if (error) {
    console.error("Could not load match result:", error.message);
    return null;
  }
  return data ?? null;
}

// Best-effort cleanup if a later insert fails partway through, so we don't leave
// a half-written result behind. (Works whether or not the FKs cascade.)
async function deleteResult(resultId: string | number) {
  await supabase.from("match_result_sets").delete().eq("result_id", resultId);
  await supabase
    .from("match_result_participants")
    .delete()
    .eq("result_id", resultId);
  await supabase.from("match_results").delete().eq("id", resultId);
}

// Submit a new match result for a game. Inserts:
//   1. one match_results row (submitted_by = current user, status 'pending'),
//   2. one match_result_participants row per player — the submitter's own row
//      is 'confirmed', everyone else's is 'pending',
//   3. one match_result_sets row per set.
// Only one result per game: if one already exists, the UNIQUE constraint on
// game_id trips and we report that gracefully (duplicate: true). No winner is
// computed and the status stays 'pending'.
export async function submitMatchResult(params: {
  gameId: string;
  submittedBy: string;
  participants: ResultParticipant[];
  sets: ResultSet[];
}): Promise<{ ok: true } | { error: string; duplicate?: boolean }> {
  const { gameId, submittedBy, participants, sets } = params;

  // 1. The result row. status is 'pending'; winning_team is left unset — the
  //    winner is worked out in a later step, not here.
  const { data: result, error: resultError } = await supabase
    .from("match_results")
    .insert({ game_id: gameId, submitted_by: submittedBy, status: "pending" })
    .select("id")
    .single();

  if (resultError || !result) {
    // 23505 = unique_violation → a result already exists for this game.
    const duplicate = resultError?.code === "23505";
    if (!duplicate) {
      console.error("Could not create match result:", resultError?.message);
    }
    return {
      error: duplicate
        ? "A result has already been logged for this game."
        : resultError?.message ?? "Could not log the result.",
      duplicate,
    };
  }

  const resultId = result.id as string | number;

  // 2. Participants — the submitter is auto-confirmed, everyone else pending.
  const participantRows = participants.map((p) => ({
    result_id: resultId,
    user_id: p.userId,
    team: p.team,
    confirmation: p.userId === submittedBy ? "confirmed" : "pending",
  }));

  const { error: partError } = await supabase
    .from("match_result_participants")
    .insert(participantRows);

  if (partError) {
    console.error("Could not save participants:", partError.message);
    await deleteResult(resultId);
    return { error: "Could not save the teams. Please try again." };
  }

  // 3. Set scores.
  const setRows = sets.map((s) => ({
    result_id: resultId,
    set_number: s.setNumber,
    team1_games: s.team1Games,
    team2_games: s.team2Games,
  }));

  const { error: setsError } = await supabase
    .from("match_result_sets")
    .insert(setRows);

  if (setsError) {
    console.error("Could not save set scores:", setsError.message);
    await deleteResult(resultId);
    return { error: "Could not save the set scores. Please try again." };
  }

  return { ok: true };
}

// The summary the confirm RPC returns: the result's status after this
// confirmation, how many players still haven't confirmed, and the winning team
// once it's finalised (null while still pending).
export type ConfirmResult = {
  status: string;
  confirmationsRemaining: number;
  winningTeam: number | null;
};

// Record the current user's confirmation of a logged result. All the real work
// happens server-side in the confirm_match_result RPC: it flips this caller's
// confirmation and, once everyone has confirmed, works out the winner from the
// set scores and finalises the result. We just call it and parse the jsonb it
// returns. On failure we surface the Postgres message as a thrown Error so the
// caller can show it inline.
export async function confirmResult(gameId: string): Promise<ConfirmResult> {
  const { data, error } = await supabase.rpc("confirm_match_result", {
    p_game_id: Number(gameId),
  });

  if (error) {
    console.error("Could not confirm result:", error.message);
    throw new Error(error.message || "Could not confirm the result.");
  }

  const row = (data ?? {}) as {
    status?: string;
    confirmations_remaining?: number;
    winning_team?: number | null;
  };

  return {
    status: row.status ?? "pending",
    confirmationsRemaining: row.confirmations_remaining ?? 0,
    winningTeam: row.winning_team ?? null,
  };
}

// One participant in a logged result, paired with their profile name + avatar
// (the same fields the game roster and chat use). team is 1 or 2; confirmation
// is 'confirmed' or 'pending'.
export type ResultDetailParticipant = {
  userId: string;
  team: number;
  confirmation: string;
  name: string;
  avatarUrl: string | null;
};

// One set's score in a logged result.
export type ResultDetailSet = {
  setNumber: number;
  team1Games: number;
  team2Games: number;
};

// The full logged result for a game: the result row, every participant (with
// their team + confirmation + profile), and every set in order.
export type ResultDetail = {
  id: string;
  status: string;
  winningTeam: number | null;
  submittedBy: string;
  confirmedAt: string | null;
  participants: ResultDetailParticipant[];
  sets: ResultDetailSet[];
};

// Read the complete logged result for a game so any player can see the score,
// the teams and who has confirmed. Returns null if no result has been logged
// (game_id is unique on match_results, so there's at most one).
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
    .select("id, status, winning_team, submitted_by, confirmed_at")
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
    .select("user_id, team, confirmation")
    .eq("result_id", resultId);
  if (partError) {
    console.error("Could not load result participants:", partError.message);
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
    const p = byId.get(r.user_id as string);
    return {
      userId: r.user_id as string,
      team: r.team as number,
      confirmation: r.confirmation as string,
      name: p?.name ?? "Player",
      avatarUrl: p?.avatar_url ?? null,
    };
  });

  // 3. Sets, in playing order.
  const { data: setRows, error: setsError } = await supabase
    .from("match_result_sets")
    .select("set_number, team1_games, team2_games")
    .eq("result_id", resultId)
    .order("set_number");
  if (setsError) {
    console.error("Could not load result sets:", setsError.message);
  }

  const sets: ResultDetailSet[] = (setRows ?? []).map((s) => ({
    setNumber: s.set_number as number,
    team1Games: s.team1_games as number,
    team2Games: s.team2_games as number,
  }));

  return {
    id: String(result.id),
    status: result.status as string,
    winningTeam: (result.winning_team as number | null) ?? null,
    submittedBy: result.submitted_by as string,
    confirmedAt: (result.confirmed_at as string | null) ?? null,
    participants,
    sets,
  };
}

// A player's match record, counted from FINALISED results only.
export type PlayerMatchStats = { played: number; won: number; lost: number };

// Work out a player's win/loss record across confirmed match results.
//   • played = confirmed results this user took part in,
//   • won    = those where their team was the winning team,
//   • lost   = played − won.
// Only status='confirmed' results count — pending/unconfirmed ones never show
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
