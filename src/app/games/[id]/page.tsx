import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { CourtHero } from "@/components/brand";
import { Avatar, SectionLabel } from "@/components/ui";
import { getGame } from "@/lib/data";
import { formatDay, formatTimeRange, pricePerHead } from "@/lib/types";
import { notFound } from "next/navigation";
import JoinGame from "./join-game";

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
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <div className="flex justify-between items-center text-pale relative">
        <Link href="/" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="#c4d9ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <button aria-label="Share game">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M4 12v7h16v-7M12 16V4m0 0L8 8m4-4 4 4" stroke="#c4d9ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <CourtHero />

      <h1 className="font-display font-bold text-[19px] tracking-tight mt-4.5">{game.venue}</h1>
      <p className="text-[13px] text-dim font-light mt-1">
        {game.courtLabel && <>{game.courtLabel} · </>}
        <b className="text-pale font-medium">
          {formatDay(game)}, {formatTimeRange(game)}
        </b>
      </p>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          ["Level", `${game.levelMin.toFixed(1)}–${game.levelMax.toFixed(1)}`],
          ["Format", game.format[0].toUpperCase() + game.format.slice(1)],
          ["Per head", `€${perHead.toFixed(0)}`],
        ].map(([k, v]) => (
          <div key={k} className="pl-surface rounded-2xl px-2.5 py-3 text-center">
            <div className="font-display font-light text-[8px] tracking-[2px] uppercase text-faint">{k}</div>
            <div className="text-sm font-semibold mt-1 text-pale">{v}</div>
          </div>
        ))}
      </div>

      <SectionLabel>
        Players · {game.players.length} of {game.maxPlayers}
      </SectionLabel>
      <div className="pl-surface rounded-(--radius-card) px-4 py-1.5">
        {game.players.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
          >
            <div className="flex items-center gap-3">
              <Avatar player={p} index={i} size="md" />
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-[10.5px] text-faint">
                  {p.isOrganiser ? "Organiser · " : ""}
                  {p.gamesPlayed ?? 0} games
                </div>
              </div>
            </div>
            <span className="font-display text-[8.5px] tracking-[1px] text-sky bg-vivid/13 rounded-full px-2.5 py-1.5">
              LVL {p.level.toFixed(1)}
            </span>
          </div>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`s${i}`} className="flex items-center gap-3 py-2.5">
            <Avatar size="md" />
            <div>
              <div className="text-sm font-medium text-sky">Open slot</div>
              <div className="text-[10.5px] text-faint">This could be you</div>
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>Cost split</SectionLabel>
      <div className="pl-surface rounded-(--radius-card) p-4">
        <div className="flex justify-between text-[13px] text-dim py-1">
          <span>Court · {game.durationMins} min</span>
          <b className="text-white font-semibold">€{game.courtFee.toFixed(2)}</b>
        </div>
        <div className="flex justify-between text-[13px] text-dim py-1">
          <span>Split between</span>
          <b className="text-white font-semibold">{game.maxPlayers} players</b>
        </div>
        <div className="flex justify-between items-center text-sm text-dim border-t border-white/8 mt-1.5 pt-2.5">
          <span>You pay</span>
          <b className="text-sky font-semibold text-base">€{perHead.toFixed(2)}</b>
        </div>
      </div>

      <div className="mt-4">
        {/* Real join/leave behaviour, same look as the design's PrimaryButton. */}
        <JoinGame gameId={game.id} perHead={perHead} />
      </div>

      <BottomNav />
    </main>
  );
}
