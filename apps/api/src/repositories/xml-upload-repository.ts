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

  return normalizeSupabaseXmlReadinessReportRow(
    data as SupabaseXmlReadinessReportRow
  );
}

export async function deleteAuthenticatedXmlUploadRecordById(
  context: AuthenticatedXmlUploadContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("xml_readiness_reports")
    .delete()
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not delete Supabase XML report: ${error.message}`);
  }

  return Boolean(data);
}
