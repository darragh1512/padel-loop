"use client";
// A conversation, shared by GAME chats and GROUP chats. Pass exactly one of
// gameId / groupId; everything else about it is identical either way.
//
// It only works for people who have JOINED/CREATED the game, or are a member of
// the group. Anyone else is sent to `redirectTo`.
//
// What it does:
//  • loads this thread's messages (oldest at top, newest at the bottom)
//  • shows YOUR messages on the right in blue, others' on the left
//  • lets you type and send a message; empty messages are ignored. A sent
//    message appears at once, faded with "Sending…", and the box clears; if the
//    database refuses it, it disappears, the words go back in the box and a
//    short note says so
//  • listens for new messages live (Supabase Realtime) so they appear without a
//    refresh, and stops listening when you leave the page
//  • keeps the view scrolled to the newest message

import { Fragment, type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import ReportDialog from "@/components/ReportDialog";
import { dublinDateKey } from "@/lib/time";
import { supabase } from "@/lib/supabaseClient";
import { getSignedInUser } from "@/lib/session";
import { clockTime, dayHeading } from "@/lib/when";
import { getBlockedIds } from "@/app/blocks";
import { canUserChat, getMessages, sendMessage } from "../../games";
import { canUserChatInGroup, getGroupMessages, sendGroupMessage } from "../../groups";

// The fields this renders — both ChatMessage (games.ts) and GroupChatMessage
// (groups.ts) satisfy this.
type ThreadMessage = {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
  senderName: string;
  senderAvatarUrl: string | null;
};

// A non-message item merged into the thread by timestamp, such as a game proposed
// in a group. This is the ONLY way anything other than a real message enters the
// list: loading, access checks and live updates never change because of it.
export type InlineThreadItem = {
  id: string;
  createdAt: string;
  content: ReactNode;
};

export default function ChatThread({
  gameId,
  groupId,
  redirectTo,
  inlineItems = [],
}: {
  // Exactly one of these is passed by any given caller.
  gameId?: string;
  groupId?: string;
  // Anyone who isn't allowed to chat is sent here.
  redirectTo: string;
  inlineItems?: InlineThreadItem[];
}) {
  const isGroup = groupId != null;
  const threadId = (isGroup ? groupId : gameId)!;

  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [canChat, setCanChat] = useState(false);
  const [ready, setReady] = useState(false); // finished the access check
  const [loaded, setLoaded] = useState(false); // finished the first read
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  // The message being reported, if any. Held whole rather than by id so the sheet
  // can send a copy of the text as evidence — the message itself can be deleted
  // out from under the report.
  const [reporting, setReporting] = useState<ThreadMessage | null>(null);
  // A thread that failed to load must not read as a thread nobody has written
  // in — that invites somebody to repeat a message already there.
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  // Messages shown on the tap while the database saves them.
  const [pending, setPending] = useState<ThreadMessage[]>([]);
  const nextPendingId = useRef(-1);
  const [error, setError] = useState<string | null>(null);

  // A refusal is a short note, not a banner that stays.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Messages from anyone this viewer has blocked are dropped — both the history
  // and anything arriving live, since live updates come back through this reload.
  //
  // Only THIS viewer stops seeing them. The blocked person's own thread is
  // untouched, so nothing about the thread tells them they have been blocked.
  const reload = useCallback(async () => {
    const { data: auth } = await getSignedInUser();
    const uid = auth.user?.id ?? null;
    const [msgs, blocked] = await Promise.all([
      isGroup ? getGroupMessages(threadId) : getMessages(threadId),
      getBlockedIds(uid),
    ]);
    setMessages(blocked.size === 0 ? msgs : msgs.filter((m) => !blocked.has(m.user_id)));
  }, [isGroup, threadId]);

  const reloadSafely = useCallback(async () => {
    try {
      await reload();
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setLoaded(true);
  }, [reload]);

  // On first load: find who's logged in, check whether they're allowed to chat,
  // and if so load the messages and start listening for new ones.
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await getSignedInUser();
      const uid = data.user?.id ?? null;
      if (!active) return;
      setUserId(uid);

      const allowed =
        uid != null && (await (isGroup ? canUserChatInGroup(threadId, uid) : canUserChat(threadId, uid)));
      if (!active) return;
      setCanChat(allowed);
      setReady(true);
      if (!allowed) return;

      await reloadSafely();

      // Live updates: listen for new rows in "messages" for THIS thread only.
      const idColumn = isGroup ? "group_id" : "game_id";
      channel = supabase
        .channel(`messages:${isGroup ? "group" : "game"}:${threadId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `${idColumn}=eq.${threadId}` },
          () => {
            reloadSafely();
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [isGroup, threadId, reloadSafely]);

  // Whenever the thread changes, keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, inlineItems.length, loaded]);

  useEffect(() => {
    if (ready && !canChat) router.replace(redirectTo);
  }, [ready, canChat, redirectTo, router]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (body.length === 0 || !userId) return; // never send empty

    // Instant: the message joins the conversation and the box clears on the
    // tap, so the next one can be typed straight away.
    const shown: ThreadMessage = {
      id: nextPendingId.current--,
      user_id: userId,
      body,
      created_at: new Date().toISOString(),
      senderName: "You",
      senderAvatarUrl: null,
    };
    setPending((p) => [...p, shown]);
    setText("");
    setError(null);
    const result = isGroup
      ? await sendGroupMessage(threadId, userId, body)
      : await sendMessage(threadId, userId, body);
    if ("error" in result) {
      setPending((p) => p.filter((m) => m.id !== shown.id));
      // Their words go back in the box, so nothing has to be retyped.
      setText((current) => (current.trim() === "" ? body : current));
      setError("Couldn’t send that message. Try again.");
      return;
    }
    await reloadSafely(); // the saved copy replaces the faded one (the live update also picks it up)
    setPending((p) => p.filter((m) => m.id !== shown.id));
  }

  // Still checking access, or on the way to the redirect.
  if (!ready || !canChat) return null;

  const pendingIds = new Set(pending.map((m) => m.id));
  const entries = [
    ...[...messages, ...pending].map((m) => {
      const mine = m.user_id === userId;
      const sendingNow = pendingIds.has(m.id);
      return {
        key: `msg-${m.id}`,
        createdAt: m.created_at,
        node: (
          <div className="ios-msg" data-mine={mine || undefined} data-pending={sendingNow || undefined}>
            {!mine && (
              <Link href={`/players/${m.user_id}`} aria-label={m.senderName} className="ios-link ios-press" style={{ flex: "none" }}>
                <Monogram name={m.senderName} photoUrl={m.senderAvatarUrl} size={32} />
              </Link>
            )}
            <div className="ios-msg-body">
              <div className="ios-msg-meta">
                {!mine && (
                  <Link href={`/players/${m.user_id}`} className="ios-link ios-md">
                    {m.senderName}
                  </Link>
                )}
                <span>{sendingNow ? "Sending…" : clockTime(m.created_at)}</span>
                {/* Only on somebody else's message, and deliberately quiet. */}
                {!mine && (
                  <button type="button" className="ios-msg-report" onClick={() => setReporting(m)} aria-label={`Report this message from ${m.senderName}`}>
                    Report
                  </button>
                )}
              </div>
              <div className="ios-bubble ios-bd">{m.body}</div>
            </div>
          </div>
        ),
      };
    }),
    ...inlineItems.map((item) => ({ key: `inline-${item.id}`, createdAt: item.createdAt, node: item.content })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let lastDay = "";

  return (
    <>
      <div ref={scrollRef} className="ios-chat-scroll">
        {/* Keeps a short thread down by the message box. */}
        <div style={{ flex: 1 }} />
        {failed ? (
          <div className="ios-card" style={{ margin: 0, padding: 20 }} role="alert">
            <div className="ios-t3">Couldn’t Load the Messages</div>
            <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
              They’re still there. Check your connection and try again.
            </div>
            <div style={{ display: "flex", marginTop: 14 }}>
              <button type="button" className="ios-pill ios-press" style={{ border: 0, cursor: "pointer" }} onClick={reloadSafely}>
                Try Again
              </button>
            </div>
          </div>
        ) : !loaded ? null : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "0 24px 12px" }}>
            <div className="ios-hl">No Messages Yet</div>
            <div className="ios-sh ios-sec" style={{ marginTop: 2 }}>
              Say hello to your group.
            </div>
          </div>
        ) : (
          entries.map((entry) => {
            const day = dublinDateKey(entry.createdAt);
            const newDay = day !== lastDay;
            lastDay = day;
            return (
              <Fragment key={entry.key}>
                {newDay && <div className="ios-msg-day ios-fn ios-sec">{dayHeading(entry.createdAt)}</div>}
                {entry.node}
              </Fragment>
            );
          })
        )}
      </div>

      {error && (
        <div className="ios-toast ios-glass ios-fn" role="alert" style={{ bottom: "calc(env(safe-area-inset-bottom) + 78px)" }}>
          {error}
        </div>
      )}

      <form className="ios-chat-composer ios-glass" onSubmit={handleSend}>
        <input
          type="text"
          enterKeyHint="send"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your group"
          aria-label="Type a message"
        />
        <button type="submit" className="ios-press" disabled={text.trim().length === 0} aria-label="Send message">
          <Icon name="arrow-up" size={20} />
        </button>
      </form>

      {reporting && userId && (
        <ReportDialog
          open
          onClose={() => setReporting(null)}
          reporterId={userId}
          reportedId={reporting.user_id}
          reportedName={reporting.senderName}
          context="message"
          messageId={reporting.id}
          messageText={reporting.body}
          onBlocked={() => {
            // Their messages come straight out of this thread.
            reloadSafely();
          }}
        />
      )}
    </>
  );
}
