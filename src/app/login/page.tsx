"use client";
// The log-in screen: email + password, then sends the user to the home page
// once they're in. Leads with the serif wordmark; logic unchanged.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <main className="px-5 pt-12">
      <header>
        <Wordmark tagline="Find and join a padel game near you." />
        <h1 className="font-display text-[28px] tracking-tight leading-tight text-ink mt-10">Log in</h1>
        <p className="text-[13px] text-ink-secondary mt-1">Welcome back.</p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-secondary">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="pl-surface rounded-(--radius-field) px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-secondary">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="pl-surface rounded-(--radius-field) px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 block w-full h-12 text-center bg-accent text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-70"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>

        {error && <p className="text-center text-[13px] text-danger">{error}</p>}
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
