// Entry point: reads config, opens the pool and starts the HTTP server.
import { config } from "./config.js";
import { buildApp } from "./container.js";
import { createPool } from "./infrastructure/database/pool.js";

const pool = createPool(config.databaseUrl);
const app = buildApp(pool, { now: config.now, corsOrigin: config.corsOrigin });

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (now = ${config.now.toISOString()})`);
});

const shutdown = () => {
  server.close(() => void pool.end());
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
