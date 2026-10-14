import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { NotFoundError, ValidationError } from "../../application/errors.js";
import type { ClubController } from "./controllers/ClubController.js";
import type { MetricsController } from "./controllers/MetricsController.js";
import { clubRoutes } from "./routes/clubRoutes.js";

export interface Controllers {
  clubs: ClubController;
  metrics: MetricsController;
}

export function createApp(controllers: Controllers, corsOrigin: string) {
  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/clubs", clubRoutes(controllers.clubs, controllers.metrics));
  app.use((req, res) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
  });

  // Express 5 forwards rejected promises from async handlers here.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
