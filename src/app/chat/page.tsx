"use client";
// The Chat tab (/chat): a list of the logged-in person's game and group
// conversations.
//
// This screen is JUST a list. It does no chat logic of its own — tapping a row
// opens that conversation's full-screen page (/games/[id]/chat or
// /groups/[id]/chat), which reuses the shared ChatThread component. All
// sending, live updates, access checks, etc. still live in that component.
//
// Layout follows the prototype: search and a Games/Groups filter under the
// title, then the conversations grouped by kind, each a card with a status
// rail and a club-tone avatar.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { APP_TIME_ZONE, dublinDateKey } from "@/lib/time";
import { getConversationsFor, formatGameTime, type Conversation } from "../games";

// A short timestamp for the last message: the clock time if it was today
// (e.g. "14:32"), otherwise the date (e.g. "10 Jun"). Empty if there's none.
// Dublin clock and Dublin calendar day, like every other time in the app.
function shortStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const sameDay = dublinDateKey(d) === dublinDateKey(new Date());
  return sameDay
    ? d.toLocaleTimeString("en-GB", {
        timeZone: APP_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : d.toLocaleDateString("en-GB", {
        timeZone: APP_TIME_ZONE,
        day: "numeric",
        month: "short",
      });
}

// The id + link target for a conversation, whichever kind it is.
function conversationKey(c: Conversation): string {
  return c.kind === "game" ? c.game.id : c.group.id;
}
function conversationHref(c: Conversation): string {
  return c.kind === "game"
    ? `/games/${c.game.id}/chat`
    : `/groups/${c.group.id}/chat`;
}

// How many Dublin calendar days until this game — negative once it's past.
function daysUntil(iso: string): number | null {
  const key = dublinDateKey(iso);
  const today = dublinDateKey(new Date());
  if (!key || !today) return null;
  const ms = Date.parse(`${key}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

// A game counts as IMMINENT — the one row that shouts — when it's today or
// tomorrow. That's the closest honest stand-in for the prototype's "live"
// state; we have no unread or presence data to drive it from.
function imminent(c: Conversation): boolean {
  if (c.kind !== "game") return false;
  const d = daysUntil(c.game.game_time);
  return d != null && d >= 0 && d <= 1;
}

// The club tones, picked deterministically from the conversation's id so a
// given chat always wears the same colour.
const TONES = [
  { bg: "bg-naranja", fg: "text-white" },
  { bg: "bg-pista", fg: "text-white" },
  { bg: "bg-lima", fg: "text-tinta" },
  { bg: "bg-tinta", fg: "text-papel" },
];
function toneFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

// Up to two initials from a venue or group name ("Malahide Padel Club" → MP).
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/* One conversation card — shared by games AND groups, and by the active list
   and the collapsed "Past games" list below it. `muted` dials back opacity
   for past rows only. */
function ConversationRow({ c, muted = false }: { c: Conversation; muted?: boolean }) {
  const title = c.kind === "game" ? c.game.venue : c.group.name;
  const soon = imminent(c);
  const hasMessages = c.lastMessageBody != null;
  const tone = toneFor(conversationKey(c));

  let meta: string;
  if (c.kind === "game") {
    const d = daysUntil(c.game.game_time);
    const when =
      d === 0
        ? "Starts today"
        : d === 1
          ? "Starts tomorrow"
          : d != null && d > 1 && d <= 6
            ? `Starts in ${d} days`
            : formatGameTime(c.game.game_time);
    meta = c.game.location ? `${when} · ${c.game.location}` : when;
  } else {
    meta = `${c.memberCount} member${c.memberCount === 1 ? "" : "s"}`;
  }

  return (
    <Link
      href={conversationHref(c)}
      className={`pl-card pl-press relative flex items-center gap-3 py-2.75 pr-3.25 pl-4 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima ${
        muted ? "opacity-60" : ""
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 inset-y-0 w-1.5 ${
          soon ? "bg-naranja" : hasMessages ? "bg-lima" : "bg-tinta/20"
        }`}
      />

      <span
        aria-hidden
        className={`flex-none size-10 rounded-pill grid place-items-center t-display text-[0.8125rem] border-2 border-tinta ${tone.bg} ${tone.fg}`}
      >
        {initialsFor(title)}
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="t-display text-[0.9375rem] leading-[1.15] text-tinta truncate">
            {title}
          </span>
          <span className="t-eyebrow flex-none ml-auto text-tiny tracking-[0.06em] normal-case text-tinta/50 whitespace-nowrap">
            {shortStamp(c.lastMessageAt)}
          </span>
        </span>

        <span
          className={`block text-tiny mt-0.75 truncate ${
            soon ? "t-mono text-naranja" : "t-eyebrow tracking-[0.08em] text-tinta/55"
          }`}
        >
          {meta}
        </span>

        <span
          className={`block text-label leading-tight truncate mt-1.25 ${
            hasMessages ? "text-tinta font-semibold" : "text-tinta/50"
          }`}
        >
          {c.lastMessageBody ?? "No messages yet — say hello"}
        </span>
      </span>
    </Link>
  );
}

/* The section rule. */
function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mx-0.5 mb-2.25">
      <span className="t-mono text-tiny tracking-[0.2em] text-papel/72 whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-0.5 bg-papel/18" />
    </div>
  );
}

type Filter = "All" | "Games" | "Groups";

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pastOpen, setPastOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");

  // On load: find who's logged in and fetch their conversations.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!active) return;
      setLoggedIn(uid != null);
      if (uid) {
        const convos = await getConversationsFor(uid);
        if (!active) return;
        setConversations(convos);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Active/past split, derived purely from game_time — no schema change, no
  // second query. Boundary is DUBLIN midnight (not "now"), so a game later
  // today stays active all day; only games before today (on a Dublin
  // calendar) move to Past. Groups have no game_time and must always stay
  // active — the `c.kind === "game"` guard short-circuits isPast to false
  // for them.
  const todayKey = dublinDateKey(new Date());
  const isPast = (c: Conversation) => {
    if (c.kind !== "game") return false;
    const key = dublinDateKey(c.game.game_time);
    return key !== "" && key < todayKey; // unreadable time → keep it active
  };
  const activeConversations = conversations.filter((c) => !isPast(c));
  const pastConversations = conversations.filter((c) => isPast(c));

  const counts = useMemo(
    () => ({
      All: activeConversations.length,
      Games: activeConversations.filter((c) => c.kind === "game").length,
      Groups: activeConversations.filter((c) => c.kind === "group").length,
    }),
    [activeConversations],
  );

  const sections = useMemo(() => {
    const visible = activeConversations.filter((c) =>
      filter === "All"
        ? true
        : filter === "Games"
          ? c.kind === "game"
          : c.kind === "group",
    );
    return [
      { title: "Game chats", rows: visible.filter((c) => c.kind === "game") },
      { title: "Groups", rows: visible.filter((c) => c.kind === "group") },
    ].filter((s) => s.rows.length > 0);
  }, [activeConversations, filter]);

  return (
    <main className="px-5 pt-3 relative">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="t-eyebrow text-tiny text-lima mb-1">Club noticeboard</div>
          <h1 className="t-display text-[clamp(1.75rem,8vw,2.125rem)] leading-[0.92] text-white">
            Chat<span className="text-naranja">.</span>
          </h1>
        </div>
        {!loading && loggedIn && (
          <Link
            href="/groups/new"
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
            Group
          </Link>
        )}
      </div>

      {!loading && loggedIn && (
        <>
          {/* Search — the app's real player search lives at /search. */}
          <Link
            href="/search"
            className="flex items-center gap-2.25 mt-3.25 bg-[rgb(6_20_58/0.35)] border-2 border-papel/22 rounded-[3px] px-2.75 py-2.25 hover:border-papel/40 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              aria-hidden
              className="flex-none text-papel/60"
            >
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2.2" />
              <path
                d="M16 16l4 4"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            <span className="t-eyebrow text-label tracking-[0.04em] normal-case text-papel/50">
              Search people and games
            </span>
          </Link>

          {/* Filter */}
          <div className="flex gap-1.5 mt-2.25 bg-[rgb(6_20_58/0.35)] border-2 border-papel/22 rounded-[3px] p-1">
            {(["All", "Games", "Groups"] as Filter[]).map((f) => {
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
        </>
      )}

      {/* ── The list ─────────────────────────────────────────────────────── */}
      <div className="mt-4">
        {loading ? (
          <div className="flex flex-col gap-2.25">
            <Skeleton className="rounded-card h-19" />
            <Skeleton className="rounded-card h-19" />
          </div>
        ) : !loggedIn ? (
          <EmptyState
            title="Your conversations live here."
            body="Log in and every game you join brings its group chat with it."
            action={
              <ButtonLink href="/login" size="sm">
                Log in
              </ButtonLink>
            }
          />
        ) : sections.length === 0 ? (
          <EmptyState
            title="No conversations yet."
            body="Join a game and its group chat appears here."
            action={
              <ButtonLink href="/discover" size="sm">
                Find a game
              </ButtonLink>
            }
          />
        ) : (
          sections.map((s) => (
            <div key={s.title} className="mb-4">
              <Rule>{s.title}</Rule>
              <div className="flex flex-col gap-2.25">
                {s.rows.map((c) => (
                  <ConversationRow key={conversationKey(c)} c={c} />
                ))}
              </div>
            </div>
          ))
        )}

        {/* Past game chats — the dashed drawer at the foot of the board. */}
        {!loading && loggedIn && pastConversations.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setPastOpen((v) => !v)}
              aria-expanded={pastOpen}
              className="t-mono w-full flex items-center justify-between gap-2.5 bg-white/8 hover:bg-white/14 border-2 border-dashed border-papel/35 rounded-card px-3.5 py-3.25 text-micro tracking-[0.14em] text-papel/72 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
            >
              Past game chats
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                aria-hidden
                className={`transition-transform duration-150 ease-out ${
                  pastOpen ? "rotate-180" : ""
                }`}
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {pastOpen && (
              <div className="flex flex-col gap-2.25 mt-2.5">
                {pastConversations.map((c) => (
                  <ConversationRow key={conversationKey(c)} c={c} muted />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
