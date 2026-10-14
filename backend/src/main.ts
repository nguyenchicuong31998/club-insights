// Composition root: the only place that knows about every layer and wires them together.
import { ClubPeriodReader } from "./application/services/ClubPeriodReader.js";
import { GetClub } from "./application/use-cases/GetClub.js";
import { GetClubSummary } from "./application/use-cases/GetClubSummary.js";
import { GetSessionDetail } from "./application/use-cases/GetSessionDetail.js";
import { GetWeeklySeries } from "./application/use-cases/GetWeeklySeries.js";
import { ListClubs } from "./application/use-cases/ListClubs.js";
import { ListPlayersBehindMetric } from "./application/use-cases/ListPlayersBehindMetric.js";
import { ListSessionsBehindMetric } from "./application/use-cases/ListSessionsBehindMetric.js";
import { config } from "./config.js";
import { FixedClock } from "./infrastructure/clock/FixedClock.js";
import { createPool } from "./infrastructure/database/pool.js";
import { PgClubRepository } from "./infrastructure/repositories/PgClubRepository.js";
import { PgSessionRepository } from "./infrastructure/repositories/PgSessionRepository.js";
import { createApp } from "./interfaces/http/app.js";
import { ClubController } from "./interfaces/http/controllers/ClubController.js";
import { MetricsController } from "./interfaces/http/controllers/MetricsController.js";

const pool = createPool(config.databaseUrl);
const clubRepository = new PgClubRepository(pool);
const sessionRepository = new PgSessionRepository(pool);
const clock = new FixedClock(config.now);
const reader = new ClubPeriodReader(clubRepository, sessionRepository, clock);

const app = createApp(
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
  config.corsOrigin,
);

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (now = ${config.now.toISOString()})`);
});

const shutdown = () => {
  server.close(() => void pool.end());
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
