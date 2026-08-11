import { UsedIdiom } from "../db/models/UsedIdiom";
import { generateJson } from "./groqClient";
import type { ContentBundle } from "./types";

const SYSTEM_PROMPT =
  "You are a professional English idioms teacher. You always respond with " +
  "only valid JSON objects that match the requested schema exactly.";

const USER_PROMPT_TEMPLATE = (recentUsed: string[]): string => {
  return `Generate exactly ONE common English idiom.
- It must NOT be any of these already-used idioms: ${JSON.stringify(recentUsed)}.
- Choose a genuinely common, widely understood idiom. Avoid obscure or regional-only phrases.
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

export async function generateIdiom(): Promise<ContentBundle> {
  const recent = await getRecentUsedIdioms();
  const full = await getFullUsedIdioms();

  const first = await generateJson<ContentBundle>(
    SYSTEM_PROMPT,
    USER_PROMPT_TEMPLATE(recent)
  );

  const firstNormalized = first.term.toLowerCase().trim();
  if (!hasCollision(firstNormalized, full)) {
    await UsedIdiom.create({ idiom: firstNormalized });
    return { ...first, type: "idiom" };
  }

  const second = await generateJson<ContentBundle>(
    SYSTEM_PROMPT,
    `${USER_PROMPT_TEMPLATE(recent)}\n\nThe idiom "${first.term}" has already been used. Generate a different one.`
  );

  const secondNormalized = second.term.toLowerCase().trim();
  if (hasCollision(secondNormalized, full)) {
    throw new Error(
      `Generated idiom "${second.term}" collides with an already-used idiom after regeneration.`
    );
  }

  await UsedIdiom.create({ idiom: secondNormalized });
  return { ...second, type: "idiom" };
}
