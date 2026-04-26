import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),

  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  WEB_APP_URL: z.string().url().default("http://localhost:3000"),

  DEV_API_KEY: z
    .string()
    .min(16, "DEV_API_KEY must be at least 16 characters long")
    .default("il_dev_local_key_change_me"),

  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(100),
  RATE_LIMIT_WINDOW: z.string().min(1).default("1 minute"),

  API_BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024)
    .default(1024 * 1024)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid API environment configuration:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;

