import { Schema, model, Document, Types } from "mongoose";

export interface IHint extends Document {
  problemId: Types.ObjectId;
  order: number; // 1, 2, 3 — revealed progressively, never all at once
  text: string;
}

const hintSchema = new Schema<IHint>({
  problemId: { type: Schema.Types.ObjectId, ref: "Problem", required: true },
  order: { type: Number, required: true },
  text: { type: String, required: true },
});

hintSchema.index({ problemId: 1, order: 1 }, { unique: true });

export const Hint = model<IHint>("Hint", hintSchema);
