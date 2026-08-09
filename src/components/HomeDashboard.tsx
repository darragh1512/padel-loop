"use client";

// The home dashboard. One job: get the player to their next game fast.
//   • Top row: the day + greeting as a printed eyebrow, the player's own name
//     as the poster shout, with the notification disc and their avatar
//     opposite.
//   • Hero: the next game as a taped-up match poster with a countdown stub,
//     or a "Game on?" invitation when the board is empty.
//   • "Find a game" — THE primary action, the one lima surface (→ /discover).
//   • Two tiles — Connections and Leaderboard.
//   • A stats strip along the foot.
// Reuses the existing upcoming-games, connection-count and profile queries;
// it adds no new data access of its own.

import { useEffect, useState } from "react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import PlayerAvatar from "@/components/PlayerAvatar";
import { Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { getUpcomingGamesFor, type Game } from "@/app/games";
import { getConnectionCount } from "@/app/connections";
import { getProfile } from "@/app/profiles";
import { APP_TIME_ZONE, dublinDateKey } from "@/lib/time";

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path
        d="M9 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* "TUE 21:00" — the poster's date line, on a Dublin clock like everything
   else in the app. */
function posterWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-IE", { timeZone: APP_TIME_ZONE, ...o }).format(d);
  return `${f({ weekday: "short" })} ${f({ hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

/* The countdown stub: "TODAY", "1d", "5d" … in Dublin calendar days. */
function countdown(iso: string): { label: string; value: string } {
  const key = dublinDateKey(iso);
  const today = dublinDateKey(new Date());
  if (!key || !today) return { label: "ON", value: "—" };
  const days = Math.round(
    (Date.parse(`${key}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= 0) return { label: "IT'S", value: "Today" };
  if (days === 1) return { label: "IN", value: "1d" };
  return { label: "IN", value: `${days}d` };
}

/* One of the two square tiles under the primary action. */
function Tile({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white/8 hover:bg-white/14 border-2 border-papel/28 rounded-card p-3 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
    >
      {icon}
      <div className="t-display text-display-xs text-papel mt-2.5">{title}</div>
      <div className="text-label text-papel/65 mt-0.75">{sub}</div>
    </Link>
  );
}

export default function HomeDashboard() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<Game[]>([]);
  const [connCount, setConnCount] = useState(0);
  const [name, setName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);

  // Day + time-of-day word for the greeting. Set in an effect (client only)
  // from the user's own local time, so it's their morning/afternoon/evening —
  // and so it never mismatches the server-rendered HTML during hydration.
  const [greeting, setGreeting] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    const period = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const day = new Intl.DateTimeFormat("en-IE", { weekday: "long" }).format(now);
    setGreeting(`${day} · ${period}`);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (uid) {
        const [games, count, profile] = await Promise.all([
          getUpcomingGamesFor(uid),
          getConnectionCount(uid),
          getProfile(uid),
        ]);
        if (!active) return;
        setUserId(uid);
        setUpcoming(games); // soonest first — [0] is the next game
        setConnCount(count);
        setName(profile?.name ?? null);
        setAvatarUrl(profile?.avatar_url ?? null);
        setRating(profile?.rating ?? null);
      }
      if (!active) return;
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const nextGame = upcoming[0] ?? null;

  // The header band: the greeting eyebrow, the player's name as the shout,
  // and the two round controls opposite.
  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="t-eyebrow text-micro text-lima mb-1.5 min-h-4">
          {greeting}
        </div>
        <h1 className="t-display text-[clamp(2rem,10vw,2.5rem)] leading-[0.92] text-white truncate">
          {firstName ?? "Hello"}
          <span className="text-naranja">.</span>
        </h1>
      </div>
      <div className="flex items-center gap-2.5 flex-none">
        <NotificationBell />
        {userId && (
          <Link
            href={`/players/${userId}`}
            aria-label="Your profile"
            className="rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
          >
            <PlayerAvatar
              userId={userId}
              avatarUrl={avatarUrl}
              name={name}
              className="size-10.5 border-2 border-tinta"
            />
          </Link>
        )}
      </div>
    </div>
  );

  // Hold the dashboard's space while loading so nothing jumps when it
  // resolves. Skeletons mirror the real layout.
  if (loading) {
    return (
      <>
        {header}
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="rounded-card h-28" />
          <Skeleton className="rounded-card h-18" />
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton className="rounded-card h-24" />
            <Skeleton className="rounded-card h-24" />
          </div>
        </div>
      </>
    );
  }

  const stub = nextGame ? countdown(nextGame.game_time) : null;

  return (
    <>
      {header}

      <div className="mt-4 flex flex-col gap-3">
        {/* ── Hero: the match poster ─────────────────────────────────────── */}
        {nextGame && stub ? (
          <Link
            href={`/games/${nextGame.id}`}
            className="pl-card pl-press pl-rise shadow-poster relative px-4 pt-3.5 pb-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
          >
            <span className="pena-tape" aria-hidden />
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="t-eyebrow text-tiny text-tinta/55">
                  Next up · {posterWhen(nextGame.game_time)}
                </div>
                <div className="t-display text-display-sm text-tinta mt-1.25">
                  {nextGame.venue}
                  {nextGame.location && (
                    <>
                      <span className="text-tinta/45"> · </span>
                      {nextGame.location}
                    </>
                  )}
                </div>
              </div>
              <div className="flex-none text-center bg-tinta text-papel rounded-card px-2.5 py-1.5 min-w-13.5">
                <div className="t-eyebrow text-tiny tracking-[0.12em]">{stub.label}</div>
                <div className="t-display text-[1.25rem] leading-none mt-0.5">
                  {stub.value}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-3 pt-2.5 border-t-2 border-dashed border-tinta/25">
              <span className="t-mono text-micro text-tinta">
                {nextGame.skill_level}
              </span>
              <span className="t-mono text-micro text-tinta border-b-2 border-naranja">
                Details
              </span>
            </div>
          </Link>
        ) : (
          <div className="pl-card pl-rise relative px-4 pt-4 pb-3.5">
            <span className="pena-tape" aria-hidden />
            <div className="t-display text-display-xs text-tinta">
              Game <span className="text-naranja">on?</span>
            </div>
            <div className="text-body text-tinta/70 mt-1">
              Nothing on the board yet — your next game is a tap away.
            </div>
          </div>
        )}

        {/* ── Find a game — the one loud thing on the screen ──────────────── */}
        <Link
          href="/discover"
          className="pena-riso-lg pena-riso pl-rise flex items-center gap-3.5 rounded-card px-3.5 py-3 bg-lima text-tinta border-2 border-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papel"
          style={{ animationDelay: "50ms" }}
        >
          <span className="pena-pulse relative size-11 flex-none rounded-pill border-2 border-tinta bg-papel grid place-items-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2.2" />
              <path
                d="M16 16l4 4"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="t-mono block text-title tracking-[0.14em]">
              Find a game
            </span>
            <span className="block text-body text-tinta/70 mt-0.75">
              Open games near you, at your level
            </span>
          </span>
          <ChevronRight />
        </Link>

        {/* ── Two tiles ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2.5">
          <Tile
            href="/connections"
            title="Connections"
            sub={
              connCount === 0
                ? "Build your circle"
                : `${connCount} ${connCount === 1 ? "friend" : "friends"} in your loop`
            }
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                className="text-lima"
              >
                <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5M17 8.5a2.6 2.6 0 0 1 0 5M18 19c0-2.2-.7-3.7-2-4.6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <Tile
            href="/leaderboard"
            title="Leaderboard"
            sub="Who runs the board?"
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                className="text-naranja"
              >
                <path
                  d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M10 20h4M12 13v7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
        </div>

        {/* ── The stats strip ────────────────────────────────────────────── */}
        <div className="flex bg-[rgb(6_20_58/0.35)] border-2 border-papel/20 rounded-card overflow-hidden">
          {[
            {
              value: rating != null ? String(rating) : "—",
              label: "Rating",
              tone: "text-lima",
            },
            {
              value: String(upcoming.length),
              label: "Upcoming",
              tone: "text-papel",
            },
            {
              value: String(connCount),
              label: "Mates",
              tone: "text-naranja",
            },
          ].map((s, i) => (
            <div key={s.label} className="flex-1 min-w-0 flex">
              {i > 0 && <span className="w-0.5 bg-papel/20 flex-none" />}
              <div className="flex-1 min-w-0 text-center py-2.5 px-1">
                <div className={`t-display text-display-sm ${s.tone} truncate`}>
                  {s.value}
                </div>
                <div className="t-mono text-tiny tracking-[0.14em] text-papel/60 mt-0.75">
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
