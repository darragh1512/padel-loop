import type { ReactNode } from "react";
import type { Player } from "@/lib/types";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[15px] font-semibold text-ink mt-8 mb-3 px-0.5">
      {children}
    </div>
  );
}

export function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-medium rounded-full px-3.5 py-1.5 whitespace-nowrap transition-colors duration-150 ease-out ${
        active ? "bg-accent-soft text-accent" : "bg-sunken text-ink-secondary"
      }`}
    >
      {children}
    </span>
  );
}

export function LevelChip({ children }: { children: ReactNode }) {
  return (
    <span className="text-[13px] font-medium text-accent bg-accent-soft rounded-full px-3 py-1.5">
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="block w-full h-12 text-center bg-accent text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full h-12 text-center bg-sunken text-ink font-medium text-[15px] rounded-full active:scale-[0.98] transition-transform duration-150 ease-out"
    >
      {children}
    </button>
  );
}

/* Palette-harmonious tints for the decorative initials avatars —
   bone / sage / clay, always with warm ink initials on top. */
const AV_TINTS = ["bg-accent-soft", "bg-sunken", "bg-clay-soft", "bg-sage-mist"];

export function Avatar({
  player,
  index = 0,
  size = "sm",
}: {
  player?: Player;
  index?: number;
  size?: "sm" | "md";
}) {
  const dims = size === "md" ? "w-9 h-9 text-xs" : "w-[30px] h-[30px] text-[11px]";
  if (!player) {
    return (
      <span
        className={`${dims} rounded-full inline-flex items-center justify-center border border-dashed border-ink-faint text-ink-faint font-normal bg-bone`}
      >
        +
      </span>
    );
  }
  return (
    <span
      className={`${dims} rounded-full inline-flex items-center justify-center font-semibold text-ink border-2 border-bone ${AV_TINTS[index % AV_TINTS.length]}`}
    >
      {player.initials}
    </span>
  );
}

export function AvatarStack({ players, maxPlayers }: { players: Player[]; maxPlayers: number }) {
  const empties = Math.max(0, maxPlayers - players.length);
  return (
    <div className="flex">
      {players.map((p, i) => (
        <span key={p.id} className={i > 0 ? "-ml-2.5" : ""}>
          <Avatar player={p} index={i} />
        </span>
      ))}
      {Array.from({ length: empties }).map((_, i) => (
        <span key={`e${i}`} className="-ml-2.5">
          <Avatar />
        </span>
      ))}
    </div>
  );
}
