"use client";
// The "Connections" screen (/connections): the logged-in player's list of
// people they've connected with. Each row shows that person's avatar and a few
// details and links through to their profile (/players/[id]).
//
// Reads the player client-side using the shared Supabase client, same as the
// rest of the app, and sends logged-out visitors to the login page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getConnections, type ConnectionProfile } from "../connections";
import { supabase } from "@/lib/supabaseClient";

// One person in the list. The whole row links to their player profile.
function ConnectionRow({
  person,
  delay = 0,
}: {
  person: ConnectionProfile;
  delay?: number;
}) {
  const name = person.name || "Player";
  return (
    <Link
      href={`/players/${person.id}`}
      className="flex items-center gap-3.5 pl-card p-[15px] mb-3 pl-rise active:scale-[0.99] transition-transform"
      style={{ animationDelay: `${delay}ms` }}
    >
      <PlayerAvatar
        userId={person.id}
        avatarUrl={person.avatar_url}
        name={name}
        className="size-11 border-2 border-navy"
      />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[14.5px] truncate">{name}</div>
        <div className="text-[11.5px] text-faint font-light truncate mt-0.5">
          {person.home_club || "No home club"}
          {person.skill_level ? <> · {person.skill_level}</> : null}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path d="m9 6 6 6-6 6" stroke="#3a5a9a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </Link>
  );
}

export default function ConnectionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<ConnectionProfile[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) {
        router.replace("/login");
        return;
      }

      const connections = await getConnections(uid);
      if (!active) return;
      setPeople(connections);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="px-5 pt-6 relative">
        <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />
        <p className="text-[13px] text-dim font-light mt-2">Loading…</p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="px-5 pt-6 relative">
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <h1 className="font-display text-[21px] tracking-tight leading-snug mt-2 relative">
        <b className="font-bold">Connections</b>
      </h1>
      <p className="text-[13px] text-dim font-light mt-1 mb-4">
        The players you’ve connected with.
      </p>

      {/* Entry point to player search. */}
      <Link
        href="/search"
        className="flex items-center gap-2.5 pl-surface rounded-full px-4 py-2.5 mb-4 text-[13px] text-faint font-light active:scale-[0.99] transition-transform"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Find players by name
      </Link>

      {people.length > 0 ? (
        people.map((person, i) => (
          <ConnectionRow key={person.id} person={person} delay={i * 40} />
        ))
      ) : (
        <div className="pl-surface rounded-(--radius-card) px-4 py-5 text-center text-[13px] text-faint font-light">
          You haven’t connected with anyone yet. Open a player’s profile and tap
          Connect.
        </div>
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
