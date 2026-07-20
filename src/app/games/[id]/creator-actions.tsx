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
import { cancelGame } from "../../games";

export default function CreatorActions({
  gameId,
  createdBy,
}: {
  gameId: string;
  createdBy?: string;
}) {
  const router = useRouter();
  const [isCreator, setIsCreator] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);

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

      {/* Confirmation — a centred card (confirmations stay centred; bottom
          sheets are for everything else), the single ambient shadow. */}
      <Dialog
        open={confirming}
        onClose={() => !working && setConfirming(false)}
        title="Cancel this game?"
      >
        <p className="text-label font-medium text-tinta/70 mt-2">
          Everyone in the game will see it&apos;s off. This can&apos;t be undone.
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
