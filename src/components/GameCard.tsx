import { AvatarStack, ButtonLink } from "./ui";
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
          <ButtonLink href={`/games/${game.id}`} size="sm">
            Join game
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
