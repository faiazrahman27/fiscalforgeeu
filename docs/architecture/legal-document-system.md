# Legal Document System

Invoice Lantern maintains a versioned legal-document and policy-notice layer for
public platform notices, developer/API terms, privacy-support notices, and
technical validation disclaimers. It is an independent, educational, technical,
non-official sandbox. This system does not make Invoice Lantern official EU,
national tax authority, OpenPeppol, Peppol authority, or standards-body
software, and it does not provide legal, tax, accounting, filing, privacy, or
compliance advice.

Professional legal and privacy review is required before production reliance on
any document text, lifecycle rule, acceptance record, controller/processor
positioning, subprocessor description, or public launch copy.

## Document Registry

The registry in `apps/api/src/legal/legal-document-registry.ts` defines the
baseline published documents. Each document has:

- `documentKey`
- `title`
- `category`
- `audience`
- `status`
- `version`
- `effectiveFrom`
- `requiresAcceptance`
- `legalReviewRequired`
- `professionalReviewRequired`
- `summary`
- `bodyMd`
- `disclaimers`
- `changeNotes`

The current required set covers Terms of Service, Privacy Policy, Cookie Policy,
Data Processing Addendum, Acceptable Use Policy, Security Policy, Disclaimer /
No Tax Advice Notice, Subprocessor List, Data Retention Policy, Incident
Response Policy, Vulnerability Disclosure Policy, Trademark / Brand Disclaimer,
API Terms, Country Rule Pack Disclaimer, Webhook Simulator Terms / Integration
Notice, ViDA Simulator Notice, VIES Evidence Notice, and XML/XSD/Schematron
Technical Validation Notice.

The registry is safe fallback content. If database-backed published documents
exist, the repository lists/reads those published records. Draft, review,
deprecated, archived, or suspended legal documents are not exposed by public
read routes.

## Public Routes

The API exposes published legal documents at:

- `GET /api/v1/legal/documents`
- `GET /api/v1/legal/documents/{documentKey}`

Public responses return markdown policy text, metadata, disclaimers, and review
flags. They do not return rendered HTML, raw database internals, draft/review
documents, platform-admin allowlists, secrets, or official endorsement claims.

The web app exposes the same published policy surface at:

- `/legal`
- `/legal/[documentKey]`

The web renderer treats markdown as text sections and bullets. It does not use
unsafe HTML injection for the document body.

## Acceptance Tracking

Signed-in users can accept the latest published version of a document that
requires acceptance:

- `POST /api/v1/legal/documents/{documentKey}/accept`
- `GET /api/v1/legal/acceptances/me`
- `GET /api/v1/legal/acceptances/workspace`

Organization API keys are rejected for legal acceptance writes and workspace
acceptance reads. Acceptance is a signed-user action because it is product
policy evidence tied to user/workspace context, not an API-key technical
operation.

Acceptance records are versioned by document and version. Repeating acceptance
of the same latest published version is safe and idempotent. Acceptance records
may include hashed request evidence only when captured. Raw IP addresses and raw
user agents must not be stored or returned by the acceptance layer.

Acceptance records do not make a validation result official, legally valid, tax
compliant, accounting compliant, GDPR compliant, authority accepted, Peppol
certified, EN 16931 certified, or professionally reviewed.

## Lifecycle Events

Migration `040_create_legal_document_system.sql` introduced legal document and
acceptance foundations. The repository writes best-effort lifecycle events when
acceptance occurs and the backing table is present. Event metadata must stay
minimal and must not include raw IP addresses, raw user agents, secrets, raw XML,
raw SOAP, stack traces, or legal conclusions.

Document management beyond the seeded/published registry remains bounded by the
existing platform-admin rules when implemented. Workspace owner/admin roles do
not grant platform-level legal-document publication rights by themselves.

## Developer And Privacy Integration

Developer API copy links to API Terms, Webhook Simulator Terms / Integration
Notice, Disclaimer / No Tax Advice Notice, and related technical notices. API
keys do not accept or manage legal documents.

Workspace privacy screens show legal acceptance status alongside the data map,
subprocessor list, cookie stance, export, deletion, retention, and privacy
request workflows. This makes policy-version state visible without turning it
into a legal or GDPR compliance determination.

## Safe Language Rules

Legal and public copy must keep these boundaries:

- independent, educational, technical, standards-based, source-linked,
  versioned, simulation-focused, GDPR-aware, secure-by-design, API-first, and
  mobile-first are acceptable product descriptors;
- "Peppol-style" and "EN 16931-style" are acceptable when describing simulated
  or technical rule behavior;
- do not claim official affiliation, official validation, official filing,
  authority submission, authority acceptance, VAT return submission,
  certification, legal validity, tax compliance, accounting compliance, GDPR
  compliance, guaranteed correctness, or lawyer approval;
- describe the documents as product policy drafts/notices requiring
  professional review.

