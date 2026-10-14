import { playersBehind, type PlayerFilter, type PlayerRow } from "../../domain/metrics/metrics.js";
import { describePeriod, type ClubPeriodReader, type PeriodInfo, type RangeInput } from "../services/ClubPeriodReader.js";

export interface PlayerList {
  period: PeriodInfo;
  filter: PlayerFilter;
  players: PlayerRow[];
}

export class ListPlayersBehindMetric {
  constructor(private readonly reader: ClubPeriodReader) {}

  async execute(clubId: string, input: RangeInput, filter: PlayerFilter): Promise<PlayerList> {
    const period = await this.reader.resolve(clubId, input);
    const sessions = await this.reader.sessionsIn(period, period.range);
    return {
      period: describePeriod(period),
      filter,
      players: playersBehind(sessions, period.now, filter),
    };
  }
}
