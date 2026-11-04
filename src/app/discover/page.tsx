import BottomNav from "@/components/BottomNav";
import ScrollHeader from "@/components/court/ScrollHeader";
import GameFilters from "@/components/GameFilters";
import PlayerSearch from "@/components/PlayerSearch";
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
    <main className="court court-page px-4 pt-6 relative">
      <ScrollHeader title="Discover" />
      <h1 className="c-title text-[2.125rem] leading-tight mt-2">Discover</h1>
      <p className="text-[0.9375rem] text-c-sub mt-0.5">Open games near you in Dublin.</p>

      <GameFilters games={games} sectionLabel="Games near you" excludeOwnGames />

      <h2 className="c-title text-[1.125rem] mt-8 mb-2.5">Find a player</h2>
      <PlayerSearch placeholder="Search players by name" />

      <BottomNav />
    </main>
  );
}
