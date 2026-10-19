import Link from "next/link";
import { formatCount, formatPercent, isSmallRateChange, plural, signed } from "@/lib/format";
import type { Change, CountComparison, NoShowMetric, Summary } from "@/lib/types";

interface DrillLink {
  href: string;
  label: string;
}

/**
 * Arrow + words, never colour alone. `higherIsBetter` decides whether up reads as good or bad.
 * A `small` change keeps its arrow but stays neutral, so noise isn't flagged as good or bad news.
 */
function Delta({ change, text, higherIsBetter, against, small = false }: {
  change: Change; text: string; higherIsBetter: boolean; against: string; small?: boolean;
}) {
  const dir = change.absolute > 0 ? "up" : change.absolute < 0 ? "down" : "flat";
  const tone = dir === "flat" || small ? "text-ink-2" : (dir === "up") === higherIsBetter ? "text-good" : "text-bad";
  return (
    <p className="text-sm text-ink-2 tabular">
      <span className={`font-semibold ${tone}`}>
        <span aria-hidden>{dir === "up" ? "▲ " : dir === "down" ? "▼ " : ""}</span>
        {dir === "flat" ? "No change" : text}
      </span>{" "}
      vs {against}
      {small && dir !== "flat" && <span className="text-ink-3"> · about the same</span>}
    </p>
  );
}

function Column({ title, children, definition, links }: {
  title: string;
  children: React.ReactNode;
  definition: string;
  links: DrillLink[];
}) {
  return (
    <article className="flex flex-col gap-3 py-5 md:px-6 md:first:pl-0 md:last:pr-0">
      <h2 className="text-[15px] font-medium text-ink">{title}</h2>
      {children}
      <p className="text-sm leading-relaxed text-ink-3">{definition}</p>
      {links.length > 0 && <nav aria-label={`Details behind ${title}`} className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1">
        {links.map((l) => (
          <Link key={l.href} href={l.href} scroll={false} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            {l.label} <span aria-hidden>→</span>
          </Link>
        ))}
      </nav>}
    </article>
  );
}

const Big = ({ children, muted }: { children: React.ReactNode; muted?: boolean }) => (
  <p className={`text-5xl font-semibold leading-none tracking-tight tabular ${muted ? "text-unknown" : "text-ink"}`}>{children}</p>
);

function CountColumn({ title, metric, unit, links }: { title: string; metric: CountComparison; unit: string; links: DrillLink[] }) {
  const c = metric.change;
  return (
    <Column title={title} definition={metric.definition} links={links}>
      <Big>{formatCount(metric.current)}</Big>
      {metric.previous === 0 || !c ? (
        <p className="text-sm text-ink-2">No {unit} in the previous period, so nothing to compare with.</p>
      ) : (
        <Delta
          change={c}
          higherIsBetter
          text={`${signed(c.absolute, formatCount(Math.abs(c.absolute)))}${c.relative === null ? "" : ` (${signed(c.relative, formatPercent(Math.abs(c.relative)))})`}`}
          against={`${formatCount(metric.previous)} before`}
        />
      )}
    </Column>
  );
}

/** One square per held session: filled when attendance was taken. The rate's footing, at a glance. */
function SessionSquares({ held, withAttendance }: { held: number; withAttendance: number }) {
  if (held === 0) return null;
  const shown = Math.min(held, 52);
  const filled = Math.round((withAttendance / held) * shown);
  return (
    <div className="flex flex-col gap-1.5">
      <div role="img" aria-label={`Attendance taken at ${withAttendance} of ${held} sessions`} className="flex flex-wrap gap-[3px]">
        {Array.from({ length: shown }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-[2px] ${i < filled ? "bg-accent" : "border border-line-strong bg-transparent"}`}
          />
        ))}
      </div>
      <p className="text-sm text-ink-2 tabular">
        Attendance taken at <span className="font-medium text-ink">{withAttendance} of {plural(held, "session")}</span>
        {held > shown && <span className="text-ink-3"> (each square ≈ {formatCount(Math.round(held / shown))} sessions)</span>}
      </p>
    </div>
  );
}

function NoShowColumn({ metric, sessionsHeld, links }: {
  metric: Summary["metrics"]["noShows"];
  sessionsHeld: number;
  links: DrillLink[];
}) {
  const { current: cur, previous: prev, rateChange } = metric;
  const share = (m: NoShowMetric) => (m.confirmedBookings ? m.recordedBookings / m.confirmedBookings : 0);
  return (
    <Column title="No-shows" definition={metric.definition} links={links}>
      {cur.count === null ? (
        <>
          <Big muted>Unknown</Big>
          <p className="text-sm text-ink-2">
            {sessionsHeld === 0
              ? "No sessions were held in this period."
              : "Attendance wasn't taken at any session in this period, so no-shows can't be counted. This is not zero."}
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <Big>{formatCount(cur.count)}</Big>
            <p className="text-base text-ink-2 tabular">
              <span className="font-semibold text-ink">{formatPercent(cur.rate ?? 0)}</span> of checked bookings
            </p>
          </div>
          {rateChange && prev.rate !== null ? (
            <Delta
              change={rateChange}
              higherIsBetter={false}
              small={isSmallRateChange(rateChange.absolute)}
              text={`${signed(rateChange.absolute, (Math.abs(rateChange.absolute) * 100).toFixed(1))} pts`}
              against={`${formatPercent(prev.rate)} before`}
            />
          ) : (
            <p className="text-sm text-ink-2">No comparison: attendance wasn&apos;t taken in the previous period.</p>
          )}
        </>
      )}
      <SessionSquares held={sessionsHeld} withAttendance={cur.sessionsWithAttendance} />
      {cur.recordedBookings > 0 && share(cur) < 0.5 && (
        <p className="text-sm text-warn">
          Only {formatPercent(share(cur), 0)} of bookings were checked, so read the rate with care.
        </p>
      )}
    </Column>
  );
}

export function KeyNumbers({ summary, drill }: { summary: Summary; drill: (view: string) => string }) {
  const m = summary.metrics;
  return (
    <section aria-label="Key numbers" className="grid border-y border-line md:grid-cols-3 md:divide-x md:divide-line max-md:divide-y max-md:divide-line">
      <CountColumn
        title="Active players"
        unit="players"
        metric={m.activePlayers}
        links={m.activePlayers.current === 0 ? [] : [{ href: drill("players:active"), label: `See the ${plural(m.activePlayers.current, "player")}` }]}
      />
      <CountColumn
        title="Sessions held"
        unit="sessions"
        metric={m.sessionsHeld}
        links={m.sessionsHeld.current === 0 ? [] : [{ href: drill("sessions:held"), label: `See the ${plural(m.sessionsHeld.current, "session")}` }]}
      />
      <NoShowColumn
        metric={m.noShows}
        sessionsHeld={m.sessionsHeld.current}
        links={[
          ...(m.noShows.current.count ? [{ href: drill("players:no_show"), label: "Who didn't show" }] : []),
          ...(m.noShows.current.recordedBookings < m.noShows.current.confirmedBookings
            ? [{ href: drill("sessions:attendance_not_recorded"), label: "Sessions without attendance" }]
            : []),
        ]}
      />
    </section>
  );
}
