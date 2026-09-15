import { Schema, model, Document, Types } from "mongoose";

interface ICategory {
  slug: string;
  name: string;
  order: number;
}

export interface IFramework extends Document {
  slug: string;
  name: string;
  languageId: Types.ObjectId;
  categories: ICategory[];
}

const categorySchema = new Schema<ICategory>(
  { slug: String, name: String, order: Number },
  { _id: false }
);

const frameworkSchema = new Schema<IFramework>({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  languageId: { type: Schema.Types.ObjectId, ref: "Language", required: true },
  categories: [categorySchema],
});

frameworkSchema.index({ languageId: 1 });

export const Framework = model<IFramework>("Framework", frameworkSchema);
