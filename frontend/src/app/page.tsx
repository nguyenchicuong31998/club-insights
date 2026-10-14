import Link from "next/link";
import { ClubSwitcher } from "@/components/ClubSwitcher";
import { Drawer } from "@/components/Drawer";
import { PlayersTable, SessionDetailView, SessionsTable, VIEW_LABEL } from "@/components/DrillDown";
import { EmptyClub } from "@/components/EmptyClub";
import { CountCard, NoShowCard } from "@/components/MetricCard";
import { RangeControls } from "@/components/RangeControls";
import { WeeklyChart } from "@/components/WeeklyChart";
import { api, ApiError } from "@/lib/api";
import { daysInRange, formatDateTime } from "@/lib/format";
import type { Club, Meta, PlayerFilter, SessionFilter } from "@/lib/types";
import { hrefWith, parseState, type PageState } from "@/lib/url";

export const dynamic = "force-dynamic";

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

  const club = clubs.find((c) => c.id === parsed.club) ?? clubs[0];
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
  // The chart shows the previous period too, for context, unless that would exceed the API's 366-day limit.
  const chartFrom = daysInRange(meta.previousRange.from, meta.range.to) <= 366 ? meta.previousRange.from : meta.range.from;
  const weekly = summary.hasHistory ? (await api.weekly(club.id, { from: chartFrom, to: meta.range.to })).data : null;
  const m = summary.metrics;
  const drill = (view: PageState["view"]) => hrefWith(state, { view, session: undefined });

  return (
    <Shell header={<Header clubs={clubs} club={club} state={state} meta={meta} />}>
      {!summary.hasHistory ? (
        <EmptyClub summary={summary} meta={meta} />
      ) : (
        <>
          <RangeControls key={`${meta.range.from}:${meta.range.to}`} state={state} meta={meta} />
          <section aria-label="Key numbers" className="grid gap-4 md:grid-cols-3">
            <CountCard
              title="Active players"
              unit="players"
              metric={m.activePlayers}
              links={[{ href: drill("players:active"), label: "See players" }]}
            />
            <CountCard
              title="Sessions held"
              unit="sessions"
              metric={m.sessionsHeld}
              links={[{ href: drill("sessions:held"), label: "See sessions" }]}
            />
            <NoShowCard
              metric={m.noShows}
              links={[
                { href: drill("players:no_show"), label: "Who didn't show" },
                { href: drill("sessions:attendance_not_recorded"), label: "Missing attendance" },
              ]}
            />
          </section>
          {weekly && (
            <WeeklyChart weeks={weekly.weeks} rangeFrom={meta.range.from} initialMetric={state.chart} definition={meta.definitions.weeks} />
          )}
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
  const content = kind === "sessions"
    ? <SessionsTable rows={(await api.sessions(meta.clubId, range, filter as SessionFilter)).data.sessions} meta={meta} state={state} view={view} />
    : <PlayersTable rows={(await api.players(meta.clubId, range, filter as PlayerFilter)).data.players} meta={meta} state={state} view={view} />;
  return <Drawer title={`Behind the numbers · ${VIEW_LABEL[view]}`} closeHref={closeHref}>{content}</Drawer>;
}

function Header({ clubs, club, state, meta }: { clubs: Club[]; club: Club; state: PageState; meta?: Meta }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="hidden text-sm font-semibold text-ink-2 sm:block">Club Insights</Link>
          <ClubSwitcher clubs={clubs} state={state} current={club.id} />
        </div>
        {meta && (
          <p className="text-xs text-ink-2 sm:text-sm">
            Now: <span className="font-medium text-ink">{formatDateTime(meta.now, meta.timezone)}</span>
            <span className="text-ink-3"> · times in {meta.timezone}</span>
          </p>
        )}
      </div>
    </header>
  );
}

function HowWeCount({ meta }: { meta: Meta }) {
  return (
    <details className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2 sm:p-5">
      <summary className="cursor-pointer font-semibold text-ink">How these numbers are counted</summary>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
        <li>Dates, weeks and session times use the club&apos;s time zone ({meta.timezone}). Weeks run Monday to Sunday.</li>
        <li>Previous period: {meta.definitions.previousPeriod}</li>
        <li>Only sessions that have already started count. Cancelled sessions and cancelled bookings never count.</li>
        <li>
          No-shows only exist where attendance was taken. Bookings without attendance are left out of the no-show
          rate, so it is compared by rate, not by count, and the coverage is shown beside it.
        </li>
        <li>“Now” is fixed at {formatDateTime(meta.now, meta.timezone)} for this demo.</li>
      </ul>
    </details>
  );
}

function Shell({ header, children }: { header?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {header}
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}

function Notice({ title, body, retryHref, retryLabel = "Try again" }: { title: string; body: string; retryHref?: string; retryLabel?: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-line bg-surface p-5">
      <p className="font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink-2">{body}</p>
      {retryHref && (
        <Link href={retryHref} className="mt-1 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white">{retryLabel}</Link>
      )}
    </div>
  );
}
