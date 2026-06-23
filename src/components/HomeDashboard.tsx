"use client";

// The home dashboard. One job: get the player to their next action fast.
//   • Hero: the user's next game if they have one, else a "Ready to play?" state.
//   • Two dashboard cards below: "Find a game" — the primary action on the page
//     (→ /discover) — and "Connections" (their connection count → /connections).
// No social feed. Reuses the existing upcoming-games and connection-count
// queries; it adds no new data access of its own.

import { useEffect, useState } from "react";
import Link from "next/link";
import { MiniLoop } from "@/components/brand";
import { supabase } from "@/lib/supabaseClient";
import { formatGameTime, getUpcomingGamesFor, type Game } from "@/app/games";
import { getConnectionCount } from "@/app/connections";

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.5 14.4c2 .6 3.5 2.4 3.5 4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function HomeDashboard() {
  const [loading, setLoading] = useState(true);
  const [nextGame, setNextGame] = useState<Game | null>(null);
  const [connCount, setConnCount] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (uid) {
        const [upcoming, count] = await Promise.all([
          getUpcomingGamesFor(uid),
          getConnectionCount(uid),
        ]);
        if (!active) return;
        setNextGame(upcoming[0] ?? null); // soonest first — [0] is the next game
        setConnCount(count);
      }
      if (!active) return;
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Hold the dashboard's space while loading so nothing jumps when it resolves.
  if (loading) {
    return (
      <div className="mt-4 space-y-3">
        <div className="pl-card h-[140px] animate-pulse opacity-60" />
        <div className="pl-card h-[76px] animate-pulse opacity-60" />
        <div className="pl-card h-[76px] animate-pulse opacity-60" />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Hero — next game, or a "Ready to play?" status. */}
      {nextGame ? (
        <Link
          href={`/games/${nextGame.id}`}
          className="block rounded-(--radius-card) p-4 border border-sky/25 bg-gradient-to-br from-vivid/16 to-deep/60 pl-cta-shadow active:scale-[0.99] transition-transform"
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
            <span className="text-[12px] text-dim font-light">{nextGame.location}</span>
            <span className="text-[12px] text-sky font-medium inline-flex items-center gap-0.5">
              View game
              <ChevronRight />
            </span>
          </div>
        </Link>
      ) : (
        <div className="pl-card p-5 flex items-center gap-4">
          <MiniLoop size={40} />
          <div>
            <div className="font-display font-bold text-[16px] tracking-tight">
              Ready to play?
            </div>
            <div className="text-[12.5px] text-dim font-light mt-0.5">
              You’ve no games coming up — find one below.
            </div>
          </div>
        </div>
      )}

      {/* Find a game — the primary action. Solid vivid so it's unmistakable. */}
      <Link
        href="/discover"
        className="flex items-center gap-3.5 rounded-(--radius-card) p-4 bg-vivid pl-cta-shadow active:scale-[0.98] transition-transform"
      >
        <span className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0">
          <SearchIcon />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[16px] text-white">Find a game</div>
          <div className="text-[12px] text-white/75 font-light mt-0.5">
            Browse open games near you
          </div>
        </div>
        <ChevronRight className="text-white/80" />
      </Link>

      {/* Connections — count + link to the connections list. */}
      <Link
        href="/connections"
        className="flex items-center gap-3.5 pl-card p-4 active:scale-[0.99] transition-transform"
      >
        <span className="w-11 h-11 rounded-full bg-vivid/15 border border-sky/25 text-sky flex items-center justify-center shrink-0">
          <PeopleIcon />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[16px] tracking-tight">
            Connections
          </div>
          <div className="text-[12px] text-dim font-light mt-0.5">
            {connCount} {connCount === 1 ? "connection" : "connections"}
          </div>
        </div>
        <ChevronRight className="text-faint" />
      </Link>
    </div>
  );
}
