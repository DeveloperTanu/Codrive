import { Router } from "express";
import * as projectsController from "../controllers/projects.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth); // every project route requires an authenticated user

router.get("/", projectsController.list);
router.post("/", projectsController.create);
router.get("/:id/files", projectsController.getFiles);
router.put("/:id/files", projectsController.upsertFile);
router.delete("/:id/files", projectsController.deleteFile);

export default router;
