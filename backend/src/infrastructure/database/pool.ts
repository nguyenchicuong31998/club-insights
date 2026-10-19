import pg from "pg";

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    // Fail fast instead of hanging a page when the database is unreachable.
    connectionTimeoutMillis: 5_000,
    // Recycle idle connections before a proxy (Docker's port forwarding) silently drops them.
    idleTimeoutMillis: 10_000,
    keepAlive: true,
  });
  // An idle client whose connection dies emits here; without a listener Node would crash the process.
  pool.on("error", (err) => console.warn(`Postgres idle client error (it will be replaced): ${err.message}`));
  return pool;
}

const TRANSIENT_CODES = new Set([
  "ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED",
  "57P01", // admin_shutdown: the server closed the connection
  "08000", "08003", "08006", // connection_exception family
]);

/** A failure of the connection rather than of the query: worth one retry on a fresh connection. */
export function isTransient(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return TRANSIENT_CODES.has(e?.code ?? "") || /Connection terminated|connection.*(reset|closed)/i.test(e?.message ?? "");
}

type Queryable = Pick<pg.Pool, "query">;

/**
 * A read-only query, retried once if the connection broke underneath it. Only for reads: retrying is
 * safe because nothing changes. Writes (seed, migrations) use transactions and are not retried.
 */
export async function readQuery<R extends pg.QueryResultRow>(pool: Queryable, text: string, values?: unknown[]): Promise<pg.QueryResult<R>> {
  try {
    return await pool.query<R>(text, values);
  } catch (err) {
    if (!isTransient(err)) throw err;
    console.warn(`Retrying a read after a dropped connection: ${(err as Error).message}`);
    return pool.query<R>(text, values);
  }
}
