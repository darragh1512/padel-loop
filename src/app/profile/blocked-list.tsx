"use client";

// The blocked players section of Settings: see who you've blocked and unblock.
//
// This is the only screen that names who you've blocked, and only the person who
// did the blocking can see it. The database enforces that too: the read rule on
// `blocks` is `blocker_id = auth.uid()`, so nobody can find out they were blocked.
//
// Unblocking doesn't restore the connection that blocking removed. Reconnecting
// is a decision, not an undo.

import { useEffect, useState } from "react";
import Link from "next/link";
import Monogram from "@/components/ios/Monogram";
import { getBlockedPeople, unblockUser, type BlockedPerson } from "@/app/blocks";

export default function BlockedList({ userId }: { userId: string | null }) {
  const [people, setPeople] = useState<BlockedPerson[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unblockFailed, setUnblockFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getBlockedPeople(userId)
      .then((rows) => {
        if (!active) return;
        setPeople(rows);
        setFailed(false);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  async function handleUnblock(blockedId: string) {
    if (!userId || busyId) return;
    setBusyId(blockedId);
    setUnblockFailed(false);
    const result = await unblockUser(userId, blockedId);
    if ("ok" in result) setPeople((current) => current.filter((p) => p.userId !== blockedId));
    else setUnblockFailed(true);
    setBusyId(null);
  }

  // A failed read would otherwise look the same as nobody being blocked.
  if (failed) {
    return (
      <div className="ios-card ios-sh" style={{ marginTop: 16, padding: 16 }} role="alert">
        Couldn’t load your blocked players.{" "}
        <button
          type="button"
          className="ios-acc ios-md"
          style={{ border: 0, padding: 0, background: "none", cursor: "pointer", font: "inherit" }}
          onClick={() => setAttempt((n) => n + 1)}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Most people have blocked nobody, and an empty section would just be noise.
  if (people.length === 0) return null;

  return (
    <section style={{ marginTop: 16 }}>
      <div className="ios-sect">
        <h2 className="ios-t3">Blocked Players</h2>
      </div>
      <div className="ios-list">
        {people.map((person) => (
          <div key={person.userId} className="ios-row" style={{ padding: "8px 16px", "--ios-inset": "68px" } as React.CSSProperties}>
            <Link href={`/players/${person.userId}`} className="ios-link ios-grow" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Monogram name={person.name} photoUrl={person.avatarUrl} />
              <span className="ios-bd ios-grow ios-clip">{person.name || "Player"}</span>
            </Link>
            <button
              type="button"
              className="ios-pill-tint ios-press"
              disabled={busyId === person.userId}
              aria-busy={busyId === person.userId || undefined}
              aria-label={`Unblock ${person.name || "player"}`}
              onClick={() => handleUnblock(person.userId)}
            >
              Unblock
            </button>
          </div>
        ))}
      </div>
      {unblockFailed && (
        <p className="ios-fn ios-destructive" role="alert" style={{ padding: "8px 32px 0" }}>
          Couldn’t unblock that player. Check your connection and try again.
        </p>
      )}
      <p className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
        They were never told. Unblocking won’t reconnect you, but you can do that from their profile.
      </p>
    </section>
  );
}
