"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  Clock3,
  Download,
  FileText,
  Globe2,
  Layers3,
  ShieldAlert
} from "lucide-react";

type VidaBuyerType = "business" | "consumer" | "public_authority" | "unknown";

type VidaTransactionType =
  | "goods"
  | "services"
  | "digital_service"
  | "mixed"
  | "unknown";

type VidaFindingSeverity = "info" | "warning" | "review_required" | "blocked";

type VidaLegalConfidence =
  | "technical"
  | "standard_based"
  | "official_source_derived"
  | "educational_simulation"
  | "professional_review_required";

type VidaFinding = {
  code: string;
  severity: VidaFindingSeverity;
  category: string;
  message: string;
  legalConfidence: VidaLegalConfidence;
  sourceLabels: string[];
  sourceRefs: string[];
  fixSuggestion: string;
  evidenceStatus?: string;
  countryPackStatus?: string;
  countryPackVersion?: string;
};

type VidaCountryContext = {
  sellerInEu: boolean;
  buyerInEu: boolean;
  sameCountry: boolean;
  crossBorderEu: boolean;
  sellerCountryPackStatus: string;
  buyerCountryPackStatus: string;
  sellerCountryPackVersion: string | null;
  buyerCountryPackVersion: string | null;
  sellerCountryPackSourceCoverageStatus: string;
  buyerCountryPackSourceCoverageStatus: string;
};

type VidaNormalizedInput = {
  sellerCountryCode: string | null;
  buyerCountryCode: string | null;
  sellerVatCountryCode: string | null;
  buyerVatCountryCode: string | null;
  sellerVatId: string | null;
  buyerVatId: string | null;
  buyerType: VidaBuyerType;
  sellerType: string;
  transactionType: VidaTransactionType;
  supplyScenario: string;
  invoiceDate: string | null;
  issueDate: string | null;
  currency: string | null;
  amount: string | null;
  invoiceProfile: string | null;
  countryPackVersions: Record<string, string>;
};

type VidaTimelineItem = {
  date: string;
  label: string;
  sourceRefs: string[];
  relevance: string;
};

type VidaSourceReference = {
  id: string;
  label: string;
  title?: string;
  publisher?: string;
  url?: string;
  notes?: string;
};

type VidaEvidenceSummary = {
  vatFormatEvidence: Record<string, unknown>;
  viesEvidence: Record<string, unknown>;
  structuredInvoiceEvidence: Record<string, unknown>;
  countryPackEvidence: Record<string, unknown>;
  xmlValidationEvidence: Record<string, unknown>;
  schematronEvidence: Record<string, unknown>;
};

type VidaSimulationResult = {
  simulationVersion: string;
  transactionClass: string;
  vidaRelevance: string;
  readinessScore: number | null;
  readinessStatus: string;
  reason: string;
  effectiveDateContext: string;
  timeline: VidaTimelineItem[];
  confidence: string;
  legalConfidence: VidaLegalConfidence;
  countryContext: VidaCountryContext;
  normalizedInput: VidaNormalizedInput;
  evidenceSummary: VidaEvidenceSummary;
  findings: VidaFinding[];
  recommendedNextActions: string[];
  sourceReferences: VidaSourceReference[];
  disclaimer: string;
  persisted: boolean;
  simulationRunId: string | null;
};

type VidaSimulationRunSource = "workspace" | "developer_api" | "system";

type VidaSimulationRunSummary = {
  id: string;
  source: VidaSimulationRunSource;
  status: string;
  simulationVersion: string;
  sellerCountryCode: string | null;
  buyerCountryCode: string | null;
  buyerType: string;
  transactionType: string;
  transactionClass: string;
  vidaRelevance: string;
  readinessScore: number | null;
  readinessStatus: string;
  legalConfidence: VidaLegalConfidence;
  invoiceDate: string | null;
  currencyCode: string | null;
  amountText: string | null;
  countryPackVersions: Record<string, string>;
  countryContext: VidaCountryContext;
  normalizedInput: VidaNormalizedInput;
  evidenceSummary: VidaEvidenceSummary;
  timeline: VidaTimelineItem[];
  sourceReferences: VidaSourceReference[];
  findingCount: number;
  infoCount: number;
  warningCount: number;
  reviewRequiredCount: number;
  reason: string;
  effectiveDateContext: string;
  disclaimer: string;
  createdAt: string;
  updatedAt: string;
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

type EvidenceItem = {
  label: string;
  value: string;
};

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
  fallback = "The ViDA simulation run request failed."
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

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function readBooleanField(
  record: Record<string, unknown>,
  key: string,
  fallback = false
) {
  const value = record[key];

  return typeof value === "boolean" ? value : fallback;
}

function readStringArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readStringRecordField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
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

function normalizeFindingSeverity(value: unknown): VidaFindingSeverity {
  return value === "warning" ||
    value === "review_required" ||
    value === "blocked"
    ? value
    : "info";
}

function normalizeLegalConfidence(value: unknown): VidaLegalConfidence {
  return value === "technical" ||
    value === "standard_based" ||
    value === "official_source_derived" ||
    value === "professional_review_required"
    ? value
    : "educational_simulation";
}

function normalizeCountryContext(value: unknown): VidaCountryContext {
  const record = isPlainObject(value) ? value : {};

  return {
    sellerInEu: readBooleanField(record, "sellerInEu"),
    buyerInEu: readBooleanField(record, "buyerInEu"),
    sameCountry: readBooleanField(record, "sameCountry"),
    crossBorderEu: readBooleanField(record, "crossBorderEu"),
    sellerCountryPackStatus: readStringField(
      record,
      "sellerCountryPackStatus",
      "unknown"
    ),
    buyerCountryPackStatus: readStringField(
      record,
      "buyerCountryPackStatus",
      "unknown"
    ),
    sellerCountryPackVersion: readNullableStringField(
      record,
      "sellerCountryPackVersion"
    ),
    buyerCountryPackVersion: readNullableStringField(
      record,
      "buyerCountryPackVersion"
    ),
    sellerCountryPackSourceCoverageStatus: readStringField(
      record,
      "sellerCountryPackSourceCoverageStatus",
      "unknown"
    ),
    buyerCountryPackSourceCoverageStatus: readStringField(
      record,
      "buyerCountryPackSourceCoverageStatus",
      "unknown"
    )
  };
}

function normalizeNormalizedInput(value: unknown): VidaNormalizedInput {
  const record = isPlainObject(value) ? value : {};

  return {
    sellerCountryCode: readNullableStringField(record, "sellerCountryCode"),
    buyerCountryCode: readNullableStringField(record, "buyerCountryCode"),
    sellerVatCountryCode: readNullableStringField(record, "sellerVatCountryCode"),
    buyerVatCountryCode: readNullableStringField(record, "buyerVatCountryCode"),
    sellerVatId: readNullableStringField(record, "sellerVatId"),
    buyerVatId: readNullableStringField(record, "buyerVatId"),
    buyerType: normalizeBuyerType(record.buyerType),
    sellerType: readStringField(record, "sellerType", "business"),
    transactionType: normalizeTransactionType(record.transactionType),
    supplyScenario: readStringField(record, "supplyScenario", "unknown"),
    invoiceDate: readNullableStringField(record, "invoiceDate"),
    issueDate: readNullableStringField(record, "issueDate"),
    currency: readNullableStringField(record, "currency"),
    amount: readNullableStringField(record, "amount"),
    invoiceProfile: readNullableStringField(record, "invoiceProfile"),
    countryPackVersions: readStringRecordField(record, "countryPackVersions")
  };
}

function normalizeTimeline(value: unknown): VidaTimelineItem[] {
  return Array.isArray(value)
    ? value
        .filter(isPlainObject)
        .map((item) => ({
          date: readStringField(item, "date"),
          label: readStringField(item, "label"),
          sourceRefs: readStringArrayField(item, "sourceRefs"),
          relevance: readStringField(item, "relevance")
        }))
        .filter((item) => item.date && item.label)
    : [];
}

function normalizeSourceReferences(value: unknown): VidaSourceReference[] {
  return Array.isArray(value)
    ? value
        .filter(isPlainObject)
        .map((item) => ({
          id: readStringField(item, "id"),
          label: readStringField(item, "label"),
          title: readStringField(item, "title"),
          publisher: readStringField(item, "publisher"),
          url: readStringField(item, "url"),
          notes: readStringField(item, "notes")
        }))
        .filter((item) => item.id && item.label)
    : [];
}

function normalizeEvidenceSummary(value: unknown): VidaEvidenceSummary {
  const record = isPlainObject(value) ? value : {};

  return {
    vatFormatEvidence: isPlainObject(record.vatFormatEvidence)
      ? record.vatFormatEvidence
      : {},
    viesEvidence: isPlainObject(record.viesEvidence) ? record.viesEvidence : {},
    structuredInvoiceEvidence: isPlainObject(record.structuredInvoiceEvidence)
      ? record.structuredInvoiceEvidence
      : {},
    countryPackEvidence: isPlainObject(record.countryPackEvidence)
      ? record.countryPackEvidence
      : {},
    xmlValidationEvidence: isPlainObject(record.xmlValidationEvidence)
      ? record.xmlValidationEvidence
      : {},
    schematronEvidence: isPlainObject(record.schematronEvidence)
      ? record.schematronEvidence
      : {}
  };
}

function normalizeFinding(value: unknown): VidaFinding | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code");

  if (!code) {
    return null;
  }

  return {
    code,
    severity: normalizeFindingSeverity(value.severity),
    category: readStringField(value, "category", "VIDA_SIMULATION"),
    message: readStringField(value, "message"),
    legalConfidence: normalizeLegalConfidence(value.legalConfidence),
    sourceLabels: readStringArrayField(value, "sourceLabels"),
    sourceRefs: readStringArrayField(value, "sourceRefs"),
    fixSuggestion: readStringField(value, "fixSuggestion"),
    evidenceStatus: readStringField(value, "evidenceStatus"),
    countryPackStatus: readStringField(value, "countryPackStatus"),
    countryPackVersion: readStringField(value, "countryPackVersion")
  };
}

function normalizeFindings(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((finding) => normalizeFinding(finding))
        .filter((finding): finding is VidaFinding => finding !== null)
    : [];
}

function normalizeVidaResult(value: unknown): VidaSimulationResult | null {
  if (!isPlainObject(value)) {
    return null;
  }

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
    readinessScore:
      typeof value.readinessScore === "number" ? value.readinessScore : null,
    readinessStatus: readStringField(
      value,
      "readinessStatus",
      "professional_review_required"
    ),
    reason: readStringField(value, "reason"),
    effectiveDateContext: readStringField(value, "effectiveDateContext"),
    timeline: normalizeTimeline(value.timeline),
    confidence: readStringField(value, "confidence", "educational_simulation"),
    legalConfidence: normalizeLegalConfidence(value.legalConfidence),
    countryContext: normalizeCountryContext(value.countryContext),
    normalizedInput: normalizeNormalizedInput(value.normalizedInput),
    evidenceSummary: normalizeEvidenceSummary(value.evidenceSummary),
    findings: normalizeFindings(value.findings),
    recommendedNextActions: readStringArrayField(
      value,
      "recommendedNextActions"
    ),
    sourceReferences: normalizeSourceReferences(value.sourceReferences),
    disclaimer: readStringField(value, "disclaimer"),
    persisted: value.persisted === true,
    simulationRunId: readNullableStringField(value, "simulationRunId")
  };
}

function normalizeRunSource(value: unknown): VidaSimulationRunSource {
  return value === "developer_api" || value === "system" ? value : "workspace";
}

function normalizeVidaSimulationRunSummary(
  value: unknown
): VidaSimulationRunSummary | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const createdAt = readStringField(value, "createdAt");

  if (!id || !createdAt) {
    return null;
  }

  return {
    id,
    source: normalizeRunSource(value.source),
    status: readStringField(value, "status", "completed"),
    simulationVersion: readStringField(value, "simulationVersion", "unknown"),
    sellerCountryCode: readNullableStringField(value, "sellerCountryCode"),
    buyerCountryCode: readNullableStringField(value, "buyerCountryCode"),
    buyerType: readStringField(value, "buyerType", "unknown"),
    transactionType: readStringField(value, "transactionType", "unknown"),
    transactionClass: readStringField(
      value,
      "transactionClass",
      "insufficient_data"
    ),
    vidaRelevance: readStringField(value, "vidaRelevance", "review_required"),
    readinessScore:
      typeof value.readinessScore === "number" ? value.readinessScore : null,
    readinessStatus: readStringField(
      value,
      "readinessStatus",
      "professional_review_required"
    ),
    legalConfidence: normalizeLegalConfidence(value.legalConfidence),
    invoiceDate: readNullableStringField(value, "invoiceDate"),
    currencyCode: readNullableStringField(value, "currencyCode"),
    amountText: readNullableStringField(value, "amountText"),
    countryPackVersions: readStringRecordField(value, "countryPackVersions"),
    countryContext: normalizeCountryContext(value.countryContext),
    normalizedInput: normalizeNormalizedInput(value.normalizedInput),
    evidenceSummary: normalizeEvidenceSummary(value.evidenceSummary),
    timeline: normalizeTimeline(value.timeline),
    sourceReferences: normalizeSourceReferences(value.sourceReferences),
    findingCount: readNumberField(value, "findingCount"),
    infoCount: readNumberField(value, "infoCount"),
    warningCount: readNumberField(value, "warningCount"),
    reviewRequiredCount: readNumberField(value, "reviewRequiredCount"),
    reason: readStringField(value, "reason"),
    effectiveDateContext: readStringField(value, "effectiveDateContext"),
    disclaimer: readStringField(value, "disclaimer"),
    createdAt,
    updatedAt: readStringField(value, "updatedAt", createdAt)
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
    findings: normalizeFindings(record.findings),
    sourceLabels: readStringArrayField(record, "sourceLabels"),
    recommendedNextActions: readStringArrayField(
      record,
      "recommendedNextActions"
    ),
    errorCode: readNullableStringField(record, "errorCode"),
    errorMessage: readNullableStringField(record, "errorMessage"),
    requestMetadata: isPlainObject(record.requestMetadata)
      ? record.requestMetadata
      : {}
  };
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatLegalConfidence(value: string) {
  const labels: Record<string, string> = {
    technical: "Technical",
    standard_based: "Standards-based",
    official_source_derived: "Source-derived context",
    educational_simulation: "Educational simulation",
    professional_review_required: "Professional review required"
  };

  return labels[value] ?? formatStatus(value || "not labelled");
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatNullable(value: string | null, fallback = "Not provided") {
  return value && value.trim().length > 0 ? value : fallback;
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function formatRecordValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "null";
  }

  return JSON.stringify(value);
}

function sanitizeFileNamePart(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 90);

  return cleaned || "vida-simulation-run";
}

function buildJsonExportFileName(run: VidaSimulationRunDetail) {
  const datePart = new Date().toISOString().slice(0, 10);

  return `invoice-lantern-vida-simulation-${sanitizeFileNamePart(
    run.id
  )}-${datePart}.json`;
}

function buildExportPayload(run: VidaSimulationRunDetail) {
  return {
    platform: {
      name: "Invoice Lantern",
      productBoundary:
        "Independent e-invoice validation and readiness sandbox. Not official validation, not authority submission, not legal, tax, or accounting advice, and not a compliance guarantee."
    },
    export: {
      exportedAt: new Date().toISOString(),
      exportFormat: "invoice_lantern_vida_simulation_run_json_v1",
      rawXmlIncluded: false,
      fullApiKeysIncluded: false,
      keyHashesIncluded: false
    },
    run
  };
}

function downloadVidaSimulationRunJson(run: VidaSimulationRunDetail) {
  const json = JSON.stringify(buildExportPayload(run), null, 2);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8"
  });

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = buildJsonExportFileName(run);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(objectUrl);
}

function buildCountryContextItems(run: VidaSimulationRunDetail): EvidenceItem[] {
  return [
    {
      label: "Seller EU",
      value: formatBoolean(run.countryContext.sellerInEu)
    },
    {
      label: "Buyer EU",
      value: formatBoolean(run.countryContext.buyerInEu)
    },
    {
      label: "Same country",
      value: formatBoolean(run.countryContext.sameCountry)
    },
    {
      label: "Cross-border EU",
      value: formatBoolean(run.countryContext.crossBorderEu)
    },
    {
      label: "Seller country",
      value: formatNullable(run.normalizedInput.sellerCountryCode, "Unknown")
    },
    {
      label: "Buyer country",
      value: formatNullable(run.normalizedInput.buyerCountryCode, "Unknown")
    },
    {
      label: "Seller pack",
      value: `${run.countryContext.sellerCountryPackStatus} ${
        run.countryContext.sellerCountryPackVersion ?? "unversioned"
      }`
    },
    {
      label: "Buyer pack",
      value: `${run.countryContext.buyerCountryPackStatus} ${
        run.countryContext.buyerCountryPackVersion ?? "unversioned"
      }`
    },
    {
      label: "Seller source coverage",
      value: run.countryContext.sellerCountryPackSourceCoverageStatus
    },
    {
      label: "Buyer source coverage",
      value: run.countryContext.buyerCountryPackSourceCoverageStatus
    }
  ];
}

function buildTransactionContextItems(
  run: VidaSimulationRunDetail
): EvidenceItem[] {
  return [
    {
      label: "Seller VAT ID",
      value: formatNullable(run.normalizedInput.sellerVatId)
    },
    {
      label: "Buyer VAT ID",
      value: formatNullable(run.normalizedInput.buyerVatId)
    },
    {
      label: "Buyer type",
      value: formatStatus(run.normalizedInput.buyerType)
    },
    {
      label: "Seller type",
      value: formatStatus(run.normalizedInput.sellerType)
    },
    {
      label: "Transaction type",
      value: formatStatus(run.normalizedInput.transactionType)
    },
    {
      label: "Supply scenario",
      value: formatStatus(run.normalizedInput.supplyScenario)
    },
    {
      label: "Invoice date",
      value: formatNullable(run.normalizedInput.invoiceDate)
    },
    {
      label: "Issue date",
      value: formatNullable(run.normalizedInput.issueDate)
    },
    {
      label: "Invoice profile",
      value: formatNullable(run.normalizedInput.invoiceProfile)
    },
    {
      label: "Currency",
      value: formatNullable(run.normalizedInput.currency)
    },
    {
      label: "Amount",
      value: formatNullable(run.normalizedInput.amount)
    }
  ];
}

export default function WorkspaceVidaSimulationRunDetailPage() {
  const params = useParams<{ id: string }>();
  const simulationRunId = typeof params.id === "string" ? params.id : "";

  const [run, setRun] = useState<VidaSimulationRunDetail | null>(null);
  const [isLoadingRun, setIsLoadingRun] = useState(true);
  const [runMessage, setRunMessage] = useState("");

  const countryContextItems = useMemo(
    () => (run ? buildCountryContextItems(run) : []),
    [run]
  );
  const transactionContextItems = useMemo(
    () => (run ? buildTransactionContextItems(run) : []),
    [run]
  );

  const loadSimulationRun = useCallback(async () => {
    if (!simulationRunId.trim()) {
      setRun(null);
      setRunMessage("A ViDA simulation run ID is required.");
      setIsLoadingRun(false);
      return;
    }

    setIsLoadingRun(true);
    setRunMessage("");

    try {
      const response = await fetch(
        `/api/local/transactions/vida-simulations/${encodeURIComponent(
          simulationRunId
        )}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setRun(null);
        setRunMessage(
          getApiErrorMessage(
            responseData,
            "Could not load this saved ViDA simulation run."
          )
        );
        return;
      }

      const normalizedRun = normalizeVidaSimulationRunDetail(responseData);

      if (!normalizedRun) {
        setRun(null);
        setRunMessage(
          "The saved ViDA simulation run returned an unreadable response shape."
        );
        return;
      }

      setRun(normalizedRun);
    } catch {
      setRun(null);
      setRunMessage(
        "The saved ViDA simulation run could not be loaded. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsLoadingRun(false);
    }
  }, [simulationRunId]);

  useEffect(() => {
    void loadSimulationRun();
  }, [loadSimulationRun]);

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <Link href="/workspace/vida-simulator" className="back-link">
          <ArrowLeft size={17} />
          ViDA simulator
        </Link>

        <p className="workspace-kicker">Saved ViDA simulation</p>
        <h2>Workspace simulation run detail.</h2>
        <p>
          {run
            ? `Run ${run.id}. Created ${formatDateTime(
                run.createdAt
              )}. This is a workspace-owned readiness simulation audit record, not filing evidence or official authority confirmation.`
            : "This page loads a saved workspace-owned ViDA-readiness simulation run."}
        </p>

        {run ? (
          <div className="workspace-row-actions">
            <div className="confidence-label">
              <ShieldAlert size={17} />
              Not official validation
            </div>

            <button
              type="button"
              className="text-link-button"
              onClick={() => downloadVidaSimulationRunJson(run)}
            >
              <Download size={16} />
              Download JSON evidence
            </button>
          </div>
        ) : null}

        {runMessage ? (
          <div className="alert-item">
            <span />
            <p>{runMessage}</p>
          </div>
        ) : null}
      </section>

      {isLoadingRun ? (
        <section className="workspace-alerts">
          <div className="alerts-head">
            <Clock3 size={22} />

            <div>
              <p>Loading</p>
              <h3>Reading saved simulation run.</h3>
            </div>
          </div>

          <div className="alert-list">
            <div className="alert-item">
              <span />
              <p>Loading the workspace-owned ViDA simulation evidence record.</p>
            </div>
          </div>
        </section>
      ) : null}

      {!run && !isLoadingRun ? (
        <section className="workspace-alerts">
          <div className="alerts-head">
            <ShieldAlert size={22} />

            <div>
              <p>Record unavailable</p>
              <h3>No saved ViDA simulation run was found.</h3>
            </div>
          </div>

          <div className="alert-list">
            <div className="alert-item">
              <span />
              <p>
                The run may have been deleted, the API may be unavailable, or
                the route may have been opened with an invalid run ID.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {run ? (
        <>
          <section className="workspace-stat-strip">
            <div className="workspace-stat">
              <p>Version</p>
              <strong>{run.simulationVersion}</strong>
              <span>Versioned sandbox simulation result.</span>
            </div>

            <div className="workspace-stat">
              <p>Readiness</p>
              <strong>{formatStatus(run.readinessStatus)}</strong>
              <span>
                Score {run.readinessScore ?? "not available"}; signal only.
              </span>
            </div>

            <div className="workspace-stat">
              <p>Findings</p>
              <strong>{run.findingCount}</strong>
              <span>
                {run.reviewRequiredCount} review · {run.warningCount} warning ·{" "}
                {run.infoCount} info
              </span>
            </div>

            <div className="workspace-stat">
              <p>Source</p>
              <strong>{formatStatus(run.source)}</strong>
              <span>How this evidence record was created.</span>
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Run summary</p>
                <h3>Saved simulation metadata</h3>
              </div>

              <div className="confidence-label">
                <BadgeCheck size={17} />
                {formatStatus(run.status)}
              </div>
            </div>

            <div className="workspace-data-grid">
              <div className="workspace-data-card is-wide">
                <p>Run ID</p>
                <strong>{run.id}</strong>
                <span>Workspace-owned simulation record</span>
              </div>

              <div className="workspace-data-card">
                <p>Transaction class</p>
                <strong>{formatStatus(run.transactionClass)}</strong>
                <span>Simulation classifier output</span>
              </div>

              <div className="workspace-data-card">
                <p>Legal confidence</p>
                <strong>{formatLegalConfidence(run.legalConfidence)}</strong>
                <span>Not legal, tax, or accounting advice</span>
              </div>

              <div className="workspace-data-card">
                <p>Created</p>
                <strong>{formatDateTime(run.createdAt)}</strong>
                <span>Record creation time</span>
              </div>

              <div className="workspace-data-card">
                <p>Updated</p>
                <strong>{formatDateTime(run.updatedAt)}</strong>
                <span>Record update time</span>
              </div>

              <div className="workspace-data-card is-wide">
                <p>Reason</p>
                <strong>{run.reason}</strong>
                <span>Simulation explanation</span>
              </div>
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Country context</p>
                <h3>EU transaction context</h3>
              </div>

              <div className="confidence-label">
                <Globe2 size={17} />
                readiness context
              </div>
            </div>

            <div className="workspace-data-grid">
              {countryContextItems.map((item) => (
                <div className="workspace-data-card" key={item.label}>
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                  <span>Normalized country context</span>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Normalized input</p>
                <h3>Transaction fields retained for review</h3>
              </div>

              <div className="confidence-label">
                <FileText size={17} />
                sanitized snapshot
              </div>
            </div>

            <div className="workspace-data-grid">
              {transactionContextItems.map((item) => (
                <div className="workspace-data-card" key={item.label}>
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                  <span>Simulation input context</span>
                </div>
              ))}

              <div className="workspace-data-card is-wide">
                <p>Country-pack versions</p>
                <strong>
                  {Object.keys(run.countryPackVersions).length > 0
                    ? Object.entries(run.countryPackVersions)
                        .map(([country, version]) => `${country}: ${version}`)
                        .join(", ")
                    : "No country-pack version context"}
                </strong>
                <span>Optional simulation metadata</span>
              </div>
            </div>
          </section>

          <section className="findings-console">
            <div className="findings-console-head">
              <div>
                <p>Findings</p>
                <h3>Simulation findings and review messages</h3>
              </div>

              <div className="confidence-label">
                <Layers3 size={17} />
                {formatLegalConfidence(run.legalConfidence)}
              </div>
            </div>

            <div className="finding-console-list">
              <div className="finding-console-row">
                <BadgeCheck size={18} />

                <div>
                  <strong>VIDA_RELEVANCE_SIGNAL</strong>
                  <p>{run.reason}</p>
                  <p>
                    Relevance: {formatStatus(run.vidaRelevance)}. Transaction
                    class: {formatStatus(run.transactionClass)}.
                  </p>
                </div>

                <span>{run.vidaRelevance}</span>
              </div>

              <div className="finding-console-row">
                <Layers3 size={18} />

                <div>
                  <strong>VIDA_EVIDENCE_SUMMARY</strong>
                  <p>
                    VAT format:{" "}
                    {formatRecordValue(
                      run.evidenceSummary.vatFormatEvidence.sellerStatus
                    )}{" "}
                    seller /{" "}
                    {formatRecordValue(
                      run.evidenceSummary.vatFormatEvidence.buyerStatus
                    )}{" "}
                    buyer. VIES:{" "}
                    {formatRecordValue(
                      run.evidenceSummary.viesEvidence.sellerStatus
                    )}{" "}
                    seller /{" "}
                    {formatRecordValue(
                      run.evidenceSummary.viesEvidence.buyerStatus
                    )}{" "}
                    buyer.
                  </p>
                  <p>
                    XSD:{" "}
                    {formatRecordValue(
                      run.evidenceSummary.xmlValidationEvidence.xsdStatus
                    )}
                    . Peppol Schematron:{" "}
                    {formatRecordValue(
                      run.evidenceSummary.schematronEvidence.peppolStatus
                    )}
                    . EN 16931 Schematron:{" "}
                    {formatRecordValue(
                      run.evidenceSummary.schematronEvidence.en16931Status
                    )}
                    .
                  </p>
                </div>

                <span>{run.readinessStatus}</span>
              </div>

              {run.timeline.map((item) => (
                <div
                  className="finding-console-row"
                  key={`${item.date}-${item.relevance}`}
                >
                  <Clock3 size={18} />

                  <div>
                    <strong>{item.date}</strong>
                    <p>{item.label}</p>
                    <p>
                      Source references:{" "}
                      {item.sourceRefs.length > 0
                        ? item.sourceRefs.join(", ")
                        : "No source references"}
                      .
                    </p>
                  </div>

                  <span>{item.relevance}</span>
                </div>
              ))}

              <div className="finding-console-row">
                <BookOpenCheck size={18} />

                <div>
                  <strong>VIDA_EFFECTIVE_DATE_CONTEXT</strong>
                  <p>{run.effectiveDateContext}</p>
                  <p>{run.disclaimer}</p>
                </div>

                <span>context</span>
              </div>

              {run.findings.length === 0 ? (
                <div className="finding-console-row">
                  <AlertTriangle size={18} />

                  <div>
                    <strong>VIDA_NO_FINDINGS_RETURNED</strong>
                    <p>
                      This saved simulation run did not return finding-level
                      messages.
                    </p>
                  </div>

                  <span>info</span>
                </div>
              ) : (
                run.findings.map((finding, index) => (
                  <div
                    className="finding-console-row"
                    key={`${finding.code}-${index}`}
                  >
                    <AlertTriangle size={18} />

                    <div>
                      <strong>{finding.code}</strong>
                      <p>{finding.message}</p>
                      <p>
                        Category: {finding.category}. Evidence:{" "}
                        {finding.evidenceStatus || "not labelled"}.
                      </p>
                      <p>
                        Legal confidence:{" "}
                        {formatLegalConfidence(finding.legalConfidence)}.
                        Sources:{" "}
                        {finding.sourceLabels.length > 0
                          ? finding.sourceLabels.join(", ")
                          : "No source label"}
                        .
                      </p>
                      {finding.sourceRefs.length > 0 ? (
                        <p>Source refs: {finding.sourceRefs.join(", ")}.</p>
                      ) : null}
                      {finding.fixSuggestion ? (
                        <p>Fix suggestion: {finding.fixSuggestion}</p>
                      ) : null}
                    </div>

                    <span>{finding.severity}</span>
                  </div>
                ))
              )}

              {run.recommendedNextActions.map((action, index) => (
                <div
                  className="finding-console-row"
                  key={`recommended-action-${index}`}
                >
                  <BookOpenCheck size={18} />

                  <div>
                    <strong>RECOMMENDED_NEXT_ACTION</strong>
                    <p>{action}</p>
                  </div>

                  <span>next</span>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Source labels</p>
                <h3>Source metadata attached to findings</h3>
              </div>

              <div className="confidence-label">
                <BookOpenCheck size={17} />
                metadata only
              </div>
            </div>

            <div className="workspace-line-grid">
              {run.sourceReferences.length === 0 && run.sourceLabels.length === 0 ? (
                <div className="workspace-line-row">
                  <strong>No source metadata returned</strong>
                  <span>
                    This simulation run did not include source metadata.
                  </span>
                </div>
              ) : (
                <>
                  {run.sourceReferences.map((sourceReference) => (
                    <div className="workspace-line-row" key={sourceReference.id}>
                      <strong>{sourceReference.label}</strong>
                      <span>{sourceReference.url || sourceReference.id}</span>
                    </div>
                  ))}
                  {run.sourceLabels.map((label) => (
                  <div className="workspace-line-row" key={label}>
                    <strong>{label}</strong>
                    <span>Readiness simulation source label</span>
                  </div>
                  ))}
                </>
              )}
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Request metadata</p>
                <h3>Safe request context</h3>
              </div>

              <div className="confidence-label">
                <Clock3 size={17} />
                no API secrets
              </div>
            </div>

            <div className="workspace-line-grid">
              {Object.keys(run.requestMetadata).length === 0 ? (
                <div className="workspace-line-row">
                  <strong>No request metadata returned</strong>
                  <span>
                    The saved run did not include request metadata fields.
                  </span>
                </div>
              ) : (
                Object.entries(run.requestMetadata).map(([key, value]) => (
                  <div className="workspace-line-row" key={key}>
                    <strong>{key}</strong>
                    <span>{formatRecordValue(value)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Payload snapshots</p>
                <h3>Sanitized stored simulation data</h3>
              </div>

              <div className="confidence-label">
                <ShieldAlert size={17} />
                no raw XML or API keys
              </div>
            </div>

            <div className="workspace-data-grid">
              <div className="workspace-data-card is-full">
                <p>Input payload</p>
                <strong>Stored simulation request snapshot</strong>
                <span>
                  Raw XML, full API keys, and key hashes are not included.
                </span>
                <pre>{JSON.stringify(run.inputPayload, null, 2)}</pre>
              </div>

              <div className="workspace-data-card is-full">
                <p>Result payload</p>
                <strong>Stored simulation result snapshot</strong>
                <span>
                  Educational readiness result only; not official validation.
                </span>
                <pre>{JSON.stringify(run.resultPayload, null, 2)}</pre>
              </div>
            </div>
          </section>

          <section className="workspace-alerts">
            <div className="alerts-head">
              <ShieldAlert size={22} />

              <div>
                <p>Boundary</p>
                <h3>Saved simulation runs are not official evidence.</h3>
              </div>
            </div>

            <div className="alert-list">
              <div className="alert-item">
                <span />
                <p>{run.disclaimer}</p>
              </div>

              <div className="alert-item">
                <span />
                <p>
                  This record is useful for internal review, debugging, audit
                  history, and readiness planning. It is not authority
                  submission, not filing software, not legal advice, not tax
                  advice, not accounting advice, and not a compliance guarantee.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
