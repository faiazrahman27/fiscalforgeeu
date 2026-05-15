# Production Data Model Foundation

Invoice Lantern is an independent, educational, technical validation and
ViDA-readiness sandbox. The production data model supports source-linked,
versioned, secure-by-design invoice workflows, but it does not provide official
EU, tax authority, OpenPeppol, Peppol authority, standards-body, legal, tax,
accounting, filing, authority-acceptance, or certified compliance conclusions.

## Scope

Step 3 adds the persistent database foundation for production invoice records.
Step 5 adds the canonical invoice lifecycle service and an additive lifecycle
event table. These steps do not replace draft storage, implement a full editor,
add VIES, real Schematron, webhooks, country-pack expansion, admin tooling, or
legal-document workflows. Technical CII XML support is handled through the
canonical invoice model by the later `packages/cii` layer and remains sandbox
support only, not official validation, certification, filing, or legal, tax, or
accounting advice.

## New Tables

- `business_profiles`: reusable seller, buyer, or dual-use organization
  profiles. Bank data is limited to safe label and last-four style metadata.
- `contacts`: reusable business, person, department, or other contact records.
  These may contain personal data and remain tenant-scoped.
- `invoices`: production invoice records separate from `invoice_drafts`.
  They store snapshots, canonical JSON, calculation summaries, validation
  summaries, status fields, source labels, and non-official disclaimers.
- `invoice_lines`: normalized production invoice lines using Postgres numeric
  persistence. TypeScript money logic must continue to use decimal strings and
  decimal-safe libraries.
- `invoice_taxes`: invoice-level and line-level tax breakdowns.
- `invoice_allowances`: document-level or line-level allowances.
- `invoice_charges`: document-level or line-level charges.
- `invoice_attachments`: metadata for supporting files, source XML, imported
  PDFs, generated PDFs, and manual-entry helpers.
- `security_events`: security-sensitive audit stream for blocked access,
  missing scopes, suspicious API-key use, XML blocks, privacy/deletion events,
  and related security records.
- `source_references`: central source register for future validation rules,
  country packs, ViDA notes, VIES explanations, legal notices, and admin review.
- `source_reference_links`: generic link table connecting sources to invoices,
  validation findings, rules, country packs, and future reports.
- `invoice_lifecycle_events`: Step 5 internal status history for production
  invoices. The `issued` status is an internal workspace lifecycle state only;
  it is not official filing, authority acceptance, Peppol delivery, legal
  advice, tax advice, or accounting advice.

## Tenant Isolation

Tenant-owned tables include `organization_id` and remain scoped to one
organization. Production invoice child rows reference their parent invoice with
organization-aware foreign keys where the relationship is normalized in Step 3.
Repository methods require `organizationId` for tenant-owned reads and writes,
filter lists by organization, and read or mutate records by `id` plus
`organizationId`.

## RLS Model

Migration `034_create_production_invoice_data_model.sql` enables RLS on every
new table. Policies reuse the existing Step 2 helper functions:

- `is_org_member` for tenant read access.
- `can_create_invoice` for business profile, contact, invoice, line, tax,
  allowance, charge, and attachment creation or editing.
- `can_manage_org` for sensitive deletes, organization source-reference writes,
  and security-event visibility.

The intended role behavior is:

- `owner` and `admin`: broad management rights, including sensitive deletes and
  security-event reads.
- `accountant` and `reviewer`: invoice data creation/editing where Step 3
  foundations permit it.
- `viewer`: read-only where table visibility allows it.
- `developer`: no default business-profile/contact/invoice mutation through
  the new RLS policies.

Service-role backend access is granted for server-side persistence paths, but
API code must still verify authentication, organization ownership, role/scope,
and allowed action before using service-role operations.

## Drafts And Production Invoices

`invoice_drafts` remain the editable draft foundation from earlier steps.
Step 3 does not migrate drafts into production invoices and does not delete or
replace draft tables, draft routes, or draft behavior.

`invoices` are production records that can optionally reference a draft. They
coexist with drafts and now persist the Step 5 canonical invoice model,
calculation summary, validation summary, legal disclaimer, status timestamps,
and normalized line/tax/allowance/charge child rows.

Draft-to-production conversion preserves the source draft by default. It creates
a production invoice linked by `draft_id` when the draft id is a UUID and blocks
persistence when canonical validation returns fatal or blocked findings.

## Lifecycle Events

Migration `036_create_invoice_lifecycle_events.sql` records production invoice
status changes. Rows are tenant-scoped by `organization_id`, linked to the
parent `invoices` row with an organization-aware foreign key, and protected by
RLS. Workspace members can read events for their organization; invoice editors
can create events through authenticated backend paths.

Lifecycle event metadata must stay safe. It may include status, reason, source,
and invoice number labels. It must not include raw XML, raw API keys, secrets,
full invoice bodies, sensitive headers, or unnecessary personal data.

## Attachments

Attachments are supporting evidence or workflow metadata. Scanned PDFs and
images are not the primary source of e-invoice validation truth. Only
`attachment_type = 'source_xml'` may use `validation_role = 'structured_source'`.
Generated PDFs remain generated outputs, not official filing artifacts.

## Source References

`source_references` supports the future rule that legal, tax, standards, and
country-pack simulations should be source-linked. Platform sources are readable
to authenticated users but backend-managed until an admin console exists.
Organization sources are tenant-scoped and owner/admin-managed.

`source_reference_links` prevents schema churn by allowing future validation
rules, invoices, findings, reports, and country-pack records to link back to the
source register.

## Security Events

`security_events` is separate from general workspace activity. It is intended
for security-sensitive events and should store safe metadata only. Use hashed IP
data, safe request IDs, and safe resource labels. Do not store raw API keys, key
hashes, secrets, request bodies, raw XML payloads, database URLs, service-role
keys, private tokens, webhook secrets, or provider credentials.

## Remaining Work

Step 6 expands technical UBL 2.1 generation, parsing, import, export, warnings,
and round-trip coverage on top of the production model and canonical lifecycle
service without weakening RLS, draft preservation, decimal-string money logic,
or legal disclaimers. It does not build the full invoice editor/studio UI.
Later steps still need the real XML/XSD worker path, VIES, real Schematron,
reviewed country packs, webhooks, admin/source console, legal-document,
monitoring, and reporting work. CII support exists as technical canonical
invoice export/import mapping only and does not create official CII validation,
certification, filing, or authority acceptance.
