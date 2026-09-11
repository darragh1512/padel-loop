"use client";

// The player list — and the one screen where a blocked person is NOT hidden.
//
// Padel is four people on one court. Blocking can take somebody out of your
// search results, your connections and your chat, but it cannot take them off
// the court on Saturday. An app that quietly drops them from this list would
// be telling the viewer something untrue about who they are about to spend an
// hour with — which manufactures exactly the confrontation blocking exists to
// prevent, with no warning, in person.
//
// So the roster stays honest and the treatment changes instead: a blocked
// player is shown muted, marked "Blocked", with no photo and no link through
// to their profile. No accidental interaction, no surprise on the day. The
// count is untouched — they really are in the game.
//
// A banner above the list gives the viewer the thing they can actually act on:
// they can leave. Nobody is removed for them, because nobody can be silently
// removed from a game other people are relying on.
//
// None of this is visible to the blocked person. They see an ordinary roster
// with the blocker in it, exactly as before.

import { useEffect, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/PlayerAvatar";
import { Avatar, Chip, SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { getBlockedIds } from "@/app/blocks";
import type { Player } from "@/lib/types";

export default function GameRoster({
  players,
  maxPlayers,
  emptySlots,
}: {
  players: Player[];
  maxPlayers: number;
  emptySlots: number;
}) {
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const ids = await getBlockedIds(data.user?.id ?? null);
      if (active) setBlocked(ids);
    })();
    return () => {
      active = false;
    };
  }, []);

  const blockedHere = players.filter((p) => blocked.has(p.id)).length;

  return (
    <>
      <SectionLabel>
        Players · {players.length} of {maxPlayers}
      </SectionLabel>

      {blockedHere > 0 && (
        <div className="pl-card border-2 border-dashed border-naranja-d px-4 py-3 mb-2">
          <div className="t-mono text-micro tracking-[0.14em] text-naranja-d">
            Heads up
          </div>
          <p className="text-label font-medium text-tinta/75 mt-1">
            {blockedHere === 1
              ? "Someone you've blocked is in this game."
              : `${blockedHere} people you've blocked are in this game.`}{" "}
            They haven&rsquo;t been told, and nobody has been removed — you&rsquo;d
            all be on court together. Leave the game below if you&rsquo;d rather
            not play.
          </p>
        </div>
      )}

      <div className="pl-card px-4 py-1.5">
        {players.map((p) => {
          const isBlocked = blocked.has(p.id);

          // Muted, unlinked, no photo — but still counted and still here.
          if (isBlocked) {
            return (
              <div
                key={p.id}
                className="flex items-center justify-between py-2.5 border-b border-tinta/15 last:border-0 opacity-55"
              >
                <div className="flex items-center gap-3">
                  <Avatar size="md" />
                  <div>
                    <div className="text-body font-extrabold text-tinta/70">
                      Blocked player
                    </div>
                    <div className="t-mono text-micro tracking-[0.1em] text-tinta/55">
                      {p.isOrganiser ? "Organiser · " : ""}You blocked them
                    </div>
                  </div>
                </div>
                <Chip>Level {p.level.toFixed(1)}</Chip>
              </div>
            );
          }

          return (
            <div
              key={p.id}
              className="flex items-center justify-between py-2.5 border-b border-tinta/15 last:border-0"
            >
              <Link
                href={`/players/${p.id}`}
                className="flex items-center gap-3 rounded-field active:opacity-70 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
              >
                <PlayerAvatar
                  userId={p.id}
                  avatarUrl={p.avatarUrl}
                  name={p.name}
                  className="size-9"
                />
                <div>
                  <div className="text-body font-extrabold text-tinta">{p.name}</div>
                  <div className="t-mono text-micro tracking-[0.1em] text-tinta/70">
                    {p.isOrganiser ? "Organiser · " : ""}
                    {p.gamesPlayed ?? 0} games
                  </div>
                </div>
              </Link>
              <Chip>Level {p.level.toFixed(1)}</Chip>
            </div>
          );
        })}

        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`s${i}`} className="flex items-center gap-3 py-2.5">
            <Avatar size="md" />
            <div>
              <div className="text-body font-extrabold text-naranja-d">+ you?</div>
              <div className="text-label font-medium text-tinta/45">
                This spot is really open
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
