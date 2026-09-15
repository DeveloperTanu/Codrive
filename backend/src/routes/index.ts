import { Router } from "express";
import authRoutes from "./auth.routes";
import conceptsRoutes from "./concepts.routes";
import problemsRoutes from "./problems.routes";
import projectsRoutes from "./projects.routes";
import bookmarksRoutes from "./bookmarks.routes";
import teacherRoutes from "./teacher.routes";
import progressRoutes from "./progress.routes";
import languagesRoutes from "./languages.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/concepts", conceptsRoutes);
router.use("/problems", problemsRoutes);
router.use("/projects", projectsRoutes);
router.use("/bookmarks", bookmarksRoutes);
router.use("/teacher", teacherRoutes);
router.use("/progress", progressRoutes);
router.use("/languages", languagesRoutes);

export default router;
