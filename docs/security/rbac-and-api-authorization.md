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
| `developer` | API-key management, API request and usage visibility, activity visibility, validation/export-oriented developer operations, and report reads. No privacy, deletion, retention, settings, or normal draft-edit permissions. |
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
- `invoices:import_ubl`
- `xml:validation_jobs`
- `vat:validate_format`
- `transactions:simulate_vida`
- `validation_runs:read`
- `rules:read`

Scopes authorize functions, not tenant boundaries. A scoped API key can only
act inside the key's organization. User-only workspace routes, such as API-key
management, privacy/deletion/retention/settings operations, editable draft
storage routes, VAT check history, XML upload history, and local draft import
paths, require signed-in Supabase users.

## Route Family Overview

| Route family | Caller model | Authorization shape |
| --- | --- | --- |
| API keys | Signed-in user | `owner`, `admin`, or `developer`; safe metadata only; one-time secret display on create. |
| API requests and usage | Signed-in user | `owner`, `admin`, or `developer`; request logs contain safe metadata only. |
| Invoice validation | Signed-in user or scoped API key | Workspace validation roles or `invoices:validate`; organization API-key validation runs are organization-scoped. |
| UBL export | Signed-in user or scoped API key | Workspace export roles or `invoices:export_ubl`; export metadata is safe and does not return stored XML. |
| UBL parse | Signed-in user or scoped API key | Workspace validation roles or `invoices:parse_ubl`; XML safety checks stay in place. |
| UBL import to editable draft | Signed-in user | Workspace draft editors only. Organization API keys can parse UBL but cannot create editable drafts in this step. |
| Invoice drafts | Signed-in user | Read roles may view; edit roles may create/update; only owner/admin delete. |
| Validation runs and reports | Signed-in user or scoped API key | Report readers or `validation_runs:read`; object reads are organization-scoped. |
| VAT format checks | Signed-in user or scoped API key | Validation roles or `vat:validate_format`; stored check history is signed-user only. |
| ViDA simulation | Signed-in user or scoped API key | Validation roles or `transactions:simulate_vida`; simulation remains educational and technical only. |
| XML validation jobs | Signed-in user or scoped API key | Validation/report roles or `xml:validation_jobs`; uploaded XML history remains signed-user only. |
| Workspace activity | Signed-in user | `owner`, `admin`, or `developer`. |
| Workspace settings, privacy, retention, deletion, export packages | Signed-in user | `owner` or `admin`. |
| Workspace member and invitation management | Signed-in user | `owner` or `admin`; organization API keys are rejected; last-owner protection and invite-token hashing are enforced. |
| Country packs and validation rules | Public or scoped technical catalog reads as implemented | No tenant-owned object data is returned. |

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
- XML handling must preserve protections against DTDs, external entities,
  unsafe schema fetching, excessive size/nesting, and unsafe paths.

## Future Work

This document covers the Step 2 authorization hardening and Step 4 workspace
member/invitation management rules. Later prompts may add the canonical invoice
lifecycle, full editor/studio fields, CII, VIES, webhooks, expanded country
packs, admin/source consoles, monitoring, legal-document workflows, and
PWA/offline capabilities. Those are not implemented or claimed complete here.
