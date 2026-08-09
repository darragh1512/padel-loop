"use client";
// The "Connections" screen (/connections): the logged-in player's list of
// people they've connected with. Each row shows that person's avatar and a few
// details and links through to their profile (/players/[id]).
//
// Reads the player client-side using the shared Supabase client, same as the
// rest of the app, and sends logged-out visitors to the login page.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PlayerResultRow from "@/components/PlayerResultRow";
import PlayerSearch from "@/components/PlayerSearch";
import { SectionLabel } from "@/components/ui";
import { getConnections, type ConnectionProfile } from "../connections";
import { supabase } from "@/lib/supabaseClient";

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
    // Skeleton rows in the shape of the list — sunken, subtle pulse.
    return (
      <main className="px-5 pt-6 relative">
        <div className="rounded-field h-9 w-52 mt-2 pl-skeleton" />
        <div className="mt-8 space-y-3">
          <div className="rounded-card h-18 pl-skeleton" />
          <div className="rounded-card h-18 pl-skeleton" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="px-5 pt-6 relative">
      <p className="t-mono text-micro text-papel/80 mt-2">La peña</p>
      <h1 className="t-display text-display-md text-papel mt-1.5 relative">
        C<span className="text-lima">o</span>nnections
      </h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        The players you’ve connected with.
      </p>

      <PlayerSearch placeholder="Find a player by name" />

      <SectionLabel>Your connections</SectionLabel>
      {people.length > 0 ? (
        people.map((person, i) => (
          <PlayerResultRow key={person.id} person={person} delay={i * 40} />
        ))
      ) : (
        <div className="pl-card pena-staples pena-tilt-b px-4 pt-7 pb-6 text-center">
          <div className="t-display text-display-xs text-tinta">No connections yet.</div>
          <div className="text-label font-medium text-tinta/70 mt-2">
            Open a player’s profile and tap Connect.
          </div>
        </div>
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
