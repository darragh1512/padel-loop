"use client";

// The player list — and the one screen where a blocked person is NOT hidden.
//
// Padel is four people on one court. Blocking can take somebody out of your
// search results, your connections and your chat, but it cannot take them off
// the court on Saturday. An app that quietly drops them from this list would
// be telling the viewer something untrue about who they are about to spend an
// hour with — which manufactures exactly the confrontation blocking exists to
// prevent, with no warning, in person.
//
// So the roster stays honest and the treatment changes instead: a blocked
// player is shown muted, marked "Blocked", with no photo and no link through
// to their profile. No accidental interaction, no surprise on the day. The
// count is untouched — they really are in the game.
//
// A banner above the list gives the viewer the thing they can actually act on:
// they can leave. Nobody is removed for them, because nobody can be silently
// removed from a game other people are relying on.
//
// None of this is visible to the blocked person. They see an ordinary roster
// with the blocker in it, exactly as before.
//
// The organiser gets one extra control per row: Remove, next to everyone but
// themselves, hidden once a match result exists or the game is cancelled.
// Hiding it is only the courtesy — the remove_player_from_game database
// function is what actually refuses anyone who isn't the organiser.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Alert from "@/components/ios/Alert";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import { getBlockedIds } from "@/app/blocks";
import { removePlayer } from "@/app/games";
import type { Player } from "@/lib/types";

const ROW = { padding: "8px 16px", "--ios-inset": "68px" } as React.CSSProperties;

export default function GameRoster({
  gameId,
  players,
  maxPlayers,
  viewerId,
  createdBy,
  locked = false,
}: {
  gameId: string;
  players: Player[];
  maxPlayers: number;
  viewerId: string | null;
  // The organiser — the only viewer who sees Remove.
  createdBy?: string;
  // A match result exists or the game is cancelled: the roster is fixed.
  locked?: boolean;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  // The player the organiser tapped Remove on, waiting for confirmation.
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [removeWorking, setRemoveWorking] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getBlockedIds(viewerId).then((ids) => {
      if (active) setBlocked(ids);
    });
    return () => {
      active = false;
    };
  }, [viewerId]);

  const blockedHere = players.filter((p) => blocked.has(p.id)).length;
  const isOrganiser = viewerId != null && viewerId === createdBy;
  const canRemove = (playerId: string) => isOrganiser && !locked && playerId !== viewerId;
  const emptySlots = Math.max(maxPlayers - players.length, 0);

  async function handleRemove() {
    if (!removing || removeWorking) return;
    setRemoveWorking(true);
    setRemoveError(null);
    const result = await removePlayer(gameId, removing.id);
    if ("error" in result) {
      setRemoveError(result.error);
      setRemoveWorking(false);
      return;
    }
    setRemoving(null);
    setRemoveWorking(false);
    router.refresh(); // the spot opens and the counts update
  }

  function removeButton(playerId: string, name: string) {
    if (!canRemove(playerId)) return null;
    return (
      <button
        type="button"
        className="ios-pill-tint ios-press"
        data-destructive
        aria-label={`Remove ${name} from this game`}
        onClick={() => {
          setRemoveError(null);
          setRemoving({ id: playerId, name });
        }}
      >
        Remove
      </button>
    );
  }

  return (
    <section style={{ marginTop: 18 }}>
      <div className="ios-sect">
        <h2 className="ios-t3">Players</h2>
        <div className="ios-fn ios-sec">
          {players.length} of {maxPlayers}
        </div>
      </div>

      {blockedHere > 0 && (
        <div className="ios-card" style={{ padding: 16, marginBottom: 10 }}>
          <div className="ios-hl">Heads Up</div>
          <p className="ios-sh ios-sec" style={{ marginTop: 2 }}>
            {blockedHere === 1
              ? "Someone you’ve blocked is in this game."
              : `${blockedHere} people you’ve blocked are in this game.`}{" "}
            They haven’t been told, and nobody has been removed. You’d all be on court together.{" "}
            {isOrganiser && !locked
              ? "As the organiser, you can remove them below."
              : "You can leave the game if you’d rather not play."}
          </p>
        </div>
      )}

      <div className="ios-list">
        {players.map((p) => {
          // Muted, unlinked, no photo — but still counted and still here.
          if (blocked.has(p.id)) {
            return (
              <div key={p.id} className="ios-row" style={ROW}>
                <div className="ios-grow" style={{ display: "flex", alignItems: "center", gap: 12, opacity: 0.55 }}>
                  <Monogram name="?" />
                  <div className="ios-grow">
                    <div className="ios-bd">Blocked Player</div>
                    <div className="ios-fn ios-sec">{p.isOrganiser ? "Organiser · " : ""}You blocked them</div>
                  </div>
                </div>
                {removeButton(p.id, "this player")}
              </div>
            );
          }

          return (
            <div key={p.id} className="ios-row" style={ROW}>
              <Link
                href={`/players/${p.id}`}
                className="ios-link ios-grow"
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <Monogram name={p.name} photoUrl={p.avatarUrl} />
                <div className="ios-grow">
                  <div className="ios-bd">{p.name}</div>
                  <div className="ios-fn ios-sec">
                    {[p.isOrganiser ? "Organiser" : null, p.skill].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </Link>
              {removeButton(p.id, p.name)}
              <span className="ios-chev">
                <Icon name="chevron-right" size={13} />
              </span>
            </div>
          );
        })}

        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`open-${i}`} className="ios-row" style={ROW}>
            <div className="ios-open-spot" aria-hidden>
              <Icon name="plus" size={15} />
            </div>
            <div className="ios-bd ios-sb ios-acc">Open Spot</div>
          </div>
        ))}
      </div>

      {/* Confirm before removing — the spot can be taken straight away and the
          removed player can't come back, so this isn't undoable. */}
      <Alert
        open={removing != null}
        onClose={() => {
          if (!removeWorking) setRemoving(null);
        }}
        title={`Remove ${removing?.name ?? "this player"}?`}
        error={removeError}
        actions={[
          { label: "Keep", bold: true, disabled: removeWorking, onPress: () => setRemoving(null) },
          { label: "Remove", destructive: true, busy: removeWorking, onPress: handleRemove },
        ]}
      >
        Their spot opens up again and they’ll be told they were removed. They won’t be able to rejoin this game.
      </Alert>
    </section>
  );
}
