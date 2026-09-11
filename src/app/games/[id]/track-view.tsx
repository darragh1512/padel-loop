"use client";

// Fires game_viewed, and shared_link_opened when the visit came from outside
// the app.
//
// HOW A SHARED-LINK OPEN IS DETECTED: document.referrer is empty or points at
// another origin. That is what a tap from a WhatsApp thread looks like —
// there is no in-app navigation behind it. Someone moving from Discover to a
// game has this app as the referrer and is not counted.
//
// It is a signal, not a measurement: a referrer can be stripped by the
// browser, and some in-app webviews send none at all. It will undercount
// in-app navigations as shares in those cases. Good enough to see whether the
// growth mechanic works; not good enough to bill anyone on.

import { useEffect, useRef } from "react";
import { capture } from "@/lib/analytics";

export default function TrackGameView({ gameId }: { gameId: string }) {
  // React runs effects twice in development; this keeps one view one event.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    let external = false;
    try {
      const ref = document.referrer;
      external = !ref || new URL(ref).origin !== window.location.origin;
    } catch {
      external = true;
    }

    // game_id only. Not the venue, not the time, not who is playing.
    capture("game_viewed", { game_id: gameId, from_external_link: external });

    if (external) {
      capture("shared_link_opened", { game_id: gameId });
    }
  }, [gameId]);

  return null;
}
