"use client";
// Leaderboard (/leaderboard): players ranked by earned rating or by wins, on
// confirmed matches only. Anyone under RANKED_MIN_MATCHES isn't ranked yet and
// sits in their own list below rather than being hidden.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Icon from "@/components/ios/Icon";
import MessageCard, { TryAgain } from "@/components/ios/MessageCard";
import Monogram from "@/components/ios/Monogram";
import PageTitle from "@/components/ios/PageTitle";
import { supabase } from "@/lib/supabaseClient";
import { getLeaderboard, RANKED_MIN_MATCHES, type LeaderboardRow } from "../leaderboard";

type View = "rating" | "wins";

// One line on the board. Rank is null for players who aren't ranked yet.
function BoardRow({
  row,
  rank,
  view,
}: {
  row: LeaderboardRow;
  rank: number | null;
  view: View;
}) {
  const record = rank != null ? `${row.played} played · ${row.won} won` : `${row.played} of ${RANKED_MIN_MATCHES} matches`;
  return (
    <Link
      href={`/players/${row.id}`}
      className="ios-row ios-link"
      style={{ padding: "8px 16px", "--ios-inset": rank != null ? "100px" : "68px" } as React.CSSProperties}
    >
      {rank != null && (
        <span className="ios-hl" style={{ width: 20, flex: "none", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
          {rank}
        </span>
      )}
      <Monogram name={row.name} photoUrl={row.avatar_url} />
      <div className="ios-grow">
        <div className="ios-bd ios-clip">{row.name || "Player"}</div>
        <div className="ios-fn ios-sec ios-clip">{record}</div>
      </div>
      {rank != null && (
        <span className="ios-hl" style={{ fontVariantNumeric: "tabular-nums" }}>
          {view === "rating" ? (row.rating ?? "–") : row.won}
        </span>
      )}
      <span className="ios-chev">
        <Icon name="chevron-right" size={13} />
      </span>
    </Link>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
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
      try {
        const board = await getLeaderboard();
        if (!active) return;
        setRows(board);
        setFailed(false);
      } catch {
        if (!active) return;
        setFailed(true);
      }
      setUserId(data.user.id);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router, attempt]);

  // Every club with at least one player, for the filter chips.
  const clubs = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.home_club && r.home_club.trim() !== "") set.add(r.home_club);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = club ? rows.filter((r) => r.home_club === club) : rows;

  // Rating ties break on wins and vice versa. The unranked list sorts by how
  // close each player is to being ranked.
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

  return (
    <main className="ios">
      <PageTitle title="Leaderboard" fallback={userId ? `/players/${userId}` : "/"} />

      {loading ? (
        <div aria-hidden style={{ marginTop: 16 }}>
          <div className="ios-skel" style={{ height: 32, borderRadius: 16, margin: "0 16px" }} />
          <div className="ios-skel" style={{ height: 280, margin: "16px 16px 0" }} />
        </div>
      ) : failed ? (
        <MessageCard
          alert
          title="Couldn’t Load the Leaderboard"
          body="Check your connection and try again."
          action={
            <TryAgain
              onClick={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            />
          }
        />
      ) : (
        <>
          <div className="ios-seg" role="group" aria-label="Rank by" style={{ margin: "10px 16px 0" }}>
            <button type="button" aria-pressed={view === "rating"} onClick={() => setView("rating")}>
              Rating
            </button>
            <button type="button" aria-pressed={view === "wins"} onClick={() => setView("wins")}>
              Wins
            </button>
          </div>

          {clubs.length > 1 && (
            <div className="ios-chips" role="group" aria-label="Club">
              <button type="button" className="ios-chip" data-on={club === null} aria-pressed={club === null} onClick={() => setClub(null)}>
                All Clubs
              </button>
              {clubs.map((c) => (
                <button key={c} type="button" className="ios-chip" data-on={club === c} aria-pressed={club === c} onClick={() => setClub(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}

          {ranked.length > 0 ? (
            <section style={{ marginTop: 16 }}>
              <div className="ios-list">
                {ranked.map((row, i) => (
                  <BoardRow key={row.id} row={row} rank={i + 1} view={view} />
                ))}
              </div>
              <p className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
                Only confirmed matches count.
              </p>
            </section>
          ) : (
            <MessageCard
              title="No One’s Ranked Yet"
              body={`Play ${RANKED_MIN_MATCHES} confirmed matches and the board begins.`}
              action={
                <Link href="/discover" className="ios-pill ios-press">
                  Find a Game
                </Link>
              }
            />
          )}

          {unranked.length > 0 && (
            <section style={{ marginTop: 16 }}>
              <div className="ios-sect">
                <h2 className="ios-t3">Needs More Matches</h2>
              </div>
              <div className="ios-list">
                {unranked.map((row) => (
                  <BoardRow key={row.id} row={row} rank={null} view={view} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <div style={{ height: 16 }} />
      <BottomNav />
    </main>
  );
}
