# PWA Cache And Offline Policy

Invoice Lantern PWA/offline support is a convenience and resilience layer for
the web workspace. It is not native app certification, legal/tax/accounting
advice, privacy advice, security certification, official filing, authority
submission, or a compliance guarantee.

## Cache Allow List

The service worker may cache:

- offline fallback page
- app icons and public brand asset
- Next.js static assets
- public legal pages with network-first behavior

## Cache Deny List

The service worker must not cache:

- `/api/local/*`
- `/api/v1/*`
- authenticated workspace pages
- XML/SOAP payloads or responses
- API request logs
- API-key pages, full keys, or key hashes
- webhook endpoint details, signing secrets, delivery logs, or retries
- VIES evidence bodies or credentials
- privacy request/export/deletion/retention pages
- platform-admin rule/source/country-pack write pages
- auth callback or sign-out routes

Sensitive routes should be network-only/no-store. If unavailable, the service
worker may show a safe offline page instead of stale sensitive content.

## Offline Draft Policy

Encrypted local drafts are allowed only when:

- Web Crypto is available
- IndexedDB is available
- the user supplies a passphrase with at least 12 characters
- the passphrase is not persisted
- the stored data is encrypted before IndexedDB write
- the draft is clearly local-only until saved through the API

Encrypted drafts must not include raw XML/SOAP, API keys, webhook signing
secrets, VIES credentials, service-role keys, or database URLs.

If encryption is unavailable, the product must disable local draft persistence
instead of storing sensitive invoice data in plaintext.

## Logout Requirements

Logout must clear:

- Invoice Lantern service-worker caches
- service-worker registration where practical
- encrypted local draft database
- Invoice Lantern-prefixed local/session storage keys
- browser Supabase session state on a best-effort basis

Server-side Supabase sign-out remains the primary session invalidation step.

## Mobile Upload Requirements

Mobile upload remains online-only:

- file extension/type checked in browser
- size limit enforced before API submission
- API performs XML safety checks
- no camera/microphone/geolocation permission is required
- no raw XML/SOAP is cached for offline reuse

## Review Notes

This policy must be reviewed again during final production release-candidate
hardening, especially CSP, service-worker rollback, local draft passphrase UX,
and deployment-specific cache headers.
