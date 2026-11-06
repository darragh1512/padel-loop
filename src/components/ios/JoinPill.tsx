"use client";

// The small Join button on game rows. It uses the same join call, sign-in
// hand-off and analytics event as the game page, so joining from a list is the
// same action as joining from the game itself.
//
// Motion: the button dips under the thumb, then "Join" turns into "Joined" with
// a tick while the button widens to fit. The parent fills the court spot and
// lowers the count at the same moment.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { capture } from "@/lib/analytics";
import { startAuthForJoin } from "@/lib/pendingIntent";
import { GAME_FULL, joinGame } from "@/app/games";

export default function JoinPill({
  gameId,
  gameLabel,
  userId,
  priced,
  onJoined,
  onFailed,
}: {
  gameId: string;
  gameLabel: string; // e.g. "Today, 20:00 at Star Padel", for screen readers
  userId: string | null;
  priced: boolean;
  onJoined: () => void;
  onFailed: (message: string) => void; // what to tell the player
}) {
  const router = useRouter();
  const [joined, setJoined] = useState(false);
  const [working, setWorking] = useState(false);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLSpanElement>(null);

  async function handleJoin() {
    if (!userId) {
      router.push(startAuthForJoin(gameId));
      return;
    }
    setWorking(true);
    // Fix the current width first, so the change to "Joined" animates from it.
    setWidth(buttonRef.current?.offsetWidth);
    const result = await joinGame(gameId, userId);
    setWorking(false);
    if ("error" in result) {
      setWidth(undefined);
      onFailed(result.error === GAME_FULL ? GAME_FULL : "Couldn’t join. Try again.");
      return;
    }
    capture("game_joined", { game_id: gameId, priced });
    setWidth(doneRef.current?.scrollWidth);
    setJoined(true);
    onJoined();
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className="ios-join"
      style={width != null ? { width } : undefined}
      disabled={joined || working}
      aria-busy={working || undefined}
      aria-label={joined ? `Joined ${gameLabel}` : `Join ${gameLabel}`}
      onClick={handleJoin}
    >
      <span className="ios-join-face" data-on={!joined}>
        Join
      </span>
      <span ref={doneRef} className="ios-join-face" data-on={joined} style={{ width: "max-content" }}>
        Joined
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 12.5l5.5 5.5L20 6.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
