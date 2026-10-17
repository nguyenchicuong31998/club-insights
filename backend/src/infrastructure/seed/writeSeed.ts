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
    const { clubs, players, sessions, bookings } = data;
    const col = <T, K extends keyof T>(rows: T[], key: K) => rows.map((r) => r[key]);
    await client.query(
      `INSERT INTO clubs (id, name, timezone, created_on)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::date[])`,
      [col(clubs, "id"), col(clubs, "name"), col(clubs, "timezone"), col(clubs, "createdOn")],
    );
    await client.query(
      `INSERT INTO players (id, club_id, name, joined_on)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::date[])`,
      [col(players, "id"), col(players, "clubId"), col(players, "name"), col(players, "joinedOn")],
    );
    await client.query(
      `INSERT INTO sessions (id, club_id, title, starts_at, ends_at, capacity, status, attendance_recorded)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::timestamptz[], $5::timestamptz[], $6::int[], $7::text[], $8::boolean[])`,
      [col(sessions, "id"), col(sessions, "clubId"), col(sessions, "title"), col(sessions, "startsAt"),
        col(sessions, "endsAt"), col(sessions, "capacity"), col(sessions, "status"), col(sessions, "attendanceRecorded")],
    );
    await client.query(
      `INSERT INTO bookings (id, session_id, player_id, status, booked_at, cancelled_at, attended)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::timestamptz[], $6::timestamptz[], $7::boolean[])`,
      [col(bookings, "id"), col(bookings, "sessionId"), col(bookings, "playerId"), col(bookings, "status"),
        col(bookings, "bookedAt"), col(bookings, "cancelledAt"), col(bookings, "attended")],
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
