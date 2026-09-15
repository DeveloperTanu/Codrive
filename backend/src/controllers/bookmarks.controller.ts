import { Response } from "express";
import { Bookmark } from "../models/Bookmark";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { AuthedRequest } from "../middleware/auth.middleware";

export const list = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const type = req.query.type as string | undefined;
  const filter: Record<string, unknown> = { userId: req.userId };
  if (type) filter.targetType = type;

  const bookmarks = await Bookmark.find(filter).sort({ createdAt: -1 });
  res.json({ bookmarks });
});

export const create = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { targetType, targetId, title, sub } = req.body;
  if (!targetType || !targetId || !title) throw new ApiError(400, "targetType, targetId, and title are required.");

  const bookmark = await Bookmark.findOneAndUpdate(
    { userId: req.userId, targetType, targetId },
    { $setOnInsert: { createdAt: new Date(), title, sub: sub || "" } },
    { upsert: true, new: true }
  );
  res.status(201).json({ bookmark });
});

export const remove = asyncHandler(async (req: AuthedRequest, res: Response) => {
  await Bookmark.deleteOne({ _id: req.params.id, userId: req.userId });
  res.status(204).send();
});
