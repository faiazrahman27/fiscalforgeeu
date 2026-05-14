import { subprocessorRegistry } from "../legal/legal-document-registry.js";

export type DataMinimizationMode = "standard" | "reduced" | "strict";

export type PrivacyDataMapRecord = {
  datasetKey: string;
  dataCategory: string;
  purpose: string;
  tableOrSource: string;
  defaultRetentionDays: number | null;
  exportable: boolean;
  deletable: boolean;
  anonymizable: boolean;
  rawPayloadStored: boolean;
  userFacingDescription: string;
  riskNote: string;
  legalReviewRequired: boolean;
};

export type CookieTrackingStance = {
  stance: "essential_only";
  essentialCookiesUsed: boolean;
  nonEssentialCookiesUsed: boolean;
  analyticsConfigured: boolean;
  preferenceStorage: "minimal";
  summary: string;
  legalReviewRequired: boolean;
};

export const PRIVACY_CONTROL_DISCLAIMER =
  "Invoice Lantern provides GDPR-aware privacy-support controls, data minimization metadata, export support, deletion support, retention support, and request workflow support. These controls are not legal advice, not privacy advice, not a GDPR compliance guarantee, and require professional review before production reliance.";

export const cookieTrackingStance: CookieTrackingStance = {
  stance: "essential_only",
  essentialCookiesUsed: true,
  nonEssentialCookiesUsed: false,
  analyticsConfigured: false,
  preferenceStorage: "minimal",
  summary:
    "Current product code is documented as essential auth/session/preference storage only. No non-essential analytics, advertising, or behavioral tracking cookies are added by this implementation step.",
  legalReviewRequired: true
};

export const privacyDataMap: PrivacyDataMapRecord[] = [
  {
    datasetKey: "workspace_settings",
    dataCategory: "workspace privacy settings",
    purpose: "Store retention, export, deletion, minimization, and contact preferences.",
    tableOrSource: "workspace_settings",
    defaultRetentionDays: null,
    exportable: true,
    deletable: false,
    anonymizable: false,
    rawPayloadStored: false,
    userFacingDescription:
      "Workspace-level privacy and retention configuration managed by owners/admins.",
    riskNote:
      "Settings affect data lifecycle behavior and require owner/admin review.",
    legalReviewRequired: true
  },
  {
    datasetKey: "privacy_requests",
    dataCategory: "privacy workflow records",
    purpose:
      "Track access, export, deletion, correction, objection, restriction, portability, and other request workflows.",
    tableOrSource: "workspace_privacy_requests, privacy_request_events",
    defaultRetentionDays: 1095,
    exportable: true,
    deletable: false,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "Privacy request history and review status for workspace-controlled requests.",
    riskNote:
      "Review notes should stay minimal and should not contain legal advice or unnecessary personal data.",
    legalReviewRequired: true
  },
  {
    datasetKey: "invoice_data",
    dataCategory: "invoice and customer data",
    purpose:
      "Support canonical invoice records, validation, lifecycle, UBL export, country-pack simulation, and ViDA-readiness simulation.",
    tableOrSource:
      "invoice_drafts, invoices, invoice_lines, invoice_taxes, invoice_allowances, invoice_charges, business_profiles, contacts",
    defaultRetentionDays: 365,
    exportable: true,
    deletable: true,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "Structured invoice, seller, buyer, contact, line, tax, and lifecycle data.",
    riskNote:
      "Invoices can include customer and VAT data. Retention duties may be legal/accounting-specific and require review.",
    legalReviewRequired: true
  },
  {
    datasetKey: "validation_reports",
    dataCategory: "technical validation reports",
    purpose:
      "Store technical findings, calculation summaries, country simulation warnings, ViDA readiness context, and report metadata.",
    tableOrSource: "validation_runs, validation findings payloads",
    defaultRetentionDays: 365,
    exportable: true,
    deletable: true,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "Technical validation report records and sanitized findings.",
    riskNote:
      "Reports can reference invoice data and must not be described as official or compliance-certified.",
    legalReviewRequired: true
  },
  {
    datasetKey: "xml_metadata",
    dataCategory: "XML upload and validation metadata",
    purpose:
      "Inspect XML structure, store hashes, extracted summaries, worker state, and sanitized findings.",
    tableOrSource: "xml_readiness_reports, xml_validation_jobs, transient XML payload store",
    defaultRetentionDays: 180,
    exportable: true,
    deletable: true,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "XML readiness and validation-job metadata without intentionally retained raw XML.",
    riskNote:
      "Raw XML can contain personal/business data and must remain transient unless a future reviewed policy explicitly allows retention.",
    legalReviewRequired: true
  },
  {
    datasetKey: "api_logs",
    dataCategory: "developer API request metadata",
    purpose:
      "Support scoped API key diagnostics, abuse control, rate-limit review, and operational troubleshooting.",
    tableOrSource: "api_requests, api_keys metadata",
    defaultRetentionDays: 180,
    exportable: true,
    deletable: true,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "API request metadata, status, duration, path, key prefix/name, and safe error codes.",
    riskNote:
      "Request bodies, XML payloads, API key hashes, and full keys must not be exported or logged.",
    legalReviewRequired: true
  },
  {
    datasetKey: "webhook_logs",
    dataCategory: "webhook simulator metadata",
    purpose:
      "Support signed sandbox test events, delivery debugging, retry review, and endpoint lifecycle management.",
    tableOrSource: "webhook_endpoints, webhook_deliveries",
    defaultRetentionDays: 180,
    exportable: true,
    deletable: true,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "Webhook endpoint metadata and redacted delivery logs for sandbox integration testing.",
    riskNote:
      "Signing secrets and encrypted secret material must never be exposed in exports or UI.",
    legalReviewRequired: true
  },
  {
    datasetKey: "vies_evidence",
    dataCategory: "VAT/VIES evidence metadata",
    purpose:
      "Store explicit VIES time-of-check evidence metadata and local VAT format check history.",
    tableOrSource: "vat_number_checks, vies_evidence_checks",
    defaultRetentionDays: 365,
    exportable: true,
    deletable: true,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "VAT format checks and VIES evidence metadata without raw SOAP.",
    riskNote:
      "VIES-valid is not proof of transaction compliance or tax treatment.",
    legalReviewRequired: true
  },
  {
    datasetKey: "vida_simulations",
    dataCategory: "ViDA simulation runs",
    purpose:
      "Store source-linked educational ViDA-readiness simulation inputs, normalized context, findings, and outputs.",
    tableOrSource: "vida_simulation_runs",
    defaultRetentionDays: 365,
    exportable: true,
    deletable: true,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "Saved ViDA-readiness simulation runs and source-linked findings.",
    riskNote:
      "Simulation outputs are not official determinations or compliance guarantees.",
    legalReviewRequired: true
  },
  {
    datasetKey: "legal_acceptances",
    dataCategory: "legal document acceptance records",
    purpose:
      "Track user/workspace acceptance of versioned legal documents and developer notices.",
    tableOrSource: "legal_document_acceptances",
    defaultRetentionDays: null,
    exportable: true,
    deletable: false,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "Versioned policy acceptance records with hashed IP/user-agent evidence only when captured.",
    riskNote:
      "Acceptance records should not store raw IP addresses, raw user agents, or legal advice.",
    legalReviewRequired: true
  },
  {
    datasetKey: "activity_security_audit",
    dataCategory: "activity and security audit metadata",
    purpose:
      "Support accountability, abuse investigation, security review, and privacy workflow evidence.",
    tableOrSource:
      "workspace_activity_events, security_events, workspace_privacy_audit_events, platform lifecycle events",
    defaultRetentionDays: 365,
    exportable: true,
    deletable: false,
    anonymizable: true,
    rawPayloadStored: false,
    userFacingDescription:
      "Activity, privacy, and security event metadata with minimized payloads.",
    riskNote:
      "Security/audit logs may need preservation. Metadata must stay minimal and secret-free.",
    legalReviewRequired: true
  }
];

export function getPrivacyDataMap() {
  return {
    generatedAt: new Date().toISOString(),
    disclaimer: PRIVACY_CONTROL_DISCLAIMER,
    records: privacyDataMap
  };
}

export function getSubprocessorList() {
  return {
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Subprocessor information is a product-policy draft based on current project configuration. Final provider status, region, DPA, and transfer analysis require professional review.",
    records: subprocessorRegistry
  };
}

export function getCookieTrackingStance() {
  return {
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Cookie and tracking information reflects the current implementation stance. It is not legal advice and requires review before production launch.",
    record: cookieTrackingStance
  };
}
