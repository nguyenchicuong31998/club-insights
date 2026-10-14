import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "csv-parse/sync";

export interface SeedData {
  clubs: { id: string; name: string; timezone: string; createdAt: string }[];
  players: { id: string; name: string; createdAt: string }[];
  sessions: {
    id: string; clubId: string; title: string; startsAt: string; endsAt: string; capacity: number; status: string;
  }[];
  bookings: {
    id: string; sessionId: string; playerId: string; status: string; attended: boolean | null; createdAt: string;
  }[];
}

export interface Rejection {
  file: string;
  line: number;
  reason: string;
}

export interface ReadResult {
  data: SeedData;
  /** Rows read per file, before validation. */
  csvRows: Record<keyof SeedData, number>;
  rejected: Rejection[];
}

class RowError extends Error {}

// The CSVs are documented as UTC, so every timestamp must say which offset it is in.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function text(row: Record<string, string>, column: string): string {
  const value = row[column]?.trim();
  if (!value) throw new RowError(`${column} is empty`);
  return value;
}

function timestamp(row: Record<string, string>, column: string): string {
  const value = text(row, column);
  if (!TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) {
    throw new RowError(`${column} "${value}" is not an ISO-8601 timestamp with an offset`);
  }
  return new Date(value).toISOString();
}

function oneOf<T extends string>(row: Record<string, string>, column: string, allowed: readonly T[]): T {
  const value = text(row, column);
  if (!allowed.includes(value as T)) throw new RowError(`${column} "${value}" is not one of ${allowed.join("|")}`);
  return value as T;
}

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function readRows(dir: string, file: string): Promise<Record<string, string>[]> {
  const content = await readFile(join(dir, file), "utf8");
  return parse(content, { columns: true, skip_empty_lines: true, bom: true });
}

/**
 * Reads and validates the four CSVs. Invalid rows are skipped and reported rather than
 * aborting the load, so one bad line does not hide the rest of the data. Rows whose
 * parent was rejected are rejected too, keeping foreign keys consistent.
 */
export async function readCsvData(dir: string): Promise<ReadResult> {
  const rejected: Rejection[] = [];
  const data: SeedData = { clubs: [], players: [], sessions: [], bookings: [] };

  function load<T extends { id: string }>(file: string, rows: Record<string, string>[], map: (r: Record<string, string>) => T, into: T[]) {
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      try {
        const item = map(row);
        if (seen.has(item.id)) throw new RowError(`duplicate id ${item.id}`);
        seen.add(item.id);
        into.push(item);
      } catch (err) {
        if (!(err instanceof RowError)) throw err;
        rejected.push({ file, line: i + 2, reason: err.message }); // +1 header, +1 one-based
      }
    });
    return seen;
  }

  const raw = {
    clubs: await readRows(dir, "clubs.csv"),
    players: await readRows(dir, "players.csv"),
    sessions: await readRows(dir, "sessions.csv"),
    bookings: await readRows(dir, "bookings.csv"),
  };

  const clubIds = load("clubs.csv", raw.clubs, (r) => {
    const timezone = text(r, "timezone");
    if (!isTimeZone(timezone)) throw new RowError(`timezone "${timezone}" is not an IANA time zone`);
    return { id: text(r, "id"), name: text(r, "name"), timezone, createdAt: timestamp(r, "created_at") };
  }, data.clubs);

  const playerIds = load("players.csv", raw.players, (r) => (
    { id: text(r, "id"), name: text(r, "name"), createdAt: timestamp(r, "created_at") }
  ), data.players);

  const sessionIds = load("sessions.csv", raw.sessions, (r) => {
    const clubId = text(r, "club_id");
    if (!clubIds.has(clubId)) throw new RowError(`unknown club_id ${clubId}`);
    const startsAt = timestamp(r, "starts_at");
    const endsAt = timestamp(r, "ends_at");
    if (endsAt <= startsAt) throw new RowError("ends_at is not after starts_at");
    const capacity = Number(text(r, "capacity"));
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RowError(`capacity "${r.capacity}" is not a positive integer`);
    return {
      id: text(r, "id"), clubId, title: text(r, "title"), startsAt, endsAt, capacity,
      status: oneOf(r, "status", ["scheduled", "cancelled"] as const),
    };
  }, data.sessions);

  load("bookings.csv", raw.bookings, (r) => {
    const sessionId = text(r, "session_id");
    const playerId = text(r, "player_id");
    if (!sessionIds.has(sessionId)) throw new RowError(`unknown session_id ${sessionId}`);
    if (!playerIds.has(playerId)) throw new RowError(`unknown player_id ${playerId}`);
    const status = oneOf(r, "status", ["confirmed", "cancelled"] as const);
    // Blank means attendance was not recorded: keep it NULL, never coerce it to false.
    const attendedRaw = r.attended?.trim().toLowerCase() ?? "";
    if (!["", "true", "false"].includes(attendedRaw)) throw new RowError(`attended "${r.attended}" is not true|false|blank`);
    const attended = attendedRaw === "" ? null : attendedRaw === "true";
    if (status === "cancelled" && attended !== null) throw new RowError("cancelled booking has attendance recorded");
    return { id: text(r, "id"), sessionId, playerId, status, attended, createdAt: timestamp(r, "created_at") };
  }, data.bookings);

  return {
    data,
    csvRows: {
      clubs: raw.clubs.length, players: raw.players.length, sessions: raw.sessions.length, bookings: raw.bookings.length,
    },
    rejected,
  };
}
