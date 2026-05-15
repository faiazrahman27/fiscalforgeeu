# Production Release-Candidate Readiness

Invoice Lantern is an independent, educational, technical, source-linked,
versioned, simulation-focused, GDPR-aware e-invoice validation and
ViDA-readiness sandbox. This document is a production setup checklist, not a
claim that production is already deployed or legally approved.

## Release-Candidate Scope

The release candidate expects these services to be configured before launch:

- Supabase project with Auth, Postgres, RLS, migrations, and service-role access
  only on trusted backend services.
- API hosting for `apps/api` over HTTPS.
- Web hosting for `apps/web` over HTTPS.
- XML worker hosting for local UBL XSD and guarded Schematron execution paths.
- Production domain, TLS, HSTS readiness, and reviewed auth callback URLs.
- XSD artifact paths, Schematron artifact roots, and execution gates.
- Optional VIES enablement with timeout/rate-limit safety.
- Webhook encryption key and HMAC signing-secret handling.
- Platform admin email allow-list.
- Security, privacy, incident, and monitoring contacts.

## Not Automatic

The repository does not automatically create production infrastructure. Before a
public launch, an operator must run migrations, configure environment variables,
deploy each service, set auth callback URLs, configure domains, provision
artifacts, validate security headers, and run smoke tests.

## Manual Launch Reviews

Before public launch, complete professional legal, privacy, security, tax, and
accounting review. Invoice Lantern output is informational technical validation
and readiness simulation only. It is not official filing, authority acceptance,
legal advice, tax advice, accounting advice, privacy advice, security
certification, or a compliance guarantee.

## Post-Deploy Smoke Tests

Run these checks after deployment:

- Public pages: `/`, `/about`, `/contact`, `/legal`, one legal detail page,
  `/developer-api`, `/developer-api/reference`, `/boundaries`, `/auth/sign-in`,
  `/auth/sign-up`, and `/offline`.
- Auth: sign-up requires all mandatory legal acknowledgements; sign-in redirects
  safely; sign-out clears PWA caches and local draft storage.
- Legal acceptance: signed-in users without current required acknowledgements are
  sent to the workspace acceptance page before workspace use.
- Cookie preferences: banner appears on public/auth pages, stores only version,
  timestamp, and category choices, and can be managed from the footer.
- Workspace: dashboard, invoices, XML upload, VAT/VIES evidence, country packs,
  ViDA simulator, validation rules, developer/API keys/webhooks, privacy, and
  security readiness pages load with expected RBAC.
- API: health/readiness, OpenAPI JSON, scoped API-key routes, signed-user routes,
  platform-admin routes, and rate-limit headers.
- XML: UBL XSD worker readiness and Schematron gates report configured,
  disabled, unsupported, unsafe, or preflight statuses honestly.
- PWA: service worker avoids workspace/API/auth callback/sign-out/private data
  routes and serves only safe static/public resources offline.

## Rollback Notes

Keep database migrations forward-only. If a deployment is rolled back, verify
that the older application version still understands the current schema and
legal document versions. Never rewrite, delete, squash, or reorder existing
Supabase migrations.
