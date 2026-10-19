import Link from "next/link";
import { ClubSwitcher } from "@/components/ClubSwitcher";
import { Drawer } from "@/components/Drawer";
import { PlayersTable, SessionDetailView, SessionsTable, VIEW_LABEL } from "@/components/DrillDown";
import { EmptyClub } from "@/components/EmptyClub";
import { Headline } from "@/components/Headline";
import { KeyNumbers } from "@/components/MetricCard";
import { NoShowsBySession, WhoDidntShow } from "@/components/NoShowDetails";
import { RangeControls } from "@/components/RangeControls";
import { WeeklyChart } from "@/components/WeeklyChart";
import { api, ApiError } from "@/lib/api";
import { daysInRange, formatDateTime, zoneLabel } from "@/lib/format";
import type { Club, Meta, PlayerFilter, PlayerRow, SessionFilter, WeeklyPoint } from "@/lib/types";
import { hrefWith, parseState, type PageState } from "@/lib/url";

export const dynamic = "force-dynamic";

/** Rows per page in the drill-down lists. */
const PAGE_SIZE = 25;
/** Players shown inline under "Who didn't show up"; the rest are one click away. */
const WHO_DIDNT_SHOW = 6;

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parsed = parseState(await searchParams);

  let clubs: Club[];
  try {
    clubs = await api.clubs();
  } catch (e) {
    return <Shell><Notice title="Can't load clubs" body={(e as Error).message} retryHref="/" /></Shell>;
  }
  if (clubs.length === 0) {
    return <Shell><Notice title="No clubs yet" body="The database has no clubs. Run `npm run db:seed` to load the sample data." /></Shell>;
  }

  const found = clubs.find((c) => c.id === parsed.club);
  if (parsed.club && !found) {
    // Never fall back to another club silently: its numbers would pass for the ones asked for.
    return (
      <Shell header={<Header clubs={clubs} club={clubs[0]} state={{ club: clubs[0].id }} />}>
        <Notice
          title="This club doesn't exist"
          body={`There is no club with the id "${parsed.club}". The link may be old or mistyped. Pick a club above, or open ${clubs[0].name}.`}
          retryHref={hrefWith({}, { club: clubs[0].id })}
          retryLabel={`Open ${clubs[0].name}`}
        />
      </Shell>
    );
  }
  const club = found ?? clubs[0];
  const state: PageState = { ...parsed, club: club.id };
  const range = { from: state.from, to: state.to };

  let summaryRes;
  try {
    summaryRes = await api.summary(club.id, range);
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) {
      return (
        <Shell header={<Header clubs={clubs} club={club} state={state} />}>
          <Notice
            title="That date range doesn't work"
            body={e.message}
            retryHref={hrefWith(state, { from: undefined, to: undefined, view: undefined, session: undefined })}
            retryLabel="Back to the last 4 weeks"
          />
        </Shell>
      );
    }
    throw e;
  }
  const { data: summary, meta } = summaryRes;
  const selected = { from: meta.range.from, to: meta.range.to };
  // The chart shows the previous period too, for context, unless that would exceed the API's 366-day limit.
  const chartFrom = daysInRange(meta.previousRange.from, meta.range.to) <= 366 ? meta.previousRange.from : meta.range.from;
  // Independent requests, so they run side by side.
  let weeks: WeeklyPoint[] = [];
  let noShowPlayers: PlayerRow[] = [];
  let noShowTotal = 0;
  if (summary.hasHistory) {
    const [weekly, players] = await Promise.all([
      api.weekly(club.id, { from: chartFrom, to: meta.range.to }),
      api.players(club.id, selected, "no_show", { pageSize: WHO_DIDNT_SHOW }),
    ]);
    weeks = weekly.data.weeks;
    noShowPlayers = players.data.players;
    noShowTotal = players.data.pagination.total;
  }
  const m = summary.metrics;
  const drill = (view: string) => hrefWith(state, { view: view as PageState["view"], session: undefined });

  return (
    <Shell header={<Header clubs={clubs} club={club} state={state} meta={meta} />}>
      {!summary.hasHistory ? (
        <EmptyClub summary={summary} meta={meta} />
      ) : (
        <>
          <RangeControls key={`${meta.range.from}:${meta.range.to}`} state={state} meta={meta} />
          <Headline summary={summary} meta={meta} />
          <KeyNumbers summary={summary} drill={drill} />
          <WeeklyChart weeks={weeks} rangeFrom={meta.range.from} initialMetric={state.chart} definition={meta.definitions.weeks}
            metricDefinitions={{
              activePlayers: meta.definitions.activePlayers,
              sessionsHeld: meta.definitions.sessionsHeld,
              noShowRate: meta.definitions.noShows,
            }}
          />
          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            <WhoDidntShow
              players={noShowPlayers}
              total={noShowTotal}
              unknown={m.noShows.current.count === null}
              meta={meta}
              allHref={drill("players:no_show")}
            />
            <NoShowsBySession rows={m.noShows.bySessionType} />
          </div>
          <HowWeCount meta={meta} />
        </>
      )}
      {summary.hasHistory && state.view && <DrillPanel state={state} meta={meta} />}
    </Shell>
  );
}

async function DrillPanel({ state, meta }: { state: PageState; meta: Meta }) {
  const view = state.view!;
  const closeHref = hrefWith(state, { view: undefined, session: undefined });
  const range = { from: meta.range.from, to: meta.range.to };

  if (state.session) {
    try {
      const session = await api.session(meta.clubId, state.session);
      return (
        <Drawer title={session.title} closeHref={closeHref}>
          <SessionDetailView session={session} timezone={meta.timezone} backHref={hrefWith(state, { session: undefined })} />
        </Drawer>
      );
    } catch (e) {
      return (
        <Drawer title="Session" closeHref={closeHref}>
          <Notice title="Can't open this session" body={(e as Error).message} retryHref={hrefWith(state, { session: undefined })} retryLabel="Back to list" />
        </Drawer>
      );
    }
  }

  const [kind, filter] = view.split(":") as ["sessions" | "players", string];
  const page = { page: state.page ?? 1, pageSize: PAGE_SIZE };
  let content: React.ReactNode;
  if (kind === "sessions") {
    const { data } = await api.sessions(meta.clubId, range, filter as SessionFilter, page);
    content = <SessionsTable rows={data.sessions} pagination={data.pagination} meta={meta} state={state} view={view} />;
  } else {
    const { data } = await api.players(meta.clubId, range, filter as PlayerFilter, page);
    content = <PlayersTable rows={data.players} pagination={data.pagination} meta={meta} state={state} view={view} />;
  }
  return <Drawer title={`Behind the numbers · ${VIEW_LABEL[view]}`} closeHref={closeHref}>{content}</Drawer>;
}

function Header({ clubs, club, state, meta }: { clubs: Club[]; club: Club; state: PageState; meta?: Meta }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pb-4 pt-5 sm:px-6 sm:pt-7">
        <div className="flex min-w-0 flex-col gap-1">
          <Link href="/" className="text-xs font-medium text-ink-3 hover:text-ink">Club Insights</Link>
          {/* key: remount per club, so the switch-in-progress state never outlives the switch. */}
          <ClubSwitcher key={club.id} clubs={clubs} state={state} current={club.id} />
        </div>
        {meta && (
          <p className="text-sm text-ink-2 sm:text-right">
            <span className="block text-xs text-ink-3">Numbers as of</span>
            <span className="font-medium text-ink">{formatDateTime(meta.now, meta.timezone)}</span>
            <span className="text-ink-3"> · {zoneLabel(meta.timezone, meta.now)}</span>
          </p>
        )}
      </div>
    </header>
  );
}

function HowWeCount({ meta }: { meta: Meta }) {
  return (
    <details className="group border-t border-line pt-5 text-sm text-ink-2">
      <summary className="cursor-pointer list-none font-semibold text-ink">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden>›</span>
        How these numbers are counted
      </summary>
      <ul className="mt-3 flex max-w-3xl list-disc flex-col gap-2 pl-5 leading-relaxed">
        <li>
          Dates, weeks and session times are in the club&apos;s time zone ({zoneLabel(meta.timezone, meta.now)}), not
          your device&apos;s. Weeks run Monday to Sunday, so a 05:30 Monday session counts in Monday&apos;s week even though it
          is still Sunday in UTC.
        </li>
        <li>Previous period: {meta.definitions.previousPeriod}</li>
        <li>Only sessions that have already started count. Cancelled sessions and cancelled bookings never count.</li>
        <li>
          Attendance is taken per session. Where it wasn&apos;t taken, nobody is counted as a no-show, and those bookings
          are left out of the no-show rate. That&apos;s why no-shows are compared by rate, with the share of sessions that
          took attendance shown next to it.
        </li>
        <li>
          A player who booked a session without attendance still counts as active: they probably played, and leaving them
          out would hide half the club.
        </li>
        <li>&ldquo;Now&rdquo; is fixed at {formatDateTime(meta.now, meta.timezone)} for this demo.</li>
      </ul>
    </details>
  );
}

function Shell({ header, children }: { header?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {header}
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 pt-6 sm:gap-10 sm:px-6 sm:pt-8">{children}</main>
    </div>
  );
}

function Notice({ title, body, retryHref, retryLabel = "Try again" }: { title: string; body: string; retryHref?: string; retryLabel?: string }) {
  return (
    <div role="alert" className="flex max-w-2xl flex-col items-start gap-2 border-l-2 border-warn py-1 pl-4">
      <p className="font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink-2">{body}</p>
      {retryHref && (
        <Link href={retryHref} className="mt-1 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white dark:text-page">{retryLabel}</Link>
      )}
    </div>
  );
}
