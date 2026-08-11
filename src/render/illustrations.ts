import { env } from "../config/env";
import type { Mood } from "../db/models/Post";

interface IllustrationEntry {
  mood: Mood;
  url: string;
}

function cloudUrl(publicId: string): string {
  return `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/v1/idiom-bot/illustrations/${publicId}`;
}

/**
 * Pre-generated, cached illustration set (10 entries). Images must be uploaded
 * to Cloudinary under /idiom-bot/illustrations/ before first run (see README).
 * renderCard() only ever fetches these cached URLs - no art is generated per post.
 */
export const ILLUSTRATIONS: IllustrationEntry[] = [
  { mood: "positive", url: cloudUrl("positive-1.png") },
  { mood: "positive", url: cloudUrl("positive-2.png") },
  { mood: "positive", url: cloudUrl("positive-3.png") },
  { mood: "negative", url: cloudUrl("negative-1.png") },
  { mood: "negative", url: cloudUrl("negative-2.png") },
  { mood: "negative", url: cloudUrl("negative-3.png") },
  { mood: "neutral", url: cloudUrl("neutral-1.png") },
  { mood: "neutral", url: cloudUrl("neutral-2.png") },
  { mood: "neutral", url: cloudUrl("neutral-3.png") },
  { mood: "neutral", url: cloudUrl("neutral-4.png") },
];

let rotationIndex = 0;

export function getIllustrationFor(mood: Mood): string {
  const pool = ILLUSTRATIONS.filter((entry) => entry.mood === mood);
  const url = pool[rotationIndex % pool.length].url;
  rotationIndex += 1;
  return url;
}
