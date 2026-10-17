import { sessionsBehind, type SessionFilter, type SessionRow } from "../../domain/metrics/metrics.js";
import { paginate, type PageRequest, type Pagination } from "../services/paginate.js";
import { describePeriod, type ClubPeriodReader, type PeriodInfo, type RangeInput } from "../services/ClubPeriodReader.js";

export interface SessionList {
  period: PeriodInfo;
  filter: SessionFilter;
  /** One page, in list order. */
  sessions: SessionRow[];
  pagination: Pagination;
}

export class ListSessionsBehindMetric {
  constructor(private readonly reader: ClubPeriodReader) {}

  async execute(clubId: string, input: RangeInput, filter: SessionFilter, page: PageRequest): Promise<SessionList> {
    const period = await this.reader.resolve(clubId, input);
    const sessions = await this.reader.sessionsIn(period, period.range);
    const { items, pagination } = paginate(sessionsBehind(sessions, period.now, filter), page);
    return { period: describePeriod(period), filter, sessions: items, pagination };
  }
}
