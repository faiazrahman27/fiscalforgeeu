import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  XmlExtractedData,
  XmlReadinessFinding,
  XmlReadinessReport,
  XmlUploadSummaryShape
} from "../services/xml-readiness-engine.js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type XmlUploadStatus = "accepted" | "rejected";

export type XmlApiInspectionStatus = "parsed" | "review_required";

export type XmlUploadSummary = XmlUploadSummaryShape;

export type XmlUploadRecord = {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
  apiStatus: XmlApiInspectionStatus;
  status: XmlUploadStatus;
  note: string;
  disclaimer: string;

  technicalStatus: XmlReadinessReport["technicalStatus"];
  readinessStatus: XmlReadinessReport["readinessStatus"];
  documentStatus: XmlReadinessReport["documentStatus"];
  calculationStatus: XmlReadinessReport["calculationStatus"];
  profileStatus: XmlReadinessReport["profileStatus"];
  extractedData: XmlExtractedData;
  findings: XmlReadinessFinding[];

  summary: XmlUploadSummary;
};

export type CreateXmlUploadRecordInput = {
  fileName: string;
  fileSize: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
  apiStatus: XmlApiInspectionStatus;
  disclaimer: string;
  readinessReport: XmlReadinessReport;
  summary: XmlUploadSummary;
};

export type AuthenticatedXmlUploadContext = {
  userId: string;
  accessToken: string;
};

type SupabaseWorkspaceBootstrapRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

type SupabaseXmlReadinessReportRow = {
  id: string;
  organization_id: string;
  created_by: string;
  file_name: string;
  file_size: string;
  detected_document: string;
  root_element: string;
  invoice_id: string;
  issue_date: string;
  currency: string;
  api_status: string;
  status: string;
  note: string;
  technical_status: string;
  readiness_status: string;
  document_status: string;
  calculation_status: string;
  profile_status: string;
  extracted_data: unknown;
  findings: unknown;
  findings_count: number;
  seller_name: string;
  buyer_name: string;
  line_count: number;
  payable_amount: string;
  tax_amount: string;
  summary: unknown;
  disclaimer: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
};

type XmlReadinessMonetaryTotalsRow = {
  organization_id: string;
  xml_readiness_report_id: string;
  line_extension_amount: string;
  tax_exclusive_amount: string;
  tax_amount: string;
  tax_inclusive_amount: string;
  payable_amount: string;
  currency: string;
};

type XmlReadinessTaxSignalRow = {
  organization_id: string;
  xml_readiness_report_id: string;
  tax_total_detected: boolean;
  tax_subtotal_detected: boolean;
  tax_category_detected: boolean;
  tax_rate_count: number;
  tax_category_codes: string[];
  vat_percent_values: string[];
};

type XmlReadinessProfileSignalRow = {
  organization_id: string;
  xml_readiness_report_id: string;
  customization_id: string;
  profile_id: string;
  profile_hints: string[];
  ubl_namespace_detected: boolean;
  ubl_document_detected: boolean;
  peppol_signal_detected: boolean;
  en16931_signal_detected: boolean;
  endpoint_count: number;
  seller_endpoint_id: string;
  seller_endpoint_scheme: string;
  buyer_endpoint_id: string;
  buyer_endpoint_scheme: string;
  seller_country: string;
  buyer_country: string;
  country_pair: string;
  cross_border_signal: boolean;
  payment_means_detected: boolean;
  payment_terms_detected: boolean;
  allowance_charge_detected: boolean;
};

type XmlReadinessFindingRow = {
  organization_id: string;
  xml_readiness_report_id: string;
  finding_position: number;
  code: string;
  severity: XmlReadinessFinding["severity"];
  field_path: string;
  message: string;
  confidence: XmlReadinessFinding["confidence"];
};

type WorkspaceActivityEventInput = {
  organizationId: string;
  actorUserId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  severity?: "info" | "warning" | "error";
  source?: "api";
  metadata?: Record<string, unknown>;
};

const XML_UPLOADS_FILE = "xml-uploads.json";
const MAX_STORED_XML_UPLOADS = 250;
const XML_REPORT_SELECT_FIELDS =
  "id, organization_id, created_by, file_name, file_size, detected_document, root_element, invoice_id, issue_date, currency, api_status, status, note, technical_status, readiness_status, document_status, calculation_status, profile_status, extracted_data, findings, findings_count, seller_name, buyer_name, line_count, payable_amount, tax_amount, summary, disclaimer, uploaded_at, created_at, updated_at";

const storageProvider = getCollectionStorageProvider();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function normalizeWorkspaceBootstrapRecord(
  value: unknown
): SupabaseWorkspaceBootstrapRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const organizationId = readStringField(value, "organization_id");
  const organizationName = readStringField(value, "organization_name");
  const organizationSlug = readStringField(value, "organization_slug");
  const membershipRole = readStringField(value, "membership_role", "member");
  const userEmail = readStringField(value, "user_email");

  if (!organizationId || !organizationName || !organizationSlug) {
    return null;
  }

  return {
    organizationId,
    organizationName,
    organizationSlug,
    membershipRole,
    userEmail
  };
}

function sortXmlUploadsByUploadedAt(records: XmlUploadRecord[]) {
  return [...records].sort((first, second) =>
    second.uploadedAt.localeCompare(first.uploadedAt)
  );
}

function mapApiStatusToUploadStatus(
  apiStatus: XmlApiInspectionStatus
): XmlUploadStatus {
  return apiStatus === "parsed" ? "accepted" : "rejected";
}

function normalizeApiStatus(value: string): XmlApiInspectionStatus {
  return value === "parsed" ? "parsed" : "review_required";
}

function normalizeUploadStatus(
  value: string,
  apiStatus: XmlApiInspectionStatus
): XmlUploadStatus {
  if (value === "accepted" || value === "rejected") {
    return value;
  }

  return mapApiStatusToUploadStatus(apiStatus);
}

function normalizeTechnicalStatus(
  value: string
): XmlReadinessReport["technicalStatus"] {
  return value === "failed" ? "failed" : "passed";
}

function normalizeReadinessStatus(
  value: string
): XmlReadinessReport["readinessStatus"] {
  if (value === "ready_for_review" || value === "unsupported") {
    return value;
  }

  return "needs_attention";
}

function normalizeDocumentStatus(
  value: string
): XmlReadinessReport["documentStatus"] {
  return value === "recognized" ? "recognized" : "unsupported";
}

function normalizeCalculationStatus(
  value: string
): XmlReadinessReport["calculationStatus"] {
  if (value === "surface_checked" || value === "inconsistent") {
    return value;
  }

  return "not_checked";
}

function normalizeProfileStatus(
  value: string
): XmlReadinessReport["profileStatus"] {
  if (
    value === "ubl_surface_check" ||
    value === "peppol_bis_signal" ||
    value === "en16931_signal"
  ) {
    return value;
  }

  return "unknown_profile";
}

function buildUploadNote(input: CreateXmlUploadRecordInput) {
  if (input.apiStatus !== "parsed") {
    return "XML structure requires review or uses an unsupported document root.";
  }

  if (input.readinessReport.readinessStatus === "ready_for_review") {
    return "Readiness simulation completed without blocking findings.";
  }

  return `Readiness simulation completed with ${input.readinessReport.findings.length} finding(s).`;
}

function normalizeFindings(value: unknown): XmlReadinessFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPlainObject) as XmlReadinessFinding[];
}

function normalizeSummary(row: SupabaseXmlReadinessReportRow): XmlUploadSummary {
  if (isPlainObject(row.summary)) {
    return row.summary as XmlUploadSummary;
  }

  return {
    technicalStatus: normalizeTechnicalStatus(row.technical_status),
    readinessStatus: normalizeReadinessStatus(row.readiness_status),
    findingsCount: row.findings_count,
    sellerName: row.seller_name,
    buyerName: row.buyer_name,
    lineCount: row.line_count,
    payableAmount: row.payable_amount,
    taxAmount: row.tax_amount,
    currency: row.currency
  };
}

function normalizeExtractedData(value: unknown): XmlExtractedData {
  if (isPlainObject(value)) {
    return value as XmlExtractedData;
  }

  return {
    sellerName: "",
    buyerName: "",
    lineCount: 0,
    invoiceLineCount: 0,
    creditNoteLineCount: 0,
    currency: "",
    monetaryTotals: {
      lineExtensionAmount: "",
      taxExclusiveAmount: "",
      taxAmount: "",
      taxInclusiveAmount: "",
      payableAmount: ""
    },
    taxSignal: {
      taxTotalDetected: false,
      taxSubtotalDetected: false,
      taxCategoryDetected: false,
      taxRateCount: 0
    },
    profileSignal: {
      customizationId: "",
      profileId: "",
      profileHints: [],
      ublNamespaceDetected: false,
      ublDocumentDetected: false,
      peppolSignalDetected: false,
      en16931SignalDetected: false,
      endpointCount: 0,
      sellerEndpointId: "",
      sellerEndpointScheme: "",
      buyerEndpointId: "",
      buyerEndpointScheme: "",
      sellerCountry: "",
      buyerCountry: "",
      countryPair: "",
      crossBorderSignal: false,
      taxCategoryCodes: [],
      vatPercentValues: [],
      paymentMeansDetected: false,
      paymentTermsDetected: false,
      allowanceChargeDetected: false
    }
  };
}

function normalizeSupabaseXmlReadinessReportRow(
  row: SupabaseXmlReadinessReportRow
): XmlUploadRecord {
  const apiStatus = normalizeApiStatus(row.api_status);
  const status = normalizeUploadStatus(row.status, apiStatus);

  return {
    id: row.id,
    fileName: row.file_name,
    fileSize: row.file_size,
    uploadedAt: row.uploaded_at,
    detectedDocument: row.detected_document,
    rootElement: row.root_element,
    invoiceId: row.invoice_id,
    issueDate: row.issue_date,
    currency: row.currency,
    apiStatus,
    status,
    note: row.note,
    disclaimer: row.disclaimer,

    technicalStatus: normalizeTechnicalStatus(row.technical_status),
    readinessStatus: normalizeReadinessStatus(row.readiness_status),
    documentStatus: normalizeDocumentStatus(row.document_status),
    calculationStatus: normalizeCalculationStatus(row.calculation_status),
    profileStatus: normalizeProfileStatus(row.profile_status),
    extractedData: normalizeExtractedData(row.extracted_data),
    findings: normalizeFindings(row.findings),

    summary: normalizeSummary(row)
  };
}

function buildSupabaseXmlReadinessReportValues(
  input: CreateXmlUploadRecordInput,
  organizationId: string,
  userId: string
) {
  const status = mapApiStatusToUploadStatus(input.apiStatus);
  const note = buildUploadNote(input);

  return {
    organization_id: organizationId,
    created_by: userId,
    file_name: input.fileName,
    file_size: input.fileSize,
    detected_document: input.detectedDocument,
    root_element: input.rootElement,
    invoice_id: input.invoiceId,
    issue_date: input.issueDate,
    currency: input.currency,
    api_status: input.apiStatus,
    status,
    note,
    technical_status: input.readinessReport.technicalStatus,
    readiness_status: input.readinessReport.readinessStatus,
    document_status: input.readinessReport.documentStatus,
    calculation_status: input.readinessReport.calculationStatus,
    profile_status: input.readinessReport.profileStatus,
    extracted_data: input.readinessReport.extractedData,
    findings: input.readinessReport.findings,
    findings_count: input.readinessReport.findings.length,
    seller_name: input.summary.sellerName,
    buyer_name: input.summary.buyerName,
    line_count: input.summary.lineCount,
    payable_amount: input.summary.payableAmount,
    tax_amount: input.summary.taxAmount,
    summary: input.summary,
    disclaimer: input.disclaimer,
    uploaded_at: new Date().toISOString()
  };
}

function buildXmlReportActivityMetadata(input: CreateXmlUploadRecordInput) {
  const extractedData = input.readinessReport.extractedData;
  const profileSignal = extractedData.profileSignal;
  const taxSignal = extractedData.taxSignal;

  return {
    fileName: input.fileName,
    fileSize: input.fileSize,
    detectedDocument: input.detectedDocument,
    rootElement: input.rootElement,
    invoiceId: input.invoiceId,
    issueDate: input.issueDate,
    currency: input.currency,
    apiStatus: input.apiStatus,
    status: mapApiStatusToUploadStatus(input.apiStatus),
    technicalStatus: input.readinessReport.technicalStatus,
    readinessStatus: input.readinessReport.readinessStatus,
    documentStatus: input.readinessReport.documentStatus,
    calculationStatus: input.readinessReport.calculationStatus,
    profileStatus: input.readinessReport.profileStatus,
    sellerName: input.summary.sellerName,
    buyerName: input.summary.buyerName,
    lineCount: input.summary.lineCount,
    findingsCount: input.summary.findingsCount,
    payableAmount: input.summary.payableAmount,
    taxAmount: input.summary.taxAmount,
    sellerCountry: profileSignal.sellerCountry,
    buyerCountry: profileSignal.buyerCountry,
    crossBorderSignal: profileSignal.crossBorderSignal,
    peppolSignalDetected: profileSignal.peppolSignalDetected,
    en16931SignalDetected: profileSignal.en16931SignalDetected,
    taxTotalDetected: taxSignal.taxTotalDetected,
    taxCategoryDetected: taxSignal.taxCategoryDetected,
    taxRateCount: taxSignal.taxRateCount
  };
}

function buildXmlReadinessMonetaryTotalsRow(
  input: CreateXmlUploadRecordInput,
  organizationId: string,
  xmlReadinessReportId: string
): XmlReadinessMonetaryTotalsRow {
  const monetaryTotals = input.readinessReport.extractedData.monetaryTotals;

  return {
    organization_id: organizationId,
    xml_readiness_report_id: xmlReadinessReportId,
    line_extension_amount: monetaryTotals.lineExtensionAmount,
    tax_exclusive_amount: monetaryTotals.taxExclusiveAmount,
    tax_amount: monetaryTotals.taxAmount,
    tax_inclusive_amount: monetaryTotals.taxInclusiveAmount,
    payable_amount: monetaryTotals.payableAmount,
    currency: input.readinessReport.extractedData.currency
  };
}

function buildXmlReadinessTaxSignalRow(
  input: CreateXmlUploadRecordInput,
  organizationId: string,
  xmlReadinessReportId: string
): XmlReadinessTaxSignalRow {
  const extractedData = input.readinessReport.extractedData;
  const taxSignal = extractedData.taxSignal;
  const profileSignal = extractedData.profileSignal;

  return {
    organization_id: organizationId,
    xml_readiness_report_id: xmlReadinessReportId,
    tax_total_detected: taxSignal.taxTotalDetected,
    tax_subtotal_detected: taxSignal.taxSubtotalDetected,
    tax_category_detected: taxSignal.taxCategoryDetected,
    tax_rate_count: taxSignal.taxRateCount,
    tax_category_codes: profileSignal.taxCategoryCodes,
    vat_percent_values: profileSignal.vatPercentValues
  };
}

function buildXmlReadinessProfileSignalRow(
  input: CreateXmlUploadRecordInput,
  organizationId: string,
  xmlReadinessReportId: string
): XmlReadinessProfileSignalRow {
  const profileSignal = input.readinessReport.extractedData.profileSignal;

  return {
    organization_id: organizationId,
    xml_readiness_report_id: xmlReadinessReportId,
    customization_id: profileSignal.customizationId,
    profile_id: profileSignal.profileId,
    profile_hints: profileSignal.profileHints,
    ubl_namespace_detected: profileSignal.ublNamespaceDetected,
    ubl_document_detected: profileSignal.ublDocumentDetected,
    peppol_signal_detected: profileSignal.peppolSignalDetected,
    en16931_signal_detected: profileSignal.en16931SignalDetected,
    endpoint_count: profileSignal.endpointCount,
    seller_endpoint_id: profileSignal.sellerEndpointId,
    seller_endpoint_scheme: profileSignal.sellerEndpointScheme,
    buyer_endpoint_id: profileSignal.buyerEndpointId,
    buyer_endpoint_scheme: profileSignal.buyerEndpointScheme,
    seller_country: profileSignal.sellerCountry,
    buyer_country: profileSignal.buyerCountry,
    country_pair: profileSignal.countryPair,
    cross_border_signal: profileSignal.crossBorderSignal,
    payment_means_detected: profileSignal.paymentMeansDetected,
    payment_terms_detected: profileSignal.paymentTermsDetected,
    allowance_charge_detected: profileSignal.allowanceChargeDetected
  };
}

function buildXmlReadinessFindingRows(
  input: CreateXmlUploadRecordInput,
  organizationId: string,
  xmlReadinessReportId: string
): XmlReadinessFindingRow[] {
  return input.readinessReport.findings.map((finding, index) => ({
    organization_id: organizationId,
    xml_readiness_report_id: xmlReadinessReportId,
    finding_position: index + 1,
    code: finding.code,
    severity: finding.severity,
    field_path: finding.field,
    message: finding.message,
    confidence: finding.confidence
  }));
}

async function recordWorkspaceActivityEvent(
  supabase: SupabaseClient,
  input: WorkspaceActivityEventInput
) {
  const { error } = await supabase.from("workspace_activity_events").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_label: input.entityLabel,
    severity: input.severity ?? "info",
    source: input.source ?? "api",
    metadata: input.metadata ?? {}
  });

  if (error) {
    /*
     * Activity logging must not break the main XML operation.
     * The XML report and relational rows remain the authoritative data.
     */
    console.warn(`Workspace activity event was not recorded: ${error.message}`);
  }
}

async function replaceXmlReadinessRelationalRows(
  supabase: SupabaseClient,
  organizationId: string,
  xmlReadinessReportId: string,
  input: CreateXmlUploadRecordInput
) {
  const childTables = [
    "xml_readiness_findings",
    "xml_readiness_profile_signals",
    "xml_readiness_tax_signals",
    "xml_readiness_monetary_totals"
  ];

  for (const tableName of childTables) {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("organization_id", organizationId)
      .eq("xml_readiness_report_id", xmlReadinessReportId);

    if (error) {
      throw new Error(
        `Could not clear ${tableName} rows for XML report: ${error.message}`
      );
    }
  }

  const { error: monetaryTotalsInsertError } = await supabase
    .from("xml_readiness_monetary_totals")
    .insert(
      buildXmlReadinessMonetaryTotalsRow(
        input,
        organizationId,
        xmlReadinessReportId
      )
    );

  if (monetaryTotalsInsertError) {
    throw new Error(
      `Could not insert XML monetary totals row: ${monetaryTotalsInsertError.message}`
    );
  }

  const { error: taxSignalInsertError } = await supabase
    .from("xml_readiness_tax_signals")
    .insert(
      buildXmlReadinessTaxSignalRow(input, organizationId, xmlReadinessReportId)
    );

  if (taxSignalInsertError) {
    throw new Error(
      `Could not insert XML tax signal row: ${taxSignalInsertError.message}`
    );
  }

  const { error: profileSignalInsertError } = await supabase
    .from("xml_readiness_profile_signals")
    .insert(
      buildXmlReadinessProfileSignalRow(
        input,
        organizationId,
        xmlReadinessReportId
      )
    );

  if (profileSignalInsertError) {
    throw new Error(
      `Could not insert XML profile signal row: ${profileSignalInsertError.message}`
    );
  }

  const findingRows = buildXmlReadinessFindingRows(
    input,
    organizationId,
    xmlReadinessReportId
  );

  if (findingRows.length > 0) {
    const { error: findingsInsertError } = await supabase
      .from("xml_readiness_findings")
      .insert(findingRows);

    if (findingsInsertError) {
      throw new Error(
        `Could not insert XML finding rows: ${findingsInsertError.message}`
      );
    }
  }
}

async function getWorkspaceForAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("bootstrap_personal_workspace");

  if (error) {
    throw new Error(`Workspace bootstrap failed: ${error.message}`);
  }

  const firstRecord = Array.isArray(data) ? data[0] : data;
  const workspace = normalizeWorkspaceBootstrapRecord(firstRecord);

  if (!workspace) {
    throw new Error("Workspace bootstrap returned an unreadable record.");
  }

  return workspace;
}

function createAuthenticatedSupabaseClient(context: AuthenticatedXmlUploadContext) {
  return getSupabaseUserClient(context.accessToken);
}

export function hasAuthenticatedXmlUploadContext(
  context: AuthenticatedXmlUploadContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

/* -------------------------------------------------------------------------- */
/* Local JSON-backed XML upload storage                                       */
/* -------------------------------------------------------------------------- */

export async function listXmlUploadRecords() {
  const records =
    await storageProvider.readCollection<XmlUploadRecord>(XML_UPLOADS_FILE);

  return sortXmlUploadsByUploadedAt(records);
}

export async function getXmlUploadRecordById(id: string) {
  const records = await listXmlUploadRecords();

  return records.find((record) => record.id === id) ?? null;
}

export async function createXmlUploadRecord(
  input: CreateXmlUploadRecordInput
): Promise<XmlUploadRecord> {
  const record: XmlUploadRecord = {
    id: `xml_${randomUUID()}`,
    fileName: input.fileName,
    fileSize: input.fileSize,
    uploadedAt: new Date().toISOString(),
    detectedDocument: input.detectedDocument,
    rootElement: input.rootElement,
    invoiceId: input.invoiceId,
    issueDate: input.issueDate,
    currency: input.currency,
    apiStatus: input.apiStatus,
    status: mapApiStatusToUploadStatus(input.apiStatus),
    note: buildUploadNote(input),
    disclaimer: input.disclaimer,

    technicalStatus: input.readinessReport.technicalStatus,
    readinessStatus: input.readinessReport.readinessStatus,
    documentStatus: input.readinessReport.documentStatus,
    calculationStatus: input.readinessReport.calculationStatus,
    profileStatus: input.readinessReport.profileStatus,
    extractedData: input.readinessReport.extractedData,
    findings: input.readinessReport.findings,

    summary: input.summary
  };

  const currentRecords = await listXmlUploadRecords();
  const nextRecords = [record, ...currentRecords].slice(
    0,
    MAX_STORED_XML_UPLOADS
  );

  await storageProvider.writeCollection(XML_UPLOADS_FILE, nextRecords);

  return record;
}

export async function deleteXmlUploadRecordById(id: string) {
  const records = await listXmlUploadRecords();
  const nextRecords = records.filter((record) => record.id !== id);

  if (nextRecords.length === records.length) {
    return false;
  }

  await storageProvider.writeCollection(XML_UPLOADS_FILE, nextRecords);

  return true;
}

/* -------------------------------------------------------------------------- */
/* Supabase user-scoped XML upload storage                                    */
/* -------------------------------------------------------------------------- */

export async function listAuthenticatedXmlUploadRecords(
  context: AuthenticatedXmlUploadContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("xml_readiness_reports")
    .select(XML_REPORT_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("uploaded_at", {
      ascending: false
    })
    .limit(MAX_STORED_XML_UPLOADS);

  if (error) {
    throw new Error(`Could not list Supabase XML reports: ${error.message}`);
  }

  return ((data ?? []) as SupabaseXmlReadinessReportRow[]).map((row) =>
    normalizeSupabaseXmlReadinessReportRow(row)
  );
}

export async function getAuthenticatedXmlUploadRecordById(
  context: AuthenticatedXmlUploadContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("xml_readiness_reports")
    .select(XML_REPORT_SELECT_FIELDS)
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read Supabase XML report: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return normalizeSupabaseXmlReadinessReportRow(
    data as SupabaseXmlReadinessReportRow
  );
}

export async function createAuthenticatedXmlUploadRecord(
  context: AuthenticatedXmlUploadContext,
  input: CreateXmlUploadRecordInput
): Promise<XmlUploadRecord> {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("xml_readiness_reports")
    .insert(
      buildSupabaseXmlReadinessReportValues(
        input,
        workspace.organizationId,
        context.userId
      )
    )
    .select(XML_REPORT_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create Supabase XML report: ${error.message}`);
  }

  const record = normalizeSupabaseXmlReadinessReportRow(
    data as SupabaseXmlReadinessReportRow
  );

  try {
    await replaceXmlReadinessRelationalRows(
      supabase,
      workspace.organizationId,
      record.id,
      input
    );
  } catch (relationalError) {
    /*
     * Supabase client calls are not wrapped in a database transaction here.
     * If child-row persistence fails, remove the parent row to avoid a partial
     * XML readiness report. ON DELETE CASCADE clears any child rows that may
     * have been inserted before the failure.
     */
    await supabase
      .from("xml_readiness_reports")
      .delete()
      .eq("id", record.id)
      .eq("organization_id", workspace.organizationId);

    throw relationalError;
  }

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "xml_report.created",
    entityType: "xml_report",
    entityId: record.id,
    entityLabel: input.invoiceId !== "not_detected" ? input.invoiceId : input.fileName,
    severity: record.technicalStatus === "failed" ? "warning" : "info",
    metadata: buildXmlReportActivityMetadata(input)
  });

  return record;
}

export async function deleteAuthenticatedXmlUploadRecordById(
  context: AuthenticatedXmlUploadContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  /*
   * Child rows are linked with ON DELETE CASCADE, so deleting the parent report
   * also removes monetary totals, tax signals, profile signals, and findings.
   */
  const { data, error } = await supabase
    .from("xml_readiness_reports")
    .delete()
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .select(
      "id, file_name, detected_document, root_element, invoice_id, issue_date, currency, api_status, status, technical_status, readiness_status, document_status, calculation_status, profile_status, findings_count, seller_name, buyer_name, line_count, payable_amount, tax_amount"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Could not delete Supabase XML report: ${error.message}`);
  }

  if (!data) {
    return false;
  }

  const deletedReport = data as {
    id: string;
    file_name: string;
    detected_document: string;
    root_element: string;
    invoice_id: string;
    issue_date: string;
    currency: string;
    api_status: string;
    status: string;
    technical_status: string;
    readiness_status: string;
    document_status: string;
    calculation_status: string;
    profile_status: string;
    findings_count: number;
    seller_name: string;
    buyer_name: string;
    line_count: number;
    payable_amount: string;
    tax_amount: string;
  };

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "xml_report.deleted",
    entityType: "xml_report",
    entityId: deletedReport.id,
    entityLabel:
      deletedReport.invoice_id && deletedReport.invoice_id !== "not_detected"
        ? deletedReport.invoice_id
        : deletedReport.file_name || deletedReport.id,
    severity: deletedReport.technical_status === "failed" ? "warning" : "info",
    metadata: {
      fileName: deletedReport.file_name,
      detectedDocument: deletedReport.detected_document,
      rootElement: deletedReport.root_element,
      invoiceId: deletedReport.invoice_id,
      issueDate: deletedReport.issue_date,
      currency: deletedReport.currency,
      apiStatus: deletedReport.api_status,
      status: deletedReport.status,
      technicalStatus: deletedReport.technical_status,
      readinessStatus: deletedReport.readiness_status,
      documentStatus: deletedReport.document_status,
      calculationStatus: deletedReport.calculation_status,
      profileStatus: deletedReport.profile_status,
      findingsCount: deletedReport.findings_count,
      sellerName: deletedReport.seller_name,
      buyerName: deletedReport.buyer_name,
      lineCount: deletedReport.line_count,
      payableAmount: deletedReport.payable_amount,
      taxAmount: deletedReport.tax_amount
    }
  });

  return true;
}
