"use client";
// The interactive Join / Leave control for a game. It checks who is logged in,
// reads whether you're already in this game, and writes to the game_players
// table. Logged-out taps go to the login page.
//
// Sage belongs to joining — the screen's primary action. Leaving is the quiet
// secondary voice, never the loudest thing on the page.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Skeleton } from "@/components/ui";
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
      setError("Couldn't take that spot. Give it another try.");
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
      setError("Couldn't give up your spot. Give it another try.");
      setWorking(false);
      return;
    }
    await refresh();
    setWorking(false);
    router.refresh();
  }

  // While we check membership, hold the button's space with a matching
  // skeleton so the page doesn't jump when the real control arrives.
  if (loading) {
    return <Skeleton className="h-12 rounded-pill" />;
  }

  return (
    <>
      <Button
        variant={joined ? "secondary" : "primary"}
        onClick={joined ? handleLeave : handleJoin}
        loading={working}
      >
        {joined ? "Leave game" : `Join game · €${perHead.toFixed(0)}`}
      </Button>
      <p
        aria-live="polite"
        className={`text-center text-label text-danger mt-2 ${error ? "" : "hidden"}`}
      >
        {error}
      </p>
    </>
  );
}
