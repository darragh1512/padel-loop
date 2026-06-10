import type { Metadata, Viewport } from "next";
import { Unbounded, DM_Sans } from "next/font/google";
import "./globals.css";

// The two brand fonts, loaded via next/font and exposed as CSS variables that
// globals.css references (--font-unbounded → font-display, --font-dm-sans → font-sans).
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-unbounded",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Padel Loop",
  description: "Find and join a padel game near you, at your level.",
};

export const viewport: Viewport = {
  themeColor: "#080e1f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${unbounded.variable} ${dmSans.variable}`}>
      <body className="min-h-dvh bg-navy text-white antialiased">
        {/* The phone-width app shell. Bottom padding leaves room for the fixed
            bottom navigation that the design's screens render. */}
        <div className="mx-auto max-w-md min-h-dvh relative pb-24">
          {children}
        </div>
      </body>
    </html>
  );
}
