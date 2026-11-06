"use client";
// Where the emailed link lands: choose a new password.
//
// Only a real link opens the form. A person already signed in who types this
// address doesn't get to change the password without their old one.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthHeader from "@/components/AuthHeader";
import { supabase } from "@/lib/supabaseClient";

// Read as this file loads, because the sign-in service clears the address as soon
// as it has used the link.
const arrivedWithLink =
  typeof window !== "undefined" && /(^|[#&])type=recovery(&|$)/.test(window.location.hash);

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null); // null: still checking
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (active) setReady((now) => now ?? (arrivedWithLink && data.session != null));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(
        error.code === "same_password"
          ? "That’s your current password. Choose a different one."
          : "Couldn’t change your password. Try again.",
      );
      setLoading(false);
      return;
    }
    router.replace("/");
  }

  if (ready === null) return <main className="ios ios-auth" />;

  if (!ready) {
    return (
      <main className="ios ios-auth">
        <AuthHeader title="Link Not Valid" subtitle="It may have expired or already been used." />
        <div style={{ display: "flex", margin: "20px 16px 0" }}>
          <Link href="/forgot-password" className="ios-wide-btn ios-link" data-tone="fill">
            Send a New Link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="ios ios-auth">
      <AuthHeader title="New Password" subtitle="Choose a new password for your account." />
      <form onSubmit={handleSubmit}>
        <div className="ios-list" style={{ marginTop: 20 }}>
          <label className="ios-row ios-form-row">
            <span className="ios-bd">Password</span>
            <input
              className="ios-input"
              type="password"
              required
              autoFocus
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
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
            {loading ? "Saving…" : "Save Password"}
          </button>
        </div>
      </form>
    </main>
  );
}
