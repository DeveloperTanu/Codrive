import { Router } from "express";
import * as bookmarksController from "../controllers/bookmarks.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

router.get("/", bookmarksController.list);
router.post("/", bookmarksController.create);
router.delete("/:id", bookmarksController.remove);

export default router;
