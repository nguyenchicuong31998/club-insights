/**
 * Every number on the dashboard is computed here, from SessionFacts, by pure functions.
 * Summary cards, weekly chart and drill-down lists all call these, so a headline number
 * and the list behind it cannot disagree. Definitions: docs/metrics.md.
 */
import type { BookingFact, SessionFacts } from "./SessionFacts.js";

/** Not cancelled and already started. Sessions with no bookings still count. */
export const isHeld = (session: SessionFacts, now: Date): boolean =>
  session.status === "scheduled" && session.startsAt < now;

/** A booking counts towards "active" unless it was recorded as a no-show. */
const playedOrPresumed = (b: BookingFact) => b.attended !== false;

export type AttendanceStatus = "recorded" | "partly_recorded" | "not_recorded" | "no_bookings";

export function attendanceStatus(session: SessionFacts): AttendanceStatus {
  const recorded = session.bookings.filter((b) => b.attended !== null).length;
  if (session.bookings.length === 0) return "no_bookings";
  if (recorded === 0) return "not_recorded";
  return recorded === session.bookings.length ? "recorded" : "partly_recorded";
}

export interface NoShowMetric {
  /** null = Unknown: no booking in the period had attendance recorded. Never reported as 0. */
  count: number | null;
  /** No-shows ÷ bookings with attendance recorded (0–1), or null when Unknown. */
  rate: number | null;
  /** Coverage: bookings with attendance recorded, out of all confirmed bookings. */
  recordedBookings: number;
  confirmedBookings: number;
  sessionsWithAttendance: number;
}

export interface PeriodMetrics {
  sessionsHeld: number;
  activePlayers: number;
  noShows: NoShowMetric;
}

/** Metrics for one period. `sessions` must already be limited to the period. */
export function computePeriodMetrics(sessions: SessionFacts[], now: Date): PeriodMetrics {
  const held = sessions.filter((s) => isHeld(s, now));
  const bookings = held.flatMap((s) => s.bookings);
  const recorded = bookings.filter((b) => b.attended !== null);
  const noShows = recorded.filter((b) => b.attended === false).length;

  return {
    sessionsHeld: held.length,
    activePlayers: new Set(bookings.filter(playedOrPresumed).map((b) => b.playerId)).size,
    noShows: {
      count: recorded.length ? noShows : null,
      rate: recorded.length ? noShows / recorded.length : null,
      recordedBookings: recorded.length,
      confirmedBookings: bookings.length,
      sessionsWithAttendance: held.filter((s) => s.bookings.some((b) => b.attended !== null)).length,
    },
  };
}

export interface AttendanceBySessionType {
  /** Sessions are grouped by title: a club's recurring slots ("Tuesday Open Play"). */
  title: string;
  sessionsHeld: number;
  sessionsWithAttendance: number;
  recordedBookings: number;
  noShows: number;
}

/**
 * Where attendance was taken, per recurring session. The no-show rate only describes the sessions
 * that took attendance, so a host needs to see which ones those are. Most-held first.
 */
export function attendanceBySessionType(sessions: SessionFacts[], now: Date): AttendanceBySessionType[] {
  const rows = new Map<string, AttendanceBySessionType>();
  for (const s of sessions.filter((x) => isHeld(x, now))) {
    let row = rows.get(s.title);
    if (!row) {
      row = { title: s.title, sessionsHeld: 0, sessionsWithAttendance: 0, recordedBookings: 0, noShows: 0 };
      rows.set(s.title, row);
    }
    const recorded = s.bookings.filter((b) => b.attended !== null);
    row.sessionsHeld++;
    if (recorded.length) row.sessionsWithAttendance++;
    row.recordedBookings += recorded.length;
    row.noShows += recorded.filter((b) => b.attended === false).length;
  }
  return [...rows.values()].sort((a, b) => b.sessionsHeld - a.sessionsHeld || a.title.localeCompare(b.title));
}

export interface Change {
  /** current − previous (for a rate: the difference in rate, e.g. 0.023 = +2.3 points). */
  absolute: number;
  /** Relative change (0.057 = +5.7%), or null when previous is 0. */
  relative: number | null;
}

/** null when either side is unknown: the UI shows "—" rather than inventing a change. */
export function change(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  return { absolute: current - previous, relative: previous === 0 ? null : (current - previous) / previous };
}

// ---- drill-down rows -----------------------------------------------------------------------

export interface SessionRow {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  confirmedBookings: number;
  attended: number;
  noShows: number;
  notRecorded: number;
  attendanceStatus: AttendanceStatus;
}

export function toSessionRow(s: SessionFacts): SessionRow {
  const count = (v: boolean | null) => s.bookings.filter((b) => b.attended === v).length;
  return {
    id: s.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, capacity: s.capacity,
    confirmedBookings: s.bookings.length,
    attended: count(true), noShows: count(false), notRecorded: count(null),
    attendanceStatus: attendanceStatus(s),
  };
}

export type SessionFilter = "held" | "with_no_shows" | "attendance_not_recorded";

/** The sessions behind "Sessions held" (and its no-show / coverage subsets), newest first. */
export function sessionsBehind(sessions: SessionFacts[], now: Date, filter: SessionFilter): SessionRow[] {
  return sessions
    .filter((s) => isHeld(s, now))
    .map(toSessionRow)
    .filter((r) => filter === "held"
      || (filter === "with_no_shows" && r.noShows > 0)
      || (filter === "attendance_not_recorded" && r.notRecorded > 0))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
}

export interface PlayerRow {
  id: string;
  name: string;
  /** Sessions counted towards "active": attended or attendance not recorded. */
  sessionsPlayed: number;
  attended: number;
  noShows: number;
  notRecorded: number;
  lastSessionAt: Date;
}

export type PlayerFilter = "active" | "no_show";

/** The players behind "Active players" or "No-shows", most sessions first. */
export function playersBehind(sessions: SessionFacts[], now: Date, filter: PlayerFilter): PlayerRow[] {
  const rows = new Map<string, PlayerRow>();
  for (const s of sessions.filter((x) => isHeld(x, now))) {
    for (const b of s.bookings) {
      let row = rows.get(b.playerId);
      if (!row) {
        row = { id: b.playerId, name: b.playerName, sessionsPlayed: 0, attended: 0, noShows: 0, notRecorded: 0, lastSessionAt: s.startsAt };
        rows.set(b.playerId, row);
      }
      if (playedOrPresumed(b)) row.sessionsPlayed++;
      if (b.attended === true) row.attended++;
      else if (b.attended === false) row.noShows++;
      else row.notRecorded++;
      if (s.startsAt > row.lastSessionAt) row.lastSessionAt = s.startsAt;
    }
  }
  return [...rows.values()]
    .filter((r) => (filter === "active" ? r.sessionsPlayed > 0 : r.noShows > 0))
    .sort((a, b) => (filter === "active" ? b.sessionsPlayed - a.sessionsPlayed : b.noShows - a.noShows)
      || a.name.localeCompare(b.name));
}
