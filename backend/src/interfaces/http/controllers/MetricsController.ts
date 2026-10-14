import type { Request, Response } from "express";
import type { PeriodInfo } from "../../../application/services/ClubPeriodReader.js";
import type { GetClubSummary } from "../../../application/use-cases/GetClubSummary.js";
import type { GetSessionDetail } from "../../../application/use-cases/GetSessionDetail.js";
import type { GetWeeklySeries } from "../../../application/use-cases/GetWeeklySeries.js";
import type { ListPlayersBehindMetric } from "../../../application/use-cases/ListPlayersBehindMetric.js";
import type { ListSessionsBehindMetric } from "../../../application/use-cases/ListSessionsBehindMetric.js";
import { DEFINITIONS } from "../../../domain/metrics/definitions.js";
import { parseQuery, playersQuery, rangeQuery, sessionsQuery } from "../schemas.js";

type ClubParams = Request<{ id: string }>;

/**
 * Every range-based response has the same envelope: `data` for the payload and `meta` for the
 * resolved period (local dates and UTC bounds), the club time zone, "now", and the definitions.
 */
const envelope = <T extends { period: PeriodInfo }>({ period, ...data }: T) => ({
  data,
  meta: { ...period, definitions: DEFINITIONS },
});

export class MetricsController {
  constructor(
    private readonly getSummary: GetClubSummary,
    private readonly getWeekly: GetWeeklySeries,
    private readonly listSessions: ListSessionsBehindMetric,
    private readonly listPlayers: ListPlayersBehindMetric,
    private readonly getSessionDetail: GetSessionDetail,
  ) {}

  summary = async (req: ClubParams, res: Response) => {
    res.json(envelope(await this.getSummary.execute(req.params.id, parseQuery(rangeQuery, req.query))));
  };

  weekly = async (req: ClubParams, res: Response) => {
    res.json(envelope(await this.getWeekly.execute(req.params.id, parseQuery(rangeQuery, req.query))));
  };

  sessions = async (req: ClubParams, res: Response) => {
    const { filter, ...range } = parseQuery(sessionsQuery, req.query);
    res.json(envelope(await this.listSessions.execute(req.params.id, range, filter)));
  };

  players = async (req: ClubParams, res: Response) => {
    const { filter, ...range } = parseQuery(playersQuery, req.query);
    res.json(envelope(await this.listPlayers.execute(req.params.id, range, filter)));
  };

  sessionDetail = async (req: Request<{ id: string; sessionId: string }>, res: Response) => {
    res.json({ data: await this.getSessionDetail.execute(req.params.id, req.params.sessionId) });
  };
}
