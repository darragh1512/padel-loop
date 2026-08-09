"use client";
// The Chat tab (/chat): a list of the logged-in person's game conversations.
//
// This screen is JUST a list. It does no chat logic of its own — tapping a row
// opens that game's full-screen chat page (/games/[id]/chat), which reuses the
// shared ChatThread component. All sending, live updates, access checks, etc.
// still live in that one thread component.

import { useEffect, useState } from "react";
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

// One conversation row — shared by games AND groups, and by the active list
// and the collapsed "Past games" list below it (games only; groups are always
// active). `muted` dials back opacity for past rows only; the card itself is
// identical either way — only the title and meta line differ by kind.
function ConversationRow({
  c,
  i,
  muted = false,
}: {
  c: Conversation;
  i: number;
  muted?: boolean;
}) {
  const title = c.kind === "game" ? c.game.venue : c.group.name;
  const meta =
    c.kind === "game"
      ? `${c.game.location} · ${formatGameTime(c.game.game_time)}`
      : `${c.memberCount} member${c.memberCount === 1 ? "" : "s"}`;

  return (
    <Link
      href={conversationHref(c)}
      className={`pl-card pl-press pl-rise p-4 mb-3 flex items-center gap-3.5 hover:bg-lima/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima ${
        muted ? "opacity-60" : ""
      }`}
      style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
    >
      {/* Little chat-bubble badge — an outlined paper circle. */}
      <span className="shrink-0 size-11 rounded-pill border-[1.5px] border-tinta text-tinta flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-5">
          <path
            d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-body font-extrabold text-tinta truncate">
            {title}
          </div>
          <span className="t-mono text-[9px] tracking-[0.08em] text-tinta/45 shrink-0">
            {shortStamp(c.lastMessageAt)}
          </span>
        </div>
        <div className="t-mono text-[9px] tracking-[0.1em] text-tinta/70 truncate mt-0.5">
          {meta}
        </div>
        <div
          className={`text-label font-medium truncate mt-1 ${
            c.lastMessageBody ? "text-tinta/70" : "text-tinta/45"
          }`}
        >
          {c.lastMessageBody ?? "No messages yet — say hello"}
        </div>
      </div>
    </Link>
  );
}

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pastOpen, setPastOpen] = useState(false);

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

  return (
    <main className="px-5 pt-6 relative">
      <p className="t-mono text-micro text-papel/80 mt-2">Club noticeboard</p>
      <h1 className="t-display text-display-md text-papel mt-1.5">Chat</h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        Your game and group conversations.
      </p>

      {!loading && loggedIn && (
        <Link
          href="/groups/new"
          className="flex items-center gap-2.5 pl-surface rounded-full px-4 py-2.5 mb-4 text-body font-medium text-tinta/45 active:scale-[0.99] transition-transform duration-150 ease-out"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New group
        </Link>
      )}

      {loading ? (
        // Skeleton rows in the shape of the conversation list.
        <div className="mt-1 space-y-3">
          <Skeleton className="rounded-card h-19" />
          <Skeleton className="rounded-card h-19" />
        </div>
      ) : !loggedIn ? (
        // Not logged in — can't have any conversations to show.
        <div className="mt-2">
          <EmptyState
            title="Your conversations live here."
            body="Log in and every game you join brings its group chat with it."
            action={
              <ButtonLink href="/login" size="sm">
                Log in
              </ButtonLink>
            }
          />
        </div>
      ) : activeConversations.length === 0 ? (
        // Logged in but in no CURRENT games — the empty state. (Past games,
        // if any, still render in the collapsed section below.)
        <div className="mt-2">
          <EmptyState
            title="No conversations yet."
            body="Join a game and its group chat appears here."
            action={
              <ButtonLink href="/discover" size="sm">
                Find a game
              </ButtonLink>
            }
          />
        </div>
      ) : (
        // The active conversation list.
        <div className="mt-1">
          {activeConversations.map((c, i) => (
            <ConversationRow key={conversationKey(c)} c={c} i={i} />
          ))}
        </div>
      )}

      {!loading && loggedIn && pastConversations.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setPastOpen((v) => !v)}
            aria-expanded={pastOpen}
            className="pl-card pl-press w-full flex items-center justify-between gap-2 px-4 py-2.5"
          >
            <span className="t-mono text-micro tracking-[0.14em] text-tinta/60">
              Past games
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className={`text-tinta/60 transition-transform duration-150 ease-out ${
                pastOpen ? "rotate-180" : ""
              }`}
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {pastOpen && (
            <div className="mt-3">
              {pastConversations.map((c, i) => (
                <ConversationRow key={conversationKey(c)} c={c} i={i} muted />
              ))}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
