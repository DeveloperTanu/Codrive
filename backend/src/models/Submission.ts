import { Schema, model, Document, Types } from "mongoose";

interface ITestResult {
  testCaseIndex: number;
  passed: boolean;
  actualOutput: unknown;
}

export interface ISubmission extends Document {
  userId: Types.ObjectId;
  problemId: Types.ObjectId;
  code: string;
  language: string;
  passed: boolean;
  testResults: ITestResult[];
  usedHints: number; // tracks whether the user solved it independently
  viewedSolution: boolean;
  submittedAt: Date;
}

const submissionSchema = new Schema<ISubmission>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  problemId: { type: Schema.Types.ObjectId, ref: "Problem", required: true },
  code: { type: String, required: true },
  language: { type: String, required: true },
  passed: { type: Boolean, required: true },
  testResults: [{ testCaseIndex: Number, passed: Boolean, actualOutput: Schema.Types.Mixed }],
  usedHints: { type: Number, default: 0 },
  viewedSolution: { type: Boolean, default: false },
  submittedAt: { type: Date, default: Date.now },
});

submissionSchema.index({ userId: 1, problemId: 1, submittedAt: -1 });

export const Submission = model<ISubmission>("Submission", submissionSchema);
