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
  cycle: number
): string => {
  const difficulty =
    cycle === 0
      ? "common, genuinely useful everyday vocabulary"
      : cycle === 1
        ? "solidly common vocabulary, slightly more advanced than average"
        : "challenging but genuinely common and useful vocabulary";

  return `Generate exactly ONE English vocabulary word.
- The word MUST start with the letter "${letter}".
- It must NOT be any of these already-used words: ${JSON.stringify(usedWords)}.
- Do NOT restrict word length. Include short everyday words (like "at", "by", "us", "bi") as well as longer ones, just like a normal dictionary.
- Choose ${difficulty}. Avoid obscure, archaic, or overly technical words.
- Respond with ONLY a JSON object with exactly these fields:
  term (string),
  meaning (string, plain-language definition),
  thinkOfItAs (string, a short memorable analogy to help learners remember),
  examples (array of exactly 2 objects, each with "scenario" and "quote" strings),
  usedIn (string, one short sentence showing the word in natural use),
  mood ("positive" | "negative" | "neutral").`;
};

type LetterProgressHydrated = HydratedDocument<LetterProgressDoc>;

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

  const content = await generateJson<ContentBundle>(
    SYSTEM_PROMPT,
    USER_PROMPT_TEMPLATE(letter, [...recent, ...letterUsed], cycle)
  );

  const term = content.term.trim().toLowerCase();
  if (!term.startsWith(letter.toLowerCase())) {
    throw new Error(
      `Generated word "${content.term}" does not start with letter "${letter}".`
    );
  }
  if (full.includes(term) || letterUsed.includes(term)) {
    const regenerated = await generateJson<ContentBundle>(
      SYSTEM_PROMPT,
      `${USER_PROMPT_TEMPLATE(letter, [...recent, ...letterUsed], cycle)}\n\nThe word "${content.term}" has already been used. Generate a different one.`
    );
    const retryTerm = regenerated.term.trim().toLowerCase();
    if (!retryTerm.startsWith(letter.toLowerCase())) {
      throw new Error(
        `Regenerated word "${regenerated.term}" does not start with letter "${letter}".`
      );
    }
    if (full.includes(retryTerm) || letterUsed.includes(retryTerm)) {
      throw new Error(
        `Generated word "${regenerated.term}" was already used for "${letter}".`
      );
    }
    progress.usedWords = [...letterUsed, retryTerm];
    if (progress.usedWords.length >= progress.wordsPerLetter) {
      advanceLetter(progress);
    }
    await progress.save();
    await UsedWord.create({ word: retryTerm, letter });
    return { ...regenerated, type: "word" };
  }

  progress.usedWords = [...letterUsed, term];
  if (progress.usedWords.length >= progress.wordsPerLetter) {
    advanceLetter(progress);
  }
  await progress.save();
  await UsedWord.create({ word: term, letter });

  return { ...content, type: "word" };
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
