"use client";

// The interactive filter chips + the games list they control. The page fetches
// the games on the server and hands them in here; all the filtering happens in
// the browser as the user taps the chips. Card layout and chip styling are
// unchanged — this only makes them functional.

import { useMemo, useState } from "react";
import GameCard from "@/components/GameCard";
import { SectionLabel } from "@/components/ui";
import { skillTierOf, type Game } from "@/lib/types";

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const TIMES = ["Today", "This week"] as const;

type OpenKey = "level" | "area" | "time" | null;

// Does this game pass the Time chip? "Today" = same calendar day (matching the
// "Today" label on the card); "This week" = starting within the next 7 days.
function matchesTime(game: Game, time: string | null): boolean {
  if (!time) return true;
  const start = new Date(game.startsAt);
  if (isNaN(start.getTime())) return true;
  const now = new Date();
  if (time === "Today") return start.toDateString() === now.toDateString();
  const weekFromNow = new Date(now);
  weekFromNow.setDate(now.getDate() + 7);
  return start <= weekFromNow;
}

// One filter chip with a little drop-down of choices. Keeps the exact Chip look
// (see ui.tsx) and turns blue when a choice is active.
function FilterChip({
  label,
  value,
  options,
  open,
  onToggle,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  open: boolean;
  onToggle: () => void;
  onChange: (v: string | null) => void;
}) {
  const active = value != null;
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3.5 py-1.5 whitespace-nowrap ${
          active
            ? "bg-vivid border border-vivid text-white"
            : "bg-vivid/15 border border-sky/25 text-pale"
        }`}
      >
        {value ?? label}
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 left-0 mt-1.5 min-w-[160px] rounded-2xl bg-navy border border-sky/25 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`block w-full text-left text-xs rounded-xl px-3 py-2 ${
              value == null ? "text-white bg-vivid/15" : "text-dim hover:bg-white/5"
            }`}
          >
            All {label.toLowerCase()}
          </button>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`block w-full text-left text-xs rounded-xl px-3 py-2 ${
                value === o ? "text-white bg-vivid/15" : "text-pale hover:bg-white/5"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GameFilters({
  games,
  sectionLabel,
  greeting,
}: {
  games: Game[];
  sectionLabel: string;
  // When set (home page only), render the headline above the chips. Its count
  // tracks the filtered list, so it always matches the games actually shown.
  greeting?: string;
}) {
  const [level, setLevel] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<OpenKey>(null);

  // Only offer areas that actually appear in the current games.
  const areas = useMemo(() => {
    const seen: string[] = [];
    for (const g of games) {
      if (g.area && !seen.includes(g.area)) seen.push(g.area);
    }
    return seen;
  }, [games]);

  // All three filters apply together (AND).
  const filtered = useMemo(
    () =>
      games.filter(
        (g) =>
          (level == null || skillTierOf(g) === level) &&
          (area == null || g.area === area) &&
          matchesTime(g, time),
      ),
    [games, level, area, time],
  );

  const anyActive = level != null || area != null || time != null;

  // Headline count: always the number of games currently shown. If every shown
  // game is today we keep the "tonight" wording, otherwise "upcoming". (Same
  // logic as before, just driven by the filtered list instead of the full one.)
  const shownCount = filtered.length;
  const allToday = shownCount > 0 && filtered.every((g) => matchesTime(g, "Today"));
  const headlineText = allToday
    ? `${shownCount} game${shownCount === 1 ? "" : "s"} near you tonight.`
    : `${shownCount} upcoming game${shownCount === 1 ? "" : "s"} near you.`;

  const toggle = (key: Exclude<OpenKey, null>) =>
    setOpenFilter((cur) => (cur === key ? null : key));

  const clearAll = () => {
    setLevel(null);
    setArea(null);
    setTime(null);
    setOpenFilter(null);
  };

  return (
    <>
      {/* Tap anywhere outside an open menu to close it. */}
      {openFilter && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpenFilter(null)}
          className="fixed inset-0 z-20 cursor-default"
        />
      )}

      {greeting && (
        <h1 className="font-display text-[21px] tracking-tight leading-snug mt-3.5 relative">
          <b className="font-bold">{greeting}</b>
          <br />
          <span className="font-light text-sky">{headlineText}</span>
        </h1>
      )}

      <div className="flex flex-wrap gap-2 mt-4 relative z-30">
        <FilterChip
          label="Level"
          value={level}
          options={LEVELS}
          open={openFilter === "level"}
          onToggle={() => toggle("level")}
          onChange={(v) => {
            setLevel(v);
            setOpenFilter(null);
          }}
        />
        <FilterChip
          label="Area"
          value={area}
          options={areas}
          open={openFilter === "area"}
          onToggle={() => toggle("area")}
          onChange={(v) => {
            setArea(v);
            setOpenFilter(null);
          }}
        />
        <FilterChip
          label="Time"
          value={time}
          options={TIMES}
          open={openFilter === "time"}
          onToggle={() => toggle("time")}
          onChange={(v) => {
            setTime(v);
            setOpenFilter(null);
          }}
        />
        {anyActive && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3.5 py-1.5 whitespace-nowrap bg-white/5 border border-white/15 text-dim shrink-0"
          >
            Clear
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <SectionLabel>{sectionLabel}</SectionLabel>

      {filtered.length > 0 ? (
        filtered.map((g, i) => <GameCard key={g.id} game={g} delay={i * 80} />)
      ) : (
        <div className="pl-card p-6 text-center mb-3">
          <div className="text-sm font-medium text-pale">
            {anyActive ? "No games match these filters" : "No games available right now"}
          </div>
          <div className="text-[12.5px] text-dim font-light mt-1.5">
            {anyActive ? "Try widening your search." : "Check back soon for new games."}
          </div>
          {anyActive && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center mt-3.5 text-xs font-medium rounded-full px-4 py-1.5 bg-vivid/15 border border-sky/25 text-pale"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </>
  );
}
