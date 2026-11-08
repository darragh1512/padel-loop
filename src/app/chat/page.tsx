"use client";
// The Chats tab: the signed-in person's game and group conversations.
//
// This screen is JUST a list. Tapping a row opens that conversation's full-screen
// page, and all sending, live updates and access checks live there.
//
// Swipe a row left to archive it (only for you) or, in Archived, to bring it
// back. Cancelled games move to Archived for everyone, marked Cancelled, and their
// organiser can delete them there. A game's chat stops being pinned once the
// game is cancelled or has finished.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { PinLimitDialog, PinToggle } from "@/components/ChatPin";
import Alert from "@/components/ios/Alert";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import SwipeRow, { type SwipeAction } from "@/components/ios/SwipeRow";
import { getSignedInUser } from "@/lib/session";
import { APP_TIME_ZONE, dublinDateKey } from "@/lib/time";
import { gameWhen } from "@/lib/when";
import { archiveChat, getArchivedKeys, unarchiveChat } from "../chat-archives";
import { MAX_PINS, gameChatPinnable, getPinnedKeys, isGameCancelled, pinChat, pinKey, unpinChat } from "../chat-pins";
import { deleteCancelledGame, getConversationsFor, type Conversation } from "../games";

// The clock time if it was today ("14:32"), otherwise the date ("10 Jun"). On a
// Dublin clock, like every other time in the app.
function shortStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return dublinDateKey(d) === dublinDateKey(new Date())
    ? d.toLocaleTimeString("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("en-GB", { timeZone: APP_TIME_ZONE, day: "numeric", month: "short" });
}

function conversationKey(c: Conversation): string {
  return c.kind === "game" ? c.game.id : c.group.id;
}
// Kind-prefixed, because a game and a group can share a numeric id.
function pinKeyFor(c: Conversation): string {
  return pinKey(c.kind, conversationKey(c));
}
function conversationHref(c: Conversation): string {
  return c.kind === "game" ? `/games/${c.game.id}/chat` : `/groups/${c.group.id}/chat`;
}

// How many Dublin calendar days until this game — negative once it's past.
function daysUntil(iso: string): number | null {
  const key = dublinDateKey(iso);
  const today = dublinDateKey(new Date());
  if (!key || !today) return null;
  return Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

// Whether this chat can be pinned right now: groups always, games until they're
// cancelled or finished.
function pinnable(c: Conversation): boolean {
  return c.kind === "group" || gameChatPinnable(c.game);
}
function cancelled(c: Conversation): boolean {
  return c.kind === "game" && isGameCancelled(c.game);
}

function ConversationRow({
  c,
  pinned,
  pinBusy,
  onTogglePin,
  showPin,
}: {
  c: Conversation;
  pinned: boolean;
  pinBusy: boolean;
  onTogglePin: () => void;
  showPin: boolean;
}) {
  const title = c.kind === "game" ? c.game.venue : c.group.name;
  const isCancelled = cancelled(c);
  // Finished: played already today, so no longer "starts today".
  const finished = c.kind === "game" && !isCancelled && !gameChatPinnable(c.game);
  const days = c.kind === "game" && !isCancelled ? daysUntil(c.game.game_time) : null;
  const soon = !finished && days != null && days >= 0 && days <= 1;

  let meta: string;
  if (c.kind === "game") {
    const when =
      finished && days === 0
        ? "Played today"
        : !finished && days === 0
          ? "Starts today"
          : days === 1
            ? "Starts tomorrow"
            : gameWhen(c.game.game_time);
    meta = c.game.location ? `${when} · ${c.game.location}` : when;
  } else {
    meta = `${c.memberCount} member${c.memberCount === 1 ? "" : "s"}`;
  }

  return (
    <div className="ios-row" style={{ padding: "10px 12px 10px 16px", "--ios-inset": "72px" } as React.CSSProperties}>
      {/* The pin sits BESIDE the link: a button inside a link would open the chat. */}
      <Link href={conversationHref(c)} className="ios-link ios-grow ios-press" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {c.kind === "game" ? (
          <span className="ios-chat-icon" aria-hidden>
            <Icon name="court" size={24} />
          </span>
        ) : (
          <Monogram name={title} size={44} />
        )}
        <span className="ios-grow">
          <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="ios-hl ios-clip ios-grow">{title}</span>
            {isCancelled && <span className="ios-cancelled-tag">Cancelled</span>}
            <span className="ios-fn ios-sec" style={{ flex: "none" }}>
              {shortStamp(c.lastMessageAt)}
            </span>
          </span>
          <span className={soon ? "ios-fn ios-sb ios-acc ios-clip" : "ios-fn ios-sec ios-clip"} style={{ display: "block" }}>
            {meta}
          </span>
          <span className={c.lastMessageBody != null ? "ios-sh ios-clip" : "ios-sh ios-sec ios-clip"} style={{ display: "block" }}>
            {c.lastMessageBody ?? "No messages yet"}
          </span>
        </span>
      </Link>
      {showPin && <PinToggle pinned={pinned} busy={pinBusy} title={title} onToggle={onTogglePin} />}
    </div>
  );
}

type Filter = "All" | "Games" | "Groups";

function Notice({
  title,
  body,
  href,
  action,
  onPress,
}: {
  title: string;
  body: string;
  href?: string;
  action: string;
  onPress?: () => void;
}) {
  return (
    <div className="ios-card" style={{ marginTop: 16, padding: 20 }}>
      <div className="ios-t3">{title}</div>
      <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
        {body}
      </div>
      <div style={{ display: "flex", marginTop: 14 }}>
        {href ? (
          <Link href={href} className="ios-pill ios-press">
            {action}
          </Link>
        ) : (
          <button type="button" className="ios-pill ios-press" style={{ border: 0, cursor: "pointer" }} onClick={onPress}>
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

// The last list shown, kept while the app is open, so coming back to Chats shows
// it at once and refreshes it quietly, as Home does. Kept in step with pins,
// archives and deletes made here.
type ChatsData = { userId: string; conversations: Conversation[]; pins: string[]; archived: string[] };
let lastChats: ChatsData | null = null;

export default function ChatPage() {
  const [cached] = useState(() => lastChats);
  const [loading, setLoading] = useState(cached == null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loggedIn, setLoggedIn] = useState(cached != null);
  const [conversations, setConversations] = useState<Conversation[]>(cached?.conversations ?? []);
  const [pastOpen, setPastOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");

  // Pins are this person's own. Nobody else's list is affected by anything here.
  const [userId, setUserId] = useState<string | null>(cached?.userId ?? null);
  const [pins, setPins] = useState<Set<string>>(() => new Set(cached?.pins));
  const [pinBusy, setPinBusy] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Archived chats are this person's own too.
  const [archived, setArchived] = useState<Set<string>>(() => new Set(cached?.archived));
  const [swiped, setSwiped] = useState<string | null>(null); // the row swiped open
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSignedInUser();
      const uid = data.user?.id ?? null;
      if (!active) return;
      // Someone else signed in on this phone: never show the last person's chats.
      const fresh = cached == null || cached.userId !== uid;
      if (fresh && cached) {
        lastChats = null;
        setConversations([]);
        setLoading(true);
      }
      setLoggedIn(uid != null);
      setUserId(uid);
      if (uid) {
        try {
          const [convos, pinned, archivedKeys] = await Promise.all([
            getConversationsFor(uid),
            getPinnedKeys(uid),
            getArchivedKeys(uid),
          ]);
          if (!active) return;
          // A cancelled or finished game's pin is dropped, so it stops holding
          // one of the three places. Quietly: if that fails, the chat still
          // shows unpinned and the next visit tries again.
          for (const c of convos) {
            const key = pinKeyFor(c);
            if (pinned.has(key) && !pinnable(c)) {
              pinned.delete(key);
              unpinChat(uid, c.kind, conversationKey(c)).catch(() => {});
            }
          }
          setConversations(convos);
          setPins(pinned);
          setArchived(archivedKeys);
          setFailed(false);
        } catch {
          if (!active) return;
          // A failed quiet refresh keeps the list already showing.
          if (fresh) setFailed(true);
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [attempt, cached]);

  // Keep the remembered copy in step with what's on screen, pins and all.
  useEffect(() => {
    if (loading || failed || !userId) return;
    lastChats = { userId, conversations, pins: [...pins], archived: [...archived] };
  }, [loading, failed, userId, conversations, pins, archived]);

  // The failure note clears itself after a few seconds.
  useEffect(() => {
    if (!pinError) return;
    const t = setTimeout(() => setPinError(null), 4000);
    return () => clearTimeout(t);
  }, [pinError]);

  async function togglePin(c: Conversation) {
    if (!userId || pinBusy) return;
    const key = pinKeyFor(c);
    const pinned = pins.has(key);
    setPinError(null);

    // A fourth pin: say so before asking the database, which would refuse it
    // anyway (the limit is enforced there too).
    if (!pinned && pins.size >= MAX_PINS) {
      setLimitOpen(true);
      return;
    }

    // Instant: the chat moves on the tap, and the database is asked behind it.
    // If it says no, the chat moves back and the reason shows.
    const toggle = (on: boolean) =>
      setPins((prev) => {
        const next = new Set(prev);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      });
    setPinBusy(key);
    toggle(!pinned);
    const result = pinned
      ? await unpinChat(userId, c.kind, conversationKey(c))
      : await pinChat(userId, c.kind, conversationKey(c));
    setPinBusy(null);

    if ("error" in result) {
      toggle(pinned);
      if ("limit" in result && result.limit) setLimitOpen(true);
      else setPinError(result.error);
    }
  }

  async function setArchivedFor(c: Conversation, archive: boolean) {
    if (!userId) return;
    const key = pinKeyFor(c);
    setPinError(null);
    // Instant: the chat moves on the swipe, and the database is asked behind
    // it. If it says no, the chat moves back and the reason shows.
    const move = (into: boolean) =>
      setArchived((prev) => {
        const next = new Set(prev);
        if (into) next.add(key);
        else next.delete(key);
        return next;
      });
    move(archive);
    // An archived chat isn't pinned any more, as in Messages.
    const wasPinned = archive && pins.has(key);
    if (wasPinned) {
      setPins((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
    const result = archive
      ? await archiveChat(userId, c.kind, conversationKey(c))
      : await unarchiveChat(userId, c.kind, conversationKey(c));
    if ("error" in result) {
      move(!archive);
      if (wasPinned) setPins((prev) => new Set(prev).add(key)); // the pin was never removed
      setPinError(result.error);
      return;
    }
    if (wasPinned) unpinChat(userId, c.kind, conversationKey(c)).catch(() => {});
  }

  async function confirmDelete() {
    if (!deleting || deleting.kind !== "game" || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const result = await deleteCancelledGame(deleting.game.id);
    setDeleteBusy(false);
    if ("error" in result) {
      setDeleteError(result.error);
      return;
    }
    const gone = pinKeyFor(deleting);
    setConversations((prev) => prev.filter((c) => pinKeyFor(c) !== gone));
    setDeleting(null);
  }

  const isArchived = (c: Conversation) => cancelled(c) || archived.has(pinKeyFor(c));

  // What a swipe left reveals on this row.
  function swipeActions(c: Conversation): SwipeAction[] {
    if (cancelled(c)) {
      // Only the organiser is offered Delete; the database has the final say.
      return c.kind === "game" && userId != null && c.game.created_by === userId
        ? [{ label: "Delete", tone: "destructive", onPress: () => { setDeleteError(null); setDeleting(c); } }]
        : [];
    }
    return archived.has(pinKeyFor(c))
      ? [{ label: "Unarchive", tone: "archive", onPress: () => setArchivedFor(c, false) }]
      : [{ label: "Archive", tone: "archive", onPress: () => setArchivedFor(c, true) }];
  }

  const renderRow = (c: Conversation) => {
    const key = pinKeyFor(c);
    const inner = (
      <ConversationRow
        c={c}
        pinned={pins.has(key)}
        pinBusy={pinBusy === key}
        onTogglePin={() => togglePin(c)}
        showPin={!isArchived(c) && pinnable(c)}
      />
    );
    const actions = swipeActions(c);
    if (actions.length === 0) return <div key={key} className="ios-swipe">{inner}</div>;
    return (
      <SwipeRow key={key} actions={actions} open={swiped === key} onOpenChange={(o) => setSwiped(o ? key : null)}>
        {inner}
      </SwipeRow>
    );
  };

  const { pinnedRows, sections, past, archivedRows } = useMemo(() => {
    // The boundary is DUBLIN midnight, so a game later today stays active all
    // day. Groups have no game time and always stay active.
    const today = dublinDateKey(new Date());
    const isPast = (c: Conversation) => {
      if (c.kind !== "game") return false;
      const key = dublinDateKey(c.game.game_time);
      return key !== "" && key < today; // unreadable time → keep it active
    };
    const matches = (c: Conversation) =>
      filter === "All" || (filter === "Games" ? c.kind === "game" : c.kind === "group");
    const inArchive = (c: Conversation) => cancelled(c) || archived.has(pinKeyFor(c));
    const pinnedKey = (c: Conversation) => pins.has(pinKeyFor(c)) && !inArchive(c);
    const live = conversations.filter((c) => !inArchive(c) && matches(c));
    const active = live.filter((c) => !isPast(c) && !pinnedKey(c));
    return {
      // Pinned chats are lifted out of wherever they'd normally sit, including Past.
      pinnedRows: live.filter(pinnedKey),
      sections: [
        { title: "Game Chats", rows: active.filter((c) => c.kind === "game") },
        { title: "Groups", rows: active.filter((c) => c.kind === "group") },
      ].filter((s) => s.rows.length > 0),
      past: live.filter((c) => isPast(c) && !pinnedKey(c)),
      // Last of all. Cancelled games are here for everyone; the rest only for you.
      archivedRows: conversations.filter((c) => inArchive(c) && matches(c)),
    };
  }, [conversations, filter, pins, archived]);

  const nothing = pinnedRows.length === 0 && sections.length === 0 && past.length === 0 && archivedRows.length === 0;

  return (
    <main className="ios">
      <header className="ios-nav">
        <h1 className="ios-lt">Chats</h1>
        {!loading && loggedIn && (
          <Link href="/groups/new" aria-label="New group" className="ios-gcap-i ios-glass ios-press" style={{ color: "var(--ios-label)" }}>
            <Icon name="plus" size={21} />
          </Link>
        )}
      </header>

      {loading ? (
        <div aria-hidden style={{ marginTop: 16 }}>
          <div className="ios-skel" style={{ height: 40, borderRadius: 20, margin: "0 16px" }} />
          <div className="ios-skel" style={{ height: 240, margin: "16px 16px 0" }} />
        </div>
      ) : !loggedIn ? (
        <Notice
          title="Your Conversations Live Here"
          body="Log in and every game you join brings its group chat with it."
          href="/login"
          action="Log In"
        />
      ) : failed ? (
        <div role="alert">
          <Notice
            title="Couldn’t Load Your Chats"
            body="They’re still there. Check your connection and try again."
            action="Try Again"
            onPress={() => {
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          />
        </div>
      ) : (
        <>
          <Link href="/search" className="ios-search ios-link">
            <Icon name="search" size={20} />
            <span className="ios-bd">Search Players</span>
          </Link>

          <div className="ios-seg" role="group" aria-label="Show" style={{ margin: "10px 16px 0" }}>
            {(["All", "Games", "Groups"] as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          {nothing ? (
            conversations.length === 0 ? (
              <Notice title="No Chats Yet" body="Join a game and its group chat appears here." href="/discover" action="Find a Game" />
            ) : (
              <div className="ios-sh ios-sec" style={{ textAlign: "center", padding: 24 }}>
                Nothing here yet.
              </div>
            )
          ) : (
            <>
              {pinnedRows.length > 0 && (
                <section style={{ marginTop: 16 }}>
                  <div className="ios-sect">
                    <h2 className="ios-t3">Pinned</h2>
                    <div className="ios-fn ios-sec">
                      {pins.size} of {MAX_PINS}
                    </div>
                  </div>
                  <div className="ios-list">
                    {pinnedRows.map(renderRow)}
                  </div>
                </section>
              )}

              {sections.map((s) => (
                <section key={s.title} style={{ marginTop: 16 }}>
                  <div className="ios-sect">
                    <h2 className="ios-t3">{s.title}</h2>
                  </div>
                  <div className="ios-list">
                    {s.rows.map(renderRow)}
                  </div>
                </section>
              ))}

              {past.length > 0 && (
                <div className="ios-list" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="ios-row ios-toggle-row"
                    aria-expanded={pastOpen}
                    onClick={() => setPastOpen((v) => !v)}
                  >
                    <span className="ios-bd ios-grow">Past Game Chats</span>
                    <span className="ios-fn ios-sec">{past.length}</span>
                    <span className="ios-chev ios-disclose" data-open={pastOpen}>
                      <Icon name="chevron-right" size={13} />
                    </span>
                  </button>
                  {pastOpen && past.map(renderRow)}
                </div>
              )}

              {archivedRows.length > 0 && (
                <div className="ios-list" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="ios-row ios-toggle-row"
                    aria-expanded={archivedOpen}
                    onClick={() => setArchivedOpen((v) => !v)}
                  >
                    <span className="ios-bd ios-grow">Archived</span>
                    <span className="ios-fn ios-sec">{archivedRows.length}</span>
                    <span className="ios-chev ios-disclose" data-open={archivedOpen}>
                      <Icon name="chevron-right" size={13} />
                    </span>
                  </button>
                  {archivedOpen && archivedRows.map(renderRow)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {pinError && (
        <div className="ios-toast ios-glass ios-fn" style={{ bottom: 91 }} role="status">
          {pinError}
        </div>
      )}
      <PinLimitDialog open={limitOpen} onClose={() => setLimitOpen(false)} />
      <Alert
        open={deleting != null}
        onClose={() => {
          if (!deleteBusy) setDeleting(null);
        }}
        title="Delete This Game?"
        error={deleteError}
        actions={[
          { label: "Keep", bold: true, disabled: deleteBusy, onPress: () => setDeleting(null) },
          { label: "Delete", destructive: true, busy: deleteBusy, onPress: confirmDelete },
        ]}
      >
        The game and its chat will be removed for everyone. This can’t be undone.
      </Alert>
      <div style={{ height: 16 }} />
      <BottomNav />
    </main>
  );
}
