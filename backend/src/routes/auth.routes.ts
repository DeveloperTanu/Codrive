import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authRateLimiter } from "../middleware/rateLimit.middleware";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup", authRateLimiter, authController.signup);
router.post("/login", authRateLimiter, authController.login);
router.post("/logout", authController.logout);
router.post("/forgot-password", authRateLimiter, authController.forgotPassword);
router.post("/refresh", authController.refresh);
router.get("/me", requireAuth, authController.me);
router.put("/me", requireAuth, authController.updateProfile);
router.delete("/me", requireAuth, authController.deleteAccount);

export default router;
