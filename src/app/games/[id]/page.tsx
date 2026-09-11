import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { CourtHero } from "@/components/brand";
import { Chip, SectionLabel } from "@/components/ui";
import { getGame } from "@/lib/data";
import {
  formatDay,
  formatPrice,
  formatTimeRange,
  isCancelled,
  isFull,
} from "@/lib/types";
import { notFound } from "next/navigation";
import JoinGame from "./join-game";
import CreatorActions from "./creator-actions";
import ChatThread from "./chat-thread";
import LogResult from "./log-result";
import { hasMatchResult } from "../../match-results";
import { getWaitlistPlayers } from "../../games";
import WaitlistPanel from "./waitlist-panel";
import ShareGame from "./share-game";
import TrackGameView from "./track-view";
import GameRoster from "./game-roster";
import { cache } from "react";
import type { Metadata } from "next";
import { shareDescription, shareTitle } from "./share-copy";

// Read fresh data on each request so the players list and "open spot" count
// (both derived from the live game_players table) always reflect the latest
// joins/leaves. JoinGame also calls router.refresh() to update this in place.
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

  // The price the organiser set, already formatted — or null when they
  // haven't set one. Everything price-related on this screen is hidden
  // when it's null rather than falling back to a made-up number.
  const price = formatPrice(game.pricePerPlayer);
  const emptySlots = game.maxPlayers - game.players.length;

  return (
    <main className="px-5 pt-6 relative">
      <TrackGameView gameId={game.id} />
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/discover"
          aria-label="Back to games"
          className="pl-hit inline-flex text-papel/85 hover:text-papel rounded-pill transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        {/* Shareable by anyone who can see the game, signed in or not — a
            link that can't be passed on again dead-ends the chain that
            brought this person here in the first place. */}
        <ShareGame
          gameId={game.id}
          venue={game.venue}
          when={`${formatDay(game)} · ${formatTimeRange(game)}`}
        />
      </div>

      <CourtHero />

      <h1 className="t-display text-display-md text-papel mt-5">{game.venue}</h1>
      <p className="t-mono text-micro tracking-[0.16em] text-papel/85 mt-2">
        {game.courtLabel && <>{game.courtLabel} · </>}
        {formatDay(game)} · {formatTimeRange(game)}
      </p>
      {game.recursWeekly && (
        <div className="mt-2.5">
          <Chip>Repeats weekly</Chip>
        </div>
      )}

      {/* Owner-only actions: only the game's creator sees these (checked
          client-side against the logged-in user). */}
      <CreatorActions
        gameId={game.id}
        createdBy={game.createdBy}
        recursWeekly={game.recursWeekly}
        seriesId={game.seriesId}
        isManuallyClosed={game.isManuallyClosed}
      />

      {/* The price cell only exists when there is a price, so the strip is
          two cells wide instead of three rather than showing a blank. */}
      <div className={`grid gap-2 mt-5 ${price ? "grid-cols-3" : "grid-cols-2"}`}>
        {[
          ["Level", `${game.levelMin.toFixed(1)}–${game.levelMax.toFixed(1)}`],
          ["Format", game.format[0].toUpperCase() + game.format.slice(1)],
          ...(price ? [["Per player", price]] : []),
        ].map(([k, v]) => (
          <div key={k} className="pl-card px-2.5 py-3 text-center">
            <div className="t-mono text-micro tracking-[0.14em] text-naranja-d">{k}</div>
            <div className="text-body font-extrabold mt-1 text-tinta">{v}</div>
          </div>
        ))}
      </div>

      <GameRoster
        players={game.players}
        maxPlayers={game.maxPlayers}
        emptySlots={emptySlots}
      />

      {/* The queue, under the roster and organiser-only. Deliberately a
          separate card below the players, never mixed into them. */}
      <WaitlistPanel
        createdBy={game.createdBy}
        queue={queue}
        manuallyClosed={game.isManuallyClosed === true}
      />

      {/* Price — shown ONLY when the organiser set one. price_per_player is
          what one player pays, so it is presented as-is: no total is derived
          from it, because the court's total cost isn't something we know. */}
      {price && (
        <>
          <SectionLabel>Price</SectionLabel>
          <div className="pl-card p-4">
            <div className="flex justify-between items-center text-body font-medium text-tinta/70">
              <span>Per player</span>
              <span className="t-display text-display-sm text-tinta">{price}</span>
            </div>
          </div>
        </>
      )}

      <div className="mt-6">
        {isCancelled(game) ? (
          /* Cancelled games can't be joined — show a clear notice in place of
             the Join button so anyone who already joined sees it's off. */
          <div className="w-full rounded-card py-4 text-center bg-papel border-2 border-dashed border-naranja-d">
            <div className="t-mono text-label tracking-[0.14em] text-naranja-d">Cancelled</div>
            <div className="text-label font-medium text-tinta/70 mt-1">
              This game is off — no need to turn up.
            </div>
          </div>
        ) : (
          /* Real join/leave behaviour on the shared Button kit. */
          <JoinGame
            gameId={game.id}
            priceLabel={price}
            // The creator is in the roster but cannot leave — they cancel.
            createdBy={game.createdBy}
            hasResult={hasResult}
            // Two separate facts, passed separately on purpose: a game can
            // be closed by hand while spots remain, and the button needs to
            // say which is true.
            manuallyClosed={game.isManuallyClosed === true}
            full={isFull(game)}
          />
        )}
      </div>

      {/* Match result — the owner starts the match once the game is full, then
          every player enters the score independently; the server confirms the
          result when all the scoresheets match. Confirmed results show to any
          viewer; the in-progress board is participants-only (checked
          client-side). */}
      <LogResult
        gameId={game.id}
        players={game.players}
        createdBy={game.createdBy}
        maxPlayers={game.maxPlayers}
      />

      {/* Per-game chat, beneath everything else. Renders the message box only
          for players/creators; others see a short "join to chat" note. The
          #group-chat anchor lets the Chat tab link straight to this thread. */}
      <section id="group-chat" className="scroll-mt-4">
        <ChatThread gameId={game.id} />
      </section>

      <BottomNav />
    </main>
  );
}
