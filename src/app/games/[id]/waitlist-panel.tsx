"use client";
// The queue, shown under the roster — organiser only.
//
// Queued people are NOT players: they live in their own table and are counted
// nowhere, so the "Players · 3 of 4" line above this panel is unaffected by
// however many are waiting. That separation is the whole point of the design;
// this panel is the only place a queue is made visible on the game screen,
// apart from a queued person seeing their own position on the join control.
//
// Visibility is checked here rather than on the server for the same reason
// CreatorActions does it: the page is a shared server render, and only the
// browser knows who is looking.

import { useEffect, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/PlayerAvatar";
import { SectionLabel } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import { ordinal, type WaitlistPlayer } from "../../games";

export default function WaitlistPanel({
  createdBy,
  queue,
  manuallyClosed = false,
}: {
  createdBy?: string;
  queue: WaitlistPlayer[];
  // Changes what the queue MEANS to the organiser: on a hand-closed game
  // nobody is being promoted, so saying "next in line" would be a lie.
  manuallyClosed?: boolean;
}) {
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!createdBy) return;
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (active) setIsCreator(uid != null && uid === createdBy);
    })();
    return () => {
      active = false;
    };
  }, [createdBy]);

  if (!isCreator || queue.length === 0) return null;

  return (
    <>
      <SectionLabel>
        Waiting · {queue.length} {queue.length === 1 ? "person" : "people"}
      </SectionLabel>
      <div className="pl-card px-4 py-1.5">
        {queue.map((person, i) => (
          <div
            key={person.userId}
            className="flex items-center justify-between py-2.5 border-b border-tinta/15 last:border-0"
          >
            <Link
              href={`/players/${person.userId}`}
              className="flex items-center gap-3 rounded-field active:opacity-70 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
            >
              <PlayerAvatar
                userId={person.userId}
                avatarUrl={person.avatarUrl}
                name={person.name}
                className="size-9 opacity-80"
              />
              <div>
                <div className="text-body font-extrabold text-tinta">{person.name}</div>
                <div className="t-mono text-micro tracking-[0.1em] text-tinta/70">
                  {ordinal(i + 1)} in queue
                </div>
              </div>
            </Link>
          </div>
        ))}
        <p className="text-label font-medium text-tinta/55 py-2.5 border-t-2 border-dashed border-tinta/20">
          {manuallyClosed
            ? "You closed this game, so nobody here is being moved in. Allow new players again and the next spot goes to whoever is first."
            : "If someone drops out, the person at the top is moved in automatically and told."}
        </p>
      </div>
    </>
  );
}
