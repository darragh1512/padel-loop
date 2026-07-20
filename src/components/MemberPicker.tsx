"use client";
// A reusable "find and pick people" panel — the same debounced name search as
// /search, but as a picker (a tap calls onPick) instead of a list that links
// to profiles. Used by both the create-group screen (batch-select before
// creating) and the group thread's "Add member" dialog (pick one, added
// immediately) — one search UI, not two.

import { useEffect, useRef, useState } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { searchProfiles, type ProfileSearchResult } from "@/app/profiles";

export default function MemberPicker({
  excludeIds = [],
  onPick,
}: {
  // ids to leave out of results — already-picked people, or existing members.
  excludeIds?: string[];
  onPick: (person: ProfileSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const currentUserId = useRef<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      currentUserId.current = data.user?.id ?? null;
    });
  }, []);

  // Debounced search: runs ~300ms after the last keystroke — same timing as
  // /search.
  useEffect(() => {
    reqId.current += 1;
    const id = reqId.current;
    const term = query.trim();

    if (term === "") {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const handle = setTimeout(async () => {
      const found = await searchProfiles(term, currentUserId.current);
      if (id !== reqId.current) return; // a newer query has superseded this one
      setResults(found);
      setSearching(false);
    }, 300);

    return () => clearTimeout(handle);
  }, [query]);

  const visible = results.filter((p) => !excludeIds.includes(p.id));

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
          placeholder="Search by name"
          className="w-full pl-surface rounded-full text-body font-medium text-tinta placeholder:text-tinta/45 pl-10 pr-4 py-2.5 focus:outline-none focus:border-naranja"
        />
      </div>

      <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
        {searching ? (
          <Skeleton className="rounded-field h-14" />
        ) : visible.length > 0 ? (
          visible.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onPick(person)}
              className="w-full flex items-center gap-3 pl-surface rounded-field px-3.5 py-2.5 text-left active:scale-[0.99] transition-transform duration-150 ease-out"
            >
              <PlayerAvatar
                userId={person.id}
                avatarUrl={person.avatar_url}
                name={person.name}
                className="size-9 shrink-0"
              />
              <span className="flex-1 min-w-0 text-body font-semibold text-tinta truncate">
                {person.name || "Player"}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-tinta/45">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          ))
        ) : query.trim() !== "" ? (
          <p className="text-label font-medium text-tinta/60 text-center py-3">
            No players found for “{query.trim()}”.
          </p>
        ) : null}
      </div>
    </div>
  );
}
