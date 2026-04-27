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
import { validationRunLayers } from "../../../lib/mock-data";
import type { WorkspaceIconKey } from "../../../lib/types";

type FindingSeverity = "info" | "warning" | "fatal";

type ValidationFinding = {
  code: string;
  severity: FindingSeverity;
  field?: string;
  message: string;
  legalConfidence?: "technical" | "educational_simulation" | "review_required";
};

type ValidationTotals = {
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
  payableAmount: number;
};

type ValidationRunSummary = {
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
  findingsCount: number;
  payableAmount: number;
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
  records?: ValidationRunSummary[];
};

type ValidationRunDetailResponse = {
  record?: SavedValidationRun;
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
  href: string;
  canDelete: boolean;
};

function getValidationIcon(iconKey: WorkspaceIconKey) {
  const icons: Record<string, ReactNode> = {
    schema: <Layers3 size={22} />,
    calculation: <Calculator size={22} />,
    ubl: <FileCheck2 size={22} />,
    legal: <ShieldAlert size={22} />
  };

  return icons[iconKey] ?? <FileCheck2 size={22} />;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
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
  fallback = "The validation run request failed."
) {
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

function normalizeValidationRunSummary(
  value: unknown
): ValidationRunSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readStringField(record, "id", "");

  if (!id) {
    return null;
  }

  return {
    id,
    invoiceNumber: readStringField(record, "invoiceNumber", "Untitled invoice"),
    buyer: readStringField(record, "buyer", "Unknown buyer"),
    seller: readStringField(record, "seller", "Unknown seller"),
    createdAt: readStringField(record, "createdAt", new Date().toISOString()),
    technicalStatus: readStringField(record, "technicalStatus", "failed"),
    standardStatus: readStringField(record, "standardStatus", "warning"),
    countrySimulationStatus: readStringField(
      record,
      "countrySimulationStatus",
      "not_relevant"
    ),
    vidaReadinessStatus: readStringField(
      record,
      "vidaReadinessStatus",
      "not_relevant"
    ),
    confidence: readStringField(record, "confidence", "technical_preview"),
    profile: readStringField(record, "profile", "API_VALIDATION"),
    currency: readStringField(record, "currency", "EUR"),
    findingsCount: readNumberField(record, "findingsCount", 0),
    payableAmount: readNumberField(record, "payableAmount", 0)
  };
}

function normalizeValidationRunDetail(value: unknown): SavedValidationRun | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readStringField(record, "id", "");

  if (!id) {
    return null;
  }

  const findings = Array.isArray(record.findings)
    ? record.findings
        .map((finding) => normalizeFinding(finding))
        .filter((finding): finding is ValidationFinding => finding !== null)
    : [];

  return {
    id,
    invoiceNumber: readStringField(record, "invoiceNumber", "Untitled invoice"),
    buyer: readStringField(record, "buyer", "Unknown buyer"),
    seller: readStringField(record, "seller", "Unknown seller"),
    createdAt: readStringField(record, "createdAt", new Date().toISOString()),
    technicalStatus: readStringField(record, "technicalStatus", "failed"),
    standardStatus: readStringField(record, "standardStatus", "warning"),
    countrySimulationStatus: readStringField(
      record,
      "countrySimulationStatus",
      "not_relevant"
    ),
    vidaReadinessStatus: readStringField(
      record,
      "vidaReadinessStatus",
      "not_relevant"
    ),
    confidence: readStringField(record, "confidence", "technical_preview"),
    profile: readStringField(record, "profile", "API_VALIDATION"),
    currency: readStringField(record, "currency", "EUR"),
    totals: normalizeTotals(record.totals),
    findings,
    disclaimer: readStringField(
      record,
      "disclaimer",
      "This validation report is a development sandbox result. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
    )
  };
}

function normalizeFinding(value: unknown): ValidationFinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const code = readStringField(record, "code", "");

  if (!code) {
    return null;
  }

  const severity =
    record.severity === "info" ||
    record.severity === "warning" ||
    record.severity === "fatal"
      ? record.severity
      : "info";

  return {
    code,
    severity,
    field:
      typeof record.field === "string" && record.field.trim().length > 0
        ? record.field.trim()
        : undefined,
    message: readStringField(
      record,
      "message",
      "Validation finding returned without a message."
    ),
    legalConfidence:
      record.legalConfidence === "technical" ||
      record.legalConfidence === "educational_simulation" ||
      record.legalConfidence === "review_required"
        ? record.legalConfidence
        : undefined
  };
}

function normalizeTotals(value: unknown): ValidationTotals {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      lineExtensionAmount: 0,
      taxExclusiveAmount: 0,
      taxAmount: 0,
      taxInclusiveAmount: 0,
      payableAmount: 0
    };
  }

  const record = value as Record<string, unknown>;

  return {
    lineExtensionAmount: readNumberField(record, "lineExtensionAmount", 0),
    taxExclusiveAmount: readNumberField(record, "taxExclusiveAmount", 0),
    taxAmount: readNumberField(record, "taxAmount", 0),
    taxInclusiveAmount: readNumberField(record, "taxInclusiveAmount", 0),
    payableAmount: readNumberField(record, "payableAmount", 0)
  };
}

function normalizeXmlUploadRecord(value: unknown): XmlUploadRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const summary = isPlainObject(record.summary)
    ? (record.summary as XmlUploadSummary)
    : undefined;

  const id = readStringField(record, "id", "");

  if (!id) {
    return null;
  }

  const currency = readStringField(
    record,
    "currency",
    typeof summary?.currency === "string" ? summary.currency : "not_detected"
  );

  const findings = Array.isArray(record.findings) ? record.findings.length : 0;

  return {
    id,
    fileName: readStringField(record, "fileName", "unknown.xml"),
    fileSize: readStringField(record, "fileSize", "0 B"),
    uploadedAt: readStringField(record, "uploadedAt", new Date().toISOString()),
    detectedDocument: readStringField(record, "detectedDocument", "unknown"),
    rootElement: readStringField(record, "rootElement", "unknown"),
    invoiceId: readStringField(record, "invoiceId", "not_detected"),
    issueDate: readStringField(record, "issueDate", "not_detected"),
    currency,
    apiStatus: readStringField(record, "apiStatus", "review_required"),
    status: readStringField(record, "status", "rejected"),
    note: readStringField(record, "note", "Stored XML readiness report."),
    disclaimer: readStringField(
      record,
      "disclaimer",
      "Invoice Lantern performs a technical readiness simulation only. This result is not official validation."
    ),
    technicalStatus: readStringField(
      record,
      "technicalStatus",
      typeof summary?.technicalStatus === "string"
        ? summary.technicalStatus
        : "failed"
    ),
    readinessStatus: readStringField(
      record,
      "readinessStatus",
      typeof summary?.readinessStatus === "string"
        ? summary.readinessStatus
        : "needs_attention"
    ),
    documentStatus: readStringField(record, "documentStatus", "recognized"),
    calculationStatus: readStringField(record, "calculationStatus", "not_checked"),
    profileStatus: readStringField(record, "profileStatus", "unknown_profile"),
    findingsCount:
      typeof summary?.findingsCount === "number" &&
      Number.isFinite(summary.findingsCount)
        ? summary.findingsCount
        : findings,
    summary
  };
}

function buildValidationQueueItem(run: ValidationRunSummary): ReportQueueItem {
  return {
    id: run.id,
    sourceType: "validation_run",
    title: run.id,
    subtitle: `${run.invoiceNumber} - ${run.buyer}`,
    createdAt: run.createdAt,
    status: run.technicalStatus,
    secondaryStatus: run.standardStatus,
    amountLabel: formatMoneyValue(run.currency, run.payableAmount),
    findingsCount: run.findingsCount,
    href: `/workspace/validation-runs/${run.id}`,
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
    subtitle: `${upload.fileName} - ${formatStatus(upload.detectedDocument)} XML readiness`,
    createdAt: upload.uploadedAt,
    status: upload.readinessStatus,
    secondaryStatus: upload.profileStatus,
    amountLabel: formatMoneyValue(upload.currency, payableAmount),
    findingsCount: upload.findingsCount,
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

    async function loadValidationRuns() {
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
          loadMessages.push(
            getApiErrorMessage(
              responseData,
              "Could not load API-owned validation runs."
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

          if (normalizedRuns.length > 0) {
            const latestRunId = normalizedRuns[0].id;
            const detailResponse = await fetch(
              `/api/local/validation-runs/${encodeURIComponent(latestRunId)}`,
              {
                method: "GET",
                cache: "no-store"
              }
            );

            const detailData = await readResponseBody(detailResponse);

            if (detailResponse.ok) {
              const detailPayload = detailData as ValidationRunDetailResponse;
              const normalizedDetail = normalizeValidationRunDetail(
                detailPayload.record
              );

              if (isMounted) {
                setLatestRunDetail(normalizedDetail);
              }
            } else {
              loadMessages.push(
                "Validation runs loaded, but the latest validation run detail could not be loaded."
              );
            }
          } else if (isMounted) {
            setLatestRunDetail(null);
          }
        }
      } catch {
        loadMessages.push(
          "The local validation run API is unavailable. Make sure apps/api and apps/web are both running."
        );
      }

      try {
        const xmlResponse = await fetch("/api/local/xml/uploads", {
          method: "GET",
          cache: "no-store"
        });

        const xmlData = await readResponseBody(xmlResponse);

        if (!xmlResponse.ok) {
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
        loadMessages.push(
          "Could not load XML readiness reports. Make sure apps/api and apps/web are both running."
        );
      }

      if (isMounted) {
        setRunLoadMessage(loadMessages.join(" "));
        setIsLoadingRuns(false);
      }
    }

    loadValidationRuns();

    return () => {
      isMounted = false;
    };
  }, []);

  const reportQueueItems = useMemo(() => {
    const apiItems = validationRuns.map(buildValidationQueueItem);
    const xmlItems = xmlUploads.map(buildXmlQueueItem);

    return [...apiItems, ...xmlItems].sort((first, second) =>
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

      setRunLoadMessage("Validation run deleted.");
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
        <p className="workspace-kicker">Validation Runs</p>
        <h2>Every validation result must be explainable.</h2>
        <p>
          This screen works as a unified report queue. It shows structured
          validation runs and XML readiness reports from the API, while keeping
          each inspection engine technically separate.
        </p>
      </section>

      <section className="validation-run-grid">
        {validationRunLayers.map((item) => (
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
            <h3>Validation and XML readiness queue</h3>
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
                  Reading validation runs and XML reports from the local API proxy.
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
                  Create a validation run or upload XML to populate this API-owned
                  report queue.
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
                    Source:{" "}
                    {item.sourceType === "xml_readiness"
                      ? "XML readiness report"
                      : "Structured validation run"}
                    . Findings: {item.findingsCount}. Amount: {item.amountLabel}.
                  </span>

                  <div className="workspace-row-actions">
                    <Link href={item.href} className="text-link-button">
                      {item.sourceType === "xml_readiness" ? (
                        <FileCode2 size={16} />
                      ) : (
                        <ArrowRight size={16} />
                      )}
                      {item.sourceType === "xml_readiness"
                        ? "Open XML reports"
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
                  The latest report is an XML readiness report. Open XML reports to
                  review extracted XML fields, profile signals, tax signals, totals,
                  findings, and export options.
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
                  The latest validation run summary is available, but its detailed
                  findings could not be loaded for this preview.
                </p>
              </div>

              <span>warning</span>
            </div>
          ) : latestFindings.length === 0 ? (
            <div className="finding-console-row">
              <BadgeCheck size={18} />

              <div>
                <strong>NO_FINDINGS_RETURNED</strong>
                <p>The latest validation run did not return any findings.</p>
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
