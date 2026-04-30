"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calculator,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  Layers3,
  ShieldAlert
} from "lucide-react";
import type {
  ValidationReportFindingCounts,
  ValidationReportRuleSetSummary,
  ValidationReportSummary
} from "../../../../lib/types";

type FindingSeverity = "info" | "warning" | "fatal" | "blocked";
type LegalConfidence =
  | "technical"
  | "standard_based"
  | "official_source_derived"
  | "educational_simulation"
  | "professional_review_required"
  | "review_required";

type ValidationRunSourceType = "invoice_validation" | "xml_readiness";

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

type SavedValidationRun = {
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
  totals: ValidationTotals;
  findings: ValidationFinding[];
  disclaimer: string;
  sourceType: ValidationRunSourceType;
  sourceFileName?: string;
  sourceRootElement?: string;
  sourceDocumentType?: string;
  reportSummary: ValidationReportSummary;
};

type ValidationRunDetailResponse = {
  record?: unknown;
  reportSummary?: unknown;
};

type EvidenceItem = {
  label: string;
  value: string;
};

const VALIDATION_REPORT_DISCLAIMER =
  "This validation report checks selected technical structure, calculation logic, canonical invoice rules, and sandbox rule metadata. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority compliance. Before issuing real invoices or making VAT decisions, consult a qualified accountant, tax adviser, or competent authority.";

const EMPTY_FINDING_COUNTS: ValidationReportFindingCounts = {
  info: 0,
  warning: 0,
  fatal: 0,
  blocked: 0
};

function getStatusTone(status: string) {
  if (
    status === "passed" ||
    status === "ready" ||
    status === "not_relevant" ||
    status === "technical_preview" ||
    status === "technical" ||
    status === "no_selected_technical_issues_detected"
  ) {
    return "good";
  }

  if (
    status === "failed" ||
    status === "technical_issues_found" ||
    status === "blocked" ||
    status === "fatal"
  ) {
    return "danger";
  }

  return "warn";
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

function formatSourceType(sourceType: ValidationRunSourceType) {
  return sourceType === "xml_readiness"
    ? "XML readiness report"
    : "Invoice validation report";
}

function formatOptionalValue(value: string | undefined, fallback = "Not detected") {
  if (!value || value === "not_detected") {
    return fallback;
  }

  return value;
}

function formatDateTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return formatOptionalValue(value, "Not recorded");
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

function formatTotalAmount(currency: string, value: number | string) {
  const safeCurrency = currency || "EUR";

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${safeCurrency} ${value.toFixed(2)}`;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return `${safeCurrency} ${value.trim().replace(/^[A-Z]{3}\s*/u, "")}`;
  }

  return `${safeCurrency} 0.00`;
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

function readAmountField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return 0;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
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
  fallback = "The report request failed."
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

function normalizeSourceType(value: unknown): ValidationRunSourceType {
  return value === "xml_readiness" ? "xml_readiness" : "invoice_validation";
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
    sourceLabels: readStringArray(value.sourceLabels)
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
    lineExtensionAmount: readAmountField(value, "lineExtensionAmount"),
    taxExclusiveAmount: readAmountField(value, "taxExclusiveAmount"),
    taxAmount: readAmountField(value, "taxAmount"),
    taxInclusiveAmount: readAmountField(value, "taxInclusiveAmount"),
    payableAmount: readAmountField(value, "payableAmount")
  };
}

function countFindings(findings: ValidationFinding[]) {
  return findings.reduce<ValidationReportFindingCounts>(
    (counts, finding) => {
      counts[finding.severity] += 1;
      return counts;
    },
    { ...EMPTY_FINDING_COUNTS }
  );
}

function normalizeFindingCounts(
  value: unknown,
  findings: ValidationFinding[]
): ValidationReportFindingCounts {
  if (!isPlainObject(value)) {
    return countFindings(findings);
  }

  return {
    info:
      typeof value.info === "number" && Number.isFinite(value.info)
        ? value.info
        : 0,
    warning:
      typeof value.warning === "number" && Number.isFinite(value.warning)
        ? value.warning
        : 0,
    fatal:
      typeof value.fatal === "number" && Number.isFinite(value.fatal)
        ? value.fatal
        : 0,
    blocked:
      typeof value.blocked === "number" && Number.isFinite(value.blocked)
        ? value.blocked
        : 0
  };
}

function buildOverallStatus(counts: ValidationReportFindingCounts) {
  if (counts.blocked > 0 || counts.fatal > 0) {
    return "technical_issues_found";
  }

  if (counts.warning > 0) {
    return "warnings_require_review";
  }

  return "no_selected_technical_issues_detected";
}

function buildLegalConfidenceSummary(findings: ValidationFinding[]) {
  if (
    findings.some(
      (finding) =>
        finding.legalConfidence === "professional_review_required" ||
        finding.legalConfidence === "review_required"
    )
  ) {
    return "Professional review required for one or more findings.";
  }

  if (
    findings.some(
      (finding) => finding.legalConfidence === "educational_simulation"
    )
  ) {
    return "Educational simulation metadata is present on one or more findings.";
  }

  if (findings.length > 0) {
    return "Technical rule metadata only.";
  }

  return "No finding-level legal confidence labels were returned.";
}

function buildRecommendedNextActions(counts: ValidationReportFindingCounts) {
  if (counts.blocked > 0 || counts.fatal > 0) {
    return ["Fix blocking/fatal technical issues before relying on this draft."];
  }

  if (counts.warning > 0) {
    return ["Review warnings and seek professional advice where required."];
  }

  const totalFindings =
    counts.info + counts.warning + counts.fatal + counts.blocked;

  if (totalFindings === 0) {
    return [
      "No selected technical issues were detected by this sandbox rule set. This is not legal/tax certification."
    ];
  }

  return [
    "Review informational findings and keep supporting records for professional review where appropriate."
  ];
}

function buildRuleSetsFromFindings(findings: ValidationFinding[]) {
  const ruleSets = new Map<string, ValidationReportRuleSetSummary>();

  for (const finding of findings) {
    const code = finding.ruleSetCode?.trim() ?? "";
    const version = finding.ruleVersion?.trim() ?? "";

    if (!code && !version) {
      continue;
    }

    const key = `${code || "not_linked"}::${version || "not_versioned"}`;
    const current = ruleSets.get(key);
    const sourceLabels = finding.sourceLabels ?? [];

    if (current) {
      current.sourceLabels = [
        ...new Set([...current.sourceLabels, ...sourceLabels])
      ];
      continue;
    }

    ruleSets.set(key, {
      code: code || "not_linked",
      version: version || "not_versioned",
      sourceLabels: [...new Set(sourceLabels)]
    });
  }

  return [...ruleSets.values()];
}

function normalizeRuleSetsUsed(
  value: unknown,
  findings: ValidationFinding[]
): ValidationReportRuleSetSummary[] {
  if (!Array.isArray(value)) {
    return buildRuleSetsFromFindings(findings);
  }

  const ruleSets = value
    .map((item) => {
      if (!isPlainObject(item)) {
        return null;
      }

      const code = readStringField(item, "code", "not_linked");
      const version = readStringField(item, "version", "not_versioned");

      return {
        code,
        version,
        sourceLabels: readStringArray(item.sourceLabels)
      };
    })
    .filter(
      (item): item is ValidationReportRuleSetSummary => item !== null
    );

  return ruleSets.length > 0 ? ruleSets : buildRuleSetsFromFindings(findings);
}

function buildFallbackReportSummary(
  run: Omit<SavedValidationRun, "reportSummary">
): ValidationReportSummary {
  const findingCounts = countFindings(run.findings);

  return {
    reportTitle: "Validation report",
    validationRunId: run.id,
    createdAt: run.createdAt,
    invoiceNumber: run.invoiceNumber,
    issueDate: run.issueDate,
    seller: run.seller,
    buyer: run.buyer,
    currency: run.currency,
    overallStatus: buildOverallStatus(findingCounts),
    technicalStatus: run.technicalStatus,
    standardStatus: run.standardStatus,
    findingCounts,
    legalConfidenceSummary: buildLegalConfidenceSummary(run.findings),
    ruleSetsUsed: buildRuleSetsFromFindings(run.findings),
    disclaimer: VALIDATION_REPORT_DISCLAIMER,
    recommendedNextActions: buildRecommendedNextActions(findingCounts)
  };
}

function normalizeReportSummary(
  value: unknown,
  run: Omit<SavedValidationRun, "reportSummary">
): ValidationReportSummary {
  const fallback = buildFallbackReportSummary(run);

  if (!isPlainObject(value)) {
    return fallback;
  }

  const findingCounts = normalizeFindingCounts(value.findingCounts, run.findings);
  const recommendedNextActions = readStringArray(value.recommendedNextActions);

  return {
    reportTitle: readStringField(value, "reportTitle", fallback.reportTitle),
    validationRunId: readStringField(
      value,
      "validationRunId",
      fallback.validationRunId
    ),
    createdAt: readStringField(value, "createdAt", fallback.createdAt),
    invoiceNumber: readStringField(
      value,
      "invoiceNumber",
      fallback.invoiceNumber
    ),
    issueDate: readStringField(value, "issueDate", fallback.issueDate),
    seller: readStringField(value, "seller", fallback.seller),
    buyer: readStringField(value, "buyer", fallback.buyer),
    currency: readStringField(value, "currency", fallback.currency),
    overallStatus: readStringField(
      value,
      "overallStatus",
      buildOverallStatus(findingCounts)
    ),
    technicalStatus: readStringField(
      value,
      "technicalStatus",
      fallback.technicalStatus
    ),
    standardStatus: readStringField(
      value,
      "standardStatus",
      fallback.standardStatus
    ),
    findingCounts,
    legalConfidenceSummary: readStringField(
      value,
      "legalConfidenceSummary",
      fallback.legalConfidenceSummary
    ),
    ruleSetsUsed: normalizeRuleSetsUsed(value.ruleSetsUsed, run.findings),
    disclaimer: readStringField(
      value,
      "disclaimer",
      VALIDATION_REPORT_DISCLAIMER
    ),
    recommendedNextActions:
      recommendedNextActions.length > 0
        ? recommendedNextActions
        : buildRecommendedNextActions(findingCounts)
  };
}

function normalizeValidationRun(
  value: unknown,
  reportSummaryValue: unknown
): SavedValidationRun | null {
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

  const runWithoutSummary: Omit<SavedValidationRun, "reportSummary"> = {
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
    totals: normalizeTotals(value.totals),
    findings,
    disclaimer: readStringField(
      value,
      "disclaimer",
      "This validation report is a technical readiness simulation only. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
    ),
    sourceType: normalizeSourceType(value.sourceType),
    sourceFileName: readStringField(value, "sourceFileName", ""),
    sourceRootElement: readStringField(value, "sourceRootElement", ""),
    sourceDocumentType: readStringField(value, "sourceDocumentType", "")
  };

  return {
    ...runWithoutSummary,
    reportSummary: normalizeReportSummary(reportSummaryValue, runWithoutSummary)
  };
}

function buildSourceContext(run: SavedValidationRun): EvidenceItem[] {
  if (run.sourceType === "xml_readiness") {
    return [
      {
        label: "Source type",
        value: "XML readiness report mapped into the report history."
      },
      {
        label: "Source file",
        value: formatOptionalValue(run.sourceFileName, "XML file name unavailable")
      },
      {
        label: "Document type",
        value: formatOptionalValue(run.sourceDocumentType, "Unknown XML document")
      },
      {
        label: "Root element",
        value: formatOptionalValue(run.sourceRootElement, "Unknown root element")
      }
    ];
  }

  return [
    {
      label: "Source type",
      value: "Structured invoice validation report generated from invoice data."
    },
    {
      label: "Profile",
      value: run.profile
    },
    {
      label: "Stored raw XML",
      value: "No"
    },
    {
      label: "Report boundary",
      value: "Independent technical sandbox report."
    }
  ];
}

function sanitizeFileNamePart(value: string) {
  const cleaned = value
    .trim()
    .replace(/\.[^.]+$/u, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);

  return cleaned || "validation-report";
}

function buildExportFileName(run: SavedValidationRun) {
  const datePart = new Date().toISOString().slice(0, 10);

  return `invoice-lantern-validation-${sanitizeFileNamePart(
    run.invoiceNumber || run.id
  )}-${datePart}.json`;
}

function buildExportPayload(run: SavedValidationRun, sourceContext: EvidenceItem[]) {
  return {
    platform: {
      name: "Invoice Lantern",
      productBoundary:
        "Independent e-invoice validation and readiness sandbox. Not official validation, not Peppol certification, and not legal, tax, or accounting advice."
    },
    export: {
      exportedAt: new Date().toISOString(),
      exportFormat: "invoice_lantern_validation_report_json_v1",
      sourceType: run.sourceType,
      rawXmlIncluded: false
    },
    report: {
      id: run.id,
      invoiceNumber: run.invoiceNumber,
      buyer: run.buyer,
      seller: run.seller,
      issueDate: run.issueDate,
      createdAt: run.createdAt,
      technicalStatus: run.technicalStatus,
      standardStatus: run.standardStatus,
      countrySimulationStatus: run.countrySimulationStatus,
      readinessStatus: run.vidaReadinessStatus,
      confidence: run.confidence,
      profile: run.profile,
      currency: run.currency,
      sourceType: run.sourceType,
      sourceFileName: run.sourceFileName,
      sourceRootElement: run.sourceRootElement,
      sourceDocumentType: run.sourceDocumentType
    },
    reportSummary: run.reportSummary,
    totals: run.totals,
    findings: run.findings,
    sourceContext,
    disclaimer: run.reportSummary.disclaimer
  };
}

function downloadValidationReport(
  run: SavedValidationRun,
  sourceContext: EvidenceItem[]
) {
  const json = JSON.stringify(buildExportPayload(run, sourceContext), null, 2);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8"
  });

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = buildExportFileName(run);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(objectUrl);
}

function renderCountCard(
  label: keyof ValidationReportFindingCounts,
  counts: ValidationReportFindingCounts
) {
  return (
    <div className={`workspace-data-card is-${getStatusTone(label)}`} key={label}>
      <p>{label}</p>
      <strong>{counts[label]}</strong>
      <span>Finding count</span>
    </div>
  );
}

export default function ValidationRunDetailPage() {
  const params = useParams<{ id: string }>();

  const [run, setRun] = useState<SavedValidationRun | null>(null);
  const [isLoadingRun, setIsLoadingRun] = useState(true);
  const [runLoadMessage, setRunLoadMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadValidationReport() {
      setIsLoadingRun(true);
      setRunLoadMessage("");

      try {
        const response = await fetch(
          `/api/local/validation-runs/${encodeURIComponent(params.id)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setRun(null);
            setRunLoadMessage(
              getApiErrorMessage(
                responseData,
                "Could not load this API-owned validation report."
              )
            );
          }

          return;
        }

        const payload = responseData as ValidationRunDetailResponse;
        const normalizedRun = normalizeValidationRun(
          payload.record,
          payload.reportSummary
        );

        if (!isMounted) {
          return;
        }

        if (!normalizedRun) {
          setRun(null);
          setRunLoadMessage(
            "The API returned an unreadable validation report record."
          );
          return;
        }

        setRun(normalizedRun);
      } catch {
        if (isMounted) {
          setRun(null);
          setRunLoadMessage(
            "The local validation report API is unavailable. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRun(false);
        }
      }
    }

    loadValidationReport();

    return () => {
      isMounted = false;
    };
  }, [params.id]);

  const sourceContext = useMemo(() => (run ? buildSourceContext(run) : []), [run]);

  return (
    <div className="workspace-page validation-report-page">
      <section className="workspace-page-head validation-report-head">
        <Link href="/workspace/validation-runs" className="back-link">
          <ArrowLeft size={17} />
          Reports
        </Link>

        <p className="workspace-kicker">Validation report</p>
        <h2>Validation report</h2>
        <p>
          {run
            ? `Run ${run.id}. Created ${formatDateTime(
                run.createdAt
              )}. Invoice ${run.invoiceNumber || "not numbered"}.`
            : "No demo report is shown here. This page only displays API-owned validation report records."}
        </p>

        {run ? (
          <div className="workspace-row-actions">
            <div className="confidence-label">
              <ShieldAlert size={17} />
              non-official sandbox
            </div>

            <button
              type="button"
              className="text-link-button"
              onClick={() => downloadValidationReport(run, sourceContext)}
            >
              <Download size={16} />
              Download report JSON
            </button>
          </div>
        ) : null}

        {runLoadMessage ? (
          <div className="alert-item">
            <span />
            <p>{runLoadMessage}</p>
          </div>
        ) : null}
      </section>

      {!run && !isLoadingRun ? (
        <section className="workspace-alerts">
          <div className="alerts-head">
            <ShieldAlert size={22} />

            <div>
              <p>Real data required</p>
              <h3>No API-owned validation report was found.</h3>
            </div>
          </div>

          <div className="alert-list">
            <div className="alert-item">
              <span />
              <p>
                This report may have been deleted, the API may be unavailable, or
                the route may have been opened with an invalid report ID.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {run ? (
        <>
          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Status summary</p>
                <h3>Sandbox validation outcome</h3>
              </div>

              <div className="confidence-label">
                <BadgeCheck size={17} />
                {formatStatus(run.reportSummary.overallStatus)}
              </div>
            </div>

            <div className="workspace-data-grid">
              <div
                className={`workspace-data-card is-${getStatusTone(
                  run.reportSummary.overallStatus
                )}`}
              >
                <p>Overall status</p>
                <strong>{formatStatus(run.reportSummary.overallStatus)}</strong>
                <span>Derived from selected sandbox findings</span>
              </div>

              <div
                className={`workspace-data-card is-${getStatusTone(
                  run.reportSummary.technicalStatus
                )}`}
              >
                <p>Technical status</p>
                <strong>{formatStatus(run.reportSummary.technicalStatus)}</strong>
                <span>Stored validation run status</span>
              </div>

              <div
                className={`workspace-data-card is-${getStatusTone(
                  run.reportSummary.standardStatus
                )}`}
              >
                <p>Standard status</p>
                <strong>{formatStatus(run.reportSummary.standardStatus)}</strong>
                <span>Stored standard readiness signal</span>
              </div>

              <div className="workspace-data-card is-wide">
                <p>Legal confidence</p>
                <strong>{run.reportSummary.legalConfidenceSummary}</strong>
                <span>Finding-level metadata, not legal advice</span>
              </div>

              {(
                ["info", "warning", "fatal", "blocked"] as Array<
                  keyof ValidationReportFindingCounts
                >
              ).map((severity) =>
                renderCountCard(severity, run.reportSummary.findingCounts)
              )}
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Invoice summary</p>
                <h3>Document and parties</h3>
              </div>

              <div className="confidence-label">
                <FileText size={17} />
                {run.currency}
              </div>
            </div>

            <div className="workspace-data-grid">
              <div className="workspace-data-card">
                <p>Invoice number</p>
                <strong>{formatOptionalValue(run.invoiceNumber)}</strong>
                <span>Document identifier</span>
              </div>

              <div className="workspace-data-card">
                <p>Issue date</p>
                <strong>{formatOptionalValue(run.issueDate)}</strong>
                <span>Stored when available</span>
              </div>

              <div className="workspace-data-card">
                <p>Currency</p>
                <strong>{run.currency}</strong>
                <span>Validation run currency</span>
              </div>

              <div className="workspace-data-card">
                <p>Seller</p>
                <strong>{formatOptionalValue(run.seller, "Unknown seller")}</strong>
                <span>Invoice party</span>
              </div>

              <div className="workspace-data-card">
                <p>Buyer</p>
                <strong>{formatOptionalValue(run.buyer, "Unknown buyer")}</strong>
                <span>Invoice party</span>
              </div>

              <div className="workspace-data-card">
                <p>Payable amount</p>
                <strong>
                  {formatTotalAmount(run.currency, run.totals.payableAmount)}
                </strong>
                <span>Calculated report total</span>
              </div>
            </div>

            <div className="workspace-table">
              {Object.entries(run.totals).map(([label, value]) => (
                <div className="workspace-table-row" key={label}>
                  <div>
                    <strong>{label.replaceAll(/([A-Z])/g, " $1").trim()}</strong>
                    <span>Amount from validation report</span>
                  </div>

                  <div>
                    <span>{run.currency}</span>
                  </div>

                  <div>
                    <span className="status-pill">calculated</span>
                  </div>

                  <strong>{formatTotalAmount(run.currency, value)}</strong>

                  <Calculator size={17} />
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Rule set summary</p>
                <h3>Rule metadata used by findings</h3>
              </div>

              <div className="confidence-label">
                <Layers3 size={17} />
                sandbox report
              </div>
            </div>

            <div className="workspace-data-grid">
              {run.reportSummary.ruleSetsUsed.length === 0 ? (
                <div className="workspace-data-card is-full">
                  <p>Rule set</p>
                  <strong>Not linked in findings</strong>
                  <span>
                    This run did not return finding-level rule set metadata.
                  </span>
                </div>
              ) : (
                run.reportSummary.ruleSetsUsed.map((ruleSet) => (
                  <div
                    className="workspace-data-card is-wide"
                    key={`${ruleSet.code}-${ruleSet.version}`}
                  >
                    <p>{ruleSet.code}</p>
                    <strong>Version {ruleSet.version}</strong>
                    <span>
                      Sources:{" "}
                      {ruleSet.sourceLabels.length > 0
                        ? ruleSet.sourceLabels.join(", ")
                        : "No source labels returned"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Source context</p>
                <h3>{formatSourceType(run.sourceType)}</h3>
              </div>

              <div className="confidence-label">
                <FileCheck2 size={17} />
                raw XML not stored
              </div>
            </div>

            <div className="workspace-data-grid">
              {sourceContext.map((item) => (
                <div className="workspace-data-card" key={item.label}>
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                  <span>Report metadata</span>
                </div>
              ))}
            </div>
          </section>

          <section className="findings-console">
            <div className="findings-console-head">
              <div>
                <p>Findings</p>
                <h3>Rule findings and review messages</h3>
              </div>

              <div className="confidence-label">
                <ShieldAlert size={17} />
                {run.findings.length > 0 ? "review findings" : "no findings"}
              </div>
            </div>

            <div className="finding-console-list">
              {run.findings.length === 0 ? (
                <div className="finding-console-row">
                  <BadgeCheck size={18} />

                  <div>
                    <strong>NO_FINDINGS_RETURNED</strong>
                    <p>
                      No selected technical issues were returned by this sandbox
                      validation run.
                    </p>
                  </div>

                  <span>info</span>
                </div>
              ) : (
                run.findings.map((item, index) => (
                  <div className="finding-console-row" key={`${item.code}-${index}`}>
                    <AlertTriangle size={18} />

                    <div>
                      <strong>{item.code}</strong>
                      <p>{item.message}</p>
                      <p>
                        Severity: {item.severity}. Category:{" "}
                        {item.category || "Validation"}. Field:{" "}
                        {item.fieldPath ?? item.field ?? "report"}.
                      </p>
                      {item.fixSuggestion ? (
                        <p>Fix suggestion: {item.fixSuggestion}</p>
                      ) : null}
                      <p>
                        Legal confidence:{" "}
                        {formatLegalConfidence(item.legalConfidence)}. Rule set:{" "}
                        {item.ruleSetCode || "Not linked"}. Version:{" "}
                        {item.ruleVersion || "not versioned"}.
                      </p>
                      {item.sourceLabels && item.sourceLabels.length > 0 ? (
                        <p>Sources: {item.sourceLabels.join(", ")}.</p>
                      ) : null}
                    </div>

                    <span>{item.severity}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="workspace-alerts">
            <div className="alerts-head">
              <ClipboardList size={22} />

              <div>
                <p>Recommended next actions</p>
                <h3>Review steps from this report</h3>
              </div>
            </div>

            <div className="alert-list">
              {run.reportSummary.recommendedNextActions.map((action) => (
                <div className="alert-item" key={action}>
                  <span />
                  <p>{action}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-alerts">
            <div className="alerts-head">
              <ShieldAlert size={22} />

              <div>
                <p>Disclaimer</p>
                <h3>Sandbox boundary</h3>
              </div>
            </div>

            <div className="alert-list">
              <div className="alert-item">
                <span />
                <p>{run.reportSummary.disclaimer}</p>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
