import { Schema, model, models } from "mongoose";
import type { Model } from "mongoose";

export interface LetterProgressDoc {
  _id: string;
  currentLetter: string;
  usedWords: string[];
  wordsPerLetter: number;
  cycleCount: number;
}

const letterProgressSchema = new Schema<LetterProgressDoc>(
  {
    _id: { type: String, required: true },
    currentLetter: {
      type: String,
      required: true,
      default: "A",
      uppercase: true,
    },
    usedWords: { type: [String], required: true, default: [] },
    wordsPerLetter: { type: Number, required: true, default: 5, min: 1 },
    cycleCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { versionKey: false }
);

export const LetterProgress: Model<LetterProgressDoc> =
  (models.LetterProgress as Model<LetterProgressDoc> | undefined) ??
  model<LetterProgressDoc>("LetterProgress", letterProgressSchema);
