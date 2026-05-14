# Invoice Lantern Developer API

Invoice Lantern exposes a sandbox developer API for independent, educational,
technical e-invoice validation and ViDA-readiness simulation. It validates and
normalizes data through the canonical invoice model, supports technical UBL
export and parsing, runs guarded XML validation jobs, records explicit VIES
time-of-check evidence, exposes source-linked EU country-pack context, and
simulates ViDA readiness.

The API is not official EU, national tax authority, OpenPeppol, Peppol
authority, or standards-body software. Results are informational technical
sandbox outputs only. They are not legal advice, tax advice, accounting advice,
official filing, authority submission, authority acceptance, Peppol
certification, EN 16931 certification, or a compliance guarantee. Professional
review is required before relying on outputs in real business processes.

## Base URL And OpenAPI

Local development:

```text
http://localhost:4000/api/v1
```

Active OpenAPI document:

```text
GET /api/v1/openapi.json
```

The OpenAPI document is the source of truth for request schemas, response
schemas, scope metadata, examples, and common error responses.

Webhook simulator details are documented in
[`docs/api/webhooks.md`](./webhooks.md).

Legal and privacy architecture details are documented in
[`docs/architecture/legal-document-system.md`](../architecture/legal-document-system.md)
and
[`docs/architecture/privacy-gdpr-retention-deletion.md`](../architecture/privacy-gdpr-retention-deletion.md).

## Authentication

Organization API keys authenticate selected sandbox developer endpoints through
the `X-API-Key` header:

```bash
curl -sS http://localhost:4000/api/v1/validation/rules \
  -H "X-API-Key: il_test_your_key_here"
```

API keys are workspace-owned, scoped, and hashed at rest. Invoice Lantern shows
the raw secret once during key creation. List, request-log, and usage endpoints
return safe metadata only, such as key prefix, key name, environment, scope list,
status, and timestamps. They do not return full secrets or key hashes.

Never expose organization API keys in browser code, mobile apps, public repos,
logs, screenshots, or client-side configuration. Rotate keys when access changes
or a key may have been copied outside the intended server-side environment.
Revoke unused keys from the workspace developer settings.

Signed-in workspace endpoints use the workspace user bearer session. They are
documented separately from API-key endpoints because they can create editable
drafts, list private history, or mutate workspace-owned records.

Platform-admin endpoints under `/api/v1/admin/*` also use signed-user bearer
authentication, but they are not ordinary workspace endpoints. They require the
backend-only `PLATFORM_ADMIN_EMAILS` allow-list. Organization API keys and
workspace owner/admin roles alone are rejected.

## API-Key Route Surface

| Capability | Endpoint | Scope |
| --- | --- | --- |
| Validate canonical invoice | `POST /api/v1/invoices/validate` | `invoices:validate` |
| Export canonical invoice to UBL | `POST /api/v1/invoices/export/ubl` | `invoices:export_ubl` |
| Parse UBL to canonical invoice | `POST /api/v1/invoices/parse/ubl` | `invoices:parse_ubl` |
| Create/list/read XML validation jobs | `POST /api/v1/xml/validation-jobs`, `GET /api/v1/xml/validation-jobs`, `GET /api/v1/xml/validation-jobs/{id}` | `xml:validation_jobs` |
| Local VAT format check | `POST /api/v1/vat/validate-format` | `vat:validate_format` |
| Explicit VIES evidence check | `POST /api/v1/vat/check-vies` | `vat:check_vies` |
| ViDA-readiness simulation | `POST /api/v1/transactions/simulate-vida` | `transactions:simulate_vida` |
| Validation run and report reads | `GET /api/v1/validation-runs`, `GET /api/v1/validation-runs/{id}`, `GET /api/v1/validation-runs/{id}/report.pdf` | `validation_runs:read` |
| Validation rule catalog | `GET /api/v1/validation/rules` | `rules:read` |

Public read-only country-pack endpoints do not currently require an API key:

```text
GET /api/v1/country-packs
GET /api/v1/country-packs/{countryCode}
```

## Signed-User-Only Developer Routes

These endpoints require a signed-in workspace session and the documented
workspace role. Organization API keys are rejected even when the API-key scope
list contains a reserved future scope.

| Capability | Endpoint |
| --- | --- |
| Manage API keys | `GET /api/v1/api-keys`, `POST /api/v1/api-keys`, `POST /api/v1/api-keys/{id}/revoke` |
| Review API request logs and usage | `GET /api/v1/api-requests`, `GET /api/v1/api-requests/summary`, `GET /api/v1/api-usage/current`, `GET /api/v1/api-usage/policies` |
| Import UBL into editable draft | `POST /api/v1/invoices/import/ubl` |
| List technical UBL export metadata | `GET /api/v1/invoices/exports` |
| Inspect XML readiness uploads | `POST /api/v1/xml/inspect`, `GET /api/v1/xml/uploads`, `GET /api/v1/xml/uploads/{id}`, `DELETE /api/v1/xml/uploads/{id}` |
| List saved local VAT checks | `GET /api/v1/vat/checks` |
| Production invoice lifecycle | `GET /api/v1/invoices`, `POST /api/v1/invoices`, `POST /api/v1/invoices/from-draft`, `GET /api/v1/invoices/{id}`, `PATCH /api/v1/invoices/{id}`, `POST /api/v1/invoices/{id}/transition`, `GET /api/v1/invoices/{id}/lifecycle-events`, `POST /api/v1/invoices/{id}/export/ubl`, `POST /api/v1/invoices/{id}/simulate-vida` |
| Saved ViDA simulation history | `GET /api/v1/transactions/vida-simulations`, `GET /api/v1/transactions/vida-simulations/{id}` |
| Webhook simulator endpoint management | `GET /api/v1/webhooks/endpoints`, `POST /api/v1/webhooks/endpoints`, `GET /api/v1/webhooks/endpoints/{id}`, `PATCH /api/v1/webhooks/endpoints/{id}`, `DELETE /api/v1/webhooks/endpoints/{id}`, `POST /api/v1/webhooks/endpoints/{id}/rotate-secret` |
| Signed webhook test events and logs | `POST /api/v1/webhooks/endpoints/{id}/test`, `GET /api/v1/webhooks/deliveries`, `GET /api/v1/webhooks/deliveries/{id}`, `POST /api/v1/webhooks/deliveries/{id}/retry` |

## Legal And Privacy Support Routes

Published legal documents are public read-only product policy notices:

```text
GET /api/v1/legal/documents
GET /api/v1/legal/documents/{documentKey}
```

Signed-in users can accept required published document versions and review
acceptance status:

```text
POST /api/v1/legal/documents/{documentKey}/accept
GET /api/v1/legal/acceptances/me
GET /api/v1/legal/acceptances/workspace
```

Organization API keys are rejected for legal acceptance writes and workspace
acceptance review. Acceptance records store document/version/context and hashed
request evidence only when captured; raw IP addresses and raw user agents are
not stored or returned.

Workspace owner/admin privacy-support endpoints include:

```text
GET /api/v1/workspace/settings
PUT /api/v1/workspace/settings
GET /api/v1/workspace/settings/privacy
PATCH /api/v1/workspace/settings/privacy
GET /api/v1/workspace/privacy/data-map
GET /api/v1/workspace/privacy/subprocessors
GET /api/v1/workspace/privacy/cookie-stance
GET /api/v1/workspace/privacy-requests
POST /api/v1/workspace/privacy-requests
GET /api/v1/workspace/privacy-requests/{id}
PATCH /api/v1/workspace/privacy-requests/{id}
GET /api/v1/workspace/export-packages
POST /api/v1/workspace/export-packages
GET /api/v1/workspace/export-packages/{id}
GET /api/v1/workspace/retention-preview
GET /api/v1/workspace/retention-runs
POST /api/v1/workspace/retention-runs
POST /api/v1/workspace/retention-runs/{id}/execute
GET /api/v1/workspace/deletion-runs
POST /api/v1/workspace/deletion-runs
POST /api/v1/workspace/deletion-runs/{id}/execute
```

These endpoints are GDPR-aware support tooling only. They do not guarantee GDPR
compliance, decide statutory retention, replace DPO review, or provide legal,
tax, accounting, privacy, filing, or professional advice. Export packages redact
service-role keys, API key secrets and hashes, webhook raw secret material, raw
SOAP, raw XML unless a future reviewed policy explicitly allows it, local paths,
stack traces, platform-admin allowlists, and environment/config secrets.

## Platform-Admin-Only Routes

These routes manage platform rule intelligence, source-reference metadata, and
country-pack review overlays. They are not developer API-key routes and do not
grant legal, tax, accounting, filing, Peppol, EN 16931, ViDA, or authority
certainty.

| Capability | Endpoint |
| --- | --- |
| Check admin context | `GET /api/v1/admin/context` |
| Manage validation rule metadata | `GET /api/v1/admin/rules`, `POST /api/v1/admin/rules`, `GET /api/v1/admin/rules/{id}`, `PATCH /api/v1/admin/rules/{id}` |
| Rule lifecycle actions | `POST /api/v1/admin/rules/{id}/submit-review`, `POST /api/v1/admin/rules/{id}/publish`, `POST /api/v1/admin/rules/{id}/deprecate`, `POST /api/v1/admin/rules/{id}/archive`, `POST /api/v1/admin/rules/{id}/disable` |
| Manage source references | `GET /api/v1/admin/sources`, `POST /api/v1/admin/sources`, `GET /api/v1/admin/sources/{id}`, `PATCH /api/v1/admin/sources/{id}`, `POST /api/v1/admin/sources/{id}/deprecate` |
| Manage country-pack review overlays | `GET /api/v1/admin/country-packs`, `GET /api/v1/admin/country-packs/{countryCode}`, `PATCH /api/v1/admin/country-packs/{countryCode}/review`, `POST /api/v1/admin/country-packs/{countryCode}/sources`, `DELETE /api/v1/admin/country-packs/{countryCode}/sources/{sourceId}` |

`invoices:import_ubl` is reserved in the API-key scope enum for future access
control alignment. It is not an active organization API-key draft creation path.
Use `POST /api/v1/invoices/parse/ubl` for API-key UBL parsing.

## Interpretation Boundaries

- UBL export and parsing are technical interoperability tools only.
- XSD pass means a configured local XSD check completed without schema errors; it
  is not legal, tax, accounting, Peppol, EN 16931, filing, or authority advice.
- Schematron checks execute only through guarded local configuration. Pass or
  fail states are technical only.
- `not_configured`, `preflight_only`, `unsupported`, `unsafe_input`, and
  `error` are not success states.
- VAT format-valid is local pattern evidence only and is not VIES-valid.
- VIES evidence is time-of-check evidence only. VIES unavailable is not invalid,
  and VIES valid does not prove transaction treatment.
- Country packs are source-linked educational context with warnings and
  professional-review expectations. No source means no legal or tax rule.
- ViDA-readiness simulation is readiness planning only, not an official
  determination.
- Webhook simulator events are signed sandbox test events only. Delivery logs
  and retries help technical integrations; they do not indicate official filing,
  authority submission, downstream acceptance, legal/tax/accounting advice, or a
  compliance guarantee.
- API Terms, Webhook Simulator Terms / Integration Notice, Disclaimer / No Tax
  Advice Notice, country-pack, ViDA, VIES, and XML/XSD/Schematron notices are
  versioned legal documents that require professional review. Accepting them is
  policy-version evidence only, not proof of compliance.
- Data-map, export, deletion, retention, subprocessor, cookie stance, and
  privacy request endpoints support privacy operations but do not replace legal
  counsel, DPO review, or professional privacy review.
