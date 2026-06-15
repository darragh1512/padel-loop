import BottomNav from "@/components/BottomNav";
import GameFilters from "@/components/GameFilters";
import { getGames } from "@/lib/data";

// Always read fresh data on each request, so "spots left" (computed from the
// live game_players table) reflects joins/leaves immediately instead of a
// cached value. (See JoinGame, which also calls router.refresh() after a join.)
export const dynamic = "force-dynamic";

// The /games list — every game in the Loop, reusing the same GameCard as home.
export default async function GamesPage() {
  const games = await getGames();

  return (
    <main className="px-5 pt-6 relative">
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <h1 className="font-display text-[21px] tracking-tight leading-snug mt-2 relative">
        <b className="font-bold">All games</b>
      </h1>
      <p className="text-[13px] text-dim font-light mt-1">
        {games.length} game{games.length === 1 ? "" : "s"} in the Loop.
      </p>

      <GameFilters games={games} sectionLabel="Browse games" />

      <BottomNav />
    </main>
  );
}
