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

export const commandStats: WorkspaceStat[] = [
  {
    label: "Draft invoices",
    value: "12",
    detail: "Structured invoice drafts ready for validation"
  },
  {
    label: "Validation runs",
    value: "38",
    detail: "Technical, standard-style, and simulation results"
  },
  {
    label: "Open findings",
    value: "7",
    detail: "Items requiring review before export"
  },
  {
    label: "API requests",
    value: "184",
    detail: "Sandbox requests during the current cycle"
  }
];

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
    title: "Run validation",
    description:
      "Inspect schema checks, decimal calculations, UBL mapping, standard-style findings, and legal-confidence labels.",
    href: "/workspace/validation-runs"
  },
  {
    iconKey: "developer",
    title: "Test API behavior",
    description:
      "Use sandbox endpoint previews, API keys, webhook simulations, scopes, and request logs.",
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

export const workspaceAlerts: WorkspaceAlert[] = [
  {
    id: "alert_buyer_vat_missing",
    message: "Buyer VAT ID missing in FF-2026-001",
    severity: "fatal"
  },
  {
    id: "alert_review_required",
    message: "One validation report requires professional review",
    severity: "warning"
  },
  {
    id: "alert_country_pack_review",
    message: "Country-pack source review is due for HU simulation",
    severity: "warning"
  },
  {
    id: "alert_xml_policy",
    message: "XML upload limit policy is active: 5 MB",
    severity: "info"
  }
];

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
      "Prepare the canonical invoice for validation, UBL XML generation, report creation, and later CII support."
  }
];

export const invoiceDrafts: InvoiceDraft[] = [
  {
    id: "inv_001",
    number: "FF-2026-001",
    buyer: "Berlin Digital GmbH",
    buyerCountry: "DE",
    issueDate: "2026-04-25",
    status: "Review required",
    amount: "€1,240.00",
    currency: "EUR"
  },
  {
    id: "inv_002",
    number: "FF-2026-002",
    buyer: "Debrecen Research Lab",
    buyerCountry: "HU",
    issueDate: "2026-04-25",
    status: "Draft",
    amount: "€680.00",
    currency: "EUR"
  },
  {
    id: "inv_003",
    number: "FF-2026-003",
    buyer: "Milan Studio SRL",
    buyerCountry: "IT",
    issueDate: "2026-04-25",
    status: "Validation failed",
    amount: "€2,450.00",
    currency: "EUR"
  }
];

export const validationRunLayers: ValidationRunLayer[] = [
  {
    iconKey: "schema",
    title: "Input schema",
    status: "Passed",
    description:
      "Payload structure, required fields, length limits, and unexpected fields."
  },
  {
    iconKey: "calculation",
    title: "Calculation logic",
    status: "Failed",
    description:
      "Line net amount, taxable amount, VAT amount, allowances, charges, and payable total."
  },
  {
    iconKey: "ubl",
    title: "UBL mapping",
    status: "Warning",
    description:
      "Canonical data can be exported to UBL, but buyer VAT ID is missing for the simulated scenario."
  },
  {
    iconKey: "legal",
    title: "Legal-confidence label",
    status: "Review required",
    description:
      "The current finding is educational simulation only and requires professional review."
  }
];

export const validationFindings: ValidationFindingPreview[] = [
  {
    code: "BR-CO-10",
    severity: "fatal",
    category: "CALCULATION",
    field: "totals.payableAmount",
    legalConfidence: "standard_based",
    message:
      "Invoice total does not match the calculated sum of line totals, taxes, allowances, and charges."
  },
  {
    code: "BUYER_VAT_ID_REQUIRED",
    severity: "fatal",
    category: "VAT_ID",
    field: "buyer.vatId",
    legalConfidence: "educational_simulation",
    message: "Buyer VAT ID is required for this intra-EU B2B simulation."
  },
  {
    code: "INTRA_EU_B2B_REVERSE_CHARGE_WARNING",
    severity: "warning",
    category: "COUNTRY_PACK",
    field: "transaction",
    legalConfidence: "educational_simulation",
    message:
      "This transaction appears to match a possible intra-EU B2B reverse-charge scenario."
  }
];

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
    keyPrefix: "ff_test_4x9p",
    scope: "invoices:validate",
    rateLimit: "120 requests / minute",
    status: "sandbox_ready",
    note: "API keys are never stored in plain text."
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
    value: "30 days"
  },
  {
    label: "API logs",
    value: "90 days"
  },
  {
    label: "Validation reports",
    value: "12 months"
  },
  {
    label: "Audit logs",
    value: "12 months"
  },
  {
    label: "Deleted account data",
    value: "Purge within 30 days"
  }
];

export const countryOptions: SelectOption[] = [
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
    number: "FF-2026-004",
    issueDate: "2026-04-25",
    dueDate: "2026-05-25",
    currency: "EUR",
    invoiceType: "invoice",
    profile: "PEPPOL_BIS_3",
    buyerReference: "BR-DE-2048",
    contractReference: "CTR-VIDA-SANDBOX"
  },
  seller: {
    name: "FiscalForge Demo Studio",
    country: "HU",
    vatId: "HU12345678",
    city: "Debrecen",
    postalCode: "4024",
    street: "Sandbox Street 12",
    electronicAddress: "9908:demo-seller"
  },
  buyer: {
    name: "Berlin Digital GmbH",
    country: "DE",
    vatId: "DE123456789",
    city: "Berlin",
    postalCode: "10115",
    street: "Invalidenstraße 44",
    electronicAddress: "0088:buyer-demo"
  },
  lines: [
    {
      id: "1",
      description: "E-invoice validation sandbox consulting",
      quantity: "10",
      unitCode: "HUR",
      unitPrice: "95.00",
      vatCategory: "AE",
      vatRate: "0",
      netAmount: "950.00"
    },
    {
      id: "2",
      description: "Structured invoice data modelling session",
      quantity: "2",
      unitCode: "EA",
      unitPrice: "145.00",
      vatCategory: "AE",
      vatRate: "0",
      netAmount: "290.00"
    }
  ],
  totals: {
    lineExtensionAmount: "1240.00",
    taxExclusiveAmount: "1240.00",
    taxAmount: "0.00",
    taxInclusiveAmount: "1240.00",
    payableAmount: "1240.00"
  }
};