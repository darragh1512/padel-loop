"use client";
// The sign-up screen: name, skill level, email + password to create a new
// account. As soon as the account is made we also create the person's profile
// (name + skill level), then send them to the home page. Leads with the serif
// wordmark; logic unchanged.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand";
import { supabase } from "@/lib/supabaseClient";
import { createProfile } from "../profiles";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Active straight away — create their profile, then go home.
      if (data.user) {
        await createProfile(data.user.id, { name, skill_level: skillLevel });
      }
      router.push("/");
    } else {
      // Email confirmation required — profile is created on first profile visit.
      setNotice(
        "Account created! Please check your email to confirm it, then log in.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="px-5 pt-12">
      <header>
        <Wordmark tagline="Find and join a padel game near you." />
        <h1 className="font-display text-[28px] tracking-tight leading-tight text-ink mt-10">Sign up</h1>
        <p className="text-[13px] text-ink-secondary mt-1">Create an account to join games.</p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-secondary">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Murphy"
            className="pl-surface rounded-(--radius-field) px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-secondary">Skill level</span>
          <select
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            className="pl-surface rounded-(--radius-field) px-4 py-3 text-[15px] text-ink outline-none focus:border-accent"
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </label>

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="pl-surface rounded-(--radius-field) px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 block w-full h-12 text-center bg-accent text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-70"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>

        {error && <p className="text-center text-[13px] text-danger">{error}</p>}
        {notice && <p className="text-center text-[13px] text-accent">{notice}</p>}
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
