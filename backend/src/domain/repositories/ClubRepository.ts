import type { Club } from "../entities/Club.js";

export interface ClubRepository {
  findAll(): Promise<Club[]>;
  findById(id: string): Promise<Club | null>;
}
