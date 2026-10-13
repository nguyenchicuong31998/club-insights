export type BookingStatus = "confirmed" | "cancelled";

export interface Booking {
  id: string;
  sessionId: string;
  playerId: string;
  status: BookingStatus;
  /** null = attendance not recorded for this booking. */
  attended: boolean | null;
  createdAt: Date;
}
