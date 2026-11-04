"use client";
// A bell icon in the Home top bar that links to the Notifications screen and
// shows a small badge with the number of UNREAD notifications. It reads the
// logged-in user (client-side, like the rest of the app) and counts their
// unread alerts; Row Level Security means the count only ever covers their own.
// Logged-out visitors just see a plain bell with no badge.

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getUnreadCount } from "@/app/notifications";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) return;
      const c = await getUnreadCount(uid);
      if (active) setCount(c);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      /* A quiet disc — a plain amber dot marks unread rather than a counted
         badge. */
      className="c-press relative size-10.5 rounded-full bg-c-card text-c-ink grid place-items-center shadow-[var(--c-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-accent"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M18 8a6 6 0 1 0-12 0c0 6-2 8-2 8h16s-2-2-2-8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 20h4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-2 right-2 size-2.25 rounded-full bg-c-amber ring-2 ring-c-card"
        />
      )}
    </Link>
  );
}
