import { addDays, daysBetween, isoWeekday, startOfLocalDay, type LocalDate } from "./localDate.js";

/** Inclusive range of local calendar dates: 7 Sep – 4 Oct includes both days. */
export interface DateRange {
  from: LocalDate;
  to: LocalDate;
}

export const lengthInDays = (range: DateRange): number => daysBetween(range.from, range.to) + 1;

/** Same number of days, ending the day before `range.from`. */
export function previousPeriod(range: DateRange): DateRange {
  return { from: addDays(range.from, -lengthInDays(range)), to: addDays(range.from, -1) };
}

/** Monday of the week `date` falls in (weeks run Monday–Sunday). */
export const weekStartOf = (date: LocalDate): LocalDate => addDays(date, 1 - isoWeekday(date));

/** The last four complete Monday–Sunday weeks before the week containing `today`. */
export function defaultRange(today: LocalDate): DateRange {
  const thisMonday = weekStartOf(today);
  return { from: addDays(thisMonday, -28), to: addDays(thisMonday, -1) };
}

/** Half-open UTC interval [start, end) covering the range in the club's time zone. */
export function toInstants(range: DateRange, timeZone: string): { start: Date; end: Date } {
  return { start: startOfLocalDay(range.from, timeZone), end: startOfLocalDay(addDays(range.to, 1), timeZone) };
}

export interface Week {
  /** Monday. */
  start: LocalDate;
  /** Sunday. */
  end: LocalDate;
  /**
   * Why the week is not a full seven comparable days, or null if it is:
   * cut by the range start or end, or still in progress at "now".
   */
  partial: "starts_before_range" | "ends_after_range" | "in_progress" | null;
}

/** Every Monday–Sunday week that overlaps the range, oldest first. */
export function weeksOverlapping(range: DateRange, today: LocalDate): Week[] {
  const weeks: Week[] = [];
  for (let start = weekStartOf(range.from); start <= range.to; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    const partial = end >= today ? "in_progress"
      : start < range.from ? "starts_before_range"
      : end > range.to ? "ends_after_range"
      : null;
    weeks.push({ start, end, partial });
  }
  return weeks;
}
