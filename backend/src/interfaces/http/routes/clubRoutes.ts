import { Router } from "express";
import type { ClubController } from "../controllers/ClubController.js";
import type { MetricsController } from "../controllers/MetricsController.js";

export function clubRoutes(clubs: ClubController, metrics: MetricsController): Router {
  const router = Router();
  router.get("/", clubs.list);
  router.get("/:id", clubs.show);
  router.get("/:id/summary", metrics.summary);
  router.get("/:id/weekly", metrics.weekly);
  router.get("/:id/sessions", metrics.sessions);
  router.get("/:id/sessions/:sessionId", metrics.sessionDetail);
  router.get("/:id/players", metrics.players);
  return router;
}
