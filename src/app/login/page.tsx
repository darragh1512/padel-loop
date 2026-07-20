"use client";
// The log-in screen: email + password, then sends the user to the home page
// once they're in. Leads with the serif wordmark; logic unchanged.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClubStamp, Wordmark } from "@/components/brand";
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
      <header className="pl-rise text-papel">
        <Wordmark tagline="Find and join a padel game near you." />
        <h1 className="t-display text-display-md text-papel mt-10">
          L<span className="text-lima">o</span>g in
        </h1>
        <p className="text-label font-medium text-papel/85 mt-1.5">Welcome back to the club.</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="pl-rise pl-card pena-staples pena-tilt-c mt-6 p-5 pt-7 flex flex-col gap-3.5"
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
          className={`text-center text-label font-semibold text-naranja-d ${error ? "" : "hidden"}`}
        >
          {error}
        </p>
      </form>

      <p className="mt-6 text-center text-label font-medium text-papel/85">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-extrabold text-lima hover:underline rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
        >
          Sign up
        </Link>
      </p>

      {/* The club stamp, inked in papel at the bottom of the door. */}
      <div className="flex justify-center mt-10 text-papel/90" aria-hidden>
        <ClubStamp size={104} />
      </div>
    </main>
  );
}
