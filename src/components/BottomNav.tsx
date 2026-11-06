"use client";

// The tab bar: a floating glass capsule with Home · Discover · Chats · Profile.
// Tabs only navigate. Creating a game lives in the toolbar at the top of the
// screen, because a tab shouldn't perform an action.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/ios/Icon";
import { recordPath } from "@/lib/navMemory";
import { supabase } from "@/lib/supabaseClient";

function Tab({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
}) {
  return (
    <Link href={href} className="ios-tab" aria-current={active ? "page" : undefined}>
      <span className="ios-tab-i">
        <Icon name={icon} size={icon === "house" ? 29 : 26} />
      </span>
      <span className="ios-tab-l">{label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  useEffect(() => recordPath(pathname), [pathname]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const inProfile =
    pathname === "/profile" ||
    pathname.startsWith("/connections") ||
    (userId != null && pathname === `/players/${userId}`);
  const inChats = pathname.startsWith("/chat") || pathname.startsWith("/groups");
  const inDiscover =
    !inProfile &&
    (pathname.startsWith("/discover") || pathname.startsWith("/games") || pathname.startsWith("/players"));

  return (
    <>
      <div className="ios-edge" aria-hidden />
      <nav className="ios-tabbar ios-glass" aria-label="Main">
        <Tab href="/" label="Home" icon="house" active={pathname === "/"} />
        <Tab href="/discover" label="Discover" icon="search" active={inDiscover} />
        <Tab href="/chat" label="Chats" icon="chat" active={inChats} />
        <Tab
          href={userId ? `/players/${userId}` : "/profile"}
          label="Profile"
          icon="person"
          active={inProfile}
        />
      </nav>
    </>
  );
}
