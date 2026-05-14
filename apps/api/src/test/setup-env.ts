process.env.APP_ENV = "test";
process.env.API_STORAGE_BACKEND = "json";
process.env.DEV_API_KEY =
  process.env.DEV_API_KEY || "il_dev_local_key_change_me_32_chars";
process.env.PLATFORM_ADMIN_EMAILS =
  process.env.PLATFORM_ADMIN_EMAILS || "platform-admin@example.test";

process.env.SUPABASE_URL = "";
process.env.SUPABASE_PUBLISHABLE_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.SUPABASE_JWT_SECRET = "";
process.env.DATABASE_URL = "";
process.env.VIES_CHECK_ENABLED = "";
process.env.VIES_SERVICE_URL = "";
process.env.VIES_TIMEOUT_MS = "5000";
process.env.VIES_RATE_LIMIT_PER_ORG_PER_DAY = "100";
process.env.VIES_RATE_LIMIT_PER_VAT_PER_DAY = "10";
process.env.WEBHOOK_SECRET_ENCRYPTION_KEY =
  process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ||
  "test_webhook_secret_encryption_key_32_chars_minimum";
process.env.WEBHOOK_SIGNING_KEY_ID =
  process.env.WEBHOOK_SIGNING_KEY_ID || "test-webhook-signing-key";
process.env.WEBHOOK_DELIVERY_TIMEOUT_MS =
  process.env.WEBHOOK_DELIVERY_TIMEOUT_MS || "5000";
process.env.WEBHOOK_MAX_RESPONSE_BYTES =
  process.env.WEBHOOK_MAX_RESPONSE_BYTES || "512";
process.env.WEBHOOK_MAX_RETRY_ATTEMPTS =
  process.env.WEBHOOK_MAX_RETRY_ATTEMPTS || "3";
process.env.WEBHOOK_ALLOW_LOCALHOST_DELIVERY =
  process.env.WEBHOOK_ALLOW_LOCALHOST_DELIVERY || "true";
