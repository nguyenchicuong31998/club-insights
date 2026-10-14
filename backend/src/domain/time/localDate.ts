/**
 * Calendar dates and time zone conversion without a date library.
 * A LocalDate is a "YYYY-MM-DD" day in some club's time zone; it carries no time zone itself.
 */
export type LocalDate = string;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function parts(date: LocalDate): [number, number, number] {
  const m = LOCAL_DATE.exec(date);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// Day arithmetic is done on UTC midnights, where every day is exactly 24 hours long.
const toDayNumber = (date: LocalDate) => {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
const fromDayNumber = (n: number): LocalDate => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** True for a real calendar date such as 2026-02-28 (not 2026-02-30). */
export function isLocalDate(value: string): boolean {
  return LOCAL_DATE.test(value) && fromDayNumber(toDayNumber(value)) === value;
}

export const addDays = (date: LocalDate, days: number): LocalDate => fromDayNumber(toDayNumber(date) + days);

/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: LocalDate, b: LocalDate): number => toDayNumber(b) - toDayNumber(a);

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: LocalDate): number {
  const day = new Date(toDayNumber(date) * DAY_MS).getUTCDay();
  return day === 0 ? 7 : day;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallClock(instant: Date, timeZone: string) {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** The calendar date an instant falls on in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const { y, m, d } = wallClock(instant, timeZone);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** How far `timeZone` is ahead of UTC at `instant`, in ms (+7h for Asia/Ho_Chi_Minh). */
function offsetMs(instant: Date, timeZone: string): number {
  const { y, m, d, h, min, s } = wallClock(instant, timeZone);
  return Date.UTC(y, m - 1, d, h, min, s) - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant local midnight starts on `date` in `timeZone`. */
export function startOfLocalDay(date: LocalDate, timeZone: string): Date {
  const [y, m, d] = parts(date);
  const wall = Date.UTC(y, m - 1, d);
  // Two passes so a DST change between the guess and the answer is still handled.
  let utc = wall - offsetMs(new Date(wall), timeZone);
  utc = wall - offsetMs(new Date(utc), timeZone);
  return new Date(utc);
}
