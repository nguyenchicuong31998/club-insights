import { playersBehind, type PlayerFilter, type PlayerRow } from "../../domain/metrics/metrics.js";
import type { DateRange } from "../../domain/time/DateRange.js";
import type { ClubPeriodReader, RangeInput } from "../services/ClubPeriodReader.js";

export interface PlayerList {
  range: DateRange & { partial: boolean };
  filter: PlayerFilter;
  players: PlayerRow[];
}

export class ListPlayersBehindMetric {
  constructor(private readonly reader: ClubPeriodReader) {}

  async execute(clubId: string, input: RangeInput, filter: PlayerFilter): Promise<PlayerList> {
    const period = await this.reader.resolve(clubId, input);
    const sessions = await this.reader.sessionsIn(period, period.range);
    return {
      range: { ...period.range, partial: period.partial },
      filter,
      players: playersBehind(sessions, period.now, filter),
    };
  }
}
