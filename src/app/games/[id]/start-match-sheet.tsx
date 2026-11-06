"use client";

// The organiser sets the teams before a match. Tapping a player moves them across.

import { useCallback, useState } from "react";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import Sheet, { useSheetClosing } from "@/components/ios/Sheet";
import type { Player } from "@/lib/types";
import { friendlyError } from "./result-text";

type Team = 1 | 2;

export default function StartMatchSheet({
  players,
  onStart,
  onClose,
}: {
  players: Player[];
  onStart: (team1Ids: string[], team2Ids: string[]) => Promise<string | null>; // the error, if any
  onClose: () => void;
}) {
  // First two on Team 1 and the rest on Team 2, as a starting point.
  const [teams, setTeams] = useState<Record<string, Team>>(() =>
    Object.fromEntries(players.map((p, i) => [p.id, i < 2 ? 1 : 2])),
  );
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, close] = useSheetClosing(useCallback(() => onClose(), [onClose]));

  const onTeam = (team: Team) => players.filter((p) => teams[p.id] === team);
  const balanced = onTeam(1).length === 2 && onTeam(2).length === 2;

  function requestClose() {
    if (!starting) close();
  }

  async function handleStart() {
    if (starting || !balanced) return;
    setStarting(true);
    setError(null);
    const problem = await onStart(
      onTeam(1).map((p) => p.id),
      onTeam(2).map((p) => p.id),
    );
    if (problem) {
      setError(friendlyError(problem));
      setStarting(false);
      return;
    }
    close();
  }

  return (
    <Sheet
      title="Start Match"
      left={{ label: "Cancel", onPress: requestClose }}
      right={{ label: "Start", onPress: handleStart, busy: starting, disabled: !balanced }}
      closing={closing}
      onRequestClose={requestClose}
    >
      {([1, 2] as Team[]).map((team) => (
        <section key={team} style={{ marginTop: 16 }}>
          <div className="ios-sect">
            <h2 className="ios-t3">Team {team}</h2>
          </div>
          <div className="ios-list">
            {onTeam(team).map((p) => (
              <button
                key={p.id}
                type="button"
                className="ios-row ios-toggle-row"
                style={{ padding: "8px 16px", "--ios-inset": "68px" } as React.CSSProperties}
                aria-label={`Move ${p.name} to Team ${team === 1 ? 2 : 1}`}
                onClick={() => setTeams((t) => ({ ...t, [p.id]: team === 1 ? 2 : 1 }))}
              >
                <Monogram name={p.name} photoUrl={p.avatarUrl} />
                <span className="ios-bd ios-grow ios-clip">{p.name}</span>
                <span className="ios-chev">
                  <Icon name="updown" size={15} />
                </span>
              </button>
            ))}
            {onTeam(team).length === 0 && (
              <div className="ios-row ios-bd ios-sec">No players yet</div>
            )}
          </div>
        </section>
      ))}

      <p className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
        {balanced
          ? "Tap a player to move them. Everyone then enters the score, and the result is confirmed once they all match."
          : "Each team needs 2 players. Tap a player to move them."}
      </p>
      {error && (
        <p className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
          {error}
        </p>
      )}
    </Sheet>
  );
}
