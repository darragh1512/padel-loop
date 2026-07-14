// The logged-out landing page: what a visitor sees at "/" before they have an
// account. Calm, editorial, entirely on the token system — serif hero, one
// accent CTA, and three quiet product sections showing REAL screenshots of the
// app (captured from the live UI, stored in /public/landing). No gradients,
// no mock devices, no illustration.

import Image from "next/image";
import Link from "next/link";
import FadeUp from "@/components/FadeUp";
import { Wordmark } from "@/components/brand";

// One product section: a real screenshot framed in a surface card, with a
// serif heading and a short sans line beneath.
function ProductSection({
  src,
  alt,
  heading,
  body,
}: {
  src: string;
  alt: string;
  heading: string;
  body: string;
}) {
  return (
    <FadeUp className="mt-16">
      <section>
        <div className="pl-card overflow-hidden">
          <Image
            src={src}
            alt={alt}
            width={490}
            height={920}
            className="w-full h-auto"
          />
        </div>
        <h2 className="font-display text-[22px] tracking-tight leading-tight text-ink mt-5">
          {heading}
        </h2>
        <p className="text-[15px] text-ink-secondary mt-1.5 leading-relaxed">
          {body}
        </p>
      </section>
    </FadeUp>
  );
}

export default function Landing() {
  return (
    <main className="px-5 pt-8 pb-12">
      {/* Top bar — wordmark + a quiet log-in link. */}
      <header className="flex items-center justify-between">
        <div className="font-display text-[22px] leading-none tracking-tight text-ink">
          padel loop
        </div>
        <Link
          href="/login"
          className="text-[15px] font-medium text-ink-secondary"
        >
          Log in
        </Link>
      </header>

      {/* Hero — the serif moment. One accent CTA, nothing else shouting. */}
      <section className="mt-16">
        <h1 className="font-display text-[40px] tracking-tight leading-[1.1] text-ink">
          Your game,
          <br />
          on repeat.
        </h1>
        <p className="text-[15px] text-ink-secondary mt-4 leading-relaxed max-w-[34ch]">
          Find and join padel games near you, at your level. Set one up once —
          the Loop fills the slots.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center h-12 px-8 mt-7 bg-accent text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          Get started
        </Link>
      </section>

      {/* Product — three calm sections, real UI. */}
      <ProductSection
        src="/landing/discover.png"
        alt="The Discover screen: open games near you with level, area and time filters"
        heading="Find a game near you."
        body="Open games at your level, filtered by area and time. See who's playing, what it costs, and take a slot in one tap."
      />
      <ProductSection
        src="/landing/game.png"
        alt="A game page: court, time, level, the players and the cost split"
        heading="Everything in one place."
        body="Court, time, level, roster and the cost split — one page per game, shared with everyone in it, with its own group chat."
      />
      <ProductSection
        src="/landing/profile.png"
        alt="A player profile: skill level, connections, matches played and won"
        heading="Track your game."
        body="Log results after each match, confirm them as a group, and watch your played-and-won record build on your profile."
      />

      {/* Closing CTA. */}
      <FadeUp className="mt-16">
        <section className="text-center">
          <h2 className="font-display text-[28px] tracking-tight leading-tight text-ink">
            Ready to play?
          </h2>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center h-12 px-8 mt-5 bg-accent text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Create your account
          </Link>
        </section>
      </FadeUp>

      {/* Footer — minimal. */}
      <footer className="mt-20 pt-6 border-t border-line">
        <Wordmark tagline="Find and join a padel game near you." />
        <nav className="flex gap-5 mt-5 text-[13px] text-ink-secondary">
          <Link href="/login">Log in</Link>
          <Link href="/signup">Sign up</Link>
          <Link href="/discover">Browse games</Link>
        </nav>
        <p className="text-[13px] text-ink-faint mt-5">
          © {new Date().getFullYear()} Padel Loop
        </p>
      </footer>
    </main>
  );
}
