// All dashboard state lives in the URL, so any view (club, range, open drill-down) can be shared or bookmarked.

export type DrillView =
  | "sessions:held"
  | "sessions:with_no_shows"
  | "sessions:attendance_not_recorded"
  | "players:active"
  | "players:no_show";

export const DRILL_VIEWS: DrillView[] = [
  "sessions:held", "sessions:with_no_shows", "sessions:attendance_not_recorded", "players:active", "players:no_show",
];

export type ChartMetric = "activePlayers" | "sessionsHeld" | "noShowRate";
export const CHART_METRICS: ChartMetric[] = ["activePlayers", "sessionsHeld", "noShowRate"];

export interface PageState {
  club?: string;
  from?: string;
  to?: string;
  view?: DrillView;
  session?: string;
  chart?: ChartMetric;
}

export function parseState(params: Record<string, string | string[] | undefined>): PageState {
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const view = one("view") as DrillView | undefined;
  const chart = one("chart") as ChartMetric | undefined;
  return {
    club: one("club"),
    from: one("from"),
    to: one("to"),
    view: view && DRILL_VIEWS.includes(view) ? view : undefined,
    session: one("session"),
    chart: chart && CHART_METRICS.includes(chart) ? chart : undefined,
  };
}

/** Link to the current state with some keys changed; `undefined` removes a key. */
export function hrefWith(state: PageState, patch: Partial<PageState>): string {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  for (const key of ["club", "from", "to", "chart", "view", "session"] as const) {
    const value = next[key];
    if (value) params.set(key, value);
  }
  const s = params.toString();
  return s ? `/?${s}` : "/";
}
