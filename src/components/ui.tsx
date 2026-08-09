import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import type { Player } from "@/lib/types";

/* ── Padel Loop component kit — THE PEÑA ──────────────────────────────────
   Every interactive component here covers all seven states:
   default, hover (gated to hover-capable devices by Tailwind v4), focus
   (focus-visible ring), active (.pl-press / .pena-riso), disabled, loading
   (aria-busy + spinner), error (aria-invalid). All values flow from the
   tokens in globals.css — no raw colours, sizes or radii.                  */

/* Shared state classes. Focus is a 3px lima ring offset from the shape;
   disabled dims and stops pointer events; error borrows the danger voice
   (naranja-d). */
const FOCUS =
  "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-lima";
const DISABLED = "disabled:opacity-45 disabled:pointer-events-none";

/* ── Spinner ──
   Lives inside buttons only — async CONTENT gets skeletons, never spinners. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-4 rounded-pill border-2 border-current border-t-transparent animate-[spin_600ms_linear_infinite] motion-reduce:animate-[spin_1.2s_linear_infinite] ${className}`}
    />
  );
}

/* ── Button ── the printed pill: mono caps, 2px tinta border, 48px tall,
   full width by default (forms). size="sm" is the compact inline pill.
   Primary is lima with the hard riso offset — the one loud thing.          */
type ButtonVariant = "primary" | "secondary" | "destructive";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-lima text-tinta border-2 border-tinta pena-riso",
  secondary: "bg-papel text-tinta border-2 border-tinta hover:bg-lima/40",
  /* dangerous actions: papel scrap, dark riso orange, dashed border —
     never lima, never a filled naranja */
  destructive:
    "bg-papel text-naranja-d border-2 border-dashed border-naranja-d hover:bg-naranja-d/10",
};

/* Buttons are cut squares in the prototype, not pills — 4px radius, the same
   as the posters they sit on. Only avatars and chips stay round. */
const BUTTON_TYPE =
  "t-mono inline-flex items-center justify-center gap-2 rounded-card whitespace-nowrap select-none";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`pl-press ${BUTTON_TYPE} ${
        size === "md" ? "h-12 w-full px-6 text-label" : "h-9 px-4 text-micro"
      } ${BUTTON_VARIANT[variant]} ${FOCUS} ${DISABLED} aria-invalid:outline-2 aria-invalid:outline-naranja-d ${className}`}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/* Legacy names — thin wrappers so existing screens keep working while the
   sweep migrates them to <Button>. */
export function PrimaryButton(props: ComponentProps<typeof Button>) {
  return <Button variant="primary" {...props} />;
}
export function GhostButton(props: ComponentProps<typeof Button>) {
  return <Button variant="secondary" {...props} />;
}

/* ── ButtonLink ── a Link styled as a button, for navigations that read as
   actions (e.g. "Count me in" on a card). Same states minus disabled/loading
   (links navigate; they don't load). */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
}) {
  return (
    <Link
      className={`pl-press ${BUTTON_TYPE} ${
        size === "md" ? "h-12 w-full px-6 text-label" : "h-9 px-4 text-micro"
      } ${BUTTON_VARIANT[variant]} ${FOCUS} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

/* ── Chips ── the squad pills: papel scraps with a tinta outline. Static
   <Chip> for display; <ChipButton> when tappable (filters, toggles).
   Active = the lima print pass. */
const CHIP_LOOK = (active: boolean) =>
  `t-mono inline-flex items-center gap-1.5 text-micro rounded-pill px-3 py-1.5 whitespace-nowrap border-2 border-tinta text-tinta ${
    active ? "bg-lima" : "bg-papel"
  }`;

export function Chip({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span className={`${CHIP_LOOK(active)} transition-colors duration-150 ease-out`}>
      {children}
    </span>
  );
}

export function ChipButton({
  active = false,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`pl-press pl-hit shrink-0 ${CHIP_LOOK(active)} ${
        active ? "hover:bg-lima/70" : "hover:bg-lima/40"
      } ${FOCUS} ${DISABLED} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* The level tag — a printed mono label on lima. */
export function LevelChip({ children }: { children: ReactNode }) {
  return (
    <span className="t-mono text-micro text-tinta bg-lima border-2 border-tinta rounded-pill px-3 py-1.5">
      {children}
    </span>
  );
}

/* ── Inputs ── printed fields: papel fill, 2px tinta border (.pl-surface),
   4px radius; focus turns the border naranja; error goes naranja-d (set
   aria-invalid). */
const INPUT_LOOK =
  "pl-surface w-full rounded-field px-4 py-3 text-body font-medium text-tinta placeholder:text-tinta/45 placeholder:font-normal focus:outline-none focus:border-naranja disabled:opacity-45 aria-invalid:border-naranja-d transition-colors duration-150 ease-out";

export function Input({
  className = "",
  ...props
}: ComponentProps<"input">) {
  return <input className={`${INPUT_LOOK} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: ComponentProps<"textarea">) {
  return <textarea className={`${INPUT_LOOK} ${className}`} {...props} />;
}

/* Field = label + control + one quiet error line. Labels speak mono, like
   everything printed small. Colour is inherited (tinta on papel, papel on
   the wall). */
export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="t-mono block text-micro opacity-85 mb-1.5"
      >
        {label}
      </label>
      {children}
      <p
        id={`${htmlFor}-error`}
        aria-live="polite"
        className={`text-label font-semibold text-naranja-d mt-1.5 ${error ? "" : "hidden"}`}
      >
        {error}
      </p>
    </div>
  );
}

/* ── Skeleton ── a loading placeholder shaped like the content it stands in
   for — a papel ghost on the wall. Never a spinner for content. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`pl-skeleton ${className}`} />;
}

/* ── EmptyState ── a stapled mini-poster that teaches and invites; never a
   bare "nothing here". The poster shout does the welcoming. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pl-card px-6 pt-7 pb-6 text-center">
      <p className="t-display text-display-xs text-tinta">{title}</p>
      {body && <p className="text-body font-medium text-tinta/70 mt-2">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ── ListRow ── the tappable row: leading slot, title + support line,
   trailing chevron. A pinned paper strip; rows stay straight (no tilt). */
export function ListRow({
  href,
  leading,
  title,
  sub,
  trailing,
  flat = false,
  className = "",
}: {
  href: string;
  leading?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  flat?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`pl-press flex items-center gap-3.5 p-4 ${
        flat ? "rounded-field hover:bg-tinta/6" : "pl-card hover:bg-lima/20"
      } ${FOCUS} ${className}`}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-body font-extrabold text-tinta truncate">
          {title}
        </span>
        {sub && (
          <span className="block text-label font-medium text-tinta/70 truncate mt-0.5">
            {sub}
          </span>
        )}
      </span>
      {trailing ?? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="shrink-0 text-tinta/45"
        >
          <path
            d="m9 6 6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </Link>
  );
}

/* ── Dialog ── a notice slapped over the board: papel poster on the tinta
   scrim, 3px tinta border, staples, a slight tilt, the poster-shout title. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-5 pb-6 sm:pb-0"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-scrim cursor-default"
      />
      <div className="relative w-full max-w-sm p-5 pl-card border-[3px] border-tinta shadow-poster pl-rise">
        <p className="t-display text-display-xs text-tinta">{title}</p>
        {children}
      </div>
    </div>
  );
}

/* Section labels sit straight on the wall — printed mono in papel. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="t-mono text-micro text-papel/90 mt-8 mb-3 px-0.5">
      {children}
    </div>
  );
}

/* ── Avatars ── riso print passes for the decorative initials avatars —
   papel / lima / naranja, tinta initials, a tinta outline. Open slots are
   the dashed-naranja "+ you?" pill in circle form. */
const AV_TINTS = ["bg-lima", "bg-papel", "bg-naranja"];

export function Avatar({
  player,
  index = 0,
  size = "sm",
}: {
  player?: Player;
  index?: number;
  size?: "sm" | "md";
}) {
  const dims = size === "md" ? "size-9 text-label" : "size-7.5 text-micro";
  if (!player) {
    return (
      <span
        className={`${dims} rounded-pill inline-flex items-center justify-center border-[1.5px] border-dashed border-naranja text-naranja-d font-extrabold bg-papel`}
      >
        +
      </span>
    );
  }
  return (
    <span
      className={`${dims} rounded-pill inline-flex items-center justify-center font-extrabold text-tinta border-[1.5px] border-tinta ${AV_TINTS[index % AV_TINTS.length]} ${index % AV_TINTS.length === 2 ? "text-papel" : ""}`}
    >
      {player.initials}
    </span>
  );
}

export function AvatarStack({
  players,
  maxPlayers,
}: {
  players: Player[];
  maxPlayers: number;
}) {
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
