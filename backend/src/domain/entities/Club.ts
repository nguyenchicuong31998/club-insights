import type { LocalDate } from "../time/localDate.js";

export interface Club {
  id: string;
  name: string;
  /** IANA time zone, e.g. "Asia/Ho_Chi_Minh". Weeks and date ranges are computed in this zone. */
  timezone: string;
  /** Calendar date the club was created, in its own time zone. */
  createdOn: LocalDate;
}
