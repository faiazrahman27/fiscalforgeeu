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

export function getSupabaseUserClient(accessToken: string) {
  const safeAccessToken = accessToken.trim();

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in apps/api/.env."
    );
  }

  if (!safeAccessToken) {
    throw new Error("Missing Supabase user access token.");
  }

  /*
   * User-scoped Supabase client.
   *
   * This client uses the publishable key plus the signed-in user's access token.
   * Database queries made through this client should be evaluated by Supabase RLS
   * as the authenticated user, not as the service role.
   */
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${safeAccessToken}`
      }
    }
  });
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
