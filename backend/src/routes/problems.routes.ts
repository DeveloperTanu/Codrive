import { Router } from "express";
import * as problemsController from "../controllers/problems.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/by-concept/:conceptId", requireAuth, problemsController.getByConceptId);
router.get("/:id", problemsController.getById);
router.get("/:id/hints/:order", problemsController.getHint);
router.get("/:id/solution", requireAuth, problemsController.getSolution);
router.post("/:id/submit", requireAuth, problemsController.submit);

export default router;
