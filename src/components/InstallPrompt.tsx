"use client";

// "Add Padel Loop to your home screen" — shown once, and once only.
//
// TWO COMPLETELY DIFFERENT PLATFORMS:
//
//   Android / Chrome fires `beforeinstallprompt`, which can be caught, held,
//   and fired later from a button of our own. So there is a real Install
//   button that does the thing.
//
//   iOS Safari fires nothing. There is no API, and there never has been —
//   Add to Home Screen is a manual item in the Share sheet. So on iOS the
//   only honest thing to offer is instructions, and they have to name the
//   actual buttons or nobody finds them.
//
// NOT NAGGING, precisely:
//   • Never shown to somebody already running standalone — they installed it.
//   • Dismissed once = never shown again on that device. Not "in 30 days":
//     somebody who said no to this said no.
//   • Installed = never again either way.
//   • It waits a few seconds after load, so it is not the first thing that
//     happens to somebody who has just arrived.
//
// Whether the card is visible is DERIVED, not stored — the conditions are
// four separate facts arriving at four different times, and keeping a `show`
// flag in sync with all of them is how this kind of component ends up
// flashing on screen or appearing twice.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

const DISMISSED_KEY = "padel-loop:install-prompt-dismissed";
const SHOW_AFTER_MS = 8000;

// Chrome's event, which TypeScript does not know about.
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates the standard and uses its own flag.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function alreadyDismissed(): boolean {
  try {
    return Boolean(window.localStorage.getItem(DISMISSED_KEY));
  } catch {
    // Storage blocked. Treated as dismissed: we cannot remember a "no", and
    // asking on every single visit is worse than never asking.
    return true;
  }
}

function remember() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Nothing to do; see alreadyDismissed().
  }
}

export default function InstallPrompt() {
  // null until the timer has run — nothing is shown before then.
  const [ios, setIos] = useState<boolean | null>(null);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || alreadyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      // Stop Chrome's own mini-infobar; we show our own at a better moment.
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => {
      remember();
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // Let them look around first. Setting state from the timer rather than
    // the effect body is also what keeps this off React's cascading-render
    // path.
    const timer = window.setTimeout(() => setIos(isIos()), SHOW_AFTER_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    remember();
    setDismissed(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice; // accepted or not, we asked. Never ask again.
    setDeferred(null);
    dismiss();
  }

  // On iOS: show once the timer has run. Everywhere else: only once Chrome
  // has given us an event to fire, so the button can never do nothing.
  const show = !dismissed && ios !== null && (ios || deferred !== null);
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Add Padel Loop to your home screen"
      // Sits above the bottom nav, and clears the home indicator on a phone
      // with no bezel button.
      className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pointer-events-none"
    >
      <div className="mx-auto w-full max-w-md pl-card border-2 border-tinta shadow-poster p-4 pointer-events-auto pl-rise">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="rounded-card border-2 border-tinta shrink-0"
          />
          <div className="min-w-0">
            <p className="t-display text-display-xs text-tinta">
              Put it on your home screen
            </p>
            <p className="text-label font-medium text-tinta/70 mt-1">
              {ios
                ? "Opens full screen, like an app. No App Store needed."
                : "Opens full screen and loads faster. No App Store needed."}
            </p>
          </div>
        </div>

        {ios ? (
          // Safari gives no install API, so this names the exact buttons.
          <ol className="text-label font-medium text-tinta/75 mt-3 space-y-1 list-decimal pl-4">
            <li>
              Tap <span className="font-extrabold">Share</span> at the bottom of
              Safari — the square with an arrow out of it.
            </li>
            <li>
              Scroll down and tap{" "}
              <span className="font-extrabold">Add to Home Screen</span>.
            </li>
          </ol>
        ) : null}

        <div className="flex gap-2.5 mt-4">
          <Button variant="secondary" className="flex-1" onClick={dismiss}>
            {ios ? "Got it" : "Not now"}
          </Button>
          {!ios && deferred && (
            <Button className="flex-1" onClick={install}>
              Add it
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
