"use client";
// The line above means: this screen runs in the visitor's browser, because a
// form that the user types into and submits needs to react to what they do.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createGame } from "../../games";
import { supabase } from "@/lib/supabaseClient";

// The form for creating a brand-new game. It lives at "/games/new".
export default function NewGamePage() {
  // "router" lets us send the user to another page after they submit.
  const router = useRouter();

  // Who is logged in. We need their user id to record who created the game.
  const [userId, setUserId] = useState<string | null>(null);
  // "checking" is true until we've confirmed someone is logged in.
  const [checking, setChecking] = useState(true);

  // When the page opens, make sure someone is logged in. If not, send them to
  // the login page — you must have an account to create a game.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setChecking(false);
    });
  }, [router]);

  // One piece of memory per field, holding what the user has typed so far.
  const [venue, setVenue] = useState("");
  const [location, setLocation] = useState("");
  const [gameTime, setGameTime] = useState(""); // from a date-and-time picker
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [maxPlayers, setMaxPlayers] = useState(4);

  // "saving" is true while we're talking to the database; "error" holds a
  // message if something went wrong.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // Runs when the form is submitted (the "Create game" button is tapped).
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); // stop the browser's default page-reload behaviour

    // Safety check: we should always have a logged-in user here, but if not,
    // send them to log in rather than failing.
    if (!userId) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setError(false);

    // The date-and-time picker gives a value like "2026-06-10T17:30". We treat
    // that as a UTC time so it shows on screen exactly as typed (the same way
    // the rest of the app handles times).
    const gameTimeUtc = new Date(gameTime + "Z").toISOString();

    const result = await createGame(
      {
        venue,
        location,
        game_time: gameTimeUtc,
        skill_level: skillLevel,
        max_players: maxPlayers,
      },
      userId,
    );

    if ("id" in result) {
      // Saved! Send the user to the new game's detail page.
      router.push(`/games/${result.id}`);
    } else {
      // Something went wrong — let them try again.
      setError(true);
      setSaving(false);
    }
  }

  // While we confirm the user is logged in, show a quiet placeholder. (If they
  // aren't logged in, the check above is already sending them to the login page.)
  if (checking) {
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
        <h1 className="text-2xl font-bold text-zinc-900">Create a game</h1>
        <p className="text-zinc-500">Fill in the details and others can join.</p>
      </header>

      {/* The form. Each field updates its piece of memory as the user types. */}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {/* Venue */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Venue</span>
          <input
            type="text"
            required
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g. Dublin Padel Club"
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          />
        </label>

        {/* Location */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Location</span>
          <input
            type="text"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Sandyford"
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          />
        </label>

        {/* Game time */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Date & time</span>
          <input
            type="datetime-local"
            required
            value={gameTime}
            onChange={(e) => setGameTime(e.target.value)}
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

        {/* Max players */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">
            Max players
          </span>
          <input
            type="number"
            required
            min={2}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500"
          />
        </label>

        {/* Submit button */}
        <button
          type="submit"
          disabled={saving}
          className="mt-2 w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Create game"}
        </button>

        {/* If saving failed, show a friendly message. */}
        {error && (
          <p className="text-center text-sm text-red-600">
            Sorry, that didn&apos;t work. Please try again.
          </p>
        )}
      </form>
    </main>
  );
}
