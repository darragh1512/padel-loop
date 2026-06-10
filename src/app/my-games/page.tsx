"use client";
// This screen runs in the visitor's browser. It shows the logged-in person
// two lists: the games they've JOINED and the games they've CREATED. It lives
// at "/my-games". If nobody is logged in, we send them to the login page.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  formatGameTime,
  getGamesCreatedBy,
  getGamesJoinedBy,
  type Game,
} from "../games";

export default function MyGamesPage() {
  // "router" lets us send the user to another page (e.g. to log in).
  const router = useRouter();

  // "loading" is true until we've checked the login and fetched the games.
  const [loading, setLoading] = useState(true);
  // The two lists of games we'll show.
  const [joined, setJoined] = useState<Game[]>([]);
  const [created, setCreated] = useState<Game[]>([]);

  // When the page opens: confirm someone is logged in, then load both lists.
  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }

      // Fetch both lists at the same time to keep the page snappy.
      const [joinedGames, createdGames] = await Promise.all([
        getGamesJoinedBy(data.user.id),
        getGamesCreatedBy(data.user.id),
      ]);

      setJoined(joinedGames);
      setCreated(createdGames);
      setLoading(false);
    }

    load();
  }, [router]);

  // While we confirm the login and load the games, show a quiet placeholder.
  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
        <p className="text-zinc-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      {/* Back to the list of games. */}
      <Link
        href="/"
        className="inline-block text-sm text-emerald-700 hover:underline"
      >
        ← Back to games
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-bold text-zinc-900">My games</h1>
        <p className="text-zinc-500">Games you&apos;ve joined and created.</p>
      </header>

      {/* Section 1: games this person has joined. */}
      <GameSection
        title="Games I've joined"
        games={joined}
        emptyText="You haven't joined any games yet."
      />

      {/* Section 2: games this person has created. */}
      <GameSection
        title="Games I've created"
        games={created}
        emptyText="You haven't created any games yet."
      />
    </main>
  );
}

// One titled section with a list of game cards (or a friendly message if the
// list is empty). Used for both "joined" and "created".
function GameSection({
  title,
  games,
  emptyText,
}: {
  title: string;
  games: Game[];
  emptyText: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900">{title}</h2>

      {games.length === 0 ? (
        <p className="text-zinc-500">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {games.map((game) => (
            <li key={game.id}>
              {/* The whole card links to that game's detail screen. */}
              <Link
                href={`/games/${game.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900">
                      {game.venue}
                    </h3>
                    <p className="text-sm text-zinc-500">{game.location}</p>
                  </div>
                  {/* A small coloured badge showing the level. */}
                  <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    {game.skill_level}
                  </span>
                </div>

                <div className="mt-3 text-sm text-zinc-700">
                  {formatGameTime(game.game_time)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
