"use client";

// The home dashboard. One job: get the player to their next game fast.
//   • Top row: the serif greeting — the signature brand moment — with the
//     notification bell sitting quietly opposite.
//   • Hero: the user's next game if they have one, else a "Ready to play?"
//     invitation. A white card — calm, not competing with the action below.
//   • "Find a game" — THE primary action on the screen, the one solid sage
//     surface (→ /discover).
//   • "Connections" — a quiet white row (count → /connections).
// Reuses the existing upcoming-games and connection-count queries; it adds
// no new data access of its own.

import { useEffect, useState } from "react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import { MiniLoop } from "@/components/brand";
import { Chip, Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { formatGameTime, getUpcomingGamesFor, type Game } from "@/app/games";
import { getConnectionCount } from "@/app/connections";
import { getProfile } from "@/app/profiles";

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={`shrink-0 ${className}`}>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 5H4.5v1.5A3.5 3.5 0 0 0 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 5h3.5v1.5A3.5 3.5 0 0 1 16 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 13v4M8.5 20h7M12 17v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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

  // "GOOD EVENING, DARRAGH." — the poster shout at the top of the board,
  // papel on the court paint, one "o" inked naranja. The time word always
  // shows once mounted; the first name is added once the profile loads.
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const header = (
    <div className="flex items-start justify-between gap-4">
      <h1 className="t-display text-display-md text-papel min-h-8">
        {period ? (
          <>
            G<span className="text-lima">o</span>od {period}
            {firstName ? <>, {firstName}</> : null}.
          </>
        ) : null}
      </h1>
      <span className="mt-1.5">
        <NotificationBell />
      </span>
    </div>
  );

  // Hold the dashboard's space while loading so nothing jumps when it
  // resolves. Skeletons mirror the real layout: hero card + two rows.
  if (loading) {
    return (
      <>
        {header}
        <div className="mt-6 space-y-3">
          <Skeleton className="rounded-card h-35" />
          <Skeleton className="rounded-card h-19" />
          <Skeleton className="rounded-card h-19" />
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mt-6 space-y-4">
        {/* Hero — TONIGHT'S MATCH POSTER: the next game stapled to the board,
            or an invitation to pin one up. */}
        {nextGame ? (
          <Link
            href={`/games/${nextGame.id}`}
            className="pl-press pl-rise pena-tilt-a block pl-card pena-staples p-5 pt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="t-mono text-micro tracking-[0.2em] text-naranja-d">
                Your next game
              </span>
              <Chip>{nextGame.skill_level}</Chip>
            </div>
            <div className="t-display text-display-sm text-tinta mt-2.5">
              {nextGame.venue}
            </div>
            <div className="t-mono text-label tracking-[0.12em] text-tinta mt-2">
              {formatGameTime(nextGame.game_time)}
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-label font-medium text-tinta/70">{nextGame.location}</span>
              <ChevronRight className="text-tinta/45" />
            </div>
          </Link>
        ) : (
          <div className="pl-card pena-staples pena-tilt-a pl-rise p-5 pt-6 flex items-center gap-4">
            <MiniLoop size={40} />
            <div>
              <div className="t-display text-display-xs text-tinta">
                Game <span className="text-naranja">o</span>n?
              </div>
              <div className="text-label font-medium text-tinta/70 mt-1">
                Nothing on the board yet — your next game is a tap away.
              </div>
            </div>
          </div>
        )}

        {/* Find a game — the primary action: the lima ticket with the hard
            riso offset. The one loud thing on this screen. */}
        <Link
          href="/discover"
          className="pl-rise pena-riso flex items-center gap-3.5 rounded-card p-4 bg-lima text-tinta border-2 border-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papel"
          style={{ animationDelay: "50ms" }}
        >
          <span className="size-11 rounded-pill border-2 border-tinta flex items-center justify-center shrink-0">
            <SearchIcon />
          </span>
          <span className="flex-1 min-w-0">
            <span className="t-mono block text-label tracking-[0.14em]">Find a game</span>
            <span className="block text-label font-medium text-tinta/75 mt-0.5">
              Open games near you, at your level
            </span>
          </span>
          <ChevronRight />
        </Link>

        {/* Connections — count + link to the connections list. A quiet paper
            strip on the board. */}
        <Link
          href="/connections"
          className="pl-press pl-rise flex items-center gap-3.5 pl-card p-4 hover:bg-lima/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
          style={{ animationDelay: "100ms" }}
        >
          <span className="size-11 rounded-pill border-[1.5px] border-tinta text-tinta flex items-center justify-center shrink-0">
            <PeopleIcon />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-body font-extrabold text-tinta">Connections</span>
            <span className="block text-label font-medium text-tinta/70 mt-0.5">
              {connCount === 0
                ? "Build your circle of padel friends"
                : `${connCount} ${connCount === 1 ? "friend" : "friends"} in your loop`}
            </span>
          </span>
          <ChevronRight className="text-tinta/45" />
        </Link>

        {/* Leaderboard — the peña standings. Another quiet paper strip; the
            bottom nav keeps its 4-tab + create shape, so this lives here. */}
        <Link
          href="/leaderboard"
          className="pl-press pl-rise flex items-center gap-3.5 pl-card p-4 hover:bg-lima/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
          style={{ animationDelay: "150ms" }}
        >
          <span className="size-11 rounded-pill border-[1.5px] border-tinta text-tinta flex items-center justify-center shrink-0">
            <TrophyIcon />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-body font-extrabold text-tinta">Leaderboard</span>
            <span className="block text-label font-medium text-tinta/70 mt-0.5">
              Who runs the board this season?
            </span>
          </span>
          <ChevronRight className="text-tinta/45" />
        </Link>
      </div>
    </>
  );
}
