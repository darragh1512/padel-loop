"use client";

// A player enters the set scores they saw, and can say if anyone didn't turn up.

import { useCallback, useState } from "react";
import Icon from "@/components/ios/Icon";
import Sheet, { SheetToggle, useSheetClosing } from "@/components/ios/Sheet";
import type { ResultDetail, ResultSet } from "../../match-results";
import { friendlyError } from "./result-text";

type SetInput = { t1: string; t2: string };

// The same rules the server enforces: 1 to 3 sets, whole scores from 0 to 7, no
// tied set, and one team winning more sets.
function parseSets(sets: SetInput[]): { sets: ResultSet[] } | { error: string } {
  const parsed: ResultSet[] = [];
  for (const s of sets) {
    if (s.t1 === "" && s.t2 === "") continue;
    if (s.t1 === "" || s.t2 === "") return { error: "Fill in both scores for each set." };
    parsed.push({
      setNumber: parsed.length + 1,
      team1Games: parseInt(s.t1, 10),
      team2Games: parseInt(s.t2, 10),
    });
  }
  if (parsed.length === 0) return { error: "Enter at least one set score." };

  for (const s of parsed) {
    if (s.team1Games === s.team2Games) {
      return { error: `Set ${s.setNumber} is tied at ${s.team1Games}–${s.team2Games}. Each set needs a winner.` };
    }
  }
  const team1Sets = parsed.filter((s) => s.team1Games > s.team2Games).length;
  if (team1Sets === parsed.length - team1Sets) {
    return { error: "These scores have no overall winner. Add the deciding set." };
  }
  return { sets: parsed };
}

export default function ScoreSheet({
  detail,
  userId,
  absent,
  onAbsentChange,
  onSubmit,
  onClose,
}: {
  detail: ResultDetail;
  userId: string;
  absent: string[];
  onAbsentChange: (ids: string[]) => void;
  onSubmit: (sets: ResultSet[]) => Promise<void>; // throws if it didn't go in
  onClose: () => void;
}) {
  // Starts from what they entered before, otherwise two blank sets.
  const [sets, setSets] = useState<SetInput[]>(() => {
    const mine = detail.entries.find((e) => e.userId === userId);
    return mine && mine.sets.length > 0
      ? mine.sets.map((s) => ({ t1: String(s.team1Games), t2: String(s.team2Games) }))
      : [
          { t1: "", t2: "" },
          { t1: "", t2: "" },
        ];
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, close] = useSheetClosing(useCallback(() => onClose(), [onClose]));

  // First names under each column, so nobody enters the score the wrong way round.
  const teamLabel = (team: number) =>
    detail.participants
      .filter((p) => p.team === team)
      .map((p) => (p.userId === userId ? "You" : p.name.trim().split(/\s+/)[0]))
      .join(" & ");

  function setScore(index: number, side: "t1" | "t2", value: string) {
    // Scores are one digit, so typing over a score replaces it.
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const next = digit === "" ? "" : String(Math.min(7, parseInt(digit, 10)));
    setSets((all) => all.map((s, i) => (i === index ? { ...s, [side]: next } : s)));
  }

  function requestClose() {
    if (!submitting) close();
  }

  async function handleSubmit() {
    if (submitting) return;
    setError(null);
    const parsed = parseSets(sets);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(parsed.sets);
      close();
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : ""));
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      title="Enter Scores"
      left={{ label: "Cancel", onPress: requestClose }}
      right={{ label: "Submit", onPress: handleSubmit, busy: submitting }}
      closing={closing}
      onRequestClose={requestClose}
    >
      <div className="ios-list" style={{ marginTop: 16 }}>
        <div className="ios-score-row">
          <span />
          <span className="ios-fn ios-sec ios-clip">{teamLabel(1)}</span>
          <span className="ios-fn ios-sec ios-clip">{teamLabel(2)}</span>
          <span />
        </div>
        {sets.map((s, i) => (
          <div key={i} className="ios-score-row">
            <span className="ios-bd">Set {i + 1}</span>
            <input
              className="ios-score"
              inputMode="numeric"
              autoComplete="off"
              value={s.t1}
              placeholder="0"
              aria-label={`Set ${i + 1}, ${teamLabel(1)}, games won`}
              onChange={(e) => setScore(i, "t1", e.target.value)}
            />
            <input
              className="ios-score"
              inputMode="numeric"
              autoComplete="off"
              value={s.t2}
              placeholder="0"
              aria-label={`Set ${i + 1}, ${teamLabel(2)}, games won`}
              onChange={(e) => setScore(i, "t2", e.target.value)}
            />
            {sets.length > 1 ? (
              <button
                type="button"
                className="ios-search-btn"
                style={{ color: "var(--ios-secondary)" }}
                aria-label={`Remove set ${i + 1}`}
                onClick={() => setSets((all) => all.filter((_, n) => n !== i))}
              >
                <Icon name="clear" size={18} />
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
        {sets.length < 3 && (
          <button
            type="button"
            className="ios-row ios-toggle-row ios-bd"
            style={{ gap: 6, color: "var(--ios-accent)" }}
            onClick={() => setSets((all) => [...all, { t1: "", t2: "" }])}
          >
            <Icon name="plus" size={18} />
            Add Set
          </button>
        )}
      </div>

      {error && (
        <p className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
          {error}
        </p>
      )}

      {/* Part of the scoresheet, not a separate step. Left alone, it says everyone
          turned up, which is the normal case. */}
      <section style={{ marginTop: 16 }}>
        <div className="ios-sect">
          <h2 className="ios-t3">Anyone Not Turn Up?</h2>
        </div>
        <div className="ios-list">
          {detail.participants
            .filter((p) => p.userId !== userId)
            .map((p) => (
              <SheetToggle
                key={p.userId}
                label={p.name}
                on={absent.includes(p.userId)}
                onChange={() =>
                  onAbsentChange(absent.includes(p.userId) ? absent.filter((x) => x !== p.userId) : [...absent, p.userId])
                }
              />
            ))}
        </div>
        <p className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
          Only recorded if everyone who enters scores says the same.
        </p>
      </section>
    </Sheet>
  );
}
