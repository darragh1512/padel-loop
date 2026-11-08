"use client";
// The match result on the game page. The server enforces every step:
//   • No result yet: the organiser of a full 4-player game starts the match.
//   • Pending: every player enters the score separately, and this updates live as
//     scores come in. The server compares them when the last one lands.
//   • Confirmed: they all matched, so anyone viewing the game sees the result.
//   • Disputed: they didn't match, so players see what each person entered and
//     can resubmit.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ios/Icon";
import MessageCard, { TryAgain } from "@/components/ios/MessageCard";
import Monogram from "@/components/ios/Monogram";
import { capture } from "@/lib/analytics";
import { supabase } from "@/lib/supabaseClient";
import { getSignedInUser } from "@/lib/session";
import type { Player } from "@/lib/types";
import { getResultDetail, startMatch, submitEntry, type ResultDetail, type ResultSet } from "../../match-results";
import ScoreSheet from "./score-sheet";
import StartMatchSheet from "./start-match-sheet";

const TEAMS = [1, 2];

// Players sometimes start early, so Start Match appears this long before the game.
const START_MATCH_EARLY_MS = 60 * 60 * 1000;

// Exactly what the server compares: the same sets in the same order.
function sameSheet(a: ResultSet[], b: ResultSet[]): boolean {
  return a.length === b.length && a.every((s, i) => s.team1Games === b[i].team1Games && s.team2Games === b[i].team2Games);
}

function Heading({ note }: { note?: string }) {
  return (
    <div className="ios-sect">
      <h2 className="ios-t3">Match Result</h2>
      {note && <div className="ios-fn ios-sec">{note}</div>}
    </div>
  );
}

// Who's on each team and whose scores are in. Says it in words, never colour alone.
function Teams({ detail }: { detail: ResultDetail }) {
  return (
    <div className="ios-list">
      {TEAMS.map((team) => (
        <div key={team}>
          <div className="ios-fn ios-sec" style={{ padding: "10px 16px 0" }}>
            Team {team}
          </div>
          {detail.participants
            .filter((p) => p.team === team)
            .map((p) => (
              <div key={p.userId} className="ios-row" style={{ padding: "6px 16px", minHeight: 0, "--ios-inset": "60px" } as React.CSSProperties}>
                <Monogram name={p.name} photoUrl={p.avatarUrl} size={32} />
                <span className="ios-bd ios-grow ios-clip">{p.name}</span>
                {p.hasSubmitted ? (
                  <span className="ios-fn ios-acc ios-sb" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="check-circle" size={15} />
                    In
                  </span>
                ) : (
                  <span className="ios-fn ios-sec">Waiting</span>
                )}
              </div>
            ))}
        </div>
      ))}
      <div style={{ height: 8 }} />
    </div>
  );
}

// The finished match as a scoreboard: each team's players, then its games per set.
function Scoreboard({ detail, userId }: { detail: ResultDetail; userId: string | null }) {
  const games = (team: number, s: ResultSet) => (team === 1 ? s.team1Games : s.team2Games);
  const mine = detail.participants.find((p) => p.userId === userId);
  const title = mine ? (mine.team === detail.winningTeam ? "You Won" : "You Lost") : `Team ${detail.winningTeam} Won`;
  return (
    <>
      <div className="ios-card ios-board">
        <div className="ios-t3" style={{ padding: "14px 16px 0" }}>
          {title}
        </div>
        <div className="ios-board-row ios-fn ios-sec" style={{ paddingTop: 8, paddingBottom: 0 }}>
          <span className="ios-grow" />
          {detail.sets.map((s) => (
            <span key={s.setNumber} className="ios-board-set">
              Set {s.setNumber}
            </span>
          ))}
        </div>
        {TEAMS.map((team) => {
          const won = detail.winningTeam === team;
          return (
            <div
              key={team}
              className="ios-board-row"
              role="group"
              aria-label={`Team ${team}${won ? ", winner" : ""}: ${detail.sets.map((s) => games(team, s)).join(", ")}`}
            >
              <div className="ios-grow">
                <div className="ios-fn ios-sec" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  Team {team}
                  {won && (
                    <span className="ios-acc ios-sb" style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      · <Icon name="trophy" size={13} /> Winner
                    </span>
                  )}
                </div>
                {detail.participants
                  .filter((p) => p.team === team)
                  .map((p) => (
                    <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Monogram name={p.name} photoUrl={p.avatarUrl} size={28} />
                      <span className="ios-sh ios-clip">{p.name}</span>
                    </div>
                  ))}
              </div>
              {detail.sets.map((s) => {
                const tookSet = games(team, s) > games(team === 1 ? 2 : 1, s);
                return (
                  <span key={s.setNumber} className={`ios-board-set ios-t3${tookSet ? "" : " ios-sec"}`} style={tookSet ? undefined : { fontWeight: 400 }}>
                    {games(team, s)}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function LogResult({
  gameId,
  players,
  createdBy,
  maxPlayers,
  cancelled,
  startsAt,
}: {
  gameId: string;
  players: Player[];
  createdBy?: string;
  maxPlayers: number;
  cancelled: boolean;
  startsAt: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [sheet, setSheet] = useState<"start" | "score" | null>(null);
  // Who this player says didn't turn up, sent with their scores. It's only a report:
  // the database records an absence when everyone who submits names the same person.
  const [absent, setAbsent] = useState<string[]>([]);
  const opensAt = Date.parse(startsAt) - START_MATCH_EARLY_MS;
  const [startOpen, setStartOpen] = useState(() => Date.now() >= opensAt);

  // Appears by itself if the page is left open until then. The longest wait a timer
  // can hold is about 24 days, and a game further off than that just stays hidden.
  useEffect(() => {
    const wait = opensAt - Date.now();
    if (wait <= 0 || wait > 2 ** 31 - 1) return;
    const timer = setTimeout(() => setStartOpen(true), wait);
    return () => clearTimeout(timer);
  }, [opensAt]);

  // After any change, ours or anyone else's. If this read fails, the last good
  // result stays on screen rather than the section disappearing.
  const refresh = useCallback(async () => {
    try {
      setDetail(await getResultDetail(gameId));
    } catch {
      // The next change, or reopening the page, reads it again.
    }
  }, [gameId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSignedInUser();
      try {
        const found = await getResultDetail(gameId);
        if (!active) return;
        setDetail(found);
        setFailed(false);
      } catch {
        if (!active) return;
        setFailed(true);
      }
      setUserId(data.user?.id ?? null);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [gameId, attempt]);

  // Live updates, the same way chat works: when the result changes or scores land.
  const resultId = detail?.id ?? null;
  useEffect(() => {
    if (!ready) return;
    const channel = supabase.channel(`match-result:${gameId}:${resultId ?? "none"}`);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "match_results", filter: `game_id=eq.${gameId}` }, () => {
      refresh();
    });
    if (resultId != null) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "match_result_entries", filter: `result_id=eq.${resultId}` }, () => {
        refresh();
      });
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready, gameId, resultId, refresh]);

  async function handleStart(team1Ids: string[], team2Ids: string[]): Promise<string | null> {
    const result = await startMatch({ gameId, team1Ids, team2Ids });
    // "duplicate" means someone beat us to it, so just show the match that exists.
    if ("error" in result && !result.duplicate) return result.error;
    await refresh();
    router.refresh();
    return null;
  }

  async function handleSubmit(sets: ResultSet[]) {
    const outcome = await submitEntry(gameId, sets, absent);
    // Two separate events: scores going in isn't the same as a result being agreed,
    // and that gap is worth watching. Counts only, no scores or player ids.
    capture("result_submitted", { game_id: gameId, sets: sets.length, marked_absent: absent.length });
    if (outcome.status === "confirmed") capture("result_confirmed", { game_id: gameId });
    await refresh();
    router.refresh();
  }

  if (!ready) return null;

  const isOwner = userId != null && userId === createdBy;
  const me = detail?.participants.find((p) => p.userId === userId) ?? null;

  let body = null;
  if (failed) {
    // Only people who could act on it need to know, and only they'd miss it.
    if (!isOwner && !players.some((p) => p.id === userId)) return null;
    body = (
      <MessageCard
        alert
        title="Couldn’t Load the Result"
        body="Check your connection and try again."
        action={
          <TryAgain
            onClick={() => {
              setReady(false);
              setAttempt((n) => n + 1);
            }}
          />
        }
      />
    );
  } else if (detail?.status === "confirmed") {
    body = (
      <section style={{ marginTop: 18 }}>
        <Heading />
        <Scoreboard detail={detail} userId={userId} />
      </section>
    );
  } else if (detail) {
    // In progress: only for the players and the organiser.
    if (!me && !isOwner) return null;
    const disputed = detail.status === "disputed";
    const submitted = detail.participants.filter((p) => p.hasSubmitted).length;
    const myEntry = detail.entries.find((e) => e.userId === userId) ?? null;
    body = (
      <section style={{ marginTop: 18 }}>
        <Heading note={disputed ? undefined : `${submitted} of ${detail.participants.length} in`} />

        {disputed && (
          <div className="ios-card" style={{ padding: "14px 16px", marginBottom: 12 }} role="status">
            <div className="ios-hl ios-destructive">Scores Don’t Match</div>
            <div className="ios-sh ios-sec" style={{ marginTop: 2 }}>
              Check what everyone entered, then resubmit.
            </div>
            <div style={{ marginTop: 10 }}>
              {detail.entries.map((e) => {
                const who = detail.participants.find((p) => p.userId === e.userId);
                const differs = myEntry != null && e.userId !== userId && !sameSheet(e.sets, myEntry.sets);
                return (
                  <div key={e.userId} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
                    <span className="ios-sh ios-clip">{e.userId === userId ? "You" : (who?.name ?? "Player")}</span>
                    <span className={`ios-sh${differs ? " ios-destructive ios-sb" : " ios-sec"}`} style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {e.sets.map((s) => `${s.team1Games}–${s.team2Games}`).join(", ")}
                      {differs && " · Differs"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Teams detail={detail} />

        {/* The organiser may have left the game, in which case they just watch. */}
        {me && (!me.hasSubmitted || disputed) && (
          <div style={{ display: "flex", margin: "12px 16px 0" }}>
            <button type="button" className="ios-wide-btn" onClick={() => setSheet("score")}>
              {me.hasSubmitted ? "Edit and Resubmit" : "Enter Scores"}
            </button>
          </div>
        )}
        {me && me.hasSubmitted && !disputed && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <p className="ios-fn ios-sec" style={{ padding: "0 32px" }}>
              Your scores are in. Waiting on the others.
            </p>
            <button type="button" className="ios-text-btn ios-sh ios-acc" onClick={() => setSheet("score")}>
              Change My Scores
            </button>
          </div>
        )}
      </section>
    );
  } else {
    // Results need four real players, so guests and 2-player games can't record one.
    const canStart = isOwner && !cancelled && startOpen && maxPlayers === 4 && players.length === 4;
    if (!canStart) return null;
    body = (
      <section style={{ marginTop: 18 }}>
        <Heading />
        <div className="ios-card" style={{ padding: 16 }}>
          <div className="ios-sh ios-sec">Set the teams, then each player enters the score. The result is confirmed once they all match.</div>
          <div style={{ display: "flex", marginTop: 12 }}>
            <button type="button" className="ios-wide-btn" onClick={() => setSheet("start")}>
              Start Match
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {body}
      {sheet === "start" && <StartMatchSheet players={players} onStart={handleStart} onClose={() => setSheet(null)} />}
      {sheet === "score" && detail && userId && (
        <ScoreSheet
          detail={detail}
          userId={userId}
          absent={absent}
          onAbsentChange={setAbsent}
          onSubmit={handleSubmit}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}
