"use client";
// The line above means: this piece runs in the visitor's browser, so it can
// react to taps (Join / Leave) and update what's on screen instantly.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatGameTime,
  getGamePlayerProfiles,
  joinGame,
  leaveGame,
  type Game,
  type GamePlayer,
} from "../../games";
import { supabase } from "@/lib/supabaseClient";

// This shows the game's facts (When, Level, Spots left) AND the Join/Leave
// button. The number of players, and whether YOU are in the game, come from
// the game_players table.
export default function GameDetail({ game }: { game: Game }) {
  const router = useRouter();

  // Who is logged in (their user id), or null if nobody is.
  const [userId, setUserId] = useState<string | null>(null);
  // The logged-in person's email — used as a fallback name for THEIR own row
  // if they haven't set a profile name yet (we can only see our own email).
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // The people currently in this game, each with their name (if they have one).
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  // Whether the logged-in user is one of those players.
  const [joined, setJoined] = useState(false);

  // "loading" is the first check (who's logged in / who's in the game).
  const [loading, setLoading] = useState(true);
  // "working" is true while a Join or Leave is being saved.
  const [working, setWorking] = useState(false);
  // A clear message to show if something goes wrong.
  const [error, setError] = useState<string | null>(null);

  // Re-reads the latest state: who's logged in, who's in this game, and
  // whether that includes you. Called on first load and after Join/Leave.
  const refresh = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData.user?.id ?? null;
    setUserId(currentUserId);
    setUserEmail(userData.user?.email ?? null);

    const gamePlayers = await getGamePlayerProfiles(game.id);
    setPlayers(gamePlayers);
    setJoined(
      currentUserId !== null &&
        gamePlayers.some((player) => player.user_id === currentUserId),
    );
  }, [game.id]);

  useEffect(() => {
    // "active" guards against updating state if the user navigates away before
    // the database answers.
    let active = true;

    (async () => {
      await refresh();
      if (active) {
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [refresh]);

  // Spots left = total spots minus how many have joined.
  const spotsOpen = game.max_players - players.length;
  const isFull = spotsOpen <= 0;

  // Works out what to display for one player. Prefer their profile name; if
  // they haven't set one, show their email (only possible for your own row),
  // otherwise a friendly placeholder.
  function displayName(player: GamePlayer): string {
    if (player.name && player.name.trim() !== "") {
      return player.name;
    }
    if (player.user_id === userId && userEmail) {
      return userEmail;
    }
    return "Unknown player";
  }

  // Runs when the Join button is tapped.
  async function handleJoin() {
    // Not logged in? Send them to the login page first.
    if (!userId) {
      router.push("/login");
      return;
    }

    setWorking(true);
    setError(null);

    const result = await joinGame(game.id, userId);
    if ("error" in result) {
      setError("Sorry, we couldn't add you to this game. Please try again.");
      setWorking(false);
      return;
    }

    await refresh(); // update the count and switch to the "You're in" view
    setWorking(false);
  }

  // Runs when the Leave button is tapped.
  async function handleLeave() {
    if (!userId) {
      return;
    }

    setWorking(true);
    setError(null);

    const result = await leaveGame(game.id, userId);
    if ("error" in result) {
      setError(
        "Sorry, we couldn't remove you from this game. Please try again.",
      );
      setWorking(false);
      return;
    }

    await refresh(); // update the count and switch back to the Join view
    setWorking(false);
  }

  return (
    <>
      {/* A simple box listing the key facts. */}
      <dl className="mt-6 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex justify-between">
          <dt className="text-zinc-500">When</dt>
          <dd className="font-medium text-zinc-900">
            {formatGameTime(game.game_time)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Level</dt>
          <dd className="font-medium text-zinc-900">{game.skill_level}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Spots left</dt>
          <dd className="font-medium text-zinc-900">
            {loading ? "…" : spotsOpen}
          </dd>
        </div>
      </dl>

      {/* The list of players who have joined, shown by name. */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-500">Players</h2>
        {loading ? (
          <p className="mt-2 text-zinc-400">…</p>
        ) : players.length === 0 ? (
          <p className="mt-2 text-zinc-500">No one has joined yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {players.map((player) => (
              <li
                key={player.user_id}
                className="flex items-center gap-2 font-medium text-zinc-900"
              >
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700"
                >
                  {displayName(player).charAt(0).toUpperCase()}
                </span>
                {displayName(player)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The interactive Join / Leave area. */}
      <div className="mt-6">
        {loading ? (
          // Still checking — show a quiet placeholder so nothing jumps around.
          <button
            disabled
            className="w-full cursor-default rounded-xl bg-zinc-100 px-5 py-3 font-medium text-zinc-400"
          >
            Loading…
          </button>
        ) : joined ? (
          // You're already in: confirmation + a Leave button.
          <div className="flex flex-col gap-2">
            <div className="rounded-xl bg-emerald-100 px-5 py-3 text-center font-medium text-emerald-700">
              ✓ You&apos;re in! See you on court.
            </div>
            <button
              onClick={handleLeave}
              disabled={working}
              className="w-full rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working ? "Leaving…" : "Leave game"}
            </button>
          </div>
        ) : isFull ? (
          // No spots left: a greyed-out, unclickable "Game full" button.
          <button
            disabled
            className="w-full cursor-not-allowed rounded-xl bg-zinc-200 px-5 py-3 font-medium text-zinc-500"
          >
            Game full
          </button>
        ) : (
          // Open spot: the Join button. If the user isn't logged in, tapping
          // this sends them to the login page (handled in handleJoin).
          <button
            onClick={handleJoin}
            disabled={working}
            className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? "Joining…" : "Join this game"}
          </button>
        )}

        {/* If something failed, show a clear message under the button. */}
        {error && (
          <p className="mt-2 text-center text-sm text-red-600">{error}</p>
        )}
      </div>
    </>
  );
}
