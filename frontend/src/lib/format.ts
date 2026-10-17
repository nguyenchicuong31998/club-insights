// Display formatting. Local dates ("YYYY-MM-DD") are formatted as plain calendar days; instants are
// always shown in the club's time zone, never the viewer's.

const DAY_MS = 86_400_000;
const asUtcDay = (date: string) => new Date(`${date}T00:00:00Z`);

export function formatDay(date: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  return asUtcDay(date).toLocaleDateString("en-GB", {
    timeZone: "UTC", day: "numeric", month: "short",
    ...(opts.weekday ? { weekday: "short" } : {}), ...(opts.year ? { year: "numeric" } : {}),
  });
}

/** "7 Sep – 4 Oct 2026", collapsing the repeated year. */
export function formatRange(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDay(from, { year: !sameYear })} – ${formatDay(to, { year: true })}`;
}

export const daysInRange = (from: string, to: string) =>
  Math.round((asUtcDay(to).getTime() - asUtcDay(from).getTime()) / DAY_MS) + 1;

export function addDays(date: string, days: number): string {
  return new Date(asUtcDay(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const dow = asUtcDay(date).getUTCDay(); // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function formatSessionTime(startIso: string, endIso: string, timeZone: string): { day: string; time: string } {
  const start = new Date(startIso);
  const time = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  return {
    day: start.toLocaleDateString("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" }),
    time: `${time(start)}–${time(new Date(endIso))}`,
  };
}

export const formatCount = (n: number) => n.toLocaleString("en-US");
export const formatPercent = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`;
export const signed = (n: number, text: string) => (n > 0 ? `+${text}` : n < 0 ? `−${text.replace("-", "")}` : text);

/** "Ho Chi Minh time (UTC+7)": the club's zone in words a host recognises. */
export function zoneLabel(timeZone: string, at: string): string {
  const city = (timeZone.split("/").pop() ?? timeZone).replaceAll("_", " ");
  const offset = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(new Date(at))
    .find((p) => p.type === "timeZoneName")?.value.replace("GMT", "UTC");
  return offset ? `${city} time (${offset === "UTC" ? "UTC" : offset})` : `${city} time`;
}

/** "1 session", "20 sessions". */
export const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;

/**
 * How a range reads in a sentence: "the last 4 weeks" when it is the N complete weeks before this
 * one, otherwise its dates. `before` names the previous period the same way.
 */
export function periodWords(range: { from: string; to: string }, today: string): { current: string; before: string } {
  const days = daysInRange(range.from, range.to);
  const weeks = days / 7;
  if (Number.isInteger(weeks) && range.to === addDays(weekStart(today), -1)) {
    return weeks === 1
      ? { current: "last week", before: "the week before" }
      : { current: `the last ${weeks} weeks`, before: `the ${weeks} weeks before` };
  }
  return { current: formatRange(range.from, range.to), before: `the ${days} days before` };
}
