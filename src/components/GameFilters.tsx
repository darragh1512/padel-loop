"use client";

// The interactive filter chips + the games list they control. The page fetches
// the games on the server and hands them in here; all the filtering happens in
// the browser as the user taps the chips. Card layout and chip styling are
// unchanged — this only makes them functional.

import { useEffect, useMemo, useState } from "react";
import GameCard from "@/components/GameCard";
import { SectionLabel } from "@/components/ui";
import { skillTierOf, type Game } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import { getConnections } from "@/app/connections";
import { getJoinedOrCreatedGameIds } from "@/app/games";

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
  searchable = false,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  open: boolean;
  onToggle: () => void;
  onChange: (v: string | null) => void;
  // When true AND the list is long (>8), show a search box inside the menu to
  // filter the options as you type. Short fixed lists don't need it.
  searchable?: boolean;
}) {
  const active = value != null;

  // In-menu search text for filtering this chip's own options. Cleared whenever
  // the chip is tapped (see the button below) so each open starts fresh.
  const [optQuery, setOptQuery] = useState("");

  const showSearch = searchable && options.length > 8;
  const q = optQuery.trim().toLowerCase();
  const visibleOptions =
    showSearch && q !== "" ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOptQuery("");
          onToggle();
        }}
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
          {showSearch && (
            <input
              type="text"
              value={optQuery}
              onChange={(e) => setOptQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}`}
              autoFocus
              className="w-full bg-white/5 border border-sky/25 rounded-xl text-xs text-pale placeholder:text-faint px-3 py-2 mb-1 focus:outline-none focus:border-sky/50"
            />
          )}
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`block w-full text-left text-xs rounded-xl px-3 py-2 ${
              value == null ? "text-white bg-vivid/15" : "text-dim hover:bg-white/5"
            }`}
          >
            All {label.toLowerCase()}
          </button>
          {visibleOptions.map((o) => (
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
          {showSearch && visibleOptions.length === 0 && (
            <div className="px-3 py-2 text-xs text-faint">No {label.toLowerCase()}s found</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GameFilters({
  games,
  sectionLabel,
  greeting,
  excludeOwnGames = false,
}: {
  games: Game[];
  sectionLabel: string;
  // When set (home page only), render the headline above the chips. Its count
  // tracks the filtered list, so it always matches the games actually shown.
  greeting?: string;
  // When true (the discovery list), hide games the user has already joined or
  // created, so the list only shows games they can actually join.
  excludeOwnGames?: boolean;
}) {
  const [level, setLevel] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openFilter, setOpenFilter] = useState<OpenKey>(null);

  // "Connections only" toggle: when on, the list is narrowed to games created
  // by people the logged-in user has an accepted connection with. connectedIds
  // is that set of creator ids, loaded once via the existing connection lookup.
  const [connectionsOnly, setConnectionsOnly] = useState(false);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  // Ids of games the user has joined/created — excluded from the list when
  // excludeOwnGames is set (the discovery list).
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) return; // logged out — nothing user-specific to load
      const [connections, ownIds] = await Promise.all([
        getConnections(uid),
        excludeOwnGames
          ? getJoinedOrCreatedGameIds(uid)
          : Promise.resolve<string[]>([]),
      ]);
      if (!active) return;
      setConnectedIds(new Set(connections.map((p) => p.id)));
      setExcludedIds(new Set(ownIds));
    })();
    return () => {
      active = false;
    };
  }, [excludeOwnGames]);

  // Only offer areas that actually appear in the current games.
  const areas = useMemo(() => {
    const seen: string[] = [];
    for (const g of games) {
      if (g.area && !seen.includes(g.area)) seen.push(g.area);
    }
    return seen;
  }, [games]);

  // Search + all three chips apply together (AND). The search matches a partial,
  // case-insensitive substring of the venue name or the area.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter(
      (g) =>
        !excludedIds.has(g.id) && // hide games you've joined/created (discover)
        (level == null || skillTierOf(g) === level) &&
        (area == null || g.area === area) &&
        matchesTime(g, time) &&
        (!connectionsOnly ||
          (g.createdBy != null && connectedIds.has(g.createdBy))) &&
        (q === "" ||
          g.venue.toLowerCase().includes(q) ||
          (g.area ?? "").toLowerCase().includes(q)),
    );
  }, [games, level, area, time, query, connectionsOnly, connectedIds, excludedIds]);

  const anyActive =
    level != null ||
    area != null ||
    time != null ||
    connectionsOnly ||
    query.trim() !== "";

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
    setQuery("");
    setConnectionsOnly(false);
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

      <div className="relative mt-4">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search venue or area"
          className="w-full bg-vivid/15 border border-sky/25 rounded-full text-sm text-pale placeholder:text-faint pl-10 pr-9 py-2.5 focus:outline-none focus:border-sky/50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-pale"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3 relative z-30">
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
          searchable
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
        {/* Connections-only toggle — a plain on/off chip (no menu), matching the
            FilterChip look: vivid when active, faint blue when off. */}
        <button
          type="button"
          onClick={() => {
            setConnectionsOnly((v) => !v);
            setOpenFilter(null);
          }}
          aria-pressed={connectionsOnly}
          className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3.5 py-1.5 whitespace-nowrap shrink-0 ${
            connectionsOnly
              ? "bg-vivid border border-vivid text-white"
              : "bg-vivid/15 border border-sky/25 text-pale"
          }`}
        >
          Connections only
        </button>
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
