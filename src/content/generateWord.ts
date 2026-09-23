import { LetterProgress } from "../db/models/LetterProgress";
import type { LetterProgressDoc } from "../db/models/LetterProgress";
import { UsedWord } from "../db/models/UsedWord";
import { env } from "../config/env";
import { generateJson } from "./groqClient";
import type { HydratedDocument } from "mongoose";
import type { ContentBundle } from "./types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const SYSTEM_PROMPT =
  "You are a professional English vocabulary teacher. You always respond with " +
  "only valid JSON objects that match the requested schema exactly.";

const USER_PROMPT_TEMPLATE = (
  letter: string,
  usedWords: string[],
  cycle: number,
  attempt: number
): string => {
  const difficulty =
    cycle === 0
      ? "common, genuinely useful everyday vocabulary"
      : cycle === 1
        ? "solidly common vocabulary, slightly more advanced than average"
        : "challenging but genuinely common and useful vocabulary";

  // After a few collisions (e.g. letters like X with small pools), allow
  // rare but real words rather than failing the whole item.
  const rarityHint =
    attempt >= 4
      ? " If you cannot think of an unused common word, a rare but real English word is acceptable."
      : "";

  return `Generate exactly ONE English vocabulary word.
- The word MUST start with the letter "${letter}".
- It must NOT be any of these already-used words: ${JSON.stringify(usedWords)}.
- Do NOT restrict word length. Include short everyday words (like "at", "by", "us", "bi") as well as longer ones, just like a normal dictionary.
- Choose ${difficulty}. Avoid obscure, archaic, or overly technical words.${rarityHint}
- Respond with ONLY a JSON object with exactly these fields:
  term (string),
  meaning (string, plain-language definition),
  thinkOfItAs (string, a short memorable analogy to help learners remember),
  examples (array of exactly 2 objects, each with "scenario" and "quote" strings),
  usedIn (string, one short sentence showing the word in natural use),
  mood ("positive" | "negative" | "neutral").`;
};

type LetterProgressHydrated = HydratedDocument<LetterProgressDoc>;

// Some letters (X, Q, Z...) have small pools of common words. Trying several
// candidates per item keeps the pipeline flowing as history grows.
const MAX_GENERATION_ATTEMPTS = 6;

async function getOrInitLetterProgress(): Promise<LetterProgressHydrated> {
  let doc = await LetterProgress.findById("letterProgress");
  if (!doc) {
    doc = await LetterProgress.create({
      _id: "letterProgress",
      currentLetter: "A",
      usedWords: [],
      wordsPerLetter: env.wordsPerLetter,
      cycleCount: 0,
    });
  }
  return doc;
}

async function getRecentUsedWords(): Promise<string[]> {
  const docs = await UsedWord.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .select("word")
    .lean();
  return docs.map((doc) => doc.word.toLowerCase());
}

async function getFullUsedWords(): Promise<string[]> {
  const docs = await UsedWord.find({}).select("word").lean();
  return docs.map((doc) => doc.word.toLowerCase());
}

export async function generateWord(): Promise<ContentBundle> {
  const progress = await getOrInitLetterProgress();
  const letter = progress.currentLetter.toUpperCase();
  const cycle = progress.cycleCount;
  const recent = await getRecentUsedWords();
  const full = await getFullUsedWords();
  const letterUsed = (progress.usedWords ?? []).map((w) => w.toLowerCase());
  const tried: string[] = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const excluded = [...recent, ...letterUsed, ...tried];
    let prompt = USER_PROMPT_TEMPLATE(letter, excluded, cycle, attempt);
    if (tried.length > 0) {
      prompt += `\n\nThe word "${tried[tried.length - 1]}" has already been used. Generate a different one.`;
    }

    const content = await generateJson<ContentBundle>(SYSTEM_PROMPT, prompt);

    const term = content.term.trim().toLowerCase();
    if (!term.startsWith(letter.toLowerCase())) {
      throw new Error(
        `Generated word "${content.term}" does not start with letter "${letter}".`
      );
    }
    if (full.includes(term) || letterUsed.includes(term)) {
      tried.push(content.term);
      continue;
    }

    progress.usedWords = [...letterUsed, term];
    if (progress.usedWords.length >= progress.wordsPerLetter) {
      advanceLetter(progress);
    }
    await progress.save();
    await UsedWord.create({ word: term, letter });

    return { ...content, type: "word" };
  }

  // The letter's pool is exhausted (e.g. X): advance so future runs don't
  // keep failing on the same letter, then report this item as failed.
  advanceLetter(progress);
  await progress.save();
  throw new Error(
    `Could not generate a fresh word for "${letter}" after ${MAX_GENERATION_ATTEMPTS} attempts (tried: ${tried.join("; ")}). Advanced to "${progress.currentLetter}".`
  );
}

function advanceLetter(progress: LetterProgressHydrated): void {
  const index = ALPHABET.indexOf(progress.currentLetter.toUpperCase());
  if (index === -1 || index === ALPHABET.length - 1) {
    progress.currentLetter = "A";
    progress.cycleCount += 1;
  } else {
    progress.currentLetter = ALPHABET[index + 1];
  }
  progress.usedWords = [];
}
