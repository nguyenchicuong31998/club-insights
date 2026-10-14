import type { SessionFacts } from "../metrics/SessionFacts.js";

export interface SessionDetail extends SessionFacts {
  clubId: string;
  /** Cancelled bookings are not in `bookings`; shown as a count so the list still adds up. */
  cancelledBookings: number;
}

/**
 * Read side for metrics. One repository instead of separate session/booking/player ones,
 * because every metric needs sessions joined with their confirmed bookings and player names.
 */
export interface SessionRepository {
  /** Sessions (including cancelled) whose start is in [start, end), with confirmed bookings. */
  findStartingBetween(clubId: string, start: Date, end: Date): Promise<SessionFacts[]>;
  findDetail(clubId: string, sessionId: string): Promise<SessionDetail | null>;
  /** Start of the club's earliest non-cancelled session, or null if it has none. */
  firstSessionStart(clubId: string): Promise<Date | null>;
}
