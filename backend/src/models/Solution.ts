import { Schema, model, Document, Types } from "mongoose";

export interface ISolution extends Document {
  problemId: Types.ObjectId;
  language: string;
  code: string;
  explanation: {
    whyItWorks: string;
    alternatives: string;
    commonMistakes: string;
  };
}

// Kept as a separate collection from Problem (not embedded) so a normal
// problem-fetch can never accidentally include the solution — a reveal
// requires a deliberate, separate query in solutions.controller.ts.
const solutionSchema = new Schema<ISolution>({
  problemId: { type: Schema.Types.ObjectId, ref: "Problem", required: true },
  language: { type: String, required: true },
  code: { type: String, required: true },
  explanation: {
    whyItWorks: String,
    alternatives: String,
    commonMistakes: String,
  },
});

solutionSchema.index({ problemId: 1, language: 1 });

export const Solution = model<ISolution>("Solution", solutionSchema);
