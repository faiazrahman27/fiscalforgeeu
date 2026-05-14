# Privacy, GDPR-Aware Controls, Retention, And Deletion

Invoice Lantern provides GDPR-aware privacy-support tooling for workspace data
maps, export packages, deletion reviews, retention reviews, privacy request
workflows, subprocessors, and cookie/tracking stance. These controls support
data minimization and responsible operation, but they are not legal advice, not
privacy advice, not a GDPR compliance guarantee, and not a replacement for legal
counsel, DPO review, or professional privacy review.

Controller and processor roles depend on the final operating entity, deployment
model, customer contract, subprocessors, and reviewed production policies.
Professional review is required before relying on any controller/processor
positioning.

## Data Map

The API exposes the workspace privacy data map at:

- `GET /api/v1/workspace/privacy/data-map`

The data map currently covers:

- workspace privacy settings;
- privacy request and event records;
- structured invoice, business profile, contact, and canonical invoice data;
- validation reports;
- uploaded XML/transient XML payload metadata and XML validation jobs;
- invoice export metadata;
- developer API request logs and API key metadata;
- webhook endpoint and delivery logs;
- VAT/VIES evidence metadata;
- ViDA simulation runs;
- country-pack/rule/source lifecycle metadata where relevant;
- workspace activity, security, and privacy audit logs;
- legal document acceptance records.

Mapped records identify purpose, table/source, default retention, exportability,
deletability, anonymization support, raw-payload stance, user-facing
description, risk notes, and `legalReviewRequired`.

Raw XML, raw SOAP, API key secrets, API key hashes, webhook signing secrets,
webhook encryption keys, service-role keys, local file paths, stack traces,
platform-admin allowlists, and environment/config secrets are not data-map
payload fields.

## Privacy Settings

Workspace privacy settings include retention windows for invoice drafts,
validation runs, XML reports, XML validation jobs, invoice exports, API request
logs, webhook delivery logs, VIES evidence, ViDA simulation runs, workspace
activity, privacy requests, retention runs, deletion runs, and legal acceptance
records.

Settings also include toggles for export/deletion request support, validation
report retention, VIES evidence retention, webhook preview retention, uploaded
XML retention stance, API/webhook/legal acceptance export inclusion, data
minimization mode, and privacy/security contact placeholders.

Settings require signed-in workspace owner/admin access. Organization API keys
are rejected.

## Export Packages

Export packages are prepared through:

- `GET /api/v1/workspace/export-packages`
- `POST /api/v1/workspace/export-packages`
- `GET /api/v1/workspace/export-packages/{id}`

Each package includes generated timestamp, organization ID, schema/version,
redaction notice, legal/privacy disclaimer, manifest of included datasets,
record counts, retention/deletion notes, warnings, and errors when relevant.

Export redaction excludes service-role keys, database URLs, API key hashes and
secrets, webhook raw signing secrets, webhook encryption keys, raw SOAP, raw XML
unless a future reviewed policy explicitly allows it, expired transient
payloads, local file paths, internal stack traces, platform-admin allowlists,
environment/config secrets, full authorization headers, signatures, and
secret-like metadata.

Export support does not certify that a package satisfies every legal, tax,
accounting, privacy, retention, or GDPR requirement.

## Deletion Workflow

Deletion uses a prepare/execute workflow:

- `GET /api/v1/workspace/deletion-runs`
- `POST /api/v1/workspace/deletion-runs`
- `POST /api/v1/workspace/deletion-runs/{id}/execute`

Preparing a deletion run requires a linked deletion privacy request and returns
tenant-scoped affected counts, warnings, and disclaimers. Executing a deletion
run requires owner/admin access and remains scoped to the authenticated
organization.

Deletion runs delete or minimize tenant-owned operational records while
preserving required audit/security/legal records where policy requires. API key
metadata is safely revoked/minimized rather than exposing or exporting hashes.
Webhook endpoint secret fields are nulled and endpoints are disabled.

Deletion runs must not cross organization boundaries and must not delete public
legal documents, platform rules, source registers, country packs, or other
platform-owned rule/source metadata.

## Retention Workflow

Retention uses preview and run endpoints:

- `GET /api/v1/workspace/retention-preview`
- `GET /api/v1/workspace/retention-runs`
- `POST /api/v1/workspace/retention-runs`
- `POST /api/v1/workspace/retention-runs/{id}/execute`

Preview is non-destructive and returns eligible counts by policy. Prepared
runs snapshot the same counts before execution. Execution is tenant-scoped and
idempotent for already-executed runs.

Retention covers API logs, webhook logs, VIES evidence, XML jobs, validation
runs, invoice exports, ViDA runs, workspace activity, privacy requests,
retention runs, deletion runs, and legal acceptances where implemented.
Datasets that should be preserved by default, such as legal acceptance,
privacy/audit/security evidence, and required operational history, return
warnings rather than being silently removed.

Retention settings are not statutory retention advice. Accounting, tax, legal,
security, and contractual retention requirements require professional review.

## Privacy Requests

Privacy requests support or safely map:

- access;
- export;
- deletion;
- correction;
- objection;
- restriction;
- portability;
- retention review;
- other.

Supported statuses include submitted, in_review, awaiting_verification,
approved, rejected, fulfilled, cancelled, and completed. If a database status
set is narrower in an existing environment, the API should preserve migration
compatibility and expose safe mapping/warnings instead of rewriting old
migrations.

Review notes must remain minimized and must not contain legal advice, secrets,
raw XML, raw SOAP, unnecessary personal data, or internal stack traces.

## Subprocessors

The subprocessor endpoint returns known, configured, not-configured, or
review-required entries:

- `GET /api/v1/workspace/privacy/subprocessors`

Provider purpose, data categories, status, region, transfer mechanism, DPA
status, and international transfer analysis require professional review before
production use. A not-configured provider must not be presented as an active
processor.

## Cookie And Tracking Stance

The cookie/tracking endpoint returns the current essential-only stance:

- `GET /api/v1/workspace/privacy/cookie-stance`

This implementation does not add non-essential analytics, advertising, or
behavioral tracking cookies. Any future non-essential tracking must be explicit,
documented, reviewed, and controlled by a preference workflow.

## Legal Acceptance Integration

Legal acceptance status is shown with privacy controls because policy versioning
matters for privacy and developer workflows. Acceptance records are metadata
only. They do not decide whether the organization has met legal, tax,
accounting, privacy, statutory retention, or GDPR obligations.

## Incident And PWA Integration

Privacy incident assessment follows
[`docs/security/incident-response.md`](../security/incident-response.md). The
workflow uses the privacy data map to identify affected data categories and must
preserve minimized evidence without secrets, raw XML, raw SOAP, service-role
keys, database URLs, webhook secrets, or VIES credentials.

PWA/offline behavior follows
[`docs/security/pwa-cache-offline-policy.md`](../security/pwa-cache-offline-policy.md).
Offline draft storage is local-only and encrypted where browser support allows.
Privacy export, deletion, retention execution, privacy request review, and legal
acceptance state remain online-only authenticated workflows and must not be
served from stale service-worker cache.
