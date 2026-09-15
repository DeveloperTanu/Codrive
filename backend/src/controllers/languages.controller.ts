import { Response } from "express";
import { Language } from "../models/Language";
import { asyncHandler } from "../utils/asyncHandler";

export const list = asyncHandler(async (_req, res: Response) => {
  const languages = await Language.find().sort({ name: 1 });
  res.json({ languages });
});
