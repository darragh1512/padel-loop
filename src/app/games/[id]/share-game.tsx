"use client";

// Share this game into a WhatsApp group.
//
// Visible to everyone who can see the game — including signed-out visitors,
// since a shared link that can't be re-shared dead-ends the chain that brought
// them here.
//
// Three tiers, best first:
//   1. navigator.share — the real OS share sheet, so WhatsApp is one tap away.
//      Phones only, and only over HTTPS from a user gesture.
//   2. clipboard.writeText — copy the link, say so.
//   3. A selectable field holding the URL, for browsers with neither.
//
// The link is the game's own URL. Nothing is minted, tracked or encoded: what
// gets pasted into the group is exactly what the sharer is looking at, which
// is also what makes it safe to forward on again.

import Icon from "@/components/ios/Icon";
import { capture } from "@/lib/analytics";

/* Is the OS share sheet available? navigator.share is typed as always
   present, so this checks the runtime object rather than the type. */
function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator;
}

// Built at tap time: the origin differs between localhost, a preview
// deployment and the live site, and only the browser knows which it is.
function gameUrl(gameId: string): string {
  return `${window.location.origin}/games/${gameId}`;
}

/* Copies the link. Tells the caller what happened: "copied", or the address
   to show when the phone won't allow copying. */
export async function copyGameLink(gameId: string): Promise<{ copied: true } | { url: string }> {
  const url = gameUrl(gameId);
  try {
    await navigator.clipboard.writeText(url);
    return { copied: true };
  } catch {
    return { url };
  }
}

export default function ShareGame({
  gameId,
  venue,
  when,
  onFallback,
}: {
  gameId: string;
  venue: string;
  // Already-formatted "Wed 10 Jun · 18:30" — the share text should read like
  // the message a person would have typed themselves.
  when: string;
  // Called when the share sheet isn't available and the link was copied instead.
  onFallback: (result: { copied: true } | { url: string }) => void;
}) {
  async function handleShare() {
    const url = gameUrl(gameId);
    const text = `Padel at ${venue}, ${when}. Spots going —`;

    // The other half of the growth loop: shares out, opens in. `method`
    // is a fixed enum, never the content of what was shared.
    capture("game_shared", {
      game_id: gameId,
      method: canNativeShare() ? "native" : "clipboard",
    });

    // 1. The native sheet.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Padel at ${venue}`, text, url });
        return;
      } catch (err) {
        // AbortError just means they backed out of the sheet — that isn't a
        // failure and must not fall through to copying a link they didn't ask
        // for. Anything else, fall through and try the clipboard.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    // 2 and 3. Copy it, or show it so it can be copied by hand.
    onFallback(await copyGameLink(gameId));
  }

  return (
    <button type="button" className="ios-gcap-i ios-press" aria-label="Share this game" onClick={handleShare}>
      <Icon name="share" size={24} />
    </button>
  );
}
