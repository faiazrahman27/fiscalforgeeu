# RBAC and API Authorization

Invoice Lantern is an independent, educational, technical e-invoice validation
and ViDA-readiness sandbox. Authorization controls protect workspace data and
developer API usage, but sandbox results remain informational only. They are not
legal advice, tax advice, accounting advice, authority submission, official
filing, certified Peppol compliance, or a compliance guarantee.

## Core Rules

- Every tenant-owned operation must identify the caller as either a signed-in
  Supabase workspace user or a valid organization API key.
- Tenant-owned reads and writes must be scoped to one `organization_id`.
- Object ID lookups must include organization ownership checks before returning,
  mutating, exporting, or deleting records.
- Signed-in workspace actions must pass a role check before the route handler
  calls repositories.
- Organization API-key actions must pass a scope check before the operation runs.
- API keys must never bypass organization isolation.
- Cross-organization object access should return not found where the route is
  object-oriented and non-enumeration is appropriate.
- Responses must not expose full API keys, key hashes, service-role details,
  request bodies, raw XML payloads, full VAT identifiers in request logs, private
  user metadata, or backend secrets.

## Role Matrix

| Role | Intended permissions |
| --- | --- |
| `owner` | Full workspace control, API-key management, request-log visibility, activity visibility, invoice draft work, validation, export, privacy, retention, deletion, and settings operations. |
| `admin` | Broad workspace administration, API-key management, request-log visibility, activity visibility, invoice draft work, validation, export, and owner/admin workspace controls currently implemented by the API. |
| `accountant` | Invoice draft create/edit, validation, export, and validation-report reads. No API-key, settings, privacy, retention, or deletion management. |
| `developer` | API-key management, webhook simulator management, API request and usage visibility, activity visibility, validation/export-oriented developer operations, and report reads. No privacy, deletion, retention, settings, or normal draft-edit permissions. |
| `reviewer` | Invoice draft review/edit where currently supported, validation, and report reads. No API-key, settings, privacy, retention, or deletion management. |
| `viewer` | Read-only report/draft visibility where allowed. No mutate, export, API-key, settings, privacy, retention, or deletion management. |

The shared API role sets live in
`apps/api/src/middleware/require-workspace-role.ts`. Route-level checks should
reuse those sets instead of defining new ad hoc role lists unless a route has a
documented reason to be stricter.

## API-Key Scope Principles

Organization API keys are bound to one workspace and must be hashed at rest.
The secret is returned only when the key is created. API-key metadata responses
must not include the full secret or `key_hash`.

Current scopes are:

- `invoices:validate`
- `invoices:export_ubl`
- `invoices:parse_ubl`
- `invoices:export_cii`
- `invoices:parse_cii`
- `invoices:import_ubl` (reserved in the scope enum; editable draft import is
  currently signed-user-only and rejects organization API keys)
- `invoices:import_cii` (reserved in the scope enum; editable draft import is
  signed-user-only and rejects organization API keys)
- `xml:validation_jobs`
- `vat:validate_format`
- `vat:check_vies`
- `transactions:simulate_vida`
- `validation_runs:read`
- `rules:read`

Scopes authorize functions, not tenant boundaries. A scoped API key can only
act inside the key's organization. User-only workspace routes, such as API-key
management, privacy/deletion/retention/settings operations, editable draft
storage routes, VAT check history, XML upload history, and local draft import
paths, require signed-in Supabase users.
Webhook simulator endpoint management, signing secret rotation, test delivery,
delivery logs, and retry actions are also signed-user-only owner/admin/developer
routes. Organization API keys do not receive webhook management scopes in this
step.
Workspace security/readiness diagnostics are signed-user-only
owner/admin/developer routes. Organization API keys are rejected because the
response describes operational configuration state rather than a scoped
developer API action.

## Platform Admin Boundary

Platform rule intelligence, source-register administration, and country-pack
review overlays are not workspace-owned operations. They require signed-user
Supabase authentication plus backend-only platform-admin allow-list membership
through `PLATFORM_ADMIN_EMAILS`.

Workspace `owner` and `admin` roles do not automatically grant platform rule
publishing rights. Organization API keys are rejected from `/api/v1/admin/*`
even when they have `rules:read`. The platform-admin allow-list is never
returned to clients; the optional admin context endpoint returns only a boolean
for the signed-in user.

Admin writes are still informational metadata workflows. They do not create
official legal, tax, accounting, filing, Peppol, EN 16931, ViDA, or authority
certification.

## Route Family Overview

| Route family | Caller model | Authorization shape |
| --- | --- | --- |
| API keys | Signed-in user | `owner`, `admin`, or `developer`; safe metadata only; one-time secret display on create. |
| API requests and usage | Signed-in user | `owner`, `admin`, or `developer`; request logs contain safe metadata only. |
| Webhook simulator | Signed-in user | `owner`, `admin`, or `developer`; endpoint secrets are encrypted at rest, raw secrets are returned only on create/rotate, test deliveries are signed and bounded, logs are redacted, and organization API keys are rejected. |
| Invoice validation | Signed-in user or scoped API key | Workspace validation roles or `invoices:validate`; organization API-key validation runs are organization-scoped. |
| UBL/CII export | Signed-in user or scoped API key | Workspace export roles or `invoices:export_ubl` / `invoices:export_cii`; export metadata is safe and does not return stored XML. |
| UBL/CII parse | Signed-in user or scoped API key | Workspace validation roles or `invoices:parse_ubl` / `invoices:parse_cii`; XML safety checks stay in place. |
| UBL/CII import to editable draft | Signed-in user | Workspace draft editors only. Organization API keys can parse UBL/CII but cannot create editable drafts. |
| Invoice drafts | Signed-in user | Read roles may view; edit roles may create/update; only owner/admin delete. |
| Production invoice lifecycle | Signed-in user | Read roles may view; `owner`, `admin`, `accountant`, and `reviewer` may create, update, convert from draft, or transition; `developer` and `viewer` are read-only by default; organization API keys are rejected in Step 5. Production invoice ViDA simulation is signed-user only, tenant-scoped by invoice id and organization id, persisted as a simulation run, and does not change lifecycle state. |
| Validation runs and reports | Signed-in user or scoped API key | Report readers or `validation_runs:read`; object reads are organization-scoped. |
| VAT format checks | Signed-in user or scoped API key | Validation roles or `vat:validate_format`; stored local-format check history is signed-user only. |
| VIES evidence checks | Signed-in user or scoped API key | Validation roles or `vat:check_vies`; live checks are explicit, disabled by default, rate-limited, safely persisted, and never make VAT format validity equivalent to VIES validity. |
| ViDA simulation | Signed-in user or scoped API key | Validation roles or `transactions:simulate_vida`; direct transaction simulation remains educational and technical only. API keys can run direct simulation but cannot persist workspace history. |
| XML validation jobs | Signed-in user or scoped API key | Validation/report roles or `xml:validation_jobs`; uploaded XML history remains signed-user only. |
| Workspace activity | Signed-in user | `owner`, `admin`, or `developer`. |
| Workspace security/readiness | Signed-in user | `owner`, `admin`, or `developer`; safe configured/unconfigured diagnostics only; no secrets, raw XML/SOAP, provider credentials, internal paths, or compliance guarantees. |
| Workspace settings, privacy, retention, deletion, export packages | Signed-in user | `owner` or `admin`. |
| Workspace privacy data map, subprocessors, and cookie stance | Signed-in user | `owner` or `admin`; GDPR-aware support metadata only, not a GDPR compliance guarantee. |
| Workspace privacy requests | Signed-in user | `owner` or `admin`; supports access, export, deletion, correction, objection, restriction, portability, retention review, and other workflow records. |
| Legal documents | Public read for published documents; signed-in user for acceptance | Draft/review documents are hidden from public reads. Organization API keys are rejected for legal acceptance and workspace acceptance status. |
| Workspace member and invitation management | Signed-in user | `owner` or `admin`; organization API keys are rejected; last-owner protection and invite-token hashing are enforced. |
| Country packs and validation rules | Public or scoped technical catalog reads as implemented | No tenant-owned object data is returned. |
| Platform rule/source/country-pack admin | Signed-in platform admin only | Backend-only `PLATFORM_ADMIN_EMAILS`; organization API keys and workspace roles alone are rejected; writes create lifecycle events and preserve source traceability. |

## Database Backstop

Supabase RLS policies should enforce the same role intent as the route layer:

- list policies filter by `organization_id`;
- write policies require role helper functions such as
  `can_create_invoice`, `can_validate_invoice`, `can_manage_api_keys`,
  `can_view_audit_logs`, `can_manage_org`, or
  `can_delete_workspace_data`;
- relational rows must reference parent records from the same organization;
- service-role grants stay limited to backend API-key verification and scoped
  server-side persistence paths.

Old migrations must not be rewritten. Authorization hardening must be added in
new migrations only.

## Response Shaping

- API-key list/revoke responses return metadata only.
- Workspace invitation list responses return invite metadata only. Raw invite
  tokens are returned only once when created, and `token_hash` is never returned
  through API responses or authenticated table selects.
- API request logs return method, path, status, timing, safe IP/user-agent
  metadata, and safe key prefix/name metadata only.
- Validation/export/report endpoints return technical sandbox results and
  disclaimers, not official conclusions.
- VIES evidence responses return time-of-check evidence, status metadata, safe
  errors, source labels, and hashes only. They do not return raw SOAP bodies or
  claim tax, accounting, filing, authority, or full transaction conclusions.
- XML handling must preserve protections against DTDs, external entities,
  unsafe schema fetching, excessive size/nesting, and unsafe paths.
- Production invoice lifecycle responses return canonical invoice data,
  calculation summaries, technical findings, safe status history, and
  informational disclaimers. The `issued` state is internal only and is not
  official filing, authority acceptance, Peppol delivery, legal advice, tax
  advice, or accounting advice.
- Webhook endpoint list/detail responses return safe metadata and
  `signingSecretLast4` only. Delivery logs redact signatures, secret-like
  headers, response headers, and response previews. They do not return raw XML,
  raw SOAP, full API keys, service-role details, encrypted secret material, or
  stack traces.
- Platform admin rule/source/country-pack responses return metadata and
  lifecycle events only. They do not expose the platform-admin email allow-list,
  service-role credentials, source-document bodies, or legal/tax conclusions.
- Legal document public reads return published policy markdown and safe
  metadata only. Acceptance records store document/version/context and hashed
  request evidence only when captured; raw IP addresses and raw user agents are
  not stored or returned.
- Export packages include generated timestamp, organization ID, schema/version,
  redaction notice, manifest, retention/deletion notes, warnings, and
  legal/privacy disclaimers. They exclude service-role keys, database URLs, API
  key hashes/secrets, webhook raw signing secrets, webhook encryption keys, raw
  SOAP, raw XML unless a future reviewed policy explicitly allows it, expired
  transient payloads, local paths, stack traces, platform-admin allowlists, and
  environment/config secrets.
- Deletion runs require owner/admin access and a prepared deletion request
  review. They stay tenant-scoped, revoke/minimize API-key metadata, disable and
  clear webhook endpoint secret fields, and preserve required legal, audit,
  security, public legal document, platform rule, source-register, and
  country-pack records.
- Retention previews/runs are owner/admin, tenant-scoped, and non-destructive
  until execution. Preserved legal/security/audit datasets must produce clear
  warnings instead of being silently deleted.

## Future Work

This document covers the authorization hardening, workspace member/invitation
management rules, production invoice lifecycle route permissions, explicit VIES
evidence workflow, legal/privacy/retention/deletion hardening, webhook
simulator, platform-admin rule/source console, workspace
security/readiness/PWA cache boundary, and signed-user-only UBL/CII editable
draft import boundary added so far. Later prompts may add final production
release-candidate hardening.
