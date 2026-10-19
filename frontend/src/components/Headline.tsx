import { formatCount, formatPercent, isSmallRateChange, periodWords, plural } from "@/lib/format";
import type { Meta, Summary } from "@/lib/types";

const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-ink">{children}</strong>;

/**
 * The answer to the host's two questions, in one or two sentences, before any chart:
 * are more people playing, and how many don't show up. Every number here also appears below,
 * with its definition, so the sentence never says something the cards don't back.
 */
export function Headline({ summary, meta }: { summary: Summary; meta: Meta }) {
  const { activePlayers: players, sessionsHeld: held, noShows } = summary.metrics;
  const words = periodWords(meta.range, meta.today);
  const cur = noShows.current;

  let comparison: React.ReactNode;
  if (held.previous === 0) comparison = <>There were no sessions during {words.before}, so there is nothing to compare with yet.</>;
  else {
    const diff = players.current - players.previous;
    comparison = diff === 0
      ? <>That&apos;s the same as {words.before}.</>
      : <>That&apos;s <B>{plural(Math.abs(diff), "player")} {diff > 0 ? "more" : "fewer"}</B> than {words.before} ({formatCount(players.previous)}).</>;
  }

  let attendance: React.ReactNode;
  if (held.current === 0) attendance = null;
  else if (cur.count === null) {
    attendance = <>Attendance wasn&apos;t taken at any of these sessions, so no-shows are <B>unknown</B>.</>;
  } else {
    const prevRate = noShows.previous.rate;
    const trend = prevRate === null || cur.rate === null ? null
      : isSmallRateChange(cur.rate - prevRate) ? `about the same as ${formatPercent(prevRate)} before`
      : cur.rate > prevRate ? `up from ${formatPercent(prevRate)}`
      : cur.rate < prevRate ? `down from ${formatPercent(prevRate)}`
      : "the same as before";
    attendance = (
      <>
        Attendance was taken at <B>{formatCount(cur.sessionsWithAttendance)} of {formatCount(held.current)}</B> {held.current === 1 ? "session" : "sessions"}.
        At those, <B>{plural(cur.count, "booking")}</B> {cur.count === 1 ? "was a no-show" : "were no-shows"} ({formatPercent(cur.rate ?? 0)}
        {trend ? `, ${trend}` : ""}).
      </>
    );
  }

  return (
    <section aria-label="Summary" className="max-w-4xl">
      <p className="text-xl leading-snug text-ink-2 sm:text-2xl sm:leading-snug">
        {meta.range.partial ? `So far, ${words.current}, ` : `${words.current[0].toUpperCase()}${words.current.slice(1)}, `}
        {held.current === 0
          ? <>no sessions were held.</>
          : <><B>{plural(players.current, "player")}</B> played at <B>{plural(held.current, "session")}</B>.</>}{" "}
        {comparison}
      </p>
      {attendance && <p className="mt-2 text-base leading-relaxed text-ink-2 sm:text-lg">{attendance}</p>}
    </section>
  );
}
