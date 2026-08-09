"use client";
// The create-game form — used both by the normal /create screen and by
// /groups/[id]/propose (a group member proposing a game inside their group).
// Same form either way; when `groupId` is set the game is created with that
// group_id (kept off Discover by the group_id filter in lib/data.ts — see
// getGames), the "Open to the Loop" toggle doesn't apply (group games are
// already private via group_id, not via that still-unwired toggle — a
// separate, already-logged bug this form doesn't touch), and a successful
// create lands back in the group's thread instead of the game's own page.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GhostButton, PrimaryButton, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { dublinToUtc } from "@/lib/time";
import { createGame } from "@/app/games";

const FORMATS = ["Doubles", "Singles", "Open"] as const;

export default function CreateGameForm({ groupId }: { groupId?: string }) {
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
  const [repeatsWeekly, setRepeatsWeekly] = useState(false);
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

    // The typed date + time are Dublin wall-clock values; store the true UTC
    // instant they correspond to (18:30 in summer = 17:30Z, in winter 18:30Z).
    const game_time = dublinToUtc(date, time);

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
        group_id: groupId,
        recurs_weekly: repeatsWeekly,
      },
      userId,
    );

    if ("id" in result) {
      router.push(groupId ? `/groups/${groupId}/chat` : `/games/${result.id}`);
    } else {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <>
      <p className="t-mono text-micro text-papel/80 mt-2">
        {groupId ? "For your group" : "Pin it to the board"}
      </p>
      <h1 className="t-display text-display-md text-papel mt-1.5 relative">
        {groupId ? "Propose a game" : "Create a game"}
      </h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        {groupId
          ? "Every member can join straight from the chat."
          : "Set it up once — the Loop fills the slots."}
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

      {groupId ? (
        // Group games are already off Discover via group_id (see getGames in
        // lib/data.ts) — the toggle below doesn't apply here, and showing it
        // would imply it does something, which today it doesn't for anyone
        // (separate, already-logged bug). A plain note instead.
        <div className="pl-surface w-full rounded-field px-4 py-3.5 mb-2.5">
          <div className="text-body font-extrabold text-tinta">Only your group sees this</div>
          <div className="text-label font-medium text-tinta/70 mt-0.5">
            Proposed games never appear on Discover.
          </div>
        </div>
      ) : (
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
      )}

      {/* Repeats weekly — same toggle voice as Open to the Loop. Applies to
          both normal and group games: the database rolls a recurring game
          into next week's instance after it's played, carrying the roster. */}
      <button
        type="button"
        onClick={() => setRepeatsWeekly(!repeatsWeekly)}
        className="pl-surface w-full rounded-field px-4 py-3.5 mb-2.5 flex justify-between items-center text-left"
      >
        <div>
          <div className="text-body font-extrabold text-tinta">Repeats weekly</div>
          <div className="text-label font-medium text-tinta/70 mt-0.5">
            Same day and time every week — this week&rsquo;s players carry over
          </div>
        </div>
        <span
          className={`w-11.5 h-6.75 rounded-full relative shrink-0 border-2 border-tinta transition-colors duration-150 ease-out ${
            repeatsWeekly ? "bg-naranja" : "bg-tinta/15"
          }`}
        >
          <span
            className={`absolute top-[2px] w-5 h-5 rounded-full bg-papel border border-tinta transition-all duration-150 ease-out ${
              repeatsWeekly ? "right-[2px]" : "left-[2px]"
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
        {saving ? "Creating…" : groupId ? "Propose game" : "Create game"}
      </PrimaryButton>
      {error && (
        <p className="text-center text-label font-semibold text-papel bg-naranja-d rounded-field px-3 py-1.5 mt-2">
          Couldn&apos;t create that game. Please try again.
        </p>
      )}
      <div className="h-2.5" />
      <GhostButton>Save as draft</GhostButton>
    </>
  );
}
