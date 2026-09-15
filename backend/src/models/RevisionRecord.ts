import { Schema, model, Document, Types } from "mongoose";

type RevisionResult = "strong" | "review_soon" | "needs_revision";

interface IHistoryEntry {
  reviewedAt: Date;
  result: RevisionResult;
}

export interface IRevisionRecord extends Document {
  userId: Types.ObjectId;
  conceptId: Types.ObjectId;
  intervalDays: number;
  dueAt: Date;
  lastResult: RevisionResult;
  history: IHistoryEntry[];
}

const revisionRecordSchema = new Schema<IRevisionRecord>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  conceptId: { type: Schema.Types.ObjectId, ref: "Concept", required: true },
  intervalDays: { type: Number, default: 1 },
  dueAt: { type: Date, required: true },
  lastResult: { type: String, enum: ["strong", "review_soon", "needs_revision"] },
  // Capped at the most recent ~20 entries on write ($slice) so this document
  // doesn't grow unbounded — see revision.service.ts.
  history: [{ reviewedAt: Date, result: String }],
});

// This is the query the dashboard's "due for review" section runs on every
// load, so it needs to be fast.
revisionRecordSchema.index({ userId: 1, dueAt: 1 });

export const RevisionRecord = model<IRevisionRecord>("RevisionRecord", revisionRecordSchema);
