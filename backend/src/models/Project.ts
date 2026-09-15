import { Schema, model, Document, Types } from "mongoose";

export interface IProject extends Document {
  userId: Types.ObjectId;
  title: string;
  templateSlug: string;
  status: "in_progress" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  templateSlug: { type: String, required: true },
  status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

projectSchema.index({ userId: 1 });

export const Project = model<IProject>("Project", projectSchema);
