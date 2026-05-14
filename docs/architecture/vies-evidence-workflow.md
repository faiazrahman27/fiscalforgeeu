# VIES Evidence Workflow

Invoice Lantern keeps VAT ID format validation and VIES evidence separate.
Local VAT format checks are technical pattern checks only. A format-valid VAT
number must never be treated as VIES-valid.

VIES evidence is optional, explicit, rate-limited, and disabled by default. It
is time-of-check evidence retrieved through VIES when available. VIES
availability depends on EU and national VAT database systems. VIES unavailable
does not mean invalid, and VIES valid does not prove full transaction
treatment or replace legal, tax, accounting, filing, or professional advice.

## Configuration

Live VIES transport is disabled unless all of these are true:

- `VIES_CHECK_ENABLED` is true-like
- the request explicitly asks for live VIES evidence
- local VAT format validation passes first
- the configured daily rate limits allow the request

Environment variables:

- `VIES_CHECK_ENABLED`
- `VIES_SERVICE_URL`
- `VIES_TIMEOUT_MS`
- `VIES_RATE_LIMIT_PER_ORG_PER_DAY`
- `VIES_RATE_LIMIT_PER_VAT_PER_DAY`

Blank/default configuration returns `not_checked` or safe non-live statuses.
Tests mock the VIES transport and must not depend on the internet.

## Statuses

VIES statuses are:

- `valid`
- `invalid`
- `unavailable`
- `error`
- `not_checked`
- `unsupported`
- `rate_limited`

`valid` and `invalid` describe VIES time-of-check evidence only. They are not
legal, tax, accounting, filing, or full transaction treatment conclusions.

`unavailable` means VIES or a national backend could not provide evidence
safely at that time. It is not evidence that the VAT number is invalid.

`not_checked` means no live VIES evidence check was performed. Common reasons
include disabled configuration, `viesMode: "skip"`, no cached evidence, or a
local format failure.

## API Behavior

`POST /api/v1/vat/check-vies`:

- requires authentication
- requires `vat:check_vies` for organization API keys
- requires a workspace validation role for signed-in users
- rejects unknown request fields
- runs local VAT format validation first
- does not call VIES when format validation fails
- returns `formatCheck`, `viesCheck`, optional persisted `evidence`, findings,
  source metadata, and a disclaimer
- never returns raw SOAP bodies, backend secrets, or raw transport errors

Invoice validation supports `viesMode`:

- `skip`: default and safest; no VIES lookup
- `use_cached`: reuse latest stored VIES evidence for the organization/VAT ID
  when present
- `live`: request a live check, still subject to configuration and rate limits

VIES failures do not fail the whole invoice validation request. They return
warning or info findings with cautious wording.

## Persistence And Privacy

VIES evidence is stored in `vies_evidence_checks` by additive migration
`037_expand_validation_rules_and_vies_evidence.sql`.

Stored evidence includes:

- organization and optional invoice/validation-run linkage
- normalized/display VAT number and a fingerprint
- request source, status, `vies_valid`, returned name/address when present,
  request identifier, checked time, source label/URL, response time, safe error
  code/message, raw response hash, metadata, and creator

The raw SOAP body is never stored. Error messages are compact and safe. Secrets
and backend transport details are not exposed to clients, logs, or examples.

## Source And Legal Labels

VIES evidence findings use source label `VAT Information Exchange System
(VIES)` with the configured source URL. Legal confidence is
`official_source_derived` only for actual `valid` or `invalid` VIES evidence.
Unavailable, skipped, unsupported, rate-limited, and transport-error outcomes
remain technical confidence findings.
