"use client";
// My Games: every game the signed-in player is in — the ones they CREATED and the
// ones they've JOINED — filterable between the two, upcoming first and past games
// below. Cancelled games aren't hidden here (unlike the browse lists); they keep
// their place, marked Cancelled.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import GameRow from "@/components/ios/GameRow";
import Icon from "@/components/ios/Icon";
import PageTitle from "@/components/ios/PageTitle";
import { getGamesByIds } from "@/lib/data";
import { supabase } from "@/lib/supabaseClient";
import { dublinDateKey } from "@/lib/time";
import type { Game } from "@/lib/types";
import { getGamesCreatedBy, getGamesJoinedBy } from "../games";

type Filter = "All" | "Hosting" | "Joined";

function Section({
  title,
  games,
  hosting,
  past = false,
}: {
  title: string;
  games: Game[];
  hosting: Set<string>;
  past?: boolean;
}) {
  return (
    <section style={{ marginTop: 16 }}>
      <div className="ios-sect">
        <h2 className="ios-t3">{title}</h2>
        <div className="ios-fn ios-sec">
          {games.length} {games.length === 1 ? "game" : "games"}
        </div>
      </div>
      <div className="ios-list">
        {games.map((game) => (
          <GameRow key={game.id} game={game} note={hosting.has(game.id) ? "Hosting" : undefined} past={past} />
        ))}
      </div>
    </section>
  );
}

export default function MyGamesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [games, setGames] = useState<Game[]>([]);
  const [hosting, setHosting] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("All");
  const [today, setToday] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) {
        router.replace("/login");
        return;
      }
      try {
        const [created, joined] = await Promise.all([getGamesCreatedBy(uid), getGamesJoinedBy(uid)]);
        const createdIds = created.map((g) => String(g.id));
        const all = await getGamesByIds([...new Set([...createdIds, ...joined.map((g) => String(g.id))])]);
        if (!active) return;
        // Creating a game also adds you as its first player, so created games
        // show up in the joined list too. "Joined" means someone else's games.
        setHosting(new Set(createdIds));
        setGames(all);
        setToday(dublinDateKey(new Date()));
        setFailed(false);
      } catch {
        if (!active) return;
        setFailed(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router, attempt]);

  const { upcoming, past } = useMemo(() => {
    const visible = games.filter((g) =>
      filter === "All" ? true : filter === "Hosting" ? hosting.has(g.id) : !hosting.has(g.id),
    );
    const isPast = (g: Game) => dublinDateKey(g.startsAt) < today;
    return {
      upcoming: visible.filter((g) => !isPast(g)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      past: visible.filter(isPast).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    };
  }, [games, filter, hosting, today]);

  const newGame = (
    <Link href="/create" aria-label="New game" className="ios-gcap-i ios-glass ios-press">
      <Icon name="plus" size={21} />
    </Link>
  );

  return (
    <main className="ios">
      <PageTitle title="My Games" fallback="/discover" right={newGame} />

      {loading ? (
        <div aria-hidden style={{ marginTop: 16 }}>
          <div className="ios-skel" style={{ height: 32, borderRadius: 16, margin: "0 16px" }} />
          <div className="ios-skel" style={{ height: 200, margin: "16px 16px 0" }} />
        </div>
      ) : failed ? (
        <div className="ios-card" style={{ marginTop: 16, padding: 20 }} role="alert">
          <div className="ios-t3">Couldn’t Load Your Games</div>
          <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
            Your games are safe. Check your connection and try again.
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <button
              type="button"
              className="ios-pill ios-press"
              style={{ border: 0, cursor: "pointer" }}
              onClick={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ios-seg" role="group" aria-label="Show" style={{ margin: "10px 16px 0" }}>
            {(["All", "Hosting", "Joined"] as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          {upcoming.length > 0 && <Section title="Upcoming" games={upcoming} hosting={hosting} />}
          {past.length > 0 && <Section title="Past" games={past} hosting={hosting} past />}

          {upcoming.length === 0 && past.length === 0 && (
            <div className="ios-card" style={{ marginTop: 16, padding: 20 }}>
              <div className="ios-t3">{filter === "Hosting" ? "Run Your Own Game" : "No Games Yet"}</div>
              <div className="ios-sh ios-sec" style={{ marginTop: 4 }}>
                {filter === "Hosting" ? "Post a game and other players can take the spots." : "Take a spot in a game at your level."}
              </div>
              <div style={{ display: "flex", marginTop: 14 }}>
                <Link href={filter === "Hosting" ? "/create" : "/discover"} className="ios-pill ios-press">
                  {filter === "Hosting" ? "New Game" : "Find a Game"}
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ height: 16 }} />
      <BottomNav />
    </main>
  );
}
