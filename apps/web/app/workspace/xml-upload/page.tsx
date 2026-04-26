"use client";

import type { ChangeEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Calculator,
  Database,
  FileCode2,
  FileInput,
  FileSearch,
  ShieldAlert,
  Trash2,
  Upload,
  X
} from "lucide-react";

type UploadStatus = "accepted" | "rejected";

type XmlFindingSeverity = "info" | "warning" | "fatal";

type XmlReadinessFinding = {
  code: string;
  severity: XmlFindingSeverity;
  field: string;
  message: string;
  confidence: "technical" | "readiness_simulation" | "review_required";
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
  status: UploadStatus;
  note: string;
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
  summary?: XmlUploadSummary;
};

type ApiXmlUploadListResponse = {
  records?: ApiXmlUploadRecord[];
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
  }
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

function formatMoneyValue(currency: string, value: string) {
  if (!value || value === "not_detected") {
    return "Not detected";
  }

  if (!currency || currency === "not_detected") {
    return value;
  }

  return `${currency} ${value}`;
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

  return {
    id: readStringField(record, "id", buildFallbackUploadId(record)),
    fileName: readStringField(record, "fileName", "unknown.xml"),
    fileSize: readStringField(record, "fileSize", "0 B"),
    uploadedAt: formatDateTimeFromString(uploadedAt),
    detectedDocument: readStringField(record, "detectedDocument", "unknown"),
    rootElement: readStringField(record, "rootElement", "unknown"),
    invoiceId: readStringField(record, "invoiceId", "not_detected"),
    status: isUploadStatus(record.status) ? record.status : "rejected",
    note: readStringField(record, "note", "Stored API XML upload record."),
    summary: normalizeUploadSummary(record.summary)
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
    }
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

export default function WorkspaceXmlUploadPage() {
  const [uploadHistory, setUploadHistory] = useState<XmlUploadRecord[]>([]);
  const [analysis, setAnalysis] = useState<XmlAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadLoadMessage, setUploadLoadMessage] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [deletingUploadId, setDeletingUploadId] = useState("");

  const acceptedUploads = useMemo(() => {
    return uploadHistory.filter((upload) => upload.status === "accepted").length;
  }, [uploadHistory]);

  const rejectedUploads = useMemo(() => {
    return uploadHistory.filter((upload) => upload.status === "rejected").length;
  }, [uploadHistory]);

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
    const status = normalizeUploadStatus(apiData.status);
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
      apiStatus: apiData.status,
      technicalStatus: apiData.technicalStatus ?? "failed",
      readinessStatus: apiData.readinessStatus ?? "needs_attention",
      documentStatus: apiData.documentStatus ?? "unsupported",
      calculationStatus: apiData.calculationStatus ?? "not_checked",
      profileStatus: apiData.profileStatus ?? "unknown_profile",
      extractedData,
      findings,
      status,
      note: apiData.disclaimer,
      preview: xmlText.slice(0, 1400)
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
        status: nextAnalysis.status,
        note:
          status === "accepted"
            ? "Inspected through local API proxy."
            : "API returned review-required or unsupported XML status."
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
          <p>Max size</p>
          <strong>2MB</strong>
          <span>Frontend limit before production upload storage exists.</span>
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
4. apps/api extracts invoice fields, party names, line counts, totals, and tax signals
5. apps/api runs surface-level readiness and consistency checks
6. apps/api stores the inspection summary through the repository/storage boundary
7. workspace displays the readiness report and API-owned upload history

Backend endpoints:
POST   /api/v1/xml/inspect
GET    /api/v1/xml/uploads
DELETE /api/v1/xml/uploads/:id

Proxy endpoints:
POST   /api/local/xml/inspect
GET    /api/local/xml/uploads
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
              <p>Invoice Lantern readiness report</p>
              <h3>{analysis.fileName}</h3>
            </div>

            <button type="button" onClick={clearAnalysis}>
              <X size={16} />
              Clear preview
            </button>
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

              <strong>simulation</strong>

              <FileSearch size={17} />
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

          <div className="workspace-table">
            <div className="workspace-table-row">
              <div>
                <strong>Seller</strong>
                <span>{formatDetectedValue(analysis.extractedData.sellerName)}</span>
              </div>

              <div>
                <span>Buyer</span>
              </div>

              <div>
                <span>{formatDetectedValue(analysis.extractedData.buyerName)}</span>
              </div>

              <strong>{formatDetectedValue(analysis.extractedData.currency)}</strong>

              <Database size={17} />
            </div>

            <div className="workspace-table-row">
              <div>
                <strong>Line blocks</strong>
                <span>
                  Invoice lines: {analysis.extractedData.invoiceLineCount}. Credit
                  note lines: {analysis.extractedData.creditNoteLineCount}.
                </span>
              </div>

              <div>
                <span>Total lines</span>
              </div>

              <div>
                <span>{analysis.extractedData.lineCount}</span>
              </div>

              <strong>{analysis.detectedDocument}</strong>

              <FileCode2 size={17} />
            </div>

            <div className="workspace-table-row">
              <div>
                <strong>Payable amount</strong>
                <span>
                  {formatMoneyValue(
                    analysis.extractedData.currency,
                    analysis.extractedData.monetaryTotals.payableAmount
                  )}
                </span>
              </div>

              <div>
                <span>Tax amount</span>
              </div>

              <div>
                <span>
                  {formatMoneyValue(
                    analysis.extractedData.currency,
                    analysis.extractedData.monetaryTotals.taxAmount
                  )}
                </span>
              </div>

              <strong>
                {formatMoneyValue(
                  analysis.extractedData.currency,
                  analysis.extractedData.monetaryTotals.taxInclusiveAmount
                )}
              </strong>

              <Calculator size={17} />
            </div>

            <div className="workspace-table-row">
              <div>
                <strong>Tax signal</strong>
                <span>
                  Tax total:{" "}
                  {analysis.extractedData.taxSignal.taxTotalDetected
                    ? "detected"
                    : "not detected"}
                  . Tax category:{" "}
                  {analysis.extractedData.taxSignal.taxCategoryDetected
                    ? "detected"
                    : "not detected"}
                  .
                </span>
              </div>

              <div>
                <span>Tax rates</span>
              </div>

              <div>
                <span>{analysis.extractedData.taxSignal.taxRateCount}</span>
              </div>

              <strong>
                {analysis.extractedData.taxSignal.taxSubtotalDetected
                  ? "subtotal detected"
                  : "subtotal missing"}
              </strong>

              <ShieldAlert size={17} />
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
              <p>XML preview</p>
              <h3>First 1,400 characters</h3>
            </div>

            <div className="confidence-label">
              <FileSearch size={17} />
              API inspected
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
            API history
          </div>
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
          ) : (
            uploadHistory.map((upload) => (
              <div className="workspace-table-row" key={upload.id}>
                <div>
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

                  <button
                    type="button"
                    className="text-link-button"
                    onClick={(event) => deleteUploadRecord(event, upload)}
                    disabled={deletingUploadId === upload.id}
                    style={{
                      marginTop: "10px",
                      width: "fit-content",
                      padding: "8px 12px",
                      cursor:
                        deletingUploadId === upload.id ? "not-allowed" : "pointer"
                    }}
                  >
                    <Trash2 size={16} />
                    {deletingUploadId === upload.id
                      ? "Deleting..."
                      : "Delete upload"}
                  </button>
                </div>

                <div>
                  <span className="status-pill">
                    {upload.summary
                      ? formatStatus(upload.summary.readinessStatus)
                      : upload.status}
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
              parties, line counts, monetary totals, tax signals, and selected
              readiness indicators. It does not provide official XML, Peppol, EN
              16931, ViDA, legal, tax, accounting, government, or authority approval.
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
