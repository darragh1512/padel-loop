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
      aria-label="Notifications"
      className="relative inline-flex text-ink-secondary hover:text-ink rounded-pill transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.7 21a2 2 0 0 1-3.4 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-pill bg-accent text-on-accent text-nav font-semibold flex items-center justify-center leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
