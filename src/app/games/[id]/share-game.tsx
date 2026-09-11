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
//   3. A selectable input holding the URL, for browsers with neither.
//
// The link is the game's own URL. Nothing is minted, tracked or encoded: what
// gets pasted into the group is exactly what the sharer is looking at, which
// is also what makes it safe to forward on again.

import { useState } from "react";
import { capture } from "@/lib/analytics";

/* Is the OS share sheet available? navigator.share is typed as always
   present, so this checks the runtime object rather than the type. */
function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator;
}

export default function ShareGame({
  gameId,
  venue,
  when,
}: {
  gameId: string;
  venue: string;
  // Already-formatted "Wed 10 Jun · 18:30" — the share text should read like
  // the message a person would have typed themselves.
  when: string;
}) {
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  async function handleShare() {
    // Built at tap time: the origin differs between localhost, a preview
    // deployment and the live site, and only the browser knows which it is.
    const url = `${window.location.origin}/games/${gameId}`;
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

    // 2. Copy it.
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return;
    } catch {
      // 3. Show it, so it can be copied by hand.
      setFallbackUrl(url);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className="t-mono pl-press inline-flex items-center gap-2 text-micro tracking-[0.14em] text-papel/85 hover:text-papel border-2 border-papel/35 rounded-pill px-3.5 py-1.5 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden>
          <path
            d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 12.5V19h13v-6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {copied ? "Link copied" : "Share"}
      </button>

      {/* Last resort — no share sheet and no clipboard access. */}
      {fallbackUrl && (
        <input
          readOnly
          value={fallbackUrl}
          aria-label="Game link"
          onFocus={(e) => e.currentTarget.select()}
          className="w-full mt-2 pl-surface rounded-field px-3 py-2 text-label text-tinta outline-none"
        />
      )}
    </>
  );
}
