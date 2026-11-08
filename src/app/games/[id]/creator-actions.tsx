"use client";
// The organiser's controls for a game: edit, open or close to new players, stop
// the weekly repeat, and cancel. Once a game is cancelled, the one control left
// is deleting it. They appear in the game's ⋯ menu, only for the game's creator.
//
// Cancelling first asks for confirmation, then marks the game cancelled (it
// never deletes the row). Deleting also asks first, and only a cancelled game
// with no match result can be deleted. The database is what actually enforces
// who may do either.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@/components/ios/Alert";
import { cancelGame, deleteCancelledGame, setGameClosed, stopRecurring } from "../../games";

export type MenuItem = { label: string; onPress: () => void; destructive?: boolean };

export function useCreatorActions({
  gameId,
  recursWeekly = false,
  seriesId,
  isManuallyClosed = false,
  hasResult = false,
  onMessage,
}: {
  gameId: string;
  recursWeekly?: boolean;
  seriesId?: string;
  // Whether the creator has already stopped new joins by hand.
  isManuallyClosed?: boolean;
  // A match result means ratings depend on this game, so it can never be deleted.
  hasResult?: boolean;
  onMessage: (text: string) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);

  // "Stop repeating" has its own confirm + working/error state, so a failure
  // there never tangles with the cancel alert's message.
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [stopWorking, setStopWorking] = useState(false);
  const [stopError, setStopError] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteWorking, setDeleteWorking] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (deleteWorking) return;
    setDeleteWorking(true);
    setDeleteError(null);
    const result = await deleteCancelledGame(gameId);
    if ("ok" in result) {
      // The game is gone, so there is no page to come back to.
      router.replace("/chat");
      return;
    }
    setDeleteError(result.error);
    setDeleteWorking(false);
  }

  // Flip the game between open and closed. Works in BOTH directions: a creator
  // who closed a game because the last spot went to a friend can reopen it if
  // that falls through. It does NOT change the player count.
  async function handleToggleClosed() {
    const next = !isManuallyClosed;
    const result = await setGameClosed(gameId, next);
    if ("ok" in result) {
      onMessage(next ? "Closed to New Players" : "Open to New Players");
      router.refresh();
    } else {
      onMessage(result.error);
    }
  }

  async function handleCancel() {
    if (working) return;
    setWorking(true);
    setError(false);
    const result = await cancelGame(gameId);
    if ("ok" in result) {
      setConfirming(false);
      setWorking(false);
      router.refresh(); // re-read the row so the page shows it's cancelled
    } else {
      setError(true);
      setWorking(false);
    }
  }

  // Stop the weekly repeat for the whole chain. The root game tags itself with
  // its own id as series_id, so seriesId is normally set; gameId is the fallback
  // for the root before a refresh has re-read the row.
  async function handleStopRecurring() {
    if (stopWorking) return;
    setStopWorking(true);
    setStopError(false);
    const result = await stopRecurring(seriesId ?? gameId);
    if ("ok" in result) {
      setConfirmingStop(false);
      setStopWorking(false);
      router.refresh();
    } else {
      setStopError(true);
      setStopWorking(false);
    }
  }

  const items: MenuItem[] = [
    { label: "Edit Game", onPress: () => router.push(`/games/${gameId}/edit`) },
    { label: isManuallyClosed ? "Allow New Players" : "Stop New Players", onPress: handleToggleClosed },
    ...(recursWeekly
      ? [{ label: "Stop Repeating", onPress: () => { setStopError(false); setConfirmingStop(true); } }]
      : []),
    { label: "Cancel Game", destructive: true, onPress: () => { setError(false); setConfirming(true); } },
  ];

  // For a cancelled game.
  const cancelledItems: MenuItem[] = hasResult
    ? []
    : [{ label: "Delete Game", destructive: true, onPress: () => { setDeleteError(null); setConfirmingDelete(true); } }];

  const alerts = (
    <>
      <Alert
        open={confirmingDelete}
        onClose={() => {
          if (!deleteWorking) setConfirmingDelete(false);
        }}
        title="Delete This Game?"
        error={deleteError}
        actions={[
          { label: "Keep", bold: true, disabled: deleteWorking, onPress: () => setConfirmingDelete(false) },
          { label: "Delete", destructive: true, busy: deleteWorking, onPress: handleDelete },
        ]}
      >
        The game and its chat will be removed for everyone. This can’t be undone.
      </Alert>
      <Alert
        open={confirmingStop}
        onClose={() => {
          if (!stopWorking) setConfirmingStop(false);
        }}
        title="Stop the Weekly Repeat?"
        error={stopError ? "Couldn’t stop the repeat. Try again." : null}
        actions={[
          { label: "Keep", disabled: stopWorking, onPress: () => setConfirmingStop(false) },
          { label: "Stop", bold: true, busy: stopWorking, onPress: handleStopRecurring },
        ]}
      >
        This week’s game stays as it is. It just won’t roll into next week any more.
      </Alert>
      <Alert
        open={confirming}
        onClose={() => {
          if (!working) setConfirming(false);
        }}
        title="Cancel This Game?"
        error={error ? "Couldn’t cancel the game. Try again." : null}
        actions={[
          { label: "Keep Game", bold: true, disabled: working, onPress: () => setConfirming(false) },
          { label: "Cancel Game", destructive: true, busy: working, onPress: handleCancel },
        ]}
      >
        Everyone in the game will see it’s off. This can’t be undone.
        {recursWeekly && " This also ends the weekly repeat."}
      </Alert>
    </>
  );

  return { items, cancelledItems, alerts };
}
