import type { Club } from "../../domain/entities/Club.js";
import type { SessionFacts } from "../../domain/metrics/SessionFacts.js";
import type { ClubRepository } from "../../domain/repositories/ClubRepository.js";
import type { SessionRepository } from "../../domain/repositories/SessionRepository.js";
import { defaultRange, lengthInDays, previousPeriod, toInstants, type DateRange } from "../../domain/time/DateRange.js";
import { isLocalDate, localDateOf, type LocalDate } from "../../domain/time/localDate.js";
import { NotFoundError, ValidationError } from "../errors.js";
import type { Clock } from "../ports/Clock.js";

export interface RangeInput {
  from?: string;
  to?: string;
}

export interface ResolvedPeriod {
  club: Club;
  now: Date;
  /** Today's date in the club's time zone. */
  today: LocalDate;
  range: DateRange;
  previous: DateRange;
  /** The range reaches today or later, so part of it has not happened yet. */
  partial: boolean;
}

const MAX_DAYS = 366;

/** Turns optional from/to into a validated range in the club's time zone. */
export function resolveRange(input: RangeInput, timeZone: string, now: Date): Omit<ResolvedPeriod, "club" | "now"> {
  const today = localDateOf(now, timeZone);
  if (!input.from !== !input.to) throw new ValidationError("Pass both from and to, or neither.");

  const range = input.from && input.to ? { from: input.from, to: input.to } : defaultRange(today);
  for (const [name, value] of Object.entries(range)) {
    if (!isLocalDate(value)) throw new ValidationError(`${name} must be a date as YYYY-MM-DD, got "${value}".`);
  }
  if (range.from > range.to) throw new ValidationError("from must be on or before to.");
  if (range.from > today) throw new ValidationError(`The range starts after today (${today}); there is nothing to show yet.`);
  if (lengthInDays(range) > MAX_DAYS) throw new ValidationError(`The range can be at most ${MAX_DAYS} days.`);

  return { today, range, previous: previousPeriod(range), partial: range.to >= today };
}

/** Shared loading step for every metrics use case: club, resolved range, and session facts. */
export class ClubPeriodReader {
  constructor(
    private readonly clubs: ClubRepository,
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
  ) {}

  async resolve(clubId: string, input: RangeInput): Promise<ResolvedPeriod> {
    const club = await this.clubs.findById(clubId);
    if (!club) throw new NotFoundError("Club", clubId);
    const now = this.clock.now();
    return { club, now, ...resolveRange(input, club.timezone, now) };
  }

  sessionsIn(period: ResolvedPeriod, range: DateRange): Promise<SessionFacts[]> {
    const { start, end } = toInstants(range, period.club.timezone);
    return this.sessions.findStartingBetween(period.club.id, start, end);
  }

  firstSessionStart(clubId: string): Promise<Date | null> {
    return this.sessions.firstSessionStart(clubId);
  }
}

/** The resolved range in both local dates and UTC instants, so clients never redo time zone math. */
export interface PeriodInfo {
  clubId: string;
  timezone: string;
  now: Date;
  today: LocalDate;
  range: DateRange & { partial: boolean; startUtc: Date; endUtc: Date };
  previousRange: DateRange & { startUtc: Date; endUtc: Date };
}

export function describePeriod(p: ResolvedPeriod): PeriodInfo {
  const cur = toInstants(p.range, p.club.timezone);
  const prev = toInstants(p.previous, p.club.timezone);
  return {
    clubId: p.club.id,
    timezone: p.club.timezone,
    now: p.now,
    today: p.today,
    range: { ...p.range, partial: p.partial, startUtc: cur.start, endUtc: cur.end },
    previousRange: { ...p.previous, startUtc: prev.start, endUtc: prev.end },
  };
}
