export type BookingStatus = "booked" | "cancelled";

export interface Booking {
  id: string;
  sessionId: string;
  playerId: string;
  status: BookingStatus;
  bookedAt: Date;
  cancelledAt: Date | null;
  /** null = attendance not recorded for this booking. */
  attended: boolean | null;
}
