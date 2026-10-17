/** The previous period and the change shown on every card. */
import { describe, expect, it } from "vitest";
import { resolveRange } from "../../src/application/services/ClubPeriodReader.js";
import { ValidationError } from "../../src/application/errors.js";
import { paginate } from "../../src/application/services/paginate.js";
import { change } from "../../src/domain/metrics/metrics.js";
import { lengthInDays, previousPeriod } from "../../src/domain/time/DateRange.js";
import { NOW, TZ } from "../builders.js";

describe("previous period", () => {
  it("is the same number of days, ending the day before the range starts", () => {
    expect(previousPeriod({ from: "2026-09-07", to: "2026-10-04" })).toEqual({ from: "2026-08-10", to: "2026-09-06" });
  });

  it("keeps the length for odd ranges, across month ends and leap days", () => {
    for (const range of [
      { from: "2026-10-01", to: "2026-10-01" },
      { from: "2026-03-01", to: "2026-03-31" },
      { from: "2028-03-01", to: "2028-03-10" },
    ]) {
      const prev = previousPeriod(range);
      expect(lengthInDays(prev)).toBe(lengthInDays(range));
    }
    expect(previousPeriod({ from: "2026-03-01", to: "2026-03-31" })).toEqual({ from: "2026-01-29", to: "2026-02-28" });
    expect(previousPeriod({ from: "2028-03-01", to: "2028-03-10" })).toEqual({ from: "2028-02-20", to: "2028-02-29" });
  });
});

describe("change against the previous period", () => {
  it("gives absolute and relative change", () => {
    expect(change(112, 106)).toEqual({ absolute: 6, relative: 6 / 106 });
    expect(change(22, 22)).toEqual({ absolute: 0, relative: 0 });
  });

  it("has no relative change when the previous period was 0, instead of Infinity or 100%", () => {
    expect(change(61, 0)).toEqual({ absolute: 61, relative: null });
    expect(change(0, 0)).toEqual({ absolute: 0, relative: null });
  });
});

describe("resolving the requested range", () => {
  it("uses the club's local 'today', which is already Monday in Saigon", () => {
    // 09:00 local on Mon 5 Oct. In a zone far behind UTC it would still be Sunday 4 Oct.
    expect(resolveRange({}, TZ, NOW)).toMatchObject({
      today: "2026-10-05",
      range: { from: "2026-09-07", to: "2026-10-04" },
      previous: { from: "2026-08-10", to: "2026-09-06" },
      partial: false,
    });
    expect(resolveRange({}, "Pacific/Honolulu", NOW).today).toBe("2026-10-04");
  });

  it("flags a range that reaches today as partial", () => {
    expect(resolveRange({ from: "2026-09-28", to: "2026-10-05" }, TZ, NOW).partial).toBe(true);
  });

  it.each([
    [{ from: "2026-09-07" }, "both from and to"],
    [{ from: "2026-09-31", to: "2026-10-04" }, "YYYY-MM-DD"],
    [{ from: "2026-10-04", to: "2026-09-07" }, "on or before"],
    [{ from: "2026-10-06", to: "2026-10-10" }, "after today"],
    [{ from: "2025-01-01", to: "2026-10-04" }, "at most 366 days"],
  ])("rejects %o", (input, message) => {
    expect(() => resolveRange(input, TZ, NOW)).toThrow(ValidationError);
    expect(() => resolveRange(input, TZ, NOW)).toThrow(message);
  });
});

describe("paging a list", () => {
  const rows = Array.from({ length: 7 }, (_, i) => i + 1);

  it("cuts pages in order and reports the total", () => {
    expect(paginate(rows, { page: 2, pageSize: 3 })).toEqual({
      items: [4, 5, 6],
      pagination: { page: 2, pageSize: 3, total: 7, totalPages: 3 },
    });
    expect(paginate(rows, { page: 3, pageSize: 3 }).items).toEqual([7]);
  });

  it("clamps a page past the end to the last page, and an empty list to one empty page", () => {
    expect(paginate(rows, { page: 9, pageSize: 3 }).pagination.page).toBe(3);
    expect(paginate([], { page: 2, pageSize: 3 })).toEqual({
      items: [],
      pagination: { page: 1, pageSize: 3, total: 0, totalPages: 1 },
    });
  });
});
