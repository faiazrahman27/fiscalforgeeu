# Invoice Lantern Verification

Step 1 stabilizes the repository baseline for the full Invoice Lantern platform.
It is prompt 1 of a 20-prompt implementation path and must not reduce the target
to an MVP, demo, or toy project.

Invoice Lantern remains an independent educational and technical e-invoice
validation and ViDA-readiness sandbox. Passing these commands does not mean the
platform is production-ready, legally certified, tax compliant, Peppol certified,
or accepted by any authority.

## Runtime

- Node.js: `>=22.0.0`
- npm: `>=10.0.0`
- Package manager: npm
- Lockfiles: the root and each app/package have their own `package-lock.json`

## Install

Run `npm ci` for every committed lockfile:

```powershell
npm ci
npm --prefix packages/tax-engine ci
npm --prefix packages/invoice-core ci
npm --prefix packages/ubl ci
npm --prefix packages/country-packs ci
npm --prefix packages/vida-simulator ci
npm --prefix apps/api ci
npm --prefix apps/xml-worker ci
npm --prefix apps/web ci
```

## Verification Commands

```powershell
npm --prefix packages/vida-simulator run test
npm --prefix packages/country-packs run test
npm --prefix packages/tax-engine run test
npm --prefix packages/invoice-core run test
npm --prefix packages/ubl run test
npm --prefix apps/xml-worker run test
npm --prefix apps/api run check
npm --prefix apps/api run test
npm --prefix apps/web run typecheck
npm run check
npm run test
npm run build
git diff --check
git status --short
```

What they cover:

- `npm --prefix packages/vida-simulator run test`: ViDA readiness simulator
  package tests.
- `npm --prefix packages/country-packs run test`: EU country-pack metadata,
  source, warning, and compatibility tests.
- `npm --prefix packages/tax-engine run test`: VAT and tax-engine package
  tests.
- `npm --prefix packages/invoice-core run test`: Canonical invoice model and
  invoice lifecycle tests.
- `npm --prefix packages/ubl run test`: UBL generation, parsing, XSD, and
  guarded Schematron execution package tests.
- `npm --prefix apps/xml-worker run test`: XML worker queue, transient payload,
  XSD diagnostics, and guarded Schematron worker/orchestration safety tests.
- `npm --prefix apps/api run check`: API TypeScript and contract checks.
- `npm --prefix apps/api run test`: API route and service tests, including
  deterministic JSON-backed authorization, API-key, validation, workspace,
  webhook simulator, privacy/retention/deletion, OpenAPI, public health,
  security header, monitoring-readiness, and incident-readiness coverage.
- `npm --prefix apps/web run typecheck`: Next.js workspace and developer UI
  typecheck, including PWA manifest/offline/logout/security-readiness page
  compilation.
- `npm run check`: TypeScript checks for packages, API, XML worker, plus web
  typecheck and Next.js build through the web `check` script.
- `npm run test`: Package tests and API tests, including OpenAPI, validation,
  UBL parse/export/import, VAT local-format checks, API keys, XML job routes,
  ViDA simulation, and report generation.
- `npm run build`: Full package, API, XML worker, and web production build.
- `git diff --check`: Whitespace and conflict-marker scan for local changes.
- `git status --short`: Local change inventory after verification.

Useful targeted commands:

```powershell
npm run check:packages
npm run check:api
npm run check:xml-worker
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
npm run test:tax-engine
npm run test:invoice-core
npm run test:ubl
npm run test:country-packs
npm run test:vida-simulator
npm run test:api
```

## Test Environment Note

API tests intentionally force `APP_ENV=test` and `API_STORAGE_BACKEND=json`
before app imports. This keeps tests deterministic even when a local
`apps/api/.env` contains Supabase credentials, while preserving the runtime guard
that blocks local `.data` storage in production or Supabase-backed environments.

## Current Known Production Setup Required

These items remain manual production setup or professional review requirements.
They are not repository verification failures:

- Reviewed local CII XSD artefacts and a real local validation adapter, if
  enabled. Technical CII generation and parsing are covered by `packages/cii`;
  `xsd_cii` returning `not_configured` is not success.
- Professional legal/privacy review of the versioned legal document and
  GDPR-aware privacy-support policy text before production launch.
- Provider-specific monitoring integration and alert routing.
- Final production CSP nonce strategy and service-worker release policy review.
- Production deployment hardening, secret rotation, backup/restore, and
  operational owner assignment.
- Supabase production project setup, migrations, Auth callback URLs, domains,
  API/web/XML worker hosting, XSD/Schematron artifact configuration, optional
  VIES enablement, platform admin allow-list, webhook encryption key, and smoke
  tests described in `docs/deployment/`.
