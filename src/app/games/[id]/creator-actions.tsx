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
          className="flex-1 text-center bg-vivid text-white font-semibold text-sm rounded-(--radius-btn) py-2.5 pl-cta-shadow active:scale-[0.98] transition-transform"
        >
          Edit game
        </button>
        <button
          type="button"
          onClick={() => {
            setError(false);
            setConfirming(true);
          }}
          className="flex-1 text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-2.5 active:scale-[0.98] transition-transform"
        >
          Cancel game
        </button>
      </div>

      {/* Confirmation overlay — themed to match the rest of the app rather than
          using the browser's plain confirm box. */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-5 pb-6 sm:pb-0">
          <div
            className="absolute inset-0 bg-navy/70 backdrop-blur-sm"
            onClick={() => !working && setConfirming(false)}
          />
          <div className="pl-card relative w-full max-w-sm p-5 pl-rise">
            <h2 className="font-display font-bold text-base text-off">Cancel this game?</h2>
            <p className="text-[13px] text-dim font-light mt-1.5">This can&apos;t be undone.</p>

            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={working}
                className="flex-1 text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-2.5 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                Keep game
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={working}
                className="flex-1 text-center bg-[#c2434a] text-white font-semibold text-sm rounded-(--radius-btn) py-2.5 active:scale-[0.98] transition-transform disabled:opacity-70"
              >
                {working ? "Cancelling…" : "Cancel game"}
              </button>
            </div>

            {error && (
              <p className="text-center text-[12px] text-[#d98080] mt-3">
                Couldn&apos;t cancel that game. Please try again.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
