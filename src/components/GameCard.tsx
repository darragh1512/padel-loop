import Link from "next/link";
import { AvatarStack } from "./ui";
import {
  type Game,
  pricePerHead,
  slotsLeft,
  formatTimeRange,
  formatDay,
} from "@/lib/types";

export default function GameCard({ game, delay = 0 }: { game: Game; delay?: number }) {
  const slots = slotsLeft(game);
  return (
    <div
      className="pl-card p-4 mb-3 pl-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-[15px] text-ink">{game.venue}</div>
          <div className="text-[13px] text-ink-secondary mt-1">
            {formatDay(game)} ·{" "}
            <span className="text-ink font-medium">{formatTimeRange(game)}</span> · Level{" "}
            {game.levelMin.toFixed(1)}–{game.levelMax.toFixed(1)}
          </div>
        </div>
        {game.distanceKm != null && (
          <div className="text-[13px] text-ink-secondary bg-sunken px-2.5 py-1 rounded-full whitespace-nowrap">
            {game.distanceKm.toFixed(1)} km
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-3.5">
        <div className="flex items-center">
          <AvatarStack players={game.players} maxPlayers={game.maxPlayers} />
          <span className="text-[13px] text-ink-secondary ml-2.5">
            <span className="text-ink font-semibold">
              {slots} slot{slots === 1 ? "" : "s"}
            </span>{" "}
            left
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-ink">
            €{pricePerHead(game).toFixed(0)}{" "}
            <span className="text-[11px] text-ink-faint font-normal">/ head</span>
          </span>
          <Link
            href={`/games/${game.id}`}
            className="bg-accent text-white font-medium text-[13px] rounded-full px-4.5 py-2.5 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Join game
          </Link>
        </div>
      </div>
    </div>
  );
}
