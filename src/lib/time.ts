// The app's one timezone abstraction. Game times are STORED as true UTC
// instants (timestamptz) and PRESENTED — displayed and typed in — pinned to
// Europe/Dublin, whatever device the viewer is on. This module is the only
// place that conversion lives on the client; the SQL side's single mirror of
// it is the 'Europe/Dublin' constant inside roll_recurring_games().
//
// No date library: the conversions use the browser's own Intl timezone data.

export const APP_TIME_ZONE = "Europe/Dublin";

// What the given instant reads as on a Dublin wall clock, as numeric parts.
function dublinParts(instant: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);
  // Intl renders midnight as "24" with hour12:false in some engines — wrap it.
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

// The UTC instant (ISO string) for a Dublin wall-clock date + time, e.g.
// ("2026-08-12", "18:30") → "2026-08-12T17:30:00.000Z" in Irish Summer Time
// but "...T18:30:00.000Z" in winter (GMT). Works by guessing the instant as
// if the wall clock were UTC, reading what that guess shows on a Dublin
// clock, and correcting by the difference — twice, so a guess that lands on
// the wrong side of a DST switch still settles on the right offset.
export function dublinToUtc(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const targetAsUtcMs = Date.UTC(y, mo - 1, d, h, mi, 0, 0);

  let guess = targetAsUtcMs;
  for (let i = 0; i < 2; i++) {
    const shown = dublinParts(new Date(guess));
    const shownAsUtcMs = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      0,
      0,
    );
    guess += targetAsUtcMs - shownAsUtcMs;
  }
  return new Date(guess).toISOString();
}

// The stored UTC instant rendered as a Dublin "YYYY-MM-DDTHH:mm" string —
// the value shape a <input type="datetime-local"> wants. Inverse of
// dublinToUtc (split the result at the "T" to feed it back).
export function utcToDublinInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = dublinParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// The Dublin calendar date of an instant, as a sortable "YYYY-MM-DD" key.
// This is THE way to ask "are these the same day?" — comparing device-local
// dates would move the day boundary with the viewer's timezone.
export function dublinDateKey(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  // en-CA formats as YYYY-MM-DD.
  return d.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}
