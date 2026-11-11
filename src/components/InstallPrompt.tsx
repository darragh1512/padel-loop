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
//   • It stays off screens where it would cover something the person is in the
//     middle of: filling in a form, joining a game, writing a message. It waits
//     for the next screen with a tab bar.
//
// Whether the card is visible is DERIVED, not stored — the conditions are
// four separate facts arriving at four different times, and keeping a `show`
// flag in sync with all of them is how this kind of component ends up
// flashing on screen or appearing twice.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const DISMISSED_KEY = "padel-loop:install-prompt-dismissed";
const SHOW_AFTER_MS = 8000;
const NOT_ON = /^\/(login|signup|welcome|forgot-password|reset-password|create|games|groups|terms|privacy|support|admin)(\/|$)/;

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
  const pathname = usePathname();
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
  const show = !dismissed && ios !== null && (ios || deferred !== null) && !NOT_ON.test(pathname);
  if (!show) return null;

  return (
    <div className="ios-install" role="dialog" aria-label="Add Padel Loop to your Home Screen">
      <div className="ios-hl">Add Padel Loop to Your Home Screen</div>
      <div className="ios-fn ios-sec" style={{ marginTop: 2 }}>
        {ios
          ? "Opens full screen, like an app. No App Store needed."
          : "Opens full screen and loads faster. No App Store needed."}
      </div>

      {ios && (
        // Safari gives no install API, so this names the exact buttons.
        <ol className="ios-sh">
          <li>
            Tap <span className="ios-sb">Share</span> in Safari, the square with an arrow out of it.
          </li>
          <li>
            Scroll down and tap <span className="ios-sb">Add to Home Screen</span>.
          </li>
        </ol>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" className="ios-pill ios-press" style={{ border: 0, cursor: "pointer" }} onClick={dismiss}>
          {ios ? "Got It" : "Not Now"}
        </button>
        {!ios && deferred && (
          <button type="button" className="ios-pill ios-press" data-prominent style={{ border: 0, cursor: "pointer" }} onClick={install}>
            Add
          </button>
        )}
      </div>
    </div>
  );
}
