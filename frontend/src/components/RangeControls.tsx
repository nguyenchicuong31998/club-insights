"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addDays, daysInRange, formatRange, weekStart } from "@/lib/format";
import type { Meta } from "@/lib/types";
import { hrefWith, type PageState } from "@/lib/url";

const PRESET_WEEKS = [4, 12, 26];

/** Last N complete Monday–Sunday weeks before the current week. */
function lastWeeks(today: string, n: number) {
  const monday = weekStart(today);
  return { from: addDays(monday, -7 * n), to: addDays(monday, -1) };
}

export function RangeControls({ state, meta }: { state: PageState; meta: Meta }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState({ from: meta.range.from, to: meta.range.to });
  const [open, setOpen] = useState(false);
  const go = (range: { from: string; to: string }) =>
    startTransition(() => router.push(hrefWith(state, { ...range, view: state.view, session: undefined })));

  const { range, previousRange } = meta;
  const activePreset = PRESET_WEEKS.find((n) => {
    const p = lastWeeks(meta.today, n);
    return p.from === range.from && p.to === range.to;
  });

  return (
    <section aria-label="Date range" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Preset ranges" className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
          {PRESET_WEEKS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={activePreset === n}
              onClick={() => go(lastWeeks(meta.today, n))}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activePreset === n ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
              }`}
            >
              Last {n} weeks
            </button>
          ))}
          <button
            type="button"
            aria-expanded={open}
            aria-pressed={!activePreset}
            onClick={() => setOpen((o) => !o)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !activePreset ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            Custom…
          </button>
        </div>
        {pending && <span className="text-sm text-ink-3" aria-live="polite">Updating…</span>}
      </div>

      {open && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            go(custom);
          }}
        >
          {(["from", "to"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1 text-sm text-ink-2">
              {key === "from" ? "From" : "To (inclusive)"}
              <input
                type="date"
                required
                max={meta.today}
                value={custom[key]}
                onChange={(e) => setCustom((c) => ({ ...c, [key]: e.target.value }))}
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-ink"
              />
            </label>
          ))}
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Apply
          </button>
        </form>
      )}

      <p className="text-sm text-ink-2">
        <span className="font-semibold text-ink">{formatRange(range.from, range.to)}</span>
        {" "}({daysInRange(range.from, range.to)} days)
        <span className="text-ink-3"> · compared with </span>
        <span className="font-medium text-ink">{formatRange(previousRange.from, previousRange.to)}</span>
        {range.partial && (
          <span className="ml-2 inline-block rounded bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn">
            Includes today — not over yet
          </span>
        )}
      </p>
    </section>
  );
}
