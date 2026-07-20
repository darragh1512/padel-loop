import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Space_Mono } from "next/font/google";
import { CourtPaint } from "@/components/brand";
import "./globals.css";

// The two peña fonts, loaded via next/font and exposed as CSS variables that
// globals.css references (--font-bricolage → font-sans/font-display,
// --font-space-mono → font-mono). Bricolage loads as a variable font with the
// opsz + wdth axes so .t-display can condense it (font-stretch: 90%).
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-bricolage",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Padel Loop",
  description: "Find and join a padel game near you, at your level.",
};

export const viewport: Viewport = {
  themeColor: "#14459A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${spaceMono.variable}`}>
      <body className="min-h-dvh antialiased">
        {/* The painted court lines across the whole wall, behind everything. */}
        <CourtPaint />
        {/* The phone-width app shell. Bottom padding leaves room for the fixed
            bottom navigation that the design's screens render. */}
        <div className="mx-auto max-w-md min-h-dvh relative pb-24">
          {children}
        </div>
      </body>
    </html>
  );
}
