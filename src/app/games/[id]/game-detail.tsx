"use client";
// The line above means: this piece runs in the visitor's browser, so it can
// react to taps (the Join button) and update what's on screen instantly.

import { useState } from "react";
import { formatGameTime, joinGame, type Game } from "../../games";

// This shows the game's facts (When, Level, Spots left) AND the Join button.
// They live together so that when someone joins, both the "Spots left" number
// and the button can update at the same time.
export default function GameDetail({ game }: { game: Game }) {
  // "currentPlayers" starts at the number from the database, but we keep our
  // own copy here so we can bump it up the instant someone joins.
  const [currentPlayers, setCurrentPlayers] = useState(game.current_players);

  // "status" tracks what the button should be doing right now.
  //  idle    = waiting to be tapped
  //  joining = we're talking to the database, please wait
  //  joined  = success, you're in
  //  error   = something went wrong, let them try again
  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">(
    "idle",
  );

  // How many spots are still open, based on our live count.
  const spotsOpen = game.max_players - currentPlayers;
  const isFull = spotsOpen <= 0;

  // Runs when the Join button is tapped.
  async function handleJoin() {
    setStatus("joining");

    const result = await joinGame(game.id);

    if ("newCount" in result) {
      // Success: show the new number on screen and confirm.
      setCurrentPlayers(result.newCount);
      setStatus("joined");
    } else if ("full" in result) {
      // Someone else took the last spot just before us — show it as full.
      setCurrentPlayers(game.max_players);
      setStatus("idle");
    } else {
      // Database problem — let them try again.
      setStatus("error");
    }
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
          <dd className="font-medium text-zinc-900">{spotsOpen}</dd>
        </div>
      </dl>

      {/* The Join button (the interactive piece). */}
      <div className="mt-6">
        {isFull ? (
          // No spots left: a greyed-out, unclickable "Game full" button.
          <button
            disabled
            className="w-full cursor-not-allowed rounded-xl bg-zinc-200 px-5 py-3 font-medium text-zinc-500"
          >
            Game full
          </button>
        ) : status === "joined" ? (
          // After joining: a confirmation instead of the button.
          <div className="rounded-xl bg-emerald-100 px-5 py-3 text-center font-medium text-emerald-700">
            ✓ You&apos;re in! See you on court.
          </div>
        ) : (
          // The normal Join button (also shown after an error, to retry).
          <button
            onClick={handleJoin}
            disabled={status === "joining"}
            className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "joining" ? "Joining…" : "Join this game"}
          </button>
        )}

        {/* If joining failed, show a friendly message under the button. */}
        {status === "error" && (
          <p className="mt-2 text-center text-sm text-red-600">
            Sorry, that didn&apos;t work. Please try again.
          </p>
        )}
      </div>
    </>
  );
}
