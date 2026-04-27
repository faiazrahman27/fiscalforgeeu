const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";

const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

export function getSupabaseUrl() {
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in apps/web/.env.local.");
  }

  return supabaseUrl;
}

export function getSupabasePublicKey() {
  if (!supabasePublicKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local."
    );
  }

  return supabasePublicKey;
}

export function hasSupabasePublicBrowserConfig() {
  return Boolean(supabaseUrl && supabasePublicKey);
}
