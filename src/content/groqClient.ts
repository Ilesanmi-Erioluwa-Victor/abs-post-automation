import Groq from "groq-sdk";
import { env } from "../config/env";

export const GROQ_MODEL = env.groqModel;

export const groq = new Groq({ apiKey: env.groqApiKey });

const STRICT_REMINDER =
  "Return ONLY the raw JSON object — no prose, no markdown, no code fences, no trailing text.";

export async function generateJson<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt =
      attempt === 2
        ? `${userPrompt}\n\n${STRICT_REMINDER}`
        : userPrompt;

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
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Groq failed to return valid JSON after 2 attempts.");
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as T;
}
