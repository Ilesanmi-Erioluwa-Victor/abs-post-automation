import { Schema, model, models } from "mongoose";
import type { Model } from "mongoose";

export interface UsedWordDoc {
  word: string;
  letter: string;
  createdAt: Date;
}

const usedWordSchema = new Schema<UsedWordDoc>(
  {
    word: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    letter: { type: String, required: true, uppercase: true, trim: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false }
);

export const UsedWord: Model<UsedWordDoc> =
  (models.UsedWord as Model<UsedWordDoc> | undefined) ??
  model<UsedWordDoc>("UsedWord", usedWordSchema);
