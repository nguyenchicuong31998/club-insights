import type { LocalDate } from "../time/localDate.js";

/** A member of one club. */
export interface Player {
  id: string;
  clubId: string;
  name: string;
  joinedOn: LocalDate;
}
