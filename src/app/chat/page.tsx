"use client";
// The Chats tab: the signed-in person's game and group conversations.
//
// This screen is JUST a list. Tapping a row opens that conversation's full-screen
// page, and all sending, live updates and access checks live there.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { PinLimitDialog, PinToggle } from "@/components/ChatPin";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import { supabase } from "@/lib/supabaseClient";
import { APP_TIME_ZONE, dublinDateKey } from "@/lib/time";
import { gameWhen } from "@/lib/when";
import { MAX_PINS, getPinnedKeys, pinChat, pinKey, unpinChat } from "../chat-pins";
import { getConversationsFor, type Conversation } from "../games";

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

function ConversationRow({
  c,
  pinned,
  pinBusy,
  onTogglePin,
}: {
  c: Conversation;
  pinned: boolean;
  pinBusy: boolean;
  onTogglePin: () => void;
}) {
  const title = c.kind === "game" ? c.game.venue : c.group.name;
  const days = c.kind === "game" ? daysUntil(c.game.game_time) : null;
  const soon = days != null && days >= 0 && days <= 1;

  let meta: string;
  if (c.kind === "game") {
    const when = days === 0 ? "Starts today" : days === 1 ? "Starts tomorrow" : gameWhen(c.game.game_time);
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
      <PinToggle pinned={pinned} busy={pinBusy} title={title} onToggle={onTogglePin} />
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

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pastOpen, setPastOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");

  // Pins are this person's own. Nobody else's list is affected by anything here.
  const [userId, setUserId] = useState<string | null>(null);
  const [pins, setPins] = useState<Set<string>>(new Set());
  const [pinBusy, setPinBusy] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!active) return;
      setLoggedIn(uid != null);
      setUserId(uid);
      if (uid) {
        try {
          const [convos, pinned] = await Promise.all([getConversationsFor(uid), getPinnedKeys(uid)]);
          if (!active) return;
          setConversations(convos);
          setPins(pinned);
          setFailed(false);
        } catch {
          if (!active) return;
          setFailed(true);
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

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

    setPinBusy(key);
    const result = pinned
      ? await unpinChat(userId, c.kind, conversationKey(c))
      : await pinChat(userId, c.kind, conversationKey(c));
    setPinBusy(null);

    if ("error" in result) {
      if ("limit" in result && result.limit) setLimitOpen(true);
      else setPinError(result.error);
      return;
    }

    setPins((prev) => {
      const next = new Set(prev);
      if (pinned) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const rowProps = (c: Conversation) => ({
    pinned: pins.has(pinKeyFor(c)),
    pinBusy: pinBusy === pinKeyFor(c),
    onTogglePin: () => togglePin(c),
  });

  const { pinnedRows, sections, past } = useMemo(() => {
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
    const pinnedKey = (c: Conversation) => pins.has(pinKeyFor(c));
    const active = conversations.filter((c) => !isPast(c) && !pinnedKey(c) && matches(c));
    return {
      // Pinned chats are lifted out of wherever they'd normally sit, including Past.
      pinnedRows: conversations.filter((c) => pinnedKey(c) && matches(c)),
      sections: [
        { title: "Game Chats", rows: active.filter((c) => c.kind === "game") },
        { title: "Groups", rows: active.filter((c) => c.kind === "group") },
      ].filter((s) => s.rows.length > 0),
      past: conversations.filter((c) => isPast(c) && !pinnedKey(c) && matches(c)),
    };
  }, [conversations, filter, pins]);

  const nothing = pinnedRows.length === 0 && sections.length === 0 && past.length === 0;

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
                    {pinnedRows.map((c) => (
                      <ConversationRow key={pinKeyFor(c)} c={c} {...rowProps(c)} />
                    ))}
                  </div>
                </section>
              )}

              {sections.map((s) => (
                <section key={s.title} style={{ marginTop: 16 }}>
                  <div className="ios-sect">
                    <h2 className="ios-t3">{s.title}</h2>
                  </div>
                  <div className="ios-list">
                    {s.rows.map((c) => (
                      <ConversationRow key={pinKeyFor(c)} c={c} {...rowProps(c)} />
                    ))}
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
                  {pastOpen && past.map((c) => <ConversationRow key={pinKeyFor(c)} c={c} {...rowProps(c)} />)}
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
      <div style={{ height: 16 }} />
      <BottomNav />
    </main>
  );
}
