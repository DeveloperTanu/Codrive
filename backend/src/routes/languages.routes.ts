import { Router } from "express";
import * as languagesController from "../controllers/languages.controller";

const router = Router();
router.get("/", languagesController.list);

export default router;
