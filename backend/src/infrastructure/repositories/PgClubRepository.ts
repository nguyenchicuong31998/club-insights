import type pg from "pg";
import type { Club } from "../../domain/entities/Club.js";
import type { ClubRepository } from "../../domain/repositories/ClubRepository.js";

interface ClubRow {
  id: string;
  name: string;
  timezone: string;
  created_at: Date;
}

const toClub = (row: ClubRow): Club => ({
  id: row.id,
  name: row.name,
  timezone: row.timezone,
  createdAt: row.created_at,
});

export class PgClubRepository implements ClubRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findAll(): Promise<Club[]> {
    const { rows } = await this.pool.query<ClubRow>(
      "SELECT id, name, timezone, created_at FROM clubs ORDER BY created_at",
    );
    return rows.map(toClub);
  }

  async findById(id: string): Promise<Club | null> {
    const { rows } = await this.pool.query<ClubRow>(
      "SELECT id, name, timezone, created_at FROM clubs WHERE id = $1",
      [id],
    );
    return rows[0] ? toClub(rows[0]) : null;
  }
}
