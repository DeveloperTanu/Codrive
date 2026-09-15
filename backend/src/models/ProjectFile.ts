import { Schema, model, Document, Types } from "mongoose";

export interface IProjectFile extends Document {
  projectId: Types.ObjectId;
  path: string; // e.g. "backend/controllers/taskController.ts"
  content: string;
  updatedAt: Date;
}

// One document per file, not one giant blob per project — this is what keeps
// save/rename operations cheap and avoids the "entire app in one document"
// anti-pattern called out in the architecture spec.
const projectFileSchema = new Schema<IProjectFile>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  path: { type: String, required: true },
  content: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now },
});

projectFileSchema.index({ projectId: 1, path: 1 }, { unique: true });

export const ProjectFile = model<IProjectFile>("ProjectFile", projectFileSchema);
