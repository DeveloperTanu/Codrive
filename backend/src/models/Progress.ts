import { Schema, model, Document, Types } from "mongoose";

// One document per user per concept — a current-state snapshot, not a log.
// (The log lives in Submission and RevisionRecord.history instead.)
export interface IProgress extends Document {
  userId: Types.ObjectId;
  conceptId: Types.ObjectId;
  timesReviewed: number;
  problemsSolved: number;
  problemsAttempted: number;
  lastReviewedAt: Date;
}

const progressSchema = new Schema<IProgress>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  conceptId: { type: Schema.Types.ObjectId, ref: "Concept", required: true },
  timesReviewed: { type: Number, default: 0 },
  problemsSolved: { type: Number, default: 0 },
  problemsAttempted: { type: Number, default: 0 },
  lastReviewedAt: { type: Date, default: Date.now },
});

progressSchema.index({ userId: 1, conceptId: 1 }, { unique: true });

export const Progress = model<IProgress>("Progress", progressSchema);
