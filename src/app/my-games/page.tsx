"use client";
// The "My Games" screen: two lists for the logged-in player — games they
// CREATED and games they've JOINED — each card linking to that game's detail
// page. Cancelled games aren't hidden here (unlike the browse lists); instead
// they carry a clear "Cancelled" label so the player still sees them.
//
// It reads the player client-side (same Supabase auth the rest of the app
// uses) and sends logged-out visitors to the login page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { ButtonLink, Chip, EmptyState, SectionLabel, Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import {
  formatGameTime,
  getGamesCreatedBy,
  getGamesJoinedBy,
  type Game,
} from "../games";

// A game is cancelled only when its status is literally "cancelled"; a blank
// status on older rows is treated as a normal, active game.
const isCancelled = (g: Game) =>
  (g.status ?? "").trim().toLowerCase() === "cancelled";

// One card in a list. The whole card links to the detail page; cancelled
// games swap the skill chip for a terracotta "Cancelled" label. The skill
// chip is the quiet sunken bone — sage stays out of list decoration.
function MyGameCard({ game, delay = 0 }: { game: Game; delay?: number }) {
  const cancelled = isCancelled(game);
  return (
    <Link
      href={`/games/${game.id}`}
      className="pl-card pl-press pl-rise block p-4 mb-3 hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="text-title font-semibold text-ink">{game.venue}</div>
          <div className="text-label text-ink-secondary mt-1">
            {formatGameTime(game.game_time)}
            {game.location ? <> · {game.location}</> : null}
          </div>
        </div>
        {cancelled ? (
          <span className="text-label font-medium text-danger bg-sunken px-2.5 py-1 rounded-pill whitespace-nowrap">
            Cancelled
          </span>
        ) : (
          <Chip>{game.skill_level}</Chip>
        )}
      </div>
    </Link>
  );
}

export default function MyGamesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<Game[]>([]);
  const [joined, setJoined] = useState<Game[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid) {
        router.replace("/login");
        return;
      }

      const [createdGames, joinedGames] = await Promise.all([
        getGamesCreatedBy(uid),
        getGamesJoinedBy(uid),
      ]);
      if (!active) return;

      // Creating a game also adds you as its first player, so created games
      // show up in the joined list too. Keep each game in one place only:
      // "Joined" means games someone else created that you joined.
      const createdIds = new Set(createdGames.map((g) => String(g.id)));
      setCreated(createdGames);
      setJoined(joinedGames.filter((g) => !createdIds.has(String(g.id))));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    // Skeletons in the shape of the loaded screen: title, sub, two sections
    // of cards — with the shared shimmer, never a spinner.
    return (
      <main className="px-5 pt-6 relative">
        <h1 className="font-display text-display-md text-ink mt-2">My games</h1>
        <p className="text-label text-ink-secondary mt-1">
          The games you&rsquo;re running and the ones you&rsquo;ve joined.
        </p>
        <div className="mt-11 space-y-3">
          <Skeleton className="rounded-card h-18" />
          <Skeleton className="rounded-card h-18" />
        </div>
        <div className="mt-11 space-y-3">
          <Skeleton className="rounded-card h-18" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="px-5 pt-6 relative">
      <h1 className="font-display text-display-md text-ink mt-2">My games</h1>
      <p className="text-label text-ink-secondary mt-1">
        The games you&rsquo;re running and the ones you&rsquo;ve joined.
      </p>

      <SectionLabel>Games you created</SectionLabel>
      {created.length > 0 ? (
        created.map((game, i) => (
          <MyGameCard key={game.id} game={game} delay={Math.min(i, 6) * 50} />
        ))
      ) : (
        <EmptyState
          title="Run your own game."
          body="Set one up once — the Loop fills the spots."
          action={
            <ButtonLink href="/create" variant="secondary" size="sm">
              Create a game
            </ButtonLink>
          }
        />
      )}

      <SectionLabel>Games you joined</SectionLabel>
      {joined.length > 0 ? (
        joined.map((game, i) => (
          <MyGameCard key={game.id} game={game} delay={Math.min(i, 6) * 50} />
        ))
      ) : (
        <EmptyState
          title="Your next game is out there."
          body="Take a spot in a game near you, at your level."
          action={
            <ButtonLink href="/discover" size="sm">
              Find a game
            </ButtonLink>
          }
        />
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
