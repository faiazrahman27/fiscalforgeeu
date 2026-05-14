# PWA, Mobile, And Offline Security

Invoice Lantern provides an installable PWA foundation for a mobile-oriented
workspace shell. The PWA is an independent technical sandbox convenience layer.
It is not a native mobile certification, app-store security certification,
official filing channel, legal/tax/accounting/privacy/security advice, or a
compliance guarantee.

## Installability

- Web app manifest: `apps/web/app/manifest.ts`
- Public identity: `Invoice Lantern`
- Display mode: `standalone`
- Start URL: `/workspace`
- Icons: project-owned generated app icons under `apps/web/app/icon.png` and
  `apps/web/app/apple-icon.png`
- Service worker: `apps/web/public/sw.js`

The install prompt is controlled by `NEXT_PUBLIC_ENABLE_PWA_INSTALL_PROMPT`.
The prompt is public-safe and does not add tracking or non-essential cookies.

## Service Worker Policy

The service worker caches only safe static/public assets:

- `/offline`
- app icons
- public brand image
- Next.js static assets
- public legal pages with network-first behavior

It never caches authenticated API or workspace data:

- `/api/local/*`
- `/api/v1/*`
- `/workspace/*`
- auth callback and sign-out routes
- XML/SOAP bodies
- API request logs
- API-key pages or secrets
- webhook endpoint secrets, test events, and delivery logs
- privacy/export/deletion/retention pages
- platform-admin pages

When the network is unavailable for a sensitive navigation, the service worker
may show the safe offline page. It must not serve stale sensitive workspace
content.

## Offline Capability Matrix

| Capability | Offline status | Notes |
| --- | --- | --- |
| Installable shell | Available | Static shell and offline notice only. |
| Public legal pages | Limited | Network-first cached; refresh online before relying on text. |
| Invoice draft editing | Limited | Local-only draft copy requires Web Crypto, IndexedDB, and a user passphrase. |
| Browser totals | Limited | Draft assistance only; server validation remains authoritative for the sandbox. |
| VAT format hints | Limited | Local hints only; VIES is online-only. |
| VIES checks | Online-only | No raw SOAP bodies are stored offline. |
| XML/XSD/Schematron jobs | Online-only | Worker and reviewed local artefact gates stay server-side. |
| UBL export persistence | Online-only | Generated XML is not stored in service-worker cache. |
| API-key management | Online-only | Secrets are not stored in localStorage or IndexedDB. |
| Webhook management | Online-only | Signing secrets and delivery logs are never cached. |
| Privacy export/deletion/retention execution | Online-only | Requires authenticated API and reviewed workflow state. |
| Platform-admin writes | Online-only | Requires signed-user platform-admin authorization. |

## Encrypted Local Drafts

`apps/web/lib/pwa/secure-local-store.ts` stores encrypted records in IndexedDB
using Web Crypto AES-GCM and PBKDF2-SHA-256. The passphrase is supplied by the
user each time and is not saved to localStorage, sessionStorage, IndexedDB, or
the service-worker cache.

`apps/web/lib/pwa/offline-drafts.ts` wraps invoice editor drafts as local-only
records. The stored envelope explicitly excludes raw XML/SOAP, API keys,
webhook secrets, and VIES SOAP bodies. Unsynced drafts are local-only until a
user saves them through the API while online.

If Web Crypto or IndexedDB is unavailable, encrypted local draft storage is
disabled instead of falling back to unencrypted storage.

## Logout And Cache Clearing

`/auth/sign-out` signs out through Supabase server helpers and redirects to a
client cleanup page. The cleanup flow clears:

- `invoice-lantern-*` service-worker caches
- Invoice Lantern service-worker registration
- encrypted local draft IndexedDB database
- Invoice Lantern-prefixed web storage keys
- local Supabase browser session state on a best-effort basis

The cleanup does not delete unrelated browser storage from other applications.

## Mobile Upload Safety

XML upload remains API-mediated. The browser checks extension and size, then the
API applies hardened XML controls. Mobile upload UX must keep these boundaries:

- 2 MB XML/API body limit unless a later reviewed policy changes it
- no raw XML or SOAP cached offline
- no camera/microphone/geolocation permission requirement
- no remote schema or Schematron fetching
- safe failure for unsupported, oversized, DTD/entity, or unsafe XML

## Production Review Notes

Before final release-candidate hardening, review:

- CSP nonce strategy if removing the current Next.js `unsafe-inline` allowance
  becomes practical.
- Service-worker update and rollback behavior.
- Mobile browser storage behavior under private browsing and low-storage modes.
- Passphrase UX, recovery expectations, and local draft deletion guidance.
- Security/privacy/legal wording in the public legal document registry.
