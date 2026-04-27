import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";

let cachedServiceRoleClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;

export function hasSupabaseServerConfig() {
  return Boolean(
    env.SUPABASE_URL &&
      env.SUPABASE_PUBLISHABLE_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function hasSupabaseJwtConfig() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabasePublicClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in apps/api/.env."
    );
  }

  if (!cachedPublicClient) {
    cachedPublicClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  return cachedPublicClient;
}

export function getSupabaseServiceRoleClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env."
    );
  }

  if (!cachedServiceRoleClient) {
    cachedServiceRoleClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  return cachedServiceRoleClient;
}
