import { Schema, model, Document, Types } from "mongoose";

interface ICommonMistake {
  title: string;
  body: string;
}

interface IQuickCheck {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface IConcept extends Document {
  slug: string;
  title: string;
  languageId?: Types.ObjectId;
  frameworkId?: Types.ObjectId;
  categorySlug: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  content: {
    whatIsIt: string;
    syntax: string;
    mentalModel: string;
    commonMistakes: ICommonMistake[];
    remember: string;
    quickCheck: IQuickCheck;
  };
}

const conceptSchema = new Schema<IConcept>({
  slug: { type: String, required: true },
  title: { type: String, required: true },
  languageId: { type: Schema.Types.ObjectId, ref: "Language" },
  frameworkId: { type: Schema.Types.ObjectId, ref: "Framework" },
  categorySlug: { type: String, required: true },
  difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
  estimatedMinutes: { type: Number, default: 4 },
  content: {
    whatIsIt: String,
    syntax: String,
    mentalModel: String,
    commonMistakes: [{ title: String, body: String }],
    remember: String,
    quickCheck: {
      question: String,
      options: [String],
      correctIndex: Number,
    },
  },
});

conceptSchema.index({ languageId: 1, categorySlug: 1 });
conceptSchema.index({ frameworkId: 1, categorySlug: 1 });

export const Concept = model<IConcept>("Concept", conceptSchema);
