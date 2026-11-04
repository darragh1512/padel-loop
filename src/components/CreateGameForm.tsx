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
// Layout: two short sections of grouped fields, with the create action always
// in reach at the foot.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { dublinToUtc } from "@/lib/time";
import { formatPrice, parsePriceInput } from "@/lib/types";
import { createGame } from "@/app/games";

const FORMATS = ["Doubles", "Singles", "Open"] as const;

// The rating ladder shown in the level-range picker. Index into this, not the
// value — the picker works on positions.
const LEVELS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

// Quick-pick kick-off times. These just set the time field below.
const SLOTS = ["18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];


const LABEL = "block text-[0.8125rem] text-c-sub";
// 16px or more, or iOS zooms the whole page when a field is tapped.
const FIELD =
  "w-full bg-transparent text-[1.0625rem] text-c-ink outline-none mt-0.5 placeholder:text-c-sub";

function Section({ children }: { children: React.ReactNode }) {
  return <h3 className="c-title text-[1.0625rem] text-c-ink mt-6 mb-2 px-0.5">{children}</h3>;
}

/* A settings row with a switch. The whole row is the target. */
function ToggleRow({
  title,
  desc,
  on,
  onToggle,
}: {
  title: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 text-left text-c-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-c-accent"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[1rem] font-medium">{title}</span>
        <span className="block text-[0.875rem] text-c-sub mt-0.5 leading-tight">{desc}</span>
      </span>
      <span
        className={`flex-none w-12.5 h-7.5 rounded-full p-0.5 transition-colors duration-150 ease-out ${
          on ? "bg-c-accent" : "bg-c-fill"
        }`}
      >
        <span
          className={`block size-6.5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export default function CreateGameForm({
  groupId,
  inSheet = false,
}: {
  groupId?: string;
  // Inside the create sheet the form scrolls itself and the sheet's own close
  // button is the way out.
  inSheet?: boolean;
}) {
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
  // The price box holds raw TEXT while it's being typed — it only becomes
  // a number when the form is submitted, so a half-typed value like "12."
  // doesn't fight the person entering it.
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  // A live preview of the typed price for the action bar. Blank or
  // not-yet-valid shows NO badge at all rather than a €0.00.
  const parsedLivePrice = parsePriceInput(price);
  const livePrice = "value" in parsedLivePrice ? formatPrice(parsedLivePrice.value) : null;

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

    // Price check happens BEFORE the game is sent, so a bad price can never
    // reach the database. Blank is fine — it means no price set.
    const parsedPrice = parsePriceInput(price);
    if ("error" in parsedPrice) {
      setPriceError(parsedPrice.error);
      return;
    }
    setPriceError(null);

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
        price_per_player: parsedPrice.value, // null = no price set
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
    <div className={inSheet ? "flex flex-col flex-1 min-h-0" : ""}>
      <div className={inSheet ? "flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-1" : ""}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pr-11">
          {!inSheet && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="c-press size-10 flex-none rounded-full bg-c-card text-c-ink shadow-[var(--c-shadow)] grid place-items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-accent"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden>
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <h2 className="c-title text-[1.625rem] leading-tight text-c-ink">
            {groupId ? "Propose a game" : "Create a game"}
          </h2>
        </div>

        {/* ── Where & when ───────────────────────────────────────────────── */}
        <Section>Where and when</Section>

        <div className="c-card divide-y divide-c-line overflow-hidden">
          <div className="px-4 py-2.5">
            <label htmlFor="cg-venue" className={LABEL}>
              Venue
            </label>
            <input
              id="cg-venue"
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Where are you playing?"
              className={FIELD}
            />
          </div>
          <div className="px-4 py-2.5">
            <label htmlFor="cg-area" className={LABEL}>
              Area
            </label>
            <input
              id="cg-area"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Area"
              className={FIELD}
            />
          </div>

          {/* Date and time, side by side. */}
          <div className="grid grid-cols-2 divide-x divide-c-line">
            <div className="px-4 py-2.5 min-w-0">
              <label htmlFor="cg-date" className={LABEL}>
                Date
              </label>
              <input
                id="cg-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="px-4 py-2.5 min-w-0">
              <label htmlFor="cg-time" className={LABEL}>
                Time
              </label>
              <input
                id="cg-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          {/* Quick kick-off times — these just fill the time field above. */}
          <div className="flex gap-1.5 px-4 py-3 overflow-x-auto no-scrollbar">
            {SLOTS.map((s) => {
              const on = time === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTime(s)}
                  aria-pressed={on}
                  className={`flex-none h-9 rounded-full px-3 text-[0.875rem] font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-c-accent ${
                    on ? "bg-c-accent text-c-on-accent" : "bg-c-fill text-c-ink"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Game setup ─────────────────────────────────────────────────── */}
        <Section>Game setup</Section>

        {/* Format — a segmented control. */}
        <div className="flex gap-1 bg-c-fill rounded-[14px] p-1">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={`flex-1 h-9 px-1 rounded-[11px] text-[0.9375rem] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-c-accent ${
                format === f ? "bg-c-card text-c-ink shadow-[var(--c-shadow)]" : "text-c-sub"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Level range — tap two rungs of the ladder to set the band. */}
        <div className="c-card px-4 pt-3 pb-3.5 mt-3">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="text-[1rem] font-medium">Level range</span>
            <span className="c-title text-[1.0625rem] whitespace-nowrap">
              {LEVELS[lo]} – {LEVELS[hi]}
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
                  className={`flex-1 min-w-0 h-11 text-[0.75rem] font-medium tabular-nums rounded-[9px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-c-accent ${
                    edge
                      ? "bg-c-accent text-c-on-accent"
                      : inRange
                        ? "bg-c-tint text-c-on-tint"
                        : "bg-c-fill text-c-sub"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
          <p className="text-[0.8125rem] text-c-sub mt-2">Tap two levels to set the range.</p>
        </div>

        {/* Visibility and repetition. */}
        <div className="c-card divide-y divide-c-line overflow-hidden mt-3">
          {groupId ? (
            // Group games are already off Discover via group_id (see getGames in
            // lib/data.ts) — the toggle below doesn't apply here, and showing it
            // would imply it does something, which today it doesn't for anyone
            // (separate, already-logged bug). A plain note instead.
            <div className="px-4 py-3">
              <div className="text-[1rem] font-medium">Only your group sees this</div>
              <div className="text-[0.875rem] text-c-sub mt-0.5">
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
          />
        </div>

        {/* Price — what ONE player pays. Optional: left blank, the game simply
            has no price and no screen shows one. */}
        <div className="c-card px-4 py-3 mt-3">
          <label htmlFor="cg-price" className={LABEL}>
            Price per player
          </label>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[1.0625rem] text-c-sub">€</span>
            <input
              id="cg-price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Optional"
              aria-invalid={priceError ? true : undefined}
              className={`${FIELD} flex-1 min-w-0 mt-0`}
            />
          </div>
          {priceError ? (
            <p aria-live="polite" className="text-[0.875rem] font-medium text-c-danger mt-1">
              {priceError}
            </p>
          ) : (
            <p className="text-[0.8125rem] text-c-sub mt-1">
              What each player pays. Leave it blank if there&rsquo;s no set price.
            </p>
          )}
        </div>

        {error && (
          <p
            aria-live="polite"
            className="text-center text-[0.875rem] font-medium text-c-danger mt-3"
          >
            Couldn&apos;t create that game. Please try again.
          </p>
        )}
        <div className="h-4" />
      </div>

      {/* ── The action ───────────────────────────────────────────────────── */}
      {/* In the sheet it sits below the scrolling form. On a full page it
          sticks just above the floating tab bar. */}
      <div
        className={
          inSheet
            ? "flex-none px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "sticky bottom-24 z-10 mt-2"
        }
      >
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          aria-busy={saving || undefined}
          className="c-press w-full h-13 flex items-center justify-center gap-2.5 rounded-[16px] bg-c-accent text-c-on-accent text-[1.0625rem] font-semibold disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-accent"
        >
          {saving ? "Creating…" : groupId ? "Propose game" : "Create game"}
          {livePrice && <span className="font-medium opacity-85">· {livePrice}</span>}
        </button>
      </div>
    </div>
  );
}
