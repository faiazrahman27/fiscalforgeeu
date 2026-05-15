import type {
  ApiControl,
  ApiEventPreview,
  DeveloperEndpointPreview,
  InvoiceDraft,
  InvoiceEditorDraft,
  InvoiceStage,
  PrivacyControl,
  RetentionPolicyRow,
  SelectOption,
  ValidationFindingPreview,
  ValidationRunLayer,
  WorkspaceAction,
  WorkspaceAlert,
  WorkspaceMapCard,
  WorkspaceStat
} from "./types";

export const commandStats: WorkspaceStat[] = [];

export const commandFlow: WorkspaceAction[] = [
  {
    iconKey: "invoice",
    title: "Create invoice data",
    description:
      "Start with structured invoice fields, buyer and seller profiles, line items, payment details, and VAT breakdowns.",
    href: "/workspace/invoices"
  },
  {
    iconKey: "validation",
    title: "Review validation reports",
    description:
      "Inspect schema readiness, decimal calculations, VAT-number format, UBL mapping, standard-style findings, confidence labels, and simulation warnings.",
    href: "/workspace/validation-runs"
  },
  {
    iconKey: "developer",
    title: "Test API behavior",
    description:
      "Review endpoint behavior, API key boundaries, webhook events, scopes, and request-log planning.",
    href: "/workspace/developer"
  },
  {
    iconKey: "privacy",
    title: "Review privacy controls",
    description:
      "Prepare data export, retention, audit logs, deletion requests, and GDPR-oriented controls.",
    href: "/workspace/privacy"
  }
];

export const workspaceAlerts: WorkspaceAlert[] = [];

export const workspaceMapCards: WorkspaceMapCard[] = [
  {
    iconKey: "country",
    title: "Country-pack simulation layer",
    description:
      "Country context will stay versioned, source-linked, and legally cautious. No source means no rule. No simulation becomes a legal conclusion."
  },
  {
    iconKey: "report",
    title: "Validation report layer",
    description:
      "Reports will show rule versions, source references, severity levels, confidence labels, and professional-review warnings."
  }
];

export const invoiceStages: InvoiceStage[] = [
  {
    iconKey: "sellerBuyer",
    title: "Seller and buyer profiles",
    description:
      "Create reusable business profiles for sellers and buyers, including names, addresses, country codes, VAT IDs, and electronic addresses."
  },
  {
    iconKey: "lineItems",
    title: "Line item modeling",
    description:
      "Capture quantities, unit codes, prices, discounts, charges, VAT category, VAT rate, net amount, and line-level totals."
  },
  {
    iconKey: "totals",
    title: "Totals and tax breakdown",
    description:
      "Prepare the invoice total model, tax breakdown, allowance and charge calculation, paid amount, and payable amount."
  },
  {
    iconKey: "export",
    title: "Export preparation",
    description:
      "Prepare the canonical invoice for validation, UBL XML generation, technical CII XML export, and report creation."
  }
];

export const invoiceDrafts: InvoiceDraft[] = [];

export const validationRunLayers: ValidationRunLayer[] = [
  {
    iconKey: "schema",
    title: "Input schema",
    status: "API-backed",
    description:
      "Payload structure, required fields, length limits, and unexpected fields."
  },
  {
    iconKey: "calculation",
    title: "Calculation logic",
    status: "API-backed",
    description:
      "Line net amount, taxable amount, VAT amount, allowances, charges, and payable total."
  },
  {
    iconKey: "ubl",
    title: "UBL mapping",
    status: "Planned",
    description:
      "Canonical invoice data should be exportable to UBL XML with clear readiness and review signals."
  },
  {
    iconKey: "legal",
    title: "Legal-confidence label",
    status: "Simulation only",
    description:
      "Findings remain technical, educational simulation, or review-required. They do not become official legal, tax, Peppol, EN 16931, ViDA, government, or authority validation."
  }
];

export const validationFindings: ValidationFindingPreview[] = [];

export const apiControls: ApiControl[] = [
  {
    iconKey: "apiKey",
    title: "API keys",
    description:
      "Create test keys, show secrets only once, store only hashes, rotate keys, revoke keys, and assign scopes."
  },
  {
    iconKey: "rbac",
    title: "Scopes and RBAC",
    description:
      "Every key should be tied to an organization, role permissions, and endpoint-level authorization."
  },
  {
    iconKey: "logs",
    title: "Request logs",
    description:
      "Track request ID, endpoint, key prefix, organization, status code, latency, and rate-limit events."
  },
  {
    iconKey: "webhook",
    title: "Webhook simulator",
    description:
      "Send test events for validation completed, XML export ready, report generated, and webhook failed."
  }
];

export const apiEventTypes: ApiEventPreview[] = [
  {
    name: "validation.completed",
    description: "Validation run finished"
  },
  {
    name: "ubl.export.ready",
    description: "UBL XML export is ready"
  },
  {
    name: "report.generated",
    description: "Validation report generated"
  },
  {
    name: "webhook.failed",
    description: "Webhook delivery failed"
  }
];

export const developerEndpointPreview: DeveloperEndpointPreview = {
  method: "POST",
  path: "/api/v1/invoices/validate",
  payload: {
    keyPrefix: "not_configured",
    scope: "invoices:validate",
    rateLimit: "configured by API middleware",
    status: "development_preview",
    note: "API keys must never be stored in plain text."
  }
};

export const privacyControls: PrivacyControl[] = [
  {
    iconKey: "dataExport",
    title: "Data export",
    description:
      "Export user, organization, invoice, validation, API log, and audit-related data in a structured format."
  },
  {
    iconKey: "deletion",
    title: "Deletion requests",
    description:
      "Request account, organization, invoice, attachment, and validation report deletion with clear status tracking."
  },
  {
    iconKey: "retention",
    title: "Retention settings",
    description:
      "Configure retention for uploads, validation reports, API logs, audit logs, and VIES evidence."
  },
  {
    iconKey: "minimisation",
    title: "Data minimisation",
    description:
      "Avoid collecting unnecessary IDs, personal tax details, location data, unrelated documents, or contact lists."
  }
];

export const retentionPolicies: RetentionPolicyRow[] = [
  {
    label: "Uploaded XML files",
    value: "Not configured"
  },
  {
    label: "API logs",
    value: "Not configured"
  },
  {
    label: "Validation reports",
    value: "Not configured"
  },
  {
    label: "Audit logs",
    value: "Not configured"
  },
  {
    label: "Deleted account data",
    value: "Not configured"
  }
];

export const countryOptions: SelectOption[] = [
  { label: "Select country", value: "" },
  { label: "Hungary", value: "HU" },
  { label: "Germany", value: "DE" },
  { label: "Italy", value: "IT" },
  { label: "France", value: "FR" },
  { label: "Spain", value: "ES" },
  { label: "Netherlands", value: "NL" },
  { label: "Poland", value: "PL" },
  { label: "Romania", value: "RO" }
];

export const currencyOptions: SelectOption[] = [
  { label: "Euro", value: "EUR" },
  { label: "Hungarian Forint", value: "HUF" },
  { label: "Polish Zloty", value: "PLN" },
  { label: "Romanian Leu", value: "RON" }
];

export const vatCategoryOptions: SelectOption[] = [
  { label: "Standard rated", value: "S" },
  { label: "Zero rated", value: "Z" },
  { label: "Exempt", value: "E" },
  { label: "Reverse charge", value: "AE" },
  { label: "Outside scope", value: "O" }
];

export const invoiceEditorDraft: InvoiceEditorDraft = {
  document: {
    number: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    currency: "EUR",
    invoiceType: "invoice",
    profile: "EN16931",
    buyerReference: "",
    contractReference: ""
  },
  seller: {
    name: "",
    country: "",
    vatId: "",
    city: "",
    postalCode: "",
    street: "",
    electronicAddress: ""
  },
  buyer: {
    name: "",
    country: "",
    vatId: "",
    city: "",
    postalCode: "",
    street: "",
    electronicAddress: ""
  },
  lines: [
    {
      id: "1",
      description: "",
      quantity: "1",
      unitCode: "EA",
      unitPrice: "0.00",
      vatCategory: "S",
      vatRate: "0",
      netAmount: "0.00"
    }
  ],
  totals: {
    lineExtensionAmount: "0.00",
    taxExclusiveAmount: "0.00",
    taxAmount: "0.00",
    taxInclusiveAmount: "0.00",
    payableAmount: "0.00"
  }
};
