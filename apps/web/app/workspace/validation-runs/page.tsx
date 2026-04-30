"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Calculator,
  FileCheck2,
  FileCode2,
  Layers3,
  ShieldAlert,
  Trash2
} from "lucide-react";

type FindingSeverity = "info" | "warning" | "fatal" | "blocked";
type LegalConfidence =
  | "technical"
  | "standard_based"
  | "official_source_derived"
  | "educational_simulation"
  | "professional_review_required"
  | "review_required";

type ValidationLayerIconKey = "schema" | "calculation" | "ubl" | "legal";

type ValidationLayerCard = {
  iconKey: ValidationLayerIconKey;
  title: string;
  status: string;
  description: string;
};

type ValidationFinding = {
  code: string;
  severity: FindingSeverity;
  category?: string;
  field?: string;
  fieldPath?: string;
  message: string;
  fixSuggestion?: string;
  legalConfidence?: LegalConfidence;
  ruleSetCode?: string;
  ruleVersion?: string;
  sourceLabels?: string[];
};

type ValidationTotals = {
  lineExtensionAmount: number | string;
  taxExclusiveAmount: number | string;
  taxAmount: number | string;
  taxInclusiveAmount: number | string;
  payableAmount: number | string;
};

type ValidationReportFindingCounts = Record<FindingSeverity, number>;

type ValidationRunSummary = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  issueDate: string;
  createdAt: string;
  technicalStatus: string;
  standardStatus: string;
  countrySimulationStatus: string;
  vidaReadinessStatus: string;
  confidence: string;
  profile: string;
  currency: string;
  overallStatus: string;
  findingCounts: ValidationReportFindingCounts;
  findingsCount: number;
  payableAmount: number | string;
  reportLabel: string;
};

type SavedValidationRun = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  createdAt: string;
  technicalStatus: string;
  standardStatus: string;
  countrySimulationStatus: string;
  vidaReadinessStatus: string;
  confidence: string;
  profile: string;
  currency: string;
  totals: ValidationTotals;
  findings: ValidationFinding[];
  disclaimer: string;
};

type XmlUploadSummary = {
  technicalStatus?: string;
  readinessStatus?: string;
  findingsCount?: number;
  sellerName?: string;
  buyerName?: string;
  lineCount?: number;
  payableAmount?: string;
  taxAmount?: string;
  currency?: string;
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
  status: string;
  note: string;
  disclaimer: string;
  technicalStatus: string;
  readinessStatus: string;
  documentStatus: string;
  calculationStatus: string;
  profileStatus: string;
  findingsCount: number;
  summary?: XmlUploadSummary;
};

type ValidationRunListResponse = {
  records?: unknown[];
};

type ValidationRunDetailResponse = {
  record?: unknown;
};

type XmlUploadListResponse = {
  records?: unknown[];
};

type ReportQueueItem = {
  id: string;
  sourceType: "validation_run" | "xml_readiness";
  title: string;
  subtitle: string;
  createdAt: string;
  status: string;
  secondaryStatus: string;
  amountLabel: string;
  findingsCount: number;
  fatalCount: number;
  warningCount: number;
  invoiceNumber: string;
  currency: string;
  reportLabel: string;
  href: string;
  canDelete: boolean;
};

const EMPTY_FINDING_COUNTS: ValidationReportFindingCounts = {
  info: 0,
  warning: 0,
  fatal: 0,
  blocked: 0
};

const validationLayerCards: ValidationLayerCard[] = [
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

function getValidationIcon(iconKey: ValidationLayerIconKey) {
  const icons: Record<ValidationLayerIconKey, ReactNode> = {
    schema: <Layers3 size={22} />,
    calculation: <Calculator size={22} />,
    ubl: <FileCheck2 size={22} />,
    legal: <ShieldAlert size={22} />
  };

  return icons[iconKey];
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatLegalConfidence(value: LegalConfidence | undefined) {
  const labels: Record<LegalConfidence, string> = {
    technical: "Technical",
    standard_based: "Standard-based",
    official_source_derived: "Source-derived",
    educational_simulation: "Educational simulation",
    professional_review_required: "Professional review required",
    review_required: "Professional review required"
  };

  return value ? labels[value] : "Not labelled";
}

function formatDateTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate
    .toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
    .replace("T", " ");
}

function formatMoneyValue(currency: string, value: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${currency || "EUR"} ${value.toFixed(2)}`;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    if (value === "not_detected") {
      return "Not detected";
    }

    return currency && currency !== "not_detected" ? `${currency} ${value}` : value;
  }

  return "Not detected";
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

function readAmountField(
  record: Record<string, unknown>,
  key: string,
  fallback: number | string
) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function readFindingCounts(value: unknown): ValidationReportFindingCounts {
  if (!isPlainObject(value)) {
    return { ...EMPTY_FINDING_COUNTS };
  }

  return {
    info: readNumberField(value, "info", 0),
    warning: readNumberField(value, "warning", 0),
    fatal: readNumberField(value, "fatal", 0),
    blocked: readNumberField(value, "blocked", 0)
  };
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

function getApiErrorMessage(
  data: unknown,
  fallback = "The report history request failed."
) {
  if (typeof data === "string" && data.trim().length > 0) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const error = data.error;
  const message = error.message;

  return typeof message === "string" && message.trim().length > 0
    ? message
    : fallback;
}

function normalizeValidationRunSummary(
  value: unknown
): ValidationRunSummary | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id", "");

  if (!id) {
    return null;
  }

  return {
    id,
    invoiceNumber: readStringField(value, "invoiceNumber", "Untitled invoice"),
    buyer: readStringField(value, "buyer", "Unknown buyer"),
    seller: readStringField(value, "seller", "Unknown seller"),
    issueDate: readStringField(value, "issueDate", ""),
    createdAt: readStringField(value, "createdAt", new Date().toISOString()),
    technicalStatus: readStringField(value, "technicalStatus", "failed"),
    standardStatus: readStringField(value, "standardStatus", "warning"),
    countrySimulationStatus: readStringField(
      value,
      "countrySimulationStatus",
      "not_relevant"
    ),
    vidaReadinessStatus: readStringField(
      value,
      "vidaReadinessStatus",
      "not_relevant"
    ),
    confidence: readStringField(value, "confidence", "technical_preview"),
    profile: readStringField(value, "profile", "API_VALIDATION"),
    currency: readStringField(value, "currency", "EUR"),
    overallStatus: readStringField(
      value,
      "overallStatus",
      readStringField(value, "technicalStatus", "failed")
    ),
    findingCounts: readFindingCounts(value.findingCounts),
    findingsCount: readNumberField(value, "findingsCount", 0),
    payableAmount: readAmountField(value, "payableAmount", 0),
    reportLabel: readStringField(value, "reportLabel", "sandbox report")
  };
}

function normalizeValidationRunDetail(value: unknown): SavedValidationRun | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id", "");

  if (!id) {
    return null;
  }

  const findings = Array.isArray(value.findings)
    ? value.findings
        .map((finding) => normalizeFinding(finding))
        .filter((finding): finding is ValidationFinding => finding !== null)
    : [];

  return {
    id,
    invoiceNumber: readStringField(value, "invoiceNumber", "Untitled invoice"),
    buyer: readStringField(value, "buyer", "Unknown buyer"),
    seller: readStringField(value, "seller", "Unknown seller"),
    createdAt: readStringField(value, "createdAt", new Date().toISOString()),
    technicalStatus: readStringField(value, "technicalStatus", "failed"),
    standardStatus: readStringField(value, "standardStatus", "warning"),
    countrySimulationStatus: readStringField(
      value,
      "countrySimulationStatus",
      "not_relevant"
    ),
    vidaReadinessStatus: readStringField(
      value,
      "vidaReadinessStatus",
      "not_relevant"
    ),
    confidence: readStringField(value, "confidence", "technical_preview"),
    profile: readStringField(value, "profile", "API_VALIDATION"),
    currency: readStringField(value, "currency", "EUR"),
    totals: normalizeTotals(value.totals),
    findings,
    disclaimer: readStringField(
      value,
      "disclaimer",
      "This validation report is a development sandbox result. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
    )
  };
}

function normalizeFinding(value: unknown): ValidationFinding | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code", "");

  if (!code) {
    return null;
  }

  const severity =
    value.severity === "info" ||
    value.severity === "warning" ||
      value.severity === "fatal" ||
      value.severity === "blocked"
      ? value.severity
      : "info";

  return {
    code,
    severity,
    category: readStringField(value, "category", ""),
    field:
      typeof value.field === "string" && value.field.trim().length > 0
        ? value.field.trim()
        : undefined,
    fieldPath:
      typeof value.fieldPath === "string" && value.fieldPath.trim().length > 0
        ? value.fieldPath.trim()
        : undefined,
    message: readStringField(
      value,
      "message",
      "Validation finding returned without a message."
    ),
    fixSuggestion: readStringField(value, "fixSuggestion", ""),
    legalConfidence:
      value.legalConfidence === "technical" ||
      value.legalConfidence === "educational_simulation" ||
      value.legalConfidence === "review_required" ||
      value.legalConfidence === "standard_based" ||
      value.legalConfidence === "official_source_derived" ||
      value.legalConfidence === "professional_review_required"
        ? value.legalConfidence
        : undefined,
    ruleSetCode: readStringField(value, "ruleSetCode", ""),
    ruleVersion: readStringField(value, "ruleVersion", ""),
    sourceLabels: Array.isArray(value.sourceLabels)
      ? value.sourceLabels
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : []
  };
}

function normalizeTotals(value: unknown): ValidationTotals {
  if (!isPlainObject(value)) {
    return {
      lineExtensionAmount: 0,
      taxExclusiveAmount: 0,
      taxAmount: 0,
      taxInclusiveAmount: 0,
      payableAmount: 0
    };
  }

  return {
    lineExtensionAmount: readAmountField(value, "lineExtensionAmount", 0),
    taxExclusiveAmount: readAmountField(value, "taxExclusiveAmount", 0),
    taxAmount: readAmountField(value, "taxAmount", 0),
    taxInclusiveAmount: readAmountField(value, "taxInclusiveAmount", 0),
    payableAmount: readAmountField(value, "payableAmount", 0)
  };
}

function normalizeXmlUploadRecord(value: unknown): XmlUploadRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const summary = isPlainObject(value.summary)
    ? (value.summary as XmlUploadSummary)
    : undefined;

  const id = readStringField(value, "id", "");

  if (!id) {
    return null;
  }

  const currency = readStringField(
    value,
    "currency",
    typeof summary?.currency === "string" ? summary.currency : "not_detected"
  );

  const findingsFromArray = Array.isArray(value.findings)
    ? value.findings.length
    : 0;

  return {
    id,
    fileName: readStringField(value, "fileName", "unknown.xml"),
    fileSize: readStringField(value, "fileSize", "0 B"),
    uploadedAt: readStringField(value, "uploadedAt", new Date().toISOString()),
    detectedDocument: readStringField(value, "detectedDocument", "unknown"),
    rootElement: readStringField(value, "rootElement", "unknown"),
    invoiceId: readStringField(value, "invoiceId", "not_detected"),
    issueDate: readStringField(value, "issueDate", "not_detected"),
    currency,
    apiStatus: readStringField(value, "apiStatus", "review_required"),
    status: readStringField(value, "status", "rejected"),
    note: readStringField(value, "note", "Stored XML readiness report."),
    disclaimer: readStringField(
      value,
      "disclaimer",
      "Invoice Lantern performs a technical readiness simulation only. This result is not official validation."
    ),
    technicalStatus: readStringField(
      value,
      "technicalStatus",
      typeof summary?.technicalStatus === "string"
        ? summary.technicalStatus
        : "failed"
    ),
    readinessStatus: readStringField(
      value,
      "readinessStatus",
      typeof summary?.readinessStatus === "string"
        ? summary.readinessStatus
        : "needs_attention"
    ),
    documentStatus: readStringField(value, "documentStatus", "recognized"),
    calculationStatus: readStringField(value, "calculationStatus", "not_checked"),
    profileStatus: readStringField(value, "profileStatus", "unknown_profile"),
    findingsCount:
      typeof summary?.findingsCount === "number" &&
      Number.isFinite(summary.findingsCount)
        ? summary.findingsCount
        : findingsFromArray,
    summary
  };
}

function buildValidationQueueItem(run: ValidationRunSummary): ReportQueueItem {
  return {
    id: run.id,
    sourceType: "validation_run",
    title: run.invoiceNumber,
    subtitle: `${run.seller} to ${run.buyer}`,
    createdAt: run.createdAt,
    status: run.overallStatus,
    secondaryStatus: run.technicalStatus,
    amountLabel: formatMoneyValue(run.currency, run.payableAmount),
    findingsCount: run.findingsCount,
    fatalCount: run.findingCounts.fatal + run.findingCounts.blocked,
    warningCount: run.findingCounts.warning,
    invoiceNumber: run.invoiceNumber,
    currency: run.currency,
    reportLabel: run.reportLabel,
    href: `/workspace/validation-runs/${encodeURIComponent(run.id)}`,
    canDelete: true
  };
}

function buildXmlQueueItem(upload: XmlUploadRecord): ReportQueueItem {
  const invoiceLabel =
    upload.invoiceId && upload.invoiceId !== "not_detected"
      ? upload.invoiceId
      : upload.fileName;

  const payableAmount =
    typeof upload.summary?.payableAmount === "string"
      ? upload.summary.payableAmount
      : "not_detected";

  return {
    id: upload.id,
    sourceType: "xml_readiness",
    title: invoiceLabel,
    subtitle: `${upload.fileName} - ${formatStatus(
      upload.detectedDocument
    )} XML readiness`,
    createdAt: upload.uploadedAt,
    status: upload.readinessStatus,
    secondaryStatus: upload.profileStatus,
    amountLabel: formatMoneyValue(upload.currency, payableAmount),
    findingsCount: upload.findingsCount,
    fatalCount: 0,
    warningCount: upload.findingsCount,
    invoiceNumber: invoiceLabel,
    currency: upload.currency,
    reportLabel: "XML readiness report",
    href: "/workspace/xml-upload",
    canDelete: true
  };
}

export default function WorkspaceValidationRunsPage() {
  const [validationRuns, setValidationRuns] = useState<ValidationRunSummary[]>([]);
  const [xmlUploads, setXmlUploads] = useState<XmlUploadRecord[]>([]);
  const [latestRunDetail, setLatestRunDetail] =
    useState<SavedValidationRun | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [runLoadMessage, setRunLoadMessage] = useState("");
  const [deletingReportId, setDeletingReportId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadReportHistory() {
      setIsLoadingRuns(true);
      setRunLoadMessage("");

      const loadMessages: string[] = [];

      try {
        const response = await fetch("/api/local/validation-runs", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          setValidationRuns([]);
          loadMessages.push(
            getApiErrorMessage(
              responseData,
              "Could not load API-owned validation reports."
            )
          );
        } else {
          const apiData = responseData as ValidationRunListResponse;
          const records = Array.isArray(apiData.records) ? apiData.records : [];

          const normalizedRuns = records
            .map((item) => normalizeValidationRunSummary(item))
            .filter((item): item is ValidationRunSummary => item !== null);

          if (isMounted) {
            setValidationRuns(normalizedRuns);
          }
        }
      } catch {
        setValidationRuns([]);
        loadMessages.push(
          "The local validation report API is unavailable. Make sure apps/api and apps/web are both running."
        );
      }

      try {
        const xmlResponse = await fetch("/api/local/xml/uploads", {
          method: "GET",
          cache: "no-store"
        });

        const xmlData = await readResponseBody(xmlResponse);

        if (!xmlResponse.ok) {
          setXmlUploads([]);
          loadMessages.push(
            getApiErrorMessage(xmlData, "Could not load XML readiness reports.")
          );
        } else {
          const apiData = xmlData as XmlUploadListResponse;
          const records = Array.isArray(apiData.records) ? apiData.records : [];

          const normalizedXmlUploads = records
            .map((item) => normalizeXmlUploadRecord(item))
            .filter((item): item is XmlUploadRecord => item !== null);

          if (isMounted) {
            setXmlUploads(normalizedXmlUploads);
          }
        }
      } catch {
        setXmlUploads([]);
        loadMessages.push(
          "Could not load XML readiness reports. Make sure apps/api and apps/web are both running."
        );
      }

      if (isMounted) {
        setRunLoadMessage(loadMessages.join(" "));
        setIsLoadingRuns(false);
      }
    }

    loadReportHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLatestValidationRunDetail() {
      const latestRun = validationRuns[0];

      if (!latestRun) {
        setLatestRunDetail(null);
        return;
      }

      if (latestRunDetail?.id === latestRun.id) {
        return;
      }

      try {
        const response = await fetch(
          `/api/local/validation-runs/${encodeURIComponent(latestRun.id)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setLatestRunDetail(null);
          }

          return;
        }

        const payload = responseData as ValidationRunDetailResponse;
        const normalizedDetail = normalizeValidationRunDetail(payload.record);

        if (isMounted) {
          setLatestRunDetail(normalizedDetail);
        }
      } catch {
        if (isMounted) {
          setLatestRunDetail(null);
        }
      }
    }

    loadLatestValidationRunDetail();

    return () => {
      isMounted = false;
    };
  }, [validationRuns, latestRunDetail?.id]);

  const reportQueueItems = useMemo(() => {
    const validationItems = validationRuns.map(buildValidationQueueItem);
    const xmlItems = xmlUploads.map(buildXmlQueueItem);

    return [...validationItems, ...xmlItems].sort((first, second) =>
      second.createdAt.localeCompare(first.createdAt)
    );
  }, [validationRuns, xmlUploads]);

  async function deleteReportItem(
    event: MouseEvent<HTMLButtonElement>,
    item: ReportQueueItem
  ) {
    event.preventDefault();
    event.stopPropagation();

    const endpoint =
      item.sourceType === "xml_readiness"
        ? `/api/local/xml/uploads/${encodeURIComponent(item.id)}`
        : `/api/local/validation-runs/${encodeURIComponent(item.id)}`;

    setDeletingReportId(item.id);
    setRunLoadMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        cache: "no-store"
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setRunLoadMessage(
          getApiErrorMessage(responseData, "Could not delete report.")
        );
        return;
      }

      if (item.sourceType === "xml_readiness") {
        setXmlUploads((current) =>
          current.filter((upload) => upload.id !== item.id)
        );
        setRunLoadMessage("XML readiness report deleted.");
        return;
      }

      setValidationRuns((current) =>
        current.filter((run) => run.id !== item.id)
      );

      if (latestRunDetail?.id === item.id) {
        setLatestRunDetail(null);
      }

      setRunLoadMessage("Invoice validation report deleted.");
    } catch {
      setRunLoadMessage(
        "Could not delete report. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setDeletingReportId("");
    }
  }

  const latestQueueItem = reportQueueItems[0] ?? null;
  const latestFindings = latestRunDetail?.findings ?? [];

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Reports</p>
        <h2>Review invoice validation and XML readiness reports.</h2>
        <p>
          This screen works as a unified report queue. It shows structured invoice
          validation reports and XML readiness reports from the API, while keeping
          each inspection engine technically separate.
        </p>
      </section>

      <section className="validation-run-grid">
        {validationLayerCards.map((item) => (
          <div className="validation-run-layer" key={item.title}>
            <div className="validation-layer-icon">
              {getValidationIcon(item.iconKey)}
            </div>

            <span>{item.status}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Unified report history</p>
            <h3>Validation report history</h3>
          </div>

          <div className="confidence-label">
            <BadgeCheck size={17} />
            API history enabled
          </div>
        </div>

        {runLoadMessage ? (
          <div className="alert-item">
            <span />
            <p>{runLoadMessage}</p>
          </div>
        ) : null}

        <div className="workspace-table">
          {isLoadingRuns ? (
            <div className="workspace-table-row">
              <div>
                <strong>Loading report history</strong>
                <span>
                  Reading invoice validation reports and XML readiness reports
                  from the local API proxy.
                </span>
              </div>

              <div>
                <span className="status-pill">loading</span>
              </div>

              <div>
                <span>pending</span>
              </div>

              <strong>API</strong>

              <ArrowRight size={17} />
            </div>
          ) : reportQueueItems.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No reports yet</strong>
                <span>
                  Create an invoice validation report or upload XML to populate
                  this API-owned report queue.
                </span>
              </div>

              <div>
                <span className="status-pill">empty</span>
              </div>

              <div>
                <span>waiting</span>
              </div>

              <strong>0</strong>

              <FileCheck2 size={17} />
            </div>
          ) : (
            reportQueueItems.map((item) => (
              <div className="workspace-table-row invoice-click-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                  <span>
                    Label: {item.reportLabel}. Source:{" "}
                    {item.sourceType === "xml_readiness"
                      ? "XML readiness report"
                      : "Invoice validation report"}
                    . Findings: {item.findingsCount}. Amount: {item.amountLabel}.
                  </span>
                  <span>
                    Run: {item.id.slice(0, 12)}. Invoice: {item.invoiceNumber}.
                    Currency: {item.currency}. Fatal/blocking: {item.fatalCount}.
                    Warnings: {item.warningCount}.
                  </span>

                  <div className="workspace-row-actions">
                    <Link href={item.href} className="text-link-button">
                      {item.sourceType === "xml_readiness" ? (
                        <FileCode2 size={16} />
                      ) : (
                        <ArrowRight size={16} />
                      )}
                      {item.sourceType === "xml_readiness"
                        ? "Open XML report"
                        : "Open report"}
                    </Link>

                    <button
                      type="button"
                      className="text-link-button"
                      onClick={(event) => deleteReportItem(event, item)}
                      disabled={deletingReportId === item.id || !item.canDelete}
                    >
                      <Trash2 size={16} />
                      {deletingReportId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="status-pill">{formatStatus(item.status)}</span>
                </div>

                <div>
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>

                <strong>{formatStatus(item.secondaryStatus)}</strong>

                {item.sourceType === "xml_readiness" ? (
                  <FileCode2 size={17} />
                ) : (
                  <ArrowRight size={17} />
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="findings-console">
        <div className="findings-console-head">
          <div>
            <p>Latest report preview</p>
            <h3>{latestQueueItem?.title ?? "No report selected"}</h3>
          </div>

          {latestQueueItem ? (
            <Link href={latestQueueItem.href} className="confidence-label">
              <BadgeCheck size={17} />
              open report
            </Link>
          ) : (
            <div className="confidence-label">
              <BadgeCheck size={17} />
              no report
            </div>
          )}
        </div>

        <div className="finding-console-list">
          {!latestQueueItem ? (
            <div className="finding-console-row">
              <BadgeCheck size={18} />

              <div>
                <strong>NO_REPORTS_RETURNED</strong>
                <p>No validation or XML readiness reports are currently available.</p>
              </div>

              <span>info</span>
            </div>
          ) : latestQueueItem.sourceType === "xml_readiness" ? (
            <div className="finding-console-row">
              <FileCode2 size={18} />

              <div>
                <strong>XML_READINESS_REPORT_AVAILABLE</strong>
                <p>
                  The latest report is an XML readiness report. Open the XML
                  report to review extracted XML fields, profile signals, tax
                  signals, totals, findings, and export options.
                </p>
              </div>

              <span>info</span>
            </div>
          ) : !latestRunDetail ? (
            <div className="finding-console-row">
              <AlertTriangle size={18} />

              <div>
                <strong>VALIDATION_DETAIL_NOT_LOADED</strong>
                <p>
                  The latest invoice validation report summary is available, but
                  its detailed findings could not be loaded for this preview.
                </p>
              </div>

              <span>warning</span>
            </div>
          ) : latestFindings.length === 0 ? (
            <div className="finding-console-row">
              <BadgeCheck size={18} />

              <div>
                <strong>NO_FINDINGS_RETURNED</strong>
                <p>The latest invoice validation report did not return any findings.</p>
              </div>

              <span>info</span>
            </div>
          ) : (
            latestFindings.map((item) => (
              <div className="finding-console-row" key={item.code}>
                <AlertTriangle size={18} />

                <div>
                  <strong>{item.code}</strong>
                  <p>{item.message}</p>
                  <p>
                    Category: {item.category || "Validation"}. Field:{" "}
                    {item.fieldPath ?? item.field ?? "report"}. Confidence:{" "}
                    {formatLegalConfidence(item.legalConfidence)}.
                  </p>
                  {item.fixSuggestion ? <p>Fix: {item.fixSuggestion}</p> : null}
                  {item.ruleSetCode || item.ruleVersion ? (
                    <p>
                      Rule set: {item.ruleSetCode || "Not linked"}. Version:{" "}
                      {item.ruleVersion || "not versioned"}.
                    </p>
                  ) : null}
                </div>

                <span>{item.severity}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
