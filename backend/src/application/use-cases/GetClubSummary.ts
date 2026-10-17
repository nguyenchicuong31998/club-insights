import { DEFINITIONS } from "../../domain/metrics/definitions.js";
import {
  attendanceBySessionType, change, computePeriodMetrics, type AttendanceBySessionType, type Change, type NoShowMetric,
} from "../../domain/metrics/metrics.js";
import type { Club } from "../../domain/entities/Club.js";
import { describePeriod, type ClubPeriodReader, type PeriodInfo, type RangeInput } from "../services/ClubPeriodReader.js";

export interface CountComparison {
  current: number;
  previous: number;
  change: Change | null;
  definition: string;
}

export interface ClubSummary {
  club: Club;
  period: PeriodInfo;
  /** First non-cancelled session ever, or null. Lets the UI explain an empty club. */
  firstSessionAt: Date | null;
  /** At least one session has been held, in any period. False for a brand-new club. */
  hasHistory: boolean;
  metrics: {
    sessionsHeld: CountComparison;
    activePlayers: CountComparison;
    noShows: {
      current: NoShowMetric;
      previous: NoShowMetric;
      /** Change in the no-show *rate*, since counts depend on how much attendance was taken. */
      rateChange: Change | null;
      /** Current period, per recurring session: shows which sessions the rate is really based on. */
      bySessionType: AttendanceBySessionType[];
      definition: string;
    };
  };
}

export class GetClubSummary {
  constructor(private readonly reader: ClubPeriodReader) {}

  async execute(clubId: string, input: RangeInput): Promise<ClubSummary> {
    const period = await this.reader.resolve(clubId, input);
    const [current, previous, firstSessionAt] = await Promise.all([
      this.reader.sessionsIn(period, period.range),
      this.reader.sessionsIn(period, period.previous),
      this.reader.firstSessionStart(clubId),
    ]);
    const cur = computePeriodMetrics(current, period.now);
    const prev = computePeriodMetrics(previous, period.now);

    const compare = (key: "sessionsHeld" | "activePlayers"): CountComparison => ({
      current: cur[key], previous: prev[key], change: change(cur[key], prev[key]), definition: DEFINITIONS[key],
    });

    return {
      club: period.club,
      period: describePeriod(period),
      firstSessionAt,
      hasHistory: firstSessionAt !== null && firstSessionAt < period.now,
      metrics: {
        sessionsHeld: compare("sessionsHeld"),
        activePlayers: compare("activePlayers"),
        noShows: {
          current: cur.noShows,
          previous: prev.noShows,
          rateChange: change(cur.noShows.rate, prev.noShows.rate),
          bySessionType: attendanceBySessionType(current, period.now),
          definition: DEFINITIONS.noShows,
        },
      },
    };
  }
}
