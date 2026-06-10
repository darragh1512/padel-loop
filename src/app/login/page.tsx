"use client";
// The log-in screen: email + password, then sends the user to the home page
// once they're in. Styled in the app's dark design; logic unchanged.

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
    <main className="px-5 pt-10">
      <header>
        <h1 className="font-display text-[22px] font-bold tracking-tight">Log in</h1>
        <p className="text-[13px] text-dim font-light mt-1">Welcome back.</p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="pl-surface rounded-[14px] px-4 py-3 text-sm text-white outline-none focus:border-sky/60"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="pl-surface rounded-[14px] px-4 py-3 text-sm text-white outline-none focus:border-sky/60"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 block w-full text-center bg-vivid text-white font-semibold text-[15px] rounded-(--radius-btn) py-3.5 pl-cta-shadow active:scale-[0.98] transition-transform disabled:opacity-70"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>

        {error && <p className="text-center text-[12px] text-[#d98080]">{error}</p>}
      </form>

      <p className="mt-6 text-center text-[13px] text-dim font-light">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-sky hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
