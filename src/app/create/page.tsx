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
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <h1 className="font-display text-xl tracking-tight mt-2 relative">
        <b className="font-bold">Create</b> <span className="font-light text-sky">a game</span>
      </h1>
      <p className="text-[13px] text-dim font-light mt-1 mb-4">
        Set it up once — we fill the slots.
      </p>

      <SectionLabel>Where &amp; when</SectionLabel>

      <label className="pl-surface w-full rounded-[17px] px-4 py-3 mb-2.5 flex justify-between items-center gap-3">
        <span className="text-[13px] text-dim font-light shrink-0">Venue</span>
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g. Malahide Padel Club"
          className="flex-1 min-w-0 bg-transparent text-right text-sm font-semibold text-white outline-none placeholder:text-faint placeholder:font-light"
        />
      </label>

      <label className="pl-surface w-full rounded-[17px] px-4 py-3 mb-2.5 flex justify-between items-center gap-3">
        <span className="text-[13px] text-dim font-light shrink-0">Location</span>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Malahide"
          className="flex-1 min-w-0 bg-transparent text-right text-sm font-semibold text-white outline-none placeholder:text-faint placeholder:font-light"
        />
      </label>

      <label className="pl-surface w-full rounded-[17px] px-4 py-3 mb-2.5 flex justify-between items-center gap-3">
        <span className="text-[13px] text-dim font-light shrink-0">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-right text-sm font-semibold text-white outline-none [color-scheme:dark]"
        />
      </label>

      <label className="pl-surface w-full rounded-[17px] px-4 py-3 mb-2.5 flex justify-between items-center gap-3">
        <span className="text-[13px] text-dim font-light shrink-0">Time</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-right text-sm font-semibold text-white outline-none [color-scheme:dark]"
        />
      </label>

      <SectionLabel>Game setup</SectionLabel>
      <div className="pl-surface flex rounded-(--radius-btn) p-1 mb-2.5">
        {FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={`flex-1 text-center text-[12.5px] py-2 rounded-[11px] transition-colors ${
              format === f
                ? "bg-vivid text-white font-semibold shadow-[0_4px_14px_rgba(30,92,255,0.35)]"
                : "text-faint font-medium"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="pl-surface rounded-[17px] p-4 mb-2.5">
        <div className="flex justify-between text-xs text-dim mb-3">
          <span>Level range</span>
          <b className="text-pale font-semibold text-[13px]">
            {levelMin.toFixed(1)} — {levelMax.toFixed(1)}
          </b>
        </div>
        {/* TODO: replace static track with dual-range input */}
        <div className="h-1 bg-white/10 rounded relative">
          <div className="absolute inset-y-0 left-[28%] right-[32%] bg-gradient-to-r from-mid to-vivid rounded" />
          <div className="absolute top-1/2 left-[28%] w-[18px] h-[18px] rounded-full bg-white -translate-x-1/2 -translate-y-1/2 shadow-[0_2px_10px_rgba(30,92,255,0.6)]" />
          <div className="absolute top-1/2 left-[68%] w-[18px] h-[18px] rounded-full bg-white -translate-x-1/2 -translate-y-1/2 shadow-[0_2px_10px_rgba(30,92,255,0.6)]" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpenToLoop(!openToLoop)}
        className="pl-surface w-full rounded-[17px] px-4 py-3.5 mb-2.5 flex justify-between items-center text-left"
      >
        <div>
          <div className="text-[13.5px] font-medium">Open to the Loop</div>
          <div className="text-[11px] text-faint font-light mt-0.5">
            Anyone in range can request a slot
          </div>
        </div>
        <span
          className={`w-[46px] h-[27px] rounded-full relative shrink-0 transition-colors ${
            openToLoop ? "bg-vivid" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-[3px] w-[21px] h-[21px] rounded-full bg-white transition-all ${
              openToLoop ? "right-[3px]" : "left-[3px]"
            }`}
          />
        </span>
      </button>

      <div className="rounded-[20px] p-4 my-3.5 border border-sky/25 bg-gradient-to-br from-vivid/16 to-deep/60">
        <div className="flex justify-between text-[12.5px] text-dim py-0.5">
          <span>Court fee</span>
          <b className="text-white font-semibold">€{courtFee.toFixed(2)}</b>
        </div>
        <div className="flex justify-between text-[12.5px] text-dim py-0.5">
          <span>Players</span>
          <b className="text-white font-semibold">{players}</b>
        </div>
        <div className="flex justify-between items-center text-[12.5px] text-dim py-0.5">
          <span>Each player pays</span>
          <b className="text-sky font-display text-[15px]">€{perHead.toFixed(2)}</b>
        </div>
      </div>

      <PrimaryButton onClick={handleCreate}>
        {saving ? "Creating…" : "Create game"}
      </PrimaryButton>
      {error && (
        <p className="text-center text-[12px] text-[#d98080] mt-2">
          Couldn&apos;t create that game. Please try again.
        </p>
      )}
      <div className="h-2.5" />
      <GhostButton>Save as draft</GhostButton>

      <BottomNav />
    </main>
  );
}
