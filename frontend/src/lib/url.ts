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
  /** Page of the open drill-down list (1-based). */
  page?: number;
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
    page: /^[1-9]\d{0,3}$/.test(one("page") ?? "") ? Number(one("page")) : undefined,
  };
}

/**
 * Link to the current state with some keys changed; `undefined` removes a key. Changing the list,
 * club or dates goes back to page 1, since the old page number means nothing in the new list.
 */
export function hrefWith(state: PageState, patch: Partial<PageState>): string {
  const resetsPage = ["view", "club", "from", "to"].some((k) => k in patch && patch[k as keyof PageState] !== state[k as keyof PageState]);
  const next = { ...state, ...(resetsPage ? { page: undefined } : {}), ...patch };
  const params = new URLSearchParams();
  for (const key of ["club", "from", "to", "chart", "view", "page", "session"] as const) {
    const value = next[key];
    if (value && !(key === "page" && value === 1)) params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `/?${s}` : "/";
}
