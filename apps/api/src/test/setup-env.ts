process.env.APP_ENV = "test";
process.env.API_STORAGE_BACKEND = "json";
process.env.DEV_API_KEY =
  process.env.DEV_API_KEY || "il_dev_local_key_change_me_32_chars";

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
