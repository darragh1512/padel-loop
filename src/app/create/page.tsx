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
      <h1 className="font-display text-[28px] tracking-tight leading-tight text-ink mt-2 relative">
        Create a game
      </h1>
      <p className="text-[13px] text-ink-secondary mt-1 mb-4">
        Set it up once — we fill the slots.
      </p>

      <SectionLabel>Where &amp; when</SectionLabel>

      <label className="pl-surface w-full rounded-(--radius-field) px-4 py-3 mb-2.5 flex justify-between items-center gap-3 focus-within:border-accent">
        <span className="text-[13px] text-ink-secondary shrink-0">Venue</span>
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g. Malahide Padel Club"
          className="flex-1 min-w-0 bg-transparent text-right text-[15px] font-medium text-ink outline-none placeholder:text-ink-faint placeholder:font-normal"
        />
      </label>

      <label className="pl-surface w-full rounded-(--radius-field) px-4 py-3 mb-2.5 flex justify-between items-center gap-3 focus-within:border-accent">
        <span className="text-[13px] text-ink-secondary shrink-0">Location</span>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Malahide"
          className="flex-1 min-w-0 bg-transparent text-right text-[15px] font-medium text-ink outline-none placeholder:text-ink-faint placeholder:font-normal"
        />
      </label>

      <label className="pl-surface w-full rounded-(--radius-field) px-4 py-3 mb-2.5 flex justify-between items-center gap-3 focus-within:border-accent">
        <span className="text-[13px] text-ink-secondary shrink-0">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-right text-[15px] font-medium text-ink outline-none [color-scheme:light]"
        />
      </label>

      <label className="pl-surface w-full rounded-(--radius-field) px-4 py-3 mb-2.5 flex justify-between items-center gap-3 focus-within:border-accent">
        <span className="text-[13px] text-ink-secondary shrink-0">Time</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-right text-[15px] font-medium text-ink outline-none [color-scheme:light]"
        />
      </label>

      <SectionLabel>Game setup</SectionLabel>
      <div className="pl-surface flex rounded-full p-1 mb-2.5">
        {FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={`flex-1 text-center text-[13px] py-2 rounded-full transition-colors duration-150 ease-out ${
              format === f
                ? "bg-surface text-accent font-medium border border-line"
                : "text-ink-secondary font-medium border border-transparent"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="pl-surface rounded-(--radius-field) p-4 mb-2.5">
        <div className="flex justify-between text-[13px] text-ink-secondary mb-3">
          <span>Level range</span>
          <span className="text-ink font-semibold">
            {levelMin.toFixed(1)} — {levelMax.toFixed(1)}
          </span>
        </div>
        {/* TODO: replace static track with dual-range input */}
        <div className="h-1 bg-line rounded relative">
          <div className="absolute inset-y-0 left-[28%] right-[32%] bg-accent rounded" />
          <div className="absolute top-1/2 left-[28%] w-[18px] h-[18px] rounded-full bg-surface border border-line -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-[68%] w-[18px] h-[18px] rounded-full bg-surface border border-line -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpenToLoop(!openToLoop)}
        className="pl-surface w-full rounded-(--radius-field) px-4 py-3.5 mb-2.5 flex justify-between items-center text-left"
      >
        <div>
          <div className="text-[15px] font-medium text-ink">Open to the Loop</div>
          <div className="text-[13px] text-ink-secondary mt-0.5">
            Anyone in range can request a slot
          </div>
        </div>
        <span
          className={`w-[46px] h-[27px] rounded-full relative shrink-0 transition-colors duration-150 ease-out ${
            openToLoop ? "bg-accent" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-[3px] w-[21px] h-[21px] rounded-full bg-surface transition-all duration-150 ease-out ${
              openToLoop ? "right-[3px]" : "left-[3px]"
            }`}
          />
        </span>
      </button>

      <div className="rounded-(--radius-card) p-4 my-3.5 border border-line bg-accent-soft">
        <div className="flex justify-between text-[13px] text-ink-secondary py-0.5">
          <span>Court fee</span>
          <span className="text-ink font-semibold">€{courtFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[13px] text-ink-secondary py-0.5">
          <span>Players</span>
          <span className="text-ink font-semibold">{players}</span>
        </div>
        <div className="flex justify-between items-baseline text-[13px] text-ink-secondary py-0.5">
          <span>Each player pays</span>
          <span className="font-display text-[22px] text-ink">€{perHead.toFixed(2)}</span>
        </div>
      </div>

      <PrimaryButton onClick={handleCreate}>
        {saving ? "Creating…" : "Create game"}
      </PrimaryButton>
      {error && (
        <p className="text-center text-[13px] text-danger mt-2">
          Couldn&apos;t create that game. Please try again.
        </p>
      )}
      <div className="h-2.5" />
      <GhostButton>Save as draft</GhostButton>

      <BottomNav />
    </main>
  );
}
