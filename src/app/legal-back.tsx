"use client";

// The back control on Terms and Privacy.
//
// WHY THIS ISN'T JUST A LINK TO /profile: these pages are reached from two
// places. From settings, /profile is right. From the SIGN-UP screen, it is
// wrong twice over — a signed-out person is bounced to login, and the sign-up
// form they had half-filled is gone.
//
// In a browser tab none of that mattered: they would press the browser's back
// button and land where they were. In standalone there is no browser back, so
// this control is the only way out and has to be the right one.
//
// So: go back through history when there is history to go back through, and
// fall back to settings only when this page was opened cold (a shared link,
// or a restored tab).

import { useRouter } from "next/navigation";

export default function LegalBack() {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push("/profile");
        }
      }}
      className="pl-hit inline-flex text-papel/85 hover:text-papel rounded-pill transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lima"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M15 5l-7 7 7 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
