import Link from "next/link";
import { AvatarStack } from "./ui";
import {
  type Game,
  pricePerHead,
  slotsLeft,
  formatTimeRange,
  formatDay,
} from "@/lib/types";

// One joinable game. The WHOLE card is the tap target (thumb-first); the
// "Join game" pill inside is a visual cue, not a separate control — both go
// to the game detail where the real Join lives.
export default function GameCard({ game, delay = 0 }: { game: Game; delay?: number }) {
  const slots = slotsLeft(game);
  return (
    <Link
      href={`/games/${game.id}`}
      className="pl-card pl-press pl-rise block p-4 mb-3 hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-title font-semibold text-ink">{game.venue}</div>
          <div className="text-label text-ink-secondary mt-1">
            {formatDay(game)} ·{" "}
            <span className="text-ink font-medium">{formatTimeRange(game)}</span> · Level{" "}
            {game.levelMin.toFixed(1)}–{game.levelMax.toFixed(1)}
          </div>
        </div>
        {game.distanceKm != null && (
          <div className="text-label text-ink-secondary bg-sunken px-2.5 py-1 rounded-pill whitespace-nowrap">
            {game.distanceKm.toFixed(1)} km
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-3.5">
        <div className="flex items-center">
          <AvatarStack players={game.players} maxPlayers={game.maxPlayers} />
          <span className="text-label text-ink-secondary ml-2.5">
            <span className="text-ink font-semibold">
              {slots} spot{slots === 1 ? "" : "s"}
            </span>{" "}
            open
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-label font-semibold text-ink">
            €{pricePerHead(game).toFixed(0)}{" "}
            <span className="text-micro text-ink-faint font-normal">/ head</span>
          </span>
          <span className="inline-flex items-center justify-center h-9 px-4 text-label font-medium rounded-pill bg-accent text-on-accent whitespace-nowrap">
            Join game
          </span>
        </div>
      </div>
    </Link>
  );
}
