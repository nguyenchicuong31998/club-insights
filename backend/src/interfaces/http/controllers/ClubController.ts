import type { Request, Response } from "express";
import type { GetClub } from "../../../application/use-cases/GetClub.js";
import type { ListClubs } from "../../../application/use-cases/ListClubs.js";

export class ClubController {
  constructor(
    private readonly listClubs: ListClubs,
    private readonly getClub: GetClub,
  ) {}

  list = async (_req: Request, res: Response) => {
    res.json({ data: await this.listClubs.execute() });
  };

  show = async (req: Request<{ id: string }>, res: Response) => {
    res.json({ data: await this.getClub.execute(req.params.id) });
  };
}
