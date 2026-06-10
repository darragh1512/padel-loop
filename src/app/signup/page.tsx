"use client";
// Runs in the browser. The sign-up screen: name, skill level, email + password
// to create a new account. As soon as the account is made we also create the
// person's PROFILE (their name + skill level), then send them to the home page.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createProfile } from "../profiles";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // "notice" is for the "check your email" message (see below).
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    // Ask Supabase to create the account.
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Two possible outcomes, depending on your Supabase settings:
    if (data.session) {
      // (a) The account is active straight away. We're logged in now, so we can
      //     create their profile row (name + skill level) before moving on.
      if (data.user) {
        await createProfile(data.user.id, { name, skill_level: skillLevel });
      }
      router.push("/");
    } else {
      // (b) Supabase is set to require email confirmation first. There's no
      //     active login yet, so the profile is created when they first open
      //     their profile page after confirming. Tell them to check their inbox.
      setNotice(
        "Account created! Please check your email to confirm it, then log in.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Sign up</h1>
        <p className="text-zinc-500">Create an account to join games.</p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Murphy"
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Skill level</span>
          <select
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </label>

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        {notice && (
          <p className="text-center text-sm text-emerald-700">{notice}</p>
        )}
      </form>

      {/* A way to get to the login page if they already have an account. */}
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-emerald-700 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
