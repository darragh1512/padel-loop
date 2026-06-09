// The FIRST screen: the list of nearby games.
// It now reads REAL games from the Supabase database (see getGames in games.ts).

import Link from "next/link";
import { getGames, formatGameTime } from "./games";

// Always fetch fresh data from the database on each visit, so newly added
// or updated games show up right away.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Ask the database for all games, sorted by game_time. We "await" because
  // fetching from the database takes a moment.
  const games = await getGames();

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      {/* Page heading */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Padel Loop</h1>
        <p className="text-zinc-500">Games near you</p>
      </header>

      {/* The list of games. We loop over each game and draw a card for it. */}
      <ul className="flex flex-col gap-3">
        {games.map((game) => {
          // How many spots are still open = total spots minus those taken.
          const spotsOpen = game.max_players - game.current_players;

          return (
            <li key={game.id}>
              {/* The whole card is a link to that game's detail screen. */}
              <Link
                href={`/games/${game.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-zinc-900">{game.venue}</h2>
                    <p className="text-sm text-zinc-500">{game.location}</p>
                  </div>
                  {/* A small coloured badge showing the level. */}
                  <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    {game.skill_level}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-700">
                    {formatGameTime(game.game_time)}
                  </span>
                  <span className="text-zinc-500">
                    {spotsOpen} {spotsOpen === 1 ? "spot" : "spots"} left
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
