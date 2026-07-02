"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PlayerAvatar from "@/components/PlayerAvatar";
import { supabase } from "@/lib/supabaseClient";
import { getProfile } from "@/app/profiles";

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]">
      <path d="M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3V10.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  myGames: (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]">
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 text-[10px] font-medium w-14 transition-colors duration-150 ease-out ${
        active ? "text-accent" : "text-ink-faint"
      }`}
    >
      {ICONS[icon]}
      {label}
    </Link>
  );
}

// The Profile tab. When someone is logged in it shows THEIR avatar and links to
// their own player profile (/players/[id]). Logged out, it falls back to the
// original person icon → /profile (which itself bounces to login). Loading the
// user is the only added behaviour here; everything else stays as designed.
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

  // Logged out (or still resolving who's logged in) — keep the original tab.
  if (!userId) {
    return <NavItem href="/profile" label="Profile" icon="profile" />;
  }

  const active = pathname === `/players/${userId}`;
  return (
    <Link
      href={`/players/${userId}`}
      className={`flex flex-col items-center gap-1 text-[10px] font-medium w-14 transition-colors duration-150 ease-out ${
        active ? "text-accent" : "text-ink-faint"
      }`}
    >
      <PlayerAvatar
        userId={userId}
        avatarUrl={avatarUrl}
        name={name}
        className={`size-[22px] ${active ? "ring-2 ring-accent" : ""}`}
      />
      Profile
    </Link>
  );
}

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20">
      <div className="mx-auto max-w-md h-[84px] border-t border-line bg-surface flex items-start justify-around px-4 pt-3">
        <NavItem href="/" label="Home" icon="home" />
        <NavItem href="/my-games" label="My Games" icon="myGames" />
        <Link
          href="/create"
          aria-label="Create game"
          className="w-12 h-12 rounded-full bg-accent flex items-center justify-center -mt-1.5 active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]">
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </Link>
        <NavItem href="/chat" label="Chat" icon="chat" />
        <ProfileNavItem />
      </div>
    </nav>
  );
}
