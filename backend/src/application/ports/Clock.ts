/** Source of "now". The app runs on a fixed clock (Mon 5 Oct 2026 09:00 local) so numbers are reproducible. */
export interface Clock {
  now(): Date;
}
