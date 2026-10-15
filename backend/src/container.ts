// Wires every layer into an Express app. Used by main.ts and by the API integration tests.
import type { Pool } from "pg";
import { ClubPeriodReader } from "./application/services/ClubPeriodReader.js";
import { GetClub } from "./application/use-cases/GetClub.js";
import { GetClubSummary } from "./application/use-cases/GetClubSummary.js";
import { GetSessionDetail } from "./application/use-cases/GetSessionDetail.js";
import { GetWeeklySeries } from "./application/use-cases/GetWeeklySeries.js";
import { ListClubs } from "./application/use-cases/ListClubs.js";
import { ListPlayersBehindMetric } from "./application/use-cases/ListPlayersBehindMetric.js";
import { ListSessionsBehindMetric } from "./application/use-cases/ListSessionsBehindMetric.js";
import { FixedClock } from "./infrastructure/clock/FixedClock.js";
import { PgClubRepository } from "./infrastructure/repositories/PgClubRepository.js";
import { PgSessionRepository } from "./infrastructure/repositories/PgSessionRepository.js";
import { createApp } from "./interfaces/http/app.js";
import { ClubController } from "./interfaces/http/controllers/ClubController.js";
import { MetricsController } from "./interfaces/http/controllers/MetricsController.js";

export function buildApp(pool: Pool, options: { now: Date; corsOrigin: string }) {
  const clubRepository = new PgClubRepository(pool);
  const sessionRepository = new PgSessionRepository(pool);
  const clock = new FixedClock(options.now);
  const reader = new ClubPeriodReader(clubRepository, sessionRepository, clock);

  return createApp(
    {
      clubs: new ClubController(new ListClubs(clubRepository), new GetClub(clubRepository)),
      metrics: new MetricsController(
        new GetClubSummary(reader),
        new GetWeeklySeries(reader),
        new ListSessionsBehindMetric(reader),
        new ListPlayersBehindMetric(reader),
        new GetSessionDetail(sessionRepository, clock),
      ),
    },
    options.corsOrigin,
  );
}
