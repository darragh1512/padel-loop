// Remembers the previous screen during this visit, so a Back button knows
// whether there's somewhere in the app to go back to. Someone arriving from a
// shared link has none, and Back must not take them out of the app.

let current: string | null = null;
let previous: string | null = null;

export function recordPath(path: string) {
  if (path === current) return;
  previous = current;
  current = path;
}

// The last screen with a tab bar. From a screen without one, such as a
// conversation, this is where the person came from.
export function lastPath(): string | null {
  return current;
}

export function previousPath(): string | null {
  return previous;
}
