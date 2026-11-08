"use client";
// Connections (/connections): the people the signed-in player has connected
// with, plus a search for finding someone new. A failed read shows a retry, never
// "no connections", which would tell someone their friends are gone.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MessageCard, { TryAgain } from "@/components/ios/MessageCard";
import PageTitle from "@/components/ios/PageTitle";
import PlayerRow from "@/components/ios/PlayerRow";
import PlayerSearch from "@/components/PlayerSearch";
import { getSignedInUser } from "@/lib/session";
import { getConnections, type ConnectionProfile } from "../connections";

export default function ConnectionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [people, setPeople] = useState<ConnectionProfile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSignedInUser();
      const uid = data.user?.id ?? null;
      if (!uid) {
        router.replace("/login");
        return;
      }
      try {
        const connections = await getConnections(uid);
        if (!active) return;
        setPeople(connections);
        setFailed(false);
      } catch {
        if (!active) return;
        setFailed(true);
      }
      setUserId(uid);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router, attempt]);

  return (
    <main className="ios">
      <PageTitle title="Connections" fallback={userId ? `/players/${userId}` : "/"} />

      <PlayerSearch placeholder="Find a player by name">
        {loading ? (
          <div className="ios-skel" aria-hidden style={{ height: 200, margin: "16px 16px 0" }} />
        ) : failed ? (
          <MessageCard
            alert
            title="Couldn’t Load Your Connections"
            body="Your connections are safe. Check your connection and try again."
            action={
              <TryAgain
                onClick={() => {
                  setLoading(true);
                  setAttempt((n) => n + 1);
                }}
              />
            }
          />
        ) : people.length > 0 ? (
          <section style={{ marginTop: 16 }}>
            <div className="ios-sect">
              <h2 className="ios-t3">Your Connections</h2>
              <div className="ios-fn ios-sec">
                {people.length} {people.length === 1 ? "player" : "players"}
              </div>
            </div>
            <div className="ios-list">
              {people.map((person) => (
                <PlayerRow key={person.id} person={person} />
              ))}
            </div>
          </section>
        ) : (
          <MessageCard
            title="No Connections Yet"
            body="Search above for someone you’ve played with, then tap Connect on their profile."
          />
        )}
      </PlayerSearch>

      <div style={{ height: 16 }} />
      <BottomNav />
    </main>
  );
}
