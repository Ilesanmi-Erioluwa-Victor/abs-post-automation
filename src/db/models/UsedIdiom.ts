import { Schema, model, models } from "mongoose";
import type { Model } from "mongoose";

export interface UsedIdiomDoc {
  idiom: string;
  createdAt: Date;
}

const usedIdiomSchema = new Schema<UsedIdiomDoc>(
  {
    idiom: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false }
);

export const UsedIdiom: Model<UsedIdiomDoc> =
  (models.UsedIdiom as Model<UsedIdiomDoc> | undefined) ??
  model<UsedIdiomDoc>("UsedIdiom", usedIdiomSchema);
