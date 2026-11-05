"use client";

// A player-name search box with live results underneath, linking straight to
// each match's profile — the shared "find a player" widget behind /search and
// embedded on /connections.

import { useState, type ReactNode } from "react";
import PlayerResultRow from "@/components/PlayerResultRow";
import { EmptyState, ErrorState } from "@/components/ui";
import { UserSearch } from "lucide-react";
import { usePlayerSearch } from "@/lib/usePlayerSearch";

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
  const { results, searching, searched, failed, retry } = usePlayerSearch(query);

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
          ) : failed ? (
            <ErrorState
              title="Search didn't work."
              body="That's a connection problem, not an empty Loop. Try again."
              onRetry={retry}
            />
          ) : searched ? (
            <EmptyState
              icon={<UserSearch size={22} strokeWidth={2.2} />}
              title={`No players called “${query.trim()}”.`}
              body="Try part of a name, or a different spelling."
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
