"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { GhostButton, PrimaryButton, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { createGame } from "../games";

const FORMATS = ["Doubles", "Singles", "Open"] as const;

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      className="pl-surface w-full rounded-[17px] px-4 py-3.5 mb-2.5 flex justify-between items-center"
    >
      <span className="text-[13px] text-dim font-light">{label}</span>
      <span className="text-sm font-semibold flex items-center gap-1.5">
        {value}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-50">
          <path d="m9 6 6 6-6 6" stroke="#c4d9ff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  );
}

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

  // The venue / date / time pickers are still design TODOs, so we create the
  // game with the values shown on screen (a concrete game_time is computed).
  const venueLabel = "Malahide Padel Club";
  const dateLabel = "Thu 12 Jun";
  const timeLabel = "18:30 · 90 min";

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
    setSaving(true);
    setError(false);

    // Date/time sheets are TODO — use the shown time (18:30 today, UTC) so the
    // new game has a valid, sensible game_time.
    const dt = new Date();
    dt.setUTCHours(18, 30, 0, 0);
    const game_time = dt.toISOString();

    // Map the level range to our text skill_level column.
    const skill_level =
      levelMin >= 3.5 ? "Advanced" : levelMin >= 2.5 ? "Intermediate" : "Beginner";

    const result = await createGame(
      {
        venue: venueLabel,
        location: "Malahide",
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
      {/* TODO: replace with venue picker / date & time sheets */}
      <FieldRow label="Venue" value={venueLabel} />
      <FieldRow label="Date" value={dateLabel} />
      <FieldRow label="Time" value={timeLabel} />

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
