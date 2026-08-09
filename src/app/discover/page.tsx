import BottomNav from "@/components/BottomNav";
import GameFilters from "@/components/GameFilters";
import PlayerSearch from "@/components/PlayerSearch";
import { SectionLabel } from "@/components/ui";
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
      <p className="t-mono text-micro text-papel/80 mt-2">The board · Dublin</p>
      <h1 className="t-display text-display-md text-papel mt-1.5">
        Disc<span className="text-lima">o</span>ver
      </h1>
      <p className="text-label font-medium text-papel/85 mt-1.5">
        Open games near you — pick a poster and jump in.
      </p>

      <SectionLabel>Find a player</SectionLabel>
      <PlayerSearch placeholder="Search players by name" />

      <GameFilters games={games} sectionLabel="Games near you" excludeOwnGames />

      <BottomNav />
    </main>
  );
}
