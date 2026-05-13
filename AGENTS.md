# Invoice Lantern Agent Rules

Invoice Lantern is a full production platform target, not an MVP, demo, toy,
or reduced-scope app. Preserve the long-term product direction while making
minimal, targeted changes.

## Product Identity

- Public name: Invoice Lantern.
- Do not reintroduce FiscalForge as public branding.
- Describe the platform as an independent, educational, technical,
  standards-based, source-linked, versioned, simulation-focused, GDPR-aware,
  secure-by-design, API-first, mobile-first e-invoice validation and
  ViDA-readiness sandbox.
- Safe pitch: Invoice Lantern is an independent e-invoice validation and
  ViDA-readiness sandbox for European freelancers, SMEs, students,
  accountants, and developers. It validates invoice structure, XML formats,
  calculation logic, VAT-number checks, Peppol-style rules, EN 16931-style
  checks, and country rule-pack simulations without claiming official legal or
  tax certification.

## Legal Boundaries

- Never claim official EU, European Commission, national tax authority,
  OpenPeppol, Peppol authority, or standards-body affiliation.
- Never claim certified compliance, legal validity, tax compliance, accounting
  compliance, authority acceptance, VAT return submission, or official filing.
- Preserve disclaimers that results are informational and not legal, tax,
  accounting, financial, professional, or official filing advice.
- Use cautious wording such as independent, educational, technical validation,
  sandbox, simulation, standards-based, source-linked, versioned,
  Peppol-style, EN 16931-style, professional review required, and not official.

## Scope Preservation

- Preserve existing features, routes, packages, UI pages, database behavior,
  migrations, validation behavior, Supabase behavior, API behavior, privacy
  behavior, security controls, and legal disclaimers.
- Do not remove incomplete routes, tests, stubs, or foundations merely because
  later prompts will complete them.
- Do not present scaffolds, placeholders, or stubs as production-complete
  Schematron, Peppol, EN 16931, VIES, CII, country-pack, filing, monitoring,
  or legal-compliance functionality.
- Keep structured invoice data, JSON API payloads, UBL XML, and future CII XML
  normalized through the canonical invoice model before validation/export.
- Use decimal strings and Decimal/decimal.js behavior for invoice money logic;
  do not introduce JavaScript floating-point money calculations.

## Database And Supabase

- Do not delete, squash, reorder, or rewrite existing Supabase migrations.
- Future schema changes must be new migrations only.
- Preserve RLS policies, grants, workspace bootstrap RPCs, service-role backend
  privileges, organization membership constraints, role constraints, API-key
  scope constraints, and privacy/deletion/retention access restrictions.
- Tenant-owned records must remain scoped by `organization_id`; API access must
  verify authentication or scoped API key, organization/workspace membership,
  role/scope, record ownership, and allowed action.
- Do not broaden owner/admin/developer/member permissions during stabilization.

## Security And Privacy

- Do not weaken authentication, authorization, RBAC, RLS assumptions, API-key
  hashing/scopes/rate limits, request logging, schema validation, upload
  limits, XML safety controls, SSRF protections, timeout limits, privacy
  controls, data export, deletion, retention, or audit/activity logging.
- Never expose service-role keys, database URLs, API signing secrets, webhook
  secrets, private tokens, VIES credentials, or email provider keys to clients,
  logs, docs, or examples.
- Preserve XML protections against DTDs, external entities, external schema
  fetching, unsafe paths, excessive size/nesting, entity expansion, and unsafe
  remote fetching.
- Do not add tracking, analytics, non-essential cookies, or unnecessary
  personal-data collection without an explicit later requirement.

## Development Rules

- Use the existing package manager and lockfiles. Do not switch package
  managers or delete lockfiles.
- Make minimal targeted fixes for real install, typecheck, test, build, stale
  branding, or unsafe legal-copy failures.
- Do not disable strict checks, delete tests, bypass middleware, weaken schemas,
  replace real logic with fake logic, or make unrelated formatting/refactor
  churn.
- Run the discovered verification commands after changes and document skipped
  or failing verification honestly.
- Do not commit, push, create branches, or create pull requests; the user
  handles version control manually.
