import Link from "next/link";
import { AvatarStack } from "./ui";
import {
  type Game,
  formatPrice,
  slotsLeft,
  formatTimeRange,
  formatDay,
} from "@/lib/types";

// One joinable game — a mini match poster on the board: papel, stapled,
// slightly tilted (alternating with its stagger index), mono date on top,
// the venue shouted in poster caps, "Count me in" underlined in naranja.
// The WHOLE card is the tap target (thumb-first); the call-to-action inside
// is a visual cue, not a separate control — both go to the game detail where
// the real Join lives.
export default function GameCard({ game, delay = 0 }: { game: Game; delay?: number }) {
  const slots = slotsLeft(game);
  // The creator shut this game to new players by hand. The roster is
  // untouched, so `slots` below is still the REAL number of empty spots —
  // a 3-of-4 game still reads as 3 of 4, it just isn't joinable.
  const closed = game.isManuallyClosed === true;
  // null when the organiser hasn't set a price. Nothing is rendered in
  // that case — no €0.00, no "Free", no bare euro sign.
  const price = formatPrice(game.pricePerPlayer);
  // Alternate the pin angle with the card's position in the list.
  const tilt = Math.round(delay / 50) % 2 === 0 ? "pena-tilt-a" : "pena-tilt-b";
  return (
    <Link
      href={`/games/${game.id}`}
      className={`pl-card pena-staples ${tilt} pl-press pl-rise block p-4 pt-5 mb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="t-mono text-micro tracking-[0.2em] text-naranja-d">
            {formatDay(game)} · {formatTimeRange(game)}
          </div>
          <div className="t-display text-title text-tinta mt-1.5">{game.venue}</div>
          <div className="t-mono text-micro tracking-[0.14em] text-tinta/70 mt-1.5">
            Level {game.levelMin.toFixed(1)}–{game.levelMax.toFixed(1)}
          </div>
        </div>
        {game.distanceKm != null && (
          <div className="t-mono text-micro text-tinta border-[1.5px] border-tinta px-2.5 py-1 rounded-pill whitespace-nowrap">
            {game.distanceKm.toFixed(1)} km
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center">
          <AvatarStack players={game.players} maxPlayers={game.maxPlayers} />
          <span className="text-label font-medium text-tinta/70 ml-2.5">
            <span className="text-tinta font-extrabold">
              {slots} spot{slots === 1 ? "" : "s"}
            </span>{" "}
            {/* The count is never faked — only the word after it changes,
                because an unfilled spot on a closed game is still unfilled,
                just not open to take. */}
            {closed ? "unfilled" : "open"}
          </span>
        </div>
        <div className="flex items-center gap-3.5">
          {price && (
            <span className="text-label font-extrabold text-tinta">
              {price}{" "}
              <span className="text-micro text-tinta/45 font-normal">per player</span>
            </span>
          )}
          {closed ? (
            <span className="t-mono text-micro tracking-[0.14em] text-naranja-d border-[1.5px] border-dashed border-naranja-d rounded-pill px-2.5 py-1 whitespace-nowrap">
              Closed
            </span>
          ) : (
            <span className="text-label font-extrabold uppercase tracking-[0.04em] text-tinta border-b-2 border-naranja whitespace-nowrap">
              Count me in
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
