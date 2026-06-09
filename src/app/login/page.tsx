"use client";
// Runs in the browser. The log-in screen: email + password, then sends the
// user to the home page once they're in.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Runs when the form is submitted.
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); // stop the browser reloading the page
    setLoading(true);
    setError(null);

    // Ask Supabase to check the email + password.
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Wrong details (or some other problem) — show the message and let them
      // try again.
      setError(error.message);
      setLoading(false);
      return;
    }

    // Success: go to the home page. The header will now show their email.
    router.push("/");
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Log in</h1>
        <p className="text-zinc-500">Welcome back.</p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </form>

      {/* A way to get to the sign-up page if they don't have an account yet. */}
      <p className="mt-6 text-center text-sm text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-emerald-700 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
