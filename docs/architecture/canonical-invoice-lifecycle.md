# Canonical Invoice Model And Lifecycle

Invoice Lantern stores production invoices through a canonical invoice model
before validation, persistence, export, or future reporting. This layer is an
independent technical sandbox foundation only. It is not official filing, tax
authority acceptance, Peppol delivery, legal advice, tax advice, accounting
advice, or a certified compliance result.

## Canonical Model

The canonical model lives in `packages/invoice-core` and is the boundary shape
for production invoice lifecycle operations. It includes:

- `profile`: `EN16931`, `PEPPOL_BIS_3`, or `COUNTRY_PACK`.
- `document`: type, number, issue date, currency, due/tax point dates, and
  buyer/contract/order/project/accounting references.
- `seller` and `buyer`: party names, optional VAT/tax/electronic contact fields,
  and normalized addresses.
- Optional `delivery` and `payment` snapshots.
- `lines`: line ids, descriptions, quantities, unit codes, unit prices,
  discounts, charges, net amounts, VAT categories, and VAT rates.
- Optional document or line `allowances` and `charges`.
- `taxBreakdown`, `totals`, optional `metadata`, and `legal`.

Unknown fields are rejected in canonical API schemas. Legacy draft aliases such
as `document.invoiceType` are normalized into the canonical `document.type`
field during draft conversion so existing drafts stay usable.

## Decimal Rule

All API and canonical money values are decimal strings. Calculation code uses
`Decimal` from `decimal.js`; JavaScript floating point arithmetic is not used for
invoice money logic.

The core calculation checks:

- line net amount = `quantity x unitPrice - discountAmount + chargeAmount`;
- line extension total = sum of line net amounts;
- tax-exclusive total = line extension total minus document allowances plus
  document charges;
- tax amount = taxable amount times VAT rate divided by 100;
- tax-inclusive total = tax-exclusive total plus tax total;
- payable amount = tax-inclusive total minus prepaid amount plus payable
  rounding amount.

Validation findings are structured with code, severity, category, field path,
message, legal confidence, and rule metadata where applicable.

## Drafts And Production Invoices

`invoice_drafts` remain editable draft records. Step 5 does not delete, replace,
or migrate the draft table.

Production invoices are records in `invoices` plus normalized child rows:
`invoice_lines`, `invoice_taxes`, `invoice_allowances`, and `invoice_charges`.
The service persists canonical JSON and a calculation summary on the parent and
replaces child rows from the canonical model during updates.

Draft-to-production conversion:

- loads a draft by id inside the signed-in workspace context;
- normalizes the draft payload into the canonical model;
- returns structured findings instead of persisting incomplete data;
- creates a production invoice with `draft_id` when the source draft id is a
  UUID;
- preserves the original draft by default.

## Lifecycle Statuses

Production invoice statuses are:

- `draft`
- `ready_for_review`
- `validated`
- `issued`
- `archived`
- `voided`

Allowed transitions are:

- `draft` -> `ready_for_review`, `archived`, `voided`
- `ready_for_review` -> `draft`, `validated`, `archived`, `voided`
- `validated` -> `ready_for_review`, `issued`, `archived`, `voided`
- `issued` -> `archived`, `voided`
- `archived` -> `archived`
- `voided` -> `voided`

`issued` is internal to the workspace lifecycle. It does not mean official
filing, authority acceptance, Peppol delivery, legal validity, tax compliance,
accounting compliance, or official submission.

## Roles And Tenant Isolation

Production invoice routes are signed-user workspace routes in Step 5.
Organization API keys are rejected for production invoice management.

- `owner`, `admin`, `accountant`, and `reviewer` may create, update, convert
  from draft, and transition production invoices.
- `developer` and `viewer` may read where workspace read roles allow it, but may
  not mutate production invoices by default.

Every read, list, update, transition, and child-row operation is scoped by
`organization_id`. Object access uses invoice id plus organization id so one
organization cannot read or mutate another organization's invoices.

## Activity And Security Events

Lifecycle events are stored in `invoice_lifecycle_events` by migration 036.
Events include organization id, invoice id, previous status, next status, actor
metadata, safe lifecycle metadata, and creation time.

The service also records workspace activity for creation, draft conversion,
updates, transitions, archiving, and voiding when Supabase workspace activity is
available. Suspicious invalid transitions are recorded as security events with
safe metadata only. Do not log raw API keys, secrets, full XML payloads,
sensitive headers, or full invoice bodies in security logs.

## Legal Boundary

Canonical invoices preserve legal confidence and disclaimer fields. Responses
include validation summaries with informational-only disclaimers. No lifecycle
state or validation finding is a legal, tax, accounting, financial,
professional, filing, authority, Peppol, EN 16931, or certified compliance
conclusion.

## Remaining For Step 6

Step 6 expands technical UBL 2.1 generation, parsing, import, export, warnings,
and round-trip coverage on top of this canonical and production lifecycle
layer. Technical CII XML export/import support follows the same canonical
invoice boundary through `packages/cii`: generated CII and parsed CII are
informational sandbox artefacts only, not official validation, certification,
filing, authority acceptance, or legal, tax, or accounting advice. It does not
build the full invoice editor/studio UI or implement VIES, real Schematron,
webhooks, reviewed country packs, admin rule/source consoles, legal-document
systems, monitoring, or PDF report redesign.

Step 7 remains the real XML/XSD worker path. That work should keep using the
canonical model as the boundary for generated or parsed invoice payloads.
