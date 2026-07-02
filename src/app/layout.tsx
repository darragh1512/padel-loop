import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Instrument_Sans } from "next/font/google";
import "./globals.css";

// The two brand fonts, loaded via next/font and exposed as CSS variables that
// globals.css references (--font-instrument-serif → font-display,
// --font-instrument-sans → font-sans). The serif ships in regular weight only —
// exactly the design intent (titles are never bold or all-caps).
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument-sans",
});

export const metadata: Metadata = {
  title: "Padel Loop",
  description: "Find and join a padel game near you, at your level.",
};

export const viewport: Viewport = {
  themeColor: "#FAF8F3",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${instrumentSans.variable}`}>
      <body className="min-h-dvh bg-bone text-ink antialiased">
        {/* The phone-width app shell. Bottom padding leaves room for the fixed
            bottom navigation that the design's screens render. */}
        <div className="mx-auto max-w-md min-h-dvh relative pb-24">
          {children}
        </div>
      </body>
    </html>
  );
}
