"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]">
      <path d="M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3V10.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  games: (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
      className={`flex flex-col items-center gap-1 text-[9.5px] tracking-wide font-medium w-14 ${
        active ? "text-sky" : "text-faint"
      }`}
    >
      {ICONS[icon]}
      {label}
    </Link>
  );
}

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20">
      <div className="mx-auto max-w-md h-[84px] border-t border-white/8 bg-navy/95 backdrop-blur-md flex items-start justify-around px-4 pt-3">
        <NavItem href="/" label="Home" icon="home" />
        <NavItem href="/games" label="Games" icon="games" />
        <Link
          href="/create"
          aria-label="Create game"
          className="w-12 h-12 rounded-full bg-vivid flex items-center justify-center -mt-1.5 pl-cta-shadow"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]">
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </Link>
        <NavItem href="/chat" label="Chat" icon="chat" />
        <NavItem href="/profile" label="Profile" icon="profile" />
      </div>
    </nav>
  );
}
