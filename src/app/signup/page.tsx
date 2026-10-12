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
import { Check } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Button, Field, Input } from "@/components/ui";
import SkillLevelPicker from "@/components/SkillLevelPicker";
import { supabase } from "@/lib/supabaseClient";
import { createProfile } from "../profiles";
import { recordTermsAcceptance } from "../terms-acceptance";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // The button is disabled until the box is ticked; this is the backstop.
    if (!agreed) return;
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
      // They can only get here with the box ticked — record it as evidence.
      await recordTermsAcceptance();

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

        {/* Directly above the button, so agreeing is a deliberate act at the
            moment of signing up — Sign up stays disabled until it's ticked. */}
        <div className="flex items-start gap-3 mt-1">
          <span className="relative shrink-0 size-6 mt-px">
            <input
              id="signup-terms"
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="peer appearance-none size-6 rounded-[4px] border-2 border-tinta bg-papel checked:bg-lima cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
            />
            <Check
              aria-hidden
              strokeWidth={3.5}
              className="pointer-events-none absolute inset-0 m-auto size-4 text-tinta opacity-0 peer-checked:opacity-100"
            />
          </span>
          <label
            htmlFor="signup-terms"
            className="text-label font-medium text-tinta cursor-pointer"
          >
            I agree to the{" "}
            <Link
              href="/terms"
              className="font-bold underline underline-offset-2 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
            >
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-bold underline underline-offset-2 rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
            >
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        <Button type="submit" className="mt-1" loading={loading} disabled={!agreed}>
          {loading ? "Creating account…" : "Sign up"}
        </Button>

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
