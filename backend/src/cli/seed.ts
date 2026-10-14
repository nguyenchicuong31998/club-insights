/**
 * Loads backend/data/*.csv into the database, replacing whatever is there.
 *   npm run db:seed                 always reload
 *   npm run db:seed -- --if-empty   only when the clubs table is empty (used by `npm run dev`)
 * Invalid rows are skipped and listed. Exits non-zero if a table's count does not match the valid rows read.
 */
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { createPool } from "../infrastructure/database/pool.js";
import { readCsvData } from "../infrastructure/seed/readCsvData.js";
import { isDatabaseEmpty, writeSeed } from "../infrastructure/seed/writeSeed.js";

const dataDir = fileURLToPath(new URL("../../data", import.meta.url));
const ifEmpty = process.argv.includes("--if-empty");

const pool = createPool(config.databaseUrl);
try {
  if (ifEmpty && !(await isDatabaseEmpty(pool))) {
    console.log("Database already has data; skipping seed (run `npm run db:seed` to reload).");
  } else {
    const { data, csvRows, rejected } = await readCsvData(dataDir);
    const loaded = await writeSeed(pool, data);

    console.table(Object.fromEntries((Object.keys(csvRows) as (keyof typeof csvRows)[]).map((table) => [
      table, { "csv rows": csvRows[table], valid: data[table].length, "in database": loaded[table] },
    ])));
    for (const r of rejected) console.warn(`rejected ${r.file}:${r.line} ${r.reason}`);

    const mismatched = (Object.keys(loaded) as (keyof typeof loaded)[]).filter((t) => loaded[t] !== data[t].length);
    if (mismatched.length) {
      console.error(`Row count mismatch in: ${mismatched.join(", ")}`);
      process.exitCode = 1;
    }
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
