function readRequiredPublicEnvValue(primaryKey: string, fallbackKey?: string) {
  const primaryValue = process.env[primaryKey]?.trim();

  if (primaryValue) {
    return primaryValue;
  }

  if (fallbackKey) {
    const fallbackValue = process.env[fallbackKey]?.trim();

    if (fallbackValue) {
      return fallbackValue;
    }
  }

  throw new Error(
    fallbackKey
      ? `Missing ${primaryKey} or ${fallbackKey} in apps/web/.env.local.`
      : `Missing ${primaryKey} in apps/web/.env.local.`
  );
}

export function getSupabaseUrl() {
  return readRequiredPublicEnvValue("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublicKey() {
  return readRequiredPublicEnvValue(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}
