import type { Club } from "../../domain/entities/Club.js";
import type { ClubRepository } from "../../domain/repositories/ClubRepository.js";
import { NotFoundError } from "../errors.js";

export class GetClub {
  constructor(private readonly clubs: ClubRepository) {}

  async execute(id: string): Promise<Club> {
    const club = await this.clubs.findById(id);
    if (!club) throw new NotFoundError("Club", id);
    return club;
  }
}
