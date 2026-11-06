"use client";

import PageTitle from "@/components/ios/PageTitle";
import RouteError from "@/components/ios/RouteError";

export default function GameError({ error, unstable_retry }: { error: Error; unstable_retry: () => void }) {
  return (
    <RouteError
      error={error}
      retry={unstable_retry}
      head={<PageTitle title="Game" fallback="/discover" />}
      title="Couldn’t Load This Game"
      body="The game is still there. Check your connection and try again."
    />
  );
}
