# Environment Variables

This page lists production configuration categories. Do not commit real secrets
or fake credentials.

## Web

Public-safe values:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_ENABLE_PWA_INSTALL_PROMPT`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CONTACT_EMAIL`
- `NEXT_PUBLIC_SECURITY_CONTACT_EMAIL`
- `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`
- `NEXT_PUBLIC_INCIDENT_CONTACT_EMAIL`

Server-only web proxy values:

- `INVOICE_LANTERN_API_BASE_URL`
- `INVOICE_LANTERN_DEV_API_KEY` for local development only; omit in production.

## API

Backend-only values include:

- Supabase URL and backend key configuration.
- Supabase service-role key.
- Platform admin email allow-list.
- API host, port, and production environment mode.
- Request size, timeout, and rate-limit configuration.
- Webhook encryption key.
- Optional VIES enablement and credentials.
- Monitoring provider keys, if a provider is configured.
- Security, privacy, and incident contact addresses.

The service-role key must never be available to `apps/web` client code or any
browser bundle.

## XML Worker

Configure:

- UBL XSD artifact root/path.
- Schematron artifact roots.
- Schematron execution enablement gates.
- Worker timeouts and maximum input sizes.
- Local-only or hosted worker base URL, depending on deployment topology.

XSD and Schematron checks are guarded technical checks. A configured worker is
not official validation, legal validity, tax compliance, Peppol certification,
EN 16931 certification, filing readiness, or authority acceptance.

## Webhooks

Configure a strong backend-only webhook encryption key before creating endpoint
secrets. Webhook signing secrets are shown only on create or rotate. They must
not be persisted in browser storage, examples, logs, or docs.

## Cookies And Legal Acceptance

The web cookie preference flow stores only browser-local category choices,
version, and timestamp. It does not store raw XML, invoices, API keys, webhook
secrets, VIES data, or workspace data.

Required web-user legal acknowledgement is version-aware. Sign-up metadata is a
setup signal; signed-user legal acceptance routes are the server-side acceptance
record.
