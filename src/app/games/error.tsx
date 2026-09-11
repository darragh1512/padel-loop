"use client";

// Route-level failure boundary. The server render threw — a database read that
// did not come back, most likely — so this stands in for the page.
//
// It says the loading FAILED. It deliberately does not say the board is empty,
// because we do not know that: an errored fetch and an empty one look
// identical once the data is gone, and only one of them means "there are no
// games". Getting this wrong tells somebody the Loop is dead when the network
// merely blinked.

import { useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { ErrorState } from "@/components/ui";

export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="px-5 pt-6 relative">
      <div className="mt-10">
        <ErrorState
          title="Couldn't load the board."
          body="That's on us, not you — the games are still there. Give it another go."
          onRetry={unstable_retry}
        />
      </div>
      <BottomNav />
    </main>
  );
}
