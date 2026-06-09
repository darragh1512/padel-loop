import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import AuthStatus from "./auth-status";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Padel Loop",
  description: "Find and join a padel game near you, at your level.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {/* A thin bar across the top of every page. On the left, the app name
            (links home). On the right, the login/logout area. */}
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-3">
            <Link href="/" className="font-bold text-emerald-700">
              Padel Loop
            </Link>
            <AuthStatus />
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
