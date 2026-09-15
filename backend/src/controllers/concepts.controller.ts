import { Response } from "express";
import { Concept } from "../models/Concept";
import { Language } from "../models/Language";
import { RevisionRecord } from "../models/RevisionRecord";
import { Progress } from "../models/Progress";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { recordReview } from "../services/revision.service";
import { AuthedRequest } from "../middleware/auth.middleware";
import { Types } from "mongoose";

export const listByLanguageAndCategory = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { languageSlug, categorySlug } = req.params;
  const language = await Language.findOne({ slug: languageSlug });
  if (!language) throw new ApiError(404, "Language not found.");

  const page = parseInt((req.query.page as string) || "1", 10);
  const limit = parseInt((req.query.limit as string) || "20", 10);

  const concepts = await Concept.find({ languageId: language._id, categorySlug })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({ concepts, page, limit });
});

export const getById = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const concept = await Concept.findById(req.params.id);
  if (!concept) throw new ApiError(404, "Concept not found.");
  res.json({ concept });
});

// Marks a concept reviewed: updates the Progress snapshot AND schedules the
// next spaced-revision date via revision.service. `result` reflects how the
// review went (e.g. from a quick-check outcome) — defaults to "review_soon"
// for a plain "mark as reviewed" click with no signal either way.
export const markReviewed = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const userId = new Types.ObjectId(req.userId);
  const conceptId = new Types.ObjectId(req.params.id);
  const result = req.body.result || "review_soon";

  await Progress.findOneAndUpdate(
    { userId, conceptId },
    { $inc: { timesReviewed: 1 }, $set: { lastReviewedAt: new Date() } },
    { upsert: true }
  );

  const record = await recordReview(userId, conceptId, result);
  res.json({ revisionRecord: record });
});

export const getDueForReview = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const userId = new Types.ObjectId(req.userId);
  const due = await RevisionRecord.find({ userId, dueAt: { $lte: new Date() } })
    .sort({ dueAt: 1 })
    .populate("conceptId");
  res.json({ due });
});
