import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";
import "./globals.css";

// The three peña fonts, loaded via next/font and exposed as CSS variables
// that globals.css references (--font-archivo → font-sans,
// --font-archivo-black → font-display, --font-space-mono → font-mono).
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
});

// Archivo Black is a single-weight family — it IS the poster shout.
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-archivo-black",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Padel Loop",
  description: "Find and join a padel game near you, at your level.",

  // Home-screen icons. iOS ignores the manifest's icons array and reads
  // apple-touch-icon instead, so both have to be declared.
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
      { url: "/icons/apple-touch-icon-167.png", sizes: "167x167" },
      { url: "/icons/apple-touch-icon-152.png", sizes: "152x152" },
      { url: "/icons/apple-touch-icon-120.png", sizes: "120x120" },
    ],
  },

  // Next emits the standardised `mobile-web-app-capable`. Safari only
  // learned that name recently — iOS 16 and earlier still read Apple’s
  // original, and without it the app launches inside Safari chrome instead
  // of standalone. One tag, and it is the difference between this being an
  // installed app and a bookmark.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },

  appleWebApp: {
    capable: true, // launches without Safari chrome once added
    title: "Padel Loop",
    // The status bar sits ON the app, tinted to match — which is why the
    // top of every screen needs safe-area padding (see globals.css).
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1C3F",
  // WITHOUT THIS, every env(safe-area-inset-*) in the app resolves to 0.
  // The bottom nav already asks for that inset; until viewport-fit is
  // cover it was asking for nothing, and in standalone the nav would sit
  // under the home indicator.
  viewportFit: "cover",
  // Stops iOS zooming the page when a text field is focused, which in a
  // standalone app leaves the layout zoomed with no way to pinch back.
  maximumScale: 1,
  width: "device-width",
  initialScale: 1,
};

import AppleSplash from "@/components/AppleSplash";
import InstallPrompt from "@/components/InstallPrompt";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}
    >
      <head>
        <AppleSplash />
      </head>
      <body className="min-h-dvh antialiased">
        {/* The app shell. Fluid to the viewport on phones (the prototype's
            402px frame is a canvas, not a constraint) and capped on wider
            screens so the design keeps its one-column reading measure.
            Bottom padding clears the fixed bottom navigation. */}
        <div className="mx-auto w-full max-w-md min-h-dvh relative pb-28 pt-[env(safe-area-inset-top)]">
          {children}
        </div>
        <InstallPrompt />
      </body>
    </html>
  );
}
