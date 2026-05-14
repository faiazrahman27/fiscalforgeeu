"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpenCheck,
  Clock3,
  Eye,
  FileText,
  Globe2,
  Layers3,
  Play,
  RefreshCw,
  ShieldAlert
} from "lucide-react";

type VidaBuyerType = "business" | "consumer" | "public_authority" | "unknown";
type VidaSellerType = "business" | "public_authority" | "unknown";

type VidaTransactionType =
  | "goods"
  | "services"
  | "digital_service"
  | "mixed"
  | "unknown";

type VidaSupplyScenario = "domestic" | "intra_eu" | "non_eu" | "unknown";
type VidaInvoiceProfile = "EN16931" | "PEPPOL_BIS_3" | "COUNTRY_PACK";

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
  countryPackVersion?: string;
  countryPackStatus?: string;
  evidenceStatus?: string;
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
  sellerType: VidaSellerType;
  transactionType: VidaTransactionType;
  supplyScenario: VidaSupplyScenario;
  invoiceDate: string | null;
  issueDate: string | null;
  currency: string | null;
  amount: string | null;
  invoiceProfile: VidaInvoiceProfile | null;
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

type VidaSimulationForm = {
  sellerCountry: string;
  buyerCountry: string;
  sellerVatId: string;
  buyerVatId: string;
  buyerType: VidaBuyerType;
  sellerType: VidaSellerType;
  transactionType: VidaTransactionType;
  supplyScenario: VidaSupplyScenario;
  invoiceDate: string;
  issueDate: string;
  currency: string;
  amount: string;
  invoiceProfile: VidaInvoiceProfile;
  hasCanonicalInvoice: boolean;
  hasUblXml: boolean;
  xsdStatus: string;
  schematronPeppolStatus: string;
  schematronEn16931Status: string;
  sellerViesStatus: string;
  buyerViesStatus: string;
};

const defaultVidaForm: VidaSimulationForm = {
  sellerCountry: "DE",
  buyerCountry: "HU",
  sellerVatId: "DE123456789",
  buyerVatId: "HU12345678",
  buyerType: "business",
  sellerType: "business",
  transactionType: "services",
  supplyScenario: "intra_eu",
  invoiceDate: "2030-07-01",
  issueDate: "2030-07-01",
  currency: "EUR",
  amount: "100.00",
  invoiceProfile: "EN16931",
  hasCanonicalInvoice: false,
  hasUblXml: false,
  xsdStatus: "not_checked",
  schematronPeppolStatus: "not_checked",
  schematronEn16931Status: "not_checked",
  sellerViesStatus: "not_checked",
  buyerViesStatus: "not_checked"
};

const euCountryOptions = [
  ["AT", "Austria", "AT"],
  ["BE", "Belgium", "BE"],
  ["BG", "Bulgaria", "BG"],
  ["HR", "Croatia", "HR"],
  ["CY", "Cyprus", "CY"],
  ["CZ", "Czechia", "CZ"],
  ["DK", "Denmark", "DK"],
  ["EE", "Estonia", "EE"],
  ["FI", "Finland", "FI"],
  ["FR", "France", "FR"],
  ["DE", "Germany", "DE"],
  ["GR", "Greece", "EL"],
  ["HU", "Hungary", "HU"],
  ["IE", "Ireland", "IE"],
  ["IT", "Italy", "IT"],
  ["LV", "Latvia", "LV"],
  ["LT", "Lithuania", "LT"],
  ["LU", "Luxembourg", "LU"],
  ["MT", "Malta", "MT"],
  ["NL", "Netherlands", "NL"],
  ["PL", "Poland", "PL"],
  ["PT", "Portugal", "PT"],
  ["RO", "Romania", "RO"],
  ["SK", "Slovakia", "SK"],
  ["SI", "Slovenia", "SI"],
  ["ES", "Spain", "ES"],
  ["SE", "Sweden", "SE"]
] as const;

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
  fallback = "The ViDA simulation request failed."
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
    sellerType:
      record.sellerType === "public_authority" || record.sellerType === "unknown"
        ? record.sellerType
        : "business",
    transactionType: normalizeTransactionType(record.transactionType),
    supplyScenario:
      record.supplyScenario === "domestic" ||
      record.supplyScenario === "intra_eu" ||
      record.supplyScenario === "non_eu" ||
      record.supplyScenario === "unknown"
        ? record.supplyScenario
        : "unknown",
    invoiceDate: readNullableStringField(record, "invoiceDate"),
    issueDate: readNullableStringField(record, "issueDate"),
    currency: readNullableStringField(record, "currency"),
    amount: readNullableStringField(record, "amount"),
    invoiceProfile:
      record.invoiceProfile === "EN16931" ||
      record.invoiceProfile === "PEPPOL_BIS_3" ||
      record.invoiceProfile === "COUNTRY_PACK"
        ? record.invoiceProfile
        : null,
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
    countryPackVersion: readStringField(value, "countryPackVersion"),
    countryPackStatus: readStringField(value, "countryPackStatus"),
    evidenceStatus: readStringField(value, "evidenceStatus")
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

function formatUnknownValue(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "Not provided";
  }

  return JSON.stringify(value);
}

function buildRequestBody(form: VidaSimulationForm) {
  const body: Record<string, unknown> = {
    sellerCountry: form.sellerCountry.trim(),
    buyerCountry: form.buyerCountry.trim(),
    buyerType: form.buyerType,
    sellerType: form.sellerType,
    transactionType: form.transactionType,
    supplyScenario: form.supplyScenario,
    invoiceProfile: form.invoiceProfile,
    structuredInvoiceSignals: {
      hasCanonicalInvoice: form.hasCanonicalInvoice,
      hasUblXml: form.hasUblXml,
      hasCiiXml: false,
      xsdStatus: form.xsdStatus,
      schematronPeppolStatus: form.schematronPeppolStatus,
      schematronEn16931Status: form.schematronEn16931Status
    },
    vatEvidence: {
      sellerViesStatus: form.sellerViesStatus,
      buyerViesStatus: form.buyerViesStatus,
      sourceLabel: "workspace selected cached evidence state"
    },
    persist: true
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

  if (form.issueDate.trim()) {
    body.issueDate = form.issueDate.trim();
  }

  if (form.currency.trim()) {
    body.currency = form.currency.trim();
  }

  if (form.amount.trim()) {
    body.amount = form.amount.trim();
  }

  return body;
}

export default function WorkspaceVidaSimulatorPage() {
  const [form, setForm] = useState<VidaSimulationForm>(defaultVidaForm);
  const [simulationResult, setSimulationResult] =
    useState<VidaSimulationResult | null>(null);
  const [simulationHistory, setSimulationHistory] = useState<
    VidaSimulationRunSummary[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [simulationMessage, setSimulationMessage] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");

  const simulationRunId = simulationResult?.simulationRunId ?? "";
  const selectedSellerCountry = euCountryOptions.find(
    ([countryCode]) => countryCode === form.sellerCountry
  );
  const selectedBuyerCountry = euCountryOptions.find(
    ([countryCode]) => countryCode === form.buyerCountry
  );

  const findingCounts = useMemo(() => {
    const counts = {
      info: 0,
      warning: 0,
      reviewRequired: 0,
      blocked: 0
    };

    for (const finding of simulationResult?.findings ?? []) {
      if (finding.severity === "blocked") {
        counts.blocked += 1;
      } else if (finding.severity === "review_required") {
        counts.reviewRequired += 1;
      } else if (finding.severity === "warning") {
        counts.warning += 1;
      } else {
        counts.info += 1;
      }
    }

    return counts;
  }, [simulationResult]);

  const loadSimulationHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryMessage("");

    try {
      const response = await fetch(
        "/api/local/transactions/vida-simulations?limit=25",
        {
          method: "GET",
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setSimulationHistory([]);
        setHistoryMessage(
          getApiErrorMessage(
            responseData,
            "Could not load saved ViDA simulation history."
          )
        );
        return;
      }

      const records =
        isPlainObject(responseData) && Array.isArray(responseData.records)
          ? responseData.records
          : [];

      setSimulationHistory(
        records
          .map((record) => normalizeVidaSimulationRunSummary(record))
          .filter(
            (record): record is VidaSimulationRunSummary => record !== null
          )
      );
    } catch {
      setSimulationHistory([]);
      setHistoryMessage(
        "ViDA simulation history is unavailable. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSimulationHistory();
  }, [loadSimulationHistory]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setSimulationMessage("");

    try {
      const response = await fetch("/api/local/transactions/simulate-vida", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(buildRequestBody(form)),
        cache: "no-store"
      });
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setSimulationResult(null);
        setSimulationMessage(
          getApiErrorMessage(
            responseData,
            "Could not run the ViDA-readiness simulation."
          )
        );
        return;
      }

      const normalizedResult = normalizeVidaResult(responseData);

      if (!normalizedResult) {
        setSimulationResult(null);
        setSimulationMessage(
          "The ViDA simulator returned an unreadable response shape."
        );
        return;
      }

      setSimulationResult(normalizedResult);

      if (normalizedResult.persisted && normalizedResult.simulationRunId) {
        setSimulationMessage("Simulation saved to workspace history.");
        void loadSimulationHistory();
      } else {
        setSimulationMessage(
          "Simulation completed, but no workspace history record was saved."
        );
      }
    } catch {
      setSimulationResult(null);
      setSimulationMessage(
        "The local ViDA simulator API is unavailable. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">ViDA simulator</p>
        <h2>Simulate EU cross-border readiness context.</h2>
        <p>
          This workspace tool runs Invoice Lantern&apos;s educational
          ViDA-readiness simulation and saves workspace-owned audit records for
          later review. It checks whether a transaction appears relevant for
          readiness planning. It is not official software, not authority
          submission, not legal, tax, or accounting advice, and not a compliance
          guarantee.
        </p>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Simulation</p>
          <strong>{simulationResult?.simulationVersion ?? "Ready"}</strong>
          <span>Versioned sandbox result from the local API.</span>
        </div>

        <div className="workspace-stat">
          <p>Readiness</p>
          <strong>
            {simulationResult
              ? formatStatus(simulationResult.readinessStatus)
              : "Pending"}
          </strong>
          <span>
            Score{" "}
            {simulationResult?.readinessScore === null ||
            simulationResult?.readinessScore === undefined
              ? "not available"
              : simulationResult.readinessScore}
            ; not a legal conclusion.
          </span>
        </div>

        <div className="workspace-stat">
          <p>Findings</p>
          <strong>{simulationResult?.findings.length ?? 0}</strong>
          <span>
            {findingCounts.reviewRequired} review · {findingCounts.warning}{" "}
            warning · {findingCounts.info} info
          </span>
        </div>

        <div className="workspace-stat">
          <p>Saved runs</p>
          <strong>
            {isHistoryLoading ? "Loading" : simulationHistory.length}
          </strong>
          <span>Workspace-owned simulation audit records.</span>
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />

          <div>
            <p>Safe use</p>
            <h3>Do not treat ViDA simulation as a filing decision.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              The simulator classifies readiness context from seller country,
              buyer country, buyer type, transaction type, and VAT-ID context.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              Real-world VAT, e-invoicing, reporting, and filing decisions still
              require reviewed country rules and qualified professional advice
              where appropriate.
            </p>
          </div>
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Simulation input</p>
            <h3>Transaction context</h3>
          </div>

          <div className="confidence-label">
            <Globe2 size={17} />
            EU context
          </div>
        </div>

        {simulationMessage ? (
          <div className="alert-item">
            <span />
            <p>{simulationMessage}</p>
          </div>
        ) : null}

        <div className="alert-item">
          <span />
          <p>
            Country packs cover EU core plus all 27 EU Member States. Selected
            seller: {selectedSellerCountry?.[0] ?? form.sellerCountry}{" "}
            {selectedSellerCountry?.[1] ?? ""}; selected buyer:{" "}
            {selectedBuyerCountry?.[0] ?? form.buyerCountry}{" "}
            {selectedBuyerCountry?.[1] ?? ""}. Greece is shown as GR; Greek VAT
            IDs may use the EL prefix for format evidence.
          </p>
        </div>

        <form className="workspace-form-grid" onSubmit={handleSubmit}>
          <label>
            Seller country
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  sellerCountry: event.target.value
                }));
              }}
              required
              value={form.sellerCountry}
            >
              {euCountryOptions.map(([countryCode, countryName, vatPrefix]) => (
                <option key={countryCode} value={countryCode}>
                  {countryCode} {countryName}
                  {countryCode === "GR" ? ` (VAT prefix ${vatPrefix})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Buyer country
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  buyerCountry: event.target.value
                }));
              }}
              required
              value={form.buyerCountry}
            >
              {euCountryOptions.map(([countryCode, countryName, vatPrefix]) => (
                <option key={countryCode} value={countryCode}>
                  {countryCode} {countryName}
                  {countryCode === "GR" ? ` (VAT prefix ${vatPrefix})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Seller VAT ID
            <input
              maxLength={64}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  sellerVatId: event.target.value
                }));
              }}
              value={form.sellerVatId}
            />
          </label>

          <label>
            Buyer VAT ID
            <input
              maxLength={64}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  buyerVatId: event.target.value
                }));
              }}
              value={form.buyerVatId}
            />
          </label>

          <label>
            Buyer type
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  buyerType: event.target.value as VidaBuyerType
                }));
              }}
              value={form.buyerType}
            >
              <option value="business">Business</option>
              <option value="consumer">Consumer</option>
              <option value="public_authority">Public authority</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <label>
            Seller type
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  sellerType: event.target.value as VidaSellerType
                }));
              }}
              value={form.sellerType}
            >
              <option value="business">Business</option>
              <option value="public_authority">Public authority</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <label>
            Transaction type
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  transactionType: event.target.value as VidaTransactionType
                }));
              }}
              value={form.transactionType}
            >
              <option value="services">Services</option>
              <option value="goods">Goods</option>
              <option value="digital_service">Digital service</option>
              <option value="mixed">Mixed</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <label>
            Supply scenario
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  supplyScenario: event.target.value as VidaSupplyScenario
                }));
              }}
              value={form.supplyScenario}
            >
              <option value="intra_eu">Intra-EU</option>
              <option value="domestic">Domestic</option>
              <option value="non_eu">Non-EU</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <label>
            Invoice date
            <input
              maxLength={32}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  invoiceDate: event.target.value
                }));
              }}
              placeholder="2026-05-01"
              value={form.invoiceDate}
            />
          </label>

          <label>
            Issue date
            <input
              maxLength={32}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  issueDate: event.target.value
                }));
              }}
              placeholder="2030-07-01"
              value={form.issueDate}
            />
          </label>

          <label>
            Currency
            <input
              maxLength={8}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  currency: event.target.value
                }));
              }}
              value={form.currency}
            />
          </label>

          <label>
            Amount
            <input
              maxLength={40}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  amount: event.target.value
                }));
              }}
              value={form.amount}
            />
          </label>

          <label>
            Invoice profile
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  invoiceProfile: event.target.value as VidaInvoiceProfile
                }));
              }}
              value={form.invoiceProfile}
            >
              <option value="EN16931">EN 16931</option>
              <option value="PEPPOL_BIS_3">Peppol BIS 3 style</option>
              <option value="COUNTRY_PACK">Country-pack context</option>
            </select>
          </label>

          <label>
            Canonical invoice evidence
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  hasCanonicalInvoice: event.target.value === "yes"
                }));
              }}
              value={form.hasCanonicalInvoice ? "yes" : "no"}
            >
              <option value="no">Not attached</option>
              <option value="yes">Attached</option>
            </select>
          </label>

          <label>
            UBL XML evidence
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  hasUblXml: event.target.value === "yes"
                }));
              }}
              value={form.hasUblXml ? "yes" : "no"}
            >
              <option value="no">Not attached</option>
              <option value="yes">Attached</option>
            </select>
          </label>

          <label>
            XSD status
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  xsdStatus: event.target.value
                }));
              }}
              value={form.xsdStatus}
            >
              <option value="not_checked">Not checked</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="not_configured">Not configured</option>
            </select>
          </label>

          <label>
            Peppol Schematron
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  schematronPeppolStatus: event.target.value
                }));
              }}
              value={form.schematronPeppolStatus}
            >
              <option value="not_checked">Not checked</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="not_configured">Not configured</option>
            </select>
          </label>

          <label>
            EN 16931 Schematron
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  schematronEn16931Status: event.target.value
                }));
              }}
              value={form.schematronEn16931Status}
            >
              <option value="not_checked">Not checked</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="not_configured">Not configured</option>
            </select>
          </label>

          <label>
            Seller VIES evidence
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  sellerViesStatus: event.target.value
                }));
              }}
              value={form.sellerViesStatus}
            >
              <option value="not_checked">Not checked</option>
              <option value="valid">Valid evidence</option>
              <option value="invalid">Invalid evidence</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>

          <label>
            Buyer VIES evidence
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  buyerViesStatus: event.target.value
                }));
              }}
              value={form.buyerViesStatus}
            >
              <option value="not_checked">Not checked</option>
              <option value="valid">Valid evidence</option>
              <option value="invalid">Invalid evidence</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>

          <button
            className="workspace-auth-action"
            disabled={isSubmitting}
            type="submit"
          >
            <Play size={16} />
            {isSubmitting ? "Running simulation" : "Run and save simulation"}
          </button>
        </form>
      </section>

      <section className="findings-console">
        <div className="findings-console-head">
          <div>
            <p>Simulation result</p>
            <h3>
              {simulationResult
                ? formatStatus(simulationResult.transactionClass)
                : "No simulation run yet"}
            </h3>
          </div>

          <div className="confidence-label">
            <Layers3 size={17} />
            {simulationResult
              ? formatLegalConfidence(simulationResult.legalConfidence)
              : "not loaded"}
          </div>
        </div>

        <div className="finding-console-list">
          {simulationResult ? (
            <>
              {simulationRunId ? (
                <div className="finding-console-row">
                  <Clock3 size={18} />

                  <div>
                    <strong>VIDA_SIMULATION_RUN_SAVED</strong>
                    <p>
                      This result is linked to workspace simulation run{" "}
                      {simulationRunId}.
                    </p>
                    <p>
                      This is an internal workspace evidence record, not filing
                      evidence or official authority confirmation.
                    </p>
                    <Link
                      href={`/workspace/vida-simulator/${encodeURIComponent(
                        simulationRunId
                      )}`}
                      className="text-link-button"
                    >
                      <Eye size={16} />
                      Open saved run detail
                    </Link>
                  </div>

                  <span>saved</span>
                </div>
              ) : null}

              <div className="finding-console-row">
                <BadgeCheck size={18} />

                <div>
                  <strong>VIDA_RELEVANCE_SIGNAL</strong>
                  <p>{simulationResult.reason}</p>
                  <p>
                    Relevance: {formatStatus(simulationResult.vidaRelevance)}.
                    Seller EU:{" "}
                    {simulationResult.countryContext.sellerInEu ? "yes" : "no"}.
                    Buyer EU:{" "}
                    {simulationResult.countryContext.buyerInEu ? "yes" : "no"}.
                    Cross-border EU:{" "}
                    {simulationResult.countryContext.crossBorderEu
                      ? "yes"
                      : "no"}
                    .
                  </p>
                </div>

                <span>{simulationResult.vidaRelevance}</span>
              </div>

              <div className="finding-console-row">
                <Layers3 size={18} />

                <div>
                  <strong>VIDA_READINESS_STATUS</strong>
                  <p>
                    Status: {formatStatus(simulationResult.readinessStatus)}.
                    Score:{" "}
                    {simulationResult.readinessScore === null
                      ? "not available"
                      : simulationResult.readinessScore}
                    .
                  </p>
                  <p>
                    Seller pack:{" "}
                    {simulationResult.countryContext.sellerCountryPackStatus}{" "}
                    {simulationResult.countryContext.sellerCountryPackVersion ??
                      "unversioned"}
                    . Buyer pack:{" "}
                    {simulationResult.countryContext.buyerCountryPackStatus}{" "}
                    {simulationResult.countryContext.buyerCountryPackVersion ??
                      "unversioned"}
                    .
                  </p>
                </div>

                <span>{simulationResult.readinessStatus}</span>
              </div>

              <div className="finding-console-row">
                <FileText size={18} />

                <div>
                  <strong>VIDA_EVIDENCE_SUMMARY</strong>
                  <p>
                    VAT format:{" "}
                    {formatUnknownValue(
                      simulationResult.evidenceSummary.vatFormatEvidence
                        .sellerStatus
                    )}{" "}
                    seller /{" "}
                    {formatUnknownValue(
                      simulationResult.evidenceSummary.vatFormatEvidence
                        .buyerStatus
                    )}{" "}
                    buyer. VIES:{" "}
                    {formatUnknownValue(
                      simulationResult.evidenceSummary.viesEvidence
                        .sellerStatus
                    )}{" "}
                    seller /{" "}
                    {formatUnknownValue(
                      simulationResult.evidenceSummary.viesEvidence.buyerStatus
                    )}{" "}
                    buyer.
                  </p>
                  <p>
                    XSD:{" "}
                    {formatUnknownValue(
                      simulationResult.evidenceSummary.xmlValidationEvidence
                        .xsdStatus
                    )}
                    . Peppol Schematron:{" "}
                    {formatUnknownValue(
                      simulationResult.evidenceSummary.schematronEvidence
                        .peppolStatus
                    )}
                    . EN 16931 Schematron:{" "}
                    {formatUnknownValue(
                      simulationResult.evidenceSummary.schematronEvidence
                        .en16931Status
                    )}
                    .
                  </p>
                </div>

                <span>evidence</span>
              </div>

              {simulationResult.timeline.map((item) => (
                <div
                  className="finding-console-row"
                  key={`${item.date}-${item.relevance}`}
                >
                  <Clock3 size={18} />

                  <div>
                    <strong>{item.date}</strong>
                    <p>{item.label}</p>
                    <p>
                      Sources:{" "}
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
                  <strong>VIDA_NORMALIZED_INPUT</strong>
                  <p>
                    Seller:{" "}
                    {formatNullable(
                      simulationResult.normalizedInput.sellerCountryCode,
                      "Unknown"
                    )}{" "}
                    · Buyer:{" "}
                    {formatNullable(
                      simulationResult.normalizedInput.buyerCountryCode,
                      "Unknown"
                    )}{" "}
                    · Buyer type:{" "}
                    {formatStatus(simulationResult.normalizedInput.buyerType)} ·
                    Transaction:{" "}
                    {formatStatus(
                      simulationResult.normalizedInput.transactionType
                    )}
                  </p>
                  <p>
                    Invoice date:{" "}
                    {formatNullable(
                      simulationResult.normalizedInput.invoiceDate
                    )}
                    . Currency:{" "}
                    {formatNullable(simulationResult.normalizedInput.currency)}
                    . Amount:{" "}
                    {formatNullable(simulationResult.normalizedInput.amount)}.
                  </p>
                </div>

                <span>normalized</span>
              </div>

              <div className="finding-console-row">
                <BookOpenCheck size={18} />

                <div>
                  <strong>VIDA_EFFECTIVE_DATE_CONTEXT</strong>
                  <p>{simulationResult.effectiveDateContext}</p>
                  <p>{simulationResult.disclaimer}</p>
                </div>

                <span>context</span>
              </div>

              {simulationResult.findings.map((finding, index) => (
                <div
                  className="finding-console-row"
                  key={`${finding.code}-${index}`}
                >
                  <AlertTriangle size={18} />

                  <div>
                    <strong>{finding.code}</strong>
                    <p>{finding.message}</p>
                    <p>
                      Legal confidence:{" "}
                      {formatLegalConfidence(finding.legalConfidence)}.
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
              ))}

              {simulationResult.sourceReferences.map((sourceReference) => (
                <div
                  className="finding-console-row"
                  key={sourceReference.id}
                >
                  <BookOpenCheck size={18} />

                  <div>
                    <strong>{sourceReference.label}</strong>
                    <p>{sourceReference.title ?? sourceReference.id}</p>
                    {sourceReference.url ? (
                      <p>{sourceReference.url}</p>
                    ) : null}
                  </div>

                  <span>source</span>
                </div>
              ))}

              {simulationResult.recommendedNextActions.map((action, index) => (
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
            </>
          ) : (
            <div className="finding-console-row">
              <AlertTriangle size={18} />

              <div>
                <strong>VIDA_SIMULATION_NOT_RUN</strong>
                <p>
                  Submit transaction context to generate and save an educational
                  ViDA-readiness simulation result.
                </p>
              </div>

              <span>pending</span>
            </div>
          )}
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>History</p>
            <h3>Saved ViDA simulation runs</h3>
          </div>

          <button
            type="button"
            disabled={isHistoryLoading}
            onClick={() => void loadSimulationHistory()}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {historyMessage ? (
          <div className="alert-item">
            <span />
            <p>{historyMessage}</p>
          </div>
        ) : null}

        <div className="workspace-line-grid">
          {isHistoryLoading ? (
            <div className="workspace-line-row">
              <strong>Loading saved simulations</strong>
              <span>Reading workspace-owned ViDA simulation records.</span>
            </div>
          ) : simulationHistory.length === 0 ? (
            <div className="workspace-line-row">
              <strong>No saved simulations yet</strong>
              <span>
                Run and save a simulation to create a workspace audit record.
              </span>
            </div>
          ) : (
            simulationHistory.map((run) => (
              <div className="workspace-line-row" key={run.id}>
                <strong>
                  {formatStatus(run.transactionClass)} ·{" "}
                  {formatStatus(run.vidaRelevance)}
                </strong>

                <span>
                  {run.sellerCountryCode ?? "??"} →{" "}
                  {run.buyerCountryCode ?? "??"} ·{" "}
                  {formatStatus(run.buyerType)} ·{" "}
                  {formatStatus(run.transactionType)}
                </span>

                <span>
                  {run.findingCount} findings · {run.reviewRequiredCount}{" "}
                  review · {run.warningCount} warning · {run.infoCount} info
                </span>

                <span>{formatDateTime(run.createdAt)}</span>

                <Link
                  href={`/workspace/vida-simulator/${encodeURIComponent(
                    run.id
                  )}`}
                  className="text-link-button"
                >
                  <Eye size={16} />
                  Open
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
