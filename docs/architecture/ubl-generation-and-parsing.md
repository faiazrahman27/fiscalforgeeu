# UBL Generation And Parsing

Invoice Lantern supports technical UBL 2.1 generation and parsing as an
independent invoice interoperability feature. It is standards-based and
source-linked where the surrounding validation stack has sources, but it is not
official validation, not Peppol-certified, not legal, tax, or accounting advice,
not official filing, and not authority acceptance.

## Scope

Step 6 maps the expanded canonical invoice model to UBL 2.1 XML and back. The
implementation covers UBL Invoice and CreditNote documents where the current
canonical fields have safe mappings.

Generation currently maps:

- document type, invoice number, issue date, due date, tax point date, and
  currency;
- buyer, order, contract, project, and accounting references;
- seller and buyer party names, legal names, VAT/tax identifiers, electronic
  addresses with schemes, postal addresses, email, and phone contact fields;
- delivery date and delivery location/address when present;
- payment means code, payment reference, due date, and payment terms;
- invoice or credit note lines, quantities, unit codes, unit prices, line
  discounts, line charges, item names, VAT categories, and VAT rates;
- document-level allowances and charges;
- VAT breakdown and monetary totals from the canonical calculation summary;
- a safe sandbox note that states the export is not official validation,
  Peppol certification, legal/tax/accounting advice, official filing, or
  authority acceptance.

Parsing currently maps the same supported fields back into
`CanonicalInvoice`. It also preserves safe UBL metadata, including root type,
customization/profile identifiers, detected notes, and unsupported-but-detected
fields.

## Diagnostics

The parser returns structured findings. Unsupported UBL elements that are
detected but not represented in the canonical model are reported as warnings
instead of being silently treated as supported data. Examples include billing
references, tax representative party data, withholding tax totals, despatch or
receipt references, and payee financial account identifiers.

These warnings are technical parser diagnostics only. They do not make a UBL
document legally valid, Peppol-certified, tax compliant, accepted by an
authority, or suitable for official filing.

## XML Safety

UBL parsing uses the package safety gate before XML is parsed. The gate blocks:

- XML bodies over the configured package limit;
- `DOCTYPE`;
- entity declarations and external entity text;
- `SYSTEM` and `PUBLIC` external identifiers;
- XML stylesheet processing instructions;
- excessive nesting depth.

The parser does not fetch external schemas, remote resources, files, DTDs, or
network locations. Route code returns structured errors and does not echo raw XML
into logs or error details.

## API Boundaries

`POST /api/v1/invoices/export/ubl` accepts a canonical invoice payload through
the scoped Developer API and returns technical UBL 2.1 XML plus safe
`invoice_exports` metadata.

`POST /api/v1/invoices/parse/ubl` accepts raw XML or `{ "xml": "..." }` and
returns an Invoice Lantern canonical invoice payload, totals, detected metadata,
and parser findings.

`POST /api/v1/invoices/import/ubl` remains a signed-user draft-import route.
Organization API keys cannot create editable drafts through this route.

`POST /api/v1/invoices/{id}/export/ubl` exports a signed-user, tenant-scoped
production invoice canonical record as technical UBL 2.1 XML and persists safe
`invoice_exports` metadata. The route reads the production invoice by invoice id
and organization id and does not expose records across workspaces.

## Round-Trip Contract

Package tests cover canonical invoice to UBL XML to canonical invoice
round-trips. The supported contract keeps document identity, seller and buyer
parties, line items, allowances, charges, tax breakdown, and monetary totals
stable for the mapped fields.

Round-tripping is interoperability-oriented. It is not a substitute for legal,
tax, accounting, or official filing review.

## Remaining For Step 7

Step 7 should focus on the real XML/XSD worker path: reviewed local XSD
execution, worker-level diagnostics, safe result mapping, and configuration
checks. It should continue to avoid Schematron execution, EN 16931/Peppol rule
engine claims, VIES, country-pack expansion, CII, webhooks, admin consoles, or
legal-compliance guarantees unless those are explicitly scheduled in later
locked steps.
