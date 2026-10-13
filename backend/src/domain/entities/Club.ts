export interface Club {
  id: string;
  name: string;
  /** IANA time zone, e.g. "Asia/Ho_Chi_Minh". Weeks and date ranges are computed in this zone. */
  timezone: string;
  createdAt: Date;
}
