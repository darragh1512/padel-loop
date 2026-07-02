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
      className="block pl-card p-4 mb-3 pl-rise active:scale-[0.99] transition-transform duration-150 ease-out"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="font-semibold text-[15px] text-ink">{game.venue}</div>
          <div className="text-[13px] text-ink-secondary mt-1">
            {formatGameTime(game.game_time)}
            {game.location ? <> · {game.location}</> : null}
          </div>
        </div>
        {cancelled ? (
          <span className="text-[13px] font-medium text-danger bg-sunken px-2.5 py-1 rounded-full whitespace-nowrap">
            Cancelled
          </span>
        ) : (
          <span className="text-[13px] text-accent font-medium bg-accent-soft px-2.5 py-1 rounded-full whitespace-nowrap">
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
    <div className="pl-surface rounded-(--radius-card) px-4 py-5 text-center text-[13px] text-ink-secondary">
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
    // Skeletons in the shape of the loaded screen — sunken, subtle pulse.
    return (
      <main className="px-5 pt-6 relative">
        <div className="bg-sunken rounded-(--radius-field) h-9 w-40 mt-2 animate-pulse" />
        <div className="mt-8 space-y-3">
          <div className="bg-sunken rounded-(--radius-card) h-[72px] animate-pulse" />
          <div className="bg-sunken rounded-(--radius-card) h-[72px] animate-pulse" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="px-5 pt-6 relative">
      <h1 className="font-display text-[28px] tracking-tight leading-tight text-ink mt-2 relative">
        My games
      </h1>
      <p className="text-[13px] text-ink-secondary mt-1">
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
