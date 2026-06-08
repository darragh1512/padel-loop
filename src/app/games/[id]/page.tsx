// This is the SECOND screen: the details of ONE game.
// It lives at an address like "/games/1" or "/games/2".
// The "[id]" folder name means "this part of the address changes" —
// whatever number is in the address gets handed to us as "id".

import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame } from "../../games";
import JoinButton from "./join-button";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Read the id out of the web address (e.g. "1" from "/games/1").
  const { id } = await params;

  // Look that game up in our example list.
  const game = getGame(id);

  // If someone visits a game that doesn't exist, show the "not found" page.
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
        <p className="text-zinc-500">
          {game.area} · {game.distanceKm} km away
        </p>
      </header>

      {/* A simple box listing the key facts. */}
      <dl className="mt-6 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex justify-between">
          <dt className="text-zinc-500">When</dt>
          <dd className="font-medium text-zinc-900">{game.time}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Level</dt>
          <dd className="font-medium text-zinc-900">{game.level}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Spots left</dt>
          <dd className="font-medium text-zinc-900">{game.spotsOpen}</dd>
        </div>
      </dl>

      {/* The Join button (the interactive piece). */}
      <div className="mt-6">
        <JoinButton />
      </div>
    </main>
  );
}
