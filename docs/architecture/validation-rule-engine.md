# Validation Rule Engine

Invoice Lantern's validation rule engine is the source-linked enrichment layer
above canonical invoice checks, UBL parsing/export, local UBL XSD diagnostics,
guarded Schematron results, VAT format checks, optional VIES evidence, and
future country-pack findings.

It is informational technical infrastructure only. Rule engine findings are not
legal advice, tax advice, accounting advice, filing advice, official validation,
authority status, Peppol recognition, EN 16931 recognition, or a guarantee of
legal or tax treatment.

## Finding Contract

Enriched findings use one shared shape wherever practical:

- `code`, `ruleId`, `ruleVersion`, and optional `ruleSetCode`
- `severity`: `info`, `warning`, `fatal`, or `blocked`
- `category`: `SCHEMA`, `CANONICAL`, `CALCULATION`, `VAT_ID`, `VIES`,
  `EN16931`, `PEPPOL`, `UBL`, `CII`, `COUNTRY_PACK`, `VIDA_SIMULATION`,
  `SECURITY`, or `LEGAL_LABEL`
- `field` and `fieldPath`
- `message` and optional `fixSuggestion`
- `sourceLabels`, optional `sourceRefIds`, and optional source references
- `legalConfidence`: `technical`, `standard_based`,
  `official_source_derived`, `educational_simulation`, or
  `professional_review_required`
- `checkType`, `layer`, and optional persistence metadata such as `createdAt`
  or `evidenceId`

Every legal/tax-like interpretation must carry a legal confidence label and
source context. If source context is absent, enrichment downgrades the finding
to technical confidence rather than creating an unsourced legal or tax
conclusion.

## Inputs

The engine enriches and combines:

- canonical invoice findings from `@invoice-lantern/invoice-core`
- decimal calculation findings from the canonical money model
- local VAT format findings from `@invoice-lantern/tax-engine`
- UBL parse/export findings where routed through validation responses
- local UBL XSD worker diagnostics (`xsd_ubl`)
- guarded local Schematron findings (`schematron_peppol` and
  `schematron_en16931`)
- optional VIES evidence findings
- source-linked country-pack simulation findings for seller/buyer country
  context

The engine does not download official rule packs, claim official EN 16931 or
Peppol validation, or determine legal/tax compliance. Country-pack findings are
warnings and context only. No source means no legal/tax rule; unknown or
unreviewed national details remain `unknown`, `not_reviewed`, or
`professional_review_required`.

## Catalog And Versioning

Static bundled catalog data is exposed alongside database-backed published rule
sets. Database rows remain the preferred source when configured, with bundled
rules used as a fallback for local JSON/test mode and for newer bundled rule
sets not yet present in the database.

Historical validation runs keep their finding JSON, including rule version,
source labels, source references, check type, layer, and legal confidence. Old
runs are not rewritten when catalog rows evolve. The additive migration
`037_expand_validation_rules_and_vies_evidence.sql` only expands allowed
catalog/API-scope vocabulary and seeds new rule sets; it does not alter prior
validation findings.

## Report Summary

Validation summaries now group findings by:

- severity
- category
- layer
- check type
- legal confidence

Reports continue to show a report-level disclaimer and safe next actions. A
clean technical result must still not be phrased as official, authority-backed,
standards-body-backed, or legally sufficient.

## Source Semantics

Internal technical rules use internal technical policy source labels. Local XSD
and Schematron adapters are source-linked as Invoice Lantern technical
adapters, not official standards-body results. VIES evidence, when live checks
are explicitly enabled and requested, is labelled as VIES time-of-check
evidence and remains separate from legal/tax/accounting conclusions.

Country-pack source references identify reviewed public-source metadata where
available and expose `countryPackVersion` and `countryPackStatus` on relevant
findings. They support validation context and later ViDA-readiness work, but do
not provide official country, tax authority, filing, or compliance conclusions.
