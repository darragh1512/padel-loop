"use client";
// The sign-up screen: name, level, email + password.
//
// Email confirmation is OFF in Supabase, so creating the account signs the
// person in immediately — there is no interstitial and nothing to check an inbox
// for. We create their profile, then send them straight into the app: back to the
// game whose link brought them here if there is one, otherwise home (which routes
// first-timers on to /welcome).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthHeader, { useAuthSearch } from "@/components/AuthHeader";
import Icon from "@/components/ios/Icon";
import SkillLevelPicker from "@/components/SkillLevelPicker";
import { capture, identify } from "@/lib/analytics";
import { recordPath } from "@/lib/navMemory";
import { readAuthParams } from "@/lib/pendingIntent";
import { supabase } from "@/lib/supabaseClient";
import { createProfile } from "../profiles";
import { recordTermsAcceptance } from "../terms-acceptance";

export default function SignupPage() {
  const router = useRouter();
  const search = useAuthSearch();

  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // This screen has no tab bar, which is what normally remembers where someone has
  // been. Without this, Back from the Terms would send them to Log In instead.
  useEffect(() => recordPath("/signup"), []);

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
    // person is signed in from this moment.
    let userId = data.user?.id ?? null;

    // Belt and braces: if a session somehow doesn't come back (confirmation
    // switched on again, or a transient auth hiccup), sign in explicitly rather
    // than leaving them on a form that looks like it did nothing.
    if (!data.session) {
      const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError || !signIn.session) {
        setError("Your account was created, but we couldn’t sign you in. Try logging in.");
        setLoading(false);
        return;
      }
      userId = signIn.user?.id ?? userId;
    }

    if (userId) {
      await createProfile(userId, { name, skill_level: skillLevel });
      // They can only get here with the box ticked — record it as evidence.
      await recordTermsAcceptance();

      // Identify by auth user id only — the email and name they just typed are
      // never sent.
      identify(userId);
      capture("signed_up", { has_join_intent: readAuthParams().intent === "join" });
    }

    // Into the app: back to the game they came from with the join still pending,
    // or home.
    const { next, intent } = readAuthParams();
    router.push(intent === "join" && next !== "/" ? `${next}?intent=join` : next);
  }

  return (
    <main className="ios ios-auth">
      <AuthHeader title="Create Account" />

      <form onSubmit={handleSubmit}>
        <div className="ios-list" style={{ marginTop: 20 }}>
          <label className="ios-row ios-form-row">
            <span className="ios-bd">Name</span>
            <input
              className="ios-input"
              type="text"
              required
              autoComplete="name"
              autoCapitalize="words"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>
          <label className="ios-row ios-form-row">
            <span className="ios-bd">Email</span>
            <input
              className="ios-input"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="ios-row ios-form-row">
            <span className="ios-bd">Password</span>
            <input
              className="ios-input"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </label>
        </div>

        <div className="ios-sect" style={{ marginTop: 18 }}>
          <h2 className="ios-t3">Your Level</h2>
        </div>
        <SkillLevelPicker value={skillLevel} onChange={setSkillLevel} />

        {/* Directly above the button, so agreeing is a deliberate act at the
            moment of signing up — the button stays disabled until it's ticked. */}
        <div className="ios-list" style={{ marginTop: 12 }}>
          <div className="ios-row" style={{ padding: "12px 16px" }}>
            <span className="ios-check">
              <input
                id="signup-terms"
                type="checkbox"
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <Icon name="check" size={15} />
            </span>
            <label htmlFor="signup-terms" className="ios-sh ios-grow" style={{ cursor: "pointer" }}>
              I agree to the{" "}
              <Link href="/terms" className="ios-link ios-acc ios-sb">
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="ios-link ios-acc ios-sb">
                Privacy Policy
              </Link>
              .
            </label>
          </div>
        </div>

        {error && (
          <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", margin: "16px 16px 0" }}>
          <button
            type="submit"
            className="ios-wide-btn"
            data-tone="fill"
            disabled={!agreed || loading}
            aria-busy={loading || undefined}
          >
            {loading ? "Creating Account…" : "Sign Up"}
          </button>
        </div>
      </form>

      <p className="ios-sh ios-sec" style={{ textAlign: "center", marginTop: 16 }}>
        Already have an account?{" "}
        <Link href={`/login${search}`} className="ios-link ios-acc ios-sb">
          Log In
        </Link>
      </p>
    </main>
  );
}
