// The logged-out landing page: what a visitor sees at "/" before they have an
// account. THE PEÑA, straight from design-lab/landing-pena.html: the club
// corkboard as a page. A big match poster (GAME ON?), the ticket-stub CTA,
// the marquee tape, three stapled screenshots of the real app, the spinning
// club stamp, and one loud naranja closing poster. All CTAs → /signup or
// /login, exactly as before.

import Image from "next/image";
import Link from "next/link";
import FadeUp from "@/components/FadeUp";
import { ClubStamp } from "@/components/brand";

// One product section: a real screenshot pinned up like a polaroid from the
// board, with a paso label and a short line beneath.
function ProductSection({
  src,
  alt,
  paso,
  heading,
  body,
  tilt,
}: {
  src: string;
  alt: string;
  paso: string;
  heading: string;
  body: string;
  tilt: string;
}) {
  return (
    <FadeUp className="mt-14">
      <section>
        <div className={`pl-card pena-staples ${tilt} overflow-hidden p-3 pt-6 pb-4`}>
          <Image
            src={src}
            alt={alt}
            width={490}
            height={920}
            className="w-full h-auto rounded-[3px]"
          />
        </div>
        <p className="t-mono text-micro text-lima mt-6">{paso}</p>
        <h2 className="t-display text-display-sm text-papel mt-2">{heading}</h2>
        <p className="text-body font-medium text-papel/85 mt-2 leading-relaxed">
          {body}
        </p>
      </section>
    </FadeUp>
  );
}

export default function Landing() {
  return (
    <main className="px-5 pt-6 pb-12">
      {/* Top banner — the club line + a quiet log-in pill. */}
      <header className="flex items-center justify-between gap-3">
        <div className="t-mono text-micro text-papel">
          Padel Loop · Dublin
        </div>
        <Link
          href="/login"
          className="t-mono text-[10px] tracking-[0.14em] text-tinta bg-lima border-2 border-tinta rounded-pill px-4 py-2 pena-riso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papel"
        >
          Log in
        </Link>
      </header>

      {/* Hero — the big match poster. */}
      <FadeUp className="mt-8">
        <section className="pl-card pena-staples pena-tilt-a px-6 pt-9 pb-7 text-center">
          <p className="t-mono text-micro tracking-[0.22em] text-naranja-d">
            Dublin · every night this summer
          </p>
          <h1 className="t-display text-display-xl text-tinta mt-3.5">
            Game <span className="text-naranja">o</span>n?
          </h1>
          <p className="text-body font-medium text-tinta mt-4 max-w-[38ch] mx-auto leading-relaxed">
            Padel Loop finds you a padel game{" "}
            <b className="font-extrabold">near you, at your level</b> — real
            games, real open spots, and your name on the roster in{" "}
            <b className="font-extrabold">one tap</b>. No more group-chat
            roulette.
          </p>
          {/* The venue strip — full-bleed naranja band, the poster's CTA. */}
          <Link
            href="/signup"
            className="t-mono -mx-6 mt-6 px-6 py-3.5 flex justify-between items-center gap-2 bg-naranja hover:bg-naranja-d text-papel text-micro tracking-[0.12em] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-papel"
          >
            <span>Get started</span>
            <span>Free · No install →</span>
          </Link>
          <div className="flex justify-center gap-2 mt-5 flex-wrap" aria-hidden>
            {["Darragh", "Sofía", "Marco"].map((n) => (
              <span
                key={n}
                className="text-label font-medium text-tinta border-[1.5px] border-tinta rounded-pill px-3 py-1"
              >
                {n}
              </span>
            ))}
            <span className="text-label font-extrabold text-naranja-d border-[1.5px] border-dashed border-naranja rounded-pill px-3 py-1">
              + you?
            </span>
          </div>
        </section>
      </FadeUp>

      {/* The ticket stub — admit one. */}
      <FadeUp className="mt-6">
        <Link
          href="/signup"
          aria-label="Your spot is waiting — create an account to claim it"
          className="pena-tilt-c flex drop-shadow-[0_12px_22px_rgb(8_20_50_/_0.55)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lima"
        >
          <span className="flex-1 bg-lima text-tinta border-2 border-r-0 border-tinta rounded-l-[4px] px-4 py-3.5">
            <span className="t-mono block text-[9px] tracking-[0.24em]">
              Admit one · tonight
            </span>
            <span className="t-display block text-display-xs mt-1.5">
              Your spot&rsquo;s waiting
            </span>
            <span className="t-mono block text-[9px] tracking-[0.12em] mt-1.5 font-normal">
              NEAR YOU · AT YOUR LEVEL · ONE TAP
            </span>
          </span>
          <span className="w-21 bg-papel text-tinta border-2 border-tinta rounded-r-[4px] [border-left-style:dashed] flex flex-col items-center justify-center gap-1 px-2 py-3">
            <span className="t-display text-display-xs">FREE</span>
            <span
              aria-hidden
              className="w-12 h-6 [background:repeating-linear-gradient(90deg,var(--color-tinta)_0_2px,transparent_2px_4px,var(--color-tinta)_4px_7px,transparent_7px_9px)]"
            />
            <span className="t-mono text-[8px] tracking-[0.14em] font-normal">No. 0001</span>
          </span>
        </Link>
      </FadeUp>

      {/* The marquee tape — tonight's board, in motion. */}
      <div className="pena-cinta -mx-5 mt-10" aria-hidden>
        <div className="run">
          <span>TONIGHT — CLONTARF <b>19:00</b> · 2 SPOTS</span>
          <span>SANDYFORD <b>20:00</b> · 1 SPOT</span>
          <span>BUSHY PARK <b>21:00</b> · 3 SPOTS</span>
          <span>MALAHIDE <b>19:30</b> · 1 SPOT</span>
          <span>TONIGHT — CLONTARF <b>19:00</b> · 2 SPOTS</span>
          <span>SANDYFORD <b>20:00</b> · 1 SPOT</span>
          <span>BUSHY PARK <b>21:00</b> · 3 SPOTS</span>
          <span>MALAHIDE <b>19:30</b> · 1 SPOT</span>
        </div>
      </div>

      {/* From the board to the court — the real app, pinned up. */}
      <FadeUp className="mt-14">
        <h2 className="t-display text-display-md text-papel text-center">
          From the board
          <br />t<span className="text-lima">o</span> the court
        </h2>
        <p className="t-mono text-micro text-papel/85 text-center mt-3">
          How it works · three moves
        </p>
      </FadeUp>

      <ProductSection
        src="/landing/discover.png"
        alt="The Discover screen: open games near you with level, area and time filters"
        paso="Paso 1 · Open the app"
        heading="Find a game near you."
        body="Open games at your level, filtered by area and time. The board's always fresh — if it says one spot open, it's really open."
        tilt="pena-tilt-b"
      />
      <ProductSection
        src="/landing/game.png"
        alt="A game page: court, time, level, the players and the cost split"
        paso="Paso 2 · Pick a poster"
        heading="Everything in one place."
        body="Court, time, level, roster and the cost split — one poster per game, shared with everyone in it, with its own group chat."
        tilt="pena-tilt-a"
      />
      <ProductSection
        src="/landing/profile.png"
        alt="A player profile: skill level, connections, matches played and won"
        paso="Paso 3 · Count me in"
        heading="Track your game."
        body="Log results after each match, confirm them as a group, and watch your played-and-won record build on your profile."
        tilt="pena-tilt-b"
      />

      {/* The organiser line + the club stamp. */}
      <FadeUp className="mt-14">
        <section className="pl-card pena-staples pena-tilt-c p-6 pt-8 flex items-center gap-5">
          <div className="flex-1">
            <h2 className="t-display text-display-sm text-tinta">
              Set it up once. The Loop fills the sl<span className="text-naranja">o</span>ts.
            </h2>
            <p className="text-label font-medium text-tinta/80 mt-2.5 leading-relaxed">
              Running the game? Pin it to the board and the open spots fill
              themselves — <b className="font-extrabold">no more chasing the group chat for a fourth</b>.
            </p>
          </div>
          <div className="text-tinta shrink-0" aria-hidden>
            <ClubStamp size={96} />
          </div>
        </section>
      </FadeUp>

      {/* Closing poster — loud, naranja, one job. */}
      <FadeUp className="mt-14">
        <Link
          href="/signup"
          className="pena-tilt-a block rounded-card bg-naranja text-papel text-center px-6 py-10 shadow-poster relative overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lima"
        >
          <span
            aria-hidden
            className="absolute inset-0 [background:radial-gradient(rgb(25_20_7_/_0.07)_1px,transparent_1.2px)_0_0/9px_9px] pointer-events-none"
          />
          <span className="t-mono block text-micro tracking-[0.24em]">
            The board is live · Dublin
          </span>
          <span className="t-display block text-display-lg mt-3">
            See wh<span className="text-lima">o</span>&rsquo;s playing tonight
          </span>
          <span className="t-mono inline-block mt-6 text-label tracking-[0.14em] text-tinta bg-lima border-[3px] border-tinta rounded-pill px-6 py-3.5 shadow-[4px_4px_0_var(--color-tinta)]">
            Create your account →
          </span>
        </Link>
      </FadeUp>

      {/* Footer — the printed club line. */}
      <footer className="mt-16 pt-5 border-t-[3px] border-papel/25">
        <div className="t-mono flex items-center justify-between gap-3 flex-wrap text-[10px] tracking-[0.16em] text-papel/80">
          <span>PADEL LOOP · LA PEÑA · EST. 2026</span>
        </div>
        <nav className="t-mono flex gap-5 mt-4 text-[10px] tracking-[0.14em]">
          <Link href="/login" className="text-lima">Log in</Link>
          <Link href="/signup" className="text-lima">Sign up</Link>
          <Link href="/discover" className="text-lima">Browse games</Link>
        </nav>
        <p className="t-mono text-[10px] tracking-[0.14em] text-papel/60 mt-4">
          © {new Date().getFullYear()} Padel Loop
        </p>
      </footer>
    </main>
  );
}
