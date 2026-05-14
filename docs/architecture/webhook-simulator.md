# Webhook Simulator Architecture

The webhook simulator lets workspace developers test receiver integrations with
signed sandbox events. It is not production tax reporting, official filing,
authority submission, downstream acceptance evidence, legal advice, tax advice,
accounting advice, or a compliance guarantee.

## Storage Model

Migration `038_create_webhook_simulator.sql` adds:

- `webhook_endpoints`: tenant-owned endpoint configuration, status, event type
  subscriptions, encrypted signing secret material, delivery timestamps, and
  failure counters.
- `webhook_deliveries`: tenant-owned delivery attempts with redacted request and
  response metadata, stable payload hash, bounded preview, safe error fields,
  and retry state.

Both tables are scoped by `organization_id`. RLS uses the same owner, admin, and
developer role intent as API-key management. Old migrations are not rewritten.

## Authorization

Webhook routes are signed-user-only. Organization API keys are rejected because
endpoint configuration and signing secrets are workspace management surfaces.

Allowed roles:

- `owner`
- `admin`
- `developer`

Disallowed roles:

- `accountant`
- `reviewer`
- `viewer`

Every repository lookup includes `organization_id`, so cross-organization object
access returns not found instead of leaking existence.

## Signing Secrets

The API generates `whsec_...` HMAC secrets on endpoint creation and rotation.
The raw secret is returned once only. Persistent storage uses AES-256-GCM with a
backend-only key derived from `WEBHOOK_SECRET_ENCRYPTION_KEY`.

If `WEBHOOK_SECRET_ENCRYPTION_KEY` is missing or shorter than 32 characters,
creation, rotation, and delivery fail safely. The API never stores plaintext
webhook secrets and never returns encrypted secret material.

## Delivery Safety

Deliveries are JSON `POST` requests with:

- `content-type: application/json`
- `user-agent: Invoice-Lantern-Webhook-Simulator/1.0`
- `Invoice-Lantern-Webhook-Id`
- `Invoice-Lantern-Webhook-Timestamp`
- `Invoice-Lantern-Webhook-Signature`
- `Invoice-Lantern-Webhook-Event`

URL safety rules:

- HTTPS is required by default.
- `http://localhost` is allowed only when local development explicitly enables
  `WEBHOOK_ALLOW_LOCALHOST_DELIVERY`.
- Embedded URL credentials are blocked.
- Non-http schemes and `file://` are blocked.
- DNS results are checked before delivery.
- Localhost, private ranges, link-local ranges, metadata addresses,
  multicast/reserved ranges, and unsafe IPv6 local ranges are blocked.
- Redirects are not followed.
- Delivery timeout is bounded by `WEBHOOK_DELIVERY_TIMEOUT_MS`.
- Response previews are capped by `WEBHOOK_MAX_RESPONSE_BYTES`.

Delivery errors are recorded as safe error codes/messages. API handlers do not
return stack traces, raw XML, raw SOAP, service-role data, API keys, or signing
secrets.

## Payload Rules

Each event includes:

- `id`
- `type`
- `createdAt`
- `apiVersion`
- `organizationId`
- `livemode: false`
- `simulator: true`
- `data`
- `disclaimer`

The simulator provides default safe sample data for:

- `webhook.test`
- `invoice.validation.completed`
- `xml.validation.completed`
- `vat.vies.checked`
- `vida.simulation.completed`

Test payloads are JSON objects only. Obvious secret-like keys, raw XML, raw
SOAP, raw UBL, and similar unsafe bodies are rejected before delivery.

## Retries And Logs

Retries are explicit API actions. The simulator does not create unbounded
background retry loops. `WEBHOOK_MAX_RETRY_ATTEMPTS` is capped by the server
environment schema.

Delivery logs contain redacted request and response headers, signature presence,
payload hash, safe payload object, response status, response time, capped
preview, retry timestamps, and safe errors.

Workspace activity logging records endpoint creation, updates, disable actions,
secret rotations, test sends, and retries on a best-effort basis. Activity
metadata contains IDs, statuses, event types, and attempt numbers only.

## Environment

Backend-only settings:

```text
WEBHOOK_SECRET_ENCRYPTION_KEY
WEBHOOK_SIGNING_KEY_ID
WEBHOOK_DELIVERY_TIMEOUT_MS
WEBHOOK_MAX_RESPONSE_BYTES
WEBHOOK_MAX_RETRY_ATTEMPTS
WEBHOOK_ALLOW_LOCALHOST_DELIVERY
```

Never expose `WEBHOOK_SECRET_ENCRYPTION_KEY` to browser apps, logs, public
examples, or client configuration.
