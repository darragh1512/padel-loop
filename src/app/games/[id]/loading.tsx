"use client";

// The Game Page's shape while its details load. The court carries the same name as
// the one on Home and in the real header, so it still flies up on a slow connection.
// It's drawn with no spots, because nothing is known yet and empty spots would read
// as a game with places open.

import { ViewTransition } from "react";
import { useParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Court from "@/components/ios/Court";

export default function GameLoading() {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="ios" aria-busy="true">
      <div className="ios-game-head">
        <ViewTransition name={`game-court-${id}`} share="court-morph" default="none">
          <div className="ios-court-blank">
            <Court spots={[null, null, null, null]} big radius={6} label="Loading this game" />
          </div>
        </ViewTransition>
      </div>
      <div aria-hidden>
        <div className="ios-skel" style={{ width: 220, height: 28, borderRadius: 14, margin: "20px 20px 0" }} />
        <div className="ios-skel" style={{ width: 150, height: 18, borderRadius: 9, margin: "10px 20px 0" }} />
        <div className="ios-skel" style={{ height: 180, margin: "20px 16px 0" }} />
        <div className="ios-skel" style={{ height: 180, margin: "16px 16px 0" }} />
      </div>
      <BottomNav />
    </main>
  );
}
