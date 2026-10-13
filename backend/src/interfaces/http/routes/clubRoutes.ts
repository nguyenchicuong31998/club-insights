import { Router } from "express";
import type { ClubController } from "../controllers/ClubController.js";

export function clubRoutes(controller: ClubController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.get("/:id", controller.show);
  return router;
}
