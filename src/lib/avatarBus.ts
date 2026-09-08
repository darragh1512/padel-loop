"use client";

// A one-line broadcast for "this person's avatar just changed".
//
// The avatar shows in several places that each fetch it once on mount and
// keep it in their own state — the bottom nav's profile tab and the home
// dashboard's greeting, which sit in a different component tree from the
// profile screen where the change is actually made. Without a nudge they'd
// keep showing the old photo until the next navigation remounts them.
//
// This is deliberately a plain browser event rather than a context or a store:
// there's no other shared client state in the app, and one event keeps the
// change to the listeners that need it.

const AVATAR_CHANGED = "padel-loop:avatar-changed";

type AvatarChange = {
  userId: string;
  avatarUrl: string | null; // null = back to the generated DiceBear picture
};

/* Tell every listening screen that `userId` now has `avatarUrl`. */
export function publishAvatarChange(change: AvatarChange) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AvatarChange>(AVATAR_CHANGED, { detail: change }));
}

/* Listen for avatar changes. Returns an unsubscribe function, so callers can
   hand it straight back from a useEffect. */
export function onAvatarChange(handler: (change: AvatarChange) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<AvatarChange>).detail);
  window.addEventListener(AVATAR_CHANGED, listener);
  return () => window.removeEventListener(AVATAR_CHANGED, listener);
}
