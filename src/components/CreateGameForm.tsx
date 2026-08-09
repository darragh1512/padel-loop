"use client";
// The create-game form — used both by the normal /create screen and by
// /groups/[id]/propose (a group member proposing a game inside their group).
// Same form either way; when `groupId` is set the game is created with that
// group_id (kept off Discover by the group_id filter in lib/data.ts — see
// getGames), the "Open to the Loop" toggle doesn't apply (group games are
// already private via group_id, not via that still-unwired toggle — a
// separate, already-logged bug this form doesn't touch), and a successful
// create lands back in the group's thread instead of the game's own page.
//
// Layout follows the prototype: two numbered sections on the wall, the
// where-and-when details gathered into one poster, and the create action
// pinned to the foot of the screen above the navigation.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { dublinToUtc } from "@/lib/time";
import { createGame } from "@/app/games";

const FORMATS = ["Doubles", "Singles", "Open"] as const;

// The rating ladder shown in the level-range picker. Index into this, not the
// value — the picker works on positions.
const LEVELS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

// Quick-pick kick-off times. These just set the time field below.
const SLOTS = ["18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

const COURT_FEE = 44;

/* The section rule: a tracked-out mono label with an ink hairline. */
function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mx-0.5 mb-2 mt-4.5">
      <span className="t-mono text-tiny tracking-[0.2em] text-papel/72 whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-0.5 bg-papel/18" />
    </div>
  );
}

/* A settings row with a switch. The whole row is the target. */
function ToggleRow({
  title,
  desc,
  on,
  onToggle,
  last = false,
}: {
  title: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3.5 py-3 text-left text-tinta focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-naranja ${
        last ? "" : "border-b-2 border-tinta/15"
      }`}
    >
      <span className="flex-1 min-w-0">
        <span className="t-display block text-[0.875rem]">{title}</span>
        <span className="block text-label text-tinta/62 mt-0.5 leading-tight">
          {desc}
        </span>
      </span>
      <span
        className={`flex-none w-12 h-6.75 rounded-pill border-2 border-tinta flex items-center p-0.5 transition-colors duration-200 ease-out ${
          on ? "bg-naranja" : "bg-tinta/14"
        }`}
      >
        <span
          className={`size-4.75 rounded-pill bg-papel border-2 border-tinta transition-transform duration-200 ease-out ${
            on ? "translate-x-5.25" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

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

  // The level range, held as positions in LEVELS. Tapping a cell moves
  // whichever end is nearer, so a range can be set with two taps.
  const [lo, setLo] = useState(4); // 3.0
  const [hi, setHi] = useState(6); // 4.0
  function pickLevel(i: number) {
    if (i < lo) setLo(i);
    else if (i > hi) setHi(i);
    else if (i - lo <= hi - i) setLo(i);
    else setHi(i);
  }

  // Editable venue / location / date / time. Pre-filled with sensible defaults
  // (date = today) so a quick create still works, but all four are real inputs
  // the user can change, and they feed straight into createGame.
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

  const players = format === "Singles" ? 2 : 4;
  const perHead = COURT_FEE / players;

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

    // Map the level range to our text skill_level column — the bottom of the
    // range decides, exactly as before.
    const levelMin = Number(LEVELS[lo]);
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
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-1">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="size-9 flex-none rounded-pill border-2 border-papel/35 bg-white/8 hover:bg-white/18 grid place-items-center transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden>
            <path
              d="M15 5l-7 7 7 7"
              stroke="var(--color-papel)"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="t-eyebrow text-tiny text-lima">
            {groupId ? "For your group" : "Pin it to the board"}
          </div>
          <h1 className="t-display text-[clamp(1.375rem,6.5vw,1.6875rem)] leading-none text-white mt-0.5">
            {groupId ? "Propose a game" : "Create a game"}
            <span className="text-naranja">.</span>
          </h1>
        </div>
      </div>

      {/* ── 01 · Where & when ────────────────────────────────────────────── */}
      <Rule>01 · Where &amp; when</Rule>

      <div className="pl-card overflow-hidden">
        {/* Venue + area, edited in place. */}
        <div className="flex items-center gap-3 px-3.5 py-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="flex-none text-tinta"
          >
            <path
              d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div className="flex-1 min-w-0">
            <label
              htmlFor="cg-venue"
              className="t-mono block text-[0.5625rem] tracking-[0.18em] text-tinta/50"
            >
              Venue
            </label>
            <input
              id="cg-venue"
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Where are you playing?"
              className="t-display w-full bg-transparent text-[1rem] text-tinta outline-none mt-0.5 placeholder:text-tinta/35 focus:text-naranja-d"
            />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Area"
              aria-label="Area"
              className="t-mono w-full bg-transparent text-micro tracking-normal normal-case text-tinta/60 outline-none mt-0.5 placeholder:text-tinta/35 focus:text-naranja-d"
            />
          </div>
        </div>

        <div className="h-0.5 bg-tinta/15" />

        {/* Date and time, side by side with an ink rule between. */}
        <div className="grid grid-cols-[1fr_2px_1fr]">
          <div className="px-3.5 py-2.75 min-w-0">
            <label
              htmlFor="cg-date"
              className="t-mono block text-[0.5625rem] tracking-[0.18em] text-tinta/50"
            >
              Date
            </label>
            <input
              id="cg-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="t-display w-full bg-transparent text-[1rem] text-tinta outline-none mt-0.75 [color-scheme:light] focus:text-naranja-d"
            />
          </div>
          <div className="bg-tinta/15" />
          <div className="px-3.5 py-2.75 min-w-0">
            <label
              htmlFor="cg-time"
              className="t-mono block text-[0.5625rem] tracking-[0.18em] text-tinta/50"
            >
              Time
            </label>
            <input
              id="cg-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="t-display w-full bg-transparent text-[1rem] text-tinta outline-none mt-0.75 [color-scheme:light] focus:text-naranja-d"
            />
          </div>
        </div>

        {/* Quick kick-off times — these just fill the time field above. */}
        <div className="flex gap-1.5 px-3.5 pb-3 overflow-x-auto no-scrollbar">
          {SLOTS.map((s) => {
            const on = time === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setTime(s)}
                aria-pressed={on}
                className={`t-mono flex-none rounded-pill px-2.5 py-1.5 text-micro tracking-[0.06em] border-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-naranja ${
                  on
                    ? "border-tinta bg-tinta text-lima"
                    : "border-tinta/30 bg-transparent text-tinta/60 hover:border-tinta/60"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 02 · Game setup ──────────────────────────────────────────────── */}
      <Rule>02 · Game setup</Rule>

      {/* Format — the inset segmented control, lime for the chosen one. */}
      <div className="flex gap-1.5 bg-[rgb(6_20_58/0.35)] border-2 border-papel/22 rounded-[3px] p-1">
        {FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            aria-pressed={format === f}
            className={`t-mono flex-1 py-2.25 px-1 rounded-stamp text-micro transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lima ${
              format === f ? "bg-lima text-tinta" : "text-papel/65 hover:text-papel"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Level range — tap two rungs of the ladder to set the band. */}
      <div className="pl-card px-3.5 pt-3 pb-3.5 mt-3">
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="t-mono text-[0.5625rem] tracking-[0.18em] text-tinta/50 whitespace-nowrap">
            Level range
          </span>
          <span className="t-display text-[1rem] text-tinta whitespace-nowrap">
            {LEVELS[lo]} — {LEVELS[hi]}
          </span>
        </div>
        <div className="flex gap-1 mt-2.5">
          {LEVELS.map((l, i) => {
            const inRange = i >= lo && i <= hi;
            const edge = i === lo || i === hi;
            return (
              <button
                key={l}
                type="button"
                onClick={() => pickLevel(i)}
                aria-pressed={inRange}
                aria-label={`Level ${l}`}
                className={`t-mono flex-1 min-w-0 py-2 text-tiny tracking-normal rounded-stamp border-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-naranja ${
                  edge
                    ? "border-tinta bg-tinta text-lima"
                    : inRange
                      ? "border-transparent bg-lima/85 text-tinta"
                      : "border-tinta/18 bg-transparent text-tinta/45"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
        <p className="t-eyebrow text-tiny tracking-normal normal-case text-tinta/55 mt-2.25">
          Tap two levels to set the range.
        </p>
      </div>

      {/* Visibility and repetition. */}
      <div className="pl-card overflow-hidden mt-3">
        {groupId ? (
          // Group games are already off Discover via group_id (see getGames in
          // lib/data.ts) — the toggle below doesn't apply here, and showing it
          // would imply it does something, which today it doesn't for anyone
          // (separate, already-logged bug). A plain note instead.
          <div className="px-3.5 py-3 border-b-2 border-tinta/15">
            <div className="t-display text-[0.875rem] text-tinta">
              Only your group sees this
            </div>
            <div className="text-label text-tinta/62 mt-0.5 leading-tight">
              Proposed games never appear on Discover.
            </div>
          </div>
        ) : (
          <ToggleRow
            title="Open to the Loop"
            desc="Anyone in range can request a slot"
            on={openToLoop}
            onToggle={() => setOpenToLoop(!openToLoop)}
          />
        )}
        <ToggleRow
          title="Repeats weekly"
          desc="Same day and time — players carry over"
          on={repeatsWeekly}
          onToggle={() => setRepeatsWeekly(!repeatsWeekly)}
          last
        />
      </div>

      {/* The cost strip — the poster's naranja venue-strip voice. */}
      <div className="rounded-card border-2 border-tinta shadow-sheet bg-naranja text-white px-3.5 py-3 mt-3">
        <div className="t-eyebrow flex justify-between text-label tracking-[0.04em] normal-case">
          <span>Court fee</span>
          <span>€{COURT_FEE.toFixed(2)}</span>
        </div>
        <div className="t-eyebrow flex justify-between text-label tracking-[0.04em] normal-case opacity-90 mt-1.25">
          <span>Split between</span>
          <span>{players} players</span>
        </div>
        <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t-2 border-dashed border-white/45">
          <span className="t-display text-[0.875rem]">You each pay</span>
          <span className="t-display text-display-sm">€{perHead.toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <p
          aria-live="polite"
          className="text-center text-label font-semibold text-papel bg-naranja-d rounded-field px-3 py-2 mt-3"
        >
          Couldn&apos;t create that game. Please try again.
        </p>
      )}

      {/* ── The pinned action bar ────────────────────────────────────────── */}
      {/* Sits just above the bottom navigation, on a fade so the board's
          content dissolves under it rather than colliding with it. */}
      <div className="fixed inset-x-0 bottom-19 z-10 pointer-events-none">
        <div className="mx-auto w-full max-w-md px-5 pt-6.5 pb-3 bg-[linear-gradient(180deg,rgb(26_79_196/0)_0%,rgb(26_79_196/0.92)_26%)] pointer-events-auto">
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            aria-busy={saving || undefined}
            className="t-mono pena-riso w-full flex items-center justify-center gap-2.5 bg-lima text-tinta border-2 border-tinta rounded-card py-3.5 text-title tracking-[0.16em] disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papel"
          >
            {saving ? "Creating…" : groupId ? "Propose game" : "Create game"}
            <span className="t-mono bg-tinta text-lima rounded-stamp px-1.75 py-0.75 text-micro tracking-[0.04em]">
              €{perHead.toFixed(2)}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
