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
import { SectionLabel } from "@/components/ui";
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

// One card in a list — styled to match the browse list's pl-card games, but
// using the raw game fields we have here. The whole card links to the detail
// page; cancelled games swap the skill pill for a red "Cancelled" label.
function MyGameCard({ game, delay = 0 }: { game: Game; delay?: number }) {
  const cancelled = isCancelled(game);
  return (
    <Link
      href={`/games/${game.id}`}
      className="block pl-card p-[17px] pb-[15px] mb-3 pl-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="font-semibold text-[15.5px]">{game.venue}</div>
          <div className="text-[12.5px] text-dim font-light mt-1">
            {formatGameTime(game.game_time)}
            {game.location ? <> · {game.location}</> : null}
          </div>
        </div>
        {cancelled ? (
          <span className="text-[11px] font-semibold text-[#e09a9a] bg-[rgba(200,80,80,0.12)] border border-[rgba(200,80,80,0.3)] px-2.5 py-1 rounded-full whitespace-nowrap">
            Cancelled
          </span>
        ) : (
          <span className="text-[11px] text-sky font-medium bg-vivid/12 px-2.5 py-1 rounded-full whitespace-nowrap">
            {game.skill_level}
          </span>
        )}
      </div>
    </Link>
  );
}

// Shown when a section has no games yet.
function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="pl-surface rounded-(--radius-card) px-4 py-5 text-center text-[13px] text-faint font-light">
      {children}
    </div>
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
    return (
      <main className="px-5 pt-6 relative">
        <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />
        <p className="text-[13px] text-dim font-light mt-2">Loading…</p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="px-5 pt-6 relative">
      <div className="pl-glow absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[230px] pointer-events-none" />

      <h1 className="font-display text-[21px] tracking-tight leading-snug mt-2 relative">
        <b className="font-bold">My games</b>
      </h1>
      <p className="text-[13px] text-dim font-light mt-1">
        The games you’re running and the ones you’ve joined.
      </p>

      <SectionLabel>Games you created</SectionLabel>
      {created.length > 0 ? (
        created.map((game, i) => (
          <MyGameCard key={game.id} game={game} delay={i * 40} />
        ))
      ) : (
        <EmptyNote>You haven’t created any games yet.</EmptyNote>
      )}

      <SectionLabel>Games you joined</SectionLabel>
      {joined.length > 0 ? (
        joined.map((game, i) => (
          <MyGameCard key={game.id} game={game} delay={i * 40} />
        ))
      ) : (
        <EmptyNote>You haven’t joined any games yet.</EmptyNote>
      )}

      <div className="h-4" />
      <BottomNav />
    </main>
  );
}
