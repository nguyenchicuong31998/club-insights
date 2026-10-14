import Link from "next/link";
import { formatCount, formatPercent, signed } from "@/lib/format";
import type { Change, CountComparison, NoShowMetric } from "@/lib/types";

type Tone = "good" | "bad" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-surface-2 text-ink-2",
};

/** Arrow + text, never color alone. `higherIsBetter` decides whether up is good or bad. */
function DeltaChip({ change, text, higherIsBetter }: { change: Change; text: string; higherIsBetter: boolean }) {
  const dir = change.absolute > 0 ? "up" : change.absolute < 0 ? "down" : "flat";
  const tone: Tone = dir === "flat" ? "neutral" : (dir === "up") === higherIsBetter ? "good" : "bad";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "＝";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-semibold tabular ${TONE_CLASS[tone]}`}>
      <span aria-hidden>{arrow}</span>
      {dir === "flat" ? "No change" : text}
    </span>
  );
}

function countChangeText(c: Change): string {
  const abs = signed(c.absolute, formatCount(Math.abs(c.absolute)));
  return c.relative === null ? abs : `${abs} (${signed(c.relative, formatPercent(Math.abs(c.relative)))})`;
}

interface DrillLink {
  href: string;
  label: string;
}

function CardShell({ title, children, links }: { title: string; children: React.ReactNode; links: DrillLink[] }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-2">{title}</h2>
      {children}
      <nav aria-label={`Details behind ${title}`} className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} scroll={false} className="text-sm font-medium text-accent hover:underline">
            {l.label} →
          </Link>
        ))}
      </nav>
    </article>
  );
}

function Definition({ text }: { text: string }) {
  return (
    <p className="text-sm leading-snug text-ink-2">
      <span className="font-medium text-ink">Counts: </span>
      {text}
    </p>
  );
}

export function CountCard({ title, metric, links, unit }: { title: string; metric: CountComparison; links: DrillLink[]; unit: string }) {
  return (
    <CardShell title={title} links={links}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-semibold tabular text-ink">{formatCount(metric.current)}</span>
        {metric.change && metric.previous > 0 && (
          <DeltaChip change={metric.change} text={countChangeText(metric.change)} higherIsBetter />
        )}
      </div>
      <p className="text-sm text-ink-2 tabular">
        {metric.previous > 0
          ? `${formatCount(metric.previous)} ${unit} in the previous period`
          : `No ${unit} in the previous period, so there's nothing to compare against.`}
      </p>
      <Definition text={metric.definition} />
    </CardShell>
  );
}

function Coverage({ m }: { m: NoShowMetric }) {
  if (m.confirmedBookings === 0) return null;
  const share = m.confirmedBookings ? m.recordedBookings / m.confirmedBookings : 0;
  const low = m.recordedBookings > 0 && share < 0.5;
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`Attendance recorded for ${m.recordedBookings} of ${m.confirmedBookings} bookings`}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="text-sm text-ink-2 tabular">
        Attendance taken for <span className="font-medium text-ink">{formatCount(m.recordedBookings)}</span> of{" "}
        {formatCount(m.confirmedBookings)} bookings ({formatPercent(share, 0)})
        {low && <span className="ml-1 font-medium text-warn">· low coverage, read with care</span>}
      </p>
    </div>
  );
}

export function NoShowCard({ metric, links }: {
  metric: { current: NoShowMetric; previous: NoShowMetric; rateChange: Change | null; definition: string };
  links: DrillLink[];
}) {
  const { current: cur, previous: prev, rateChange } = metric;
  return (
    <CardShell title="No-shows" links={links}>
      {cur.count === null ? (
        <div className="flex flex-col gap-1">
          <span className="text-4xl font-semibold text-unknown">Unknown</span>
          <p className="text-sm text-ink-2">
            Attendance wasn&apos;t taken at any session in this period, so no-shows can&apos;t be counted. This is not zero.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-4xl font-semibold tabular text-ink">{formatCount(cur.count)}</span>
            <span className="text-lg text-ink-2 tabular">{formatPercent(cur.rate ?? 0)} rate</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2 tabular">
            {rateChange ? (
              <>
                <DeltaChip
                  change={rateChange}
                  text={`${signed(rateChange.absolute, (Math.abs(rateChange.absolute) * 100).toFixed(1))} pts`}
                  higherIsBetter={false}
                />
                <span>vs {formatPercent(prev.rate ?? 0)} in the previous period ({formatCount(prev.count ?? 0)} no-shows)</span>
              </>
            ) : (
              <span>No comparison: attendance wasn&apos;t taken in the previous period.</span>
            )}
          </div>
        </>
      )}
      <Coverage m={cur} />
      <Definition text={metric.definition} />
    </CardShell>
  );
}
