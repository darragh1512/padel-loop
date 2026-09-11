"use client";

// Three states, kept apart.
//
// THE PROBLEM THIS EXISTS TO FIX: nearly every read in this app logs its error
// and returns an empty array, so by the time a screen renders it cannot tell
// "nobody has posted a game" from "the request failed". Both arrive as `[]`,
// and the screen says "the board is empty" either way — telling somebody the
// Loop is dead when the network merely blinked.
//
// So the loaders passed in here THROW on failure instead of returning empty,
// and this hook turns that into a state a screen can branch on. The rule for
// any data function used with it: return data, or throw. Never return empty to
// mean broken.

import { useCallback, useEffect, useState } from "react";

export type Loadable<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error" };

export function useLoadable<T>(
  load: () => Promise<T>,
  // Same contract as useEffect's dependency array: re-run when these change.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: any[],
): Loadable<T> & { retry: () => void } {
  const [state, setState] = useState<Loadable<T>>({ status: "loading" });
  // Bumped by retry() to re-run the effect without changing the real deps.
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await load();
        if (active) setState({ status: "ready", data });
      } catch {
        // The loader already logged the detail. What matters here is only
        // that this is a FAILURE and must not be drawn as emptiness.
        if (active) setState({ status: "error" });
      }
    })();
    return () => {
      active = false;
    };
    // `load` is intentionally not a dependency: callers pass an inline
    // closure, which would be a new function on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { ...state, retry };
}

/* Thrown by a read that failed. Carries nothing a screen needs — the point is
   only that it is distinguishable from an empty result. */
export class DataError extends Error {
  constructor(what: string, cause?: string) {
    super(cause ? `${what}: ${cause}` : what);
    this.name = "DataError";
  }
}
