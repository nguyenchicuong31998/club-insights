"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addDays, daysInRange, formatRange, plural, weekStart } from "@/lib/format";
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

  const tab = (active: boolean) =>
    `-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
      active ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink"
    }`;

  return (
    <section aria-label="Date range" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line">
        <div role="group" aria-label="Preset ranges" className="flex flex-wrap gap-x-5">
          {PRESET_WEEKS.map((n) => (
            <button key={n} type="button" aria-pressed={activePreset === n} onClick={() => go(lastWeeks(meta.today, n))} className={tab(activePreset === n)}>
              <span className="max-sm:hidden">Last </span>{n} weeks
            </button>
          ))}
          <button type="button" aria-expanded={open} aria-pressed={!activePreset} onClick={() => setOpen((o) => !o)} className={tab(!activePreset)}>
            Custom<span className="max-sm:hidden"> dates</span>
          </button>
        </div>
        <p className="pb-2 text-sm text-ink-2 tabular">
          {pending ? (
            <span aria-live="polite">Updating…</span>
          ) : (
            <>
              <span className="font-medium text-ink">{formatRange(range.from, range.to)}</span>
              <span className="text-ink-3"> · {plural(daysInRange(range.from, range.to), "day")}, compared with </span>
              {formatRange(previousRange.from, previousRange.to)}
            </>
          )}
        </p>
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
                className="rounded-md border border-line-strong bg-surface px-2 py-1.5 text-ink"
              />
            </label>
          ))}
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:text-page">
            Show these dates
          </button>
        </form>
      )}

      {range.partial && (
        <p className="text-sm text-warn">
          This range includes today, so it isn&apos;t over yet. Its numbers will still grow; the comparison is not like for like.
        </p>
      )}
    </section>
  );
}
