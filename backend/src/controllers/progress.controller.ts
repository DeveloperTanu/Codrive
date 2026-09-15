import { Response } from "express";
import { Progress } from "../models/Progress";
import { Submission } from "../models/Submission";
import { RevisionRecord } from "../models/RevisionRecord";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthedRequest } from "../middleware/auth.middleware";
import { Types } from "mongoose";

// A real aggregate, computed from the actual collections a user's activity
// writes to (Progress, Submission, RevisionRecord) — not a fabricated or
// hand-maintained counter anywhere.
export const summary = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const userId = new Types.ObjectId(req.userId);

  const [progressDocs, submissions, revisionRecords] = await Promise.all([
    Progress.find({ userId }),
    Submission.find({ userId }),
    RevisionRecord.find({ userId }).populate("conceptId"),
  ]);

  const conceptsReviewed = progressDocs.filter((p) => p.timesReviewed > 0).length;
  const problemsSolved = submissions.filter((s) => s.passed).length;
  const problemsAttempted = submissions.length;

  // Streak: consecutive calendar days (UTC) with at least one revision
  // event, walking backward from today. Computed on the fly from
  // RevisionRecord.history rather than stored as its own counter, so it can
  // never drift out of sync with the history it's derived from.
  const reviewDates = new Set<string>();
  revisionRecords.forEach((r) => {
    r.history.forEach((h) => reviewDates.add(new Date(h.reviewedAt).toISOString().slice(0, 10)));
  });
  let streakDays = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!reviewDates.has(key)) break;
    streakDays++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const dueForReview = revisionRecords.filter((r) => r.dueAt.getTime() <= Date.now());

  // Mastery per language, derived the same way the frontend prototype
  // computed it locally: strong=1, review_soon=0.5, needs_revision=0.
  const byLanguage: Record<string, number[]> = {};
  revisionRecords.forEach((r) => {
    const concept = r.conceptId as unknown as { languageId?: unknown; title?: string } | null;
    const langKey = concept && "languageId" in concept ? String(concept.languageId) : "unknown";
    const score = r.lastResult === "strong" ? 1 : r.lastResult === "review_soon" ? 0.5 : 0;
    byLanguage[langKey] = byLanguage[langKey] || [];
    byLanguage[langKey].push(score);
  });
  const masteryByLanguage = Object.entries(byLanguage).map(([languageId, scores]) => ({
    languageId,
    masteryPercent: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100),
  }));

  // Weak/strong concept lists and a flattened recent-history feed — same
  // data the dashboard and progress page need, computed here once so both
  // pages hit one endpoint instead of independently re-deriving it.
  const conceptTitle = (r: (typeof revisionRecords)[number]) => {
    const c = r.conceptId as unknown as { title?: string } | null;
    return c?.title || "Unknown concept";
  };
  const weakConcepts = revisionRecords
    .filter((r) => r.lastResult === "needs_revision" || r.lastResult === "review_soon")
    .slice(0, 5)
    .map((r) => ({ title: conceptTitle(r), lastResult: r.lastResult }));
  const strongConcepts = revisionRecords
    .filter((r) => r.lastResult === "strong")
    .slice(0, 5)
    .map((r) => ({ title: conceptTitle(r) }));

  const recentHistory = revisionRecords
    .flatMap((r) => r.history.map((h) => ({ title: conceptTitle(r), result: h.result, reviewedAt: h.reviewedAt })))
    .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime())
    .slice(0, 8);

  const recentlyReviewed = [...revisionRecords]
    .sort((a, b) => {
      const aLast = a.history[a.history.length - 1]?.reviewedAt?.getTime() ?? 0;
      const bLast = b.history[b.history.length - 1]?.reviewedAt?.getTime() ?? 0;
      return bLast - aLast;
    })
    .slice(0, 3)
    .map((r) => ({ title: conceptTitle(r), lastReviewedAt: r.history[r.history.length - 1]?.reviewedAt }));

  // Full per-concept status map (not capped at 5 like weak/strong above) —
  // the language library page needs every concept's status, not just the
  // headline ones the dashboard cares about.
  const conceptIdOf = (r: (typeof revisionRecords)[number]) => {
    const c = r.conceptId as unknown as { _id?: unknown } | null;
    return c && "_id" in c ? String(c._id) : String(r.conceptId);
  };

  const byConceptId: Record<string, { lastResult: string; timesReviewed: number }> = {};
  revisionRecords.forEach((r) => {
    byConceptId[conceptIdOf(r)] = { lastResult: r.lastResult, timesReviewed: r.history.length };
  });

  res.json({
    conceptsReviewed,
    problemsSolved,
    problemsAttempted,
    streakDays,
    dueCount: dueForReview.length,
    masteryByLanguage,
    weakConcepts,
    strongConcepts,
    recentHistory,
    recentlyReviewed,
    byConceptId,
  });
});
