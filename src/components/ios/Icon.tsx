// The app's icons, drawn here as our own artwork to match the shapes in the
// mockups. Apple's SF Symbols can't be shipped in a web app, so these stand in.

import { useId } from "react";

export type IconName =
  | "house"
  | "search"
  | "chat"
  | "person"
  | "bell"
  | "plus"
  | "minus"
  | "directions"
  | "mic"
  | "chevron-down"
  | "chevron-right"
  | "updown"
  | "calendar"
  | "court"
  | "chevron-left"
  | "share"
  | "ellipsis"
  | "clock"
  | "pin"
  | "level"
  | "euro"
  | "repeat"
  | "check"
  | "clear";

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
    case "mic":
      return (
        <svg {...common}>
          <rect x="8.2" y="1.8" width="7.6" height="13.4" rx="3.8" fill="currentColor" />
          <path
            d="M4.9 11.2c0 4.1 3.1 7.1 7.1 7.1s7.1-3 7.1-7.1M12 18.3v3.4M8.7 21.8h6.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8.5l8 8 8-8" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 4l8 8-8 8" />
        </svg>
      );
    case "updown":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 9l5-5.5L17 9M7 15l5 5.5 5-5.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="2.2" y="3" width="19.6" height="18.4" rx="3.6" fill="currentColor" />
          <rect x="4.3" y="8.2" width="15.4" height="11.1" rx="1.5" fill="var(--ios-card)" />
          <g fill="currentColor">
            <rect x="9.9" y="10" width="1.9" height="1.9" rx=".4" />
            <rect x="13" y="10" width="1.9" height="1.9" rx=".4" />
            <rect x="16.1" y="10" width="1.9" height="1.9" rx=".4" />
            <rect x="6.2" y="13" width="1.9" height="1.9" rx=".4" />
            <rect x="9.9" y="13" width="1.9" height="1.9" rx=".4" />
            <rect x="13" y="13" width="1.9" height="1.9" rx=".4" />
            <rect x="16.1" y="13" width="1.9" height="1.9" rx=".4" />
            <rect x="6.2" y="16" width="1.9" height="1.9" rx=".4" />
            <rect x="9.9" y="16" width="1.9" height="1.9" rx=".4" />
            <rect x="13" y="16" width="1.9" height="1.9" rx=".4" />
          </g>
        </svg>
      );
    case "court":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2.4" />
          <path d="M12 5v14M6.4 5v14M17.6 5v14M6.4 12h11.2" strokeWidth="1.5" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 3.5 7.5 12l8.5 8.5" />
        </svg>
      );
    case "share":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.4 9.2H7.2A2.2 2.2 0 0 0 5 11.4v8.2a2.2 2.2 0 0 0 2.2 2.2h9.6a2.2 2.2 0 0 0 2.2-2.2v-8.2a2.2 2.2 0 0 0-2.2-2.2h-1.2M12 15V2.4M8.4 5.6 12 2.2l3.6 3.4" />
        </svg>
      );
    case "ellipsis":
      return (
        <svg {...common} fill="currentColor">
          <circle cx="5.2" cy="12" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="18.8" cy="12" r="1.9" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common} fill="currentColor">
          <path
            fillRule="evenodd"
            d="M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8zm.9 3.9v6.4H7.4v-1.8h3.7V6.5z"
          />
        </svg>
      );
    case "pin":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2a3.9 3.9 0 0 0-1 7.67V20.6a1 1 0 0 0 2 0V9.67A3.9 3.9 0 0 0 12 2z" />
        </svg>
      );
    case "level":
      return (
        <svg {...common} fill="currentColor">
          <rect x="0.8" y="9.8" width="6.6" height="10" rx="1.7" />
          <rect x="8.7" y="7.4" width="6.6" height="12.4" rx="1.7" />
          <rect x="16.6" y="4.2" width="6.6" height="15.6" rx="1.7" />
        </svg>
      );
    case "euro":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.4" fill="currentColor" />
          <path
            d="M15.4 8.5a3.9 3.9 0 0 0-6.2 3.5 3.9 3.9 0 0 0 6.2 3.5M7.6 10.8h5.2M7.6 13.2h4.6"
            fill="none"
            stroke="var(--ios-card)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "repeat":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 11V9.5a3 3 0 0 1 3-3h13M16.5 3l3.5 3.5-3.5 3.5M20.5 13v1.5a3 3 0 0 1-3 3h-13M7.5 21 4 17.5 7.5 14" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l5.5 5.5L20 6.5" />
        </svg>
      );
    case "clear":
      return (
        <svg {...common} fill="currentColor">
          <path
            fillRule="evenodd"
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8.6 7.4 12 10.8l3.4-3.4 1.2 1.2-3.4 3.4 3.4 3.4-1.2 1.2-3.4-3.4-3.4 3.4-1.2-1.2 3.4-3.4-3.4-3.4z"
          />
        </svg>
      );
    case "minus":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 12h16" />
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
