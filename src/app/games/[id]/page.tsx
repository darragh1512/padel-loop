// The SECOND screen: the details of ONE game, read from the Supabase database.
// It lives at an address like "/games/1" or "/games/2".

import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame, formatGameTime } from "../../games";
import JoinButton from "./join-button";

// Always fetch fresh data from the database on each visit.
export const dynamic = "force-dynamic";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Read the id out of the web address (e.g. "1" from "/games/1").
  const { id } = await params;

  // Ask the database for this one game.
  const game = await getGame(id);

  // If no game with that id exists, show the "not found" page.
  if (!game) {
    notFound();
  }

  // How many spots are still open.
  const spotsOpen = game.max_players - game.current_players;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      {/* The "Back" link returns to the list screen at "/". */}
      <Link
        href="/"
        className="inline-block text-sm text-emerald-700 hover:underline"
      >
        ← Back to games
      </Link>

      {/* The game's main details */}
      <header className="mt-4">
        <h1 className="text-2xl font-bold text-zinc-900">{game.venue}</h1>
        <p className="text-zinc-500">{game.location}</p>
      </header>

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
        <JoinButton />
      </div>
    </main>
  );
}
