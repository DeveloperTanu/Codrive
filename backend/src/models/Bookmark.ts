import { Schema, model, Document, Types } from "mongoose";

export interface IBookmark extends Document {
  userId: Types.ObjectId;
  targetType: "concept" | "problem" | "project";
  targetId: Types.ObjectId;
  // Denormalized display fields, set once at creation from the target
  // document. targetType is polymorphic (concept/problem/project each live
  // in a different collection), so there's no single populate() path back
  // to a title — duplicating these two strings here is the standard,
  // pragmatic fix, and they're small/immutable enough that staleness isn't
  // a real concern (a concept's title essentially never changes after
  // authoring).
  title: string;
  sub: string;
  createdAt: Date;
}

const bookmarkSchema = new Schema<IBookmark>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  targetType: { type: String, enum: ["concept", "problem", "project"], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  sub: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

bookmarkSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

export const Bookmark = model<IBookmark>("Bookmark", bookmarkSchema);
