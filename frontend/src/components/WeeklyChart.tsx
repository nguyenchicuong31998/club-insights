"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatCount, formatDay, formatPercent } from "@/lib/format";
import type { WeeklyPoint } from "@/lib/types";
import { CHART_METRICS, type ChartMetric } from "@/lib/url";

const METRIC_LABEL: Record<ChartMetric, string> = {
  activePlayers: "Active players",
  sessionsHeld: "Sessions held",
  noShowRate: "No-show rate",
};

const PARTIAL_LABEL: Record<NonNullable<WeeklyPoint["partial"]>, string> = {
  in_progress: "Week in progress — not over yet",
  starts_before_range: "Partial week — starts before the selected range",
  ends_after_range: "Partial week — ends after the selected range",
};

function valueOf(w: WeeklyPoint, metric: ChartMetric): number | null {
  if (metric === "activePlayers") return w.activePlayers;
  if (metric === "sessionsHeld") return w.sessionsHeld;
  return w.noShows.rate;
}

const format = (v: number, metric: ChartMetric) => (metric === "noShowRate" ? formatPercent(v) : formatCount(v));

/** Smallest "nice" axis maximum ≥ max, plus tick step. */
function niceScale(max: number, isRate: boolean): { top: number; step: number } {
  if (max <= 0) return isRate ? { top: 0.1, step: 0.05 } : { top: 4, step: 1 };
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  return { top: Math.ceil(max / step) * step, step };
}

const HEIGHT = 240;
const PAD = { top: 28, right: 8, bottom: 28, left: 44 };

/**
 * `weeks` covers the previous period and the selected range. Previous-period weeks are drawn in a
 * muted tone so the trend is visible without them reading as part of the selection.
 */
export function WeeklyChart({ weeks, rangeFrom, initialMetric, definition }: {
  weeks: WeeklyPoint[];
  rangeFrom: string;
  initialMetric?: ChartMetric;
  definition: string;
}) {
  const [metric, setMetric] = useState<ChartMetric>(initialMetric ?? "activePlayers");
  const [showTable, setShowTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  // Unknown until measured, so the server render never draws a fixed-width chart that overflows a phone.
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? 720;
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setMeasured(Math.max(260, el.clientWidth));
    const ro = new ResizeObserver(([entry]) => setMeasured(Math.max(260, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const choose = (m: ChartMetric) => {
    setMetric(m);
    // Keep the choice in the URL without a server round trip, so a shared link opens the same chart.
    const url = new URL(window.location.href);
    url.searchParams.set("chart", m);
    window.history.replaceState(null, "", url);
  };

  const isRate = metric === "noShowRate";
  const values = weeks.map((w) => valueOf(w, metric));
  // 10% headroom so the tallest bar never touches the top and its label fits.
  const { top, step } = niceScale(Math.max(0, ...values.map((v) => v ?? 0)) * 1.1, isRate);
  const isPrevious = (w: WeeklyPoint) => w.end < rangeFrom;
  const hasPrevious = weeks.some(isPrevious);
  const firstCurrent = weeks.findIndex((w) => !isPrevious(w));
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, weeks.length);
  const gap = Math.max(2, band * 0.28);
  const barW = Math.min(56, Math.max(2, band - gap));
  const inset = (band - barW) / 2;
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(weeks.length / Math.max(1, Math.floor(innerW / 56)));
  // Direct label only on the latest complete week, so the current level reads without hovering.
  const labelled = values.findLastIndex((v, i) => v !== null && weeks[i].partial === null);
  const hasPartial = weeks.some((w) => w.partial);
  const hasNoSessions = weeks.some((w) => w.sessionsHeld === 0 && !w.partial);
  const hasUnknown = values.some((v, i) => v === null && !(weeks[i].sessionsHeld === 0 && !weeks[i].partial));

  const tip = active !== null ? weeks[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(PAD.left + band * active + band / 2, 110), width - 110) : 0;

  return (
    <section aria-labelledby="weekly-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="weekly-title" className="text-lg font-semibold text-ink">{METRIC_LABEL[metric]}, week by week</h2>
          <p className="text-sm text-ink-2">{definition}</p>
        </div>
        <div role="group" aria-label="Metric" className="flex flex-wrap gap-x-5">
          {CHART_METRICS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => choose(m)}
              className={`border-b-2 pb-1 text-sm font-medium transition-colors ${
                metric === m ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {isRate && (
        <p className="text-sm text-ink-2">
          Rate = no-shows ÷ bookings checked that week. A week where no attendance was taken has no rate, shown as ?.
        </p>
      )}

      <div ref={box} className="relative w-full overflow-hidden" style={{ minHeight: HEIGHT }} onMouseLeave={() => setActive(null)}>
        {measured !== null && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`${METRIC_LABEL[metric]} per week. Use Tab to step through weeks, or show the table.`} className="block">
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--accent-soft)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" strokeWidth="2" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="12" fill="var(--ink-3)" className="tabular">
                {isRate ? formatPercent(t, 0) : formatCount(t)}
              </text>
            </g>
          ))}
          {hasPrevious && firstCurrent > 0 && (
            <g>
              <line x1={PAD.left + band * firstCurrent} x2={PAD.left + band * firstCurrent} y1={PAD.top - 14} y2={PAD.top + innerH}
                stroke="var(--ink-3)" strokeDasharray="3 3" />
              <text x={PAD.left + band * firstCurrent - 6} y={PAD.top - 6} textAnchor="end" fontSize="11" fill="var(--ink-3)">Previous period</text>
              <text x={PAD.left + band * firstCurrent + 6} y={PAD.top - 6} fontSize="11" fontWeight="600" fill="var(--ink-2)">Selected range</text>
            </g>
          )}
          {weeks.map((w, i) => {
            const v = values[i];
            const x = PAD.left + band * i + inset;
            const dim = active !== null && active !== i;
            return (
              <g key={w.start} opacity={dim ? 0.45 : 1}>
                {w.sessionsHeld === 0 && !w.partial ? (
                  // No sessions at all that week (e.g. a holiday): nothing to measure, which is not the same as 0.
                  <line x1={x + barW / 2 - 4} x2={x + barW / 2 + 4} y1={y(0) - 6} y2={y(0) - 6} stroke="var(--ink-3)" strokeWidth={1.5} />
                ) : v === null ? (
                  band >= 16 ? (
                    <text x={x + barW / 2} y={y(0) - 6} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--unknown)">?</text>
                  ) : (
                    <circle cx={x + barW / 2} cy={y(0) - 5} r={2.5} fill="var(--unknown)" />
                  )
                ) : v > 0 ? (
                  <path
                    d={roundedTop(x, y(v), barW, y(0) - y(v), Math.min(4, barW / 2))}
                    fill={w.partial ? "url(#hatch)" : isPrevious(w) ? "var(--accent-soft)" : "var(--accent)"}
                  />
                ) : (
                  // A real 0: a stub on the baseline, so it never looks like missing data.
                  <rect x={x} y={y(0) - 2} width={barW} height={2} fill={isPrevious(w) ? "var(--accent-soft)" : "var(--accent)"} />
                )}
                {i === labelled && v !== null && (
                  <text x={x + barW / 2} y={y(v) - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)" className="tabular">
                    {format(v, metric)}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="var(--ink-3)">
                    {formatDay(w.start)}
                  </text>
                )}
                {/* Hit target: the whole band, taller than the bar. */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`Week of ${formatDay(w.start)}: ${w.sessionsHeld === 0 && !w.partial ? "no sessions" : v === null ? "unknown" : format(v, metric)}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none focus:stroke-accent"
                />
              </g>
            );
          })}
        </svg>
        )}

        {tip && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 w-56 -translate-x-1/2 rounded-md border border-line-strong bg-surface p-3 text-sm shadow-md"
            style={{ left: tipLeft }}
          >
            <p className="font-semibold text-ink">
              {formatDay(tip.start, { weekday: true })} – {formatDay(tip.end, { weekday: true })}
            </p>
            <p className="mt-1 text-ink tabular">
              {METRIC_LABEL[metric]}:{" "}
              <span className="font-semibold">
                {tip.sessionsHeld === 0 && !tip.partial ? "No sessions" : values[active] === null ? "Unknown" : format(values[active] as number, metric)}
              </span>
            </p>
            <p className="text-ink-2 tabular">
              {tip.sessionsHeld} sessions · {tip.activePlayers} active players
            </p>
            <p className="text-ink-2 tabular">
              {tip.sessionsHeld === 0
                ? "Nothing was held this week"
                : tip.noShows.count === null
                ? "No attendance taken"
                : `${tip.noShows.count} no-shows of ${tip.noShows.recordedBookings} checked bookings`}
            </p>
            {isPrevious(tip) && <p className="mt-1 text-ink-3">Previous period (for comparison)</p>}
            {tip.partial && <p className="mt-1 font-medium text-warn">{PARTIAL_LABEL[tip.partial]}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {hasPrevious && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-3 w-3 rounded-[2px] bg-accent" /> Selected range
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-3 w-3 rounded-[2px] bg-accent-soft" /> Previous period
              </span>
            </>
          )}
          {hasPartial && (
            <span className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden><rect width="14" height="14" rx="2" fill="url(#hatch)" /></svg>
              Partial week (not comparable)
            </span>
          )}
          {hasNoSessions && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-[1.5px] w-2.5 bg-ink-3" /> No sessions that week
            </span>
          )}
          {hasUnknown && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="font-semibold text-unknown">?</span> / <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-unknown" /> No attendance taken
            </span>
          )}
        </div>
        <button type="button" onClick={() => setShowTable((s) => !s)} className="font-medium text-accent underline-offset-4 hover:underline" aria-expanded={showTable}>
          {showTable ? "Hide table" : "Show as table"}
        </button>
      </div>

      {showTable && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm tabular">
            <thead className="border-b border-line text-ink-2">
              <tr>
                <th className="py-2 pr-3 font-medium">Week (Mon–Sun)</th>
                <th className="py-2 pr-3 text-right font-medium">Active players</th>
                <th className="py-2 pr-3 text-right font-medium">Sessions held</th>
                <th className="py-2 pr-3 text-right font-medium">No-shows</th>
                <th className="py-2 text-right font-medium">No-show rate</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.start} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 text-ink">
                    {formatDay(w.start)} – {formatDay(w.end)}
                    {isPrevious(w) && <span className="ml-2 text-xs text-ink-3">previous period</span>}
                    {w.partial && <span className="ml-2 text-xs text-warn">partial</span>}
                  </td>
                  <td className="py-2 pr-3 text-right">{formatCount(w.activePlayers)}</td>
                  <td className="py-2 pr-3 text-right">{formatCount(w.sessionsHeld)}</td>
                  <td className="py-2 pr-3 text-right">{w.noShows.count === null ? "Unknown" : formatCount(w.noShows.count)}</td>
                  <td className="py-2 text-right">{w.noShows.rate === null ? "—" : formatPercent(w.noShows.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Bar anchored to the baseline with rounded top corners only. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
