"use client";
// The per-game chat thread. Used in two places, same logic both times:
//  • embedded on the game detail page (default) — a card under the game info
//  • full-screen on /games/[id]/chat (fullScreen) — WhatsApp-style, fills the
//    screen with the composer pinned to the bottom
//
// It only works for people who have JOINED or CREATED the game. Embedded, a
// non-member sees a short note; full-screen, they're sent to `redirectTo`.
//
// What it does:
//  • loads this game's messages (oldest at top, newest at the bottom)
//  • shows YOUR messages on the right in the sage accent, others' on the left
//    on a sunken bone surface
//  • lets you type and send a message; empty messages are ignored and the box
//    is cleared after sending
//  • listens for new messages live (Supabase Realtime) so they appear without a
//    refresh, and stops listening when you leave the page
//  • keeps the view scrolled to the newest message

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PlayerAvatar from "@/components/PlayerAvatar";
import { SectionLabel } from "@/components/ui";
import {
  canUserChat,
  getMessages,
  sendMessage,
  type ChatMessage,
} from "../../games";

// Turn a stored timestamp into a short clock time like "14:32". Uses the
// phone's local time, which is what people expect for chat ("when did they
// send this?"). Falls back to empty text if the value isn't a real date.
function shortTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ChatThread({
  gameId,
  fullScreen = false,
  redirectTo,
}: {
  gameId: string;
  // When true, render edge-to-edge to fill a full-screen page: no section
  // label, no card chrome — the messages area grows to fill its parent and the
  // composer sits at the very bottom. Default (false) is the embedded card used
  // on the game detail page.
  fullScreen?: boolean;
  // When set, anyone who isn't allowed to chat is sent here instead of seeing
  // the inline "join to chat" note. Used by the full-screen page.
  redirectTo?: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [canChat, setCanChat] = useState(false);
  const [ready, setReady] = useState(false); // finished the access check
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Jump the message list to the newest message (its bottom).
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Pull the latest messages from the database into the screen.
  const reload = useCallback(async () => {
    const msgs = await getMessages(gameId);
    setMessages(msgs);
  }, [gameId]);

  // On first load: find who's logged in, check whether they're allowed to chat,
  // and if so load the messages and start listening for new ones.
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!active) return;
      setUserId(uid);

      const allowed = uid != null && (await canUserChat(gameId, uid));
      if (!active) return;
      setCanChat(allowed);
      setReady(true);
      if (!allowed) return;

      await reload();

      // Live updates: listen for new rows in "messages" for THIS game only.
      // Whenever one arrives (from anyone), refresh the thread.
      channel = supabase
        .channel(`messages:game:${gameId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `game_id=eq.${gameId}`,
          },
          () => {
            reload();
          },
        )
        .subscribe();
    })();

    // Cleanup when leaving the page: stop the live listener.
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [gameId, reload]);

  // Whenever the messages change (first load or a new one arrives), keep the
  // newest message in view.
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Full-screen page only: send people who can't chat to the detail page,
  // rather than showing the inline note.
  useEffect(() => {
    if (ready && !canChat && redirectTo) {
      router.replace(redirectTo);
    }
  }, [ready, canChat, redirectTo, router]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (body.length === 0 || !userId || sending) return; // never send empty

    setSending(true);
    setError(null);
    const result = await sendMessage(gameId, userId, body);
    if ("error" in result) {
      setError("Couldn't send that message. Please try again.");
      setSending(false);
      return;
    }
    setText(""); // clear the box
    setSending(false);
    await reload(); // show it straight away (Realtime also picks it up)
  }

  // Still checking access — render nothing to avoid a flash of the wrong state.
  if (!ready) return null;

  // Not a player or the creator (or logged out).
  if (!canChat) {
    // Full-screen page redirects (see the effect above) — render nothing here.
    if (redirectTo) return null;
    // Embedded: show a short note in place of the box.
    return (
      <>
        <SectionLabel>Group chat</SectionLabel>
        <div className="pl-surface rounded-card px-4 py-5 text-center">
          <p className="text-label text-ink-secondary">
            Take a spot in this game and the group chat opens up.
          </p>
        </div>
      </>
    );
  }

  // ── Shared pieces, rendered the same in both layouts ──────────────────────

  const messageList =
    messages.length === 0 ? (
      <p className="text-label text-ink-secondary text-center my-6">
        No messages yet — say hello to your group.
      </p>
    ) : (
      messages.map((m) => {
        const mine = m.user_id === userId;
        return (
          <div
            key={m.id}
            className={`flex flex-col max-w-[80%] ${
              mine ? "items-end self-end" : "items-start self-start"
            }`}
          >
            <div className="flex items-center gap-2 mb-1 px-1">
              <Link
                href={`/players/${m.user_id}`}
                aria-label={m.senderName}
                className="shrink-0 active:opacity-70 transition-opacity"
              >
                <PlayerAvatar
                  userId={m.user_id}
                  avatarUrl={m.senderAvatarUrl}
                  name={m.senderName}
                  className="size-5"
                />
              </Link>
              <Link
                href={`/players/${m.user_id}`}
                className="text-label font-medium text-ink-secondary rounded-field active:opacity-70 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {mine ? "You" : m.senderName}
              </Link>
              <span className="text-micro text-ink-faint">
                {shortTime(m.created_at)}
              </span>
            </div>
            <div
              className={
                mine
                  ? "bg-accent text-on-accent rounded-card rounded-br-md px-3.5 py-2 text-body leading-snug break-words"
                  : "bg-sunken text-ink rounded-card rounded-bl-md px-3.5 py-2 text-body leading-snug break-words"
              }
            >
              {m.body}
            </div>
          </div>
        );
      })
    );

  // The input + send button. Identical for both layouts; full-screen just adds
  // a little safe-area padding so it clears the phone's home indicator.
  const composer = (
    <form
      onSubmit={handleSend}
      className={`flex items-center gap-2 border-t border-line p-3 bg-surface ${
        fullScreen ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : ""
      }`}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Message your group…"
        aria-label="Type a message"
        className="flex-1 pl-surface rounded-pill px-4 py-2.5 text-body text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors duration-150 ease-out"
      />
      <button
        type="submit"
        disabled={sending || text.trim().length === 0}
        aria-label="Send message"
        className="pl-press shrink-0 size-10 rounded-pill bg-accent text-on-accent hover:bg-accent-strong inline-flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 12l16-7-7 16-2.5-6.5L4 12z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );

  // ── Full-screen layout (the /games/[id]/chat page) ────────────────────────
  // Fills its parent's height; messages scroll, composer is pinned at the bottom.
  if (fullScreen) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-4 py-4"
        >
          {messageList}
        </div>
        <p
          aria-live="polite"
          className={`text-center text-label text-danger py-1 ${error ? "" : "hidden"}`}
        >
          {error}
        </p>
        {composer}
      </div>
    );
  }

  // ── Embedded card layout (the game detail page) — unchanged ───────────────
  return (
    <>
      <SectionLabel>Group chat</SectionLabel>
      <div className="pl-card overflow-hidden flex flex-col">
        {/* Messages — this area scrolls on its own; newest stays at the bottom. */}
        <div
          ref={scrollRef}
          className="flex flex-col gap-3 px-4 py-4 overflow-y-auto max-h-[55vh] min-h-[120px]"
        >
          {messageList}
        </div>
        {composer}
      </div>
      <p
        aria-live="polite"
        className={`text-center text-label text-danger mt-2 ${error ? "" : "hidden"}`}
      >
        {error}
      </p>
    </>
  );
}
