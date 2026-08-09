"use client";

// The honours shelf on a player's profile. Earned badges are printed loud —
// lima stamps with the hard riso offset, the same voice as a primary action —
// while the next rung in each family sits quietly underneath as a progress
// strip, so there's always a visible "one more game" to chase.
//
// Badges are derived (see src/app/badges.ts), so this renders whatever the
// player's real history adds up to — nothing to award, nothing to sync.

import { SectionLabel } from "@/components/ui";
import type { BadgeProgress } from "@/app/badges";

// One earned badge: a stamped lima ticket. The threshold is the hero number;
// the family reads underneath in printed mono.
function EarnedStamp({
  value,
  caption,
  label,
  delay = 0,
}: {
  value: number;
  caption: string;
  // The full sentence a screen reader gets — the face alone ("25 GAMES")
  // doesn't say what was earned.
  label: string;
  delay?: number;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="pl-rise pena-riso bg-lima text-tinta border-2 border-tinta rounded-card px-3.5 py-2.5 text-center min-w-20"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="t-display text-display-xs leading-none">{value}</div>
      <div className="t-mono text-[9px] tracking-[0.1em] mt-1.5">{caption}</div>
    </div>
  );
}

// One family's next rung, with how far along the player is.
function NextUpRow({ progress }: { progress: BadgeProgress }) {
  const next = progress.next;
  if (!next) return null;
  const pct = Math.min(100, Math.round((progress.value / next.threshold) * 100));
  const remaining = next.threshold - progress.value;

  return (
    <div className="pl-card p-4 mb-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body font-extrabold text-tinta">{next.title}</span>
        <span className="t-mono text-[9px] tracking-[0.1em] text-tinta/70 shrink-0">
          {progress.value} / {next.threshold}
        </span>
      </div>
      {/* Track + fill: a printed field with the lima pass over it. */}
      <div
        className="pl-surface rounded-pill h-2.5 mt-2.5 overflow-hidden"
        role="progressbar"
        aria-valuenow={progress.value}
        aria-valuemin={0}
        aria-valuemax={next.threshold}
        aria-label={next.title}
      >
        <div
          className="bg-lima h-full border-r-2 border-tinta transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-label font-medium text-tinta/70 mt-2">
        {progress.family === "streak"
          ? `${remaining} more in a row and it's yours.`
          : progress.family === "games"
            ? `${remaining} more ${remaining === 1 ? "match" : "matches"} to go.`
            : `${remaining} more ${remaining === 1 ? "connection" : "connections"} to go.`}
      </p>
    </div>
  );
}

export default function BadgeShelf({
  badges,
  isOwner,
  displayName,
}: {
  badges: BadgeProgress[];
  // The owner gets second-person copy ("you"); visitors see the player named.
  isOwner: boolean;
  displayName: string;
}) {
  const earned = badges.flatMap((b) =>
    b.earned.map((badge) => ({ badge, family: b.family })),
  );
  const upcoming = badges.filter((b) => b.next != null);

  return (
    <>
      <SectionLabel>Badges</SectionLabel>

      {earned.length > 0 ? (
        <div className="flex flex-wrap gap-2.5 mb-3">
          {earned.map(({ badge }, i) => (
            <EarnedStamp
              key={badge.id}
              value={badge.threshold}
              label={badge.blurb}
              caption={
                badge.family === "connections"
                  ? "FRIENDS"
                  : badge.family === "games"
                    ? "GAMES"
                    : "IN A ROW"
              }
              delay={Math.min(i, 8) * 40}
            />
          ))}
        </div>
      ) : (
        <div className="pl-surface rounded-card px-4 py-5 text-center text-label font-medium text-tinta/70 mb-3">
          {isOwner
            ? "No badges yet — play a game, make a connection, and the first one lands."
            : `${displayName} hasn't earned a badge yet.`}
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="t-mono text-[9px] tracking-[0.12em] text-papel/80 mb-2 px-0.5">
            NEXT UP
          </div>
          {upcoming.map((progress) => (
            <NextUpRow key={progress.family} progress={progress} />
          ))}
        </>
      )}
    </>
  );
}
