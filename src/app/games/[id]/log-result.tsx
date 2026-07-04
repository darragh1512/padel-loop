"use client";
// "Log result" — the match-result entry + consensus UI on the game detail page.
// It only shows for someone who is IN this game (their id is in the roster).
//
// Two states, both driven entirely by getResultDetail:
//   • No result yet → the entry form: split the roster into Team 1 / Team 2,
//     enter 1–3 set scores, and submit (stores a 'pending' result; the
//     submitter is auto-confirmed).
//   • A result exists → the consensus view: the score, both teams with each
//     player's avatar + confirmation state, and — for a player who hasn't
//     confirmed yet — a "Confirm result" button. When the last player confirms,
//     the server finalises the result and works out the winner, and the view
//     flips to show the winning team highlighted.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button, SectionLabel } from "@/components/ui";
import PlayerAvatar from "@/components/PlayerAvatar";
import type { Player } from "@/lib/types";
import {
  getResultDetail,
  submitMatchResult,
  confirmResult,
  type ResultSet,
  type ResultDetail,
} from "../../match-results";

type Team = 1 | 2;
type SetInput = { t1: string; t2: string };

export default function LogResult({
  gameId,
  players,
}: {
  gameId: string;
  players: Player[];
}) {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [inGame, setInGame] = useState(false);
  const [detail, setDetail] = useState<ResultDetail | null>(null);

  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [sets, setSets] = useState<SetInput[]>([
    { t1: "", t2: "" },
    { t1: "", t2: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      const d = await getResultDetail(gameId);
      if (!active) return;
      setUserId(uid);
      setInGame(uid != null && players.some((p) => p.id === uid));
      setDetail(d);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [gameId, players]);

  // Re-read the logged result after a submit or confirm so the view reflects
  // the new state without a full reload.
  async function refreshDetail() {
    const d = await getResultDetail(gameId);
    setDetail(d);
  }

  function startForm() {
    // Sensible default for the 2v2 norm: first half on Team 1, rest on Team 2.
    // The user can tap any player to switch sides.
    const init: Record<string, Team> = {};
    const half = Math.ceil(players.length / 2);
    players.forEach((p, i) => {
      init[p.id] = i < half ? 1 : 2;
    });
    setTeams(init);
    setSets([
      { t1: "", t2: "" },
      { t1: "", t2: "" },
    ]);
    setError(null);
    setOpen(true);
  }

  function flipTeam(pid: string) {
    setTeams((t) => ({ ...t, [pid]: t[pid] === 1 ? 2 : 1 }));
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

  async function handleSubmit() {
    if (submitting || !userId) return;
    setError(null);

    // Teams — a real 2v2: exactly two players on each side. Rejects 1v3, 3v1,
    // 1v1, or any other split (and so also the old "empty team" case).
    const team1 = players.filter((p) => teams[p.id] === 1);
    const team2 = players.filter((p) => teams[p.id] === 2);
    if (team1.length !== 2 || team2.length !== 2) {
      setError(
        `Each team needs exactly 2 players (Team 1 has ${team1.length}, Team 2 has ${team2.length}).`,
      );
      return;
    }

    // Build the set rows. Skip a fully blank trailing row; require both scores
    // on any set that has one.
    const parsedSets: ResultSet[] = [];
    for (const s of sets) {
      if (s.t1 === "" && s.t2 === "") continue;
      if (s.t1 === "" || s.t2 === "") {
        setError("Fill in both scores for each set.");
        return;
      }
      parsedSets.push({
        setNumber: parsedSets.length + 1,
        team1Games: parseInt(s.t1, 10),
        team2Games: parseInt(s.t2, 10),
      });
    }

    // Set count — best of 3, so 1 to 3 sets.
    if (parsedSets.length === 0) {
      setError("Enter at least one set score.");
      return;
    }
    if (parsedSets.length > 3) {
      setError("A match is best of 3 — enter at most 3 sets.");
      return;
    }

    // Every set must be completed and won by someone: scores are whole numbers
    // 0–7 and the two scores aren't equal (which also rules out a 0–0 set).
    const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n <= 7;
    for (const s of parsedSets) {
      if (!inRange(s.team1Games) || !inRange(s.team2Games)) {
        setError(`Set ${s.setNumber} scores must be between 0 and 7.`);
        return;
      }
      if (s.team1Games === s.team2Games) {
        setError(
          `Set ${s.setNumber} is tied (${s.team1Games}–${s.team2Games}) — each set needs a winner.`,
        );
        return;
      }
    }

    // Overall winner — mirror confirm_match_result exactly: whichever team wins
    // more sets wins the match; equal set wins can never be finalised, so block
    // it here too (e.g. one set each, or a 1–1 with no deciding set added).
    const team1Sets = parsedSets.filter(
      (s) => s.team1Games > s.team2Games,
    ).length;
    const team2Sets = parsedSets.filter(
      (s) => s.team2Games > s.team1Games,
    ).length;
    if (team1Sets === team2Sets) {
      setError(
        "This match has no overall winner — add the deciding set so one team wins more sets.",
      );
      return;
    }

    setSubmitting(true);
    const result = await submitMatchResult({
      gameId,
      submittedBy: userId,
      participants: players.map((p) => ({ userId: p.id, team: teams[p.id] })),
      sets: parsedSets,
    });
    setSubmitting(false);

    if ("ok" in result) {
      setOpen(false);
      await refreshDetail();
      router.refresh();
      return;
    }

    if (result.duplicate) {
      // Someone else logged it first — load and show their result.
      setOpen(false);
      await refreshDetail();
    }
    setError(result.error);
  }

  async function handleConfirm() {
    if (confirming) return;
    setConfirmError(null);
    setConfirming(true);
    try {
      await confirmResult(gameId);
      await refreshDetail();
      router.refresh();
    } catch (e) {
      setConfirmError(
        e instanceof Error ? e.message : "Could not confirm the result.",
      );
    } finally {
      setConfirming(false);
    }
  }

  // Still checking, or this viewer isn't in the game → show nothing.
  if (!ready || !inGame) return null;

  // A result exists → the consensus view (score, teams, confirmations).
  if (detail) {
    const finalised = detail.status === "confirmed";
    const me = detail.participants.find((p) => p.userId === userId);
    const myConfirmed = me?.confirmation === "confirmed";
    const canConfirm = !finalised && me != null && !myConfirmed;
    const pendingCount = detail.participants.filter(
      (p) => p.confirmation !== "confirmed",
    ).length;

    return (
      <>
        <SectionLabel>Match result</SectionLabel>
        <div className="pl-card p-4">
          {/* Status line — finalised winner, or how many are left to confirm. */}
          <div className="text-center mb-3">
            {finalised ? (
              <p className="font-display text-display-sm text-ink">
                Team {detail.winningTeam} won
              </p>
            ) : (
              <p className="text-label text-ink-secondary">
                {pendingCount} {pendingCount === 1 ? "player" : "players"} still
                to confirm
              </p>
            )}
          </div>

          {/* Teams — two columns; the winning team is highlighted once final
              (the sage wash + the "· Winner" word, never colour alone). */}
          <div className="grid grid-cols-2 gap-2.5">
            {([1, 2] as Team[]).map((team) => {
              const onTeam = detail.participants.filter((p) => p.team === team);
              const isWinner = finalised && detail.winningTeam === team;
              return (
                <div
                  key={team}
                  className={`rounded-field p-2.5 min-h-24 ${
                    isWinner ? "bg-accent-soft" : "pl-surface"
                  }`}
                >
                  <div
                    className={`text-label text-center mb-2 flex items-center justify-center gap-1 ${
                      isWinner ? "text-accent font-medium" : "text-ink-secondary"
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
                        <span className="text-label font-medium text-ink truncate flex-1">
                          {p.name}
                        </span>
                        {p.confirmation === "confirmed" ? (
                          <span
                            aria-label="Confirmed"
                            className="text-accent text-label leading-none"
                          >
                            ✓
                          </span>
                        ) : (
                          <span
                            aria-label="Not yet confirmed"
                            className="text-ink-faint text-micro"
                          >
                            pending
                          </span>
                        )}
                      </div>
                    ))}
                    {onTeam.length === 0 && (
                      <div className="text-label text-ink-faint text-center py-2">
                        No players
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Set scores — the numbers get the serif, calm and editorial. */}
          <div className="mt-5 space-y-2">
            {detail.sets.map((s) => (
              <div
                key={s.setNumber}
                className="flex items-baseline justify-between"
              >
                <span className="text-label text-ink-secondary">Set {s.setNumber}</span>
                <span className="font-display text-display-md leading-none text-ink tabular-nums">
                  {s.team1Games}–{s.team2Games}
                </span>
              </div>
            ))}
          </div>

          {/* The current user's confirm action / state. */}
          {canConfirm && (
            <Button className="mt-5" onClick={handleConfirm} loading={confirming}>
              {confirming ? "Confirming…" : "Confirm result"}
            </Button>
          )}
          {!finalised && myConfirmed && (
            <p className="text-center text-label text-ink-secondary mt-3">
              You&apos;ve confirmed — waiting on the others.
            </p>
          )}
          <p
            aria-live="polite"
            className={`text-center text-label text-danger mt-2 ${confirmError ? "" : "hidden"}`}
          >
            {confirmError}
          </p>
        </div>
      </>
    );
  }

  // No result yet, collapsed → the entry point.
  if (!open) {
    return (
      <>
        <SectionLabel>Match result</SectionLabel>
        <Button onClick={startForm}>Log result</Button>
      </>
    );
  }

  // The entry form.
  return (
    <>
      <SectionLabel>Log result</SectionLabel>
      <div className="pl-card p-4">
        {/* Teams — two columns; tap a player to switch their side. */}
        <span className="text-label font-medium text-ink-secondary">Teams</span>
        <div className="grid grid-cols-2 gap-2.5 mt-2">
          {([1, 2] as Team[]).map((team) => {
            const onTeam = players.filter((p) => teams[p.id] === team);
            return (
              <div key={team} className="pl-surface rounded-field p-2.5 min-h-24">
                <div className="text-label text-ink-secondary text-center mb-2">
                  Team {team}
                </div>
                <div className="space-y-1.5">
                  {onTeam.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => flipTeam(p.id)}
                      className="pl-press w-full text-left text-label font-medium text-ink bg-surface border border-line rounded-field px-2.5 py-2 truncate hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {p.name}
                    </button>
                  ))}
                  {onTeam.length === 0 && (
                    <div className="text-label text-ink-faint text-center py-2">
                      No players
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-label text-ink-faint mt-1.5 text-center">
          Tap a player to switch their team.
        </p>

        {/* Set scores — 1 to 3 sets, games per team 0–7. */}
        <div className="flex items-center justify-between mt-5">
          <span className="text-label font-medium text-ink-secondary">Set scores</span>
          {sets.length < 3 && (
            <button
              type="button"
              onClick={addSet}
              className="text-label text-accent font-medium rounded-field active:opacity-70 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              + Add set
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 text-label text-ink-faint">
          <span className="w-12" />
          <span className="w-14 text-center">Team 1</span>
          <span className="w-3" />
          <span className="w-14 text-center">Team 2</span>
        </div>
        <div className="space-y-2 mt-1">
          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-label text-ink-secondary w-12">Set {i + 1}</span>
              <input
                inputMode="numeric"
                value={s.t1}
                onChange={(e) => setScore(i, "t1", e.target.value)}
                placeholder="0"
                aria-label={`Set ${i + 1} Team 1 games`}
                className="pl-surface w-14 text-center rounded-field py-2 font-display text-display-sm leading-none text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors duration-150 ease-out"
              />
              <span className="w-3 text-center text-ink-faint">–</span>
              <input
                inputMode="numeric"
                value={s.t2}
                onChange={(e) => setScore(i, "t2", e.target.value)}
                placeholder="0"
                aria-label={`Set ${i + 1} Team 2 games`}
                className="pl-surface w-14 text-center rounded-field py-2 font-display text-display-sm leading-none text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors duration-150 ease-out"
              />
              {sets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSet(i)}
                  className="ml-auto text-label text-ink-faint rounded-field hover:text-ink-secondary active:opacity-70 transition-[color,opacity] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 mt-5">
          <Button className="flex-1" onClick={handleSubmit} loading={submitting}>
            {submitting ? "Submitting…" : "Submit result"}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
        <p
          aria-live="polite"
          className={`text-center text-label text-danger mt-2 ${error ? "" : "hidden"}`}
        >
          {error}
        </p>
      </div>
    </>
  );
}
