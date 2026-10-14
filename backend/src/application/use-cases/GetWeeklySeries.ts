import { computePeriodMetrics, type PeriodMetrics } from "../../domain/metrics/metrics.js";
import { DEFINITIONS } from "../../domain/metrics/definitions.js";
import { weekStartOf, weeksOverlapping, type Week } from "../../domain/time/DateRange.js";
import { localDateOf } from "../../domain/time/localDate.js";
import { describePeriod, type ClubPeriodReader, type PeriodInfo, type RangeInput } from "../services/ClubPeriodReader.js";

export interface WeeklyPoint extends Week, PeriodMetrics {}

export interface WeeklySeries {
  period: PeriodInfo;
  definition: string;
  weeks: WeeklyPoint[];
}

/**
 * All three metrics per Monday–Sunday week. Sessions are bucketed by their start date in the
 * club's time zone, never in UTC (a 06:00 Monday session in Saigon is Sunday in UTC).
 */
export class GetWeeklySeries {
  constructor(private readonly reader: ClubPeriodReader) {}

  async execute(clubId: string, input: RangeInput): Promise<WeeklySeries> {
    const period = await this.reader.resolve(clubId, input);
    const sessions = await this.reader.sessionsIn(period, period.range);
    const tz = period.club.timezone;

    return {
      period: describePeriod(period),
      definition: DEFINITIONS.weeks,
      weeks: weeksOverlapping(period.range, period.today).map((week) => ({
        ...week,
        ...computePeriodMetrics(
          sessions.filter((s) => weekStartOf(localDateOf(s.startsAt, tz)) === week.start),
          period.now,
        ),
      })),
    };
  }
}
