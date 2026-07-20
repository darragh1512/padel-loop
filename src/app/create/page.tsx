"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { GhostButton, PrimaryButton, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { createGame } from "../games";

const FORMATS = ["Doubles", "Singles", "Open"] as const;

export default function CreateGamePage() {
  const router = useRouter();

  // Who is logged in. Creating a game requires an account, so we send
  // logged-out visitors to the login page (route protection).
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
    });
  }, [router]);

  const [format, setFormat] = useState<(typeof FORMATS)[number]>("Doubles");
  const [openToLoop, setOpenToLoop] = useState(true);
  const [levelMin] = useState(3.0);
  const [levelMax] = useState(4.0);

  // Editable venue / location / date / time. Pre-filled with sensible defaults
  // (date = today) so a quick create still works, but all four are now real
  // inputs the user can change, and they feed straight into createGame.
  const [venue, setVenue] = useState("Malahide Padel Club");
  const [location, setLocation] = useState("Malahide");
  const [date, setDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [time, setTime] = useState("18:30");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const courtFee = 44;
  const players = format === "Singles" ? 2 : 4;
  const perHead = courtFee / players;

  async function handleCreate() {
    if (!userId) {
      router.replace("/login");
      return;
    }
    if (saving) return;

    // Need a venue, a location, a date and a time to make a valid game.
    if (!venue.trim() || !location.trim() || !date || !time) {
      setError(true);
      return;
    }

    setSaving(true);
    setError(false);

    // Combine the chosen date + time into a UTC timestamp, matching how the app
    // stores and displays game_time (UTC).
    const [yy, mm, dd] = date.split("-").map(Number);
    const [hh, min] = time.split(":").map(Number);
    const game_time = new Date(
      Date.UTC(yy, mm - 1, dd, hh, min, 0, 0),
    ).toISOString();

    // Map the level range to our text skill_level column.
    const skill_level =
      levelMin >= 3.5 ? "Advanced" : levelMin >= 2.5 ? "Intermediate" : "Beginner";

    const result = await createGame(
      {
        venue: venue.trim(),
        location: location.trim(),
        game_time,
        skill_level,
        max_players: players,
      },
      userId,
    );

    if ("id" in result) {
      router.push(`/games/${result.id}`);
    } else {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <main className="px-5 pt-6 relative">
      <p className="t-mono text-micro text-papel/80 mt-2">Pin it to the board</p>
      <h1 className="t-display text-display-md text-papel mt-1.5 relative">
        Create a game
      </h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        Set it up once — the Loop fills the slots.
      </p>

      <SectionLabel>Paso 1 · Where &amp; when</SectionLabel>

      <label className="pl-surface w-full rounded-field px-4 py-3 mb-2.5 flex justify-between items-center gap-3 focus-within:border-naranja">
        <span className="t-mono text-micro tracking-[0.12em] text-tinta/70 shrink-0">Venue</span>
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g. Malahide Padel Club"
          className="flex-1 min-w-0 bg-transparent text-right text-body font-semibold text-tinta outline-none placeholder:text-tinta/45 placeholder:font-normal"
        />
      </label>

      <label className="pl-surface w-full rounded-field px-4 py-3 mb-2.5 flex justify-between items-center gap-3 focus-within:border-naranja">
        <span className="t-mono text-micro tracking-[0.12em] text-tinta/70 shrink-0">Location</span>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Malahide"
          className="flex-1 min-w-0 bg-transparent text-right text-body font-semibold text-tinta outline-none placeholder:text-tinta/45 placeholder:font-normal"
        />
      </label>

      <label className="pl-surface w-full rounded-field px-4 py-3 mb-2.5 flex justify-between items-center gap-3 focus-within:border-naranja">
        <span className="t-mono text-micro tracking-[0.12em] text-tinta/70 shrink-0">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-right text-body font-semibold text-tinta outline-none [color-scheme:light]"
        />
      </label>

      <label className="pl-surface w-full rounded-field px-4 py-3 mb-2.5 flex justify-between items-center gap-3 focus-within:border-naranja">
        <span className="t-mono text-micro tracking-[0.12em] text-tinta/70 shrink-0">Time</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-right text-body font-semibold text-tinta outline-none [color-scheme:light]"
        />
      </label>

      <SectionLabel>Paso 2 · Game setup</SectionLabel>
      <div className="pl-surface flex rounded-full p-1 mb-2.5">
        {FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={`flex-1 text-center text-label py-2 rounded-full transition-colors duration-150 ease-out ${
              format === f
                ? "bg-lima text-tinta font-extrabold border-[1.5px] border-tinta"
                : "text-tinta/70 font-semibold border-[1.5px] border-transparent"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="pl-surface rounded-field p-4 mb-2.5">
        <div className="flex justify-between text-label mb-3">
          <span className="t-mono text-micro tracking-[0.12em] text-tinta/70">Level range</span>
          <span className="text-tinta font-extrabold">
            {levelMin.toFixed(1)} — {levelMax.toFixed(1)}
          </span>
        </div>
        {/* TODO: replace static track with dual-range input */}
        <div className="h-1 bg-tinta/15 rounded relative">
          <div className="absolute inset-y-0 left-[28%] right-[32%] bg-naranja rounded" />
          <div className="absolute top-1/2 left-[28%] w-4.5 h-4.5 rounded-full bg-papel border-2 border-tinta -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-[68%] w-4.5 h-4.5 rounded-full bg-papel border-2 border-tinta -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpenToLoop(!openToLoop)}
        className="pl-surface w-full rounded-field px-4 py-3.5 mb-2.5 flex justify-between items-center text-left"
      >
        <div>
          <div className="text-body font-extrabold text-tinta">Open to the Loop</div>
          <div className="text-label font-medium text-tinta/70 mt-0.5">
            Anyone in range can request a slot
          </div>
        </div>
        <span
          className={`w-11.5 h-6.75 rounded-full relative shrink-0 border-2 border-tinta transition-colors duration-150 ease-out ${
            openToLoop ? "bg-naranja" : "bg-tinta/15"
          }`}
        >
          <span
            className={`absolute top-[2px] w-5 h-5 rounded-full bg-papel border border-tinta transition-all duration-150 ease-out ${
              openToLoop ? "right-[2px]" : "left-[2px]"
            }`}
          />
        </span>
      </button>

      {/* The cost strip — the poster's naranja venue-strip voice. */}
      <div className="rounded-card p-4 my-3.5 bg-naranja text-papel">
        <div className="flex justify-between text-label font-medium py-0.5 opacity-90">
          <span>Court fee</span>
          <span className="font-extrabold opacity-100">€{courtFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-label font-medium py-0.5 opacity-90">
          <span>Players</span>
          <span className="font-extrabold opacity-100">{players}</span>
        </div>
        <div className="flex justify-between items-baseline text-label font-medium py-0.5">
          <span>Each player pays</span>
          <span className="t-display text-display-sm">€{perHead.toFixed(2)}</span>
        </div>
      </div>

      <PrimaryButton onClick={handleCreate}>
        {saving ? "Creating…" : "Create game"}
      </PrimaryButton>
      {error && (
        <p className="text-center text-label font-semibold text-papel bg-naranja-d rounded-field px-3 py-1.5 mt-2">
          Couldn&apos;t create that game. Please try again.
        </p>
      )}
      <div className="h-2.5" />
      <GhostButton>Save as draft</GhostButton>

      <BottomNav />
    </main>
  );
}
