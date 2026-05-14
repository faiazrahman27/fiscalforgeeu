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
  Eye,
  FileCheck2,
  FileText,
  Layers3,
  Play,
  RefreshCw,
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

type VidaBuyerType = "business" | "consumer" | "public_authority" | "unknown";

type VidaTransactionType =
  | "goods"
  | "services"
  | "digital_service"
  | "mixed"
  | "unknown";

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
  checkType?: string;
  layer?: string;
  sourceLabels?: string[];
  sourceReferences?: {
    sourceName: string;
    sourceLabel?: string;
    sourceUrl?: string;
  }[];
  countryPackVersion?: string;
  countryPackStatus?: string;
  countryPackCountryCode?: string;
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
  buyerCountry: string;
  sellerCountry: string;
  buyerVatId: string;
  sellerVatId: string;
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

type VidaFinding = {
  code: string;
  severity: string;
  message: string;
  legalConfidence: string;
  sourceLabels: string[];
  fixSuggestion: string;
};

type VidaSimulationResult = {
  simulationVersion: string;
  transactionClass: string;
  vidaRelevance: string;
  reason: string;
  effectiveDateContext: string;
  confidence: string;
  legalConfidence: string;
  countryContext: {
    sellerInEu: boolean;
    buyerInEu: boolean;
    sameCountry: boolean;
    crossBorderEu: boolean;
  };
  normalizedInput: {
    sellerCountryCode: string | null;
    buyerCountryCode: string | null;
    sellerVatId: string | null;
    buyerVatId: string | null;
    buyerType: VidaBuyerType;
    transactionType: VidaTransactionType;
    invoiceDate: string | null;
    currency: string | null;
    amount: string | null;
    countryPackVersions: Record<string, string>;
  };
  findings: VidaFinding[];
  recommendedNextActions: string[];
  disclaimer: string;
  persisted: boolean;
  simulationRunId: string | null;
};

type VidaSimulationRunSummary = {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  status: string;
  simulationVersion: string;
  sellerCountryCode: string | null;
  buyerCountryCode: string | null;
  buyerType: VidaBuyerType;
  transactionType: VidaTransactionType;
  transactionClass: string;
  vidaRelevance: string;
  legalConfidence: string;
  invoiceDate: string | null;
  currencyCode: string | null;
  amountText: string | null;
  findingCount: number;
  infoCount: number;
  warningCount: number;
  reviewRequiredCount: number;
  reason: string;
  effectiveDateContext: string;
  disclaimer: string;
};

type VidaSimulationRunDetail = VidaSimulationRunSummary & {
  inputPayload: Record<string, unknown>;
  resultPayload: VidaSimulationResult;
  findings: VidaFinding[];
  sourceLabels: string[];
  recommendedNextActions: string[];
  errorCode: string | null;
  errorMessage: string | null;
  requestMetadata: Record<string, unknown>;
};

type VidaSimulationForm = {
  sellerCountry: string;
  buyerCountry: string;
  sellerVatId: string;
  buyerVatId: string;
  buyerType: VidaBuyerType;
  transactionType: VidaTransactionType;
  invoiceDate: string;
  currency: string;
  amount: string;
};

const VALIDATION_REPORT_DISCLAIMER =
  "This validation report checks selected technical structure, calculation logic, canonical invoice rules, and sandbox rule metadata. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority compliance. Before issuing real invoices or making VAT decisions, consult a qualified accountant, tax adviser, or competent authority.";

const EMPTY_FINDING_COUNTS: ValidationReportFindingCounts = {
  info: 0,
  warning: 0,
  fatal: 0,
  blocked: 0
};

const DEFAULT_VIDA_FORM: VidaSimulationForm = {
  sellerCountry: "",
  buyerCountry: "",
  sellerVatId: "",
  buyerVatId: "",
  buyerType: "business",
  transactionType: "services",
  invoiceDate: "",
  currency: "EUR",
  amount: ""
};

function getStatusTone(status: string) {
  if (
    status === "passed" ||
    status === "ready" ||
    status === "not_relevant" ||
    status === "technical_preview" ||
    status === "technical" ||
    status === "no_selected_technical_issues_detected" ||
    status === "high" ||
    status === "completed"
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

function formatVidaLegalConfidence(value: string) {
  const labels: Record<string, string> = {
    educational_simulation: "Educational simulation",
    professional_review_required: "Professional review required"
  };

  return labels[value] ?? formatStatus(value || "not labelled");
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

function amountToText(value: number | string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === "string") {
    return value.trim().replace(/^[A-Z]{3}\s*/u, "");
  }

  return "";
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

function readNullableStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback = 0
) {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBooleanField(
  record: Record<string, unknown>,
  key: string,
  fallback = false
) {
  const value = record[key];

  return typeof value === "boolean" ? value : fallback;
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

function normalizeBuyerType(value: unknown): VidaBuyerType {
  return value === "business" ||
    value === "consumer" ||
    value === "public_authority" ||
    value === "unknown"
    ? value
    : "unknown";
}

function normalizeTransactionType(value: unknown): VidaTransactionType {
  return value === "goods" ||
    value === "services" ||
    value === "digital_service" ||
    value === "mixed" ||
    value === "unknown"
    ? value
    : "unknown";
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
    checkType: readStringField(value, "checkType", ""),
    layer: readStringField(value, "layer", ""),
    sourceLabels: readStringArray(value.sourceLabels),
    sourceReferences: Array.isArray(value.sourceReferences)
      ? value.sourceReferences
          .filter((item): item is Record<string, unknown> => isPlainObject(item))
          .map((item) => ({
            sourceName: readStringField(item, "sourceName", "Unnamed source"),
            sourceLabel: readStringField(item, "sourceLabel", ""),
            sourceUrl: readStringField(item, "sourceUrl", "")
          }))
      : [],
    countryPackVersion: readStringField(value, "countryPackVersion", ""),
    countryPackStatus: readStringField(value, "countryPackStatus", ""),
    countryPackCountryCode: readStringField(value, "countryPackCountryCode", "")
  };
}

function normalizeVidaFinding(value: unknown): VidaFinding | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code", "");

  if (!code) {
    return null;
  }

  return {
    code,
    severity: readStringField(value, "severity", "info"),
    message: readStringField(value, "message", ""),
    legalConfidence: readStringField(
      value,
      "legalConfidence",
      "educational_simulation"
    ),
    sourceLabels: readStringArray(value.sourceLabels),
    fixSuggestion: readStringField(value, "fixSuggestion", "")
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
    .filter((item): item is ValidationReportRuleSetSummary => item !== null);

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

  const totals = normalizeTotals(value.totals);

  const runWithoutSummary: Omit<SavedValidationRun, "reportSummary"> = {
    id,
    invoiceNumber: readStringField(value, "invoiceNumber", "Untitled invoice"),
    buyer: readStringField(value, "buyer", "Unknown buyer"),
    seller: readStringField(value, "seller", "Unknown seller"),
    buyerCountry:
      readStringField(value, "buyerCountry", "") ||
      readStringField(value, "buyerCountryCode", ""),
    sellerCountry:
      readStringField(value, "sellerCountry", "") ||
      readStringField(value, "sellerCountryCode", ""),
    buyerVatId: readStringField(value, "buyerVatId", ""),
    sellerVatId: readStringField(value, "sellerVatId", ""),
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
    totals,
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

function normalizeVidaResult(value: unknown): VidaSimulationResult | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const countryContext = isPlainObject(value.countryContext)
    ? value.countryContext
    : {};
  const normalizedInput = isPlainObject(value.normalizedInput)
    ? value.normalizedInput
    : {};
  const countryPackVersions = isPlainObject(normalizedInput.countryPackVersions)
    ? Object.fromEntries(
        Object.entries(normalizedInput.countryPackVersions)
          .filter(
            (entry): entry is [string, string] =>
              typeof entry[0] === "string" && typeof entry[1] === "string"
          )
          .map(([key, version]) => [key, version])
      )
    : {};

  return {
    simulationVersion: readStringField(
      value,
      "simulationVersion",
      "unversioned"
    ),
    transactionClass: readStringField(
      value,
      "transactionClass",
      "insufficient_data"
    ),
    vidaRelevance: readStringField(value, "vidaRelevance", "review_required"),
    reason: readStringField(value, "reason", ""),
    effectiveDateContext: readStringField(value, "effectiveDateContext", ""),
    confidence: readStringField(value, "confidence", "educational_simulation"),
    legalConfidence: readStringField(
      value,
      "legalConfidence",
      "educational_simulation"
    ),
    countryContext: {
      sellerInEu: readBooleanField(countryContext, "sellerInEu"),
      buyerInEu: readBooleanField(countryContext, "buyerInEu"),
      sameCountry: readBooleanField(countryContext, "sameCountry"),
      crossBorderEu: readBooleanField(countryContext, "crossBorderEu")
    },
    normalizedInput: {
      sellerCountryCode: readNullableStringField(
        normalizedInput,
        "sellerCountryCode"
      ),
      buyerCountryCode: readNullableStringField(
        normalizedInput,
        "buyerCountryCode"
      ),
      sellerVatId: readNullableStringField(normalizedInput, "sellerVatId"),
      buyerVatId: readNullableStringField(normalizedInput, "buyerVatId"),
      buyerType: normalizeBuyerType(normalizedInput.buyerType),
      transactionType: normalizeTransactionType(normalizedInput.transactionType),
      invoiceDate: readNullableStringField(normalizedInput, "invoiceDate"),
      currency: readNullableStringField(normalizedInput, "currency"),
      amount: readNullableStringField(normalizedInput, "amount"),
      countryPackVersions
    },
    findings: Array.isArray(value.findings)
      ? value.findings
          .map((finding) => normalizeVidaFinding(finding))
          .filter((finding): finding is VidaFinding => finding !== null)
      : [],
    recommendedNextActions: readStringArray(value.recommendedNextActions),
    disclaimer: readStringField(value, "disclaimer", ""),
    persisted: readBooleanField(value, "persisted"),
    simulationRunId: readNullableStringField(value, "simulationRunId")
  };
}

function normalizeVidaSimulationRunSummary(
  value: unknown
): VidaSimulationRunSummary | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id", "");

  if (!id) {
    return null;
  }

  return {
    id,
    createdAt: readStringField(value, "createdAt", ""),
    updatedAt: readStringField(value, "updatedAt", ""),
    source: readStringField(value, "source", "workspace"),
    status: readStringField(value, "status", "completed"),
    simulationVersion: readStringField(
      value,
      "simulationVersion",
      "unversioned"
    ),
    sellerCountryCode: readNullableStringField(value, "sellerCountryCode"),
    buyerCountryCode: readNullableStringField(value, "buyerCountryCode"),
    buyerType: normalizeBuyerType(value.buyerType),
    transactionType: normalizeTransactionType(value.transactionType),
    transactionClass: readStringField(
      value,
      "transactionClass",
      "insufficient_data"
    ),
    vidaRelevance: readStringField(value, "vidaRelevance", "review_required"),
    legalConfidence: readStringField(
      value,
      "legalConfidence",
      "educational_simulation"
    ),
    invoiceDate: readNullableStringField(value, "invoiceDate"),
    currencyCode: readNullableStringField(value, "currencyCode"),
    amountText: readNullableStringField(value, "amountText"),
    findingCount: readNumberField(value, "findingCount"),
    infoCount: readNumberField(value, "infoCount"),
    warningCount: readNumberField(value, "warningCount"),
    reviewRequiredCount: readNumberField(value, "reviewRequiredCount"),
    reason: readStringField(value, "reason", ""),
    effectiveDateContext: readStringField(value, "effectiveDateContext", ""),
    disclaimer: readStringField(value, "disclaimer", "")
  };
}

function normalizeVidaSimulationRunDetail(
  value: unknown
): VidaSimulationRunDetail | null {
  const record = isPlainObject(value) && isPlainObject(value.record)
    ? value.record
    : value;

  const summary = normalizeVidaSimulationRunSummary(record);

  if (!summary || !isPlainObject(record)) {
    return null;
  }

  const resultPayload = normalizeVidaResult(record.resultPayload);

  if (!resultPayload) {
    return null;
  }

  return {
    ...summary,
    inputPayload: isPlainObject(record.inputPayload) ? record.inputPayload : {},
    resultPayload: {
      ...resultPayload,
      persisted: true,
      simulationRunId: summary.id
    },
    findings: Array.isArray(record.findings)
      ? record.findings
          .map((finding) => normalizeVidaFinding(finding))
          .filter((finding): finding is VidaFinding => finding !== null)
      : resultPayload.findings,
    sourceLabels: readStringArray(record.sourceLabels),
    recommendedNextActions: readStringArray(record.recommendedNextActions),
    errorCode: readNullableStringField(record, "errorCode"),
    errorMessage: readNullableStringField(record, "errorMessage"),
    requestMetadata: isPlainObject(record.requestMetadata)
      ? record.requestMetadata
      : {}
  };
}

function readVidaSimulationRuns(value: unknown) {
  if (!isPlainObject(value)) {
    return [];
  }

  const rawRecords = Array.isArray(value.records)
    ? value.records
    : Array.isArray(value.runs)
      ? value.runs
      : Array.isArray(value.vidaSimulationRuns)
        ? value.vidaSimulationRuns
        : [];

  return rawRecords
    .map((record) => normalizeVidaSimulationRunSummary(record))
    .filter((record): record is VidaSimulationRunSummary => record !== null);
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

function buildPdfFallbackFileName(run: SavedValidationRun) {
  const shortRunId = sanitizeFileNamePart(run.id).slice(0, 12) || "report";

  return `invoice-lantern-validation-report-${shortRunId}.pdf`;
}

function readFilenameFromContentDisposition(
  contentDisposition: string | null,
  fallback: string
) {
  if (!contentDisposition) {
    return fallback;
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  const filename = filenameMatch?.[1]?.trim();

  return filename && filename.endsWith(".pdf") ? filename : fallback;
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
      buyerCountry: run.buyerCountry,
      sellerCountry: run.sellerCountry,
      buyerVatId: run.buyerVatId,
      sellerVatId: run.sellerVatId,
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

function buildVidaFormFromRun(run: SavedValidationRun): VidaSimulationForm {
  return {
    sellerCountry: run.sellerCountry,
    buyerCountry: run.buyerCountry,
    sellerVatId: run.sellerVatId,
    buyerVatId: run.buyerVatId,
    buyerType: "business",
    transactionType: "services",
    invoiceDate: run.issueDate,
    currency: run.currency || "EUR",
    amount: amountToText(run.totals.payableAmount)
  };
}

function buildVidaSimulationRequestBody(
  run: SavedValidationRun,
  form: VidaSimulationForm
) {
  const body: Record<string, unknown> = {
    sellerCountry: form.sellerCountry.trim(),
    buyerCountry: form.buyerCountry.trim(),
    buyerType: form.buyerType,
    transactionType: form.transactionType,
    persist: true,
    validationRunId: run.id
  };

  if (form.sellerVatId.trim()) {
    body.sellerVatId = form.sellerVatId.trim();
  }

  if (form.buyerVatId.trim()) {
    body.buyerVatId = form.buyerVatId.trim();
  }

  if (form.invoiceDate.trim()) {
    body.invoiceDate = form.invoiceDate.trim();
  }

  if (form.currency.trim()) {
    body.currency = form.currency.trim();
  }

  if (form.amount.trim()) {
    body.amount = form.amount.trim();
  }

  return body;
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
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [runLoadMessage, setRunLoadMessage] = useState("");
  const [pdfDownloadMessage, setPdfDownloadMessage] = useState("");

  const [vidaForm, setVidaForm] =
    useState<VidaSimulationForm>(DEFAULT_VIDA_FORM);
  const [vidaRuns, setVidaRuns] = useState<VidaSimulationRunSummary[]>([]);
  const [latestVidaResult, setLatestVidaResult] =
    useState<VidaSimulationResult | null>(null);
  const [selectedVidaRun, setSelectedVidaRun] =
    useState<VidaSimulationRunDetail | null>(null);
  const [openingVidaRunId, setOpeningVidaRunId] = useState("");
  const [isLoadingVidaRuns, setIsLoadingVidaRuns] = useState(false);
  const [isRunningVidaSimulation, setIsRunningVidaSimulation] = useState(false);
  const [vidaMessage, setVidaMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadValidationReport() {
      setIsLoadingRun(true);
      setRunLoadMessage("");
      setPdfDownloadMessage("");
      setVidaMessage("");
      setLatestVidaResult(null);
      setSelectedVidaRun(null);

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
        setVidaForm(buildVidaFormFromRun(normalizedRun));
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

  useEffect(() => {
    let isMounted = true;

    async function loadLinkedVidaRuns(validationRunId: string) {
      setIsLoadingVidaRuns(true);
      setVidaMessage("");

      try {
        const searchParams = new URLSearchParams({
          validationRunId,
          limit: "10"
        });
        const response = await fetch(
          `/api/local/transactions/vida-simulations?${searchParams.toString()}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );
        const responseData = await readResponseBody(response);

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          setVidaRuns([]);
          setVidaMessage(
            getApiErrorMessage(
              responseData,
              "Could not load saved ViDA simulations for this report."
            )
          );
          return;
        }

        setVidaRuns(readVidaSimulationRuns(responseData));
      } catch {
        if (isMounted) {
          setVidaRuns([]);
          setVidaMessage(
            "Saved ViDA simulations could not be loaded. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingVidaRuns(false);
        }
      }
    }

    if (run) {
      void loadLinkedVidaRuns(run.id);
    }

    return () => {
      isMounted = false;
    };
  }, [run]);

  const sourceContext = useMemo(() => (run ? buildSourceContext(run) : []), [run]);

  const canRunVidaSimulation =
    Boolean(run) &&
    vidaForm.sellerCountry.trim().length > 0 &&
    vidaForm.buyerCountry.trim().length > 0 &&
    !isRunningVidaSimulation;

  async function reloadLinkedVidaRuns(validationRunId: string) {
    setIsLoadingVidaRuns(true);

    try {
      const searchParams = new URLSearchParams({
        validationRunId,
        limit: "10"
      });
      const response = await fetch(
        `/api/local/transactions/vida-simulations?${searchParams.toString()}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setVidaRuns([]);
        setVidaMessage(
          getApiErrorMessage(
            responseData,
            "Could not refresh saved ViDA simulations for this report."
          )
        );
        return;
      }

      setVidaRuns(readVidaSimulationRuns(responseData));
    } catch {
      setVidaMessage(
        "Saved ViDA simulations could not be refreshed. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsLoadingVidaRuns(false);
    }
  }

  async function openLinkedVidaRun(vidaRunId: string) {
    setOpeningVidaRunId(vidaRunId);
    setVidaMessage("");

    try {
      const response = await fetch(
        `/api/local/transactions/vida-simulations/${encodeURIComponent(
          vidaRunId
        )}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setVidaMessage(
          getApiErrorMessage(
            responseData,
            "Could not open the saved ViDA simulation run."
          )
        );
        return;
      }

      const normalizedRun = normalizeVidaSimulationRunDetail(responseData);

      if (!normalizedRun) {
        setVidaMessage(
          "The saved ViDA simulation run returned an unreadable response shape."
        );
        return;
      }

      setSelectedVidaRun(normalizedRun);
      setLatestVidaResult(normalizedRun.resultPayload);
      setVidaMessage("Saved ViDA simulation record opened.");
    } catch {
      setVidaMessage(
        "The saved ViDA simulation run could not be opened. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setOpeningVidaRunId("");
    }
  }

  async function runVidaSimulationFromReport(currentRun: SavedValidationRun) {
    if (!vidaForm.sellerCountry.trim() || !vidaForm.buyerCountry.trim()) {
      setVidaMessage(
        "Seller country and buyer country are required before running a ViDA simulation from this report."
      );
      return;
    }

    setIsRunningVidaSimulation(true);
    setVidaMessage("");
    setLatestVidaResult(null);
    setSelectedVidaRun(null);

    try {
      const response = await fetch("/api/local/transactions/simulate-vida", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(
          buildVidaSimulationRequestBody(currentRun, vidaForm)
        ),
        cache: "no-store"
      });
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setVidaMessage(
          getApiErrorMessage(
            responseData,
            "Could not run the ViDA-readiness simulation from this report."
          )
        );
        return;
      }

      const normalizedResult = normalizeVidaResult(responseData);

      if (!normalizedResult) {
        setVidaMessage(
          "The ViDA simulator returned an unreadable response shape."
        );
        return;
      }

      setLatestVidaResult(normalizedResult);
      setVidaMessage(
        normalizedResult.persisted
          ? "ViDA simulation saved against this validation report."
          : "ViDA simulation completed, but no saved workspace run was returned."
      );
      await reloadLinkedVidaRuns(currentRun.id);
    } catch {
      setVidaMessage(
        "The local ViDA simulator API is unavailable. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsRunningVidaSimulation(false);
    }
  }

  async function downloadValidationReportPdf(currentRun: SavedValidationRun) {
    setIsDownloadingPdf(true);
    setPdfDownloadMessage("");

    try {
      const response = await fetch(
        `/api/local/validation-runs/${encodeURIComponent(
          currentRun.id
        )}/report.pdf`,
        {
          method: "GET",
          cache: "no-store"
        }
      );

      if (!response.ok) {
        const responseData = await readResponseBody(response);

        setPdfDownloadMessage(
          getApiErrorMessage(
            responseData,
            "Could not generate the PDF validation report."
          )
        );
        return;
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        setPdfDownloadMessage("The PDF validation report response was empty.");
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const filename = readFilenameFromContentDisposition(
        response.headers.get("content-disposition"),
        buildPdfFallbackFileName(currentRun)
      );

      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      setPdfDownloadMessage(
        "PDF report generated as a technical sandbox report. Not official validation or certification."
      );
    } catch {
      setPdfDownloadMessage(
        "Could not download the PDF report. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }

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
              Not official validation or certification
            </div>

            <button
              type="button"
              className="text-link-button"
              onClick={() => downloadValidationReportPdf(run)}
              disabled={isDownloadingPdf}
            >
              <Download size={16} />
              {isDownloadingPdf ? "Generating PDF..." : "Download PDF report"}
            </button>

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

        {pdfDownloadMessage ? (
          <div className="alert-item">
            <span />
            <p>{pdfDownloadMessage}</p>
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
                <span>
                  {run.sellerCountry
                    ? `Country ${run.sellerCountry}`
                    : "Country not detected"}
                </span>
              </div>

              <div className="workspace-data-card">
                <p>Buyer</p>
                <strong>{formatOptionalValue(run.buyer, "Unknown buyer")}</strong>
                <span>
                  {run.buyerCountry
                    ? `Country ${run.buyerCountry}`
                    : "Country not detected"}
                </span>
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
                <p>ViDA readiness</p>
                <h3>Run a saved simulation from this report</h3>
              </div>

              <div className="confidence-label">
                <ShieldAlert size={17} />
                linked history
              </div>
            </div>

            <p className="workspace-muted-copy">
              This action uses the current validation run as context and saves
              the ViDA-readiness simulation with this report ID. It remains an
              educational technical readiness result, not official software, not
              authority submission, not legal advice, not tax advice, not
              accounting advice, and not a compliance guarantee.
            </p>

            {vidaMessage ? (
              <div className="alert-item">
                <span />
                <p>{vidaMessage}</p>
              </div>
            ) : null}

            <form
              className="workspace-form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void runVidaSimulationFromReport(run);
              }}
            >
              <label>
                Seller country
                <input
                  maxLength={8}
                  required
                  value={vidaForm.sellerCountry}
                  onChange={(event) =>
                    setVidaForm((current) => ({
                      ...current,
                      sellerCountry: event.target.value
                    }))
                  }
                  placeholder="DE"
                />
              </label>

              <label>
                Buyer country
                <input
                  maxLength={8}
                  required
                  value={vidaForm.buyerCountry}
                  onChange={(event) =>
                    setVidaForm((current) => ({
                      ...current,
                      buyerCountry: event.target.value
                    }))
                  }
                  placeholder="HU"
                />
              </label>

              <label>
                Seller VAT ID
                <input
                  maxLength={64}
                  value={vidaForm.sellerVatId}
                  onChange={(event) =>
                    setVidaForm((current) => ({
                      ...current,
                      sellerVatId: event.target.value
                    }))
                  }
                  placeholder="DE123456789"
                />
              </label>

              <label>
                Buyer VAT ID
                <input
                  maxLength={64}
                  value={vidaForm.buyerVatId}
                  onChange={(event) =>
                    setVidaForm((current) => ({
                      ...current,
                      buyerVatId: event.target.value
                    }))
                  }
                  placeholder="HU12345678"
                />
              </label>

              <label>
                Buyer type
                <select
                  value={vidaForm.buyerType}
                  onChange={(event) =>
                    setVidaForm((current) => ({
                      ...current,
                      buyerType: event.target.value as VidaBuyerType
                    }))
                  }
                >
                  <option value="business">Business</option>
                  <option value="consumer">Consumer</option>
                  <option value="public_authority">Public authority</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>

              <label>
                Transaction type
                <select
                  value={vidaForm.transactionType}
                  onChange={(event) =>
                    setVidaForm((current) => ({
                      ...current,
                      transactionType: event.target.value as VidaTransactionType
                    }))
                  }
                >
                  <option value="services">Services</option>
                  <option value="goods">Goods</option>
                  <option value="digital_service">Digital service</option>
                  <option value="mixed">Mixed</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>

              <label>
                Invoice date
                <input
                  maxLength={32}
                  value={vidaForm.invoiceDate}
                  onChange={(event) =>
                    setVidaForm((current) => ({
                      ...current,
                      invoiceDate: event.target.value
                    }))
                  }
                  placeholder="2026-05-01"
                />
              </label>

              <label>
                Currency
                <input
                  maxLength={8}
                  value={vidaForm.currency}
                  onChange={(event) =>
                    setVidaForm((current) => ({
                      ...current,
                      currency: event.target.value
                    }))
                  }
                  placeholder="EUR"
                />
              </label>

              <label>
                Amount
                <input
                  maxLength={80}
                  value={vidaForm.amount}
                  onChange={(event) =>
                    setVidaForm((current) => ({
                      ...current,
                      amount: event.target.value
                    }))
                  }
                  placeholder="100.00"
                />
              </label>

              <button
                type="submit"
                className="workspace-auth-action"
                disabled={!canRunVidaSimulation}
              >
                <Play size={16} />
                {isRunningVidaSimulation
                  ? "Running simulation"
                  : "Run and save ViDA simulation"}
              </button>
            </form>

            {latestVidaResult ? (
              <div className="workspace-data-grid">
                <div
                  className={`workspace-data-card is-${getStatusTone(
                    latestVidaResult.vidaRelevance
                  )}`}
                >
                  <p>Latest relevance</p>
                  <strong>{formatStatus(latestVidaResult.vidaRelevance)}</strong>
                  <span>Saved: {latestVidaResult.persisted ? "yes" : "no"}</span>
                </div>

                <div className="workspace-data-card">
                  <p>Transaction class</p>
                  <strong>
                    {formatStatus(latestVidaResult.transactionClass)}
                  </strong>
                  <span>Simulation version {latestVidaResult.simulationVersion}</span>
                </div>

                <div className="workspace-data-card">
                  <p>EU context</p>
                  <strong>
                    {latestVidaResult.countryContext.crossBorderEu
                      ? "Cross-border EU"
                      : "Review context"}
                  </strong>
                  <span>
                    Seller EU:{" "}
                    {latestVidaResult.countryContext.sellerInEu ? "yes" : "no"} ·
                    Buyer EU:{" "}
                    {latestVidaResult.countryContext.buyerInEu ? "yes" : "no"}
                  </span>
                </div>

                <div className="workspace-data-card is-wide">
                  <p>Reason</p>
                  <strong>{latestVidaResult.reason || "No reason returned"}</strong>
                  <span>
                    {formatVidaLegalConfidence(latestVidaResult.legalConfidence)}
                  </span>
                </div>
              </div>
            ) : null}

            {selectedVidaRun ? (
              <section className="findings-console">
                <div className="findings-console-head">
                  <div>
                    <p>Opened ViDA record</p>
                    <h3>{formatStatus(selectedVidaRun.transactionClass)}</h3>
                  </div>

                  <div className="confidence-label">
                    <Eye size={17} />
                    {formatDateTime(selectedVidaRun.createdAt)}
                  </div>
                </div>

                <div className="finding-console-list">
                  <div className="finding-console-row">
                    <BadgeCheck size={18} />

                    <div>
                      <strong>VIDA_SIMULATION_RUN_OPENED</strong>
                      <p>
                        Run {selectedVidaRun.id}. Source:{" "}
                        {formatStatus(selectedVidaRun.source)}. Status:{" "}
                        {formatStatus(selectedVidaRun.status)}.
                      </p>
                      <p>
                        Relevance: {formatStatus(selectedVidaRun.vidaRelevance)}.
                        Legal confidence:{" "}
                        {formatVidaLegalConfidence(selectedVidaRun.legalConfidence)}.
                      </p>
                    </div>

                    <span>{selectedVidaRun.vidaRelevance}</span>
                  </div>

                  <div className="finding-console-row">
                    <FileCheck2 size={18} />

                    <div>
                      <strong>VIDA_LINKED_VALIDATION_REPORT</strong>
                      <p>
                        This ViDA run is linked to validation report {run.id}.
                        It is workspace evidence only, not filing evidence or
                        authority confirmation.
                      </p>
                      <p>{selectedVidaRun.effectiveDateContext}</p>
                    </div>

                    <span>linked</span>
                  </div>

                  {selectedVidaRun.findings.length === 0 ? (
                    <div className="finding-console-row">
                      <BadgeCheck size={18} />

                      <div>
                        <strong>VIDA_NO_FINDINGS_RETURNED</strong>
                        <p>
                          This saved ViDA simulation did not return finding-level
                          messages.
                        </p>
                      </div>

                      <span>info</span>
                    </div>
                  ) : (
                    selectedVidaRun.findings.map((finding, index) => (
                      <div
                        className="finding-console-row"
                        key={`${selectedVidaRun.id}-${finding.code}-${index}`}
                      >
                        <AlertTriangle size={18} />

                        <div>
                          <strong>{finding.code}</strong>
                          <p>{finding.message}</p>
                          <p>
                            Legal confidence:{" "}
                            {formatVidaLegalConfidence(finding.legalConfidence)}.
                            Sources:{" "}
                            {finding.sourceLabels.length > 0
                              ? finding.sourceLabels.join(", ")
                              : "No source label"}
                            .
                          </p>
                          {finding.fixSuggestion ? (
                            <p>Fix suggestion: {finding.fixSuggestion}</p>
                          ) : null}
                        </div>

                        <span>{finding.severity}</span>
                      </div>
                    ))
                  )}

                  {selectedVidaRun.recommendedNextActions.map((action, index) => (
                    <div
                      className="finding-console-row"
                      key={`${selectedVidaRun.id}-next-action-${index}`}
                    >
                      <ClipboardList size={18} />

                      <div>
                        <strong>VIDA_RECOMMENDED_NEXT_ACTION</strong>
                        <p>{action}</p>
                      </div>

                      <span>next</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="workspace-table-head api-rate-limit-head">
              <div>
                <p>Saved simulations</p>
                <h3>Linked ViDA history for this report</h3>
              </div>

              <button
                type="button"
                onClick={() => void reloadLinkedVidaRuns(run.id)}
                disabled={isLoadingVidaRuns}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            <div className="api-key-card-list">
              {isLoadingVidaRuns ? (
                <article className="api-key-card">
                  <header>
                    <div>
                      <strong>Loading saved simulations</strong>
                      <span>Reading workspace-owned ViDA run history.</span>
                    </div>
                    <span className="status-pill">loading</span>
                  </header>
                </article>
              ) : vidaRuns.length === 0 ? (
                <article className="api-key-card">
                  <header>
                    <div>
                      <strong>No saved ViDA simulations linked yet</strong>
                      <span>
                        Run the simulation above to save a workspace-owned
                        readiness record against this validation report.
                      </span>
                    </div>
                    <span className="status-pill">empty</span>
                  </header>
                </article>
              ) : (
                vidaRuns.map((vidaRun) => (
                  <article className="api-key-card" key={vidaRun.id}>
                    <header>
                      <div>
                        <strong>{formatStatus(vidaRun.transactionClass)}</strong>
                        <span>
                          {vidaRun.sellerCountryCode ?? "?"} →{" "}
                          {vidaRun.buyerCountryCode ?? "?"} ·{" "}
                          {formatDateTime(vidaRun.createdAt)}
                        </span>
                      </div>

                      <span className="status-pill">
                        {formatStatus(vidaRun.vidaRelevance)}
                      </span>
                    </header>

                    <div className="api-key-meta-grid">
                      <div>
                        <span>Version</span>
                        <strong>{vidaRun.simulationVersion}</strong>
                      </div>
                      <div>
                        <span>Buyer type</span>
                        <strong>{formatStatus(vidaRun.buyerType)}</strong>
                      </div>
                      <div>
                        <span>Transaction</span>
                        <strong>{formatStatus(vidaRun.transactionType)}</strong>
                      </div>
                      <div>
                        <span>Invoice date</span>
                        <strong>{vidaRun.invoiceDate ?? "Not recorded"}</strong>
                      </div>
                      <div>
                        <span>Amount</span>
                        <strong>
                          {vidaRun.currencyCode ?? "EUR"}{" "}
                          {vidaRun.amountText ?? "Not recorded"}
                        </strong>
                      </div>
                      <div>
                        <span>Findings</span>
                        <strong>{vidaRun.findingCount}</strong>
                      </div>
                    </div>

                    <p className="workspace-muted-copy">
                      {vidaRun.reason || "No reason text was stored."}
                    </p>

                    <div className="api-key-scope-list">
                      <span>{vidaRun.reviewRequiredCount} review</span>
                      <span>{vidaRun.warningCount} warning</span>
                      <span>{vidaRun.infoCount} info</span>
                      <span>{formatVidaLegalConfidence(vidaRun.legalConfidence)}</span>
                    </div>

                    <div className="workspace-row-actions">
                      <button
                        type="button"
                        className="text-link-button"
                        disabled={openingVidaRunId === vidaRun.id}
                        onClick={() => void openLinkedVidaRun(vidaRun.id)}
                      >
                        <Eye size={16} />
                        {openingVidaRunId === vidaRun.id
                          ? "Opening"
                          : "Open record"}
                      </button>
                    </div>
                  </article>
                ))
              )}
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
                      {item.checkType || item.layer ? (
                        <p>
                          Check: {item.checkType || "not recorded"}. Layer:{" "}
                          {item.layer || "not recorded"}.
                        </p>
                      ) : null}
                      {item.countryPackVersion || item.countryPackStatus ? (
                        <p>
                          Country pack:{" "}
                          {item.countryPackCountryCode || "not recorded"}{" "}
                          {item.countryPackVersion || "not versioned"}{" "}
                          {item.countryPackStatus
                            ? `(${formatStatus(item.countryPackStatus)})`
                            : ""}
                          . Professional review warning applies where flagged.
                        </p>
                      ) : null}
                      {item.sourceLabels && item.sourceLabels.length > 0 ? (
                        <p>Sources: {item.sourceLabels.join(", ")}.</p>
                      ) : null}
                      {item.sourceReferences && item.sourceReferences.length > 0 ? (
                        <p>
                          Source refs:{" "}
                          {item.sourceReferences
                            .map(
                              (sourceReference) =>
                                sourceReference.sourceLabel ||
                                sourceReference.sourceName
                            )
                            .join(", ")}
                          .
                        </p>
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
