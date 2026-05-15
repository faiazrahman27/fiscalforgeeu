# Production Preflight Checklist

Run this checklist before production deployment preparation is accepted.

## Repository Verification

- `npm --prefix packages/vida-simulator run test`
- `npm --prefix packages/country-packs run test`
- `npm --prefix packages/tax-engine run test`
- `npm --prefix packages/invoice-core run test`
- `npm --prefix packages/ubl run test`
- `npm --prefix apps/xml-worker run test`
- `npm --prefix apps/api run check`
- `npm --prefix apps/api run test`
- `npm --prefix apps/web run typecheck`
- `npm run check`
- `npm run test`
- `npm run build`
- `git diff --check`

## Supabase

- Production project created.
- Auth callback URLs configured for the production domain.
- All migrations applied in order.
- RLS, grants, workspace bootstrap RPCs, and service-role boundaries verified.
- Platform admin email allow-list configured.
- No service-role key exposed to the web client.

## API And Worker

- API deployed over HTTPS with production env.
- XML worker deployed or intentionally disabled with honest not-configured
  statuses.
- XSD artifacts configured.
- Schematron gates and artifact roots configured.
- VIES enablement reviewed and rate-limited if used.
- API keys are shown once, stored hashed, scoped, revocable, and never used in
  browser-side examples as real secrets.

## Web

- Cookie banner appears on public and auth pages until a choice is saved.
- Footer links About, Contact, legal documents, Terms, Privacy, Cookie Policy,
  Acceptable Use, Security Policy, Developer API, Boundaries, and Manage
  cookies.
- Sign-up requires Terms, Privacy, Cookie Policy, Acceptable Use, and
  Disclaimer acknowledgement.
- Workspace legal acceptance gate avoids public pages, legal pages, sign-out,
  and infinite redirects.
- Sign-out clears PWA caches and local-only encrypted draft storage.
- PWA service worker excludes workspace, API, auth callback/sign-out, API-key,
  webhook, XML, VIES, privacy, deletion, retention, and admin data from runtime
  caches.

## Security And Privacy

- CSP, HSTS, `X-Content-Type-Options`, Referrer Policy, Permissions Policy,
  frame protections, and sensitive-route no-store behavior reviewed.
- Raw XML, raw SOAP, full API keys, webhook secrets, VIES secrets, and service
  credentials are not stored in browser caches or public docs.
- Privacy export, deletion, retention, and request workflows preserve
  owner/admin access requirements.
- Monitoring and incident readiness are configured without claiming security
  certification or privacy compliance.

## Manual Reviews

- Legal review.
- Privacy review.
- Security review.
- Tax/accounting review.
- Operational incident-response review.

Invoice Lantern remains an independent technical sandbox. Production readiness
is not an official compliance, certification, legal, tax, accounting, privacy,
security, filing, or authority guarantee.
