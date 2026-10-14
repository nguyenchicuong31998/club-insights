import type { SessionStatus } from "../entities/Session.js";

/** A confirmed booking as the metrics see it. Cancelled bookings never reach the metrics. */
export interface BookingFact {
  bookingId: string;
  playerId: string;
  playerName: string;
  /** true = attended, false = no-show, null = attendance not recorded (unknown). */
  attended: boolean | null;
}

/** A session together with its confirmed bookings: the only input every metric is computed from. */
export interface SessionFacts {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: SessionStatus;
  bookings: BookingFact[];
}
