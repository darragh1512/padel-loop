import BottomNav from "@/components/BottomNav";
import { getGame } from "@/lib/data";
import { notFound } from "next/navigation";
import { hasMatchResult } from "../../match-results";
import { getWaitlistPlayers } from "../../games";
import GameScreen from "./game-screen";
import TrackGameView from "./track-view";
import { cache } from "react";
import type { Metadata } from "next";
import { shareDescription, shareTitle } from "./share-copy";

// Read fresh data on each request so the players list and "open spot" count
// (both derived from the live game_players table) always reflect the latest
// joins/leaves. Joining also calls router.refresh() to update this in place.
export const dynamic = "force-dynamic";

// generateMetadata and the page body both need the game. React's cache()
// dedupes them within a single request, so a link preview scrape costs one
// database read rather than two.
const loadGame = cache(getGame);

// The WhatsApp link preview. Title is the club, description is date, time,
// level and spots left; the picture is generated next door in
// opengraph-image.tsx, which Next wires up by file convention — no og:image
// URL is written by hand here.
//
// A game DELETED after its link was shared falls through to a plain card
// rather than an error, so a stale link in a group chat reads as a finished
// game instead of a broken site.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const game = await loadGame(id);

  if (!game) {
    return {
      title: "Game not found · Padel Loop",
      description: "This game is no longer listed.",
    };
  }

  const title = shareTitle(game);
  const description = shareDescription(game);

  return {
    title: `${title} · Padel Loop`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await loadGame(id);
  // Whether a match is already being scored — leaving is refused once it is.
  const hasResult = await hasMatchResult(id);
  // The queue. Queued people are NOT in game.players, so nothing below
  // this line changes the 3-of-4 count.
  const queue = await getWaitlistPlayers(id);
  if (!game) notFound();

  return (
    <main className="ios">
      <TrackGameView gameId={game.id} />
      <GameScreen game={game} queue={queue} hasResult={hasResult} />
      <BottomNav />
    </main>
  );
}
