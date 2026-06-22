"use client";

// The home screen's hero — the one job here is getting the player into a game
// fast. It leads the page:
//   • If the logged-in user has an upcoming game, it shows that prominently as
//     "Your next game" with the key details, linking to the game.
//   • Otherwise it shows a clear "Find a game" / "Create a game" prompt.
// Either way, Create a game is offered as a prominent primary action.
//
// Reuses the existing queries (getUpcomingGamesFor) and the existing create
// flow (/create) — it adds no new data access of its own.

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { formatGameTime, getUpcomingGamesFor, type Game } from "@/app/games";

// Prominent primary action — used in both hero states.
function CreateGameButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/create"
      className={`flex items-center justify-center gap-2 w-full bg-vivid text-white font-semibold text-[15px] rounded-(--radius-btn) py-3.5 pl-cta-shadow active:scale-[0.98] transition-transform ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      Create a game
    </Link>
  );
}

export default function HomeHero() {
  const [loading, setLoading] = useState(true);
  const [nextGame, setNextGame] = useState<Game | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (uid) {
        const upcoming = await getUpcomingGamesFor(uid);
        if (!active) return;
        setNextGame(upcoming[0] ?? null); // soonest first — [0] is the next game
      }
      if (!active) return;
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // While we work out whether there's a next game, hold the space so the list
  // below doesn't jump when the hero resolves.
  if (loading) {
    return <div className="mt-4 pl-card h-[150px] animate-pulse opacity-60" />;
  }

  // Has an upcoming game → lead with it, with Create as a secondary prominent CTA.
  if (nextGame) {
    return (
      <div className="mt-4">
        <Link
          href={`/games/${nextGame.id}`}
          className="block rounded-[20px] p-4 border border-sky/25 bg-gradient-to-br from-vivid/16 to-deep/60 pl-cta-shadow active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-[2px] uppercase text-sky font-display font-light">
              Your next game
            </span>
            <span className="text-[11px] text-sky font-medium bg-vivid/15 border border-sky/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              {nextGame.skill_level}
            </span>
          </div>
          <div className="font-display font-bold text-[18px] tracking-tight mt-2">
            {nextGame.venue}
          </div>
          <div className="text-[13px] text-pale font-medium mt-1">
            {formatGameTime(nextGame.game_time)}
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[12px] text-dim font-light">
              {nextGame.location}
            </span>
            <span className="text-[12px] text-sky font-medium inline-flex items-center gap-0.5">
              View game
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </Link>
        <CreateGameButton className="mt-3" />
      </div>
    );
  }

  // No upcoming game (or logged out) → a clear Find / Create prompt.
  return (
    <div className="mt-4 pl-card p-5 text-center">
      <div className="font-display font-bold text-[17px] tracking-tight">
        Ready to play?
      </div>
      <div className="text-[12.5px] text-dim font-light mt-1 mb-4">
        Jump into an open game below, or set up your own.
      </div>
      <div className="flex gap-2.5">
        <a
          href="#games"
          className="flex-1 text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 active:scale-[0.98] transition-transform"
        >
          Find a game
        </a>
        <Link
          href="/create"
          className="flex-1 text-center bg-vivid text-white font-semibold text-sm rounded-(--radius-btn) py-3 pl-cta-shadow active:scale-[0.98] transition-transform"
        >
          Create a game
        </Link>
      </div>
    </div>
  );
}
