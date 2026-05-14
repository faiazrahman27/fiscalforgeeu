# API Scopes And Rate Limits

Invoice Lantern organization API keys are scoped to one workspace. Scopes
authorize specific sandbox functions only; they do not override tenant
isolation, object ownership, workspace role checks, XML safety gates, VIES
configuration, or rate limits.

## Scopes

| Scope | Allows |
| --- | --- |
| `invoices:validate` | Validate canonical invoice JSON and create an organization-scoped validation run. |
| `invoices:export_ubl` | Export a supplied canonical invoice payload as technical UBL XML and store safe export metadata. |
| `invoices:parse_ubl` | Parse safe UBL XML into the canonical invoice model with parser findings. |
| `invoices:import_ubl` | Reserved for future draft-import access control. Current editable draft import remains signed-user-only. |
| `xml:validation_jobs` | Create, list, and read XML validation jobs for worker readiness, local UBL XSD, and guarded local Schematron checks. |
| `vat:validate_format` | Run local VAT ID format checks. API-key calls cannot persist workspace evidence records. |
| `vat:check_vies` | Run explicit VIES evidence checks when server-side configuration allows it. |
| `transactions:simulate_vida` | Run direct ViDA-readiness transaction simulations. API-key calls cannot persist workspace history. |
| `validation_runs:read` | List/read organization-owned validation runs and download non-official technical report PDFs. |
| `rules:read` | Read the published technical validation rule catalog. |

Country-pack catalogue endpoints are public read-only endpoints at this stage.
API request logs, usage summaries, API-key management, VAT check history, XML
upload history, editable UBL draft import, saved ViDA history, and production
invoice lifecycle routes require a signed-in workspace user. Webhook simulator
endpoint management, signing secret rotation, test delivery, delivery logs, and
retry actions are also signed-user-only; no `webhooks:*` API-key scope is active
in this step.

Platform rule intelligence, source-register management, and country-pack review
overlays under `/api/v1/admin/*` are signed-user and platform-admin-only. There
is no API-key scope for these operations. `rules:read` remains limited to the
published technical rule catalog.

## Sandbox Rate Policies

Current default policies are per API key unless otherwise noted:

| Policy key | Scope or bucket | Limit |
| --- | --- | --- |
| `rules_read` | `rules:read` | 120 requests per 15 minutes |
| `vat_validate_format` | `vat:validate_format` | 60 requests per 15 minutes |
| `vat_check_vies` | `vat:check_vies` | 20 requests per 15 minutes |
| `transactions_simulate_vida` | `transactions:simulate_vida` | 30 requests per 15 minutes |
| `invoices_validate` | `invoices:validate` | 30 requests per 15 minutes |
| `invoices_export_ubl` | `invoices:export_ubl` | 30 requests per 15 minutes |
| `invoices_parse_ubl` | `invoices:parse_ubl` | 30 requests per 15 minutes |
| `xml_validation_jobs` | `xml:validation_jobs` | 15 requests per 15 minutes |
| `organization_total` | all scoped API-key traffic for an organization | 300 requests per 15 minutes |

Signed-user webhook simulator routes also have route-level operation limits for
create/update, secret rotation, test delivery, retry delivery, and log reads.
They return `WEBHOOK_RATE_LIMIT_EXCEEDED` with `Retry-After` and rate-limit
headers when exceeded. Delivery attempts are separately bounded by
`WEBHOOK_DELIVERY_TIMEOUT_MS`, `WEBHOOK_MAX_RESPONSE_BYTES`, and
`WEBHOOK_MAX_RETRY_ATTEMPTS`.

The API returns rate-limit headers on scoped API-key responses when a policy is
applied:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
Retry-After
```

Example 429 body:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "This API key exceeded the sandbox rate limit for XML validation jobs.",
    "limit": 15,
    "windowSeconds": 900,
    "retryAfterSeconds": 120
  }
}
```

429 means the sandbox policy window was exceeded. It does not indicate that an
invoice, XML file, VAT number, or simulation result is valid or invalid.

## Safety Notes

- Request logs store method, path, status, duration, timestamps, IP, user agent,
  and safe API-key metadata. They do not store request bodies, XML payloads,
  raw SOAP bodies, full API keys, full VAT IDs, service-role details, or key
  hashes.
- XML endpoints enforce body-size limits and safety checks against DTDs,
  external entities, unsafe paths, remote fetching, and excessive input.
- VIES checks are explicit, rate-limited, and safe-fail. Unavailable VIES is not
  treated as invalid VAT.
- Rotate and revoke keys regularly. Use narrower scopes for production-like
  testing and separate keys by environment.
- Rotate webhook signing secrets when receiver ownership changes. Webhook
  secrets are shown only on creation or rotation, encrypted at rest, and never
  returned by list/detail endpoints.
