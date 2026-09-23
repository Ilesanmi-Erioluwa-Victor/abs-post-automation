import Groq from "groq-sdk";
import { env } from "../config/env";

export const GROQ_MODEL = env.groqModel;

export const groq = new Groq({ apiKey: env.groqApiKey });

const STRICT_REMINDER =
  "Return ONLY the raw JSON object — no prose, no markdown, no code fences, no trailing text.";

// Total Groq calls per attempt-loop. Rate-limit (429) retries consume these
// attempts; JSON syntax retries are additionally capped by MAX_JSON_RETRIES.
const MAX_ATTEMPTS = 6;
const MAX_JSON_RETRIES = 2;
const MAX_BACKOFF_MS = 30_000;

export function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    if ((error as { status?: unknown }).status === 429) return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /rate limit|429|too many requests/i.test(message);
}

// Honor the server's "try again in X" hint when present, otherwise
// exponential backoff (2s, 4s, 8s, ...) capped at 30s.
export function rateLimitDelayMs(error: unknown, attempt: number): number {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/try again in ([\d.]+)\s*(ms|s)/i);
  if (match) {
    const value = Number(match[1]);
    const hinted = match[2].toLowerCase() === "s" ? value * 1000 : value;
    if (Number.isFinite(hinted)) {
      return Math.min(Math.ceil(hinted) + 1000, MAX_BACKOFF_MS);
    }
  }
  return Math.min(2000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateJson<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  let lastError: unknown;
  let jsonRetries = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt =
      jsonRetries > 0 ? `${userPrompt}\n\n${STRICT_REMINDER}` : userPrompt;

    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const raw = completion.choices?.[0]?.message?.content ?? "";
      return parseJson<T>(raw);
    } catch (err) {
      lastError = err;
      if (err instanceof SyntaxError) {
        jsonRetries += 1;
        if (jsonRetries >= MAX_JSON_RETRIES) break;
        continue;
      }
      if (isRateLimitError(err) && attempt < MAX_ATTEMPTS) {
        const delay = rateLimitDelayMs(err, attempt);
        console.warn(
          `[groq] rate limited (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${delay}ms`
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Groq failed to return valid JSON after retries.");
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as T;
}
