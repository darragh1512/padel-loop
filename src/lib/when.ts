import { APP_TIME_ZONE, dublinDateKey } from "@/lib/time";

// How the app says when something happens. Always on a Dublin clock, like every
// other time in the app (see time.ts).

const DAY_MS = 86_400_000;

function fmt(d: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IE", { timeZone: APP_TIME_ZONE, ...options }).format(d);
}

/* "Today, 20:00" · "Tomorrow, 19:00" · "Sat, 10:00" · "Tue 10 Nov, 20:30".
   The weekday alone is used only within the coming week, where it can't be
   mistaken for another date. */
export function gameWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = fmt(d, { hour: "2-digit", minute: "2-digit", hour12: false });
  const days = Math.round(
    (Date.parse(`${dublinDateKey(d)}T00:00:00Z`) - Date.parse(`${dublinDateKey(now)}T00:00:00Z`)) / DAY_MS,
  );
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days > 1 && days < 7) return `${fmt(d, { weekday: "short" })}, ${time}`;
  const date = `${fmt(d, { weekday: "short" })} ${fmt(d, { day: "numeric" })} ${fmt(d, { month: "short" })}`;
  return `${date}, ${time}`;
}

/* "Thursday 5 November" */
export function longDate(now: Date = new Date()): string {
  return `${fmt(now, { weekday: "long" })} ${fmt(now, { day: "numeric" })} ${fmt(now, { month: "long" })}`;
}

export function spotsOpenText(open: number): string {
  return `${open} spot${open === 1 ? "" : "s"} open`;
}
