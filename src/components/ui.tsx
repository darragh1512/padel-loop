import type { ReactNode } from "react";
import type { Player } from "@/lib/types";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-display font-light text-[9.5px] tracking-[3.5px] uppercase text-sky/65 mt-6 mb-3 px-0.5">
      {children}
    </div>
  );
}

export function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3.5 py-1.5 whitespace-nowrap ${
        active
          ? "bg-vivid border border-vivid text-white"
          : "bg-vivid/15 border border-sky/25 text-pale"
      }`}
    >
      {children}
    </span>
  );
}

export function LevelChip({ children }: { children: ReactNode }) {
  return (
    <span className="font-display text-[9px] tracking-[1.5px] text-pale bg-vivid/15 border border-sky/30 rounded-full px-3 py-1.5">
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
      className="block w-full text-center bg-vivid text-white font-semibold text-[15px] rounded-(--radius-btn) py-3.5 pl-cta-shadow active:scale-[0.98] transition-transform"
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
      className="block w-full text-center bg-transparent text-pale font-medium text-sm border border-white/15 rounded-(--radius-btn) py-3 active:scale-[0.98] transition-transform"
    >
      {children}
    </button>
  );
}

const AV_GRADIENTS = [
  "from-[#3a78ff] to-[#0d2d80]",
  "from-[#5b9aff] to-mid",
  "from-vivid to-navy",
  "from-[#7fb0ff] to-[#2a52c0]",
];

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
        className={`${dims} rounded-full inline-flex items-center justify-center border-[1.5px] border-dashed border-sky/50 text-sky font-normal`}
      >
        +
      </span>
    );
  }
  return (
    <span
      className={`${dims} rounded-full inline-flex items-center justify-center font-bold text-white border-2 border-navy bg-gradient-to-br ${AV_GRADIENTS[index % AV_GRADIENTS.length]}`}
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
