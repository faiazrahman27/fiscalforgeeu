# Webhook Simulator API

Invoice Lantern webhook events are signed sandbox test events for technical
integration testing. They are informational only. They are not official filing,
not authority submission, not downstream acceptance, not legal advice, not tax
advice, not accounting advice, and not a compliance guarantee.

Webhook management is signed-user-only. Organization API keys do not create
endpoints, rotate secrets, send test events, or read delivery logs. Workspace
owners, admins, and developers may use the simulator.

## Endpoints

| Action | Endpoint |
| --- | --- |
| List endpoints | `GET /api/v1/webhooks/endpoints` |
| Create endpoint | `POST /api/v1/webhooks/endpoints` |
| Read endpoint | `GET /api/v1/webhooks/endpoints/{id}` |
| Update endpoint | `PATCH /api/v1/webhooks/endpoints/{id}` |
| Disable endpoint | `DELETE /api/v1/webhooks/endpoints/{id}` |
| Rotate secret | `POST /api/v1/webhooks/endpoints/{id}/rotate-secret` |
| Send test event | `POST /api/v1/webhooks/endpoints/{id}/test` |
| List deliveries | `GET /api/v1/webhooks/deliveries` |
| Read delivery | `GET /api/v1/webhooks/deliveries/{id}` |
| Retry delivery | `POST /api/v1/webhooks/deliveries/{id}/retry` |

## Create Endpoint

```bash
curl -sS -X POST http://localhost:4000/api/v1/webhooks/endpoints \
  -H "content-type: application/json" \
  -H "Authorization: Bearer <supabase-user-token>" \
  -d '{
    "name": "Integration receiver",
    "url": "https://webhooks.example.test/invoice-lantern",
    "eventTypes": ["webhook.test", "invoice.validation.completed"],
    "description": "Sandbox receiver for integration tests"
  }'
```

The response includes `signingSecret` once. Store it in the receiver secret
manager immediately. List and detail endpoints return only `signingSecretLast4`
and `signingSecretKeyId`.

Endpoint URLs must use HTTPS by default. The API rejects credentials in URLs,
non-http schemes, `file://`, private/internal IP ranges, link-local addresses,
metadata IPs such as `169.254.169.254`, localhost unless explicitly enabled for
local development, and redirects are not followed during delivery.

## Signing

Each delivery is a JSON `POST` with these headers:

```text
Invoice-Lantern-Webhook-Id
Invoice-Lantern-Webhook-Timestamp
Invoice-Lantern-Webhook-Signature
Invoice-Lantern-Webhook-Event
```

The signature input is:

```text
${timestamp}.${deliveryId}.${rawJsonPayload}
```

The signature header format is:

```text
v1=<hex-hmac-sha256>
```

TypeScript verification example:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyInvoiceLanternWebhook(input: {
  secret: string;
  deliveryId: string;
  timestamp: string;
  rawJsonPayload: string;
  signatureHeader: string;
}) {
  const expected =
    "v1=" +
    createHmac("sha256", input.secret)
      .update(`${input.timestamp}.${input.deliveryId}.${input.rawJsonPayload}`)
      .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(input.signatureHeader);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
```

Rotate a secret with:

```bash
curl -sS -X POST http://localhost:4000/api/v1/webhooks/endpoints/<endpoint-id>/rotate-secret \
  -H "Authorization: Bearer <supabase-user-token>"
```

Future deliveries use the new secret. Old raw secrets are not returned.

## Test Events

Supported sandbox event types:

- `webhook.test`
- `invoice.validation.completed`
- `invoice.ubl.exported`
- `xml.validation.completed`
- `vat.vies.checked`
- `vida.simulation.completed`
- `country_pack.review_required`

Send a test event:

```bash
curl -sS -X POST http://localhost:4000/api/v1/webhooks/endpoints/<endpoint-id>/test \
  -H "content-type: application/json" \
  -H "Authorization: Bearer <supabase-user-token>" \
  -d '{
    "eventType": "webhook.test",
    "payload": {
      "message": "Receiver smoke test"
    }
  }'
```

Payload contract:

```json
{
  "id": "evt_00000000-0000-4000-8000-000000000001",
  "type": "webhook.test",
  "createdAt": "2026-05-14T12:00:00.000Z",
  "apiVersion": "2026-05-14.webhook-simulator",
  "organizationId": "00000000-0000-4000-8000-000000000001",
  "livemode": false,
  "simulator": true,
  "data": {
    "message": "Receiver smoke test"
  },
  "disclaimer": "Webhook events are signed sandbox test events for technical integration testing. They are informational only, not official filing, not authority submission, and not legal, tax, accounting, or compliance advice."
}
```

Do not place API keys, service-role keys, tokens, passwords, raw XML, raw SOAP,
full sensitive invoice data, local file paths, or stack traces in test payloads.
The API rejects obvious secret-like fields and raw XML/SOAP strings.

## Delivery Logs And Retries

Delivery logs store:

- status, event type, endpoint, attempt number, and max attempts;
- request URL, method, redacted headers, payload hash, and safe JSON payload;
- signature header presence, not the raw signature;
- response status, response time, redacted response headers, and capped response
  preview;
- safe error code/message and next retry timestamp.

Retry a failed delivery:

```bash
curl -sS -X POST http://localhost:4000/api/v1/webhooks/deliveries/<delivery-id>/retry \
  -H "Authorization: Bearer <supabase-user-token>"
```

Retries are explicit, bounded by `WEBHOOK_MAX_RETRY_ATTEMPTS`, and never run as
an infinite loop. Disabled or suspended endpoints are not retried.

## Common Errors

Unsafe URL:

```json
{
  "error": {
    "code": "WEBHOOK_URL_PRIVATE_ADDRESS_BLOCKED",
    "message": "Webhook endpoint URLs must not resolve to private, local, link-local, metadata, multicast, or reserved addresses.",
    "details": null
  }
}
```

Missing encryption configuration:

```json
{
  "error": {
    "code": "WEBHOOK_SECRET_ENCRYPTION_KEY_MISSING",
    "message": "Webhook signing secrets require WEBHOOK_SECRET_ENCRYPTION_KEY to be configured on the API server before endpoint creation, rotation, or delivery.",
    "details": null
  }
}
```

Operation rate limit:

```json
{
  "error": {
    "code": "WEBHOOK_RATE_LIMIT_EXCEEDED",
    "message": "Webhook simulator operation rate limit exceeded. Slow down and try again.",
    "details": {
      "limit": 30,
      "windowSeconds": 900,
      "retryAfterSeconds": 120
    }
  }
}
```
