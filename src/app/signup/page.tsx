"use client";
// The sign-up screen: name, skill level, email + password.
//
// Email confirmation is OFF in Supabase, so creating the account signs the
// person in immediately — there is no interstitial and nothing to check an
// inbox for. We create their profile, then send them straight into the app:
// back to the game whose link brought them here if there is one, otherwise
// home (which routes first-timers on to /welcome).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { readAuthParams } from "@/lib/pendingIntent";
import { capture, identify } from "@/lib/analytics";
import { useState } from "react";
import { Wordmark } from "@/components/brand";
import { Button, Field, Input } from "@/components/ui";
import SkillLevelPicker from "@/components/SkillLevelPicker";
import { supabase } from "@/lib/supabaseClient";
import { createProfile } from "../profiles";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Email confirmation is OFF, so signUp hands back a live session and the
    // person is signed in from this moment. There is no "check your email"
    // step and no interruption — they go straight into the app.
    let userId = data.user?.id ?? null;

    // Belt and braces: if a session somehow doesn't come back (confirmation
    // switched on again, or a transient auth hiccup), sign in explicitly
    // rather than leaving them on a form that looks like it did nothing.
    if (!data.session) {
      const { data: signIn, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (signInError || !signIn.session) {
        setError(
          "Your account was created, but we couldn't sign you in. Try logging in.",
        );
        setLoading(false);
        return;
      }
      userId = signIn.user?.id ?? userId;
    }

    if (userId) {
      await createProfile(userId, { name, skill_level: skillLevel });

      // Identify by auth user id only — the email and name they just typed
      // are never sent.
      identify(userId);
      capture("signed_up", { has_join_intent: readAuthParams().intent === "join" });
    }

    // Into the app: back to the game they came from with the join still
    // pending, or home.
    const { next, intent } = readAuthParams();
    router.push(
      intent === "join" && next !== "/" ? `${next}?intent=join` : next,
    );
  }

  return (
    <main className="px-5 pt-12">
      <header className="pl-rise text-papel">
        <Wordmark tagline="Find and join a padel game near you." />
        <h1 className="t-display text-display-md text-papel mt-10">
          J<span className="text-lima">o</span>in the club
        </h1>
        <p className="text-label font-medium text-papel/85 mt-1.5">
          Create an account and take your first spot. ¿Jugamos?
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="pl-rise pl-card pena-staples pena-tilt-c mt-6 p-5 pt-7 flex flex-col gap-3.5"
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

        <div>
          <span className="t-mono block text-micro opacity-85 mb-1.5">Skill level</span>
          <SkillLevelPicker value={skillLevel} onChange={setSkillLevel} />
        </div>

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

        {/* Directly under the button, so it is read at the moment of
            agreeing rather than buried at the foot of the page. */}
        <p className="text-center text-label font-medium text-papel/70">
          Creating an account means you accept our{" "}
          <Link
            href="/terms"
            className="text-lima underline underline-offset-2 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
          >
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-lima underline underline-offset-2 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <p
          aria-live="polite"
          className={`text-center text-label font-semibold text-naranja-d ${error ? "" : "hidden"}`}
        >
          {error}
        </p>
      </form>

      <p className="mt-6 text-center text-label font-medium text-papel/85">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-extrabold text-lima hover:underline rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}
