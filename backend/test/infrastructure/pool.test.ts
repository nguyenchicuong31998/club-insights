/** A dropped database connection must not turn a page into a 500: reads retry once. */
import { describe, expect, it, vi } from "vitest";
import { isTransient, readQuery } from "../../src/infrastructure/database/pool.js";

const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
const terminated = new Error("Connection terminated unexpectedly");
const syntax = Object.assign(new Error('syntax error at or near "SELEC"'), { code: "42601" });

function fakePool(...outcomes: (Error | { rows: unknown[] })[]) {
  const query = vi.fn(async () => {
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  return { query } as unknown as Parameters<typeof readQuery>[0] & { query: typeof query };
}

describe("reads after a dropped connection", () => {
  it("tells connection failures apart from query errors", () => {
    expect(isTransient(reset)).toBe(true);
    expect(isTransient(terminated)).toBe(true);
    expect(isTransient(Object.assign(new Error("terminating connection"), { code: "57P01" }))).toBe(true);
    expect(isTransient(syntax)).toBe(false);
  });

  it("retries once on a fresh connection and returns the rows", async () => {
    const pool = fakePool(reset, { rows: [{ n: 1 }] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(readQuery(pool, "SELECT 1")).resolves.toEqual({ rows: [{ n: 1 }] });
    expect(pool.query).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("does not retry a real query error, and gives up after one retry", async () => {
    const bad = fakePool(syntax);
    await expect(readQuery(bad, "SELEC 1")).rejects.toThrow("syntax error");
    expect(bad.query).toHaveBeenCalledTimes(1);

    const down = fakePool(reset, terminated);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(readQuery(down, "SELECT 1")).rejects.toThrow("Connection terminated");
    expect(down.query).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
