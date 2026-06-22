"use client";
// The "Find players" screen (/search): a text box that searches the profiles
// table by display name (case-insensitive, partial match) and lists the people
// it finds, each linking to their profile (/players/[id]).
//
// The input is debounced — it waits ~300ms after you stop typing before it
// queries, so it doesn't hit the database on every keystroke. Reads use the
// shared Supabase client, same as the rest of the app.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import PlayerAvatar from "@/components/PlayerAvatar";
import { supabase } from "@/lib/supabaseClient";
import { searchProfiles, type ProfileSearchResult } from "../profiles";

// One result row. The whole row links to that player's profile.
function ResultRow({
  person,
  delay = 0,
}: {
  person: ProfileSearchResult;
  delay?: number;
}) {
  const name = person.name || "Player";
  return (
    <Link
      href={`/players/${person.id}`}
      className="flex items-center gap-3.5 pl-card p-[15px] mb-3 pl-rise active:scale-[0.99] transition-transform"
      style={{ animationDelay: `${delay}ms` }}
    >
      <PlayerAvatar
        userId={person.id}
        avatarUrl={person.avatar_url}
        name={name}
        className="size-11 border-2 border-navy"
      />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[14.5px] truncate">{name}</div>
        <div className="text-[11.5px] text-faint font-light truncate mt-0.5">
          {person.home_club || "No home club"}
          {person.skill_level ? <> · {person.skill_level}</> : null}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path d="m9 6 6 6-6 6" stroke="#3a5a9a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </Link>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false); // a search has completed for the current text

  // Who's logged in (so we can exclude them). A ref, since it's only read inside
  // the debounced search and shouldn't itself re-trigger anything.
  const currentUserId = useRef<string | null>(null);
  // Bumped on every query change so a slow, stale request can't overwrite newer
  // results once it finally resolves.
  const reqId = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      currentUserId.current = data.user?.id ?? null;
    });
  }, []);

  // Debounced search: runs ~300ms after the last keystroke.
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
      // Belt-and-braces: also drop yourself in case the user id resolved late.
      setResults(found.filter((p) => p.id !== currentUserId.current));
      setSearching(false);
      setSearched(true);
    }, 300);

    return () => clearTimeout(handle);
  }, [query]);

  return (
    <main className="px-5 pt-6 relative">
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <h1 className="font-display text-[21px] tracking-tight leading-snug mt-2 relative">
        <b className="font-bold">Find players</b>
      </h1>
      <p className="text-[13px] text-dim font-light mt-1 mb-4">
        Search for people by name.
      </p>

      <div className="relative">
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
          placeholder="Search by name"
          autoFocus
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

      <div className="mt-5">
        {query.trim() === "" ? (
          <p className="text-[13px] text-faint font-light text-center mt-6">
            Start typing a name to find players.
          </p>
        ) : searching ? (
          <p className="text-[13px] text-dim font-light text-center mt-6">
            Searching…
          </p>
        ) : results.length > 0 ? (
          results.map((person, i) => (
            <ResultRow key={person.id} person={person} delay={i * 40} />
          ))
        ) : searched ? (
          <div className="pl-surface rounded-(--radius-card) px-4 py-5 text-center text-[13px] text-faint font-light">
            No players found for “{query.trim()}”.
          </div>
        ) : null}
      </div>

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
