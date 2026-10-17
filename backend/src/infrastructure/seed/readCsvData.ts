import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { isLocalDate } from "../../domain/time/localDate.js";

export interface SeedData {
  clubs: { id: string; name: string; timezone: string; createdOn: string }[];
  players: { id: string; clubId: string; name: string; joinedOn: string }[];
  sessions: {
    id: string; clubId: string; title: string; startsAt: string; endsAt: string; capacity: number;
    status: "scheduled" | "cancelled"; attendanceRecorded: boolean;
  }[];
  bookings: {
    id: string; sessionId: string; playerId: string; status: "booked" | "cancelled";
    bookedAt: string; cancelledAt: string | null; attended: boolean | null;
  }[];
}

export interface Issue {
  file: string;
  line: number;
  reason: string;
}

export interface ReadResult {
  data: SeedData;
  /** Rows read per file, before validation. */
  csvRows: Record<keyof SeedData, number>;
  /** Rows skipped entirely. */
  rejected: Issue[];
  /** Rows kept with a value corrected, e.g. attendance on a session marked as not recorded. */
  adjusted: Issue[];
}

class RowError extends Error {}

// The export is UTC, but any explicit offset is accepted. A timestamp without one is ambiguous.
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function text(row: Record<string, string>, column: string): string {
  const value = row[column]?.trim();
  if (!value) throw new RowError(`${column} is empty`);
  return value;
}

function timestamp(row: Record<string, string>, column: string): string {
  const value = text(row, column);
  const m = TIMESTAMP.exec(value);
  // Date.parse rolls 2026-02-30 over to 2 March, so the calendar date and clock are checked first.
  if (!m || !isLocalDate(m[1]) || +m[2] > 23 || +m[3] > 59 || +(m[4] ?? 0) > 59 || Number.isNaN(Date.parse(value))) {
    throw new RowError(`${column} "${value}" is not an ISO-8601 timestamp with an offset`);
  }
  return new Date(value).toISOString();
}

function date(row: Record<string, string>, column: string): string {
  const value = text(row, column);
  if (!isLocalDate(value)) throw new RowError(`${column} "${value}" is not a date as YYYY-MM-DD`);
  return value;
}

function positiveInt(row: Record<string, string>, column: string): number {
  const value = text(row, column);
  if (!/^\d+$/.test(value) || Number(value) <= 0) throw new RowError(`${column} "${value}" is not a positive whole number`);
  return Number(value);
}

function oneOf<T extends string>(row: Record<string, string>, column: string, allowed: readonly T[]): T {
  const value = text(row, column).toLowerCase();
  if (!allowed.includes(value as T)) throw new RowError(`${column} "${row[column]}" is not one of ${allowed.join("|")}`);
  return value as T;
}

/** true / false, or null for blank. Never turns blank into false. */
function optionalBoolean(row: Record<string, string>, column: string): boolean | null {
  const value = row[column]?.trim().toLowerCase() ?? "";
  if (value === "") return null;
  if (value !== "true" && value !== "false") throw new RowError(`${column} "${row[column]}" is not true|false|blank`);
  return value === "true";
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
 * Reads and validates the four CSVs. Invalid rows are skipped and reported rather than aborting
 * the load, so one bad line does not hide the rest of the data. Rows whose parent was rejected
 * are rejected too, keeping foreign keys consistent.
 */
export async function readCsvData(dir: string): Promise<ReadResult> {
  const rejected: Issue[] = [];
  const adjusted: Issue[] = [];
  const data: SeedData = { clubs: [], players: [], sessions: [], bookings: [] };

  function load<T extends { id: string }>(
    file: string,
    rows: Record<string, string>[],
    map: (r: Record<string, string>, note: (reason: string) => void) => T,
    into: T[],
  ): Map<string, T> {
    const seen = new Map<string, T>();
    rows.forEach((row, i) => {
      const line = i + 2; // +1 header, +1 one-based
      try {
        const item = map(row, (reason) => adjusted.push({ file, line, reason }));
        if (seen.has(item.id)) throw new RowError(`duplicate id ${item.id}`);
        seen.set(item.id, item);
        into.push(item);
      } catch (err) {
        if (!(err instanceof RowError)) throw err;
        rejected.push({ file, line, reason: err.message });
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

  const clubs = load("clubs.csv", raw.clubs, (r) => {
    const timezone = text(r, "time_zone");
    if (!isTimeZone(timezone)) throw new RowError(`time_zone "${timezone}" is not an IANA time zone`);
    return { id: text(r, "club_id"), name: text(r, "name"), timezone, createdOn: date(r, "created_at") };
  }, data.clubs);

  const players = load("players.csv", raw.players, (r) => {
    const clubId = text(r, "club_id");
    if (!clubs.has(clubId)) throw new RowError(`unknown club_id ${clubId}`);
    return { id: text(r, "player_id"), clubId, name: text(r, "name"), joinedOn: date(r, "joined_club_at") };
  }, data.players);

  const sessions = load("sessions.csv", raw.sessions, (r) => {
    const clubId = text(r, "club_id");
    if (!clubs.has(clubId)) throw new RowError(`unknown club_id ${clubId}`);
    const startsAt = timestamp(r, "starts_at");
    const endsAt = new Date(Date.parse(startsAt) + positiveInt(r, "duration_minutes") * 60_000).toISOString();
    const attendanceRecorded = optionalBoolean(r, "attendance_recorded");
    if (attendanceRecorded === null) throw new RowError("attendance_recorded is empty");
    return {
      id: text(r, "session_id"), clubId, title: text(r, "title"), startsAt, endsAt,
      capacity: positiveInt(r, "places"),
      status: oneOf(r, "status", ["scheduled", "cancelled"] as const),
      attendanceRecorded,
    };
  }, data.sessions);

  const live = new Set<string>(); // session|player pairs with a live booking
  load("bookings.csv", raw.bookings, (r, note) => {
    const sessionId = text(r, "session_id");
    const playerId = text(r, "player_id");
    const session = sessions.get(sessionId);
    const player = players.get(playerId);
    if (!session) throw new RowError(`unknown session_id ${sessionId}`);
    if (!player) throw new RowError(`unknown player_id ${playerId}`);
    if (player.clubId !== session.clubId) throw new RowError(`player ${playerId} is not a member of ${session.clubId}`);

    const status = oneOf(r, "status", ["booked", "cancelled"] as const);
    const bookedAt = timestamp(r, "booked_at");
    const cancelledAt = r.cancelled_at?.trim() ? timestamp(r, "cancelled_at") : null;
    if (status === "cancelled" && !cancelledAt) throw new RowError("cancelled booking has no cancelled_at");
    if (status === "booked" && cancelledAt) throw new RowError("booking has cancelled_at but status booked");

    let attended = optionalBoolean(r, "attended");
    if (status === "cancelled" && attended !== null) throw new RowError("cancelled booking has attendance recorded");
    if (status === "booked") {
      if (live.has(`${sessionId}|${playerId}`)) throw new RowError(`player ${playerId} already has a booking for ${sessionId}`);
      live.add(`${sessionId}|${playerId}`);
      if (!session.attendanceRecorded && attended !== null) {
        // The session says nobody took attendance, so a stray value cannot be trusted.
        note(`attended "${r.attended}" ignored: session ${sessionId} has attendance_recorded=false`);
        attended = null;
      } else if (session.attendanceRecorded && attended === null && session.status === "scheduled") {
        note(`attended is blank although session ${sessionId} recorded attendance; kept as not recorded`);
      }
    }
    return { id: text(r, "booking_id"), sessionId, playerId, status, bookedAt, cancelledAt, attended };
  }, data.bookings);

  return {
    data,
    csvRows: {
      clubs: raw.clubs.length, players: raw.players.length, sessions: raw.sessions.length, bookings: raw.bookings.length,
    },
    rejected,
    adjusted,
  };
}
