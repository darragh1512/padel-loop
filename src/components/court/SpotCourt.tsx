"use client";

// The signature of the redesign: a padel court seen from above, with the game's
// spots standing on it. Taken spots show the player's face, open spots glow
// amber, so "is there room for me?" reads at a glance.
//
// Four players stand in the four quadrants and two face each other across the
// net. Any other size falls back to a plain row of spots.

import { useEffect } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";
import type { Player } from "@/lib/types";

// The spots fade in the first time the app opens, then never again: on a
// screen people revisit all day, repeating it would only slow them down.
let hasPlayed = false;

const QUADRANTS = [
  { left: "25%", top: "29%" },
  { left: "25%", top: "71%" },
  { left: "75%", top: "29%" },
  { left: "75%", top: "71%" },
];
const FACING = [
  { left: "25%", top: "50%" },
  { left: "75%", top: "50%" },
];

function Spot({
  player,
  index,
  animate,
}: {
  player?: Player;
  index: number;
  animate: boolean;
}) {
  const motion = animate ? "c-spot-in" : "";
  const delay = animate ? { animationDelay: `${index * 40}ms` } : undefined;
  if (!player) {
    return (
      <span
        className={`grid place-items-center size-full rounded-full bg-c-amber text-c-on-amber ring-2 ring-c-court ${motion}`}
        style={delay}
      >
        <svg viewBox="0 0 10 10" className="size-2.5" fill="none" aria-hidden>
          <path d="M5 1.5v7M1.5 5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`block size-full ${motion}`} style={delay}>
      <PlayerAvatar
        userId={player.id}
        avatarUrl={player.avatarUrl}
        name={player.name}
        className="size-full ring-2 ring-c-court text-[0.5625rem]"
      />
    </span>
  );
}

export default function SpotCourt({
  players,
  maxPlayers,
}: {
  players: Player[];
  maxPlayers: number;
}) {
  const animate = !hasPlayed;
  useEffect(() => {
    hasPlayed = true;
  }, []);

  const open = Math.max(0, maxPlayers - players.length);
  const label = `${players.length} of ${maxPlayers} spots taken, ${open} open`;
  const positions = maxPlayers === 4 ? QUADRANTS : maxPlayers === 2 ? FACING : null;

  if (!positions) {
    return (
      <div role="img" aria-label={label} className="flex flex-wrap gap-1 p-1.5 rounded-[10px] bg-c-court">
        {Array.from({ length: maxPlayers }).map((_, i) => (
          <span key={i} className="size-5">
            <Spot player={players[i]} index={i} animate={animate} />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={label}
      className="relative w-23 h-15 flex-none rounded-[10px] bg-c-court overflow-hidden"
    >
      <svg viewBox="0 0 92 60" aria-hidden className="absolute inset-0 size-full text-c-court-line">
        <path d="M46 0v60" stroke="currentColor" strokeWidth="1.5" />
        <path d="M18 5v50M74 5v50M18 30h56" stroke="currentColor" strokeWidth="1" fill="none" />
        <rect x="3" y="5" width="86" height="50" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
      {positions.map((position, i) => (
        <span
          key={i}
          className="absolute size-5 -translate-x-1/2 -translate-y-1/2"
          style={position}
        >
          <Spot player={players[i]} index={i} animate={animate} />
        </span>
      ))}
    </div>
  );
}
