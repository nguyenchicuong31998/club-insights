export type SessionStatus = "scheduled" | "cancelled";

export interface Session {
  id: string;
  clubId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: SessionStatus;
}
