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
      {/* Unread = solid accent dot; read = hollow, muted. */}
      <span
        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
          n.is_read ? "border border-line" : "bg-accent"
        }`}
      />
      <div className="flex-1">
        <div className={`text-[15px] ${n.is_read ? "text-ink-secondary font-normal" : "text-ink font-medium"}`}>
          {n.message}
        </div>
        <div className="text-[13px] text-ink-faint mt-1">{timeAgo(n.created_at)}</div>
      </div>
      {n.game_id != null && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 text-ink-faint shrink-0">
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
      <h1 className="font-display text-[28px] tracking-tight leading-tight text-ink mt-2 relative">
        Notifications
      </h1>
      <p className="text-[13px] text-ink-secondary mt-1 mb-4">
        Updates about the games you run.
      </p>

      {loading ? (
        // Skeleton rows in the shape of the list — sunken, subtle pulse.
        <div className="space-y-3">
          <div className="bg-sunken rounded-(--radius-card) h-[72px] animate-pulse" />
          <div className="bg-sunken rounded-(--radius-card) h-[72px] animate-pulse" />
        </div>
      ) : items.length > 0 ? (
        items.map((n, i) => <NotificationItem key={n.id} n={n} delay={i * 40} />)
      ) : (
        <div className="pl-card px-4 py-6 text-center">
          <div className="font-display text-[19px] text-ink">Nothing yet.</div>
          <div className="text-[13px] text-ink-secondary mt-1.5">
            We’ll tell you here when one of your games fills up.
          </div>
        </div>
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
