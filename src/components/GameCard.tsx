import Link from "next/link";
import SpotCourt from "@/components/court/SpotCourt";
import {
  type Game,
  formatPrice,
  slotsLeft,
  formatTimeRange,
  formatDay,
} from "@/lib/types";

// One joinable game. When and where on the left, and on the right the little
// court showing who's in and what's open. The WHOLE card is the tap target
// (thumb-first); it goes to the game detail where the real Join lives.
export default function GameCard({ game }: { game: Game }) {
  const slots = slotsLeft(game);
  // The creator shut this game to new players by hand. The roster is
  // untouched, so `slots` below is still the REAL number of empty spots —
  // a 3-of-4 game still reads as 3 of 4, it just isn't joinable.
  const closed = game.isManuallyClosed === true;
  // null when the organiser hasn't set a price. Nothing is rendered in
  // that case — no €0.00, no "Free", no bare euro sign.
  const price = formatPrice(game.pricePerPlayer);
  return (
    <Link
      href={`/games/${game.id}`}
      className="c-ui c-card c-press block p-4 mb-3 text-c-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-accent"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="text-[0.875rem] font-medium text-c-accent">
            {formatDay(game)} · {formatTimeRange(game)}
          </div>
          <div className="c-title text-[1.25rem] leading-tight mt-1">{game.venue}</div>
          <div className="text-[0.875rem] text-c-sub mt-1">
            Level {game.levelMin.toFixed(1)}–{game.levelMax.toFixed(1)}
            {game.distanceKm != null && ` · ${game.distanceKm.toFixed(1)} km`}
          </div>
        </div>
        <SpotCourt players={game.players} maxPlayers={game.maxPlayers} />
      </div>

      <div className="flex justify-between items-center gap-3 mt-3.5 pt-3 border-t border-c-line text-[0.875rem]">
        {/* The count is never faked — only the word after it changes, because
            an unfilled spot on a closed game is still unfilled, just not open
            to take. */}
        <span className="flex items-center gap-2 min-w-0 font-medium">
          {!closed && slots > 0 && (
            <span aria-hidden className="size-2 flex-none rounded-full bg-c-amber" />
          )}
          {slots} spot{slots === 1 ? "" : "s"} {closed ? "unfilled" : "open"}
        </span>
        <span className="flex items-center gap-3 flex-none">
          {price && (
            <span>
              <span className="font-medium">{price}</span>{" "}
              <span className="text-c-sub">per player</span>
            </span>
          )}
          {closed && <span className="font-medium text-c-danger">Closed</span>}
        </span>
      </div>
    </Link>
  );
}
