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

export function previousPath(): string | null {
  return previous;
}
