import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    return value.toLowerCase() === 'true';
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  APP_TIMEZONE: z.string().default('Africa/Lagos'),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: booleanFromEnv.default(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().min(1),
  EMAIL_TO: z.string().min(1),
  POST_PROVIDER_NAME: z.string().min(1),
  POST_PROVIDER_ENDPOINT: z.string().url(),
  POST_PROVIDER_TOKEN: z.string().min(1),
  POST_PROVIDER_VISIBILITY_TYPE: z.string().min(1).default('Everyone'),
  POST_RETRY_LIMIT: z.coerce.number().int().positive().default(5),
  SESSION_MORNING_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  SESSION_AFTERNOON_HOUR: z.coerce.number().int().min(0).max(23).default(14),
  SESSION_EVENING_HOUR: z.coerce.number().int().min(0).max(23).default(20),
  SESSION_POST_LIMIT: z.coerce.number().int().positive().default(6),
  SESSION_POST_INTERVAL_MINUTES: z.coerce.number().int().positive().default(12),
  POST_BATCH_LIMIT: z.coerce.number().int().positive().default(6),
  CANVAS_WIDTH: z.coerce.number().int().positive().default(1080),
  CANVAS_HEIGHT: z.coerce.number().int().positive().default(1350)
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}
