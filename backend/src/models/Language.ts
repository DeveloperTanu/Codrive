import { Schema, model, Document } from "mongoose";

interface ICategory {
  slug: string;
  name: string;
  order: number;
}

export interface ILanguage extends Document {
  slug: string;
  name: string;
  categories: ICategory[];
}

const categorySchema = new Schema<ICategory>(
  {
    slug: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);

// Categories live on the language document (not hard-coded in the frontend) so
// new categories can be added per §14 of the product spec without a UI change.
const languageSchema = new Schema<ILanguage>({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  categories: [categorySchema],
});

export const Language = model<ILanguage>("Language", languageSchema);
