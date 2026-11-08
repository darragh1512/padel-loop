// Lets the game page say "Game Posted" when it opens straight after Post, and
// only then: the note is read once and cleared, so going back to the page later,
// or reloading it, shows nothing.
//
// Kept in this visit's storage rather than the web address, so a shared or
// reloaded link never carries it.

const KEY = "just-posted-game";

export function markJustPosted(gameId: string) {
  try {
    sessionStorage.setItem(KEY, gameId);
  } catch {
    // Private browsing can refuse this. The game still posts; only the note is lost.
  }
}

export function takeJustPosted(gameId: string): boolean {
  try {
    if (sessionStorage.getItem(KEY) !== gameId) return false;
    sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
