"use client";
// The chat thread — shared by GAME chats and GROUP chats. Pass exactly one of
// gameId / groupId; everything else about it is identical either way. Used in
// three places, same logic every time:
//  • embedded on the game detail page (default, gameId only) — a card under
//    the game info
//  • full-screen on /games/[id]/chat (gameId, fullScreen) — WhatsApp-style
//  • full-screen on /groups/[id]/chat (groupId, fullScreen) — same layout
//
// It only works for people who have JOINED/CREATED the game, or are a member
// of the group. Embedded, a non-member sees a short note; full-screen, they're
// sent to `redirectTo`.
//
// What it does:
//  • loads this thread's messages (oldest at top, newest at the bottom)
//  • shows YOUR messages on the right in the lima accent, others' on the left
//    on papel
//  • lets you type and send a message; empty messages are ignored and the box
//    is cleared after sending
//  • listens for new messages live (Supabase Realtime) so they appear without a
//    refresh, and stops listening when you leave the page
//  • keeps the view scrolled to the newest message

import {
  Fragment,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { APP_TIME_ZONE } from "@/lib/time";
import PlayerAvatar from "@/components/PlayerAvatar";
import { SectionLabel } from "@/components/ui";
import { canUserChat, getMessages, sendMessage } from "../../games";
import {
  canUserChatInGroup,
  getGroupMessages,
  sendGroupMessage,
} from "../../groups";

// The fields ChatThread actually renders — both ChatMessage (games.ts) and
// GroupChatMessage (groups.ts) satisfy this, so either can be loaded straight
// into the same state without converting one into the other.
type ThreadMessage = {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
  senderName: string;
  senderAvatarUrl: string | null;
};

// A non-message item the caller wants merged into the thread by timestamp —
// e.g. a group's proposed-game cards. `createdAt` decides where it lands
// among the messages; `content` is rendered as-is (it owns its own layout —
// unlike a message bubble, it isn't wrapped or constrained to 80% width).
// This is the ONLY way anything other than a real message enters the render
// list — the message model itself (loading, access check, Realtime) never
// changes because of it.
export type InlineThreadItem = {
  id: string;
  createdAt: string;
  content: ReactNode;
};

// Turn a stored timestamp into a short clock time like "14:32", on a Dublin
// clock — the same fixed timezone every other time in the app renders in
// (see src/lib/time.ts). Falls back to empty text if the value isn't a real
// date.
function shortTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ChatThread({
  gameId,
  groupId,
  fullScreen = false,
  redirectTo,
  inlineItems = [],
}: {
  // Exactly one of these is passed by any given caller — whichever one
  // decides everywhere below whether this is a game thread or a group one.
  gameId?: string;
  groupId?: string;
  // When true, render edge-to-edge to fill a full-screen page: no section
  // label, no card chrome — the messages area grows to fill its parent and the
  // composer sits at the very bottom. Default (false) is the embedded card used
  // on the game detail page.
  fullScreen?: boolean;
  // When set, anyone who isn't allowed to chat is sent here instead of seeing
  // the inline "join to chat" note. Used by the full-screen pages.
  redirectTo?: string;
  // Extra non-message items merged into the render by timestamp (e.g. a
  // group's proposed games). Empty by default — inert for game threads,
  // which never pass this.
  inlineItems?: InlineThreadItem[];
}) {
  const isGroup = groupId != null;
  const threadId = (isGroup ? groupId : gameId)!;

  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [canChat, setCanChat] = useState(false);
  const [ready, setReady] = useState(false); // finished the access check
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
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
    const msgs = isGroup
      ? await getGroupMessages(threadId)
      : await getMessages(threadId);
    setMessages(msgs);
  }, [isGroup, threadId]);

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

      const allowed =
        uid != null &&
        (await (isGroup
          ? canUserChatInGroup(threadId, uid)
          : canUserChat(threadId, uid)));
      if (!active) return;
      setCanChat(allowed);
      setReady(true);
      if (!allowed) return;

      await reload();

      // Live updates: listen for new rows in "messages" for THIS thread only.
      // Whenever one arrives (from anyone), refresh the thread.
      const idColumn = isGroup ? "group_id" : "game_id";
      channel = supabase
        .channel(`messages:${isGroup ? "group" : "game"}:${threadId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `${idColumn}=eq.${threadId}`,
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
  }, [isGroup, threadId, reload]);

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
    const result = isGroup
      ? await sendGroupMessage(threadId, userId, body)
      : await sendMessage(threadId, userId, body);
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
          <p className="text-label font-medium text-tinta/70">
            Take a spot in this game and the group chat opens up.
          </p>
        </div>
      </>
    );
  }

  // ── Shared pieces, rendered the same in both layouts ──────────────────────

  // Every message becomes a { key, createdAt, node } entry alongside any
  // inlineItems the caller passed, then the combined list is sorted by
  // timestamp once. This is purely a render-time merge — the messages state,
  // loading, access check, and Realtime subscription above are all untouched
  // by inlineItems existing or not.
  const messageEntries = messages.map((m) => {
    const mine = m.user_id === userId;
    return {
      key: `msg-${m.id}`,
      createdAt: m.created_at,
      node: (
        <div
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
              className="t-mono text-[9px] tracking-[0.1em] text-tinta/70 rounded-field active:opacity-70 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
            >
              {mine ? "You" : m.senderName}
            </Link>
            <span className="t-mono text-[9px] tracking-[0.06em] text-tinta/45">
              {shortTime(m.created_at)}
            </span>
          </div>
          {/* Paper scraps on the board: yours get the lima print pass. */}
          <div
            className={
              mine
                ? "bg-lima text-tinta border-[1.5px] border-tinta rounded-card rounded-br-none px-3.5 py-2 text-body font-medium leading-snug break-words"
                : "bg-papel text-tinta border-[1.5px] border-tinta rounded-card rounded-bl-none px-3.5 py-2 text-body font-medium leading-snug break-words"
            }
          >
            {m.body}
          </div>
        </div>
      ),
    };
  });

  const combinedEntries = [
    ...messageEntries,
    ...inlineItems.map((item) => ({
      key: `inline-${item.id}`,
      createdAt: item.createdAt,
      node: item.content,
    })),
  ].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const messageList =
    combinedEntries.length === 0 ? (
      <p className="text-label font-medium text-tinta/70 text-center my-6">
        No messages yet — say hello to your group. ¿Jugamos?
      </p>
    ) : (
      combinedEntries.map((entry) => (
        <Fragment key={entry.key}>{entry.node}</Fragment>
      ))
    );

  // The input + send button. Identical for both layouts; full-screen just adds
  // a little safe-area padding so it clears the phone's home indicator.
  const composer = (
    <form
      onSubmit={handleSend}
      className={`flex items-center gap-2 border-t-2 border-tinta p-3 bg-papel ${
        fullScreen ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : ""
      }`}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Message your group…"
        aria-label="Type a message"
        className="flex-1 pl-surface rounded-pill px-4 py-2.5 text-body font-medium text-tinta placeholder:text-tinta/45 focus:outline-none focus:border-naranja transition-colors duration-150 ease-out"
      />
      <button
        type="submit"
        disabled={sending || text.trim().length === 0}
        aria-label="Send message"
        className="pena-riso pl-hit shrink-0 size-10 rounded-pill bg-naranja text-papel border-2 border-tinta inline-flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
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
          className={`text-center text-label font-semibold text-naranja-d py-1 ${error ? "" : "hidden"}`}
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
        className={`text-center text-label font-semibold text-papel bg-naranja-d rounded-field px-3 py-1.5 mt-2 ${error ? "" : "hidden"}`}
      >
        {error}
      </p>
    </>
  );
}
