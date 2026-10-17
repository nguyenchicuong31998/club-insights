import type pg from "pg";
import type { Club } from "../../domain/entities/Club.js";
import type { ClubRepository } from "../../domain/repositories/ClubRepository.js";

interface ClubRow {
  id: string;
  name: string;
  timezone: string;
  created_on: string;
}

// created_on is read as text: pg would turn a DATE into a Date at the server's local midnight.
const SELECT_CLUBS = "SELECT id, name, timezone, to_char(created_on, 'YYYY-MM-DD') AS created_on FROM clubs";

const toClub = (row: ClubRow): Club => ({
  id: row.id,
  name: row.name,
  timezone: row.timezone,
  createdOn: row.created_on,
});

export class PgClubRepository implements ClubRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findAll(): Promise<Club[]> {
    const { rows } = await this.pool.query<ClubRow>(`${SELECT_CLUBS} ORDER BY created_on, id`);
    return rows.map(toClub);
  }

  async findById(id: string): Promise<Club | null> {
    const { rows } = await this.pool.query<ClubRow>(`${SELECT_CLUBS} WHERE id = $1`, [id]);
    return rows[0] ? toClub(rows[0]) : null;
  }
}
