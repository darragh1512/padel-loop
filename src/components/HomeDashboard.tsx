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

  // "Good morning, Darragh." — the signature moment of the app. Instrument
  // Serif, calm and quiet. The time word always shows once mounted; the first
  // name is added once the profile loads (omitted if there's no name yet).
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const header = (
    <div className="flex items-start justify-between gap-4">
      <h1 className="font-display text-display-md text-ink min-h-8">
        {period ? (
          <>
            Good {period}
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
      <div className="mt-6 space-y-3">
        {/* Hero — the next game, or an invitation to find one. A quiet white
            card either way: the sage on this screen belongs to Find a game. */}
        {nextGame ? (
          <Link
            href={`/games/${nextGame.id}`}
            className="pl-press pl-rise block pl-card p-5 hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="flex items-center justify-between">
              <span className="text-label text-ink-secondary">Your next game</span>
              <Chip>{nextGame.skill_level}</Chip>
            </div>
            <div className="text-title font-semibold text-ink mt-2">
              {nextGame.venue}
            </div>
            <div className="text-body text-ink mt-0.5">
              {formatGameTime(nextGame.game_time)}
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-label text-ink-secondary">{nextGame.location}</span>
              <ChevronRight className="text-ink-faint" />
            </div>
          </Link>
        ) : (
          <div className="pl-card pl-rise p-5 flex items-center gap-4">
            <MiniLoop size={40} />
            <div>
              <div className="text-title font-semibold text-ink">
                Ready to play?
              </div>
              <div className="text-label text-ink-secondary mt-0.5">
                Nothing booked yet — your next game is a tap away.
              </div>
            </div>
          </div>
        )}

        {/* Find a game — the primary action. The one solid sage thing here. */}
        <Link
          href="/discover"
          className="pl-press pl-rise flex items-center gap-3.5 rounded-card p-4 bg-accent hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ animationDelay: "50ms" }}
        >
          <span className="size-11 rounded-pill bg-on-accent/15 text-on-accent flex items-center justify-center shrink-0">
            <SearchIcon />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-medium text-body text-on-accent">Find a game</span>
            <span className="block text-label text-on-accent/75 mt-0.5">
              Open games near you, at your level
            </span>
          </span>
          <ChevronRight className="text-on-accent/80" />
        </Link>

        {/* Connections — count + link to the connections list. */}
        <Link
          href="/connections"
          className="pl-press pl-rise flex items-center gap-3.5 pl-card p-4 hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ animationDelay: "100ms" }}
        >
          <span className="size-11 rounded-pill bg-sunken text-ink-secondary flex items-center justify-center shrink-0">
            <PeopleIcon />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-medium text-body text-ink">Connections</span>
            <span className="block text-label text-ink-secondary mt-0.5">
              {connCount === 0
                ? "Build your circle of padel friends"
                : `${connCount} ${connCount === 1 ? "friend" : "friends"} in your loop`}
            </span>
          </span>
          <ChevronRight className="text-ink-faint" />
        </Link>
      </div>
    </>
  );
}
