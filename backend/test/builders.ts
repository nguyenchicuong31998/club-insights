import type { BookingFact, SessionFacts } from "../src/domain/metrics/SessionFacts.js";

export const TZ = "Asia/Ho_Chi_Minh";
/** The brief's "now": Mon 5 Oct 2026 09:00 in Saigon. */
export const NOW = new Date("2026-10-05T09:00:00+07:00");

let seq = 0;

/** A booking for player `p1`, `p2`… true = attended, false = no-show, null = not recorded. */
export function booking(playerId: string, attended: boolean | null): BookingFact {
  return { bookingId: `b${++seq}`, playerId, playerName: `Player ${playerId}`, attended };
}

/** A two-hour session. `startsAt` takes an ISO timestamp with an offset, e.g. "2026-09-14T18:00:00+07:00". */
export function session(startsAt: string, bookings: BookingFact[] = [], overrides: Partial<SessionFacts> = {}): SessionFacts {
  const start = new Date(startsAt);
  return {
    id: `s${++seq}`,
    title: "Open play",
    startsAt: start,
    endsAt: new Date(start.getTime() + 2 * 3_600_000),
    capacity: 16,
    status: "scheduled",
    bookings,
    ...overrides,
  };
}

/** `n` bookings by players `${prefix}1…n`, all with the same attendance. */
export const bookings = (prefix: string, n: number, attended: boolean | null): BookingFact[] =>
  Array.from({ length: n }, (_, i) => booking(`${prefix}${i + 1}`, attended));
