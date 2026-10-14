import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { createPool } from "../infrastructure/database/pool.js";
import { runMigrations } from "../infrastructure/database/migrator.js";

// Same relative depth from src/cli and dist/cli, so this resolves to backend/db/migrations in both.
const migrationsDir = fileURLToPath(new URL("../../db/migrations", import.meta.url));

const pool = createPool(config.databaseUrl);
try {
  const applied = await runMigrations(pool, migrationsDir);
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database schema is up to date.");
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
