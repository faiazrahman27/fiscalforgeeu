export type WorkspaceIconKey =
  | "invoice"
  | "validation"
  | "developer"
  | "privacy"
  | "country"
  | "report"
  | "sellerBuyer"
  | "lineItems"
  | "totals"
  | "export"
  | "schema"
  | "calculation"
  | "ubl"
  | "legal"
  | "apiKey"
  | "rbac"
  | "logs"
  | "webhook"
  | "dataExport"
  | "deletion"
  | "retention"
  | "minimisation";

export type WorkspaceStat = {
  label: string;
  value: string;
  detail: string;
};

export type WorkspaceAction = {
  iconKey: WorkspaceIconKey;
  title: string;
  description: string;
  href: string;
};

export type WorkspaceAlert = {
  id: string;
  message: string;
  severity: "info" | "warning" | "fatal" | "blocked";
};

export type WorkspaceMapCard = {
  iconKey: WorkspaceIconKey;
  title: string;
  description: string;
};

export type InvoiceStage = {
  iconKey: WorkspaceIconKey;
  title: string;
  description: string;
};

export type InvoiceStatus =
  | "Draft"
  | "Review required"
  | "Validation failed"
  | "Ready for export";

export type InvoiceDraft = {
  id: string;
  number: string;
  buyer: string;
  buyerCountry: string;
  issueDate: string;
  status: InvoiceStatus;
  amount: string;
  currency: string;
};

export type ValidationStatus =
  | "Passed"
  | "Failed"
  | "Warning"
  | "Review required"
  | "API-backed"
  | "Planned"
  | "Simulation only";

export type ValidationRunLayer = {
  iconKey: WorkspaceIconKey;
  title: string;
  status: ValidationStatus;
  description: string;
};

export type FindingSeverity = "info" | "warning" | "fatal" | "blocked";

export type LegalConfidence =
  | "technical"
  | "standard_based"
  | "official_source_derived"
  | "educational_simulation"
  | "professional_review_required";

export type ValidationFindingPreview = {
  code: string;
  severity: FindingSeverity;
  category: string;
  field?: string;
  legalConfidence: LegalConfidence;
  message: string;
};

export type ApiControl = {
  iconKey: WorkspaceIconKey;
  title: string;
  description: string;
};

export type ApiEventPreview = {
  name: string;
  description: string;
};

export type DeveloperEndpointPreview = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  payload: Record<string, string>;
};

export type PrivacyControl = {
  iconKey: WorkspaceIconKey;
  title: string;
  description: string;
};

export type RetentionPolicyRow = {
  label: string;
  value: string;
};

export type SelectOption = {
  label: string;
  value: string;
};

export type InvoicePartyDraft = {
  name: string;
  country: string;
  vatId: string;
  city: string;
  postalCode: string;
  street: string;
  electronicAddress: string;
};

export type InvoiceDocumentDraft = {
  number: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  invoiceType: "invoice" | "credit_note";
  profile: "EN16931" | "PEPPOL_BIS_3" | "COUNTRY_PACK";
  buyerReference: string;
  contractReference: string;
};

export type InvoiceLineEditorDraft = {
  id: string;
  description: string;
  quantity: string;
  unitCode: string;
  unitPrice: string;
  vatCategory: string;
  vatRate: string;
  netAmount: string;
};

export type InvoiceTotalsDraft = {
  lineExtensionAmount: string;
  taxExclusiveAmount: string;
  taxAmount: string;
  taxInclusiveAmount: string;
  payableAmount: string;
};

export type InvoiceEditorDraft = {
  document: InvoiceDocumentDraft;
  seller: InvoicePartyDraft;
  buyer: InvoicePartyDraft;
  lines: InvoiceLineEditorDraft[];
  totals: InvoiceTotalsDraft;
};
