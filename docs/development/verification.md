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
npm --prefix packages/ubl run test
npm --prefix packages/invoice-core run test
npm run check
npm --prefix apps/xml-worker run test
npm --prefix apps/api run check
npm --prefix apps/api run test
npm run test
npm run build
git diff --check
git status --short
```

What they cover:

- `npm --prefix packages/ubl run test`: UBL generation, parsing, XSD, and
  guarded Schematron execution package tests.
- `npm --prefix packages/invoice-core run test`: Canonical invoice model and
  invoice lifecycle tests.
- `npm run check`: TypeScript checks for packages, API, XML worker, plus web
  typecheck and Next.js build through the web `check` script.
- `npm --prefix apps/xml-worker run test`: XML worker queue, transient payload,
  XSD diagnostics, and guarded Schematron worker/orchestration safety tests.
- `npm --prefix apps/api run check`: API TypeScript and contract checks.
- `npm --prefix apps/api run test`: API route and service tests, including
  deterministic JSON-backed authorization, API-key, validation, workspace, and
  privacy/retention/deletion coverage.
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

## Current Known Non-Production Gaps

These are intentionally not completed in Step 1:

- Step 9 Peppol BIS Billing-style and EN 16931-style rule catalog expansion,
  richer business-rule intelligence, source-linked rule explanations, and
  validation finding enrichment.
- Real VIES evidence checks.
- CII generation and parsing.
- Reviewed source-rich country packs for all target jurisdictions.
- Webhook simulator implementation.
- Admin rule/source console.
- Full legal document system.
- Monitoring, incident response, and security dashboard.
- Production deployment hardening.
