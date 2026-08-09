"use client";
// Match result — the consensus-scoresheet UI on the game detail page.
//
// The flow (all server-enforced by the two RPCs in match-results.ts):
//   • No result yet → the game OWNER (once the game is full) taps "Start
//     match", assigns the 2v2 teams, and creates the 'pending' result.
//   • Pending → EVERY participant independently enters set scores. The board
//     shows who's in (live, via Realtime — same pattern as chat). When the
//     last scoresheet lands the server compares them all.
//   • Identical → 'confirmed': the winner view (shown to any viewer).
//   • Different → 'disputed': everyone sees what each player entered and can
//     edit + resubmit; matching again finalises it.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button, SectionLabel } from "@/components/ui";
import PlayerAvatar from "@/components/PlayerAvatar";
import type { Player } from "@/lib/types";
import {
  getResultDetail,
  startMatch,
  submitEntry,
  type ResultSet,
  type ResultDetail,
} from "../../match-results";

type Team = 1 | 2;
type SetInput = { t1: string; t2: string };

// "6–3, 4–6, 7–5" — a whole scoresheet as one short line.
function formatSheet(sets: ResultSet[]): string {
  return sets.map((s) => `${s.team1Games}–${s.team2Games}`).join(", ");
}

// Two scoresheets are the same iff they have the same sets in the same order —
// exactly the comparison the server runs.
function sameSheet(a: ResultSet[], b: ResultSet[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (s, i) => s.team1Games === b[i].team1Games && s.team2Games === b[i].team2Games,
  );
}

// Check the typed set scores against the same rules the RPC enforces: 1–3
// sets, whole scores 0–7, no tied set, and a strict overall winner. Returns
// the parsed sets, or the message to show inline.
function parseSets(
  sets: SetInput[],
): { sets: ResultSet[] } | { error: string } {
  // Skip a fully blank trailing row; require both scores on any set that has one.
  const parsed: ResultSet[] = [];
  for (const s of sets) {
    if (s.t1 === "" && s.t2 === "") continue;
    if (s.t1 === "" || s.t2 === "") {
      return { error: "Fill in both scores for each set." };
    }
    parsed.push({
      setNumber: parsed.length + 1,
      team1Games: parseInt(s.t1, 10),
      team2Games: parseInt(s.t2, 10),
    });
  }

  if (parsed.length === 0) return { error: "Enter at least one set score." };
  if (parsed.length > 3) {
    return { error: "A match is best of 3 — enter at most 3 sets." };
  }

  const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n <= 7;
  for (const s of parsed) {
    if (!inRange(s.team1Games) || !inRange(s.team2Games)) {
      return { error: `Set ${s.setNumber} scores must be between 0 and 7.` };
    }
    if (s.team1Games === s.team2Games) {
      return {
        error: `Set ${s.setNumber} is tied (${s.team1Games}–${s.team2Games}) — each set needs a winner.`,
      };
    }
  }

  const team1Sets = parsed.filter((s) => s.team1Games > s.team2Games).length;
  const team2Sets = parsed.filter((s) => s.team2Games > s.team1Games).length;
  if (team1Sets === team2Sets) {
    return {
      error:
        "This match has no overall winner — add the deciding set so one team wins more sets.",
    };
  }

  return { sets: parsed };
}

export default function LogResult({
  gameId,
  players,
  createdBy,
  maxPlayers,
}: {
  gameId: string;
  players: Player[];
  createdBy?: string;
  maxPlayers: number;
}) {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [detail, setDetail] = useState<ResultDetail | null>(null);

  // Owner's "Start match" team-assignment form.
  const [startOpen, setStartOpen] = useState(false);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // A participant's own scoresheet form.
  const [entryOpen, setEntryOpen] = useState(false);
  const [sets, setSets] = useState<SetInput[]>([
    { t1: "", t2: "" },
    { t1: "", t2: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const inGame = userId != null && players.some((p) => p.id === userId);
  const isOwner = userId != null && userId === createdBy;
  const isFull = players.length >= maxPlayers;

  // Re-read the result after any change — ours or, via Realtime, anyone
  // else's — so the board reflects the latest state without a reload.
  const refreshDetail = useCallback(async () => {
    const d = await getResultDetail(gameId);
    setDetail(d);
  }, [gameId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      const d = await getResultDetail(gameId);
      if (!active) return;
      setUserId(uid);
      setDetail(d);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [gameId]);

  // Live updates (same pattern as the chat thread): listen for the result row
  // changing (started / disputed / confirmed) and, once a result exists, for
  // scoresheets landing — refresh the board on any of them. Re-subscribes when
  // the result id appears so the entries filter can be added.
  const resultId = detail?.id ?? null;
  useEffect(() => {
    if (!ready) return;
    const channel = supabase.channel(
      `match-result:${gameId}:${resultId ?? "none"}`,
    );
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "match_results",
        filter: `game_id=eq.${gameId}`,
      },
      () => {
        refreshDetail();
      },
    );
    if (resultId != null) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_result_entries",
          filter: `result_id=eq.${resultId}`,
        },
        () => {
          refreshDetail();
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready, gameId, resultId, refreshDetail]);

  // ── Owner: start the match ────────────────────────────────────────────────

  function openStartForm() {
    // Sensible default for the 2v2 norm: first half on Team 1, rest on Team 2.
    // The owner can tap any player to switch sides.
    const init: Record<string, Team> = {};
    const half = Math.ceil(players.length / 2);
    players.forEach((p, i) => {
      init[p.id] = i < half ? 1 : 2;
    });
    setTeams(init);
    setStartError(null);
    setStartOpen(true);
  }

  function flipTeam(pid: string) {
    setTeams((t) => ({ ...t, [pid]: t[pid] === 1 ? 2 : 1 }));
  }

  async function handleStart() {
    if (starting || !userId) return;
    setStartError(null);

    // A real 2v2: exactly two players on each side (the RPC re-checks this).
    const team1 = players.filter((p) => teams[p.id] === 1);
    const team2 = players.filter((p) => teams[p.id] === 2);
    if (team1.length !== 2 || team2.length !== 2) {
      setStartError(
        `Each team needs exactly 2 players (Team 1 has ${team1.length}, Team 2 has ${team2.length}).`,
      );
      return;
    }

    setStarting(true);
    const result = await startMatch({
      gameId,
      team1Ids: team1.map((p) => p.id),
      team2Ids: team2.map((p) => p.id),
    });
    setStarting(false);

    if ("ok" in result || result.duplicate) {
      // Started — or someone beat us to it; either way show the live result.
      setStartOpen(false);
      await refreshDetail();
      router.refresh();
      return;
    }
    setStartError(result.error);
  }

  // ── Participant: enter / edit their scoresheet ────────────────────────────

  function openEntryForm() {
    // Prefill with what I entered before (edit / resubmit), else two blank sets.
    const mine = detail?.entries.find((e) => e.userId === userId);
    setSets(
      mine && mine.sets.length > 0
        ? mine.sets.map((s) => ({
            t1: String(s.team1Games),
            t2: String(s.team2Games),
          }))
        : [
            { t1: "", t2: "" },
            { t1: "", t2: "" },
          ],
    );
    setEntryError(null);
    setEntryOpen(true);
  }

  // Keep each score a digit in 0–7 (or empty while typing).
  function setScore(idx: number, side: "t1" | "t2", value: string) {
    const digits = value.replace(/[^0-9]/g, "");
    const next =
      digits === "" ? "" : String(Math.min(7, Math.max(0, parseInt(digits, 10))));
    setSets((arr) => arr.map((s, i) => (i === idx ? { ...s, [side]: next } : s)));
  }

  function addSet() {
    setSets((arr) => (arr.length >= 3 ? arr : [...arr, { t1: "", t2: "" }]));
  }
  function removeSet(idx: number) {
    setSets((arr) => (arr.length <= 1 ? arr : arr.filter((_, i) => i !== idx)));
  }

  async function handleSubmitEntry() {
    if (submitting || !userId) return;
    setEntryError(null);

    const parsed = parseSets(sets);
    if ("error" in parsed) {
      setEntryError(parsed.error);
      return;
    }

    setSubmitting(true);
    try {
      await submitEntry(gameId, parsed.sets);
      setEntryOpen(false);
      await refreshDetail();
      router.refresh();
    } catch (e) {
      setEntryError(
        e instanceof Error ? e.message : "Could not submit your scores.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Shared pieces ─────────────────────────────────────────────────────────

  // The two-team board. Markers: a ✓ once that player's scoresheet is in
  // (hidden when finalised — everyone agreed by definition); the winning team
  // gets the lima print pass + the "· Winner" word, never colour alone.
  function teamBoard(d: ResultDetail) {
    const finalised = d.status === "confirmed";
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {([1, 2] as Team[]).map((team) => {
          const onTeam = d.participants.filter((p) => p.team === team);
          const isWinner = finalised && d.winningTeam === team;
          return (
            <div
              key={team}
              className={`rounded-field p-2.5 min-h-24 border-2 ${
                isWinner ? "bg-lima border-tinta" : "bg-tinta/6 border-transparent"
              }`}
            >
              <div
                className={`t-mono text-micro tracking-[0.12em] text-center mb-2 flex items-center justify-center gap-1 ${
                  isWinner ? "text-tinta" : "text-tinta/70"
                }`}
              >
                Team {team}
                {isWinner && <span>· Winner</span>}
              </div>
              <div className="space-y-1.5">
                {onTeam.map((p) => (
                  <div key={p.userId} className="flex items-center gap-2">
                    <PlayerAvatar
                      userId={p.userId}
                      avatarUrl={p.avatarUrl}
                      name={p.name}
                      className="size-7"
                    />
                    <span className="text-label font-semibold text-tinta truncate flex-1">
                      {p.name}
                    </span>
                    {!finalised &&
                      (p.hasSubmitted ? (
                        <span
                          aria-label="Scores submitted"
                          className="text-tinta font-extrabold text-label leading-none"
                        >
                          ✓
                        </span>
                      ) : (
                        <span
                          aria-label="Scores not yet submitted"
                          className="t-mono text-tinta/45 text-[9px] tracking-[0.08em]"
                        >
                          waiting
                        </span>
                      ))}
                  </div>
                ))}
                {onTeam.length === 0 && (
                  <div className="text-label text-tinta/45 text-center py-2">
                    No players
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // The set-score inputs — 1 to 3 sets, games per team 0–7.
  const entryForm = (
    <>
      <div className="flex items-center justify-between mt-5">
        <span className="t-mono text-micro tracking-[0.14em] text-naranja-d">Your set scores</span>
        {sets.length < 3 && (
          <button
            type="button"
            onClick={addSet}
            className="pl-hit text-label text-tinta font-extrabold uppercase tracking-[0.04em] border-b-2 border-naranja rounded-none active:opacity-70 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
          >
            + Add set
          </button>
        )}
      </div>
      <div className="t-mono flex items-center gap-2 mt-2 text-[9px] tracking-[0.1em] text-tinta/45">
        <span className="w-12" />
        <span className="w-14 text-center">Team 1</span>
        <span className="w-3" />
        <span className="w-14 text-center">Team 2</span>
      </div>
      <div className="space-y-2 mt-1">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="t-mono text-micro tracking-[0.1em] text-tinta/70 w-12">Set {i + 1}</span>
            <input
              inputMode="numeric"
              value={s.t1}
              onChange={(e) => setScore(i, "t1", e.target.value)}
              placeholder="0"
              aria-label={`Set ${i + 1} Team 1 games`}
              className="pl-surface w-14 text-center rounded-field py-2 t-display text-display-sm leading-none text-tinta placeholder:text-tinta/45 outline-none focus:border-naranja transition-colors duration-150 ease-out"
            />
            <span className="w-3 text-center text-tinta/45">–</span>
            <input
              inputMode="numeric"
              value={s.t2}
              onChange={(e) => setScore(i, "t2", e.target.value)}
              placeholder="0"
              aria-label={`Set ${i + 1} Team 2 games`}
              className="pl-surface w-14 text-center rounded-field py-2 t-display text-display-sm leading-none text-tinta placeholder:text-tinta/45 outline-none focus:border-naranja transition-colors duration-150 ease-out"
            />
            {sets.length > 1 && (
              <button
                type="button"
                onClick={() => removeSet(i)}
                className="pl-hit ml-auto text-label font-medium text-tinta/45 rounded-field hover:text-tinta active:opacity-70 transition-[color,opacity] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2.5 mt-5">
        <Button
          className="flex-1"
          onClick={handleSubmitEntry}
          loading={submitting}
        >
          {submitting ? "Submitting…" : "Submit scores"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setEntryOpen(false)}
        >
          Cancel
        </Button>
      </div>
      <p
        aria-live="polite"
        className={`text-center text-label font-semibold text-naranja-d mt-2 ${entryError ? "" : "hidden"}`}
      >
        {entryError}
      </p>
    </>
  );

  // Still checking who's viewing → show nothing to avoid a flash.
  if (!ready) return null;

  // ── A result exists ───────────────────────────────────────────────────────
  if (detail) {
    const finalised = detail.status === "confirmed";
    const disputed = detail.status === "disputed";
    const me = detail.participants.find((p) => p.userId === userId);
    const myEntry = detail.entries.find((e) => e.userId === userId) ?? null;
    const submittedCount = detail.participants.filter(
      (p) => p.hasSubmitted,
    ).length;

    // FINALISED — the agreed result, shown to any viewer of the game page.
    if (finalised) {
      return (
        <>
          <SectionLabel>Match result</SectionLabel>
          <div className="pl-card p-4">
            <div className="text-center mb-3">
              <p className="t-display text-display-sm text-tinta">
                Team {detail.winningTeam} w<span className="text-naranja">o</span>n
              </p>
            </div>
            {teamBoard(detail)}
            {/* Set scores — the numbers get the poster shout. */}
            <div className="mt-5 space-y-2">
              {detail.sets.map((s) => (
                <div
                  key={s.setNumber}
                  className="flex items-baseline justify-between"
                >
                  <span className="t-mono text-micro tracking-[0.14em] text-tinta/70">Set {s.setNumber}</span>
                  <span className="t-display text-display-md leading-none text-tinta tabular-nums">
                    {s.team1Games}–{s.team2Games}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      );
    }

    // IN PROGRESS (pending or disputed) — participants + the owner only.
    if (!me && !isOwner) return null;

    return (
      <>
        <SectionLabel>Match result</SectionLabel>
        <div className="pl-card p-4">
          {/* Status line. */}
          <div className="text-center mb-3">
            {disputed ? (
              <>
                <p className="t-mono text-micro tracking-[0.14em] text-naranja-d">
                  Scores don&apos;t match
                </p>
                <p className="text-label font-medium text-tinta/70 mt-1">
                  Someone entered a different score — check what everyone put
                  in and resubmit.
                </p>
              </>
            ) : (
              <p className="t-mono text-micro tracking-[0.14em] text-tinta/70">
                {submittedCount} of {detail.participants.length} scoresheets in
              </p>
            )}
          </div>

          {teamBoard(detail)}

          {/* Disputed: every submitted scoresheet, so the mismatch is plain to
              see. Sheets that differ from YOURS get the naranja ink + the
              "differs" word (never colour alone). */}
          {disputed && detail.entries.length > 0 && (
            <div className="mt-5">
              <span className="t-mono text-micro tracking-[0.14em] text-naranja-d">What everyone entered</span>
              <div className="space-y-1.5 mt-2">
                {detail.entries.map((e) => {
                  const who = detail.participants.find(
                    (p) => p.userId === e.userId,
                  );
                  const differs =
                    myEntry != null &&
                    e.userId !== userId &&
                    !sameSheet(e.sets, myEntry.sets);
                  return (
                    <div
                      key={e.userId}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <span className="text-label font-semibold text-tinta truncate">
                        {e.userId === userId ? "You" : who?.name ?? "Player"}
                      </span>
                      <span
                        className={`t-mono text-micro tracking-[0.1em] tabular-nums ${
                          differs
                            ? "text-naranja-d font-bold"
                            : "text-tinta/70"
                        }`}
                      >
                        {formatSheet(e.sets)}
                        {differs && " · differs"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* The current user's action. Owners who aren't playing just watch. */}
          {me != null && entryOpen && entryForm}
          {me != null && !entryOpen && (
            <>
              {!me.hasSubmitted && (
                <Button className="mt-5" onClick={openEntryForm}>
                  Enter set scores
                </Button>
              )}
              {me.hasSubmitted && disputed && (
                <Button className="mt-5" onClick={openEntryForm}>
                  Edit &amp; resubmit
                </Button>
              )}
              {me.hasSubmitted && !disputed && (
                <>
                  <p className="text-center text-label font-medium text-tinta/70 mt-4">
                    Your scores are in — waiting on the others.
                  </p>
                  <div className="text-center mt-1">
                    <button
                      type="button"
                      onClick={openEntryForm}
                      className="pl-hit text-label font-medium text-tinta/45 rounded-field hover:text-tinta active:opacity-70 transition-[color,opacity] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
                    >
                      Change my scores
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </>
    );
  }

  // ── No result yet ─────────────────────────────────────────────────────────
  // Only the owner can start, and only once the game is full.
  if (!isOwner || !isFull) return null;

  if (!startOpen) {
    return (
      <>
        <SectionLabel>Match result</SectionLabel>
        <Button onClick={openStartForm}>Start match</Button>
      </>
    );
  }

  // The owner's team-assignment form.
  return (
    <>
      <SectionLabel>Start match</SectionLabel>
      <div className="pl-card p-4">
        {/* Teams — two columns; tap a player to switch their side. */}
        <span className="t-mono text-micro tracking-[0.14em] text-naranja-d">Teams</span>
        <div className="grid grid-cols-2 gap-2.5 mt-2">
          {([1, 2] as Team[]).map((team) => {
            const onTeam = players.filter((p) => teams[p.id] === team);
            return (
              <div key={team} className="bg-tinta/6 rounded-field p-2.5 min-h-24">
                <div className="t-mono text-micro tracking-[0.12em] text-tinta/70 text-center mb-2">
                  Team {team}
                </div>
                <div className="space-y-1.5">
                  {onTeam.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => flipTeam(p.id)}
                      className="pl-press w-full text-left text-label font-semibold text-tinta bg-papel border-[1.5px] border-tinta rounded-field px-2.5 py-2 truncate hover:border-naranja focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
                    >
                      {p.name}
                    </button>
                  ))}
                  {onTeam.length === 0 && (
                    <div className="text-label text-tinta/45 text-center py-2">
                      No players
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-label font-medium text-tinta/45 mt-1.5 text-center">
          Tap a player to switch their team. Everyone then enters the score —
          the result confirms once they all match.
        </p>

        <div className="flex gap-2.5 mt-5">
          <Button className="flex-1" onClick={handleStart} loading={starting}>
            {starting ? "Starting…" : "Start match"}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setStartOpen(false)}
          >
            Cancel
          </Button>
        </div>
        <p
          aria-live="polite"
          className={`text-center text-label font-semibold text-naranja-d mt-2 ${startError ? "" : "hidden"}`}
        >
          {startError}
        </p>
      </div>
    </>
  );
}
