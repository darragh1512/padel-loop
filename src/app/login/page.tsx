"use client";
// The log-in screen: email + password, then sends the user to the home page
// once they're in. Leads with the serif wordmark; logic unchanged.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand";
import { Button, Field, Input } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <main className="px-5 pt-12">
      <header className="pl-rise">
        <Wordmark tagline="Find and join a padel game near you." />
        <h1 className="font-display text-display-md text-ink mt-10">Log in</h1>
        <p className="text-label text-ink-secondary mt-1">Welcome back.</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="pl-rise mt-6 flex flex-col gap-3.5"
        style={{ animationDelay: "50ms" }}
      >
        <Field label="Email" htmlFor="login-email" error={null}>
          <Input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" htmlFor="login-password" error={null}>
          <Input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </Field>

        <Button type="submit" className="mt-2" loading={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>

        <p
          aria-live="polite"
          className={`text-center text-label text-danger ${error ? "" : "hidden"}`}
        >
          {error}
        </p>
      </form>

      <p className="mt-6 text-center text-label text-ink-secondary">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-accent hover:underline rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Sign up
        </Link>
      </p>
    </main>
  );
}
