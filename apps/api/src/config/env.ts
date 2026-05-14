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

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalhostUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

function addProductionRequiredIssue(
  context: z.RefinementCtx,
  path: string,
  label: string
) {
  context.addIssue({
    code: "custom",
    path: [path],
    message: `${label} is required in production.`
  });
}

function addProductionSecretLengthIssue(
  context: z.RefinementCtx,
  path: string,
  label: string
) {
  context.addIssue({
    code: "custom",
    path: [path],
    message: `${label} must be at least 32 characters long in production.`
  });
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
const optionalPolicyStringSchema = z.string().trim().default("");

const optionalBooleanLikeSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    return ["true", "1", "yes"].includes(value.trim().toLowerCase());
  }

  return value === true;
}, z.boolean());

const storageBackendSchema = z
  .enum(["auto", "supabase", "json"])
  .default("auto");

const envSchema = z
  .object({
    APP_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    API_HOST: z.string().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    WEB_APP_URL: z.string().url().default("http://localhost:3000"),

    /*
     * API storage backend policy.
     *
     * auto:
     *   - development/test may use Supabase when configured or local JSON
     *     storage for isolated local workflows.
     *   - production resolves to Supabase only.
     *
     * supabase:
     *   - always require Supabase-backed persistence.
     *
     * json:
     *   - local development/test only.
     *   - forbidden in production.
     *
     * This prevents a production deployment from silently downgrading real
     * workspace, invoice, XML, VAT, API-key, audit, privacy, retention, or
     * deletion data into local .data JSON files.
     */
    API_STORAGE_BACKEND: storageBackendSchema,

    /*
     * Development/test bootstrap key only.
     * Production must not depend on this key. Production API access should use
     * database-backed organization API keys and signed Supabase user sessions.
     */
    DEV_API_KEY: optionalSecretSchema,

    /*
     * Backend-only platform administration allow-list.
     *
     * This is intentionally not exposed to the web app. Platform rule,
     * source-register, and country-pack review writes require a signed-in
     * Supabase user whose normalized email is present in this comma-separated
     * list. Organization API keys and workspace owner/admin roles do not grant
     * platform administration.
     */
    PLATFORM_ADMIN_EMAILS: optionalSecretSchema,

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
     * These paths stay server-side. They report safe configuration diagnostics
     * unless a reviewed execution path is explicitly implemented elsewhere.
     */
    PEPPOL_SCHEMATRON_ROOT_DIR: optionalLocalPathSchema,
    PEPPOL_BIS_SCHEMATRON_PATH: optionalLocalPathSchema,
    EN16931_SCHEMATRON_PATH: optionalLocalPathSchema,
    SCHEMATRON_ARTIFACT_VERSION: optionalLocalPathSchema,
    SCHEMATRON_EXECUTION_MODE: optionalPolicyStringSchema,
    SCHEMATRON_ENGINE: optionalPolicyStringSchema,
    SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION: optionalBooleanLikeSchema,

    /*
     * Optional live VIES evidence checks.
     *
     * Disabled by default. VAT format checks remain local technical checks and
     * must never be treated as VIES evidence unless VIES_CHECK_ENABLED is true
     * and a route explicitly requests a live check.
     */
    VIES_CHECK_ENABLED: optionalBooleanLikeSchema,
    VIES_SERVICE_URL: optionalUrlSchema,
    VIES_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
    VIES_RATE_LIMIT_PER_ORG_PER_DAY: z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(100),
    VIES_RATE_LIMIT_PER_VAT_PER_DAY: z.coerce
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(10),

    /*
     * Webhook simulator delivery configuration.
     *
     * WEBHOOK_SECRET_ENCRYPTION_KEY is backend-only and is required before
     * creating or rotating persistent webhook signing secrets. It may be a
     * long random string or base64-encoded key material; the API derives a
     * 256-bit encryption key server-side and never exposes it to clients.
     */
    WEBHOOK_SECRET_ENCRYPTION_KEY: optionalSecretSchema,
    WEBHOOK_SIGNING_KEY_ID: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .default("webhook-signing-v1"),
    WEBHOOK_DELIVERY_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(500)
      .max(30000)
      .default(5000),
    WEBHOOK_MAX_RESPONSE_BYTES: z.coerce
      .number()
      .int()
      .min(256)
      .max(32768)
      .default(4096),
    WEBHOOK_MAX_RETRY_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(10)
      .default(3),
    WEBHOOK_ALLOW_LOCALHOST_DELIVERY: optionalBooleanLikeSchema,

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
     * In development/test these may be blank because some tests and local
     * workflows still use JSON-backed fixtures. In production they are required
     * so authenticated workspace persistence, RLS-backed access, API-key
     * hashing, and audit records are not silently downgraded to local storage.
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
  })
  .superRefine((value, context) => {
    if (value.APP_ENV !== "production") {
      if (!value.DEV_API_KEY.trim()) {
        context.addIssue({
          code: "custom",
          path: ["DEV_API_KEY"],
          message: "DEV_API_KEY is required in development and test."
        });
      }

      if (
        value.DEV_API_KEY.trim().length > 0 &&
        value.DEV_API_KEY.trim().length < 16
      ) {
        context.addIssue({
          code: "custom",
          path: ["DEV_API_KEY"],
          message: "DEV_API_KEY must be at least 16 characters long."
        });
      }

      return;
    }

    if (value.API_STORAGE_BACKEND === "json") {
      context.addIssue({
        code: "custom",
        path: ["API_STORAGE_BACKEND"],
        message:
          "API_STORAGE_BACKEND=json is forbidden in production. Use API_STORAGE_BACKEND=supabase or API_STORAGE_BACKEND=auto with Supabase configured."
      });
    }

    if (value.DEV_API_KEY.trim()) {
      context.addIssue({
        code: "custom",
        path: ["DEV_API_KEY"],
        message:
          "DEV_API_KEY must be blank in production. Use organization API keys and Supabase bearer authentication instead."
      });
    }

    if (!isHttpsUrl(value.WEB_APP_URL)) {
      context.addIssue({
        code: "custom",
        path: ["WEB_APP_URL"],
        message: "WEB_APP_URL must use HTTPS in production."
      });
    }

    if (isLocalhostUrl(value.WEB_APP_URL)) {
      context.addIssue({
        code: "custom",
        path: ["WEB_APP_URL"],
        message: "WEB_APP_URL must not point to localhost in production."
      });
    }

    if (!value.SUPABASE_URL.trim()) {
      addProductionRequiredIssue(context, "SUPABASE_URL", "SUPABASE_URL");
    } else if (!isHttpsUrl(value.SUPABASE_URL)) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message: "SUPABASE_URL must use HTTPS in production."
      });
    }

    if (!value.SUPABASE_PUBLISHABLE_KEY.trim()) {
      addProductionRequiredIssue(
        context,
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_PUBLISHABLE_KEY"
      );
    }

    if (!value.SUPABASE_SERVICE_ROLE_KEY.trim()) {
      addProductionRequiredIssue(
        context,
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY"
      );
    } else if (value.SUPABASE_SERVICE_ROLE_KEY.trim().length < 32) {
      addProductionSecretLengthIssue(
        context,
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    if (!value.SUPABASE_JWT_SECRET.trim()) {
      addProductionRequiredIssue(
        context,
        "SUPABASE_JWT_SECRET",
        "SUPABASE_JWT_SECRET"
      );
    } else if (value.SUPABASE_JWT_SECRET.trim().length < 32) {
      addProductionSecretLengthIssue(
        context,
        "SUPABASE_JWT_SECRET",
        "SUPABASE_JWT_SECRET"
      );
    }

    if (!value.VAT_FINGERPRINT_SECRET.trim()) {
      addProductionRequiredIssue(
        context,
        "VAT_FINGERPRINT_SECRET",
        "VAT_FINGERPRINT_SECRET"
      );
    } else if (value.VAT_FINGERPRINT_SECRET.trim().length < 32) {
      addProductionSecretLengthIssue(
        context,
        "VAT_FINGERPRINT_SECRET",
        "VAT_FINGERPRINT_SECRET"
      );
    }

    if (!value.API_KEY_HASH_SECRET.trim()) {
      addProductionRequiredIssue(
        context,
        "API_KEY_HASH_SECRET",
        "API_KEY_HASH_SECRET"
      );
    } else if (value.API_KEY_HASH_SECRET.trim().length < 32) {
      addProductionSecretLengthIssue(
        context,
        "API_KEY_HASH_SECRET",
        "API_KEY_HASH_SECRET"
      );
    }

    if (!value.WEBHOOK_SECRET_ENCRYPTION_KEY.trim()) {
      addProductionRequiredIssue(
        context,
        "WEBHOOK_SECRET_ENCRYPTION_KEY",
        "WEBHOOK_SECRET_ENCRYPTION_KEY"
      );
    } else if (value.WEBHOOK_SECRET_ENCRYPTION_KEY.trim().length < 32) {
      addProductionSecretLengthIssue(
        context,
        "WEBHOOK_SECRET_ENCRYPTION_KEY",
        "WEBHOOK_SECRET_ENCRYPTION_KEY"
      );
    }

    if (value.WEBHOOK_ALLOW_LOCALHOST_DELIVERY) {
      context.addIssue({
        code: "custom",
        path: ["WEBHOOK_ALLOW_LOCALHOST_DELIVERY"],
        message: "WEBHOOK_ALLOW_LOCALHOST_DELIVERY must be false in production."
      });
    }

    if (!value.DATABASE_URL.trim()) {
      addProductionRequiredIssue(context, "DATABASE_URL", "DATABASE_URL");
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid API environment configuration:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;

export type AppEnvironment = typeof env.APP_ENV;
export type ApiStorageBackend = typeof env.API_STORAGE_BACKEND;

export function isProductionEnvironment() {
  return env.APP_ENV === "production";
}

export function isSupabaseConfigured() {
  return (
    env.SUPABASE_URL.trim().length > 0 &&
    env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0
  );
}

export function resolveApiStorageBackend(): "supabase" | "json" {
  if (env.API_STORAGE_BACKEND === "supabase") {
    return "supabase";
  }

  if (env.API_STORAGE_BACKEND === "json") {
    if (isProductionEnvironment()) {
      throw new Error(
        "Unsafe storage configuration: API_STORAGE_BACKEND=json is forbidden in production."
      );
    }

    return "json";
  }

  if (isProductionEnvironment()) {
    return "supabase";
  }

  return isSupabaseConfigured() ? "supabase" : "json";
}
