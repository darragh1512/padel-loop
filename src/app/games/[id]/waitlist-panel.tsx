"use client";
// The queue, shown under the roster — organiser only.
//
// Queued people are NOT players: they live in their own table and are counted
// nowhere, so the "3 of 4" count above this panel is unaffected by however many
// are waiting. That separation is the whole point of the design; this panel is
// the only place a queue is made visible on the game screen, apart from a queued
// person seeing their own position on the join control.

import Link from "next/link";
import Icon from "@/components/ios/Icon";
import Monogram from "@/components/ios/Monogram";
import { ordinal, type WaitlistPlayer } from "../../games";

export default function WaitlistPanel({
  isOrganiser,
  queue,
  manuallyClosed = false,
}: {
  isOrganiser: boolean;
  queue: WaitlistPlayer[];
  // Changes what the queue MEANS to the organiser: on a hand-closed game
  // nobody is being promoted, so saying "next in line" would be a lie.
  manuallyClosed?: boolean;
}) {
  if (!isOrganiser || queue.length === 0) return null;

  return (
    <section style={{ marginTop: 18 }}>
      <div className="ios-sect">
        <h2 className="ios-t3">Waiting</h2>
        <div className="ios-fn ios-sec">
          {queue.length} {queue.length === 1 ? "person" : "people"}
        </div>
      </div>
      <div className="ios-list">
        {queue.map((person, i) => (
          <Link
            key={person.userId}
            href={`/players/${person.userId}`}
            className="ios-row ios-link"
            style={{ padding: "8px 16px", "--ios-inset": "68px" } as React.CSSProperties}
          >
            <Monogram name={person.name} photoUrl={person.avatarUrl} />
            <div className="ios-grow">
              <div className="ios-bd">{person.name}</div>
              <div className="ios-fn ios-sec">{ordinal(i + 1)} in queue</div>
            </div>
            <span className="ios-chev">
              <Icon name="chevron-right" size={13} />
            </span>
          </Link>
        ))}
      </div>
      <p className="ios-fn ios-sec" style={{ padding: "8px 32px 0" }}>
        {manuallyClosed
          ? "You closed this game, so nobody here is being moved in. Allow new players again and the next spot goes to whoever is first."
          : "If someone drops out, the person at the top is moved in automatically and told."}
      </p>
    </section>
  );
}
