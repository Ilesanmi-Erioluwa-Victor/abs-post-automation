import { Schema, model, models } from "mongoose";
import type { Model } from "mongoose";

export type ContentType = "word" | "idiom";
export type BatchSlot = "morning" | "afternoon" | "night";
export type PostStatus = "posted" | "failed";
export type Mood = "positive" | "negative" | "neutral";

export interface ExamplePanel {
  scenario: string;
  quote: string;
}

export interface PostDoc {
  type: ContentType;
  term: string;
  meaning: string;
  thinkOfItAs: string;
  examples: ExamplePanel[];
  usedIn: string;
  imageUrl: string;
  batchSlot: BatchSlot;
  status: PostStatus;
  errorMessage: string | null;
  createdAt: Date;
}

const postSchema = new Schema<PostDoc>(
  {
    type: { type: String, enum: ["word", "idiom"], required: true },
    term: { type: String, default: "" },
    meaning: { type: String, default: "" },
    thinkOfItAs: { type: String, default: "" },
    examples: {
      type: [
        {
          scenario: { type: String, default: "" },
          quote: { type: String, default: "" },
        },
      ],
      default: [],
    },
    usedIn: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    batchSlot: {
      type: String,
      enum: ["morning", "afternoon", "night"],
      required: true,
    },
    status: { type: String, enum: ["posted", "failed"], required: true },
    errorMessage: { type: String, default: null },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ type: 1, createdAt: -1 });

export const Post: Model<PostDoc> =
  (models.Post as Model<PostDoc> | undefined) ??
  model<PostDoc>("Post", postSchema);
