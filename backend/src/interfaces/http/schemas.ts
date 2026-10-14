import { z } from "zod";
import { ValidationError } from "../../application/errors.js";

// Shape checks only; calendar validity, from ≤ to and range length are checked in resolveRange.
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date as YYYY-MM-DD").optional();

export const rangeQuery = z.object({ from: localDate, to: localDate });

export const sessionsQuery = rangeQuery.extend({
  filter: z.enum(["held", "with_no_shows", "attendance_not_recorded"]).default("held"),
});

export const playersQuery = rangeQuery.extend({
  filter: z.enum(["active", "no_show"]).default("active"),
});

/** Parses a query string object, turning zod issues into one readable 400 message. */
export function parseQuery<T extends z.ZodType>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => `${i.path.join(".") || "query"} ${i.message}`).join("; "));
  }
  return result.data;
}
