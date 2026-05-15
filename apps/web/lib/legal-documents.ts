export type PublicLegalDocument = {
  documentKey: string;
  title: string;
  category: string;
  audience: string;
  status: "published";
  version: string;
  effectiveFrom: string;
  legalReviewRequired: boolean;
  professionalReviewRequired: boolean;
  requiresAcceptance: boolean;
  summary: string;
  bodyMd: string;
  disclaimers: string[];
  changeNotes: string;
};

const LEGAL_SAFE_NOTICE =
  "This platform policy text is informational product copy for Invoice Lantern. It is not legal, tax, accounting, privacy, financial, professional, official filing, authority, OpenPeppol, Peppol authority, European Commission, EU, or standards-body advice or certification. Professional legal and privacy review is required before production reliance.";

export const LEGAL_DOCUMENT_ALIASES: Record<string, string> = {
  "terms-of-service": "terms",
  "privacy-policy": "privacy",
  "cookie-policy": "cookies",
  "data-processing-addendum": "dpa",
  "acceptable-use-policy": "acceptable-use",
  "security-policy": "security",
  "disclaimer-no-tax-advice": "disclaimer",
  "subprocessor-list": "subprocessors",
  "data-retention-policy": "retention",
  "incident-response-policy": "incident-response",
  "vulnerability-disclosure-policy": "vulnerability-disclosure",
  "trademark-brand-disclaimer": "trademark",
  "webhook-simulator-terms": "webhook-simulator-notice",
  "xml-xsd-schematron-validation-notice": "xml-xsd-schematron-notice"
};

export const ACCOUNT_LEGAL_DOCUMENT_KEYS = [
  "terms",
  "privacy",
  "cookies",
  "acceptable-use",
  "disclaimer"
] as const;

export type AccountLegalDocumentKey =
  (typeof ACCOUNT_LEGAL_DOCUMENT_KEYS)[number];

export const ACCOUNT_LEGAL_DOCUMENT_LABELS: Record<
  AccountLegalDocumentKey,
  string
> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  cookies: "Cookie Policy",
  "acceptable-use": "Acceptable Use Policy",
  disclaimer: "Disclaimer / No Tax Advice / No Official Filing boundary"
};

export const ACCOUNT_LEGAL_DOCUMENT_VERSION = "2026.05.14";

export function canonicalizeLegalDocumentKey(documentKey: string) {
  const cleanDocumentKey = documentKey.trim();

  return LEGAL_DOCUMENT_ALIASES[cleanDocumentKey] ?? cleanDocumentKey;
}

export function getLegalDocumentHref(documentKey: string) {
  return `/legal/${encodeURIComponent(canonicalizeLegalDocumentKey(documentKey))}`;
}

const fallbackLegalDocuments: PublicLegalDocument[] = [
  {
    documentKey: "terms",
    title: "Terms of Service",
    category: "platform",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "Product terms for independent technical sandbox use.",
    bodyMd:
      "## Independent sandbox terms\nInvoice Lantern provides educational, technical, non-official e-invoice validation and readiness tooling.\n\n## Professional review required\nUse of the platform does not create legal, tax, accounting, filing, privacy, authority, Peppol, EN 16931, or ViDA compliance certainty. Professional review is required.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial public terms notice."
  },
  {
    documentKey: "privacy",
    title: "Privacy Policy",
    category: "privacy",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "GDPR-aware privacy-support policy for workspace data.",
    bodyMd:
      "## GDPR-aware support\nInvoice Lantern provides privacy-support controls for data maps, exports, deletion reviews, retention reviews, and request workflows.\n\n## No compliance guarantee\nThese controls are not privacy advice, legal advice, or a GDPR compliance guarantee. Controller/processor positioning and notices require professional review.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial privacy policy notice."
  },
  {
    documentKey: "cookies",
    title: "Cookie Policy",
    category: "privacy",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: false,
    summary: "Essential-only cookie and tracking stance.",
    bodyMd:
      "## Essential-only stance\nCurrent product behavior is documented as essential auth/session/preference storage only.\n\n## Review required\nNo non-essential analytics, advertising, or behavioral tracking cookies are introduced by this implementation step. Final cookie notices require professional review.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial cookie notice."
  },
  {
    documentKey: "dpa",
    title: "Data Processing Addendum",
    category: "privacy",
    audience: "workspace",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "Review-required DPA placeholder for workspace processing roles.",
    bodyMd:
      "## Processing role review\nInvoice Lantern may support workspace processing workflows, but controller/processor roles, instructions, transfer terms, and subprocessors require professional review.\n\n## No legal finality\nThis notice is not a lawyer-approved DPA and does not guarantee GDPR compliance.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial DPA notice."
  },
  {
    documentKey: "acceptable-use",
    title: "Acceptable Use Policy",
    category: "security",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "Use boundaries for secure technical sandbox behavior.",
    bodyMd:
      "## Acceptable use\nUsers must avoid unlawful content, abusive automation, credential misuse, unsafe XML payloads, secret leakage, and attempts to bypass tenant isolation.\n\n## Sandbox boundary\nThe platform does not provide official filing or authority submission capability.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial acceptable-use notice."
  },
  {
    documentKey: "security",
    title: "Security Policy",
    category: "security",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: false,
    summary: "Secure-by-design policy posture and contact placeholder.",
    bodyMd:
      "## Secure-by-design posture\nInvoice Lantern uses scoped API keys, RBAC-aware workspace controls, XML safety limits, redaction, and tenant scoping as product security controls.\n\n## Professional review required\nThis is not a security certification or compliance guarantee.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial security notice."
  },
  {
    documentKey: "disclaimer",
    title: "Disclaimer / No Tax Advice Notice",
    category: "disclaimer",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "Explicit no legal, tax, accounting, filing, or official advice notice.",
    bodyMd:
      "## No professional advice\nInvoice Lantern validation results, exports, simulations, source links, and reports are informational technical outputs only.\n\n## No authority acceptance\nOutputs do not prove legal validity, tax treatment, accounting treatment, Peppol certification, EN 16931 compliance, ViDA compliance, official filing, or authority acceptance.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial disclaimer notice."
  },
  {
    documentKey: "subprocessors",
    title: "Subprocessor List",
    category: "privacy",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: false,
    summary: "Known/configured/review-required subprocessors only.",
    bodyMd:
      "## Subprocessor review\nSubprocessor entries reflect known, configured, not-configured, or review-required platform dependencies.\n\n## No approval guarantee\nProvider status, region, DPA terms, transfer analysis, and production approval require professional privacy and legal review.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial subprocessor notice."
  },
  {
    documentKey: "retention",
    title: "Data Retention Policy",
    category: "privacy",
    audience: "workspace",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "Workspace retention policy support and audit-preservation boundaries.",
    bodyMd:
      "## Retention support\nInvoice Lantern supports preview and execution workflows for selected tenant-owned datasets.\n\n## Preserved evidence\nLegal acceptance, privacy request, deletion, retention, audit, and security records may be preserved or minimized where appropriate. Statutory retention obligations require professional review.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial retention notice."
  },
  {
    documentKey: "incident-response",
    title: "Incident Response Policy",
    category: "security",
    audience: "workspace",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: false,
    summary: "Incident response posture for security and privacy events.",
    bodyMd:
      "## Incident handling\nInvoice Lantern tracks review-required incident response concepts for security and privacy events.\n\n## Review required\nNotification duties, timing, authority communications, and customer communications require professional legal/privacy review.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial incident response notice."
  },
  {
    documentKey: "vulnerability-disclosure",
    title: "Vulnerability Disclosure Policy",
    category: "security",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: false,
    summary: "Safe vulnerability reporting notice.",
    bodyMd:
      "## Responsible reporting\nSecurity researchers should avoid data access, disruption, persistence, exfiltration, destructive testing, and privacy-impacting activity.\n\n## No authorization expansion\nThis notice does not grant permission to bypass authentication, authorization, rate limits, tenant isolation, or legal restrictions.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial vulnerability disclosure notice."
  },
  {
    documentKey: "trademark",
    title: "Trademark / Brand Disclaimer",
    category: "disclaimer",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: false,
    summary: "Independent brand and no-affiliation notice.",
    bodyMd:
      "## Independent brand\nInvoice Lantern is an independent product name.\n\n## No affiliation\nReferences to EU, ViDA, VIES, Peppol, OpenPeppol, EN 16931, UBL, CII, national tax authorities, or standards are descriptive technical context only and do not imply endorsement, certification, approval, or affiliation.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial brand disclaimer."
  },
  {
    documentKey: "api-terms",
    title: "API Terms",
    category: "developer",
    audience: "developer",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "Developer API sandbox terms and scoped key boundary.",
    bodyMd:
      "## API sandbox boundary\nOrganization API keys provide scoped access to technical validation tools and never create official filing credentials.\n\n## Secret handling\nFull keys are shown once, stored hashed, and must not be logged or exposed. API outputs are not legal, tax, accounting, privacy, filing, or compliance advice.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial API terms."
  },
  {
    documentKey: "country-rule-pack-disclaimer",
    title: "Country Rule Pack Disclaimer",
    category: "simulation",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "Country-pack simulation boundary.",
    bodyMd:
      "## Country-pack simulations\nCountry rule packs provide source-linked educational context and review flags.\n\n## No national determination\nThey are not national tax authority guidance, legal advice, tax advice, filing advice, or compliance guarantees.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial country rule-pack notice."
  },
  {
    documentKey: "webhook-simulator-notice",
    title: "Webhook Simulator Terms / Integration Notice",
    category: "developer",
    audience: "developer",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "Webhook simulator and integration testing boundary.",
    bodyMd:
      "## Simulator events\nWebhook events are signed sandbox test events for integration testing.\n\n## No filing status\nWebhook delivery does not represent official filing, authority submission, downstream acceptance, legal advice, tax advice, accounting advice, or compliance evidence.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial webhook simulator notice."
  },
  {
    documentKey: "vida-simulator-notice",
    title: "ViDA Simulator Notice",
    category: "simulation",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "ViDA-readiness simulation boundary.",
    bodyMd:
      "## ViDA-readiness simulation\nViDA simulation outputs are educational, technical, and source-linked readiness context.\n\n## No official determination\nThey are not official ViDA determinations, legal obligations, filing software, tax advice, accounting advice, or compliance guarantees.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial ViDA simulator notice."
  },
  {
    documentKey: "vies-evidence-notice",
    title: "VIES Evidence Notice",
    category: "simulation",
    audience: "public",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "VIES time-of-check evidence boundary.",
    bodyMd:
      "## Time-of-check evidence\nVIES evidence records technical time-of-check status where configured.\n\n## No tax proof\nA format-valid VAT number is not VIES-valid, and a VIES-valid response is not proof of transaction compliance, tax treatment, legal status, or accounting treatment.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial VIES evidence notice."
  },
  {
    documentKey: "xml-xsd-schematron-notice",
    title: "XML/XSD/Schematron Technical Validation Notice",
    category: "technical",
    audience: "developer",
    status: "published",
    version: "2026.05.14",
    effectiveFrom: "2026-05-14",
    legalReviewRequired: true,
    professionalReviewRequired: true,
    requiresAcceptance: true,
    summary: "Technical XML validation boundary.",
    bodyMd:
      "## Technical validation\nUBL XSD and Schematron checks are guarded technical checks that may be not configured, disabled, unsupported, unsafe, or preflight-only.\n\n## No certification\nThey do not certify Peppol, EN 16931, legal validity, tax treatment, accounting treatment, filing readiness, authority acceptance, or compliance.",
    disclaimers: [LEGAL_SAFE_NOTICE],
    changeNotes: "Initial XML technical validation notice."
  }
];

function apiBaseUrl() {
  return process.env.INVOICE_LANTERN_API_BASE_URL?.trim() ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLegalDocument(value: unknown): PublicLegalDocument | null {
  if (!isRecord(value)) {
    return null;
  }

  const documentKey =
    typeof value.documentKey === "string" ? value.documentKey.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";

  if (!documentKey || !title) {
    return null;
  }

  const fallback =
    fallbackLegalDocuments.find(
      (document) => document.documentKey === documentKey
    ) ?? fallbackLegalDocuments[0]!;

  return {
    documentKey,
    title,
    category:
      typeof value.category === "string" ? value.category : fallback.category,
    audience:
      typeof value.audience === "string" ? value.audience : fallback.audience,
    status: "published",
    version:
      typeof value.version === "string" ? value.version : fallback.version,
    effectiveFrom:
      typeof value.effectiveFrom === "string"
        ? value.effectiveFrom
        : fallback.effectiveFrom,
    legalReviewRequired: value.legalReviewRequired !== false,
    professionalReviewRequired: value.professionalReviewRequired !== false,
    requiresAcceptance: value.requiresAcceptance === true,
    summary:
      typeof value.summary === "string" ? value.summary : fallback.summary,
    bodyMd:
      typeof value.bodyMd === "string" ? value.bodyMd : fallback.bodyMd,
    disclaimers: Array.isArray(value.disclaimers)
      ? value.disclaimers.filter(
          (item): item is string => typeof item === "string"
        )
      : fallback.disclaimers,
    changeNotes:
      typeof value.changeNotes === "string"
        ? value.changeNotes
        : fallback.changeNotes
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<unknown>;
}

export async function listPublicLegalDocuments() {
  const baseUrl = apiBaseUrl();

  if (!baseUrl) {
    return fallbackLegalDocuments;
  }

  const data = await fetchJson(`${baseUrl}/api/v1/legal/documents`).catch(
    () => null
  );

  if (!isRecord(data) || !Array.isArray(data.documents)) {
    return fallbackLegalDocuments;
  }

  const documents = data.documents
    .map((item) => normalizeLegalDocument(item))
    .filter((item): item is PublicLegalDocument => item !== null);

  return documents.length > 0 ? documents : fallbackLegalDocuments;
}

export async function getPublicLegalDocument(documentKey: string) {
  const cleanDocumentKey = canonicalizeLegalDocumentKey(documentKey);
  const baseUrl = apiBaseUrl();

  if (baseUrl) {
    const data = await fetchJson(
      `${baseUrl}/api/v1/legal/documents/${encodeURIComponent(cleanDocumentKey)}`
    ).catch(() => null);

    if (isRecord(data)) {
      const document = normalizeLegalDocument(data.document);

      if (document) {
        return document;
      }
    }
  }

  return (
    fallbackLegalDocuments.find(
      (document) => document.documentKey === cleanDocumentKey
    ) ?? null
  );
}
