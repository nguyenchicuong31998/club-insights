import type {
  Club, Meta, PlayerFilter, PlayerRow, SessionDetail, SessionFilter, SessionRow, Summary, Weekly,
} from "./types";

// Server components call the API directly; the browser never needs to reach it.
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  } catch {
    throw new ApiError(`Can't reach the API at ${API_URL}. Is the backend running?`, 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `API error ${res.status}`, res.status);
  return body as T;
}

export interface RangeParams {
  from?: string;
  to?: string;
}

const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  return s ? `?${s}` : "";
};

export const api = {
  clubs: () => get<{ data: Club[] }>("/api/clubs").then((r) => r.data),
  summary: (clubId: string, range: RangeParams) =>
    get<{ data: Summary; meta: Meta }>(`/api/clubs/${clubId}/summary${qs({ ...range })}`),
  weekly: (clubId: string, range: RangeParams) =>
    get<{ data: Weekly; meta: Meta }>(`/api/clubs/${clubId}/weekly${qs({ ...range })}`),
  sessions: (clubId: string, range: RangeParams, filter: SessionFilter) =>
    get<{ data: { filter: SessionFilter; sessions: SessionRow[] }; meta: Meta }>(
      `/api/clubs/${clubId}/sessions${qs({ ...range, filter })}`),
  players: (clubId: string, range: RangeParams, filter: PlayerFilter) =>
    get<{ data: { filter: PlayerFilter; players: PlayerRow[] }; meta: Meta }>(
      `/api/clubs/${clubId}/players${qs({ ...range, filter })}`),
  session: (clubId: string, sessionId: string) =>
    get<{ data: SessionDetail }>(`/api/clubs/${clubId}/sessions/${sessionId}`).then((r) => r.data),
};
