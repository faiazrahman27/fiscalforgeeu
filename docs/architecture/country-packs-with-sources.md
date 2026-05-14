# Country Packs With Sources

Invoice Lantern country packs are source-linked educational simulations. They
provide structured context for VAT-number format checks, VAT-rate review status,
e-invoicing review status, source references, warnings, and validation findings.
They are not legal, tax, accounting, filing, authority, Peppol certification, EN
16931 certification, or compliance advice.

## Coverage

The country-pack package represents EU core plus all 27 EU Member States:
AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IE, IT, LV, LT, LU, MT, NL,
PL, PT, RO, SK, SI, ES, and SE.

Greece is represented as country pack `GR`, while VAT-number format checks and
VIES evidence use the `EL` VAT prefix where needed. The lookup layer maps `EL`
to the `GR` country pack for display and validation context.

## Source Policy

Country packs use reviewed public-source metadata where available. Current
source types include EU law, EU guidance, national tax authority, national
e-invoicing authority, standard, Peppol, VIES, country-pack, legal notice, and
other public references.

No source means no legal/tax rule. If a VAT rate, domestic e-invoicing status,
B2B obligation, clearance model, platform rule, effective date, or national
interpretation has not been safely reviewed from suitable official or public
sources, the field is intentionally represented as `null`, `unknown`,
`not_reviewed`, `eu_core_only`, or `professional_review_required`.

Unknown or unreviewed fields are not placeholders for hidden conclusions. They
are explicit safety signals that professional review is required.

## Review Status

Country packs expose:

- `status`
- `version`
- `lastReviewedAt`
- `reviewerLabel`
- `legalConfidence`
- `sourceCoverageSummary`
- `warnings`
- `disclaimer`

Status and source coverage depth can vary by available reviewed public sources.
The presence of a country pack only means the country is represented in the
simulation layer; it does not mean national VAT or e-invoicing rules are fully
reviewed.

## Validation Integration

The validation engine attaches country-pack context when seller or buyer country
codes are present. Findings can include:

- `COUNTRY_PACK_REVIEW_REQUIRED`
- `COUNTRY_PACK_SOURCE_LIMITED`
- `COUNTRY_PACK_UNKNOWN_RATE_CONTEXT`
- `COUNTRY_PACK_EINVOICING_REVIEW_REQUIRED`
- `COUNTRY_PACK_CROSS_BORDER_CONTEXT`
- `COUNTRY_PACK_UNSUPPORTED_COUNTRY`

These findings include source labels, source references where available,
`countryPackVersion`, `countryPackStatus`, legal-confidence labels, and
professional-review wording. They are simulation context, not legal/tax
determinations.

## ViDA Readiness

Country packs now feed the ViDA-readiness simulator for seller and buyer
country context, pack version, pack status, source coverage, source labels, and
professional-review warnings. The simulator uses the country-pack EU Member
State list rather than maintaining a separate country list.

Greece remains user-facing `GR` in country packs. VAT-number prefix
compatibility may use `EL` through tax-engine local VAT-format rules. Simulator
findings preserve that distinction and do not convert country-pack context into
national tax advice.

Country-pack statuses such as `beta`, `unknown`, `not_reviewed`, or
`professional_review_required` reduce readiness and add review findings. They do
not determine legal compliance, tax compliance, official filing readiness, or
authority acceptance.
