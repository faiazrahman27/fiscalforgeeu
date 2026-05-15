# Security Readiness Checklist

This checklist supports Invoice Lantern production-readiness review. It is not
a security certification, legal/privacy determination, official filing approval,
tax/accounting advice, or compliance guarantee.

## RBAC And Tenant Isolation

- Tenant-owned records include `organization_id` where appropriate.
- Signed-user routes verify workspace membership and role.
- Organization API keys are scoped, hashed, rate-limited, and tenant-bound.
- Object reads/writes check ownership before returning data.
- Platform-admin writes require backend-only allow-list authorization.

## API Key Safety

- Full API key shown once only.
- No API keys in browser localStorage, sessionStorage, IndexedDB, service worker
  cache, logs, docs with real values, screenshots, or client config.
- Prefix/key ID used for display and incident evidence.
- Revocation and rotation instructions documented.
- Organization API keys cannot manage webhooks, legal acceptances, privacy
  settings, retention/deletion/export actions, or platform-admin writes.

## XML Safety

- Body-size limits enforced.
- DTDs, external entities, entity expansion, unsafe paths, and remote fetching
  blocked.
- Local XSD and Schematron artefacts remain server-side and path-hidden.
- Raw XML/SOAP bodies are not cached offline or copied into monitoring metrics.
- Worker timeouts and unsafe-input rejections are monitored.

## VIES Safety

- Live VIES disabled unless explicitly configured.
- VIES calls are explicit and rate-limited.
- VIES unavailable is not treated as invalid VAT.
- Raw SOAP bodies and credentials are not stored in evidence, logs, metrics, or
  offline storage.

## Webhook Safety

- Endpoint validation blocks private networks unless explicitly local-only in
  development.
- Signing secrets are encrypted at rest and shown only at creation/rotation.
- Delivery timeout, response-size, and retry limits enforced.
- Delivery logs avoid signing secrets and sensitive payload bodies.

## PWA, Cache, And Offline Safety

- Manifest and icons use Invoice Lantern identity.
- Service worker caches only static/public assets and public legal pages.
- Authenticated APIs, local proxies, workspace pages, XML/SOAP, API keys,
  webhook logs, privacy workflows, and admin pages are network-only/no-store.
- Encrypted local drafts require Web Crypto, IndexedDB, and a user passphrase.
- Logout clears Invoice Lantern caches, service worker registration, and
  encrypted local draft storage.

## Legal And Privacy

- Legal documents are versioned and acceptance-tracked.
- Privacy data map, subprocessors, cookie stance, export packages, deletion
  reviews, retention reviews, and privacy requests remain owner/admin scoped.
- Policy text remains professional-review-required and avoids official,
  certified, guaranteed, or authority-acceptance claims.

## Deployment Environment

- Production uses HTTPS `WEB_APP_URL`.
- Production disables `DEV_API_KEY`.
- Production forbids `API_STORAGE_BACKEND=json`.
- Supabase URL, publishable key, service-role key, JWT secret, database URL,
  API-key hash secret, VAT fingerprint secret, and webhook encryption key are
  configured server-side only.
- Monitoring/incident placeholders do not contain provider tokens or secrets.

## Final Release-Candidate Hardening

Repository-level release-candidate hardening includes public cookie preferences,
mandatory web-user legal acknowledgement, footer legal links, About/Contact
pages, PWA cache safety, security headers, privacy workflows, and API/RBAC
boundaries. The remaining items are deployment-specific or professional-review
requirements:

- production CSP nonce strategy review
- provider-specific monitoring integration if selected
- production log retention and alert routing
- incident contact ownership
- external security/legal/privacy review
- deployment-specific secret rotation and backup/restore checks
- Supabase production setup, migrations, auth callback URLs, domains,
  API/web/XML worker hosting, XSD/Schematron artifact configuration, optional
  VIES enablement, platform admin allow-list, webhook encryption key, and smoke
  tests described in `docs/deployment/`
