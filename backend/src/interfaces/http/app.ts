import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { NotFoundError } from "../../application/errors.js";
import type { ClubController } from "./controllers/ClubController.js";
import { clubRoutes } from "./routes/clubRoutes.js";

export interface Controllers {
  clubs: ClubController;
}

export function createApp(controllers: Controllers, corsOrigin: string) {
  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/clubs", clubRoutes(controllers.clubs));

  // Express 5 forwards rejected promises from async handlers here.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
