# ViDA-Readiness Simulator

Invoice Lantern's ViDA-readiness simulator is an independent, educational,
technical, source-linked, versioned readiness sandbox. It is not official EU,
European Commission, national tax authority, Peppol authority, or standards-body
software. It is not legal, tax, accounting, financial, professional, filing, or
official advice, and it is not a compliance guarantee.

The simulator produces readiness context only. Cross-border EU B2B relevance is
a planning signal, not a legal obligation determination. Domestic context,
public-authority context, country-pack warnings, VIES evidence, XSD checks, and
Schematron checks all remain professional-review aware.

## Input Model

The package accepts direct transaction input:

- seller and buyer countries, with GR used for Greece and EL accepted as a VAT
  prefix compatibility alias
- seller and buyer VAT IDs
- buyer and seller type
- transaction type and optional supply scenario
- invoice date, issue date, currency, and decimal-string amount
- optional invoice profile
- structured invoice evidence flags for canonical invoice, UBL XML, CII XML,
  XSD status, Peppol-style Schematron status, EN 16931-style Schematron status,
  and validation summary
- optional VAT evidence states for local format and VIES
- optional country-pack version/status/source coverage context
- optional source references and source labels

The package also exposes helpers for building simulation input from the
canonical invoice model. Production invoice simulation uses `canonical_json`
without changing invoice lifecycle state.

## Output Model

The simulator returns:

- `transactionClass`
- `vidaRelevance`
- `readinessScore` from 0 to 100, or null when minimum country data is missing
- `readinessStatus`
- source-linked timeline context
- country context and country-pack versions/statuses
- normalized input
- evidence summary for VAT format, VIES, structured invoice data, country
  packs, XML/XSD, and Schematron
- findings with category, severity, source labels, source refs, evidence status,
  country-pack metadata, and legal confidence
- recommended next actions
- source references
- legal-safe disclaimer

All output wording is cautious. VIES valid is evidence only. VIES unavailable is
not invalid. Format-valid is not VIES-valid. XSD pass is technical only.
Schematron pass is technical only. `not_configured` is not success.

## Classification

The package recognizes these transaction classes:

- `intra_eu_b2b_goods`
- `intra_eu_b2b_service`
- `intra_eu_b2b_digital_service`
- `intra_eu_b2b_mixed`
- `intra_eu_b2b_unknown`
- `intra_eu_b2c`
- `intra_eu_public_authority`
- `domestic_eu_business`
- `domestic_eu_consumer`
- `domestic_eu_unknown`
- `non_eu_or_unsupported`
- `insufficient_data`

Cross-border EU B2B goods, services, digital services, and mixed transactions
receive high ViDA-readiness relevance for planning. Unknown buyer type,
public-authority context, one-sided EU/non-EU context, and country-pack source
coverage warnings can require professional review.

## API And Persistence

`POST /api/v1/transactions/simulate-vida` remains the direct simulation
endpoint. It uses strict request schema validation, rejects unknown fields, keeps
the `transactions:simulate_vida` scope, and does not call live VIES by default.
Workspace persistence remains signed-user only.

`POST /api/v1/invoices/{id}/simulate-vida` runs a signed-user simulation from a
tenant-scoped production invoice canonical payload. It rejects cross-workspace
invoice access through the existing production invoice repository and RBAC
path, persists a ViDA simulation run, and does not change invoice lifecycle
state.

The existing `vida_simulation_runs` table already stores normalized input,
country context, result payload, findings, source labels, and recommended next
actions as JSON plus summary columns. The expanded result is stored safely in the
existing JSON payloads, so no new migration is required.

## Legal Boundary

The simulator must never be described as official ViDA software, official VAT
reporting software, certified compliance, legal compliance, tax compliance,
accounting compliance, authority acceptance, or filing software.

Safe descriptions include:

- ViDA-readiness simulation
- educational simulation
- technical readiness context
- appears relevant
- source-linked context
- professional review required
- not official
- not legal, tax, or accounting advice
- not official filing
- not a compliance guarantee

No source means no legal or tax rule. Unknown, beta, not reviewed, or
professional-review-required source coverage must remain visible in findings and
UI output.
