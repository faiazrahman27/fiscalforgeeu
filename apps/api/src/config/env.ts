import "dotenv/config";
import { z } from "zod";

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const optionalUrlSchema = z
  .string()
  .trim()
  .default("")
  .refine((value) => value === "" || isValidUrl(value), {
    message: "Value must be blank or a valid URL"
  });

const optionalSecretSchema = z.string().trim().default("");

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),

  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  WEB_APP_URL: z.string().url().default("http://localhost:3000"),

  DEV_API_KEY: z
    .string()
    .trim()
    .min(16, "DEV_API_KEY must be at least 16 characters long"),

  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(100),
  RATE_LIMIT_WINDOW: z.string().min(1).default("1 minute"),

  API_BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024)
    .default(2 * 1024 * 1024),

  /*
   * Supabase server-side configuration.
   *
   * These values are optional during the current local JSON-storage phase so
   * existing API builds do not break before database-backed repositories are
   * wired in. Production enforcement will be added when the API starts requiring
   * authenticated database access.
   */
  SUPABASE_URL: optionalUrlSchema,
  SUPABASE_PUBLISHABLE_KEY: optionalSecretSchema,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecretSchema,
  SUPABASE_JWT_SECRET: optionalSecretSchema,
  VAT_FINGERPRINT_SECRET: optionalSecretSchema,

  /*
   * Server-side Postgres connection string.
   * Keep this out of browser-facing apps.
   */
  DATABASE_URL: optionalUrlSchema
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid API environment configuration:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
