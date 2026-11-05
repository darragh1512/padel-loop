"use client";

// Home. Two questions: when is my next game, and what can I join near me?
//
// Only real data appears here. The mockup also shows drive time, court number
// and duration, but the app doesn't store those yet, so they're left out rather
// than guessed.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Court, { spotsFor } from "@/components/ios/Court";
import Icon from "@/components/ios/Icon";
import JoinPill from "@/components/ios/JoinPill";
import NotificationBell from "@/components/NotificationBell";
import { supabase } from "@/lib/supabaseClient";
import { getGame, getGames, initialsFrom } from "@/lib/data";
import { isFull, slotsLeft, skillTierOf, type Game } from "@/lib/types";
import { gameWhen, longDate, spotsOpenText } from "@/lib/when";
import { getJoinedOrCreatedGameIds, getUpcomingGamesFor } from "@/app/games";
import { getProfile, type Profile } from "@/app/profiles";

const NEARBY_ROWS = 3;

// A player's own level, in the three bands games are listed under.
function tierOfPlayer(skill?: string | null): "Beginner" | "Intermediate" | "Advanced" | null {
  switch ((skill ?? "").trim().toLowerCase()) {
    case "beginner":
    case "improver":
      return "Beginner";
    case "intermediate":
      return "Intermediate";
    case "advanced":
    case "pro":
      return "Advanced";
    default:
      return null;
  }
}

/* Games the player can really take a spot in: not theirs already, not full and
   not closed. Their own level comes first, and each group is soonest first. */
function pickNearby(games: Game[], excluded: Set<string>, skill?: string | null): Game[] {
  const tier = tierOfPlayer(skill);
  return games
    .filter((g) => !excluded.has(g.id) && !isFull(g) && !g.isManuallyClosed)
    .map((game, order) => ({ game, order, rank: tier && skillTierOf(game) === tier ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, NEARBY_ROWS)
    .map((x) => x.game);
}

// Opens the phone's own maps app on iPhone and Mac, and Google Maps elsewhere.
function openDirections(query: string) {
  const q = encodeURIComponent(query);
  const apple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  window.open(
    apple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`,
    "_blank",
    "noopener",
  );
}

function place(game: Game): string {
  return game.area ? `${game.venue}, ${game.area}` : game.venue;
}

function courtLabel(game: Game): string {
  const open = slotsLeft(game);
  return `Court with ${game.players.length} of ${game.maxPlayers} players in, ${spotsOpenText(open)}`;
}

function SectionTitle({ title, seeAllHref }: { title: string; seeAllHref?: string }) {
  return (
    <div className="ios-sect">
      <h2 className="ios-t3">{title}</h2>
      {seeAllHref && (
        <Link href={seeAllHref} className="ios-cl ios-acc ios-md ios-link">
          See All
        </Link>
      )}
    </div>
  );
}

function NextGameCard({ game, userId }: { game: Game; userId: string | null }) {
  const open = slotsLeft(game);
  return (
    <div className="ios-card" style={{ padding: "10px 10px 12px" }}>
      <Link href={`/games/${game.id}`} className="ios-link ios-press" style={{ display: "block" }}>
        <Court spots={spotsFor(game.players, game.maxPlayers, userId)} big radius={8.5} label={courtLabel(game)} />
        <div style={{ padding: "12px 6px 0" }}>
          <div className="ios-t2">{gameWhen(game.startsAt)}</div>
          <div className="ios-sh ios-sec" style={{ marginTop: 2 }}>
            {place(game)}
          </div>
          <div className="ios-sh" style={{ marginTop: 2 }}>
            <span className="ios-sb">You’re in</span>
            <span className="ios-sec"> · </span>
            {game.isManuallyClosed ? (
              <span className="ios-sec">Closed</span>
            ) : open > 0 ? (
              <span className="ios-sb ios-acc">{spotsOpenText(open)}</span>
            ) : (
              <span className="ios-sec">Full</span>
            )}
          </div>
        </div>
      </Link>
      <div style={{ display: "flex", gap: 8, margin: "12px 6px 0" }}>
        <button
          type="button"
          className="ios-pill ios-press"
          style={{ border: 0, cursor: "pointer" }}
          onClick={() => openDirections(place(game))}
        >
          <Icon name="directions" size={22} />
          Directions
        </button>
        <Link href={`/games/${game.id}/chat`} className="ios-pill ios-press">
          <Icon name="chat" size={21} />
          Chat
        </Link>
      </div>
    </div>
  );
}

function NoGameCard() {
  return (
    <div className="ios-card" style={{ padding: "10px 10px 12px" }}>
      <Court spots={[null, null, null, null]} big radius={8.5} label="Empty court, no game booked" />
      <div style={{ padding: "12px 6px 0" }}>
        <div className="ios-t2">No Game Yet</div>
        <div className="ios-sh ios-sec" style={{ marginTop: 2 }}>
          Join a game below, or start your own.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, margin: "12px 6px 0" }}>
        <Link href="/create" className="ios-pill ios-press">
          <Icon name="plus" size={15} />
          New Game
        </Link>
      </div>
    </div>
  );
}

function NearbyRow({
  game,
  userId,
  viewerInitials,
  priced,
  onJoined,
}: {
  game: Game;
  userId: string | null;
  viewerInitials: string;
  priced: boolean;
  onJoined: () => void;
}) {
  const [joined, setJoined] = useState(false);
  const [failed, setFailed] = useState(false);
  const players = useMemo(
    () => (joined && userId ? [...game.players, { id: userId, initials: viewerInitials }] : game.players),
    [joined, game.players, userId, viewerInitials],
  );
  const open = game.maxPlayers - players.length;
  const when = gameWhen(game.startsAt);
  return (
    <div className="ios-row" style={{ "--ios-inset": "112px" } as React.CSSProperties}>
      <Link
        href={`/games/${game.id}`}
        className="ios-link ios-grow ios-press"
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        <div style={{ width: 84, flex: "none" }}>
          <Court
            spots={spotsFor(players, game.maxPlayers, null)}
            label={`Court with ${players.length} of ${game.maxPlayers} players in, ${spotsOpenText(open)}`}
          />
        </div>
        <div className="ios-grow">
          <div className="ios-hl ios-clip">{when}</div>
          <div className="ios-fn ios-sec">{place(game)}</div>
          {failed ? (
            <div className="ios-fn ios-sec" role="status">
              Couldn’t join. Try again.
            </div>
          ) : (
            <div className="ios-fn ios-sb ios-acc" aria-live="polite">
              {open > 0 ? spotsOpenText(open) : "Full"}
            </div>
          )}
        </div>
      </Link>
      <JoinPill
        gameId={game.id}
        gameLabel={`${when} at ${game.venue}`}
        userId={userId}
        priced={priced}
        onFailed={() => setFailed(true)}
        onJoined={() => {
          setFailed(false);
          setJoined(true);
          onJoined();
        }}
      />
    </div>
  );
}

export default function HomeDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nextGame, setNextGame] = useState<Game | null>(null);
  const [nearby, setNearby] = useState<Game[]>([]);
  // Set after mounting, so the date is always the viewer's current day and
  // never one left over from when the page was built.
  const [today, setToday] = useState("");

  const loadNextGame = useCallback(async (uid: string) => {
    const upcoming = await getUpcomingGamesFor(uid); // soonest first
    const first = upcoming[0];
    return first ? await getGame(String(first.id)) : null;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!active) return;
      setToday(longDate());
      try {
        const [games, next, me, own] = await Promise.all([
          getGames(),
          uid ? loadNextGame(uid) : Promise.resolve(null),
          uid ? getProfile(uid) : Promise.resolve(null),
          uid ? getJoinedOrCreatedGameIds(uid) : Promise.resolve([] as string[]),
        ]);
        if (!active) return;
        // First run: the one place that sends a new player to set-up. A shared
        // game link never lands here, so it can't interrupt someone joining.
        if (me && !me.onboarded_at) {
          router.replace("/welcome");
          return;
        }
        setUserId(uid);
        setProfile(me);
        setNextGame(next);
        setNearby(pickNearby(games, new Set(own), me?.skill_level));
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
  }, [router, attempt, loadNextGame]);

  const header = (
    <header className="ios-nav">
      <div>
        <div className="ios-eyebrow">{today}</div>
        <h1 className="ios-lt">Home</h1>
      </div>
      <div className="ios-gcap ios-glass">
        <NotificationBell />
        <Link href="/create" aria-label="New game" className="ios-gcap-i ios-press">
          <Icon name="plus" size={21} />
        </Link>
      </div>
    </header>
  );

  if (loading) {
    return (
      <>
        {header}
        <div aria-hidden style={{ marginTop: 13 }}>
          <div className="ios-skel" style={{ height: 340, margin: "0 16px" }} />
          <div className="ios-skel" style={{ height: 200, margin: "20px 16px 0" }} />
        </div>
      </>
    );
  }

  if (failed) {
    return (
      <>
        {header}
        <div className="ios-card" style={{ marginTop: 13, padding: 20 }} role="alert">
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
      </>
    );
  }

  return (
    <>
      {header}
      <section style={{ marginTop: 13 }}>
        <SectionTitle title="Your Next Game" />
        {nextGame ? <NextGameCard game={nextGame} userId={userId} /> : <NoGameCard />}
      </section>
      <section style={{ marginTop: 20 }}>
        <SectionTitle title="Games Near You" seeAllHref="/discover" />
        {nearby.length > 0 ? (
          <div className="ios-list">
            {nearby.map((game) => (
              <NearbyRow
                key={game.id}
                game={game}
                userId={userId}
                viewerInitials={initialsFrom(profile?.name)}
                priced={game.pricePerPlayer != null}
                onJoined={() => {
                  // The game they just joined may now be their next game.
                  if (userId) loadNextGame(userId).then(setNextGame, () => {});
                }}
              />
            ))}
          </div>
        ) : (
          <div className="ios-card" style={{ padding: 20 }}>
            <div className="ios-hl">No Open Games Right Now</div>
            <div className="ios-sh ios-sec" style={{ marginTop: 2 }}>
              New games appear here as soon as they’re posted.
            </div>
          </div>
        )}
      </section>
    </>
  );
}
