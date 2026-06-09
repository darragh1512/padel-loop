// The SECOND screen: the details of ONE game, read from the Supabase database.
// It lives at an address like "/games/1" or "/games/2".

import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame } from "../../games";
import GameDetail from "./game-detail";

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

      {/* The facts box + Join button. This part can update on screen when
          someone joins, so it lives in its own interactive component. */}
      <GameDetail game={game} />
    </main>
  );
}
