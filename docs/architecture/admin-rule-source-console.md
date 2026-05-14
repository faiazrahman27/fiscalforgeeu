# Admin Rule Source Console

Invoice Lantern now has a platform-admin console for validation rule
intelligence, source-reference metadata, and country-pack review overlays.
This console is an internal platform workflow for source traceability and
technical validation governance. It is not official EU software, national tax
authority software, Peppol certification, EN 16931 certification, ViDA
compliance, legal advice, tax advice, accounting advice, filing software, or an
authority acceptance system.

## Platform Admin Boundary

Admin writes require a signed-in Supabase user whose normalized email is listed
in backend-only `PLATFORM_ADMIN_EMAILS`.

Organization API keys are rejected. Workspace `owner` or `admin` role does not
grant platform rule/source/country-pack administration unless the same signed-in
user is also a platform admin.

The web local proxy forwards only the signed-user bearer token to
`/api/v1/admin/*`; it does not forward the development API key and never exposes
service-role keys.

## Rule Lifecycle

Rules use the lifecycle states:

- `draft`
- `review`
- `published`
- `deprecated`
- `archived`
- `disabled`

`suspended` remains supported for existing catalog compatibility.

Draft and review rules can be edited. Published, deprecated, archived, disabled,
suspended, and bundled catalog entries remain readable for historical
explanation. Published rule changes should be represented as new versions rather
than rewriting old published identity fields.

Old validation reports are not rewritten. Stored finding JSON keeps the rule
code, version, source labels, source references, check type, layer, and legal
confidence that existed when the validation run was produced.

## Source Requirement

No source means no legal or tax-like rule.

Publishing is rejected when legal, tax, standards, VIES, country-pack,
Peppol-style, EN 16931-style, or ViDA-simulation metadata has no linked source
reference. Technical/internal rules can be published without external legal
sources only when they remain clearly technical and do not claim legal, tax,
accounting, filing, authority, Peppol, EN 16931, or ViDA certainty.

Source references store metadata only: title, publisher, jurisdiction, http(s)
URL, type, review status, dates, notes, language, and version label. This step
does not crawl URLs, scrape source documents, store whole legal texts, or fetch
remote resources.

## Country-Pack Review Overlays

Country-pack package data remains code-owned in `packages/country-packs`.
The admin console stores review metadata overlays and source links in the
database or local JSON development storage. It does not mutate static package
country-pack code or invent VAT rates, domestic e-invoicing obligations,
clearance models, or national interpretations.

EU core plus all 27 EU Member States remain visible. Greece is exposed as `GR`;
`EL` remains VAT-prefix compatibility and maps to `GR` instead of creating a
duplicate country pack.

Review metadata is source-linked simulation metadata, not tax authority
endorsement. Marking a country-pack overlay as reviewed, stronger than
professional-review-required, or not requiring professional review requires at
least one source reference.

## Audit And Events

Sensitive admin actions write immutable lifecycle events for:

- rule creation, update, review submission, publish, deprecate, archive, and
  disable;
- source creation, update, and deprecation;
- country-pack review updates and source link changes.

Events include the actor user id and a hash of the actor email. They do not
store secrets, raw XML, SOAP bodies, service-role keys, source-document bodies,
or stack traces.

## Database

Migration `039_create_admin_rule_source_console.sql` is additive. It expands
rule lifecycle vocabulary, adds rule metadata columns, adds rule-source links,
country-pack review overlays, country-pack source links, and immutable platform
admin lifecycle events.

RLS is enabled for new tables. Authenticated users can read safe metadata where
appropriate; writes are performed through backend service-role code only after
explicit platform-admin checks.
