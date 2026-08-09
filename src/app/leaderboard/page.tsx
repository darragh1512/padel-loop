"use client";
// The leaderboard (/leaderboard): the whole peña ranked by earned rating, or
// by wins — confirmed matches only, same rule as everywhere else. Players
// with fewer than RANKED_MIN_MATCHES confirmed matches aren't ranked yet;
// they show below in their own list rather than being hidden.
//
// Reads the board client-side with the shared Supabase client and sends
// logged-out visitors to the login page, same pattern as /connections.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PlayerAvatar from "@/components/PlayerAvatar";
import { ChipButton, EmptyState, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import {
  getLeaderboard,
  RANKED_MIN_MATCHES,
  type LeaderboardRow,
} from "../leaderboard";

type View = "rating" | "wins";

// One line on the board. Rank is null for the "needs more matches" list.
function BoardRow({
  row,
  rank,
  view,
  delay = 0,
}: {
  row: LeaderboardRow;
  rank: number | null;
  view: View;
  delay?: number;
}) {
  const name = row.name || "Player";
  return (
    <Link
      href={`/players/${row.id}`}
      className="flex items-center gap-3 pl-card px-4 py-3 mb-2.5 pl-rise active:scale-[0.99] transition-transform duration-150 ease-out"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="t-display text-title text-tinta w-8 shrink-0 text-center">
        {rank != null ? rank : "·"}
      </span>
      <PlayerAvatar
        userId={row.id}
        avatarUrl={row.avatar_url}
        name={name}
        className="size-10 shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-body text-tinta truncate">{name}</span>
        <span className="t-mono block text-[9px] tracking-[0.1em] text-tinta/70 truncate mt-0.5">
          {rank != null
            ? `${row.played} played · ${row.won} won`
            : `${row.played} of ${RANKED_MIN_MATCHES} confirmed matches`}
          {row.home_club ? <> · {row.home_club}</> : null}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="t-display block text-display-xs text-tinta">
          {view === "rating" ? (row.rating ?? "—") : row.won}
        </span>
        <span className="t-mono block text-[9px] tracking-[0.1em] text-naranja-d mt-0.5">
          {view === "rating" ? "Rating" : "Wins"}
        </span>
      </span>
    </Link>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [view, setView] = useState<View>("rating");
  const [club, setClub] = useState<string | null>(null); // null = all clubs

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      const board = await getLeaderboard();
      if (!active) return;
      setRows(board);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  // Every club that has at least one player, for the filter chips.
  const clubs = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.home_club && r.home_club.trim() !== "") set.add(r.home_club);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = club ? rows.filter((r) => r.home_club === club) : rows;

  // Ranked players sort by the active view (rating ties break on wins and
  // vice versa); the not-yet-ranked list sorts by how close they are.
  const ranked = filtered
    .filter((r) => r.played >= RANKED_MIN_MATCHES)
    .sort((a, b) =>
      view === "rating"
        ? (b.rating ?? 0) - (a.rating ?? 0) || b.won - a.won
        : b.won - a.won || (b.rating ?? 0) - (a.rating ?? 0),
    );
  const unranked = filtered
    .filter((r) => r.played < RANKED_MIN_MATCHES)
    .sort((a, b) => b.played - a.played || (b.rating ?? 0) - (a.rating ?? 0));

  if (loading) {
    return (
      <main className="px-5 pt-6 relative">
        <div className="rounded-field h-9 w-56 mt-2 pl-skeleton" />
        <div className="mt-8 space-y-2.5">
          <div className="rounded-card h-16 pl-skeleton" />
          <div className="rounded-card h-16 pl-skeleton" />
          <div className="rounded-card h-16 pl-skeleton" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="px-5 pt-6 relative">
      <p className="t-mono text-micro text-papel/80 mt-2">La peña · Standings</p>
      <h1 className="t-display text-display-md text-papel mt-1.5">
        Leaderb<span className="text-lima">o</span>ard
      </h1>
      <p className="text-label font-medium text-papel/85 mt-1.5 mb-4">
        Ranked on confirmed matches — nothing counts until everyone agrees.
      </p>

      {/* View toggle: rating vs wins. */}
      <div className="flex gap-2 mb-2.5">
        <ChipButton active={view === "rating"} onClick={() => setView("rating")}>
          By rating
        </ChipButton>
        <ChipButton active={view === "wins"} onClick={() => setView("wins")}>
          By wins
        </ChipButton>
      </div>

      {/* Club filter — only when there are clubs to filter by. */}
      {clubs.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-5 px-5">
          <ChipButton active={club === null} onClick={() => setClub(null)}>
            All clubs
          </ChipButton>
          {clubs.map((c) => (
            <ChipButton key={c} active={club === c} onClick={() => setClub(c)}>
              {c}
            </ChipButton>
          ))}
        </div>
      )}

      {ranked.length > 0 ? (
        ranked.map((row, i) => (
          <BoardRow
            key={row.id}
            row={row}
            rank={i + 1}
            view={view}
            delay={Math.min(i, 8) * 40}
          />
        ))
      ) : (
        <EmptyState
          title="No one's ranked yet."
          body={`Play ${RANKED_MIN_MATCHES} confirmed matches and the board begins.`}
        />
      )}

      {unranked.length > 0 && (
        <>
          <SectionLabel>Needs more matches</SectionLabel>
          {unranked.map((row, i) => (
            <BoardRow
              key={row.id}
              row={row}
              rank={null}
              view={view}
              delay={Math.min(i, 8) * 40}
            />
          ))}
        </>
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
