import { Schema, model, Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  avatarData?: string;
  createdAt: Date;
  lastActiveAt: Date;
  preferences: {
    theme: "light" | "dark" | "system";
    defaultLanguage?: Types.ObjectId;
  };
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Never store, log, or return this field as plaintext at any point — see auth.service.ts
  passwordHash: { type: String, required: true, select: false },
  name: { type: String, required: true, trim: true },
  avatarData: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  preferences: {
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    defaultLanguage: { type: Schema.Types.ObjectId, ref: "Language" },
  },
});

export const User = model<IUser>("User", userSchema);
