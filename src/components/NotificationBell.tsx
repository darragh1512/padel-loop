"use client";
// The bell in the Home toolbar. It links to Notifications and shows a red dot
// when there's something unread. Row Level Security means the count only ever
// covers the player's own alerts. Logged-out visitors see a plain bell.

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ios/Icon";
import { getSignedInUser } from "@/lib/session";
import { getUnreadCount } from "@/app/notifications";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSignedInUser();
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
      className="ios-gcap-i ios-press"
    >
      <Icon name="bell" size={23} />
      {count > 0 && <span aria-hidden className="ios-badge" />}
    </Link>
  );
}
