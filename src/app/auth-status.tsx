"use client";
// Runs in the browser. It checks whether someone is logged in and shows the
// right thing in the header: their email + a "Log out" button when logged in,
// or "Log in" / "Sign up" links when logged out.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export default function AuthStatus() {
  const router = useRouter();

  // "user" holds the logged-in person (or null if nobody is logged in).
  const [user, setUser] = useState<User | null>(null);
  // "ready" becomes true once we've checked — stops a flicker on first load.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1. Check right away if there's already a saved login (from a past visit).
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });

    // 2. Keep listening: whenever someone logs in or out, update the header
    //    instantly without needing a page refresh.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    // Tidy up the listener when this component goes away.
    return () => listener.subscription.unsubscribe();
  }, []);

  // Logs the user out, then sends them to the home page.
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  // Before the first check finishes, show nothing to avoid a flash.
  if (!ready) {
    return null;
  }

  // Logged in: show their email and a log-out button.
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/my-games"
          className="text-sm font-medium text-zinc-700 transition-colors hover:text-emerald-700"
        >
          My Games
        </Link>
        <Link
          href="/profile"
          className="text-sm font-medium text-zinc-700 transition-colors hover:text-emerald-700"
        >
          Profile
        </Link>
        <span className="hidden text-sm text-zinc-600 sm:inline">
          {user.email}
        </span>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          Log out
        </button>
      </div>
    );
  }

  // Logged out: show links to log in or sign up.
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
      >
        Log in
      </Link>
      <Link
        href="/signup"
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
      >
        Sign up
      </Link>
    </div>
  );
}
