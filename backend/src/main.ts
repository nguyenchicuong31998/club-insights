// Composition root: the only place that knows about every layer and wires them together.
import { GetClub } from "./application/use-cases/GetClub.js";
import { ListClubs } from "./application/use-cases/ListClubs.js";
import { config } from "./config.js";
import { createPool } from "./infrastructure/database/pool.js";
import { PgClubRepository } from "./infrastructure/repositories/PgClubRepository.js";
import { createApp } from "./interfaces/http/app.js";
import { ClubController } from "./interfaces/http/controllers/ClubController.js";

const pool = createPool(config.databaseUrl);
const clubRepository = new PgClubRepository(pool);

const app = createApp(
  { clubs: new ClubController(new ListClubs(clubRepository), new GetClub(clubRepository)) },
  config.corsOrigin,
);

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

const shutdown = () => {
  server.close(() => void pool.end());
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
