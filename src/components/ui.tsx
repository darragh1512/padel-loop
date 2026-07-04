import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import type { Player } from "@/lib/types";

/* ── Padel Loop component kit ─────────────────────────────────────────────
   Every interactive component here covers all seven states:
   default, hover (gated to hover-capable devices by Tailwind v4), focus
   (focus-visible ring), active (.pl-press), disabled, loading (aria-busy +
   spinner), error (aria-invalid). All values flow from the tokens in
   globals.css — no raw colours, sizes or radii.                            */

/* Shared state classes. Focus is a 2px accent ring offset from the shape;
   disabled dims to faint and stops pointer events; error borrows the
   danger voice. */
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const DISABLED = "disabled:opacity-45 disabled:pointer-events-none";

/* ── Spinner ──
   Lives inside buttons only — async CONTENT gets skeletons, never spinners.
   Fast (600ms) because a quick spinner reads as a quick app. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-4 rounded-pill border-2 border-current border-t-transparent animate-[spin_600ms_linear_infinite] motion-reduce:animate-[spin_1.2s_linear_infinite] ${className}`}
    />
  );
}

/* ── Button ── full-round pill, 48px tall, full width by default (forms).
   size="sm" is the compact inline pill (card actions).                     */
type ButtonVariant = "primary" | "secondary" | "destructive";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong",
  secondary: "bg-sunken text-ink hover:bg-sunken-strong",
  /* dangerous actions never get a filled button */
  destructive: "bg-transparent text-danger hover:bg-clay-soft",
};

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
      className={`pl-press inline-flex items-center justify-center gap-2 font-medium rounded-pill whitespace-nowrap select-none ${
        size === "md" ? "h-12 w-full px-6 text-body" : "h-9 px-4 text-label"
      } ${BUTTON_VARIANT[variant]} ${FOCUS} ${DISABLED} aria-invalid:outline-2 aria-invalid:outline-danger ${className}`}
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
   actions (e.g. "Join game" on a card). Same states minus disabled/loading
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
      className={`pl-press inline-flex items-center justify-center gap-2 font-medium rounded-pill whitespace-nowrap select-none ${
        size === "md" ? "h-12 w-full px-6 text-body" : "h-9 px-4 text-label"
      } ${BUTTON_VARIANT[variant]} ${FOCUS} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

/* ── Chips ── pill-shaped labels. Static <Chip> for display; <ChipButton>
   when the chip is tappable (filters, toggles). Active = the sage whisper. */
const CHIP_LOOK = (active: boolean) =>
  `inline-flex items-center gap-1.5 text-label font-medium rounded-pill px-3.5 py-1.5 whitespace-nowrap ${
    active ? "bg-accent-soft text-accent" : "bg-sunken text-ink-secondary"
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
      className={`pl-press shrink-0 ${CHIP_LOOK(active)} ${
        active ? "hover:bg-sage-mist" : "hover:bg-sunken-strong"
      } ${FOCUS} ${DISABLED} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function LevelChip({ children }: { children: ReactNode }) {
  return (
    <span className="text-label font-medium text-accent bg-accent-soft rounded-pill px-3 py-1.5">
      {children}
    </span>
  );
}

/* ── Inputs ── pressed-bone fill, field radius, no border at rest; focus
   turns the border sage; error turns it terracotta (set aria-invalid).    */
const INPUT_LOOK =
  "pl-surface w-full rounded-field px-4 py-3 text-body text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent disabled:opacity-45 aria-invalid:border-danger transition-colors duration-150 ease-out";

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

/* Field = label + control + one quiet error line. Wires the label and the
   error to the control for screen readers; the error is announced politely. */
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
        className="block text-label font-medium text-ink-secondary mb-1.5"
      >
        {label}
      </label>
      {children}
      <p
        id={`${htmlFor}-error`}
        aria-live="polite"
        className={`text-label text-danger mt-1.5 ${error ? "" : "hidden"}`}
      >
        {error}
      </p>
    </div>
  );
}

/* ── Skeleton ── a loading placeholder shaped like the content it stands in
   for. Compose several to mirror the real layout; never show a spinner for
   content. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`pl-skeleton ${className}`} />;
}

/* ── EmptyState ── teaches and invites; never a bare "nothing here". The
   serif headline is the brand's voice doing the welcoming. */
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
    <div className="pl-card px-6 py-8 text-center">
      <p className="font-display text-display-xs text-ink">{title}</p>
      {body && <p className="text-label text-ink-secondary mt-1.5">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ── ListRow ── the tappable row: leading slot, title + support line,
   trailing chevron. A card by default; set flat for rows inside a card.   */
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
        flat ? "rounded-field hover:bg-bone" : "pl-card hover:bg-bone"
      } ${FOCUS} ${className}`}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-title font-semibold text-ink truncate">
          {title}
        </span>
        {sub && (
          <span className="block text-label text-ink-secondary truncate mt-0.5">
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
          className="shrink-0 text-ink-faint"
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

/* ── Dialog ── the one floating surface. Centred card on a scrim, the single
   ambient shadow, 200ms rise. Confirmations stay centred; bottom sheets are
   for pickers. */
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
      <div className="relative w-full max-w-sm p-5 bg-bone border border-line rounded-card shadow-sheet pl-rise">
        <p className="font-display text-display-xs text-ink">{title}</p>
        {children}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-title font-semibold text-ink mt-8 mb-3 px-0.5">
      {children}
    </div>
  );
}

/* ── Avatars ── palette-harmonious tints for the decorative initials
   avatars — bone / sage / clay, warm ink initials on top. */
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
  const dims = size === "md" ? "size-9 text-label" : "size-7.5 text-micro";
  if (!player) {
    return (
      <span
        className={`${dims} rounded-pill inline-flex items-center justify-center border border-dashed border-ink-faint text-ink-faint font-normal bg-bone`}
      >
        +
      </span>
    );
  }
  return (
    <span
      className={`${dims} rounded-pill inline-flex items-center justify-center font-semibold text-ink border-2 border-bone ${AV_TINTS[index % AV_TINTS.length]}`}
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
