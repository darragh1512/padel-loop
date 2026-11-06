"use client";
// The log-in screen: email + password, then back to whatever they were doing.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthHeader, { useAuthSearch } from "@/components/AuthHeader";
import { readAuthParams } from "@/lib/pendingIntent";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const search = useAuthSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Back to whatever they were trying to do — the game they tapped Join on,
    // carrying ?intent=join so the join fires on arrival. Home only when they
    // came here under their own steam.
    const { next, intent } = readAuthParams();
    router.push(intent === "join" && next !== "/" ? `${next}?intent=join` : next);
  }

  return (
    <main className="ios ios-auth">
      <AuthHeader title="Log In" />

      <form onSubmit={handleSubmit}>
        <div className="ios-list" style={{ marginTop: 20 }}>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </label>
        </div>

        {error && (
          <div className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", margin: "16px 16px 0" }}>
          <button type="submit" className="ios-wide-btn" data-tone="fill" disabled={loading} aria-busy={loading || undefined}>
            {loading ? "Logging In…" : "Log In"}
          </button>
        </div>
      </form>

      <p className="ios-sh ios-sec" style={{ textAlign: "center", marginTop: 16 }}>
        Don’t have an account?{" "}
        <Link href={`/signup${search}`} className="ios-link ios-acc ios-sb">
          Sign Up
        </Link>
      </p>
    </main>
  );
}
