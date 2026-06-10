/* Brand-signature SVG components: the dashed loop arc ending in the ball. */

export function CourtHero() {
  return (
    <div className="mt-4 h-[150px] rounded-3xl relative overflow-hidden border border-white/8 bg-gradient-to-br from-mid to-navy">
      <svg viewBox="0 0 346 150" fill="none" className="absolute inset-0 w-full h-full">
        <rect x="38" y="18" width="270" height="114" rx="6" stroke="rgba(91,154,255,.5)" strokeWidth="1.5" />
        <line x1="173" y1="18" x2="173" y2="132" stroke="rgba(91,154,255,.5)" strokeWidth="1.5" />
        <line x1="106" y1="18" x2="106" y2="132" stroke="rgba(91,154,255,.25)" strokeWidth="1" />
        <line x1="240" y1="18" x2="240" y2="132" stroke="rgba(91,154,255,.25)" strokeWidth="1" />
        <line x1="38" y1="75" x2="106" y2="75" stroke="rgba(91,154,255,.25)" strokeWidth="1" />
        <line x1="240" y1="75" x2="308" y2="75" stroke="rgba(91,154,255,.25)" strokeWidth="1" />
        <path
          d="M 230 95 C 250 30, 190 8, 150 30 C 116 50, 124 92, 158 88 C 190 84, 204 48, 180 36"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <circle cx="180" cy="36" r="8" fill="#fff" />
        <path d="M173 34 Q180 30 187 34" stroke="#1440a0" strokeWidth="1.2" opacity=".5" />
        <path d="M173 38 Q180 42 187 38" stroke="#1440a0" strokeWidth="1.2" opacity=".5" />
      </svg>
    </div>
  );
}

/* Loop arc wrapping an element — used as the level ring on Profile. */
export function LoopRing({
  size = 74,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 74 74" className="absolute inset-0 w-full h-full">
        <path
          d="M 37 4 A 33 33 0 1 1 10 20"
          stroke="#1e5cff"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />
        <circle cx="10" cy="20" r="5.5" fill="#fff" />
      </svg>
      <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-[#3a78ff] to-[#0d2d80] flex items-center justify-center font-display font-bold text-[21px]">
        {children}
      </div>
    </div>
  );
}

export function MiniLoop({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 34 34" fill="none" style={{ width: size, height: size }}>
      <path
        d="M 17 3 A 14 14 0 1 1 5.5 10"
        stroke="#5b9aff"
        strokeWidth="2"
        strokeDasharray="3.5 2.5"
        strokeLinecap="round"
      />
      <circle cx="5.5" cy="10" r="3.5" fill="#fff" />
    </svg>
  );
}
