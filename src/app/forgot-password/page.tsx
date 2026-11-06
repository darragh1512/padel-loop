"use client";
// Asks for an email address and sends a link to set a new password.
//
// The message afterwards is the same whether or not that address has an account,
// so this screen can't be used to find out who is on Padel Loop.

import Link from "next/link";
import { useState } from "react";
import AuthHeader, { useAuthSearch } from "@/components/AuthHeader";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const search = useAuthSearch();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many tries. Wait a few minutes, then try again."
          : "Couldn’t send the link. Check your connection and try again.",
      );
      return;
    }
    setSent(true);
  }

  return (
    <main className="ios ios-auth">
      <AuthHeader title="Reset Password" subtitle={sent ? "Check your email." : "We’ll email you a link to set a new one."} />

      {sent ? (
        <div className="ios-card ios-sh" style={{ marginTop: 20, padding: 16 }} role="status">
          If there’s an account for {email.trim()}, a link is on its way. It can take a minute, so check your junk folder
          too.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="ios-list" style={{ marginTop: 20 }}>
            <label className="ios-row ios-form-row">
              <span className="ios-bd">Email</span>
              <input
                className="ios-input"
                type="email"
                required
                autoFocus
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
              {loading ? "Sending…" : "Send Link"}
            </button>
          </div>
        </form>
      )}

      <p className="ios-sh" style={{ textAlign: "center", marginTop: 16 }}>
        <Link href={`/login${search}`} className="ios-link ios-acc ios-sb">
          Back to Log In
        </Link>
      </p>
    </main>
  );
}
