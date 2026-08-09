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
};

export const viewport: Viewport = {
  themeColor: "#0F1C3F",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {/* The app shell. Fluid to the viewport on phones (the prototype's
            402px frame is a canvas, not a constraint) and capped on wider
            screens so the design keeps its one-column reading measure.
            Bottom padding clears the fixed bottom navigation. */}
        <div className="mx-auto w-full max-w-md min-h-dvh relative pb-28">
          {children}
        </div>
      </body>
    </html>
  );
}
