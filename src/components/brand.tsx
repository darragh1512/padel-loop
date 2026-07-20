/* Brand-signature SVG components, all in the peña voice (see DESIGN.md):
   the painted court lines on the wall, the rubber-stamp crest, the court
   hero, the dashed loop arc, and the PADEL LOOP wordmark. Flat riso print —
   papel/tinta/naranja/lima only, no gradients. */

/* The painted court lines across the whole wall — fixed behind everything.
   Three slightly-skewed papel strokes at low alpha, exactly as on the
   landing wall. Decorative only. */
export function CourtPaint() {
  return (
    <svg
      aria-hidden
      className="fixed inset-0 w-full h-full pointer-events-none opacity-55"
      viewBox="0 0 420 900"
      preserveAspectRatio="none"
    >
      <g stroke="rgb(243 233 210 / .16)" strokeWidth="3" fill="none">
        <line x1="0" y1="210" x2="420" y2="196" />
        <line x1="210" y1="0" x2="214" y2="900" />
        <line x1="0" y1="620" x2="420" y2="640" />
      </g>
    </svg>
  );
}

/* The club's rubber stamp — double ring, mono textPath, the dashed loop
   scribble ending in the ball. Spins slowly via .pena-stamp (reduced motion:
   static). Colour comes from currentColor so it stamps in tinta on papel and
   in papel on the wall. */
export function ClubStamp({ size = 118 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
      className="pena-stamp opacity-90"
      style={{ width: size, height: size }}
    >
      <defs>
        <path id="pena-ring" d="M60 12 a48 48 0 1 1 -0.01 0" />
      </defs>
      <circle cx="60" cy="60" r="56" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="40" stroke="currentColor" strokeWidth="1.5" />
      <text
        fontFamily="var(--font-mono), monospace"
        fontSize="10.5"
        fontWeight="700"
        letterSpacing="3.5"
        fill="currentColor"
      >
        <textPath href="#pena-ring">
          PADEL LOOP · EST. 2026 · LA PEÑA · DUBLIN ·
        </textPath>
      </text>
      <path
        d="M45 72 C52 48 68 46 76 52 C84 58 78 72 64 70 C52 68 52 56 62 54"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      <circle cx="62" cy="54" r="4" fill="currentColor" />
    </svg>
  );
}

/* The court from above, painted on a pista-blue poster: papel court lines and
   the naranja loop scribble ending in a lima ball. The game page's hero. */
export function CourtHero() {
  return (
    <div className="mt-4 h-38 rounded-card relative overflow-hidden bg-pista border-2 border-tinta shadow-sheet">
      <svg viewBox="0 0 346 150" fill="none" className="absolute inset-0 w-full h-full">
        <rect x="38" y="18" width="270" height="114" rx="6" stroke="var(--color-papel)" strokeOpacity=".55" strokeWidth="2" />
        <line x1="173" y1="18" x2="173" y2="132" stroke="var(--color-papel)" strokeOpacity=".55" strokeWidth="2" />
        <line x1="106" y1="18" x2="106" y2="132" stroke="var(--color-papel)" strokeOpacity=".25" strokeWidth="1.5" />
        <line x1="240" y1="18" x2="240" y2="132" stroke="var(--color-papel)" strokeOpacity=".25" strokeWidth="1.5" />
        <line x1="38" y1="75" x2="106" y2="75" stroke="var(--color-papel)" strokeOpacity=".25" strokeWidth="1.5" />
        <line x1="240" y1="75" x2="308" y2="75" stroke="var(--color-papel)" strokeOpacity=".25" strokeWidth="1.5" />
        <path
          d="M 230 95 C 250 30, 190 8, 150 30 C 116 50, 124 92, 158 88 C 190 84, 204 48, 180 36"
          stroke="var(--color-naranja)"
          strokeWidth="3"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
        <circle cx="180" cy="36" r="8" fill="var(--color-lima)" stroke="var(--color-tinta)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/* Loop arc wrapping an element — the level ring on Profile. Naranja dashed
   arc, papel face, tinta initials. */
export function LoopRing({
  size = 74,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 74 74" className="absolute inset-0 w-full h-full text-naranja">
        <path
          d="M 37 4 A 33 33 0 1 1 10 20"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />
        <circle cx="10" cy="20" r="5.5" fill="var(--color-lima)" stroke="var(--color-tinta)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-1.5 rounded-pill bg-papel border-2 border-tinta text-tinta flex items-center justify-center t-display text-display-sm">
        {children}
      </div>
    </div>
  );
}

export function MiniLoop({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 34 34" fill="none" className="text-naranja" style={{ width: size, height: size }}>
      <path
        d="M 17 3 A 14 14 0 1 1 5.5 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="3.5 2.5"
        strokeLinecap="round"
      />
      <circle cx="5.5" cy="10" r="3.5" fill="var(--color-lima)" stroke="var(--color-tinta)" strokeWidth="1" />
    </svg>
  );
}

/* The PADEL LOOP wordmark + tagline — the poster shout with the naranja "o"
   (colour inherits, so it works in tinta on papel and papel on the wall).
   Used on the auth screens and the landing page. */
export function Wordmark({ tagline }: { tagline?: string }) {
  return (
    <div>
      <div className="t-display text-display-lg leading-none">
        Padel l<span className="text-naranja">o</span>op
      </div>
      {tagline && (
        <p className="t-mono text-micro opacity-80 mt-2.5">{tagline}</p>
      )}
    </div>
  );
}
