import type pg from "pg";
import type { SeedData } from "./readCsvData.js";

export type TableCounts = Record<keyof SeedData, number>;

/**
 * Replaces all data with `data` in one transaction: either the whole load lands or
 * nothing changes. Running it twice gives the same database. Returns the row counts
 * read back from the database after the insert.
 */
export async function writeSeed(pool: pg.Pool, data: SeedData): Promise<TableCounts> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE bookings, sessions, players, clubs");

    // unnest() inserts each table in a single statement instead of one round trip per row.
    await client.query(
      `INSERT INTO clubs (id, name, timezone, created_at)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::timestamptz[])`,
      [data.clubs.map((c) => c.id), data.clubs.map((c) => c.name), data.clubs.map((c) => c.timezone),
        data.clubs.map((c) => c.createdAt)],
    );
    await client.query(
      `INSERT INTO players (id, name, created_at)
       SELECT * FROM unnest($1::text[], $2::text[], $3::timestamptz[])`,
      [data.players.map((p) => p.id), data.players.map((p) => p.name), data.players.map((p) => p.createdAt)],
    );
    await client.query(
      `INSERT INTO sessions (id, club_id, title, starts_at, ends_at, capacity, status)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::timestamptz[], $5::timestamptz[], $6::int[], $7::text[])`,
      [data.sessions.map((s) => s.id), data.sessions.map((s) => s.clubId), data.sessions.map((s) => s.title),
        data.sessions.map((s) => s.startsAt), data.sessions.map((s) => s.endsAt), data.sessions.map((s) => s.capacity),
        data.sessions.map((s) => s.status)],
    );
    await client.query(
      `INSERT INTO bookings (id, session_id, player_id, status, attended, created_at)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::boolean[], $6::timestamptz[])`,
      [data.bookings.map((b) => b.id), data.bookings.map((b) => b.sessionId), data.bookings.map((b) => b.playerId),
        data.bookings.map((b) => b.status), data.bookings.map((b) => b.attended), data.bookings.map((b) => b.createdAt)],
    );

    const { rows } = await client.query<TableCounts>(`
      SELECT (SELECT count(*) FROM clubs)::int    AS clubs,
             (SELECT count(*) FROM players)::int  AS players,
             (SELECT count(*) FROM sessions)::int AS sessions,
             (SELECT count(*) FROM bookings)::int AS bookings`);
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function isDatabaseEmpty(pool: pg.Pool): Promise<boolean> {
  const { rows } = await pool.query<{ empty: boolean }>("SELECT NOT EXISTS (SELECT 1 FROM clubs) AS empty");
  return rows[0].empty;
}
