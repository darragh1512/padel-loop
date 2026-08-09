"use client";
// The "My Games" screen: every game the logged-in player is in — the ones they
// CREATED and the ones they've JOINED — filterable between the two. Cancelled
// games aren't hidden here (unlike the browse lists); they keep their place
// with the title struck through and an orange rail.
//
// Layout follows the prototype: a filter control under the title, then games
// grouped by when they happen, each one a ticket with a torn date stub.
//
// It reads the player client-side (same Supabase auth the rest of the app
// uses) and sends logged-out visitors to the login page.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { APP_TIME_ZONE } from "@/lib/time";
import { getGamesCreatedBy, getGamesJoinedBy, type Game } from "../games";

// A game is cancelled only when its status is literally "cancelled"; a blank
// status on older rows is treated as a normal, active game.
const isCancelled = (g: Game) =>
  (g.status ?? "").trim().toLowerCase() === "cancelled";

// A game plus which side of the screen it belongs to.
type MyGame = Game & { hosting: boolean };

type Filter = "All" | "Hosting" | "Joined";

/* The date stub: day-of-week, date, month — always on a Dublin clock, like
   every other time in the app. */
function stubParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dow: "—", day: "—", mon: "" };
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-IE", { timeZone: APP_TIME_ZONE, ...opts }).format(d);
  return {
    dow: fmt({ weekday: "short" }).toUpperCase(),
    day: fmt({ day: "2-digit" }),
    mon: fmt({ month: "short" }).toUpperCase(),
  };
}

function clockTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/* Is this game inside the current Dublin calendar month? */
function isThisMonth(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const key = (x: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
    }).format(x);
  return key(d) === key(new Date());
}

/* The section rule, with the group's count on the right. */
function Rule({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5 mx-0.5 mb-2.5">
      <span className="t-mono text-micro tracking-[0.2em] text-papel/72 whitespace-nowrap">
        {title}
      </span>
      <span className="flex-1 h-0.5 bg-papel/18" />
      <span className="t-eyebrow text-micro tracking-normal normal-case text-papel/50 whitespace-nowrap">
        {count} {count === 1 ? "game" : "games"}
      </span>
    </div>
  );
}

/* One game ticket: a coloured rail for its kind, a torn date stub, then the
   details. The whole ticket is the tap target. */
function GameTicket({ game }: { game: MyGame }) {
  const cancelled = isCancelled(game);
  const { dow, day, mon } = stubParts(game.game_time);

  return (
    <Link
      href={`/games/${game.id}`}
      className={`pl-card pl-press relative flex items-stretch overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima ${
        cancelled ? "opacity-75" : ""
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 inset-y-0 w-1.5 ${
          cancelled ? "bg-naranja" : game.hosting ? "bg-lima" : "bg-tinta/25"
        }`}
      />

      {/* The stub, torn off along a dashed perforation. */}
      <div className="flex-none w-13 text-center py-2.5 border-r-2 border-dashed border-tinta/20">
        <div className="t-mono text-tiny tracking-[0.14em] text-tinta/55">{dow}</div>
        <div className="t-display text-display-sm text-tinta">{day}</div>
        <div className="t-mono text-tiny tracking-[0.1em] text-tinta/55">{mon}</div>
      </div>

      <div className="flex-1 min-w-0 px-3 pt-2.75 pb-2.5">
        <div
          className={`t-display text-[0.9375rem] leading-[1.12] text-tinta ${
            cancelled ? "line-through" : ""
          }`}
        >
          {game.venue}
        </div>

        <div className="flex items-center gap-2 mt-1.25">
          <span className="t-eyebrow text-micro tracking-[0.04em] normal-case text-tinta/60 truncate">
            {clockTime(game.game_time)}
            {game.location ? ` · ${game.location}` : ""}
          </span>
          <span
            className={`t-mono flex-none ml-auto text-[0.5625rem] tracking-[0.12em] px-2 py-1 rounded-pill whitespace-nowrap border-2 border-tinta ${
              cancelled ? "bg-naranja text-white" : "bg-transparent text-tinta"
            }`}
          >
            {cancelled ? "Cancelled" : game.skill_level}
          </span>
        </div>

        {game.hosting && !cancelled && (
          <div className="flex justify-end mt-2">
            <span className="t-mono text-[0.5625rem] tracking-[0.14em] text-tinta bg-lima border-2 border-tinta rounded-stamp px-1.5 py-0.5">
              Host
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function MyGamesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<MyGame[]>([]);
  const [filter, setFilter] = useState<Filter>("All");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) {
        router.replace("/login");
        return;
      }

      const [createdGames, joinedGames] = await Promise.all([
        getGamesCreatedBy(uid),
        getGamesJoinedBy(uid),
      ]);
      if (!active) return;

      // Creating a game also adds you as its first player, so created games
      // show up in the joined list too. Keep each game once: "Joined" means
      // games someone else created that you joined.
      const createdIds = new Set(createdGames.map((g) => String(g.id)));
      setGames([
        ...createdGames.map((g) => ({ ...g, hosting: true })),
        ...joinedGames
          .filter((g) => !createdIds.has(String(g.id)))
          .map((g) => ({ ...g, hosting: false })),
      ]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const counts = useMemo(
    () => ({
      All: games.length,
      Hosting: games.filter((g) => g.hosting).length,
      Joined: games.filter((g) => !g.hosting).length,
    }),
    [games],
  );

  // Sorted soonest first, then split into this month and everything after.
  const sections = useMemo(() => {
    const visible = games
      .filter((g) =>
        filter === "All" ? true : filter === "Hosting" ? g.hosting : !g.hosting,
      )
      .sort((a, b) => a.game_time.localeCompare(b.game_time));
    return [
      { title: "This month", games: visible.filter((g) => isThisMonth(g.game_time)) },
      { title: "Later", games: visible.filter((g) => !isThisMonth(g.game_time)) },
    ].filter((s) => s.games.length > 0);
  }, [games, filter]);

  if (loading) {
    return (
      <main className="px-5 pt-3 relative">
        <h1 className="t-display text-[clamp(1.75rem,8vw,2.125rem)] leading-[0.92] text-white mt-2">
          My games<span className="text-naranja">.</span>
        </h1>
        <Skeleton className="rounded-[3px] h-11 w-full mt-3.5" />
        <div className="mt-6 flex flex-col gap-2.5">
          <Skeleton className="rounded-card h-21" />
          <Skeleton className="rounded-card h-21" />
          <Skeleton className="rounded-card h-21" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="px-5 pt-3 relative">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="t-eyebrow text-micro text-lima mb-1.25">
            {counts.All} {counts.All === 1 ? "game" : "games"} · {counts.Hosting} hosting
          </div>
          <h1 className="t-display text-[clamp(1.75rem,8vw,2.125rem)] leading-[0.92] text-white">
            My games<span className="text-naranja">.</span>
          </h1>
        </div>
        <Link
          href="/create"
          className="t-mono pena-riso flex-none flex items-center gap-1.75 bg-lima text-tinta border-2 border-tinta rounded-[3px] px-2.75 py-2 text-micro tracking-[0.1em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papel"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          </svg>
          New
        </Link>
      </div>

      {/* ── Filter ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 mt-3.5 bg-[rgb(6_20_58/0.35)] border-2 border-papel/22 rounded-[3px] p-1">
        {(["All", "Hosting", "Joined"] as Filter[]).map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={on}
              className={`t-mono flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-stamp text-micro transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lima ${
                on ? "bg-papel text-tinta" : "text-papel/65 hover:text-papel"
              }`}
            >
              {f}
              <span
                className={`text-[0.5625rem] px-1.25 py-px rounded-pill ${
                  on ? "bg-tinta text-lima" : "bg-papel/16 text-papel/70"
                }`}
              >
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── The board ────────────────────────────────────────────────────── */}
      <div className="mt-4">
        {sections.length > 0 ? (
          sections.map((s) => (
            <div key={s.title} className="mb-4.5">
              <Rule title={s.title} count={s.games.length} />
              <div className="flex flex-col gap-2.5">
                {s.games.map((game) => (
                  <GameTicket key={game.id} game={game} />
                ))}
              </div>
            </div>
          ))
        ) : filter === "Hosting" ? (
          <EmptyState
            title="Run your own game."
            body="Set one up once — the Loop fills the spots."
            action={
              <ButtonLink href="/create" variant="secondary" size="sm">
                Create a game
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="Your next game is out there."
            body="Take a spot in a game near you, at your level."
            action={
              <ButtonLink href="/discover" size="sm">
                Find a game
              </ButtonLink>
            }
          />
        )}
      </div>

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
