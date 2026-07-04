import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { CourtHero } from "@/components/brand";
import { Avatar, Chip, SectionLabel } from "@/components/ui";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getGame } from "@/lib/data";
import { formatDay, formatTimeRange, isCancelled, pricePerHead } from "@/lib/types";
import { notFound } from "next/navigation";
import JoinGame from "./join-game";
import CreatorActions from "./creator-actions";
import ChatThread from "./chat-thread";
import LogResult from "./log-result";

// Read fresh data on each request so the players list and "open spot" count
// (both derived from the live game_players table) always reflect the latest
// joins/leaves. JoinGame also calls router.refresh() to update this in place.
export const dynamic = "force-dynamic";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const perHead = pricePerHead(game);
  const emptySlots = game.maxPlayers - game.players.length;

  return (
    <main className="px-5 pt-6 relative">
      <Link
        href="/discover"
        aria-label="Back to games"
        className="inline-flex text-ink-secondary hover:text-ink rounded-pill transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <CourtHero />

      <h1 className="font-display text-display-md text-ink mt-5">{game.venue}</h1>
      <p className="text-label text-ink-secondary mt-1">
        {game.courtLabel && <>{game.courtLabel} · </>}
        <span className="text-ink font-medium">
          {formatDay(game)}, {formatTimeRange(game)}
        </span>
      </p>

      {/* Owner-only actions: only the game's creator sees these (checked
          client-side against the logged-in user). */}
      <CreatorActions gameId={game.id} createdBy={game.createdBy} />

      <div className="grid grid-cols-3 gap-2 mt-5">
        {[
          ["Level", `${game.levelMin.toFixed(1)}–${game.levelMax.toFixed(1)}`],
          ["Format", game.format[0].toUpperCase() + game.format.slice(1)],
          ["Per head", `€${perHead.toFixed(0)}`],
        ].map(([k, v]) => (
          <div key={k} className="pl-card px-2.5 py-3 text-center">
            <div className="text-label text-ink-secondary">{k}</div>
            <div className="text-body font-semibold mt-1 text-ink">{v}</div>
          </div>
        ))}
      </div>

      <SectionLabel>
        Players · {game.players.length} of {game.maxPlayers}
      </SectionLabel>
      <div className="pl-card px-4 py-1.5">
        {game.players.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between py-2.5 border-b border-line last:border-0"
          >
            <Link
              href={`/players/${p.id}`}
              className="flex items-center gap-3 rounded-field active:opacity-70 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <PlayerAvatar
                userId={p.id}
                avatarUrl={p.avatarUrl}
                name={p.name}
                className="size-9"
              />
              <div>
                <div className="text-body font-medium text-ink">{p.name}</div>
                <div className="text-label text-ink-secondary">
                  {p.isOrganiser ? "Organiser · " : ""}
                  {p.gamesPlayed ?? 0} games
                </div>
              </div>
            </Link>
            <Chip>Level {p.level.toFixed(1)}</Chip>
          </div>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`s${i}`} className="flex items-center gap-3 py-2.5">
            <Avatar size="md" />
            <div>
              <div className="text-body font-medium text-ink-secondary">Open spot</div>
              <div className="text-label text-ink-faint">This could be you</div>
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>Cost split</SectionLabel>
      <div className="pl-card p-4">
        <div className="flex justify-between text-label text-ink-secondary py-1">
          <span>Court · {game.durationMins} min</span>
          <span className="text-ink font-semibold">€{game.courtFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-label text-ink-secondary py-1">
          <span>Split between</span>
          <span className="text-ink font-semibold">{game.maxPlayers} players</span>
        </div>
        <div className="flex justify-between items-center text-body text-ink-secondary border-t border-line mt-1.5 pt-2.5">
          <span>You pay</span>
          <span className="font-display text-display-sm text-ink">€{perHead.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6">
        {isCancelled(game) ? (
          /* Cancelled games can't be joined — show a clear notice in place of
             the Join button so anyone who already joined sees it's off. */
          <div className="w-full rounded-card py-3 text-center border border-line bg-sunken">
            <div className="font-medium text-body text-danger">Cancelled</div>
            <div className="text-label text-ink-secondary mt-0.5">
              This game is off — no need to turn up.
            </div>
          </div>
        ) : (
          /* Real join/leave behaviour on the shared Button kit. */
          <JoinGame gameId={game.id} perHead={perHead} />
        )}
      </div>

      {/* Log result — shown only to players in this game (the component checks
          membership client-side). Captures a pending result; doesn't decide a
          winner yet. */}
      <LogResult gameId={game.id} players={game.players} />

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
