// The padel court, seen from above and drawn to real proportions: 20 x 10 m,
// with the service lines 3.05 m from the back glass.
//
// A taken spot is a solid disc and an open spot is a hollow ring, so colour
// never carries the meaning alone. A guest, a friend who isn't on the app, is a
// grey disc marked +1 rather than anyone's initials. Both are always drawn, and the state only
// changes which one shows, so a spot filling in is a real transition.

// Where players stand. Near pair first, then far pair, or one each side for a
// two-player game.
const POSITIONS: Record<number, [number, number][]> = {
  2: [[62, 50], [138, 50]],
  4: [[62, 27], [62, 73], [138, 27], [138, 73]],
};

export type CourtSpot = string | null; // initials, GUEST, or null for an open spot
export const GUEST = "+1";

/* Turn a game's players into court spots: the players, then any guests. The
   viewer stands first, and the court never shows more than the four places on a
   real court. */
export function spotsFor(
  players: { id: string; initials: string }[],
  maxPlayers: number,
  viewerId?: string | null,
  guests = 0,
): CourtSpot[] {
  const count = maxPlayers === 2 ? 2 : 4;
  const ordered = [...players].sort(
    (a, b) => Number(b.id === viewerId) - Number(a.id === viewerId),
  );
  return Array.from({ length: count }, (_, i) =>
    i < ordered.length ? ordered[i].initials : i < ordered.length + guests ? GUEST : null,
  );
}

export default function Court({
  spots,
  big = false,
  radius,
  label,
}: {
  spots: CourtSpot[];
  big?: boolean; // the large version, with initials and plus signs
  radius?: number;
  label: string; // what a screen reader says for this court
}) {
  const positions = POSITIONS[spots.length] ?? POSITIONS[4];
  const r = big ? 15 : 13;
  return (
    <svg className={big ? "ios-court ios-court-big" : "ios-court"} viewBox="0 0 200 100" role="img" aria-label={label}>
      <rect width="200" height="100" rx={radius ?? (big ? 7 : 9)} fill="var(--ios-court)" />
      <path
        d="M30.5 0V100M169.5 0V100M30.5 50H169.5"
        fill="none"
        stroke="#fff"
        strokeOpacity=".78"
        strokeWidth={big ? 0.9 : 1.5}
      />
      <path d="M100 0V100" stroke="#fff" strokeWidth={big ? 1.8 : 2.6} />
      {positions.map(([x, y], i) => {
        const spot = spots[i] ?? null;
        const isGuest = spot === GUEST;
        const initials = isGuest ? null : spot;
        return (
          <g key={`${x}-${y}`}>
            <g className="ios-court-spot" data-on={spot == null}>
              <circle cx={x} cy={y} r={r - 1.4} fill="rgb(0 0 0 / .14)" stroke="#fff" strokeWidth="2.6" />
              {big && (
                <path
                  d={`M${x - 5} ${y}h10M${x} ${y - 5}v10`}
                  stroke="#fff"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              )}
            </g>
            <g className="ios-court-spot" data-on={isGuest}>
              <circle cx={x} cy={y} r={r} fill="var(--ios-guest)" />
              {big && (
                <text
                  x={x}
                  y={y + 3.6}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="700"
                  letterSpacing=".1"
                  fill="var(--ios-on-guest)"
                >
                  {GUEST}
                </text>
              )}
            </g>
            <g className="ios-court-spot" data-on={initials != null}>
              <circle cx={x} cy={y} r={r} fill="#fff" />
              {big && initials && (
                <text
                  x={x}
                  y={y + 3.6}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="700"
                  letterSpacing=".1"
                  fill="var(--ios-court)"
                >
                  {initials}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
