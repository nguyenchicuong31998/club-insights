import { sessionsBehind, type SessionFilter, type SessionRow } from "../../domain/metrics/metrics.js";
import type { DateRange } from "../../domain/time/DateRange.js";
import type { ClubPeriodReader, RangeInput } from "../services/ClubPeriodReader.js";

export interface SessionList {
  range: DateRange & { partial: boolean };
  filter: SessionFilter;
  sessions: SessionRow[];
}

export class ListSessionsBehindMetric {
  constructor(private readonly reader: ClubPeriodReader) {}

  async execute(clubId: string, input: RangeInput, filter: SessionFilter): Promise<SessionList> {
    const period = await this.reader.resolve(clubId, input);
    const sessions = await this.reader.sessionsIn(period, period.range);
    return {
      range: { ...period.range, partial: period.partial },
      filter,
      sessions: sessionsBehind(sessions, period.now, filter),
    };
  }
}
