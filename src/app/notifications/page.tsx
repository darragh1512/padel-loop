"use client";
// The Notifications screen: the signed-in person's alerts, newest first. Unread
// ones are marked; each links to its game. We fetch the list, show it, THEN mark
// everything read — so this view can still highlight what was new, while the badge
// clears for next time. Logged-out visitors are sent to the login page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Icon from "@/components/ios/Icon";
import PageTitle from "@/components/ios/PageTitle";
import { getSignedInUser } from "@/lib/session";
import { getNotifications, markAllNotificationsRead, type Notification } from "../notifications";

// Friendly "how long ago" text from an ISO timestamp.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function NotificationRow({ n }: { n: Notification }) {
  const inner = (
    <>
      <span className="ios-unread" data-on={!n.is_read} aria-hidden />
      <span className="ios-grow">
        {!n.is_read && <span className="ios-sr">Unread. </span>}
        <span className={n.is_read ? "ios-sh" : "ios-sh ios-sb"} style={{ display: "block" }}>
          {n.message}
        </span>
        <span className="ios-fn ios-sec" style={{ display: "block", marginTop: 2 }}>
          {timeAgo(n.created_at)}
        </span>
      </span>
      {n.game_id != null && (
        <span className="ios-chev">
          <Icon name="chevron-right" size={13} />
        </span>
      )}
    </>
  );
  const style = { padding: "11px 16px 11px 12px", "--ios-inset": "32px" } as React.CSSProperties;

  // Tied to its game when there is one; otherwise it's just a row.
  return n.game_id != null ? (
    <Link href={`/games/${n.game_id}`} className="ios-row ios-link" style={style}>
      {inner}
    </Link>
  ) : (
    <div className="ios-row" style={style}>
      {inner}
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  // Kept apart from an empty inbox: a failed read saying "Nothing yet" hides the
  // fact that there might be plenty.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSignedInUser();
      const uid = data.user?.id ?? null;
      if (!uid) {
        router.replace("/login");
        return;
      }

      try {
        const list = await getNotifications(uid);
        if (!active) return;
        setItems(list);
        setFailed(false);
        setLoading(false);

        // Mark read AFTER the list is captured, so the view can still show which
        // ones were unread this time around. Only on a SUCCESSFUL read — clearing
        // the badge for an inbox we failed to load would hide notifications
        // nobody has actually seen.
        await markAllNotificationsRead(uid);
      } catch {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [router, attempt]);

  return (
    <main className="ios">
      <PageTitle title="Notifications" />

      {loading ? (
        <div className="ios-skel" aria-hidden style={{ height: 180, margin: "16px 16px 0" }} />
      ) : failed ? (
        <div className="ios-card" style={{ marginTop: 16, padding: 20 }} role="alert">
          <div className="ios-t3">Couldn’t Load Notifications</div>
          <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
            They’re still there. Check your connection and try again.
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <button
              type="button"
              className="ios-pill ios-press"
              style={{ border: 0, cursor: "pointer" }}
              onClick={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="ios-list" style={{ marginTop: 16 }}>
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} />
          ))}
        </div>
      ) : (
        <div className="ios-card" style={{ marginTop: 16, padding: 20 }}>
          <div className="ios-t3">Nothing Yet</div>
          <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
            We’ll tell you here when a game fills up or someone drops out.
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <Link href="/discover" className="ios-pill ios-press">
              Find a Game
            </Link>
          </div>
        </div>
      )}

      <div style={{ height: 16 }} />
      <BottomNav />
    </main>
  );
}
