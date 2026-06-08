"use client";
// The line above means: this little piece runs in the visitor's browser,
// so it can react to taps. (Most of our screens don't need this, but a
// button that responds to a click does.)

import { useState } from "react";

export default function JoinButton() {
  // "joined" remembers whether the button has been tapped yet.
  // It starts as false (not joined). Tapping it flips it to true.
  const [joined, setJoined] = useState(false);

  if (joined) {
    // After tapping, show a confirmation instead of the button.
    return (
      <div className="rounded-xl bg-emerald-100 px-5 py-3 text-center font-medium text-emerald-700">
        ✓ You&apos;re in! See you on court.
      </div>
    );
  }

  return (
    <button
      onClick={() => setJoined(true)}
      className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
    >
      Join this game
    </button>
  );
}
