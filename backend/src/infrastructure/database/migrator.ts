import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type pg from "pg";

const MIGRATION_FILE = /^\d{3}_[\w-]+\.sql$/;

/**
 * Applies every `NNN_name.sql` file in `dir` that is not yet recorded in
 * `schema_migrations`, in file-name order. Each file runs in its own transaction,
 * so a failing migration leaves the database at the last good version.
 * Returns the names of the files applied by this run.
 */
export async function runMigrations(pool: pg.Pool, dir: string): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const files = (await readdir(dir)).filter((f) => MIGRATION_FILE.test(f)).sort();
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
  const done = new Set(rows.map((r) => r.name));

  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      applied.push(file);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}
