// One game in a list: its small court, when and where, and how full it is.

import Link from "next/link";
import Court, { spotsFor } from "@/components/ios/Court";
import Icon from "@/components/ios/Icon";
import { isCancelled, isFull, slotsLeft, type Game } from "@/lib/types";
import { gameWhen, spotsOpenText } from "@/lib/when";

export default function GameRow({
  game,
  note,
  past = false,
}: {
  game: Game;
  note?: string;
  past?: boolean; // over now, so how many spots were open no longer matters
}) {
  const open = slotsLeft(game);
  const cancelled = isCancelled(game);
  const status = cancelled ? "Cancelled" : game.isManuallyClosed ? "Closed" : isFull(game) ? "Full" : `${open} open`;
  const statusClass = cancelled
    ? "ios-fn ios-destructive"
    : !game.isManuallyClosed && !isFull(game)
      ? "ios-fn ios-sb ios-acc"
      : "ios-fn ios-sec";
  return (
    <Link
      href={`/games/${game.id}`}
      className="ios-row ios-link"
      style={{ padding: "12px 16px", "--ios-inset": "100px" } as React.CSSProperties}
    >
      <div style={{ width: 72, flex: "none" }}>
        <Court
          spots={spotsFor(game.players, game.maxPlayers, null, game.guestCount)}
          label={`Court with ${game.players.length + game.guestCount} of ${game.maxPlayers} spots taken, ${open > 0 ? spotsOpenText(open) : "full"}`}
        />
      </div>
      <div className="ios-grow">
        <div className="ios-hl">{gameWhen(game.startsAt)}</div>
        <div className="ios-fn ios-sec">{[note, game.venue].filter(Boolean).join(" · ")}</div>
      </div>
      {(!past || cancelled) && (
        <div className={statusClass} style={{ whiteSpace: "nowrap" }}>
          {status}
        </div>
      )}
      <span className="ios-chev">
        <Icon name="chevron-right" size={13} />
      </span>
    </Link>
  );
}
