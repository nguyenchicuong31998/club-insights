import { DEFINITIONS } from "../../domain/metrics/definitions.js";
import { change, computePeriodMetrics, type Change, type NoShowMetric } from "../../domain/metrics/metrics.js";
import type { DateRange } from "../../domain/time/DateRange.js";
import type { Club } from "../../domain/entities/Club.js";
import type { ClubPeriodReader, RangeInput } from "../services/ClubPeriodReader.js";

export interface CountComparison {
  current: number;
  previous: number;
  change: Change | null;
  definition: string;
}

export interface ClubSummary {
  club: Club;
  now: Date;
  range: DateRange & { partial: boolean };
  previousRange: DateRange;
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
      now: period.now,
      range: { ...period.range, partial: period.partial },
      previousRange: period.previous,
      firstSessionAt,
      hasHistory: firstSessionAt !== null && firstSessionAt < period.now,
      metrics: {
        sessionsHeld: compare("sessionsHeld"),
        activePlayers: compare("activePlayers"),
        noShows: {
          current: cur.noShows,
          previous: prev.noShows,
          rateChange: change(cur.noShows.rate, prev.noShows.rate),
          definition: DEFINITIONS.noShows,
        },
      },
    };
  }
}
