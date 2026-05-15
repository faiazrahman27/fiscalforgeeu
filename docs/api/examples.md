# Developer API Examples

All examples use placeholder keys and compact fixtures. Replace
`il_test_your_key_here` with a server-side API key created in the Invoice
Lantern workspace developer settings.

## Health And Readiness

```bash
curl -sS http://localhost:4000/health
curl -sS http://localhost:4000/ready
curl -sS http://localhost:4000/api/v1/health/ready
```

These public responses are intentionally minimal. They do not expose secrets,
environment values, provider credentials, internal paths, raw XML, raw SOAP, or
stack traces.

Workspace security/readiness diagnostics require a signed-in workspace user:

```text
GET /api/v1/workspace/security/readiness
Authorization: Bearer <workspace-user-token>
```

Organization API keys are rejected for the workspace readiness endpoint.

## Validate A Canonical Invoice

```bash
curl -sS http://localhost:4000/api/v1/invoices/validate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: il_test_your_key_here" \
  -d '{
    "document": {
      "type": "invoice",
      "number": "INV-API-001",
      "currency": "EUR",
      "issueDate": "2026-04-30",
      "dueDate": "2026-05-30",
      "profile": "EN16931"
    },
    "seller": { "name": "Example Seller GmbH", "country": "DE", "vatId": "DE123456789" },
    "buyer": { "name": "Example Buyer Kft", "country": "HU", "vatId": "HU12345678" },
    "lines": [
      {
        "id": "1",
        "description": "Sandbox validation service",
        "quantity": "1",
        "unitCode": "EA",
        "unitPrice": "100.00",
        "netAmount": "100.00",
        "vatCategory": "S",
        "vatRate": "27"
      }
    ],
    "taxBreakdown": [
      { "taxCategory": "S", "taxScheme": "VAT", "vatRate": "27", "taxableAmount": "100.00", "taxAmount": "27.00" }
    ],
    "totals": {
      "lineExtensionAmount": "100.00",
      "taxExclusiveAmount": "100.00",
      "taxAmount": "27.00",
      "taxTotalAmount": "27.00",
      "taxInclusiveAmount": "127.00",
      "payableAmount": "127.00"
    }
  }'
```

Response excerpt:

```json
{
  "validationRunId": "val_example",
  "technicalStatus": "passed",
  "standardStatus": "ready",
  "findings": [],
  "viesMode": "skip",
  "disclaimer": "Sandbox technical validation results are informational only."
}
```

## Export Technical UBL

```bash
curl -sS http://localhost:4000/api/v1/invoices/export/ubl \
  -H "Content-Type: application/json" \
  -H "X-API-Key: il_test_your_key_here" \
  -d '{
    "invoice": {
      "document": { "type": "invoice", "number": "INV-API-001", "currency": "EUR", "issueDate": "2026-04-30", "profile": "EN16931" },
      "seller": { "name": "Example Seller GmbH", "country": "DE", "vatId": "DE123456789" },
      "buyer": { "name": "Example Buyer Kft", "country": "HU", "vatId": "HU12345678" },
      "lines": [{ "id": "1", "description": "Service", "quantity": "1", "unitCode": "EA", "unitPrice": "100.00", "netAmount": "100.00", "vatCategory": "S", "vatRate": "27" }],
      "taxBreakdown": [{ "taxCategory": "S", "taxScheme": "VAT", "vatRate": "27", "taxableAmount": "100.00", "taxAmount": "27.00" }],
      "totals": { "lineExtensionAmount": "100.00", "taxExclusiveAmount": "100.00", "taxAmount": "27.00", "taxTotalAmount": "27.00", "taxInclusiveAmount": "127.00", "payableAmount": "127.00" }
    }
  }'
```

UBL export is technical XML generation only. It is not official validation,
filing, delivery, or authority acceptance.

## Parse Or Import UBL

API keys can parse UBL:

```bash
curl -sS http://localhost:4000/api/v1/invoices/parse/ubl \
  -H "Content-Type: application/xml" \
  -H "X-API-Key: il_test_your_key_here" \
  --data-binary @invoice.xml
```

Editable draft import is signed-user-only:

```text
POST /api/v1/invoices/import/ubl
Authorization: Bearer <workspace-user-token>
Content-Type: application/xml
```

Organization API keys are rejected for editable draft import. Use UBL parse for
server-side API-key workflows.

## XML Validation Job

```bash
curl -sS http://localhost:4000/api/v1/xml/validation-jobs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: il_test_your_key_here" \
  -d '{
    "xml": "<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"><cbc:ID xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">INV-API-001</cbc:ID></Invoice>",
    "filename": "invoice.xml",
    "sourceType": "api_payload",
    "requestedChecks": ["worker_readiness", "xsd_ubl", "schematron_peppol", "schematron_en16931"]
  }'
```

Response excerpt:

```json
{
  "job": {
    "id": "xml_job_example",
    "status": "completed",
    "requestedChecks": ["worker_readiness", "xsd_ubl", "schematron_peppol", "schematron_en16931"],
    "completedChecks": ["worker_readiness"],
    "resultSummary": {
      "xsdUbl": { "status": "not_configured", "validationExecuted": false, "markedValid": false }
    },
    "disclaimer": "Technical sandbox worker-readiness and configured-check result only."
  }
}
```

`not_configured` is not a success state. XSD and Schematron outputs are
technical checks only.

## VAT Format And VIES Evidence

```bash
curl -sS http://localhost:4000/api/v1/vat/validate-format \
  -H "Content-Type: application/json" \
  -H "X-API-Key: il_test_your_key_here" \
  -d '{ "vatId": "HU12345678", "countryHint": "HU" }'
```

```bash
curl -sS http://localhost:4000/api/v1/vat/check-vies \
  -H "Content-Type: application/json" \
  -H "X-API-Key: il_test_your_key_here" \
  -d '{ "countryCode": "DE", "vatNumber": "DE123456789", "partyRole": "seller" }'
```

VIES response excerpt:

```json
{
  "status": "unavailable",
  "viesCheck": {
    "status": "unavailable",
    "viesValid": null,
    "evidence": null
  },
  "disclaimer": "VIES evidence is time-of-check evidence only. VIES unavailable is not invalid."
}
```

## Country Packs

```bash
curl -sS http://localhost:4000/api/v1/country-packs
curl -sS http://localhost:4000/api/v1/country-packs/DE
```

Country packs are source-linked educational context. Unknown, unreviewed, or
source-limited items require professional review.

## ViDA-Readiness Simulation

```bash
curl -sS http://localhost:4000/api/v1/transactions/simulate-vida \
  -H "Content-Type: application/json" \
  -H "X-API-Key: il_test_your_key_here" \
  -d '{
    "sellerCountry": "DE",
    "buyerCountry": "HU",
    "sellerVatId": "DE123456789",
    "buyerVatId": "HU12345678",
    "buyerType": "business",
    "transactionType": "services",
    "supplyScenario": "intra_eu",
    "invoiceDate": "2030-07-01",
    "amount": "100.00",
    "currency": "EUR"
  }'
```

ViDA simulation is readiness planning only. It is not an official determination.

## Validation Runs

```bash
curl -sS http://localhost:4000/api/v1/validation-runs \
  -H "X-API-Key: il_test_your_key_here"
```

```bash
curl -sS http://localhost:4000/api/v1/validation-runs/val_example \
  -H "X-API-Key: il_test_your_key_here"
```

## Webhook Simulator

Webhook management uses signed-in workspace bearer authentication. Organization
API keys do not manage endpoints, secrets, test sends, or delivery logs.

Create an endpoint:

```bash
curl -sS -X POST http://localhost:4000/api/v1/webhooks/endpoints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-user-token>" \
  -d '{
    "name": "Integration receiver",
    "url": "https://webhooks.example.test/invoice-lantern",
    "eventTypes": ["webhook.test", "invoice.validation.completed"]
  }'
```

Response excerpt:

```json
{
  "endpoint": {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "Integration receiver",
    "signingSecretLast4": "abcd"
  },
  "signingSecret": "whsec_placeholder_store_once",
  "warning": "Store this webhook signing secret now. Invoice Lantern only shows it on creation or rotation."
}
```

Send a signed test event:

```bash
curl -sS -X POST http://localhost:4000/api/v1/webhooks/endpoints/00000000-0000-4000-8000-000000000001/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-user-token>" \
  -d '{ "eventType": "webhook.test", "payload": { "message": "Receiver smoke test" } }'
```

Delivery headers sent to the receiver:

```text
Invoice-Lantern-Webhook-Id: <delivery-id>
Invoice-Lantern-Webhook-Timestamp: <unix-seconds>
Invoice-Lantern-Webhook-Signature: v1=<hex-hmac-sha256>
Invoice-Lantern-Webhook-Event: webhook.test
```

Inspect or retry:

```bash
curl -sS http://localhost:4000/api/v1/webhooks/deliveries \
  -H "Authorization: Bearer <supabase-user-token>"

curl -sS -X POST http://localhost:4000/api/v1/webhooks/deliveries/<delivery-id>/retry \
  -H "Authorization: Bearer <supabase-user-token>"
```

Webhook events are signed sandbox test events only. They are not official
filing, authority submission, downstream acceptance, legal advice, tax advice,
accounting advice, or compliance evidence. Do not place real API keys, service
role keys, tokens, raw XML, raw SOAP, or sensitive invoice data in test payloads.

## Common Error Examples

Validation error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [{ "path": "document.number", "message": "Required" }]
  }
}
```

Missing scope:

```json
{
  "error": {
    "code": "API_KEY_SCOPE_INSUFFICIENT",
    "message": "The API key does not have the required scope.",
    "details": { "requiredScopes": ["vat:check_vies"] }
  }
}
```

XML check not configured:

```json
{
  "job": {
    "resultSummary": {
      "xsdUbl": {
        "status": "not_configured",
        "validationExecuted": false,
        "markedValid": false
      }
    }
  }
}
```

Rate limited:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "This API key exceeded the sandbox rate limit.",
    "limit": 30,
    "windowSeconds": 900,
    "retryAfterSeconds": 120
  }
}
```

Webhook URL blocked:

```json
{
  "error": {
    "code": "WEBHOOK_URL_PRIVATE_ADDRESS_BLOCKED",
    "message": "Webhook endpoint URLs must not resolve to private, local, link-local, metadata, multicast, or reserved addresses.",
    "details": null
  }
}
```

Web-user legal acceptance and cookie preferences are intentionally absent from
API-key examples. Legal acceptance requires a signed-in Supabase user session,
and cookie preferences are stored only as browser-local public preferences.
