import { UsedIdiom } from "../db/models/UsedIdiom";
import { generateJson } from "./groqClient";
import type { ContentBundle } from "./types";

const SYSTEM_PROMPT =
  "You are a professional English idioms teacher. You always respond with " +
  "only valid JSON objects that match the requested schema exactly.";

const USER_PROMPT_TEMPLATE = (recentUsed: string[], attempt: number): string => {
  // After a few collisions, let the model reach for real but less common
  // idioms — a genuine idiom beats failing the whole item.
  const rarityHint =
    attempt >= 4
      ? "\n- If you cannot think of an unused common idiom, choose a real but less common English idiom instead. It must still be a genuine, recognized idiom."
      : "";
  return `Generate exactly ONE common English idiom.
- It must NOT be any of these already-used idioms: ${JSON.stringify(recentUsed)}.
- Choose a genuinely common, widely understood idiom. Avoid obscure or regional-only phrases.${rarityHint}
- Respond with ONLY a JSON object with exactly these fields:
  term (string, the idiom itself),
  meaning (string, plain-language explanation),
  thinkOfItAs (string, a short memorable analogy to help learners remember),
  examples (array of exactly 2 objects, each with "scenario" and "quote" strings),
  usedIn (string, one short sentence showing the idiom in natural use),
  mood ("positive" | "negative" | "neutral").`;
};

async function getRecentUsedIdioms(): Promise<string[]> {
  const docs = await UsedIdiom.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .select("idiom")
    .lean();
  return docs.map((doc) => doc.idiom.toLowerCase());
}

async function getFullUsedIdioms(): Promise<string[]> {
  const docs = await UsedIdiom.find({}).select("idiom").lean();
  return docs.map((doc) => doc.idiom.toLowerCase());
}

function hasCollision(normalized: string, fullUsed: string[]): boolean {
  return fullUsed.some(
    (used) => used === normalized || used.includes(normalized) || normalized.includes(used)
  );
}

// The used-idiom pool grows forever, so a single regeneration is no longer
// enough — try several candidates before giving up on the item.
const MAX_GENERATION_ATTEMPTS = 6;

export async function generateIdiom(): Promise<ContentBundle> {
  const recent = await getRecentUsedIdioms();
  const full = await getFullUsedIdioms();
  const tried: string[] = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const excluded = [...recent, ...tried];
    let prompt = USER_PROMPT_TEMPLATE(excluded, attempt);
    if (tried.length > 0) {
      prompt += `\n\nThe idiom "${tried[tried.length - 1]}" has already been used. Generate a different one.`;
    }

    const candidate = await generateJson<ContentBundle>(SYSTEM_PROMPT, prompt);
    const normalized = candidate.term.toLowerCase().trim();
    if (!hasCollision(normalized, full)) {
      await UsedIdiom.create({ idiom: normalized });
      return { ...candidate, type: "idiom" };
    }
    tried.push(candidate.term);
  }

  throw new Error(
    `Could not generate a fresh idiom after ${MAX_GENERATION_ATTEMPTS} attempts (tried: ${tried.join("; ")}).`
  );
}
