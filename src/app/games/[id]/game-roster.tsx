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
import PlayerAvatar from "@/components/PlayerAvatar";
import { Avatar, Button, Chip, Dialog, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { getBlockedIds } from "@/app/blocks";
import { removePlayer } from "@/app/games";
import type { Player } from "@/lib/types";

export default function GameRoster({
  gameId,
  players,
  maxPlayers,
  emptySlots,
  createdBy,
  locked = false,
}: {
  gameId: string;
  players: Player[];
  maxPlayers: number;
  emptySlots: number;
  // The organiser — the only viewer who sees Remove.
  createdBy?: string;
  // A match result exists or the game is cancelled: the roster is fixed.
  locked?: boolean;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [viewerId, setViewerId] = useState<string | null>(null);

  // The player the organiser tapped Remove on, waiting for confirmation.
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [removeWorking, setRemoveWorking] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      const ids = await getBlockedIds(uid);
      if (active) {
        setViewerId(uid);
        setBlocked(ids);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const blockedHere = players.filter((p) => blocked.has(p.id)).length;
  const isOrganiser = viewerId != null && viewerId === createdBy;
  const canRemove = (playerId: string) =>
    isOrganiser && !locked && playerId !== viewerId;

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

  // The quiet destructive pill: papel scrap, dashed naranja-d — same voice
  // as Cancel game and Leave game, just the compact size for a list row.
  function removeButton(playerId: string, name: string) {
    if (!canRemove(playerId)) return null;
    return (
      <Button
        variant="destructive"
        size="sm"
        aria-label={`Remove ${name} from this game`}
        onClick={() => {
          setRemoveError(null);
          setRemoving({ id: playerId, name });
        }}
      >
        Remove
      </Button>
    );
  }

  return (
    <>
      <SectionLabel>
        Players · {players.length} of {maxPlayers}
      </SectionLabel>

      {blockedHere > 0 && (
        <div className="pl-card border-2 border-dashed border-naranja-d px-4 py-3 mb-2">
          <div className="t-mono text-micro tracking-[0.14em] text-naranja-d">
            Heads up
          </div>
          <p className="text-label font-medium text-tinta/75 mt-1">
            {blockedHere === 1
              ? "Someone you've blocked is in this game."
              : `${blockedHere} people you've blocked are in this game.`}{" "}
            They haven&rsquo;t been told, and nobody has been removed — you&rsquo;d
            all be on court together.{" "}
            {isOrganiser && !locked
              ? "As the organiser, you can remove them below."
              : "Leave the game below if you'd rather not play."}
          </p>
        </div>
      )}

      <div className="pl-card px-4 py-1.5">
        {players.map((p) => {
          const isBlocked = blocked.has(p.id);

          // Muted, unlinked, no photo — but still counted and still here.
          if (isBlocked) {
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 py-2.5 border-b border-tinta/15 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0 opacity-55">
                  <Avatar size="md" />
                  <div className="min-w-0">
                    <div className="text-body font-extrabold text-tinta/70">
                      Blocked player
                    </div>
                    <div className="t-mono text-micro tracking-[0.1em] text-tinta/55">
                      {p.isOrganiser ? "Organiser · " : ""}You blocked them
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="opacity-55">
                    <Chip>Level {p.level.toFixed(1)}</Chip>
                  </span>
                  {removeButton(p.id, "this player")}
                </div>
              </div>
            );
          }

          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 py-2.5 border-b border-tinta/15 last:border-0"
            >
              <Link
                href={`/players/${p.id}`}
                className="flex items-center gap-3 min-w-0 rounded-field active:opacity-70 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
              >
                <PlayerAvatar
                  userId={p.id}
                  avatarUrl={p.avatarUrl}
                  name={p.name}
                  className="size-9 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-body font-extrabold text-tinta truncate">
                    {p.name}
                  </div>
                  <div className="t-mono text-micro tracking-[0.1em] text-tinta/70">
                    {p.isOrganiser ? "Organiser · " : ""}
                    {p.gamesPlayed ?? 0} games
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <Chip>Level {p.level.toFixed(1)}</Chip>
                {removeButton(p.id, p.name)}
              </div>
            </div>
          );
        })}

        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`s${i}`} className="flex items-center gap-3 py-2.5">
            <Avatar size="md" />
            <div>
              <div className="text-body font-extrabold text-naranja-d">+ you?</div>
              <div className="text-label font-medium text-tinta/45">
                This spot is really open
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm before removing — the spot can be taken straight away and
          the removed player can't come back, so this isn't undoable. Same
          stapled-poster Dialog as Cancel game and Leave game. */}
      <Dialog
        open={removing != null}
        onClose={() => !removeWorking && setRemoving(null)}
        title={`Remove ${removing?.name ?? "this player"} from this game?`}
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          Their spot opens up again and they&apos;ll be told they were removed.
          They won&apos;t be able to rejoin this game.
        </p>

        <div className="flex gap-2.5 mt-5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setRemoving(null)}
            disabled={removeWorking}
          >
            Keep them
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleRemove}
            loading={removeWorking}
          >
            Remove
          </Button>
        </div>

        <p
          aria-live="polite"
          className={`text-center text-label font-semibold text-naranja-d mt-3 ${
            removeError ? "" : "hidden"
          }`}
        >
          {removeError}
        </p>
      </Dialog>
    </>
  );
}
