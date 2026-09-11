"use client";
// Owner-only controls for a game. It checks who is logged in (same client-side
// Supabase auth the Join button uses) and only renders the "Edit game" /
// "Cancel game" buttons when the logged-in user is the game's creator
// (game.created_by). Everyone else — including logged-out visitors — sees
// nothing.
//
// "Edit game" opens the edit form. "Cancel game" first asks for confirmation,
// then marks the game cancelled in Supabase (it never deletes the row) and
// returns the creator to the refreshed detail page. Both speak quietly:
// sage stays reserved for the page's Join action, and destructive actions
// are always terracotta text, never a filled button.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { cancelGame, setGameClosed, stopRecurring } from "../../games";

export default function CreatorActions({
  gameId,
  createdBy,
  recursWeekly = false,
  seriesId,
  isManuallyClosed = false,
}: {
  gameId: string;
  createdBy?: string;
  recursWeekly?: boolean;
  seriesId?: string;
  // Whether the creator has already stopped new joins by hand.
  isManuallyClosed?: boolean;
}) {
  const router = useRouter();
  const [isCreator, setIsCreator] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);

  // "Stop repeating" has its own confirm dialog + working/error state, so a
  // failure there never tangles with the cancel dialog's message.
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [stopWorking, setStopWorking] = useState(false);
  const [stopError, setStopError] = useState(false);

  // Open/close to new joins. Held locally as well as passed in so the
  // button flips the moment it succeeds, before the page refetches.
  const [closed, setClosed] = useState(isManuallyClosed);
  const [closeWorking, setCloseWorking] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!createdBy) return;
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (active) setIsCreator(uid != null && uid === createdBy);
    })();
    return () => {
      active = false;
    };
  }, [createdBy]);

  if (!isCreator) return null;

  // Flip the game between open and closed. Works in BOTH directions: a
  // creator who closed a game because the last spot went to a friend can
  // reopen it if that falls through.
  async function handleToggleClosed() {
    if (closeWorking) return;
    setCloseWorking(true);
    setCloseError(null);

    const next = !closed;
    const result = await setGameClosed(gameId, next);

    if ("ok" in result) {
      setClosed(next);
      router.refresh(); // re-render the page so Join picks the change up
    } else {
      setCloseError(result.error);
    }
    setCloseWorking(false);
  }

  async function handleCancel() {
    if (working) return;
    setWorking(true);
    setError(false);

    const result = await cancelGame(gameId);
    if ("ok" in result) {
      setConfirming(false);
      router.push(`/games/${gameId}`);
      router.refresh(); // re-read the row so the detail page reflects the change
    } else {
      setError(true);
      setWorking(false);
    }
  }

  // Stop the weekly repeat for the whole chain. The root game tags itself
  // with its own id as series_id, so seriesId is normally set; gameId is the
  // fallback for the root before a refresh has re-read the row.
  async function handleStopRecurring() {
    if (stopWorking) return;
    setStopWorking(true);
    setStopError(false);

    const result = await stopRecurring(seriesId ?? gameId);
    if ("ok" in result) {
      setConfirmingStop(false);
      setStopWorking(false);
      router.refresh(); // re-read the row so the "Repeats weekly" chip clears
    } else {
      setStopError(true);
      setStopWorking(false);
    }
  }

  return (
    <>
      <div className="flex gap-2.5 mt-4">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => router.push(`/games/${gameId}/edit`)}
        >
          Edit game
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={() => {
            setError(false);
            setConfirming(true);
          }}
        >
          Cancel game
        </Button>
      </div>

      {/* Stop / allow new joins. For when the last spot went to someone
          outside the app — and for putting the game back on Discover if
          that falls through. It does NOT change the player count. */}
      <Button
        variant="secondary"
        className="mt-2.5"
        onClick={handleToggleClosed}
        loading={closeWorking}
        aria-pressed={closed}
      >
        {closed ? "Allow new players" : "Stop new players joining"}
      </Button>
      <p className="text-label font-medium text-tinta/55 text-center mt-1.5">
        {closed
          ? "This game is closed to new players. The spots left are unchanged."
          : "Closes the game to new players without changing the spots left."}
      </p>
      <p
        aria-live="polite"
        className={`text-center text-label font-semibold text-naranja-d mt-1.5 ${
          closeError ? "" : "hidden"
        }`}
      >
        {closeError}
      </p>

      {/* Stop repeating — only on a recurring game. Quiet secondary voice;
          destructive stays reserved for Cancel. */}
      {recursWeekly && (
        <Button
          variant="secondary"
          className="mt-2.5"
          onClick={() => {
            setStopError(false);
            setConfirmingStop(true);
          }}
        >
          Stop repeating
        </Button>
      )}

      <Dialog
        open={confirmingStop}
        onClose={() => !stopWorking && setConfirmingStop(false)}
        title="Stop the weekly repeat?"
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          This week&apos;s game stays as it is — it just won&apos;t roll into
          next week any more.
        </p>

        <div className="flex gap-2.5 mt-5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setConfirmingStop(false)}
            disabled={stopWorking}
          >
            Keep repeating
          </Button>
          <Button
            className="flex-1"
            onClick={handleStopRecurring}
            loading={stopWorking}
          >
            Stop repeating
          </Button>
        </div>

        <p
          aria-live="polite"
          className={`text-center text-label font-semibold text-naranja-d mt-3 ${stopError ? "" : "hidden"}`}
        >
          Couldn&apos;t stop the repeat. Please try again.
        </p>
      </Dialog>

      {/* Confirmation — a centred card (confirmations stay centred; bottom
          sheets are for everything else), the single ambient shadow. */}
      <Dialog
        open={confirming}
        onClose={() => !working && setConfirming(false)}
        title="Cancel this game?"
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          Everyone in the game will see it&apos;s off. This can&apos;t be undone.
          {recursWeekly && <> This also ends the weekly repeat.</>}
        </p>

        <div className="flex gap-2.5 mt-5">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setConfirming(false)}
            disabled={working}
          >
            Keep game
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleCancel}
            loading={working}
          >
            Cancel game
          </Button>
        </div>

        <p
          aria-live="polite"
          className={`text-center text-label font-semibold text-naranja-d mt-3 ${error ? "" : "hidden"}`}
        >
          Couldn&apos;t cancel that game. Please try again.
        </p>
      </Dialog>
    </>
  );
}
