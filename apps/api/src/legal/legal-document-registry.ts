export type LegalDocumentAudience =
  | "public"
  | "workspace"
  | "developer"
  | "admin"
  | "processor"
  | "security";

export type LegalDocumentStatus =
  | "draft"
  | "review"
  | "published"
  | "deprecated"
  | "archived"
  | "suspended";

export type LegalDocumentCategory =
  | "terms"
  | "privacy"
  | "security"
  | "developer"
  | "simulation"
  | "brand"
  | "operations";

export type LegalDocumentDefinition = {
  documentKey: string;
  title: string;
  category: LegalDocumentCategory;
  audience: LegalDocumentAudience;
  status: Extract<LegalDocumentStatus, "published">;
  version: string;
  effectiveFrom: string;
  reviewedAt: string | null;
  reviewerLabel: string;
  isRequired: boolean;
  requiresAcceptance: boolean;
  legalReviewRequired: boolean;
  professionalReviewRequired: boolean;
  summary: string;
  sourceRefs: {
    label: string;
    url: string;
  }[];
  changeNotes: string;
  disclaimers: string[];
  bodyMd: string;
};

export type SubprocessorStatus =
  | "configured"
  | "not_configured"
  | "review_required";

export type SubprocessorRecord = {
  provider: string;
  purpose: string;
  dataCategories: string[];
  region: string;
  status: SubprocessorStatus;
  notes: string;
  legalReviewRequired: boolean;
};

export const LEGAL_DOCUMENT_VERSION = "2026.05.14";
export const LEGAL_EFFECTIVE_FROM = "2026-05-14";
export const LEGAL_REVIEWER_LABEL = "Professional legal review required";

const standardSourceRefs = [
  {
    label: "Invoice Lantern product boundaries",
    url: "https://invoice-lantern.example/legal/boundaries"
  }
];

const standardDisclaimers = [
  "This document is a product policy draft and is not legal advice.",
  "Professional legal, tax, accounting, and privacy review is required before public launch.",
  "Invoice Lantern is independent and is not affiliated with EU institutions, national tax authorities, OpenPeppol, Peppol authorities, or standards bodies."
];

function legalDocument(
  input: Omit<
    LegalDocumentDefinition,
    | "status"
    | "version"
    | "effectiveFrom"
    | "reviewedAt"
    | "reviewerLabel"
    | "legalReviewRequired"
    | "professionalReviewRequired"
    | "sourceRefs"
    | "disclaimers"
  > & {
    sourceRefs?: LegalDocumentDefinition["sourceRefs"];
    disclaimers?: string[];
  }
): LegalDocumentDefinition {
  return {
    ...input,
    status: "published",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveFrom: LEGAL_EFFECTIVE_FROM,
    reviewedAt: null,
    reviewerLabel: LEGAL_REVIEWER_LABEL,
    legalReviewRequired: true,
    professionalReviewRequired: true,
    sourceRefs: input.sourceRefs ?? standardSourceRefs,
    disclaimers: input.disclaimers ?? standardDisclaimers
  };
}

export const legalDocumentRegistry = [
  legalDocument({
    documentKey: "terms",
    title: "Terms of Service",
    category: "terms",
    audience: "public",
    isRequired: true,
    requiresAcceptance: true,
    summary:
      "Service terms for independent technical e-invoice validation and readiness sandbox use.",
    changeNotes:
      "Initial versioned policy draft for account, workspace, API, simulation, and reliance boundaries.",
    bodyMd: `
## Service Description
Invoice Lantern is an independent, educational, technical, standards-based, source-linked, versioned, simulation-focused, GDPR-aware, secure-by-design, API-first, mobile-first e-invoice validation and ViDA-readiness sandbox.

## Independent Status
Invoice Lantern is not official EU software, not European Commission software, not national tax authority software, not OpenPeppol software, and not Peppol authority software. It does not provide official filing, authority submission, VAT return submission, or certified compliance.

## Account And Workspace Responsibility
Users are responsible for account security, workspace membership, uploaded data, API keys, webhook endpoints, invoice records, and professional review of outputs before business reliance.

## Linked Policies
Use is also subject to the Acceptable Use Policy, API Terms, Webhook Simulator Notice, Privacy Policy, Cookie Policy, Data Retention Policy, and the technical notices for ViDA, VIES, country packs, XML, XSD, and Schematron.

## Reliance Boundary
Validation results, rule-pack simulations, VIES evidence, ViDA readiness signals, XML checks, API responses, exports, and webhook events are informational technical outputs only. They are not legal, tax, accounting, financial, professional, official filing, authority acceptance, or compliance advice.

## Suspension And Abuse Controls
Invoice Lantern may limit, suspend, or refuse access for abuse, attempted bypass of rate limits, unsafe XML behavior, webhook abuse, unlawful content, security probing outside allowed disclosure rules, or conduct that risks platform integrity.

## Changes
Published versions may change over time. Version metadata, effective dates, and acceptance records help show which policy version was available or accepted.

## Contact Placeholder
Operational, legal, privacy, and security contact details require professional business and legal review before production launch.
`.trim()
  }),
  legalDocument({
    documentKey: "privacy",
    title: "Privacy Policy",
    category: "privacy",
    audience: "public",
    isRequired: true,
    requiresAcceptance: true,
    summary:
      "GDPR-aware product privacy policy draft for account, workspace, invoice, API, XML, VIES, webhook, and audit data.",
    changeNotes:
      "Initial privacy policy draft aligned to export, deletion, retention, data-map, and subprocessor controls.",
    bodyMd: `
## Positioning
This Privacy Policy is a product policy draft. Controller and processor roles depend on the final operating entity, customer contracts, deployment model, and professional privacy review.

## Data Categories
Invoice Lantern may process account data, workspace membership data, organization settings, invoice and customer data, contacts, business profiles, canonical invoice data, XML job metadata, validation reports, VAT format checks, VIES evidence metadata, ViDA simulation runs, webhook endpoint metadata, webhook delivery logs, API request metadata, privacy requests, export packages, retention/deletion run metadata, legal acceptance records, and security/audit events.

## Invoice And Customer Data
Invoice records can include seller, buyer, contact, VAT, address, line, tax, allowance, charge, payment, and canonical invoice fields. Money logic should remain decimal-string based inside the canonical model.

## API, XML, VIES, And Webhook Data
API logs are metadata-oriented and should not store request bodies, full API keys, API key hashes, raw XML, raw SOAP, or secrets. VIES evidence is time-of-check evidence only and stores no raw SOAP. XML systems should store hashes and technical summaries unless a future reviewed setting explicitly allows retained raw XML.

## Rights And Requests
Workspace privacy requests support access, export, deletion, correction, objection, restriction, portability, and other request workflows. These controls support responsible handling and do not guarantee legal deadline handling without configured legal review.

## Retention And Deletion
Retention settings, preview runs, deletion runs, and export packages are workspace controls. They do not determine statutory accounting, tax, or legal retention duties.

## Subprocessors
The Subprocessor List identifies configured, not configured, or review-required providers based on project configuration and must be reviewed before production launch.
`.trim()
  }),
  legalDocument({
    documentKey: "cookies",
    title: "Cookie Policy",
    category: "privacy",
    audience: "public",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "Essential-cookie and non-essential tracking stance for the current product surface.",
    changeNotes:
      "Initial cookie and tracking stance: essential auth/session storage only unless future opt-in tooling is explicitly added.",
    bodyMd: `
## Current Stance
Invoice Lantern is designed to use only essential authentication, security, session, preference, and workspace routing cookies or browser storage needed to operate the product.

## Non-Essential Tracking
No non-essential analytics, advertising, behavioral tracking, or third-party marketing cookies are introduced by this policy. If a future implementation adds non-essential tracking, it must be explicit, documented, reviewed, and controlled by a preference workflow.

## Preferences
Cookie preferences should store only minimal preference data and should not collect unnecessary personal data.
`.trim()
  }),
  legalDocument({
    documentKey: "dpa",
    title: "Data Processing Addendum",
    category: "privacy",
    audience: "processor",
    isRequired: true,
    requiresAcceptance: true,
    summary:
      "Processor/controller role draft for customer invoice data, workspace data, subprocessors, security, export, deletion, and incident cooperation.",
    changeNotes:
      "Initial DPA draft requiring professional legal review before external customer use.",
    bodyMd: `
## Draft Role Model
For customer invoice and customer data, a user organization may act as controller and Invoice Lantern may act as processor where the final contract and operating model say so. Invoice Lantern may act as controller for account, security, abuse-prevention, billing if later implemented, and operational data where applicable.

## Processing Subject Matter
Processing supports e-invoice validation, UBL/XML parsing and export, technical validation reports, country rule-pack simulation, ViDA readiness simulation, VAT/VIES evidence workflows, webhook testing, developer API use, export, deletion, retention, and audit support.

## Security Measures
Security measures include role-based access, tenant isolation, RLS assumptions, API key hashing and scopes, webhook signing, XML safety controls, safe logging, retention/deletion workflows, and secret separation.

## Subprocessors
Subprocessor use must be listed, reviewed, and kept current. Not-configured providers must not be presented as active processors.

## Deletion And Export Support
The platform provides export, retention, deletion, and privacy request tooling. These controls support responsible handling but do not replace professional legal or privacy review.
`.trim()
  }),
  legalDocument({
    documentKey: "acceptable-use",
    title: "Acceptable Use Policy",
    category: "terms",
    audience: "public",
    isRequired: true,
    requiresAcceptance: true,
    summary:
      "Use restrictions covering unlawful use, official impersonation, scraping, malware, API keys, rate limits, XML, and webhook abuse.",
    changeNotes: "Initial acceptable-use policy draft.",
    bodyMd: `
## Prohibited Use
Do not use Invoice Lantern for unlawful activity, official filing impersonation, authority impersonation, malware, credential theft, unauthorized scraping, spam, abusive automation, unsafe XML payloads, attempts to bypass rate limits, or attempts to weaken tenant isolation.

## API Keys And Webhooks
Do not share API keys, publish secrets, send secrets in webhook payloads, attack webhook endpoints, or use the simulator as evidence of authority acceptance.

## Uploads
Do not upload illegal data, malicious XML, files designed to trigger entity expansion, external fetching, unsafe parser behavior, or content unrelated to legitimate technical invoice validation.
`.trim()
  }),
  legalDocument({
    documentKey: "security",
    title: "Security Policy",
    category: "security",
    audience: "security",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "Security posture summary covering contacts, API keys, webhook signing, XML safety, audit logs, and disclosure linkage.",
    changeNotes: "Initial security policy draft.",
    bodyMd: `
## Security Contact
Security contact details require final business review before launch. Until then, contact fields are placeholders.

## Security Controls
Invoice Lantern is designed around tenant isolation, role-based access, API key hashing and scoping, safe rate limits, webhook signing, XML DTD and external entity protections, restricted service-role usage, and audit/activity logging.

## Secrets
Service-role keys, database URLs, API signing secrets, webhook secrets, private tokens, VIES credentials, and email provider keys must not be exposed to clients, logs, examples, or exports.

## Vulnerability Disclosure
Reports should follow the Vulnerability Disclosure Policy and avoid destructive testing, data access, persistence, or service disruption.
`.trim()
  }),
  legalDocument({
    documentKey: "disclaimer",
    title: "Disclaimer And No Tax Advice Notice",
    category: "terms",
    audience: "public",
    isRequired: true,
    requiresAcceptance: false,
    summary:
      "Consolidated no-advice, non-official, no-certification, no-filing, and professional-review boundary.",
    changeNotes: "Initial consolidated disclaimer.",
    bodyMd: `
## No Advice Or Official Status
Invoice Lantern does not provide legal, tax, accounting, financial, professional, official filing, authority submission, Peppol certification, EN 16931 certification, ViDA compliance, VAT return submission, or authority acceptance services.

## Technical Outputs Only
XSD checks, Schematron checks, VIES evidence, ViDA simulations, country packs, API responses, PDF reports, UBL exports, and webhook events are technical or educational outputs. They are not final determinations and do not guarantee correctness.

## Professional Review Required
Users must obtain qualified professional review before relying on outputs for legal, tax, accounting, privacy, filing, or authority-facing decisions.
`.trim()
  }),
  legalDocument({
    documentKey: "subprocessors",
    title: "Subprocessor List",
    category: "privacy",
    audience: "public",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "Structured list of configured, not configured, and review-required providers based on current project configuration.",
    changeNotes: "Initial subprocessor list draft.",
    bodyMd: `
## Review Status
This list is a product-policy draft and must be reviewed against the final deployment, contracts, data regions, and vendor configuration.

## Active And Candidate Providers
The API exposes a structured subprocessor list. Providers marked not configured or review required must not be treated as active subprocessors.
`.trim()
  }),
  legalDocument({
    documentKey: "retention",
    title: "Data Retention Policy",
    category: "privacy",
    audience: "workspace",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "Retention policy draft for invoices, validation reports, XML metadata, API logs, webhook logs, VIES evidence, audit logs, deletion requests, and configurable workspace retention.",
    changeNotes:
      "Initial retention policy integrated with workspace privacy settings, preview runs, and deletion workflows.",
    bodyMd: `
## Configurable Retention
Workspace settings can define retention windows for invoice drafts, validation reports, XML reports/jobs, invoice export metadata, API request logs, webhook delivery logs, VIES evidence, ViDA simulation runs, activity logs, privacy requests, retention runs, deletion runs, and legal acceptance records where supported.

## Preservation
Security, audit, legal acceptance, privacy request, retention, and deletion records may be preserved or minimized where appropriate. Retention tooling does not determine statutory accounting, tax, legal, or filing obligations.

## Data Types
Draft invoices, production invoices, validation reports, uploaded XML metadata, XML validation jobs, API logs, webhook delivery logs, VIES evidence, ViDA runs, country/rule lifecycle metadata, privacy requests, export packages, and deletion/retention run reports each require review before final retention periods are set.
`.trim()
  }),
  legalDocument({
    documentKey: "incident-response",
    title: "Incident Response Policy",
    category: "security",
    audience: "security",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "Incident response lifecycle draft: detect, classify, contain, investigate, notify if required, fix, document, and review.",
    changeNotes: "Initial incident response policy draft.",
    bodyMd: `
## Lifecycle
Incident response should detect, classify severity, contain, investigate, notify where legally required, fix, document evidence, and complete a post-incident review.

## Privacy And Security Records
Security and audit records should be handled with data minimization. They may need preservation to support platform integrity and incident review.

## Contact Placeholder
Security and privacy escalation contacts require final operational and legal review.
`.trim()
  }),
  legalDocument({
    documentKey: "vulnerability-disclosure",
    title: "Vulnerability Disclosure Policy",
    category: "security",
    audience: "security",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "Responsible vulnerability disclosure draft with allowed boundaries and prohibited actions.",
    changeNotes: "Initial vulnerability disclosure policy draft.",
    bodyMd: `
## Allowed Testing Boundary
Report suspected vulnerabilities with enough detail to reproduce safely. Testing must avoid unauthorized data access, persistence, destructive activity, social engineering, denial of service, credential harvesting, or bypassing user consent.

## Safe Harbor Draft
Any safe-harbor wording is a draft placeholder and requires professional legal review before public launch.

## Reporting Channel
A reporting channel placeholder must be replaced with a reviewed security contact before production launch.
`.trim()
  }),
  legalDocument({
    documentKey: "trademark",
    title: "Trademark And Brand Disclaimer",
    category: "brand",
    audience: "public",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "Invoice Lantern identity and third-party mark/no-endorsement disclaimer.",
    changeNotes: "Initial brand disclaimer.",
    bodyMd: `
## Product Identity
The public product name is Invoice Lantern.

## No Affiliation Or Endorsement
Invoice Lantern is not affiliated with, endorsed by, certified by, or operated by EU institutions, the European Commission, national tax authorities, OpenPeppol, Peppol authorities, or standards bodies.

## Third-Party Marks
Third-party marks, standards names, country names, and provider names belong to their respective owners. References are descriptive and do not imply endorsement.
`.trim()
  }),
  legalDocument({
    documentKey: "api-terms",
    title: "API Terms",
    category: "developer",
    audience: "developer",
    isRequired: true,
    requiresAcceptance: true,
    summary:
      "Developer API terms for sandbox keys, scopes, rate limits, webhook testing, no filing, no advice, and abuse controls.",
    changeNotes: "Initial API terms draft.",
    bodyMd: `
## Sandbox API
The Invoice Lantern API is for technical validation, XML handling, VAT checks, ViDA simulations, rule reads, and developer testing. It is not official filing software, authority submission software, or a compliance guarantee.

## API Key Responsibility
API keys must be scoped, protected, rotated when needed, and never exposed in clients, logs, public repositories, docs, screenshots, or exports. Full keys are shown once only.

## Rate Limits
Rate limits protect the sandbox. They are not an SLA and must not be bypassed.

## Reliance Boundary
API responses are technical outputs only and are not legal, tax, accounting, filing, Peppol, EN 16931, ViDA, or authority determinations.
`.trim()
  }),
  legalDocument({
    documentKey: "country-rule-pack-disclaimer",
    title: "Country Rule Pack Disclaimer",
    category: "simulation",
    audience: "workspace",
    isRequired: false,
    requiresAcceptance: true,
    summary:
      "Source-linked country-pack simulation boundary: educational, versioned, changing, and professional-review required.",
    changeNotes: "Initial country-pack disclaimer.",
    bodyMd: `
## Simulation Only
Country rule packs are source-linked educational simulations and technical readiness context. They are not official national tax guidance and do not provide national legal or tax advice.

## Change And Review
National rules may change, source coverage may be incomplete, and unknown fields require review. Country-pack warnings require professional review before business reliance.
`.trim()
  }),
  legalDocument({
    documentKey: "webhook-simulator-notice",
    title: "Webhook Simulator Terms And Integration Notice",
    category: "developer",
    audience: "developer",
    isRequired: false,
    requiresAcceptance: true,
    summary:
      "Webhook simulator terms for signed sandbox test events, delivery logs, bounded retries, safe endpoints, and no authority acceptance.",
    changeNotes: "Initial webhook simulator notice.",
    bodyMd: `
## Signed Sandbox Events
Webhook simulator events are signed sandbox test events for integration testing only.

## Delivery Logs
Delivery logs are technical integration logs. They do not represent official filing, authority success, authority failure, downstream legal acceptance, or compliance evidence.

## Payload Safety
Do not include secrets in webhook payloads. Endpoint secrets are protected and must not be exported or displayed in raw form.
`.trim()
  }),
  legalDocument({
    documentKey: "vida-simulator-notice",
    title: "ViDA Simulator Notice",
    category: "simulation",
    audience: "public",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "ViDA-readiness simulation notice: source-linked, contextual, not official determination, professional review required.",
    changeNotes: "Initial ViDA simulator notice.",
    bodyMd: `
## Readiness Simulation Only
ViDA outputs are educational and technical readiness simulations. They are not official ViDA determinations, not legal advice, not tax advice, not accounting advice, not filing software, and not a compliance guarantee.

## Context
Dates, countries, transaction classes, country-pack versions, source labels, and evidence context can affect readiness signals and require professional review.
`.trim()
  }),
  legalDocument({
    documentKey: "vies-evidence-notice",
    title: "VIES Evidence Notice",
    category: "simulation",
    audience: "public",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "VIES evidence notice: time-of-check evidence, availability limits, no tax compliance proof.",
    changeNotes: "Initial VIES evidence notice.",
    bodyMd: `
## Time Of Check
VIES evidence is time-of-check evidence only. Availability, national systems, response timing, and downstream facts can change.

## Format Versus VIES
A format-valid VAT number is not VIES-valid. A VIES-valid response is not proof of transaction compliance, tax treatment, legal status, or accounting treatment.

## Storage
Invoice Lantern should not store raw VIES SOAP responses. Evidence records store safe metadata and hashes.
`.trim()
  }),
  legalDocument({
    documentKey: "xml-xsd-schematron-notice",
    title: "XML, XSD, And Schematron Technical Validation Notice",
    category: "simulation",
    audience: "public",
    isRequired: false,
    requiresAcceptance: false,
    summary:
      "Technical XML validation boundary: safe parsing, local XSD worker path, guarded Schematron gates, no official certification.",
    changeNotes: "Initial XML/XSD/Schematron notice.",
    bodyMd: `
## Technical Validation Only
XML inspection, UBL parsing, local XSD validation, and guarded Schematron execution are technical checks only. They are not official certification, not Peppol certification, not EN 16931 certification, and not authority acceptance.

## Safety
XML processing must block DTDs, external entities, external schema fetching, unsafe paths, excessive size or nesting, entity expansion, and unsafe remote fetching.

## Findings
Findings should be sanitized technical summaries and should not expose raw XML, Schematron file contents, full local paths, secrets, or unsafe payloads.
`.trim()
  })
] as const satisfies readonly LegalDocumentDefinition[];

export const REQUIRED_LEGAL_DOCUMENT_KEYS = legalDocumentRegistry
  .filter((document) => document.requiresAcceptance)
  .map((document) => document.documentKey);

export const subprocessorRegistry: SubprocessorRecord[] = [
  {
    provider: "Supabase",
    purpose: "Authentication, database, row-level security, and optional storage infrastructure when Supabase is configured.",
    dataCategories: [
      "account data",
      "workspace metadata",
      "invoice records",
      "validation metadata",
      "privacy workflow records",
      "audit metadata"
    ],
    region: "Deployment-specific; final project region requires review.",
    status: "configured",
    notes:
      "The project uses Supabase client/server libraries and migrations. Final subprocessors, region, and DPA terms require professional review.",
    legalReviewRequired: true
  },
  {
    provider: "Hosting provider",
    purpose: "Application hosting and API execution.",
    dataCategories: ["request metadata", "application logs", "workspace traffic"],
    region: "Not finalized in repository configuration.",
    status: "review_required",
    notes:
      "No final production hosting provider is established by repository code alone. Review deployment configuration before publication.",
    legalReviewRequired: true
  },
  {
    provider: "Email provider",
    purpose: "Transactional email if future product email workflows are configured.",
    dataCategories: ["email address", "message metadata"],
    region: "Not configured.",
    status: "not_configured",
    notes:
      "No active email provider is configured in the inspected project files for this step.",
    legalReviewRequired: true
  },
  {
    provider: "Error monitoring provider",
    purpose: "Runtime error monitoring if future monitoring is explicitly configured.",
    dataCategories: ["technical error metadata", "request context"],
    region: "Not configured.",
    status: "not_configured",
    notes:
      "No active Sentry or equivalent provider is configured in the inspected project files for this step.",
    legalReviewRequired: true
  }
];

export function listPublishedLegalDocuments() {
  return [...legalDocumentRegistry].sort((first, second) =>
    first.title.localeCompare(second.title)
  );
}

export function getPublishedLegalDocument(documentKey: string) {
  return (
    legalDocumentRegistry.find(
      (document) => document.documentKey === documentKey
    ) ?? null
  );
}
