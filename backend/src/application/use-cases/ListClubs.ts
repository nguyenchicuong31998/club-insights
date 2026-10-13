import type { Club } from "../../domain/entities/Club.js";
import type { ClubRepository } from "../../domain/repositories/ClubRepository.js";

export class ListClubs {
  constructor(private readonly clubs: ClubRepository) {}

  execute(): Promise<Club[]> {
    return this.clubs.findAll();
  }
}
