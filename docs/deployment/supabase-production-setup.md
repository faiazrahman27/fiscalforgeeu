# Supabase Production Setup

Invoice Lantern production requires a dedicated Supabase project. Do not reuse a
developer database for public production traffic.

## Required Supabase Areas

- Supabase Auth with email verification enabled.
- Production callback URLs for the web domain, including `/auth/callback`.
- Postgres database with every migration applied in filename order.
- RLS enabled and preserved for tenant-owned records.
- Service-role key available only to backend services that require it.
- Browser-safe publishable or anon key available only through `NEXT_PUBLIC_*`.
- Storage buckets only if an explicit feature uses them, with RLS/storage
  policies reviewed before launch.

## Migration Order

Apply migrations in the existing order under `supabase/migrations`. Do not edit
old migrations. New schema changes must be additive forward migrations.

After applying migrations, verify:

- Organization membership and role constraints.
- Workspace bootstrap RPC behavior.
- API-key scope constraints and hashed key storage.
- Legal document registry and version acceptance tables.
- Privacy request, export, deletion, and retention access restrictions.
- Admin rule/source/country-pack platform-admin-only write boundaries.

## Auth Setup

Configure:

- Site URL for the production web domain.
- Redirect URLs for `/auth/callback` on production and approved preview domains.
- Email verification and reviewed SMTP provider configuration.
- Password policy compatible with the web minimum of 12 characters.

Legal acknowledgement stored in Supabase user metadata during sign-up is only a
client-side signup signal. The signed-user legal acceptance API remains the
server-side source of truth for current policy acknowledgement.

## Backend-Only Secrets

Never expose these values to the browser, logs, docs, or examples:

- Supabase service-role key.
- Database URLs.
- API signing secrets.
- Webhook encryption key.
- Webhook signing secrets.
- VIES credentials or private enablement details.
- Email provider secrets.

## Production Checks

Before launch:

- Confirm RLS policies and grants match the production data model.
- Confirm service-role calls are backend-only.
- Confirm API-key access verifies organization, workspace membership, scope,
  ownership, and allowed action.
- Confirm legal acceptance, privacy requests, retention/deletion, and admin
  write routes reject API-key-only access where signed-user or platform-admin
  access is required.
- Confirm no raw XML, raw SOAP, full API keys, webhook secrets, VIES secrets, or
  private tokens are cached or exposed.
