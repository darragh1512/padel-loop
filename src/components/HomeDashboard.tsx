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
import { getProfile } from "@/app/profiles";

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
  const [name, setName] = useState<string | null>(null);

  // Time-of-day word for the greeting. Set in an effect (client only) from the
  // user's own local time, so it's their morning/afternoon/evening — and so it
  // never mismatches the server-rendered HTML during hydration.
  const [period, setPeriod] = useState<string | null>(null);
  useEffect(() => {
    const h = new Date().getHours();
    setPeriod(h < 12 ? "morning" : h < 18 ? "afternoon" : "evening");
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (uid) {
        const [upcoming, count, profile] = await Promise.all([
          getUpcomingGamesFor(uid),
          getConnectionCount(uid),
          getProfile(uid),
        ]);
        if (!active) return;
        setNextGame(upcoming[0] ?? null); // soonest first — [0] is the next game
        setConnCount(count);
        setName(profile?.name ?? null);
      }
      if (!active) return;
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // "Good morning, Darragh." — the signature moment of the app. Instrument
  // Serif, calm and quiet. The time word always shows once mounted; the first
  // name is added once the profile loads (omitted if there's no name yet).
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const greeting = period ? (
    <h1 className="font-display text-[28px] tracking-tight leading-tight text-ink mt-6">
      Good {period}
      {firstName ? <>, {firstName}</> : null}.
    </h1>
  ) : null;

  // Hold the dashboard's space while loading so nothing jumps when it resolves.
  // Skeletons: sunken surfaces with a subtle pulse — never spinners.
  if (loading) {
    return (
      <>
        {greeting}
        <div className="mt-6 space-y-3">
          <div className="pl-skeleton rounded-card h-35" />
          <div className="pl-skeleton rounded-card h-19" />
          <div className="pl-skeleton rounded-card h-19" />
        </div>
      </>
    );
  }

  return (
    <>
      {greeting}
      <div className="mt-6 space-y-3">
      {/* Hero — next game, or a "Ready to play?" status. Soft sage ground for
          a little warmth; hairline border, no shadow. */}
      {nextGame ? (
        <Link
          href={`/games/${nextGame.id}`}
          className="block rounded-(--radius-card) p-5 border border-line bg-accent-soft active:scale-[0.99] transition-transform duration-150 ease-out"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink-secondary">Your next game</span>
            <span className="text-[13px] text-accent font-medium bg-surface px-2.5 py-1 rounded-full whitespace-nowrap">
              {nextGame.skill_level}
            </span>
          </div>
          <div className="font-display text-[22px] tracking-tight text-ink mt-2">
            {nextGame.venue}
          </div>
          <div className="text-[15px] text-ink font-medium mt-1">
            {formatGameTime(nextGame.game_time)}
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[13px] text-ink-secondary">{nextGame.location}</span>
            <span className="text-[13px] text-accent font-medium inline-flex items-center gap-0.5">
              View game
              <ChevronRight />
            </span>
          </div>
        </Link>
      ) : (
        <div className="pl-card p-5 flex items-center gap-4">
          <MiniLoop size={40} />
          <div>
            <div className="font-display text-[19px] tracking-tight text-ink">
              Ready to play?
            </div>
            <div className="text-[13px] text-ink-secondary mt-0.5">
              You’ve no games coming up — find one below.
            </div>
          </div>
        </div>
      )}

      {/* Find a game — the primary action. Solid accent so it's unmistakable. */}
      <Link
        href="/discover"
        className="flex items-center gap-3.5 rounded-(--radius-card) p-4 bg-accent active:scale-[0.98] transition-transform duration-150 ease-out"
      >
        <span className="w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0">
          <SearchIcon />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[15px] text-white">Find a game</div>
          <div className="text-[13px] text-white/75 mt-0.5">
            Browse open games near you
          </div>
        </div>
        <ChevronRight className="text-white/80" />
      </Link>

      {/* Connections — count + link to the connections list. */}
      <Link
        href="/connections"
        className="flex items-center gap-3.5 pl-card p-4 active:scale-[0.99] transition-transform duration-150 ease-out"
      >
        <span className="w-11 h-11 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0">
          <PeopleIcon />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[15px] text-ink">Connections</div>
          <div className="text-[13px] text-ink-secondary mt-0.5">
            {connCount} {connCount === 1 ? "connection" : "connections"}
          </div>
        </div>
        <ChevronRight className="text-ink-faint" />
      </Link>
    </div>
    </>
  );
}
