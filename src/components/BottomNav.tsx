"use client";

// The bottom navigation — a papel strip pinned along the foot of the board.
// Five equal columns: Home · Games · the create stamp · Chat · Profile.
//
// Straight from the prototype: the active tab's icon sits in a filled tinta
// pill with a lima glyph, its label goes solid tinta, and the create button is
// an oversized naranja stamp lifted clear of the strip on a hard ink shadow.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PlayerAvatar from "@/components/PlayerAvatar";
import { supabase } from "@/lib/supabaseClient";
import { getProfile } from "@/app/profiles";

// The prototype's own icon set — thin 2px strokes on a 24px grid.
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
      strokeWidth="2"
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

/* One tab column. The icon wrapper is the active indicator — a tinta pill
   behind a lima glyph. Inactive sits at half-strength ink. */
function TabShell({
  active,
  label,
  badge = false,
  children,
}: {
  active: boolean;
  label: string;
  badge?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <span
        className={`grid place-items-center w-8.5 h-7.5 rounded-pill transition-colors duration-150 ease-out ${
          active ? "bg-tinta text-lima" : "bg-transparent text-tinta/50"
        }`}
      >
        {children}
      </span>
      <span
        className={`t-mono text-nav ${active ? "text-tinta" : "text-tinta/50"}`}
      >
        {label}
      </span>
      {badge && (
        <span className="absolute top-0.5 right-1/2 translate-x-4.5 size-2 rounded-pill bg-naranja border-2 border-papel" />
      )}
    </>
  );
}

const TAB_CLASS =
  "relative flex flex-col items-center gap-1.5 pt-1 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja";

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
      className={TAB_CLASS}
    >
      <TabShell active={active} label={label} badge={badge}>
        <NavIcon name={icon} />
      </TabShell>
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

  if (!userId) {
    return <NavItem href="/profile" label="Profile" icon="profile" />;
  }

  const active = pathname === `/players/${userId}`;
  return (
    <Link
      href={`/players/${userId}`}
      aria-current={active ? "page" : undefined}
      className={TAB_CLASS}
    >
      <TabShell active={active} label="Profile">
        <PlayerAvatar
          userId={userId}
          avatarUrl={avatarUrl}
          name={name}
          className="size-5.5"
        />
      </TabShell>
    </Link>
  );
}

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20">
      <div className="mx-auto w-full max-w-md bg-papel border-t-2 border-tinta grid grid-cols-5 items-end px-3 pt-2 pb-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <NavItem href="/" label="Home" icon="home" />
        <NavItem href="/my-games" label="Games" icon="games" />

        {/* The create stamp — lifted clear of the strip, standing on a hard
            ink shadow rather than a blur. */}
        <div className="flex justify-center">
          <Link
            href="/create"
            aria-label="Create game"
            className="-translate-y-6.5 size-15 rounded-pill bg-naranja text-white border-[3px] border-tinta grid place-items-center shadow-[0_5px_0_var(--color-tinta)] active:shadow-[0_2px_0_var(--color-tinta)] active:translate-y-[-1.375rem] transition-[box-shadow,translate,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-6.5" aria-hidden>
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>

        <NavItem href="/chat" label="Chat" icon="chat" />
        <ProfileNavItem />
      </div>
    </nav>
  );
}
