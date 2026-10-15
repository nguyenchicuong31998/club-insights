/** Weeks and ranges are in the club's time zone. The data is in UTC, so every boundary is a trap. */
import { describe, expect, it } from "vitest";
import { defaultRange, toInstants, weekStartOf, weeksOverlapping } from "../../src/domain/time/DateRange.js";
import { addDays, isLocalDate, isoWeekday, localDateOf, startOfLocalDay } from "../../src/domain/time/localDate.js";
import { TZ } from "../builders.js";

const weekOf = (utc: string, tz = TZ) => weekStartOf(localDateOf(new Date(utc), tz));

describe("week boundaries in Asia/Ho_Chi_Minh (UTC+7)", () => {
  it("puts Sunday 23:30 local in the week that is ending", () => {
    // Sun 13 Sep 23:30 local = Sun 13 Sep 16:30 UTC.
    expect(localDateOf(new Date("2026-09-13T16:30:00Z"), TZ)).toBe("2026-09-13");
    expect(weekOf("2026-09-13T16:30:00Z")).toBe("2026-09-07");
  });

  it("puts Monday 00:30 local in the new week, although it is still Sunday in UTC", () => {
    // Mon 14 Sep 00:30 local = Sun 13 Sep 17:30 UTC.
    expect(localDateOf(new Date("2026-09-13T17:30:00Z"), TZ)).toBe("2026-09-14");
    expect(weekOf("2026-09-13T17:30:00Z")).toBe("2026-09-14");
  });

  it("puts the Monday 06:00 session in its local week, not the previous UTC week", () => {
    // Mon 7 Sep 06:00 local = Sun 6 Sep 23:00 UTC. A UTC week would put it in the week of 31 Aug.
    const utc = "2026-09-06T23:00:00Z";
    expect(weekStartOf(new Date(utc).toISOString().slice(0, 10))).toBe("2026-08-31");
    expect(weekOf(utc)).toBe("2026-09-07");
  });

  it("starts a local day at 17:00 UTC the day before", () => {
    expect(startOfLocalDay("2026-09-07", TZ).toISOString()).toBe("2026-09-06T17:00:00.000Z");
  });

  it("turns an inclusive local range into a half-open UTC interval", () => {
    const { start, end } = toInstants({ from: "2026-09-07", to: "2026-10-04" }, TZ);
    expect(start.toISOString()).toBe("2026-09-06T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-04T17:00:00.000Z");
    // Sun 4 Oct 23:59 local is inside; Mon 5 Oct 00:00 local is the (excluded) end.
    expect(new Date("2026-10-04T23:59:00+07:00") < end).toBe(true);
    expect(new Date("2026-10-05T00:00:00+07:00").getTime()).toBe(end.getTime());
  });
});

describe("time zones with daylight saving", () => {
  it("finds local midnight on both sides of a DST change", () => {
    // New York moved to UTC-4 at 02:00 on Sun 8 Mar 2026.
    expect(startOfLocalDay("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(startOfLocalDay("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("works for zones ahead of UTC with half-hour offsets", () => {
    expect(startOfLocalDay("2026-09-07", "Asia/Kolkata").toISOString()).toBe("2026-09-06T18:30:00.000Z");
    expect(localDateOf(new Date("2026-09-06T18:29:00Z"), "Asia/Kolkata")).toBe("2026-09-06");
  });
});

describe("calendar dates", () => {
  it("rejects dates that do not exist", () => {
    expect(isLocalDate("2026-02-28")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-9-7")).toBe(false);
  });

  it("knows Monday from Sunday and crosses months and years", () => {
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(isoWeekday("2026-10-04")).toBe(7);
    expect(weekStartOf("2026-10-04")).toBe("2026-09-28");
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekStartOf("2027-01-03")).toBe("2026-12-28");
  });
});

describe("default range and weeks", () => {
  it("defaults to the last 4 complete Monday–Sunday weeks", () => {
    expect(defaultRange("2026-10-05")).toEqual({ from: "2026-09-07", to: "2026-10-04" });
    // On a Sunday the current week is not complete yet, so it is left out.
    expect(defaultRange("2026-10-04")).toEqual({ from: "2026-08-31", to: "2026-09-27" });
  });

  it("marks weeks that are cut by the range or still in progress", () => {
    const weeks = weeksOverlapping({ from: "2026-09-09", to: "2026-10-05" }, "2026-10-05");
    expect(weeks.map((w) => [w.start, w.partial])).toEqual([
      ["2026-09-07", "starts_before_range"],
      ["2026-09-14", null],
      ["2026-09-21", null],
      ["2026-09-28", null],
      ["2026-10-05", "in_progress"],
    ]);
    expect(weeksOverlapping({ from: "2026-09-07", to: "2026-09-16" }, "2026-10-05").at(-1)?.partial).toBe("ends_after_range");
  });
});
