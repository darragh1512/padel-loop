"use client";

// A player-name search box with live results underneath, linking straight to
// each match's profile — the shared "find a player" widget behind /search,
// and embedded on /discover and /connections. Debounced (~300ms) so it
// doesn't hit the database on every keystroke; excludes the signed-in user
// from their own results.

import { useEffect, useRef, useState, type ReactNode } from "react";
import PlayerResultRow from "@/components/PlayerResultRow";
import { supabase } from "@/lib/supabaseClient";
import { searchProfiles, type ProfileSearchResult } from "@/app/profiles";

export default function PlayerSearch({
  placeholder = "Search by name",
  autoFocus = false,
  emptyHint,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  // Shown under the box before the user has typed anything. Omit to show
  // nothing (the box is embedded alongside other page content).
  emptyHint?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false); // a search has completed for the current text

  // Who's logged in (so we can exclude them). A ref, since it's only read
  // inside the debounced search and shouldn't itself re-trigger anything.
  const currentUserId = useRef<string | null>(null);
  // Bumped on every query change so a slow, stale request can't overwrite
  // newer results once it finally resolves.
  const reqId = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      currentUserId.current = data.user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    reqId.current += 1;
    const id = reqId.current;
    const term = query.trim();

    if (term === "") {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }

    setSearching(true);
    const handle = setTimeout(async () => {
      const found = await searchProfiles(term, currentUserId.current);
      if (id !== reqId.current) return; // a newer query has superseded this one
      setResults(found.filter((p) => p.id !== currentUserId.current));
      setSearching(false);
      setSearched(true);
    }, 300);

    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta/45 pointer-events-none">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-surface rounded-full text-body font-medium text-tinta placeholder:text-tinta/45 pl-10 pr-9 py-2.5 focus:outline-none focus:border-naranja"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tinta/45 hover:text-tinta"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {query.trim() === "" ? (
        emptyHint && (
          <p className="t-mono text-micro text-papel/70 text-center mt-6">
            {emptyHint}
          </p>
        )
      ) : (
        <div className="mt-4">
          {searching ? (
            <div className="space-y-3">
              <div className="rounded-card h-18 pl-skeleton" />
            </div>
          ) : results.length > 0 ? (
            results.map((person, i) => (
              <PlayerResultRow key={person.id} person={person} delay={i * 40} />
            ))
          ) : searched ? (
            <div className="pl-surface rounded-card px-4 py-5 text-center text-label font-medium text-tinta/70">
              No players found for “{query.trim()}”.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
