"use client";
// This screen runs in the visitor's browser. It shows the logged-in person
// their own profile (name, skill level, home area) and lets them edit it and
// save the changes back to the Supabase "profiles" table. It lives at
// "/profile".

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getProfile, updateProfile } from "../profiles";

export default function ProfilePage() {
  // "router" lets us send the user to another page (e.g. to log in).
  const router = useRouter();

  // Who is logged in. We need their user id to load and save their profile.
  const [userId, setUserId] = useState<string | null>(null);
  // "loading" is true until we've checked the login and fetched their profile.
  const [loading, setLoading] = useState(true);

  // The form fields, holding what the user has typed so far.
  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [homeArea, setHomeArea] = useState("");

  // "saving" is true while we're talking to the database. "error" holds a
  // message if a save failed; "saved" shows a brief success message.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  // When the page opens: make sure someone is logged in, then load their
  // profile into the form. If nobody is logged in, send them to the login page.
  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }

      setUserId(data.user.id);

      // Fetch their existing profile and fill the form with it. If they don't
      // have one yet, the form simply starts blank.
      const profile = await getProfile(data.user.id);
      if (profile) {
        setName(profile.name ?? "");
        setSkillLevel(profile.skill_level ?? "Beginner");
        setHomeArea(profile.home_area ?? "");
      }

      setLoading(false);
    }

    load();
  }, [router]);

  // Runs when the form is submitted (the "Save changes" button is tapped).
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); // stop the browser reloading the page

    // Safety check: we should always have a logged-in user here.
    if (!userId) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setError(false);
    setSaved(false);

    const result = await updateProfile(userId, {
      name,
      skill_level: skillLevel,
      home_area: homeArea,
    });

    if ("ok" in result) {
      setSaved(true);
    } else {
      setError(true);
    }
    setSaving(false);
  }

  // While we confirm the login and load the profile, show a quiet placeholder.
  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
        <p className="text-zinc-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      {/* Back to the list of games. */}
      <Link
        href="/"
        className="inline-block text-sm text-emerald-700 hover:underline"
      >
        ← Back to games
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-bold text-zinc-900">Your profile</h1>
        <p className="text-zinc-500">
          Update your details so games match you better.
        </p>
      </header>

      {/* The form. Each field updates its piece of memory as the user types. */}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {/* Name */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Murphy"
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          />
        </label>

        {/* Skill level */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Skill level</span>
          <select
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </label>

        {/* Home area */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Home area</span>
          <input
            type="text"
            value={homeArea}
            onChange={(e) => setHomeArea(e.target.value)}
            placeholder="e.g. Sandyford"
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          />
        </label>

        {/* Submit button */}
        <button
          type="submit"
          disabled={saving}
          className="mt-2 w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        {/* Friendly messages after a save attempt. */}
        {saved && (
          <p className="text-center text-sm text-emerald-700">
            Saved! Your profile is up to date.
          </p>
        )}
        {error && (
          <p className="text-center text-sm text-red-600">
            Sorry, that didn&apos;t work. Please try again.
          </p>
        )}
      </form>
    </main>
  );
}
