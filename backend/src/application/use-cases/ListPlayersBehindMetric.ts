import { playersBehind, type PlayerFilter, type PlayerRow } from "../../domain/metrics/metrics.js";
import { paginate, type PageRequest, type Pagination } from "../services/paginate.js";
import { describePeriod, type ClubPeriodReader, type PeriodInfo, type RangeInput } from "../services/ClubPeriodReader.js";

export interface PlayerList {
  period: PeriodInfo;
  filter: PlayerFilter;
  /** One page, in list order. */
  players: PlayerRow[];
  pagination: Pagination;
}

export class ListPlayersBehindMetric {
  constructor(private readonly reader: ClubPeriodReader) {}

  async execute(clubId: string, input: RangeInput, filter: PlayerFilter, page: PageRequest): Promise<PlayerList> {
    const period = await this.reader.resolve(clubId, input);
    const sessions = await this.reader.sessionsIn(period, period.range);
    const { items, pagination } = paginate(playersBehind(sessions, period.now, filter), page);
    return { period: describePeriod(period), filter, players: items, pagination };
  }
}
