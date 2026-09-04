import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "" || value.trim().startsWith("<")) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        "Copy .env.example to .env and fill in all values."
    );
  }
  return value.trim();
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "" || value.trim().startsWith("<")) {
    return fallback;
  }
  return value.trim();
}

export const env = {
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  port: Number(optionalEnv("PORT", "3000")),

  mongodbUri: requireEnv("MONGODB_URI"),

  groqApiKey: requireEnv("GROQ_API_KEY"),
  groqModel: optionalEnv("GROQ_MODEL", "openai/gpt-oss-120b"),

  cloudinaryCloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
  cloudinaryApiKey: requireEnv("CLOUDINARY_API_KEY"),
  cloudinaryApiSecret: requireEnv("CLOUDINARY_API_SECRET"),

  sitePostEndpoint: requireEnv("SITE_POST_ENDPOINT"),
  siteApiKey: requireEnv("SITE_API_KEY"),

  triggerAuthToken: requireEnv("TRIGGER_AUTH_TOKEN"),

  brevoApiKey: optionalEnv("BREVO_API_KEY", ""),
  brevoEmail: optionalEnv("BREVO_EMAIL", ""),
  notifyEmail: optionalEnv("NOTIFY_EMAIL", ""),

  wordsPerLetter: Number(optionalEnv("WORDS_PER_LETTER", "5")),
};

export type Env = typeof env;
