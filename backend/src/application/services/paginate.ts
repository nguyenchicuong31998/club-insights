export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  /** All rows across pages: always equals the headline number the list is behind. */
  total: number;
  totalPages: number;
}

/** One page of `rows`. A page past the end is clamped to the last page, so a stale link never shows nothing. */
export function paginate<T>(rows: T[], { page, pageSize }: PageRequest): { items: T[]; pagination: Pagination } {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: rows.slice((current - 1) * pageSize, current * pageSize),
    pagination: { page: current, pageSize, total: rows.length, totalPages },
  };
}
