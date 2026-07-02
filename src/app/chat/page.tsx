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
import { MiniLoop } from "@/components/brand";
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
      <h1 className="font-display text-[28px] tracking-tight leading-tight text-ink mt-2 relative">
        Chat
      </h1>
      <p className="text-[13px] text-ink-secondary mt-1 mb-4">
        Your game conversations.
      </p>

      {loading ? (
        // Skeleton rows in the shape of the list — sunken, subtle pulse.
        <div className="mt-1 space-y-3">
          <div className="bg-sunken rounded-(--radius-card) h-[76px] animate-pulse" />
          <div className="bg-sunken rounded-(--radius-card) h-[76px] animate-pulse" />
        </div>
      ) : !loggedIn ? (
        // Not logged in — can't have any conversations to show.
        <div className="pl-card p-6 mt-6 flex flex-col items-center text-center gap-3">
          <MiniLoop size={40} />
          <div className="font-display text-[19px] text-ink">You&apos;re not logged in.</div>
          <div className="text-[13px] text-ink-secondary">
            Log in to see your game conversations.
          </div>
          <Link
            href="/login"
            className="mt-1 bg-accent text-white font-medium text-[15px] rounded-full px-5 py-2.5 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Log in
          </Link>
        </div>
      ) : conversations.length === 0 ? (
        // Logged in but in no games yet — the empty state.
        <div className="pl-card p-6 mt-6 flex flex-col items-center text-center gap-3">
          <MiniLoop size={40} />
          <div className="font-display text-[19px] text-ink">No conversations yet.</div>
          <div className="text-[13px] text-ink-secondary">
            Join a game to start chatting.
          </div>
          <Link
            href="/games"
            className="mt-1 bg-accent text-white font-medium text-[15px] rounded-full px-5 py-2.5 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Browse games
          </Link>
        </div>
      ) : (
        // The conversation list.
        <div className="mt-1">
          {conversations.map((c, i) => (
            <Link
              key={c.game.id}
              href={`/games/${c.game.id}/chat`}
              className="pl-card p-4 mb-3 flex items-center gap-3.5 pl-rise active:scale-[0.99] transition-transform duration-150 ease-out"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Little chat-bubble badge, in the soft accent. */}
              <span className="shrink-0 w-11 h-11 rounded-full bg-accent-soft text-accent flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
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
                  <div className="font-semibold text-[15px] text-ink truncate">
                    {c.game.venue}
                  </div>
                  <span className="text-[11px] text-ink-faint shrink-0">
                    {shortStamp(c.lastMessageAt)}
                  </span>
                </div>
                <div className="text-[13px] text-ink-secondary truncate">
                  {c.game.location}
                </div>
                <div
                  className={`text-[13px] truncate mt-0.5 ${
                    c.lastMessageBody ? "text-ink-secondary" : "text-ink-faint italic"
                  }`}
                >
                  {c.lastMessageBody ?? "No messages yet"}
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
