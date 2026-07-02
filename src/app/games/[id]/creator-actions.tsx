"use client";
// Owner-only controls for a game. It checks who is logged in (same client-side
// Supabase auth the Join button uses) and only renders the "Edit game" /
// "Cancel game" buttons when the logged-in user is the game's creator
// (game.created_by). Everyone else — including logged-out visitors — sees
// nothing.
//
// "Edit game" opens the edit form. "Cancel game" first asks for confirmation,
// then marks the game cancelled in Supabase (it never deletes the row) and
// returns the creator to the refreshed detail page.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
        <button
          type="button"
          onClick={() => router.push(`/games/${gameId}/edit`)}
          className="flex-1 h-12 text-center bg-accent text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          Edit game
        </button>
        <button
          type="button"
          onClick={() => {
            setError(false);
            setConfirming(true);
          }}
          className="flex-1 h-12 text-center bg-transparent text-danger font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          Cancel game
        </button>
      </div>

      {/* Confirmation dialog — a centred card (confirmations stay centred;
          bottom sheets are for everything else), single ambient shadow. */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-5 pb-6 sm:pb-0">
          <div
            className="absolute inset-0 bg-[rgba(28,27,23,0.4)]"
            onClick={() => !working && setConfirming(false)}
          />
          <div className="relative w-full max-w-sm p-5 bg-bone border border-line rounded-(--radius-card) shadow-(--shadow-sheet) pl-rise">
            <h2 className="font-display text-[22px] tracking-tight text-ink">Cancel this game?</h2>
            <p className="text-[13px] text-ink-secondary mt-1.5">This can&apos;t be undone.</p>

            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={working}
                className="flex-1 h-12 text-center bg-sunken text-ink font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-60"
              >
                Keep game
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={working}
                className="flex-1 h-12 text-center bg-danger text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-70"
              >
                {working ? "Cancelling…" : "Cancel game"}
              </button>
            </div>

            {error && (
              <p className="text-center text-[13px] text-danger mt-3">
                Couldn&apos;t cancel that game. Please try again.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
