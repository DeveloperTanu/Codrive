import { Schema, model, Document, Types } from "mongoose";

interface IExample {
  input: string;
  output: string;
}

interface ITestCase {
  input: unknown;
  expectedOutput: unknown;
  hidden: boolean;
}

export interface IProblem extends Document {
  conceptIds: Types.ObjectId[];
  title: string;
  type: "easy" | "normal" | "hard" | "challenger" | "builder";
  description: string;
  requirements: string[];
  examples: IExample[];
  constraints: string[];
  starterCode: Map<string, string>;
  testCases: ITestCase[];
}

const problemSchema = new Schema<IProblem>({
  conceptIds: [{ type: Schema.Types.ObjectId, ref: "Concept" }],
  title: { type: String, required: true },
  type: { type: String, enum: ["easy", "normal", "hard", "challenger", "builder"], required: true },
  description: { type: String, required: true },
  requirements: [String],
  examples: [{ input: String, output: String }],
  constraints: [String],
  starterCode: { type: Map, of: String },
  // testCases (including hidden ones) are never sent to the client directly —
  // see problems.controller.ts, which strips them before responding.
  testCases: [{ input: Schema.Types.Mixed, expectedOutput: Schema.Types.Mixed, hidden: Boolean }],
});

problemSchema.index({ conceptIds: 1 });

export const Problem = model<IProblem>("Problem", problemSchema);
