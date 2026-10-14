import { sessionsBehind, type SessionFilter, type SessionRow } from "../../domain/metrics/metrics.js";
import { describePeriod, type ClubPeriodReader, type PeriodInfo, type RangeInput } from "../services/ClubPeriodReader.js";

export interface SessionList {
  period: PeriodInfo;
  filter: SessionFilter;
  sessions: SessionRow[];
}

export class ListSessionsBehindMetric {
  constructor(private readonly reader: ClubPeriodReader) {}

  async execute(clubId: string, input: RangeInput, filter: SessionFilter): Promise<SessionList> {
    const period = await this.reader.resolve(clubId, input);
    const sessions = await this.reader.sessionsIn(period, period.range);
    return {
      period: describePeriod(period),
      filter,
      sessions: sessionsBehind(sessions, period.now, filter),
    };
  }
}
