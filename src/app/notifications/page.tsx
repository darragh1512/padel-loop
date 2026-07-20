"use client";
// The Notifications screen: a simple list of the logged-in person's alerts,
// newest first. Unread ones are visibly marked; each links to its game. We
// fetch the list, show it, THEN mark everything read — so this view can still
// highlight what was new, while the badge clears for next time. Logged-out
// visitors are sent to the login page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import {
  getNotifications,
  markAllNotificationsRead,
  type Notification,
} from "../notifications";

// Friendly "how long ago" text from an ISO timestamp.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function NotificationItem({ n, delay = 0 }: { n: Notification; delay?: number }) {
  const inner = (
    <div
      className="pl-card p-4 mb-3 flex items-start gap-3 pl-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Unread = the naranja stamp dot; read = hollow, muted. */}
      <span
        className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
          n.is_read ? "border-[1.5px] border-tinta/30" : "bg-naranja border border-tinta"
        }`}
      />
      <div className="flex-1">
        <div className={`text-body ${n.is_read ? "text-tinta/70 font-medium" : "text-tinta font-extrabold"}`}>
          {n.message}
        </div>
        <div className="t-mono text-[9px] tracking-[0.1em] text-tinta/45 mt-1.5">{timeAgo(n.created_at)}</div>
      </div>
      {n.game_id != null && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 text-tinta/45 shrink-0">
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );

  // Tie to its game when there is one; otherwise it's just an unlinked card.
  return n.game_id != null ? (
    <Link href={`/games/${n.game_id}`} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) {
        router.replace("/login");
        return;
      }

      const list = await getNotifications(uid);
      if (!active) return;
      setItems(list);
      setLoading(false);

      // Mark read AFTER we've captured the list, so the view above can still
      // show which ones were unread this time around.
      await markAllNotificationsRead(uid);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="px-5 pt-6 relative">
      <p className="t-mono text-micro text-papel/80 mt-2">Fresh from the board</p>
      <h1 className="t-display text-display-md text-papel mt-1.5 relative">
        N<span className="text-lima">o</span>tifications
      </h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        Updates about the games you run.
      </p>

      {loading ? (
        // Skeleton rows in the shape of the list — papel ghosts.
        <div className="space-y-3">
          <div className="rounded-card h-18 pl-skeleton" />
          <div className="rounded-card h-18 pl-skeleton" />
        </div>
      ) : items.length > 0 ? (
        items.map((n, i) => <NotificationItem key={n.id} n={n} delay={i * 40} />)
      ) : (
        <div className="pl-card pena-staples pena-tilt-b px-4 pt-7 pb-6 text-center">
          <div className="t-display text-display-xs text-tinta">Nothing yet.</div>
          <div className="text-label font-medium text-tinta/70 mt-2">
            We’ll tell you here when one of your games fills up.
          </div>
        </div>
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
