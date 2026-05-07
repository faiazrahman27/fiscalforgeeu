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
const optionalLocalPathSchema = z.string().trim().default("");

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
   * Optional local UBL XSD artefacts for metadata-only XML validation jobs.
   * These paths stay server-side and are only used to decide whether the
   * xsd_ubl check can attempt a local technical XSD validation operation.
   */
  UBL_XSD_ROOT_DIR: optionalLocalPathSchema,
  UBL_INVOICE_XSD_PATH: optionalLocalPathSchema,
  UBL_CREDIT_NOTE_XSD_PATH: optionalLocalPathSchema,
  UBL_XSD_ARTIFACT_VERSION: optionalLocalPathSchema,

  /*
   * Optional local Schematron artefacts for metadata-only XML validation jobs.
   * These paths stay server-side. Step 48 only reports safe configuration
   * diagnostics and does not enable or execute Schematron validation.
   */
  PEPPOL_SCHEMATRON_ROOT_DIR: optionalLocalPathSchema,
  PEPPOL_BIS_SCHEMATRON_PATH: optionalLocalPathSchema,
  EN16931_SCHEMATRON_PATH: optionalLocalPathSchema,
  SCHEMATRON_ARTIFACT_VERSION: optionalLocalPathSchema,

  XML_TRANSIENT_PAYLOAD_DIR: optionalLocalPathSchema,
  XML_TRANSIENT_PAYLOAD_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(600),

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
  API_KEY_HASH_SECRET: optionalSecretSchema,

  /*
   * Server-side Postgres connection string.
   * Keep this out of browser-facing apps.
   */
  DATABASE_URL: optionalUrlSchema
}).superRefine((value, context) => {
  if (value.APP_ENV === "production" && !value.API_KEY_HASH_SECRET.trim()) {
    context.addIssue({
      code: "custom",
      path: ["API_KEY_HASH_SECRET"],
      message: "API_KEY_HASH_SECRET is required in production."
    });
  }
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid API environment configuration:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
