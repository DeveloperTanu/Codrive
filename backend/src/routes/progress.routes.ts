import { Router } from "express";
import * as progressController from "../controllers/progress.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

router.get("/summary", progressController.summary);

export default router;
