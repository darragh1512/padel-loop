"use client";

// The bottom navigation: four tabs in a floating glass capsule, with Create as
// its own round button beside them, because tabs go places and Create does
// something. Switching tabs doesn't animate: it happens too often to earn it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CreateSheet from "@/components/court/CreateSheet";
import { GlassSurface } from "@/components/glassyui/glass-surface";
import PlayerAvatar from "@/components/PlayerAvatar";
import { supabase } from "@/lib/supabaseClient";
import { getProfile } from "@/app/profiles";
import { onAvatarChange } from "@/lib/avatarBus";

const ICONS: Record<string, string[]> = {
  home: ["M4 11l8-6 8 6", "M6.5 10v9h11v-9", "M10 19v-4h4v4"],
  games: ["M4.5 6.5h15v13h-15z", "M8 4v4", "M16 4v4", "M4.5 11h15", "M9 15h2"],
  chat: ["M4.5 6.5h15v10h-9l-4 3.5v-3.5h-2z"],
  profile: [
    "M12 3.5c-3 0-5.2 2.2-5.2 5 0 3.6 5.2 9 5.2 9s5.2-5.4 5.2-9c0-2.8-2.2-5-5.2-5z",
    "M12 8.5v1.6",
  ],
};

function NavIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const TAB_CLASS =
  "relative flex flex-col items-center justify-center gap-0.5 h-13 rounded-full text-[0.6875rem] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-c-accent";

// Only the active icon takes the accent. Labels stay full-strength ink so they
// hold their contrast over whatever scrolls beneath the glass.
const tabTone = (active: boolean) =>
  active ? "bg-c-accent/12 text-c-accent" : "text-c-ink";

function TabLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-c-ink">{children}</span>;
}

function NavItem({
  href,
  label,
  icon,
  badge = false,
}: {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: boolean;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${TAB_CLASS} ${tabTone(active)}`}
    >
      <NavIcon name={icon} />
      <TabLabel>{label}</TabLabel>
      {badge && (
        <span className="absolute top-2 right-1/2 translate-x-4 size-2 rounded-full bg-c-amber" />
      )}
    </Link>
  );
}

// The Profile tab. Logged in it shows THEIR avatar and links to their own
// player profile; logged out it falls back to the pin icon → /profile.
function ProfileNavItem() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!active) return;
      setUserId(uid);
      if (uid) {
        const profile = await getProfile(uid);
        if (!active) return;
        setAvatarUrl(profile?.avatar_url ?? null);
        setName(profile?.name ?? null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // The avatar can be changed or removed from the profile screen, which
  // lives in a different tree and so cannot update this state directly.
  // Listen for the broadcast so the picture here changes straight away
  // instead of waiting for the next navigation to remount us.
  useEffect(
    () =>
      onAvatarChange((change) => {
        if (change.userId === userId) setAvatarUrl(change.avatarUrl);
      }),
    [userId],
  );

  if (!userId) {
    return <NavItem href="/profile" label="Profile" icon="profile" />;
  }

  const active = pathname === `/players/${userId}`;
  return (
    <Link
      href={`/players/${userId}`}
      aria-current={active ? "page" : undefined}
      className={`${TAB_CLASS} ${tabTone(active)}`}
    >
      <PlayerAvatar
        userId={userId}
        avatarUrl={avatarUrl}
        name={name}
        className="size-5.5"
      />
      <TabLabel>Profile</TabLabel>
    </Link>
  );
}

export default function BottomNav() {
  const [creating, setCreating] = useState(false);
  return (
    <nav className="c-ui fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-0 z-20 px-3">
      <div className="mx-auto max-w-md flex items-center gap-2">
        <GlassSurface className="c-glass flex-1 min-w-0 rounded-full p-1">
          <div className="grid grid-cols-4">
            <NavItem href="/" label="Home" icon="home" />
            <NavItem href="/my-games" label="Games" icon="games" />
            <NavItem href="/chat" label="Chat" icon="chat" />
            <ProfileNavItem />
          </div>
        </GlassSurface>

        {/* Still a real link, so it behaves if opened any other way; a normal
            tap opens the sheet over the screen you're on. */}
        <Link
          href="/create"
          aria-label="Create game"
          onClick={(e) => {
            e.preventDefault();
            setCreating(true);
          }}
          className="c-press flex-none size-15 rounded-full bg-c-accent text-c-on-accent grid place-items-center shadow-[0_8px_20px_-8px_rgb(6_32_29/0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-accent"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
      <CreateSheet open={creating} onOpenChange={setCreating} />
    </nav>
  );
}
