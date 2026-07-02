"use client";
// The interactive Join / Leave control for a game. Visually identical to the
// design's PrimaryButton (same classes) — it only adds behaviour: it checks
// who is logged in, reads whether you're already in this game, and writes to
// the game_players table. Logged-out taps go to the login page.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getGamePlayers, joinGame, leaveGame } from "../../games";

export default function JoinGame({
  gameId,
  perHead,
}: {
  gameId: string;
  perHead: number;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-read who's logged in and whether they're already in this game.
  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id ?? null;
    setUserId(uid);
    const players = await getGamePlayers(gameId);
    setJoined(uid != null && players.includes(uid));
  }, [gameId]);

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  async function handleJoin() {
    if (!userId) {
      router.push("/login");
      return;
    }
    setWorking(true);
    setError(null);
    const result = await joinGame(gameId, userId);
    if ("error" in result) {
      setError("Couldn't join that game. Please try again.");
      setWorking(false);
      return;
    }
    await refresh();
    setWorking(false);
    router.refresh(); // re-render the server page so the players list updates
  }

  async function handleLeave() {
    if (!userId) return;
    setWorking(true);
    setError(null);
    const result = await leaveGame(gameId, userId);
    if ("error" in result) {
      setError("Couldn't leave that game. Please try again.");
      setWorking(false);
      return;
    }
    await refresh();
    setWorking(false);
    router.refresh();
  }

  const label = loading
    ? "…"
    : joined
      ? "Leave game"
      : `Join game · €${perHead.toFixed(0)}`;

  return (
    <>
      <button
        type="button"
        onClick={joined ? handleLeave : handleJoin}
        disabled={working || loading}
        className="block w-full h-12 text-center bg-accent text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-70"
      >
        {working ? "…" : label}
      </button>
      {error && (
        <p className="text-center text-[13px] text-danger mt-2">{error}</p>
      )}
    </>
  );
}
