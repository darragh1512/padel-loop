"use client";

// The blocked-users list in settings — manage and unblock.
//
// This is the only screen that names who you've blocked, and it is only ever
// visible to the person who did the blocking. RLS enforces that independently:
// the SELECT policy on `blocks` is `blocker_id = auth.uid()`, so there is no
// query anyone can write to discover that they have been blocked.
//
// Unblocking does NOT restore the connection that blocking removed.
// Reconnecting is a decision, not an undo.

import { useEffect, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/PlayerAvatar";
import { SectionLabel } from "@/components/ui";
import { getBlockedPeople, unblockUser, type BlockedPerson } from "@/app/blocks";

export default function BlockedList({ userId }: { userId: string | null }) {
  const [people, setPeople] = useState<BlockedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Same subscribe-shaped effect the rest of the app uses: the async work
  // happens in a callback, guarded so a late response cannot set state on an
  // unmounted screen.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) {
        if (active) setLoading(false);
        return;
      }
      let rows: BlockedPerson[] = [];
      try {
        rows = await getBlockedPeople(userId);
      } catch {
        // Failing quietly here is the right call: this panel is hidden when
        // nobody is blocked, so an error banner on a settings screen for a
        // list most people do not have would be noise. The console has it.
        if (active) setLoading(false);
        return;
      }
      if (!active) return;
      setPeople(rows);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  async function handleUnblock(blockedId: string) {
    if (!userId || busyId) return;
    setBusyId(blockedId);
    const result = await unblockUser(userId, blockedId);
    if ("ok" in result) {
      // Drop it locally rather than refetching — the row is gone either way.
      setPeople((current) => current.filter((p) => p.userId !== blockedId));
    }
    setBusyId(null);
  }

  // Nothing blocked is the normal case, and an empty card would just be noise
  // on the settings screen.
  if (loading || people.length === 0) return null;

  return (
    <>
      <SectionLabel>Blocked players</SectionLabel>
      <div className="pl-card px-4 py-1.5">
        {people.map((person) => (
          <div
            key={person.userId}
            className="flex items-center justify-between gap-3 py-2.5 border-b border-tinta/15 last:border-0"
          >
            <Link
              href={`/players/${person.userId}`}
              className="flex items-center gap-3 min-w-0 rounded-field active:opacity-70 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja"
            >
              <PlayerAvatar
                userId={person.userId}
                avatarUrl={person.avatarUrl}
                name={person.name}
                className="size-9 opacity-70"
              />
              <div className="min-w-0">
                <div className="text-body font-extrabold text-tinta truncate">
                  {person.name ?? "Player"}
                </div>
                <div className="t-mono text-micro tracking-[0.1em] text-tinta/60">
                  Blocked
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => handleUnblock(person.userId)}
              disabled={busyId === person.userId}
              className="t-mono shrink-0 text-micro tracking-[0.12em] text-naranja-d border-2 border-naranja-d rounded-pill px-3 py-1.5 disabled:opacity-50 active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
            >
              {busyId === person.userId ? "…" : "Unblock"}
            </button>
          </div>
        ))}
        <p className="text-label font-medium text-tinta/55 py-2.5 border-t-2 border-dashed border-tinta/20">
          They were never told. Unblocking won&rsquo;t reconnect you — you can do
          that from their profile if you want to.
        </p>
      </div>
    </>
  );
}
