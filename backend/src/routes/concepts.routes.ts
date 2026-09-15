import { Router } from "express";
import * as conceptsController from "../controllers/concepts.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/:languageSlug/:categorySlug", conceptsController.listByLanguageAndCategory);
router.get("/due", requireAuth, conceptsController.getDueForReview);
router.get("/:id", conceptsController.getById);
router.post("/:id/review", requireAuth, conceptsController.markReviewed);

export default router;
