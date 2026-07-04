"use client";
// The sign-up screen: name, skill level, email + password to create a new
// account. As soon as the account is made we also create the person's profile
// (name + skill level), then send them to the home page. Leads with the serif
// wordmark; logic unchanged.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand";
import { Button, Field, Input } from "@/components/ui";
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
        "Account created! Check your email to confirm it, then log in.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="px-5 pt-12">
      <header className="pl-rise">
        <Wordmark tagline="Find and join a padel game near you." />
        <h1 className="font-display text-display-md text-ink mt-10">Sign up</h1>
        <p className="text-label text-ink-secondary mt-1">
          Create an account and take your first spot.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="pl-rise mt-6 flex flex-col gap-3.5"
        style={{ animationDelay: "50ms" }}
      >
        <Field label="Name" htmlFor="signup-name" error={null}>
          <Input
            id="signup-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Murphy"
          />
        </Field>

        <Field label="Skill level" htmlFor="signup-skill" error={null}>
          <select
            id="signup-skill"
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            className="pl-surface w-full rounded-field px-4 py-3 text-body text-ink outline-none focus:border-accent transition-colors duration-150 ease-out"
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </Field>

        <Field label="Email" htmlFor="signup-email" error={null}>
          <Input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" htmlFor="signup-password" error={null}>
          <Input
            id="signup-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </Field>

        <Button type="submit" className="mt-2" loading={loading}>
          {loading ? "Creating account…" : "Sign up"}
        </Button>

        <p
          aria-live="polite"
          className={`text-center text-label text-danger ${error ? "" : "hidden"}`}
        >
          {error}
        </p>
        <p
          aria-live="polite"
          className={`text-center text-label text-success ${notice ? "" : "hidden"}`}
        >
          {notice}
        </p>
      </form>

      <p className="mt-6 text-center text-label text-ink-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-accent hover:underline rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}
