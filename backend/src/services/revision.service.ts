import { RevisionRecord, IRevisionRecord } from "../models/RevisionRecord";
import { Types } from "mongoose";

type RevisionResult = "strong" | "review_soon" | "needs_revision";

// v1: a fixed-ratio interval system, not a memory-strength model — the
// product surface should never claim otherwise. Isolated behind this one
// function so a real algorithm (e.g. SM-2, tracking an ease factor per
// concept) can replace it later without touching the schema or the caller.
export function computeNextInterval(currentIntervalDays: number, result: RevisionResult): number {
  if (result === "needs_revision") return 1;
  if (result === "review_soon") return Math.max(3, Math.round(currentIntervalDays * 1.3));
  return Math.round(currentIntervalDays * 2.2); // "strong" — push it out further
}

const STARTING_INTERVAL_DAYS = 1;
const MAX_HISTORY_ENTRIES = 20;

export async function recordReview(
  userId: Types.ObjectId,
  conceptId: Types.ObjectId,
  result: RevisionResult
): Promise<IRevisionRecord> {
  let record = await RevisionRecord.findOne({ userId, conceptId });
  const currentInterval = record?.intervalDays ?? STARTING_INTERVAL_DAYS;
  const nextInterval = computeNextInterval(currentInterval, result);
  const dueAt = new Date(Date.now() + nextInterval * 24 * 60 * 60 * 1000);

  if (!record) {
    record = new RevisionRecord({ userId, conceptId, intervalDays: nextInterval, dueAt, lastResult: result, history: [] });
  } else {
    record.intervalDays = nextInterval;
    record.dueAt = dueAt;
    record.lastResult = result;
  }

  record.history.push({ reviewedAt: new Date(), result });
  if (record.history.length > MAX_HISTORY_ENTRIES) {
    record.history = record.history.slice(-MAX_HISTORY_ENTRIES);
  }

  await record.save();
  return record;
}

export async function getDueForUser(userId: Types.ObjectId) {
  return RevisionRecord.find({ userId, dueAt: { $lte: new Date() } })
    .sort({ dueAt: 1 })
    .populate("conceptId");
}
