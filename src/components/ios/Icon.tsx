// The app's icons, drawn here as our own artwork to match the shapes in the
// mockups. Apple's SF Symbols can't be shipped in a web app, so these stand in.

import { useId } from "react";

export type IconName = "house" | "search" | "chat" | "person" | "bell" | "plus" | "directions";

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const maskId = useId();
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    style: { display: "block", flex: "none" },
  } as const;

  switch (name) {
    case "house":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2.9a1.3 1.3 0 0 0-.86.32L1.75 11.5a.95.95 0 0 0 .63 1.66H4.3v6.9a1.75 1.75 0 0 0 1.75 1.75h3.55v-5.45a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v5.45h3.55a1.75 1.75 0 0 0 1.75-1.75v-6.9h1.92a.95.95 0 0 0 .63-1.66l-3.05-2.7V4.9a.75.75 0 0 0-.75-.75h-1.2a.75.75 0 0 0-.75.75v.72l-3.64-2.4A1.3 1.3 0 0 0 12 2.9z" />
        </svg>
      );
    case "search":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="10.4" cy="10.4" r="7" />
          <path d="M15.6 15.6l5.6 5.6" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 3.2c-5.8 0-10.5 3.7-10.5 8.3 0 2.7 1.6 5.1 4.1 6.6-.2 1-.9 2-1.9 2.8-.3.3-.1.8.3.8 2 0 3.8-.7 5.2-1.9.9.2 1.8.3 2.8.3 5.8 0 10.5-3.7 10.5-8.6S17.8 3.2 12 3.2z" />
        </svg>
      );
    case "person":
      return (
        <svg {...common} fill="currentColor">
          <path
            fillRule="evenodd"
            d="M12 1.6a10.4 10.4 0 1 0 0 20.8 10.4 10.4 0 0 0 0-20.8zm0 4.1a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8zm0 14.7a8.4 8.4 0 0 1-6.2-2.74c1.2-2.05 3.5-3.26 6.2-3.26s5 1.2 6.2 3.26A8.4 8.4 0 0 1 12 20.4z"
          />
        </svg>
      );
    case "bell":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2.2a1.7 1.7 0 0 0-1.7 1.7v.45C7.2 5.1 5.3 7.7 5.3 11c0 3.3-.75 4.75-1.95 6-.55.58-.15 1.5.65 1.5h16c.8 0 1.2-.92.65-1.5-1.2-1.25-1.95-2.7-1.95-6 0-3.3-1.9-5.9-5-6.65V3.9A1.7 1.7 0 0 0 12 2.2zM9.2 19.9a2.9 2.9 0 0 0 5.6 0z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 4v16M4 12h16" />
        </svg>
      );
    case "directions":
      return (
        <svg {...common}>
          <mask id={maskId}>
            <rect width="24" height="24" fill="#fff" />
            <path
              d="M8.7 15.8v-2.6a2.2 2.2 0 0 1 2.2-2.2h4.4M13.1 8.6l2.4 2.4-2.4 2.4"
              fill="none"
              stroke="#000"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </mask>
          <rect
            x="4.2"
            y="4.2"
            width="15.6"
            height="15.6"
            rx="3"
            transform="rotate(45 12 12)"
            fill="currentColor"
            mask={`url(#${maskId})`}
          />
        </svg>
      );
  }
}
