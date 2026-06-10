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
      className="pl-card p-[17px] pb-[15px] mb-3 pl-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-[15.5px]">{game.venue}</div>
          <div className="text-[12.5px] text-dim font-light mt-1">
            {formatDay(game)} ·{" "}
            <b className="text-pale font-medium">{formatTimeRange(game)}</b> · Level{" "}
            {game.levelMin.toFixed(1)}–{game.levelMax.toFixed(1)}
          </div>
        </div>
        {game.distanceKm != null && (
          <div className="text-[11px] text-sky font-medium bg-vivid/12 px-2.5 py-1 rounded-full whitespace-nowrap">
            {game.distanceKm.toFixed(1)} km
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-3.5">
        <div className="flex items-center">
          <AvatarStack players={game.players} maxPlayers={game.maxPlayers} />
          <span className="text-[11px] text-dim ml-2.5">
            <b className="text-white font-semibold">
              {slots} slot{slots === 1 ? "" : "s"}
            </b>{" "}
            left
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold">
            €{pricePerHead(game).toFixed(0)}{" "}
            <span className="text-[10.5px] text-faint font-normal">/ head</span>
          </span>
          <Link
            href={`/games/${game.id}`}
            className="bg-vivid text-white font-semibold text-[12.5px] rounded-full px-4.5 py-2.5 shadow-[0_6px_16px_rgba(30,92,255,0.35)]"
          >
            Join game
          </Link>
        </div>
      </div>
    </div>
  );
}
