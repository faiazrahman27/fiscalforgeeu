"use client";

import type { ChangeEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Calculator,
  Database,
  Download,
  FileCode2,
  FileInput,
  FileSearch,
  Network,
  ShieldAlert,
  Trash2,
  Upload,
  X
} from "lucide-react";

type UploadStatus = "accepted" | "rejected";

type XmlFindingSeverity = "info" | "warning" | "fatal";

type XmlReadinessFilter =
  | "all"
  | "ready_for_review"
  | "needs_attention"
  | "unsupported";

type XmlDocumentFilter = "all" | "invoice" | "credit_note" | "unknown";

type XmlReadinessFinding = {
  code: string;
  severity: XmlFindingSeverity;
  field: string;
  message: string;
  confidence: "technical" | "readiness_simulation" | "review_required";
};

type XmlProfileSignal = {
  customizationId: string;
  profileId: string;
  profileHints: string[];
  ublNamespaceDetected: boolean;
  ublDocumentDetected: boolean;
  peppolSignalDetected: boolean;
  en16931SignalDetected: boolean;
  endpointCount: number;
  sellerEndpointId: string;
  sellerEndpointScheme: string;
  buyerEndpointId: string;
  buyerEndpointScheme: string;
  sellerCountry: string;
  buyerCountry: string;
  countryPair: string;
  crossBorderSignal: boolean;
  taxCategoryCodes: string[];
  vatPercentValues: string[];
  paymentMeansDetected: boolean;
  paymentTermsDetected: boolean;
  allowanceChargeDetected: boolean;
};

type XmlExtractedData = {
  sellerName: string;
  buyerName: string;
  lineCount: number;
  invoiceLineCount: number;
  creditNoteLineCount: number;
  currency: string;
  monetaryTotals: {
    lineExtensionAmount: string;
    taxExclusiveAmount: string;
    taxAmount: string;
    taxInclusiveAmount: string;
    payableAmount: string;
  };
  taxSignal: {
    taxTotalDetected: boolean;
    taxSubtotalDetected: boolean;
    taxCategoryDetected: boolean;
    taxRateCount: number;
  };
  profileSignal: XmlProfileSignal;
};

type XmlUploadSummary = {
  technicalStatus: "passed" | "failed";
  readinessStatus: "ready_for_review" | "needs_attention" | "unsupported";
  findingsCount: number;
  sellerName: string;
  buyerName: string;
  lineCount: number;
  payableAmount: string;
  taxAmount: string;
  currency: string;
};

type XmlUploadRecord = {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
  apiStatus: string;
  status: UploadStatus;
  note: string;
  disclaimer: string;
  technicalStatus: string;
  readinessStatus: string;
  documentStatus: string;
  calculationStatus: string;
  profileStatus: string;
  extractedData: XmlExtractedData;
  findings: XmlReadinessFinding[];
  summary?: XmlUploadSummary;
};

type XmlAnalysis = {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
  apiStatus: string;
  technicalStatus: string;
  readinessStatus: string;
  documentStatus: string;
  calculationStatus: string;
  profileStatus: string;
  extractedData: XmlExtractedData;
  findings: XmlReadinessFinding[];
  status: UploadStatus;
  note: string;
  preview: string;
  sourceMode: "live_upload" | "saved_report";
};

type ApiXmlUploadRecord = {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate?: string;
  currency?: string;
  apiStatus?: string;
  status: string;
  note: string;
  disclaimer?: string;
  technicalStatus?: string;
  readinessStatus?: string;
  documentStatus?: string;
  calculationStatus?: string;
  profileStatus?: string;
  extractedData?: XmlExtractedData;
  findings?: XmlReadinessFinding[];
  summary?: XmlUploadSummary;
};

type ApiXmlUploadListResponse = {
  records?: ApiXmlUploadRecord[];
};

type ApiXmlUploadDetailResponse = {
  record?: ApiXmlUploadRecord;
};

type ApiXmlInspectResponse = {
  uploadInspectionId: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
  status: string;
  technicalStatus?: string;
  readinessStatus?: string;
  documentStatus?: string;
  calculationStatus?: string;
  profileStatus?: string;
  extractedData?: XmlExtractedData;
  findings?: XmlReadinessFinding[];
  disclaimer: string;
  record?: ApiXmlUploadRecord;
};

const MAX_XML_FILE_SIZE_BYTES = 1024 * 1024 * 2;

const SAVED_REPORT_PREVIEW =
  "This saved report was reopened from API-owned upload history. Invoice Lantern stores the readiness result, extracted data, findings, and metadata, but it does not store the raw XML body in this development flow.";

const REPORT_DISCLAIMER =
  "Invoice Lantern performs a technical readiness simulation only. This result is not official XML, Peppol, EN 16931, ViDA, tax, legal, accounting, government, or authority validation.";

const emptyProfileSignal: XmlProfileSignal = {
  customizationId: "not_detected",
  profileId: "not_detected",
  profileHints: [],
  ublNamespaceDetected: false,
  ublDocumentDetected: false,
  peppolSignalDetected: false,
  en16931SignalDetected: false,
  endpointCount: 0,
  sellerEndpointId: "not_detected",
  sellerEndpointScheme: "not_detected",
  buyerEndpointId: "not_detected",
  buyerEndpointScheme: "not_detected",
  sellerCountry: "not_detected",
  buyerCountry: "not_detected",
  countryPair: "not_detected",
  crossBorderSignal: false,
  taxCategoryCodes: [],
  vatPercentValues: [],
  paymentMeansDetected: false,
  paymentTermsDetected: false,
  allowanceChargeDetected: false
};

const emptyExtractedData: XmlExtractedData = {
  sellerName: "not_detected",
  buyerName: "not_detected",
  lineCount: 0,
  invoiceLineCount: 0,
  creditNoteLineCount: 0,
  currency: "not_detected",
  monetaryTotals: {
    lineExtensionAmount: "not_detected",
    taxExclusiveAmount: "not_detected",
    taxAmount: "not_detected",
    taxInclusiveAmount: "not_detected",
    payableAmount: "not_detected"
  },
  taxSignal: {
    taxTotalDetected: false,
    taxSubtotalDetected: false,
    taxCategoryDetected: false,
    taxRateCount: 0
  },
  profileSignal: emptyProfileSignal
};

function formatDateTime(date: Date) {
  return date
    .toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
    .replace("T", " ");
}

function formatDateTimeFromString(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return formatDateTime(parsedDate);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatDetectedValue(value: string) {
  return value === "not_detected" ? "Not detected" : value;
}

function formatDetectionStatus(value: boolean) {
  return value ? "Detected" : "Not detected";
}

function formatMoneyValue(currency: string, value: string) {
  if (!value || value === "not_detected") {
    return "Not detected";
  }

  if (!currency || currency === "not_detected") {
    return value;
  }

  return `${currency} ${value}`;
}

function formatListValue(values: string[]) {
  return values.length > 0 ? values.join(", ") : "Not detected";
}

function formatEndpointValue(endpointId: string, schemeId: string) {
  if (!endpointId || endpointId === "not_detected") {
    return "Not detected";
  }

  if (!schemeId || schemeId === "not_detected") {
    return endpointId;
  }

  return `${endpointId} (${schemeId})`;
}

function isDetected(value: string) {
  return Boolean(value) && value !== "not_detected";
}

function isUploadStatus(value: unknown): value is UploadStatus {
  return value === "accepted" || value === "rejected";
}

function isFindingSeverity(value: unknown): value is XmlFindingSeverity {
  return value === "info" || value === "warning" || value === "fatal";
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback: string
) {
  const value = record[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback: number
) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallback;
}

function readBooleanField(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  const value = record[key];

  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function readStringArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function buildFallbackUploadId(record: Record<string, unknown>) {
  const fileName = readStringField(record, "fileName", "unknown.xml");
  const uploadedAt = readStringField(record, "uploadedAt", "unknown-time");

  return `${fileName}-${uploadedAt}`.replaceAll(/\s+/g, "-").toLowerCase();
}

function normalizeUploadSummary(value: unknown): XmlUploadSummary | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  return {
    technicalStatus: record.technicalStatus === "passed" ? "passed" : "failed",
    readinessStatus:
      record.readinessStatus === "ready_for_review" ||
      record.readinessStatus === "needs_attention" ||
      record.readinessStatus === "unsupported"
        ? record.readinessStatus
        : "needs_attention",
    findingsCount: readNumberField(record, "findingsCount", 0),
    sellerName: readStringField(record, "sellerName", "not_detected"),
    buyerName: readStringField(record, "buyerName", "not_detected"),
    lineCount: readNumberField(record, "lineCount", 0),
    payableAmount: readStringField(record, "payableAmount", "not_detected"),
    taxAmount: readStringField(record, "taxAmount", "not_detected"),
    currency: readStringField(record, "currency", "not_detected")
  };
}

function normalizeFinding(value: unknown): XmlReadinessFinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const code = readStringField(record, "code", "");

  if (!code) {
    return null;
  }

  const confidence = readStringField(
    record,
    "confidence",
    "readiness_simulation"
  );

  return {
    code,
    severity: isFindingSeverity(record.severity) ? record.severity : "info",
    field: readStringField(record, "field", "xml"),
    message: readStringField(
      record,
      "message",
      "Readiness finding returned without a message."
    ),
    confidence:
      confidence === "technical" ||
      confidence === "readiness_simulation" ||
      confidence === "review_required"
        ? confidence
        : "readiness_simulation"
  };
}

function normalizeFindings(value: unknown): XmlReadinessFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeFinding(item))
    .filter((item): item is XmlReadinessFinding => item !== null);
}

function normalizeProfileSignal(value: unknown): XmlProfileSignal {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyProfileSignal;
  }

  const record = value as Record<string, unknown>;

  return {
    customizationId: readStringField(record, "customizationId", "not_detected"),
    profileId: readStringField(record, "profileId", "not_detected"),
    profileHints: readStringArrayField(record, "profileHints"),
    ublNamespaceDetected: readBooleanField(
      record,
      "ublNamespaceDetected",
      false
    ),
    ublDocumentDetected: readBooleanField(record, "ublDocumentDetected", false),
    peppolSignalDetected: readBooleanField(
      record,
      "peppolSignalDetected",
      false
    ),
    en16931SignalDetected: readBooleanField(
      record,
      "en16931SignalDetected",
      false
    ),
    endpointCount: readNumberField(record, "endpointCount", 0),
    sellerEndpointId: readStringField(
      record,
      "sellerEndpointId",
      "not_detected"
    ),
    sellerEndpointScheme: readStringField(
      record,
      "sellerEndpointScheme",
      "not_detected"
    ),
    buyerEndpointId: readStringField(
      record,
      "buyerEndpointId",
      "not_detected"
    ),
    buyerEndpointScheme: readStringField(
      record,
      "buyerEndpointScheme",
      "not_detected"
    ),
    sellerCountry: readStringField(record, "sellerCountry", "not_detected"),
    buyerCountry: readStringField(record, "buyerCountry", "not_detected"),
    countryPair: readStringField(record, "countryPair", "not_detected"),
    crossBorderSignal: readBooleanField(record, "crossBorderSignal", false),
    taxCategoryCodes: readStringArrayField(record, "taxCategoryCodes"),
    vatPercentValues: readStringArrayField(record, "vatPercentValues"),
    paymentMeansDetected: readBooleanField(
      record,
      "paymentMeansDetected",
      false
    ),
    paymentTermsDetected: readBooleanField(
      record,
      "paymentTermsDetected",
      false
    ),
    allowanceChargeDetected: readBooleanField(
      record,
      "allowanceChargeDetected",
      false
    )
  };
}

function normalizeExtractedData(value: unknown): XmlExtractedData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyExtractedData;
  }

  const record = value as Record<string, unknown>;
  const monetaryTotals =
    record.monetaryTotals &&
    typeof record.monetaryTotals === "object" &&
    !Array.isArray(record.monetaryTotals)
      ? (record.monetaryTotals as Record<string, unknown>)
      : {};

  const taxSignal =
    record.taxSignal &&
    typeof record.taxSignal === "object" &&
    !Array.isArray(record.taxSignal)
      ? (record.taxSignal as Record<string, unknown>)
      : {};

  return {
    sellerName: readStringField(record, "sellerName", "not_detected"),
    buyerName: readStringField(record, "buyerName", "not_detected"),
    lineCount: readNumberField(record, "lineCount", 0),
    invoiceLineCount: readNumberField(record, "invoiceLineCount", 0),
    creditNoteLineCount: readNumberField(record, "creditNoteLineCount", 0),
    currency: readStringField(record, "currency", "not_detected"),
    monetaryTotals: {
      lineExtensionAmount: readStringField(
        monetaryTotals,
        "lineExtensionAmount",
        "not_detected"
      ),
      taxExclusiveAmount: readStringField(
        monetaryTotals,
        "taxExclusiveAmount",
        "not_detected"
      ),
      taxAmount: readStringField(monetaryTotals, "taxAmount", "not_detected"),
      taxInclusiveAmount: readStringField(
        monetaryTotals,
        "taxInclusiveAmount",
        "not_detected"
      ),
      payableAmount: readStringField(
        monetaryTotals,
        "payableAmount",
        "not_detected"
      )
    },
    taxSignal: {
      taxTotalDetected: taxSignal.taxTotalDetected === true,
      taxSubtotalDetected: taxSignal.taxSubtotalDetected === true,
      taxCategoryDetected: taxSignal.taxCategoryDetected === true,
      taxRateCount: readNumberField(taxSignal, "taxRateCount", 0)
    },
    profileSignal: normalizeProfileSignal(record.profileSignal)
  };
}

function normalizeUploadStatus(apiStatus: string): UploadStatus {
  return apiStatus === "parsed" ? "accepted" : "rejected";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readResponseBody(response: Response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function getApiErrorMessage(data: unknown, fallback = "The XML request failed.") {
  if (typeof data === "string" && data.trim().length > 0) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim().length > 0
    ? message
    : fallback;
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "_").slice(0, 180);
}

function sanitizeFileNamePart(value: string) {
  const cleaned = value
    .trim()
    .replace(/\.[^.]+$/u, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);

  return cleaned || "xml-report";
}

function buildExportFileName(analysis: XmlAnalysis) {
  const source =
    analysis.invoiceId !== "not_detected" ? analysis.invoiceId : analysis.fileName;

  const datePart = new Date().toISOString().slice(0, 10);

  return `invoice-lantern-${sanitizeFileNamePart(source)}-${datePart}.json`;
}

function buildExportPayload(analysis: XmlAnalysis) {
  return {
    platform: {
      name: "Invoice Lantern",
      productBoundary:
        "Independent e-invoice readiness and simulation platform. Not official government, tax authority, Peppol authority, EN 16931 certification, ViDA compliance, legal, accounting, or tax validation."
    },
    export: {
      exportedAt: new Date().toISOString(),
      exportFormat: "invoice_lantern_xml_readiness_report_json_v1",
      rawXmlIncluded: false,
      sourceMode: analysis.sourceMode
    },
    report: {
      id: analysis.id,
      fileName: analysis.fileName,
      fileSize: analysis.fileSize,
      uploadedAt: analysis.uploadedAt,
      detectedDocument: analysis.detectedDocument,
      rootElement: analysis.rootElement,
      invoiceId: analysis.invoiceId,
      issueDate: analysis.issueDate,
      currency: analysis.currency,
      apiStatus: analysis.apiStatus,
      technicalStatus: analysis.technicalStatus,
      readinessStatus: analysis.readinessStatus,
      documentStatus: analysis.documentStatus,
      calculationStatus: analysis.calculationStatus,
      profileStatus: analysis.profileStatus,
      uploadStatus: analysis.status
    },
    extractedData: analysis.extractedData,
    findings: analysis.findings,
    disclaimer: analysis.note || REPORT_DISCLAIMER
  };
}

function downloadJsonReport(analysis: XmlAnalysis) {
  const payload = buildExportPayload(analysis);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8"
  });

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = buildExportFileName(analysis);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(objectUrl);
}

function normalizeUploadRecord(value: unknown): XmlUploadRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const uploadedAt = readStringField(
    record,
    "uploadedAt",
    new Date().toISOString()
  );

  const summary = normalizeUploadSummary(record.summary);
  const detectedDocument = readStringField(record, "detectedDocument", "unknown");
  const apiStatus = readStringField(record, "apiStatus", "review_required");
  const currency = readStringField(
    record,
    "currency",
    summary?.currency ?? "not_detected"
  );

  return {
    id: readStringField(record, "id", buildFallbackUploadId(record)),
    fileName: readStringField(record, "fileName", "unknown.xml"),
    fileSize: readStringField(record, "fileSize", "0 B"),
    uploadedAt: formatDateTimeFromString(uploadedAt),
    detectedDocument,
    rootElement: readStringField(record, "rootElement", "unknown"),
    invoiceId: readStringField(record, "invoiceId", "not_detected"),
    issueDate: readStringField(record, "issueDate", "not_detected"),
    currency,
    apiStatus,
    status: isUploadStatus(record.status)
      ? record.status
      : normalizeUploadStatus(apiStatus),
    note: readStringField(record, "note", "Stored API XML upload record."),
    disclaimer: readStringField(record, "disclaimer", REPORT_DISCLAIMER),
    technicalStatus: readStringField(
      record,
      "technicalStatus",
      summary?.technicalStatus ?? "failed"
    ),
    readinessStatus: readStringField(
      record,
      "readinessStatus",
      summary?.readinessStatus ?? "needs_attention"
    ),
    documentStatus: readStringField(
      record,
      "documentStatus",
      detectedDocument === "unknown" ? "unsupported" : "recognized"
    ),
    calculationStatus: readStringField(
      record,
      "calculationStatus",
      "not_checked"
    ),
    profileStatus: readStringField(
      record,
      "profileStatus",
      detectedDocument === "unknown" ? "unknown_profile" : "ubl_surface_check"
    ),
    extractedData: normalizeExtractedData(record.extractedData),
    findings: normalizeFindings(record.findings),
    summary
  };
}

function buildAnalysisFromRecord(record: XmlUploadRecord): XmlAnalysis {
  return {
    id: record.id,
    fileName: record.fileName,
    fileSize: record.fileSize,
    uploadedAt: record.uploadedAt,
    detectedDocument: record.detectedDocument,
    rootElement: record.rootElement,
    invoiceId: record.invoiceId,
    issueDate: record.issueDate,
    currency: record.currency,
    apiStatus: record.apiStatus,
    technicalStatus: record.technicalStatus,
    readinessStatus: record.readinessStatus,
    documentStatus: record.documentStatus,
    calculationStatus: record.calculationStatus,
    profileStatus: record.profileStatus,
    extractedData: record.extractedData,
    findings: record.findings,
    status: record.status,
    note: record.disclaimer,
    preview: SAVED_REPORT_PREVIEW,
    sourceMode: "saved_report"
  };
}

function getUploadReadinessStatus(upload: XmlUploadRecord) {
  return upload.summary?.readinessStatus ?? upload.readinessStatus;
}

function getUploadDocumentType(upload: XmlUploadRecord) {
  if (
    upload.detectedDocument === "invoice" ||
    upload.detectedDocument === "credit_note"
  ) {
    return upload.detectedDocument;
  }

  return "unknown";
}

function getUploadSearchText(upload: XmlUploadRecord) {
  return [
    upload.fileName,
    upload.invoiceId,
    upload.issueDate,
    upload.currency,
    upload.detectedDocument,
    upload.rootElement,
    upload.note,
    upload.summary?.sellerName,
    upload.summary?.buyerName,
    upload.extractedData.sellerName,
    upload.extractedData.buyerName,
    upload.extractedData.profileSignal.customizationId,
    upload.extractedData.profileSignal.profileId,
    upload.extractedData.profileSignal.profileHints.join(" "),
    upload.findings.map((finding) => finding.code).join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uploadMatchesFilters({
  upload,
  searchQuery,
  readinessFilter,
  documentFilter
}: {
  upload: XmlUploadRecord;
  searchQuery: string;
  readinessFilter: XmlReadinessFilter;
  documentFilter: XmlDocumentFilter;
}) {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const matchesSearch =
    normalizedSearch.length === 0 ||
    getUploadSearchText(upload).includes(normalizedSearch);

  const matchesReadiness =
    readinessFilter === "all" || getUploadReadinessStatus(upload) === readinessFilter;

  const matchesDocument =
    documentFilter === "all" || getUploadDocumentType(upload) === documentFilter;

  return matchesSearch && matchesReadiness && matchesDocument;
}

export default function WorkspaceXmlUploadPage() {
  const [uploadHistory, setUploadHistory] = useState<XmlUploadRecord[]>([]);
  const [analysis, setAnalysis] = useState<XmlAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadLoadMessage, setUploadLoadMessage] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [deletingUploadId, setDeletingUploadId] = useState("");
  const [openingUploadId, setOpeningUploadId] = useState("");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [readinessFilter, setReadinessFilter] =
    useState<XmlReadinessFilter>("all");
  const [documentFilter, setDocumentFilter] = useState<XmlDocumentFilter>("all");

  const acceptedUploads = useMemo(() => {
    return uploadHistory.filter((upload) => upload.status === "accepted").length;
  }, [uploadHistory]);

  const rejectedUploads = useMemo(() => {
    return uploadHistory.filter((upload) => upload.status === "rejected").length;
  }, [uploadHistory]);

  const filteredUploadHistory = useMemo(() => {
    return uploadHistory.filter((upload) =>
      uploadMatchesFilters({
        upload,
        searchQuery: historySearchQuery,
        readinessFilter,
        documentFilter
      })
    );
  }, [uploadHistory, historySearchQuery, readinessFilter, documentFilter]);

  const hasActiveHistoryFilters =
    historySearchQuery.trim().length > 0 ||
    readinessFilter !== "all" ||
    documentFilter !== "all";

  useEffect(() => {
    let isMounted = true;

    async function loadUploadHistory() {
      setIsLoadingUploads(true);
      setUploadLoadMessage("");

      try {
        const response = await fetch("/api/local/xml/uploads", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setUploadHistory([]);
            setUploadLoadMessage(
              getApiErrorMessage(
                responseData,
                "Could not load XML upload history."
              )
            );
          }

          return;
        }

        const apiData = responseData as ApiXmlUploadListResponse;
        const records = Array.isArray(apiData?.records) ? apiData.records : [];

        const normalizedRecords = records
          .map((item) => normalizeUploadRecord(item))
          .filter((item): item is XmlUploadRecord => item !== null);

        if (isMounted) {
          setUploadHistory(normalizedRecords);
        }
      } catch {
        if (isMounted) {
          setUploadHistory([]);
          setUploadLoadMessage(
            "Could not load XML upload history. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingUploads(false);
        }
      }
    }

    loadUploadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  async function inspectXmlWithApi(file: File, xmlText: string) {
    const response = await fetch("/api/local/xml/inspect", {
      method: "POST",
      headers: {
        "content-type": "application/xml",
        "x-file-name": sanitizeHeaderValue(file.name),
        "x-file-size": String(file.size)
      },
      body: xmlText
    });

    const responseData = await readResponseBody(response);

    if (!response.ok) {
      throw new Error(
        getApiErrorMessage(responseData, "The XML inspection request failed.")
      );
    }

    const apiData = responseData as ApiXmlInspectResponse;
    const uploadedAt = formatDateTime(new Date());
    const apiStatus = apiData.status;
    const status = normalizeUploadStatus(apiStatus);
    const findings = normalizeFindings(apiData.findings);
    const extractedData = normalizeExtractedData(apiData.extractedData);

    const nextAnalysis: XmlAnalysis = {
      id: apiData.record?.id ?? apiData.uploadInspectionId,
      fileName: apiData.record?.fileName ?? file.name,
      fileSize: apiData.record?.fileSize ?? formatBytes(file.size),
      uploadedAt: apiData.record?.uploadedAt
        ? formatDateTimeFromString(apiData.record.uploadedAt)
        : uploadedAt,
      detectedDocument: apiData.detectedDocument,
      rootElement: apiData.rootElement,
      invoiceId: apiData.invoiceId,
      issueDate: apiData.issueDate,
      currency: apiData.currency,
      apiStatus,
      technicalStatus: apiData.technicalStatus ?? "failed",
      readinessStatus: apiData.readinessStatus ?? "needs_attention",
      documentStatus: apiData.documentStatus ?? "unsupported",
      calculationStatus: apiData.calculationStatus ?? "not_checked",
      profileStatus: apiData.profileStatus ?? "unknown_profile",
      extractedData,
      findings,
      status,
      note: apiData.disclaimer,
      preview: xmlText.slice(0, 1400),
      sourceMode: "live_upload"
    };

    const normalizedApiRecord = normalizeUploadRecord(apiData.record);

    const nextRecord: XmlUploadRecord =
      normalizedApiRecord ?? {
        id: apiData.uploadInspectionId,
        fileName: nextAnalysis.fileName,
        fileSize: nextAnalysis.fileSize,
        uploadedAt: nextAnalysis.uploadedAt,
        detectedDocument: nextAnalysis.detectedDocument,
        rootElement: nextAnalysis.rootElement,
        invoiceId: nextAnalysis.invoiceId,
        issueDate: nextAnalysis.issueDate,
        currency: nextAnalysis.currency,
        apiStatus: nextAnalysis.apiStatus,
        status: nextAnalysis.status,
        note:
          status === "accepted"
            ? "Inspected through local API proxy."
            : "API returned review-required or unsupported XML status.",
        disclaimer: nextAnalysis.note,
        technicalStatus: nextAnalysis.technicalStatus,
        readinessStatus: nextAnalysis.readinessStatus,
        documentStatus: nextAnalysis.documentStatus,
        calculationStatus: nextAnalysis.calculationStatus,
        profileStatus: nextAnalysis.profileStatus,
        extractedData: nextAnalysis.extractedData,
        findings: nextAnalysis.findings
      };

    setAnalysis(nextAnalysis);
    setUploadHistory((current) => {
      const nextRecords = [
        nextRecord,
        ...current.filter((upload) => upload.id !== nextRecord.id)
      ];

      return nextRecords.slice(0, 250);
    });
    setUploadLoadMessage("");
  }

  async function openSavedUploadReport(
    event: MouseEvent<HTMLButtonElement>,
    upload: XmlUploadRecord
  ) {
    event.preventDefault();
    event.stopPropagation();

    setOpeningUploadId(upload.id);
    setUploadLoadMessage("");

    try {
      const response = await fetch(
        `/api/local/xml/uploads/${encodeURIComponent(upload.id)}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setUploadLoadMessage(
          getApiErrorMessage(responseData, "Could not open saved XML report.")
        );
        return;
      }

      const apiData = responseData as ApiXmlUploadDetailResponse;
      const normalizedRecord = normalizeUploadRecord(apiData.record);

      if (!normalizedRecord) {
        setUploadLoadMessage("The saved XML report record could not be read.");
        return;
      }

      setAnalysis(buildAnalysisFromRecord(normalizedRecord));
      setUploadHistory((current) => {
        return current.map((item) =>
          item.id === normalizedRecord.id ? normalizedRecord : item
        );
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } catch {
      setUploadLoadMessage(
        "Could not open saved XML report. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setOpeningUploadId("");
    }
  }

  async function deleteUploadRecord(
    event: MouseEvent<HTMLButtonElement>,
    upload: XmlUploadRecord
  ) {
    event.preventDefault();
    event.stopPropagation();

    setDeletingUploadId(upload.id);
    setUploadLoadMessage("");

    try {
      const response = await fetch(
        `/api/local/xml/uploads/${encodeURIComponent(upload.id)}`,
        {
          method: "DELETE",
          cache: "no-store"
        }
      );

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setUploadLoadMessage(
          getApiErrorMessage(responseData, "Could not delete XML upload record.")
        );
        return;
      }

      setUploadHistory((current) =>
        current.filter((item) => item.id !== upload.id)
      );

      if (analysis?.id === upload.id) {
        setAnalysis(null);
      }
    } catch {
      setUploadLoadMessage(
        "Could not delete XML upload record. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setDeletingUploadId("");
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setErrorMessage("");
    setAnalysis(null);

    if (!file) {
      return;
    }

    const isXmlByName = file.name.toLowerCase().endsWith(".xml");
    const isXmlByType =
      file.type === "text/xml" ||
      file.type === "application/xml" ||
      file.type === "";

    if (!isXmlByName || !isXmlByType) {
      setErrorMessage("Upload rejected. Please select a valid .xml file.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_XML_FILE_SIZE_BYTES) {
      setErrorMessage("Upload rejected. XML file size must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsInspecting(true);

    try {
      const xmlText = await file.text();
      await inspectXmlWithApi(file, xmlText);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not inspect XML. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsInspecting(false);
      event.target.value = "";
    }
  }

  function clearAnalysis() {
    setAnalysis(null);
    setErrorMessage("");
  }

  function clearHistoryFilters() {
    setHistorySearchQuery("");
    setReadinessFilter("all");
    setDocumentFilter("all");
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">XML Upload</p>
        <h2>Run an e-invoice readiness simulation from XML.</h2>
        <p>
          Upload a local XML file to inspect document structure, key invoice
          fields, totals, tax signals, readiness status, and review findings.
          Invoice Lantern gives a technical simulation before official submission
          or professional review.
        </p>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Recent uploads</p>
          <strong>{uploadHistory.length}</strong>
          <span>Records loaded from the API-owned XML upload history.</span>
        </div>

        <div className="workspace-stat">
          <p>Accepted</p>
          <strong>{acceptedUploads}</strong>
          <span>Files that the API inspection classified as parseable.</span>
        </div>

        <div className="workspace-stat">
          <p>Rejected</p>
          <strong>{rejectedUploads}</strong>
          <span>Invalid, unsupported, or review-required XML entries.</span>
        </div>

        <div className="workspace-stat">
          <p>Visible reports</p>
          <strong>{filteredUploadHistory.length}</strong>
          <span>Reports currently matching the search and filters.</span>
        </div>
      </section>

      <section className="developer-console">
        <div className="developer-console-head">
          <div>
            <p>Local XML file</p>
            <h3>Upload invoice XML</h3>
          </div>

          <label className="text-link-button">
            <Upload size={16} />
            {isInspecting ? "Inspecting..." : "Select XML"}
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={handleFileChange}
              style={{ display: "none" }}
              disabled={isInspecting}
            />
          </label>
        </div>

        <pre>{`Current flow:
1. select .xml file
2. browser checks file extension and size
3. Next.js route handler forwards XML and file metadata to apps/api
4. apps/api extracts invoice fields, party names, line counts, totals, tax signals, and profile signals
5. apps/api runs surface-level readiness and consistency checks
6. apps/api stores the inspection summary through the repository/storage boundary
7. workspace displays the readiness report and API-owned upload history
8. saved reports can be reopened from history without re-uploading XML
9. current reports can be exported as JSON readiness reports

Backend endpoints:
POST   /api/v1/xml/inspect
GET    /api/v1/xml/uploads
GET    /api/v1/xml/uploads/:id
DELETE /api/v1/xml/uploads/:id

Proxy endpoints:
POST   /api/local/xml/inspect
GET    /api/local/xml/uploads
GET    /api/local/xml/uploads/:id
DELETE /api/local/xml/uploads/:id`}</pre>

        {errorMessage ? (
          <div className="alert-item">
            <span />
            <p>{errorMessage}</p>
          </div>
        ) : null}
      </section>

      {analysis ? (
        <section className="workspace-table-shell">
          <div className="workspace-table-head">
            <div>
              <p>
                {analysis.sourceMode === "saved_report"
                  ? "Saved readiness report"
                  : "Invoice Lantern readiness report"}
              </p>
              <h3>{analysis.fileName}</h3>
            </div>

            <div className="workspace-row-actions">
              <button type="button" onClick={() => downloadJsonReport(analysis)}>
                <Download size={16} />
                Download report JSON
              </button>

              <button type="button" onClick={clearAnalysis}>
                <X size={16} />
                Clear preview
              </button>
            </div>
          </div>

          <div className="workspace-table">
            <div className="workspace-table-row">
              <div>
                <strong>Technical status</strong>
                <span>{formatStatus(analysis.technicalStatus)}</span>
              </div>

              <div>
                <span className="status-pill">
                  {formatStatus(analysis.readinessStatus)}
                </span>
              </div>

              <div>
                <span>{formatStatus(analysis.documentStatus)}</span>
              </div>

              <strong>{formatStatus(analysis.profileStatus)}</strong>

              {analysis.technicalStatus === "passed" ? (
                <BadgeCheck size={17} />
              ) : (
                <AlertTriangle size={17} />
              )}
            </div>

            <div className="workspace-table-row">
              <div>
                <strong>Detected document</strong>
                <span>{analysis.detectedDocument}</span>
              </div>

              <div>
                <FileCode2 size={15} />
                <span>{analysis.rootElement}</span>
              </div>

              <div>
                <span>{analysis.uploadedAt}</span>
              </div>

              <strong>{analysis.apiStatus}</strong>

              {analysis.status === "accepted" ? (
                <BadgeCheck size={17} />
              ) : (
                <AlertTriangle size={17} />
              )}
            </div>

            <div className="workspace-table-row">
              <div>
                <strong>Invoice ID</strong>
                <span>{formatDetectedValue(analysis.invoiceId)}</span>
              </div>

              <div>
                <span>{formatDetectedValue(analysis.issueDate)}</span>
              </div>

              <div>
                <span>{analysis.fileSize}</span>
              </div>

              <strong>{formatDetectedValue(analysis.currency)}</strong>

              <Database size={17} />
            </div>

            <div className="workspace-table-row">
              <div>
                <strong>Calculation status</strong>
                <span>{formatStatus(analysis.calculationStatus)}</span>
              </div>

              <div>
                <span>Findings</span>
              </div>

              <div>
                <span>{analysis.findings.length}</span>
              </div>

              <strong>
                {analysis.sourceMode === "saved_report" ? "saved" : "simulation"}
              </strong>

              <FileSearch size={17} />
            </div>
          </div>
        </section>
      ) : null}

      {analysis ? (
        <section className="workspace-table-shell">
          <div className="workspace-table-head">
            <div>
              <p>Format and profile signals</p>
              <h3>Detected e-invoice format context</h3>
            </div>

            <div className="confidence-label">
              <Network size={17} />
              profile simulation
            </div>
          </div>

          <div className="workspace-data-grid">
            <div
              className={
                analysis.extractedData.profileSignal.ublDocumentDetected
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>UBL document signal</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.profileSignal.ublDocumentDetected
                )}
              </strong>
              <span>
                Root, namespace, and UBL invoice structure surface signal.
              </span>
            </div>

            <div
              className={
                analysis.extractedData.profileSignal.en16931SignalDetected
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>EN 16931 signal</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.profileSignal.en16931SignalDetected
                )}
              </strong>
              <span>Detected from CustomizationID/ProfileID surface values.</span>
            </div>

            <div
              className={
                analysis.extractedData.profileSignal.peppolSignalDetected
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Peppol BIS signal</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.profileSignal.peppolSignalDetected
                )}
              </strong>
              <span>Profile hint only. Not Peppol authority validation.</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.profileSignal.customizationId)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>CustomizationID</p>
              <strong>
                {formatDetectedValue(
                  analysis.extractedData.profileSignal.customizationId
                )}
              </strong>
              <span>Used for format/profile readiness classification.</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.profileSignal.profileId)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>ProfileID</p>
              <strong>
                {formatDetectedValue(analysis.extractedData.profileSignal.profileId)}
              </strong>
              <span>Business-process profile signal.</span>
            </div>

            <div
              className={
                analysis.extractedData.profileSignal.endpointCount > 0
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Electronic endpoints</p>
              <strong>{analysis.extractedData.profileSignal.endpointCount}</strong>
              <span>EndpointID values detected in the XML.</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.profileSignal.sellerEndpointId)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Seller endpoint</p>
              <strong>
                {formatEndpointValue(
                  analysis.extractedData.profileSignal.sellerEndpointId,
                  analysis.extractedData.profileSignal.sellerEndpointScheme
                )}
              </strong>
              <span>Seller electronic addressing signal.</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.profileSignal.buyerEndpointId)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Buyer endpoint</p>
              <strong>
                {formatEndpointValue(
                  analysis.extractedData.profileSignal.buyerEndpointId,
                  analysis.extractedData.profileSignal.buyerEndpointScheme
                )}
              </strong>
              <span>Buyer electronic addressing signal.</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.profileSignal.sellerCountry)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Seller country</p>
              <strong>
                {formatDetectedValue(
                  analysis.extractedData.profileSignal.sellerCountry
                )}
              </strong>
              <span>Supplier country signal.</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.profileSignal.buyerCountry)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Buyer country</p>
              <strong>
                {formatDetectedValue(
                  analysis.extractedData.profileSignal.buyerCountry
                )}
              </strong>
              <span>Customer country signal.</span>
            </div>

            <div
              className={
                analysis.extractedData.profileSignal.crossBorderSignal
                  ? "workspace-data-card is-warn"
                  : "workspace-data-card"
              }
            >
              <p>Cross-border signal</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.profileSignal.crossBorderSignal
                )}
              </strong>
              <span>
                {analysis.extractedData.profileSignal.countryPair === "not_detected"
                  ? "Country pair not detected."
                  : analysis.extractedData.profileSignal.countryPair}
              </span>
            </div>

            <div
              className={
                analysis.extractedData.profileSignal.taxCategoryCodes.length > 0
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Tax category codes</p>
              <strong>
                {formatListValue(
                  analysis.extractedData.profileSignal.taxCategoryCodes
                )}
              </strong>
              <span>TaxCategory.ID values.</span>
            </div>

            <div
              className={
                analysis.extractedData.profileSignal.vatPercentValues.length > 0
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>VAT percent values</p>
              <strong>
                {formatListValue(
                  analysis.extractedData.profileSignal.vatPercentValues
                )}
              </strong>
              <span>TaxCategory.Percent values.</span>
            </div>

            <div
              className={
                analysis.extractedData.profileSignal.paymentMeansDetected
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Payment means</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.profileSignal.paymentMeansDetected
                )}
              </strong>
              <span>PaymentMeans block signal.</span>
            </div>

            <div
              className={
                analysis.extractedData.profileSignal.paymentTermsDetected
                  ? "workspace-data-card is-good"
                  : "workspace-data-card"
              }
            >
              <p>Payment terms</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.profileSignal.paymentTermsDetected
                )}
              </strong>
              <span>PaymentTerms block signal.</span>
            </div>

            <div
              className={
                analysis.extractedData.profileSignal.allowanceChargeDetected
                  ? "workspace-data-card is-warn"
                  : "workspace-data-card"
              }
            >
              <p>Allowance or charge</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.profileSignal.allowanceChargeDetected
                )}
              </strong>
              <span>Useful for interpreting payable total differences.</span>
            </div>

            <div className="workspace-data-card is-wide">
              <p>Profile hints</p>
              <strong>
                {formatListValue(analysis.extractedData.profileSignal.profileHints)}
              </strong>
              <span>
                These are readiness simulation hints only. They do not certify legal,
                tax, EN 16931, ViDA, Peppol, government, or authority compliance.
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {analysis ? (
        <section className="workspace-table-shell">
          <div className="workspace-table-head">
            <div>
              <p>Extracted invoice data</p>
              <h3>Parties, lines, totals, and tax signals</h3>
            </div>

            <div className="confidence-label">
              <Calculator size={17} />
              surface extraction
            </div>
          </div>

          <div className="workspace-data-grid">
            <div
              className={
                isDetected(analysis.extractedData.sellerName)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Seller</p>
              <strong>
                {formatDetectedValue(analysis.extractedData.sellerName)}
              </strong>
              <span>AccountingSupplierParty</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.buyerName)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Buyer</p>
              <strong>
                {formatDetectedValue(analysis.extractedData.buyerName)}
              </strong>
              <span>AccountingCustomerParty</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.currency)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Currency</p>
              <strong>{formatDetectedValue(analysis.extractedData.currency)}</strong>
              <span>DocumentCurrencyCode</span>
            </div>

            <div
              className={
                analysis.extractedData.lineCount > 0
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Document lines</p>
              <strong>{analysis.extractedData.lineCount}</strong>
              <span>Total invoice or credit note line blocks.</span>
            </div>

            <div className="workspace-data-card">
              <p>Invoice lines</p>
              <strong>{analysis.extractedData.invoiceLineCount}</strong>
              <span>InvoiceLine blocks detected.</span>
            </div>

            <div className="workspace-data-card">
              <p>Credit note lines</p>
              <strong>{analysis.extractedData.creditNoteLineCount}</strong>
              <span>CreditNoteLine blocks detected.</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.monetaryTotals.payableAmount)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Payable amount</p>
              <strong>
                {formatMoneyValue(
                  analysis.extractedData.currency,
                  analysis.extractedData.monetaryTotals.payableAmount
                )}
              </strong>
              <span>LegalMonetaryTotal.PayableAmount</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.monetaryTotals.taxAmount)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Tax amount</p>
              <strong>
                {formatMoneyValue(
                  analysis.extractedData.currency,
                  analysis.extractedData.monetaryTotals.taxAmount
                )}
              </strong>
              <span>TaxTotal.TaxAmount</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.monetaryTotals.taxInclusiveAmount)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Tax inclusive amount</p>
              <strong>
                {formatMoneyValue(
                  analysis.extractedData.currency,
                  analysis.extractedData.monetaryTotals.taxInclusiveAmount
                )}
              </strong>
              <span>LegalMonetaryTotal.TaxInclusiveAmount</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.monetaryTotals.lineExtensionAmount)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Line extension amount</p>
              <strong>
                {formatMoneyValue(
                  analysis.extractedData.currency,
                  analysis.extractedData.monetaryTotals.lineExtensionAmount
                )}
              </strong>
              <span>LegalMonetaryTotal.LineExtensionAmount</span>
            </div>

            <div
              className={
                isDetected(analysis.extractedData.monetaryTotals.taxExclusiveAmount)
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Tax exclusive amount</p>
              <strong>
                {formatMoneyValue(
                  analysis.extractedData.currency,
                  analysis.extractedData.monetaryTotals.taxExclusiveAmount
                )}
              </strong>
              <span>LegalMonetaryTotal.TaxExclusiveAmount</span>
            </div>

            <div
              className={
                analysis.calculationStatus === "inconsistent"
                  ? "workspace-data-card is-danger"
                  : analysis.calculationStatus === "surface_checked"
                    ? "workspace-data-card is-good"
                    : "workspace-data-card is-warn"
              }
            >
              <p>Calculation status</p>
              <strong>{formatStatus(analysis.calculationStatus)}</strong>
              <span>Surface-level monetary consistency signal.</span>
            </div>

            <div
              className={
                analysis.extractedData.taxSignal.taxTotalDetected
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Tax total</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.taxSignal.taxTotalDetected
                )}
              </strong>
              <span>TaxTotal block.</span>
            </div>

            <div
              className={
                analysis.extractedData.taxSignal.taxCategoryDetected
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Tax category</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.taxSignal.taxCategoryDetected
                )}
              </strong>
              <span>TaxCategory block.</span>
            </div>

            <div
              className={
                analysis.extractedData.taxSignal.taxSubtotalDetected
                  ? "workspace-data-card is-good"
                  : "workspace-data-card is-warn"
              }
            >
              <p>Tax subtotal</p>
              <strong>
                {formatDetectionStatus(
                  analysis.extractedData.taxSignal.taxSubtotalDetected
                )}
              </strong>
              <span>TaxSubtotal block.</span>
            </div>

            <div className="workspace-data-card">
              <p>Tax rates</p>
              <strong>{analysis.extractedData.taxSignal.taxRateCount}</strong>
              <span>Percent tags detected in the XML.</span>
            </div>

            <div className="workspace-data-card is-wide">
              <p>Document profile signal</p>
              <strong>{formatStatus(analysis.profileStatus)}</strong>
              <span>
                This is a surface-level profile signal. Official Peppol, EN 16931,
                ViDA, tax, legal, or authority validation is not performed here.
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {analysis ? (
        <section className="findings-console">
          <div className="findings-console-head">
            <div>
              <p>Readiness findings</p>
              <h3>Technical checks and review signals</h3>
            </div>

            <div className="confidence-label">
              <ShieldAlert size={17} />
              {analysis.findings.length > 0 ? "review findings" : "no findings"}
            </div>
          </div>

          <div className="finding-console-list">
            {analysis.findings.length === 0 ? (
              <div className="finding-console-row">
                <BadgeCheck size={18} />

                <div>
                  <strong>NO_FINDINGS_RETURNED</strong>
                  <p>The XML readiness simulation did not return findings.</p>
                </div>

                <span>info</span>
              </div>
            ) : (
              analysis.findings.map((finding) => (
                <div
                  className="finding-console-row"
                  key={`${finding.code}-${finding.field}`}
                >
                  {finding.severity === "info" ? (
                    <BadgeCheck size={18} />
                  ) : (
                    <AlertTriangle size={18} />
                  )}

                  <div>
                    <strong>{finding.code}</strong>
                    <p>{finding.message}</p>
                    <p>
                      Field: {finding.field}. Confidence:{" "}
                      {formatStatus(finding.confidence)}.
                    </p>
                  </div>

                  <span>{finding.severity}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {analysis ? (
        <section className="developer-console">
          <div className="developer-console-head">
            <div>
              <p>
                {analysis.sourceMode === "saved_report"
                  ? "Saved report source"
                  : "XML preview"}
              </p>
              <h3>
                {analysis.sourceMode === "saved_report"
                  ? "Stored result without raw XML"
                  : "First 1,400 characters"}
              </h3>
            </div>

            <div className="confidence-label">
              <FileSearch size={17} />
              {analysis.sourceMode === "saved_report"
                ? "API history"
                : "API inspected"}
            </div>
          </div>

          <pre>{analysis.preview}</pre>
        </section>
      ) : null}

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Recent XML uploads</p>
            <h3>API-owned upload history</h3>
          </div>

          <div className="confidence-label">
            <FileInput size={17} />
            {filteredUploadHistory.length} visible
          </div>
        </div>

        <div className="workspace-history-filters">
          <label>
            <span>Search reports</span>
            <input
              type="search"
              value={historySearchQuery}
              placeholder="File, invoice ID, seller, buyer, profile, finding..."
              onChange={(event) => setHistorySearchQuery(event.target.value)}
            />
          </label>

          <label>
            <span>Readiness</span>
            <select
              value={readinessFilter}
              onChange={(event) =>
                setReadinessFilter(event.target.value as XmlReadinessFilter)
              }
            >
              <option value="all">All readiness states</option>
              <option value="ready_for_review">Ready for review</option>
              <option value="needs_attention">Needs attention</option>
              <option value="unsupported">Unsupported</option>
            </select>
          </label>

          <label>
            <span>Document type</span>
            <select
              value={documentFilter}
              onChange={(event) =>
                setDocumentFilter(event.target.value as XmlDocumentFilter)
              }
            >
              <option value="all">All document types</option>
              <option value="invoice">Invoice</option>
              <option value="credit_note">Credit note</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <button
            type="button"
            className="text-link-button"
            onClick={clearHistoryFilters}
            disabled={!hasActiveHistoryFilters}
          >
            <X size={16} />
            Clear filters
          </button>
        </div>

        {uploadLoadMessage ? (
          <div className="alert-item">
            <span />
            <p>{uploadLoadMessage}</p>
          </div>
        ) : null}

        <div className="workspace-table">
          {isLoadingUploads ? (
            <div className="workspace-table-row">
              <div>
                <strong>Loading XML upload history</strong>
                <span>Reading records from the local API proxy.</span>
              </div>

              <div>
                <span className="status-pill">loading</span>
              </div>

              <div>
                <span>pending</span>
              </div>

              <strong>API</strong>

              <FileCode2 size={17} />
            </div>
          ) : uploadHistory.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No XML uploads yet</strong>
                <span>Upload an XML file to create an API-owned inspection record.</span>
              </div>

              <div>
                <span className="status-pill">empty</span>
              </div>

              <div>
                <span>waiting</span>
              </div>

              <strong>0 B</strong>

              <FileCode2 size={17} />
            </div>
          ) : filteredUploadHistory.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No reports match these filters</strong>
                <span>
                  Adjust the search text, readiness filter, or document type filter.
                </span>
              </div>

              <div>
                <span className="status-pill">filtered</span>
              </div>

              <div>
                <span>{uploadHistory.length} total</span>
              </div>

              <strong>0 visible</strong>

              <FileSearch size={17} />
            </div>
          ) : (
            filteredUploadHistory.map((upload) => (
              <div className="workspace-table-row" key={upload.id}>
                <div className="workspace-history-summary">
                  <strong>{upload.fileName}</strong>
                  <span>{upload.note}</span>

                  {upload.summary ? (
                    <span>
                      {formatDetectedValue(upload.summary.sellerName)} to{" "}
                      {formatDetectedValue(upload.summary.buyerName)}. Lines:{" "}
                      {upload.summary.lineCount}. Findings:{" "}
                      {upload.summary.findingsCount}.
                    </span>
                  ) : null}

                  <div className="workspace-row-actions">
                    <button
                      type="button"
                      className="text-link-button"
                      onClick={(event) => openSavedUploadReport(event, upload)}
                      disabled={openingUploadId === upload.id}
                    >
                      <FileSearch size={16} />
                      {openingUploadId === upload.id
                        ? "Opening..."
                        : "Open report"}
                    </button>

                    <button
                      type="button"
                      className="text-link-button"
                      onClick={(event) => deleteUploadRecord(event, upload)}
                      disabled={deletingUploadId === upload.id}
                    >
                      <Trash2 size={16} />
                      {deletingUploadId === upload.id
                        ? "Deleting..."
                        : "Delete upload"}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="status-pill">
                    {formatStatus(getUploadReadinessStatus(upload))}
                  </span>
                </div>

                <div>
                  <span>{upload.detectedDocument}</span>
                </div>

                <strong>
                  {upload.summary
                    ? formatMoneyValue(
                        upload.summary.currency,
                        upload.summary.payableAmount
                      )
                    : upload.fileSize}
                </strong>

                <FileCode2 size={17} />
              </div>
            ))
          )}
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />

          <div>
            <p>Boundary notice</p>
            <h3>Readiness simulation, not official validation.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              Invoice Lantern checks XML structure, key invoice fields, extracted
              parties, line counts, monetary totals, tax signals, profile signals,
              and selected readiness indicators. It does not provide official XML,
              Peppol, EN 16931, ViDA, legal, tax, accounting, government, or
              authority approval.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              A production upload pipeline must include authentication, object
              authorization, hardened XML parsing, schema validation, malware-safe file
              handling, audit logging, and retention controls.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              Do not upload sensitive real invoices until storage, privacy controls,
              authentication, and retention policies are implemented.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
