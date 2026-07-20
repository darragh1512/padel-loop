"use client";

// The front door. "/" is two different pages depending on who's looking:
//   • logged out  → the marketing landing page (no app chrome, no bottom nav)
//   • logged in   → the home dashboard exactly as before
// While we check (one quick client-side auth read, same as everywhere else in
// the app) we show the wordmark on bone with a subtle fade — never a spinner.

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import HomeDashboard from "@/components/HomeDashboard";
import Landing from "@/components/Landing";
import NotificationBell from "@/components/NotificationBell";
import { LevelChip } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";

export default function HomeGate() {
  // null = still checking, then true/false.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setLoggedIn(data.user != null);
    });
    return () => {
      active = false;
    };
  }, []);

  // Splash while resolving: the poster wordmark on the court paint.
  if (loggedIn === null) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="t-display text-display-md text-papel pl-fade">
          Padel l<span className="text-naranja">o</span>op
        </div>
      </div>
    );
  }

  if (!loggedIn) return <Landing />;

  return (
    <main className="px-5 pt-6 relative">
      <div className="flex justify-between items-center relative">
        <div className="t-mono flex items-center gap-1.5 text-micro text-papel/85">
          <MapPin size={16} strokeWidth={1.5} className="text-papel/60" />
          Malahide, Dublin
        </div>
        <div className="flex items-center gap-3.5">
          <NotificationBell />
          <LevelChip>Level 3.2</LevelChip>
        </div>
      </div>

      {/* Dashboard: the next-game hero plus "Find a game" (primary action) and
          "Connections" cards. The joinable-games list lives on /discover. */}
      <HomeDashboard />

      <BottomNav />
    </main>
  );
}
