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
import { getConversationsFor, type Conversation } from "../games";

// A short timestamp for the last message: the clock time if it was today
// (e.g. "14:32"), otherwise the date (e.g. "10 Jun"). Empty if there's none.
function shortStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

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

  return (
    <main className="px-5 pt-6 relative">
      <p className="t-mono text-micro text-papel/80 mt-2">Club noticeboard</p>
      <h1 className="t-display text-display-md text-papel mt-1.5">Chat</h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        Your game conversations.
      </p>

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
      ) : conversations.length === 0 ? (
        // Logged in but in no games yet — the empty state.
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
        // The conversation list.
        <div className="mt-1">
          {conversations.map((c, i) => (
            <Link
              key={c.game.id}
              href={`/games/${c.game.id}/chat`}
              className="pl-card pl-press pl-rise p-4 mb-3 flex items-center gap-3.5 hover:bg-lima/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
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
                    {c.game.venue}
                  </div>
                  <span className="t-mono text-[9px] tracking-[0.08em] text-tinta/45 shrink-0">
                    {shortStamp(c.lastMessageAt)}
                  </span>
                </div>
                <div className="t-mono text-[9px] tracking-[0.1em] text-tinta/70 truncate mt-0.5">
                  {c.game.location}
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
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
