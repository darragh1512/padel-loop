"use client";
// The sign-up screen: name, skill level, email + password to create a new
// account. As soon as the account is made we also create the person's profile
// (name + skill level), then send them to the home page. Styled in the app's
// dark design; logic unchanged.

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
    <main className="px-5 pt-10">
      <header>
        <h1 className="font-display text-[22px] font-bold tracking-tight">Sign up</h1>
        <p className="text-[13px] text-dim font-light mt-1">Create an account to join games.</p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Murphy"
            className="pl-surface rounded-[14px] px-4 py-3 text-sm text-white outline-none focus:border-sky/60"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[2px] uppercase text-faint font-display font-light">Skill level</span>
          <select
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            className="bg-deep border border-white/10 rounded-[14px] px-4 py-3 text-sm text-white outline-none focus:border-sky/60"
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </label>

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="pl-surface rounded-[14px] px-4 py-3 text-sm text-white outline-none focus:border-sky/60"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 block w-full text-center bg-vivid text-white font-semibold text-[15px] rounded-(--radius-btn) py-3.5 pl-cta-shadow active:scale-[0.98] transition-transform disabled:opacity-70"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>

        {error && <p className="text-center text-[12px] text-[#d98080]">{error}</p>}
        {notice && <p className="text-center text-[12px] text-sky">{notice}</p>}
      </form>

      <p className="mt-6 text-center text-[13px] text-dim font-light">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-sky hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
