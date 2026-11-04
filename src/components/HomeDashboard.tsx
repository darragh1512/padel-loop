"use client";

// The home dashboard. One job: get the player to their next game fast.
//   • Top row: the day + greeting, the player's own name, with the notification
//     bell and their avatar opposite.
//   • Hero: the next game on a deep court-coloured card with a countdown, or an
//     invitation when nothing is booked. The one bold thing on the screen.
//   • "Find a game" — the primary action (→ /discover).
//   • A short list — Connections and Leaderboard.
//   • Three quiet numbers along the foot.
// Reuses the existing upcoming-games, connection-count and profile queries;
// it adds no new data access of its own.

import { useEffect, useState } from "react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import PlayerAvatar from "@/components/PlayerAvatar";
import ScrollHeader from "@/components/court/ScrollHeader";
import { ErrorState, Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { getUpcomingGamesFor, type Game } from "@/app/games";
import { getConnectionCount } from "@/app/connections";
import { getProfile } from "@/app/profiles";
import { onAvatarChange } from "@/lib/avatarBus";
import { useRouter } from "next/navigation";
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

/* "Tue 21:00" — the next game's date line, on a Dublin clock like everything
   else in the app. */
function posterWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-IE", { timeZone: APP_TIME_ZONE, ...o }).format(d);
  return `${f({ weekday: "short" })} ${f({ hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

/* The countdown: "Today", "Tomorrow", "In 5 days" … in Dublin calendar days. */
function countdown(iso: string): string {
  const key = dublinDateKey(iso);
  const today = dublinDateKey(new Date());
  if (!key || !today) return "";
  const days = Math.round(
    (Date.parse(`${key}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/* One row of the grouped list under the primary action. */
function Row({
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
      className="flex items-center gap-3.5 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-c-accent"
    >
      <span className="size-9 flex-none rounded-full bg-c-fill grid place-items-center text-c-ink">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[1rem] font-medium">{title}</span>
        <span className="block text-[0.875rem] text-c-sub truncate">{sub}</span>
      </span>
      <ChevronRight className="text-c-sub" />
    </Link>
  );
}

export default function HomeDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  // Home is the screen a brand-new person meets, so getting this wrong is
  // the costliest place to do it: "nothing on the board yet" on a failed
  // load tells somebody the Loop is dead on their first visit.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
        let games, count, profile;
        try {
          [games, count, profile] = await Promise.all([
            getUpcomingGamesFor(uid),
            getConnectionCount(uid),
            getProfile(uid),
          ]);
        } catch {
          if (!active) return;
          setFailed(true);
          setLoading(false);
          return;
        }
        if (!active) return;
        setFailed(false);
        setUserId(uid);
        setUpcoming(games); // soonest first — [0] is the next game
        setConnCount(count);
        // FIRST RUN. This is the ONLY place that sends anyone to /welcome,
        // and that is deliberate: it is what keeps a shared game link out of
        // onboarding. Somebody arriving on /games/[id] from WhatsApp goes
        // sign-up → back to that game → join without ever touching home, so
        // this never fires on them mid-intent. They get set up later, on
        // their first visit here, by which point they are already in a game.
        //
        // onboarded_at is set when they finish OR skip, so this cannot fire
        // twice — and being a column rather than a browser flag, it holds on
        // a second device too.
        if (profile && !profile.onboarded_at) {
          router.replace("/welcome");
          return;
        }

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
  }, [router, attempt]);

  // The avatar can be changed or removed from the profile screen, which
  // lives in a different tree and so cannot update this state directly.
  // Listen for the broadcast so the picture here changes straight away
  // instead of waiting for the next navigation to remount us.
  useEffect(
    () =>
      onAvatarChange((change) => {
        if (change.userId === userId) setAvatarUrl(change.avatarUrl);
      }),
    [userId],
  );

  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const nextGame = upcoming[0] ?? null;

  // The header: the greeting, the player's name, and the two round controls
  // opposite.
  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[0.875rem] text-c-sub min-h-5">{greeting}</div>
        <h1 className="c-title text-[2.125rem] leading-tight truncate">
          {firstName ?? "Hello"}
        </h1>
      </div>
      <div className="flex items-center gap-2.5 flex-none">
        <NotificationBell />
        {userId && (
          <Link
            href={`/players/${userId}`}
            aria-label="Your profile"
            className="c-press rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-accent"
          >
            <PlayerAvatar
              userId={userId}
              avatarUrl={avatarUrl}
              name={name}
              className="size-10.5"
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
        <div className="mt-5 flex flex-col gap-3">
          <Skeleton className="rounded-[22px] h-44" />
          <Skeleton className="rounded-card h-18" />
          <Skeleton className="rounded-card h-32" />
        </div>
      </>
    );
  }

  // Failed, not empty. Everything below this point assumes real data, so the
  // whole dashboard stands aside rather than drawing a wall of zeroes that
  // reads as an accurate picture of an account with nothing in it.
  if (failed) {
    return (
      <>
        {header}
        <div className="mt-5">
          <ErrorState
            title="Couldn’t load your games."
            body="Your games are still there — this is us failing to fetch them, not an empty Loop."
            onRetry={() => {
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          />
        </div>
      </>
    );
  }

  const heroClass =
    "relative block overflow-hidden rounded-[22px] bg-c-court text-white p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-accent";

  // The court's lines, drawn large and faint behind the hero's words.
  const courtLines = (
    <svg
      viewBox="0 0 200 120"
      aria-hidden
      className="absolute -right-24 -top-6 w-72 text-white/12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="4" width="192" height="112" rx="2" />
      <path d="M100 4v112M44 4v112M156 4v112M44 60h112" />
    </svg>
  );

  return (
    <>
      <ScrollHeader title={firstName ?? "Home"} />
      {header}

      <div className="mt-5 flex flex-col gap-3">
        {/* ── Hero: the next game ────────────────────────────────────────── */}
        {nextGame ? (
          <Link href={`/games/${nextGame.id}`} className={`c-press ${heroClass}`}>
            {courtLines}
            <div className="relative">
              <div className="text-[0.875rem] font-medium text-white/85">
                Your next game · {countdown(nextGame.game_time)}
              </div>
              <div className="c-title text-[1.75rem] leading-[1.1] mt-8">
                {nextGame.venue}
              </div>
              <div className="text-[0.9375rem] text-white/85 mt-1.5">
                {posterWhen(nextGame.game_time)}
                {nextGame.location && ` · ${nextGame.location}`}
                {` · ${nextGame.skill_level}`}
              </div>
            </div>
          </Link>
        ) : (
          <div className={heroClass}>
            {courtLines}
            <div className="relative">
              <div className="c-title text-[1.75rem] leading-[1.1]">Nothing booked yet</div>
              <div className="text-[0.9375rem] text-white/85 mt-1.5">
                Your next game is a tap away.
              </div>
            </div>
          </div>
        )}

        {/* ── Find a game — the primary action ───────────────────────────── */}
        <Link
          href="/discover"
          className="c-press flex items-center gap-3.5 rounded-card px-4 py-3.5 bg-c-tint text-c-on-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-accent"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="flex-none">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="flex-1 min-w-0">
            <span className="block text-[1.0625rem] font-semibold">Find a game</span>
            <span className="block text-[0.875rem] opacity-85">
              Open games near you, at your level
            </span>
          </span>
          <ChevronRight />
        </Link>

        {/* ── The short list ─────────────────────────────────────────────── */}
        <div className="c-card divide-y divide-c-line overflow-hidden">
          <Row
            href="/connections"
            title="Connections"
            sub={
              connCount === 0
                ? "Build your circle"
                : `${connCount} ${connCount === 1 ? "friend" : "friends"} in your loop`
            }
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5M17 8.5a2.6 2.6 0 0 1 0 5M18 19c0-2.2-.7-3.7-2-4.6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <Row
            href="/leaderboard"
            title="Leaderboard"
            sub="See who’s on top"
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M10 20h4M12 13v7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
        </div>

        {/* ── Three quiet numbers ────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 px-1 pt-2">
          {[
            { value: rating != null ? String(rating) : "—", label: "Rating" },
            { value: String(upcoming.length), label: "Upcoming" },
            { value: String(connCount), label: "Mates" },
          ].map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="c-title text-[1.375rem] truncate">{s.value}</div>
              <div className="text-[0.8125rem] text-c-sub">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
