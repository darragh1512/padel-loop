import BottomNav from "@/components/BottomNav";
import GameFilters from "@/components/GameFilters";
import { getGames } from "@/lib/data";

// Always read fresh data on each request. The player count ("spots open") is
// computed from the live game_players table, so this page must NOT be cached —
// otherwise joining a game would still show the old count until the cache
// expired. (See JoinGame, which also calls router.refresh() after a join.)
export const dynamic = "force-dynamic";

// Discover — the joinable-games list with its filter chips (Level, Area, Time,
// Connections only). GameFilters hides games the user has already joined or
// created (excludeOwnGames) so this only shows games they can actually join.
export default async function DiscoverPage() {
  const games = await getGames();

  return (
    <main className="px-5 pt-6 relative">
      <h1 className="font-display text-display-md text-ink mt-2">Discover</h1>
      <p className="text-label text-ink-secondary mt-1">
        Open games near you — find one and jump in.
      </p>

      <GameFilters games={games} sectionLabel="Games near you" excludeOwnGames />

      <BottomNav />
    </main>
  );
}
