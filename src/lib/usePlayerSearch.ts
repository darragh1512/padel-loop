"use client";

// Searches players by name as someone types. Waits for a pause in typing so it
// doesn't ask the database on every keystroke, ignores answers to older text,
// and leaves the signed-in player out of their own results.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { searchProfiles, type ProfileSearchResult } from "@/app/profiles";

type Answer = { term: string; results: ProfileSearchResult[]; failed: boolean };

export function usePlayerSearch(query: string) {
  const term = query.trim();
  const [answer, setAnswer] = useState<Answer>({ term: "", results: [], failed: false });
  const [attempt, setAttempt] = useState(0);
  const viewerId = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      viewerId.current = data.user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (term === "") return;
    let stale = false;
    const pause = setTimeout(async () => {
      try {
        const found = await searchProfiles(term, viewerId.current);
        if (stale) return;
        setAnswer({ term, results: found.filter((p) => p.id !== viewerId.current), failed: false });
      } catch {
        if (!stale) setAnswer({ term, results: [], failed: true });
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(pause);
    };
  }, [term, attempt]);

  const settled = term !== "" && answer.term === term;
  return {
    results: settled ? answer.results : [],
    searching: term !== "" && !settled,
    searched: settled && !answer.failed,
    failed: settled && answer.failed,
    retry: () => setAttempt((n) => n + 1),
  };
}
