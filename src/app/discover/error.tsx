"use client";

import RouteError from "@/components/ios/RouteError";

export default function DiscoverError({ error, unstable_retry }: { error: Error; unstable_retry: () => void }) {
  return (
    <RouteError
      error={error}
      retry={unstable_retry}
      head={
        <header className="ios-nav">
          <h1 className="ios-lt">Discover</h1>
        </header>
      }
      title="Couldn’t Load Games"
      body="The games are still there. Check your connection and try again."
    />
  );
}
