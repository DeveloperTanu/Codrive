import { Router } from "express";
import * as teacherController from "../controllers/teacher.controller";
import { requireAuth } from "../middleware/auth.middleware";
import rateLimit from "express-rate-limit";

const router = Router();

// Separate, tighter limiter from the auth routes — this one guards against
// burning through someone's Groq quota via repeated requests, not
// credential-stuffing.
const teacherRateLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20 });

router.post("/chat", requireAuth, teacherRateLimiter, teacherController.chat);

export default router;
