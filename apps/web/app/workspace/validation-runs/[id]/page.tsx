"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calculator,
  Database,
  FileCheck2,
  FileText,
  Globe2,
  Layers3,
  ShieldAlert
} from "lucide-react";

type FindingSeverity = "info" | "warning" | "fatal";

type ValidationFinding = {
  code: string;
  severity: FindingSeverity;
  field?: string;
  message: string;
  legalConfidence?: "technical" | "educational_simulation" | "review_required";
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

type ValidationRunDetailResponse = {
  record?: SavedValidationRun;
};

type EvidenceItem = {
  label: string;
  value: string;
};

const fallbackRuns: SavedValidationRun[] = [
  {
    id: "val_01HXABC",
    invoiceNumber: "IL-2026-001",
    buyer: "Muster GmbH",
    seller: "Invoice Lantern Demo Kft.",
    createdAt: "2026-04-24T14:32:00.000Z",
    technicalStatus: "failed",
    standardStatus: "warning",
    countrySimulationStatus: "review_required",
    vidaReadinessStatus: "relevant_simulation",
    confidence: "educational_simulation",
    profile: "PEPPOL_BIS_3",
    currency: "EUR",
    totals: {
      lineExtensionAmount: 1250,
      taxExclusiveAmount: 1250,
      taxAmount: 337.5,
      taxInclusiveAmount: 1587.5,
      payableAmount: 1587.5
    },
    findings: [
      {
        code: "BUYER_VAT_ID_REQUIRED",
        severity: "fatal",
        field: "buyer.vatId",
        message: "Buyer VAT ID is required for this cross-border B2B simulation.",
        legalConfidence: "educational_simulation"
      },
      {
        code: "CROSS_BORDER_REVIEW_REQUIRED",
        severity: "warning",
        field: "buyer.country",
        message:
          "Seller and buyer countries differ. Country and VAT treatment require professional review.",
        legalConfidence: "review_required"
      }
    ],
    disclaimer:
      "This validation report is a development sandbox result. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
  },
  {
    id: "val_01HXABD",
    invoiceNumber: "IL-2026-002",
    buyer: "Danube Consulting Kft.",
    seller: "Invoice Lantern Demo Kft.",
    createdAt: "2026-04-23T18:10:00.000Z",
    technicalStatus: "passed",
    standardStatus: "ready",
    countrySimulationStatus: "not_relevant",
    vidaReadinessStatus: "not_relevant",
    confidence: "technical_preview",
    profile: "EN16931",
    currency: "EUR",
    totals: {
      lineExtensionAmount: 800,
      taxExclusiveAmount: 800,
      taxAmount: 216,
      taxInclusiveAmount: 1016,
      payableAmount: 1016
    },
    findings: [],
    disclaimer:
      "This validation report is a technical preview. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
  },
  {
    id: "val_01HXABE",
    invoiceNumber: "IL-2026-003",
    buyer: "Nordic Trade AB",
    seller: "Invoice Lantern Demo Kft.",
    createdAt: "2026-04-22T09:45:00.000Z",
    technicalStatus: "passed",
    standardStatus: "warning",
    countrySimulationStatus: "review_required",
    vidaReadinessStatus: "relevant_simulation",
    confidence: "educational_simulation",
    profile: "PEPPOL_BIS_3",
    currency: "EUR",
    totals: {
      lineExtensionAmount: 2400,
      taxExclusiveAmount: 2400,
      taxAmount: 0,
      taxInclusiveAmount: 2400,
      payableAmount: 2400
    },
    findings: [
      {
        code: "CROSS_BORDER_REVIEW_REQUIRED",
        severity: "warning",
        field: "buyer.country",
        message:
          "Seller and buyer countries differ. Country and VAT treatment require professional review.",
        legalConfidence: "review_required"
      }
    ],
    disclaimer:
      "This validation report is an educational simulation. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
  }
];

function getFallbackRunById(id: string) {
  return fallbackRuns.find((run) => run.id === id) ?? fallbackRuns[0];
}

function getStatusTone(status: string) {
  if (
    status === "passed" ||
    status === "ready" ||
    status === "not_relevant" ||
    status === "technical_preview" ||
    status === "technical"
  ) {
    return "good";
  }

  return "warn";
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

function formatTotalAmount(currency: string, value: number | string) {
  const safeCurrency = currency || "EUR";

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${safeCurrency} ${value.toFixed(2)}`;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return `${safeCurrency} ${value.trim().replace(/^EUR\s*/i, "")}`;
  }

  return `${safeCurrency} 0.00`;
}

function buildEvidence(run: SavedValidationRun): EvidenceItem[] {
  return [
    {
      label: "Schema layer",
      value:
        run.technicalStatus === "passed"
          ? "The API accepted the request payload and produced a validation result."
          : "The API produced blocking technical findings for this validation run."
    },
    {
      label: "Calculation layer",
      value:
        "Totals were recalculated by the API from invoice lines, unit prices, quantities, and VAT rates."
    },
    {
      label: "Country simulation",
      value:
        run.countrySimulationStatus === "review_required"
          ? "Cross-border buyer/seller context requires professional review."
          : "No cross-border country simulation was applied for this run."
    },
    {
      label: "Rule source placeholder",
      value:
        "Future production reports will attach source links, reviewed date, rule version, and audit log ID."
    }
  ];
}

function normalizeFinding(value: unknown): ValidationFinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.code !== "string" || record.code.trim().length === 0) {
    return null;
  }

  const severity =
    record.severity === "info" ||
    record.severity === "warning" ||
    record.severity === "fatal"
      ? record.severity
      : "info";

  return {
    code: record.code,
    severity,
    field: typeof record.field === "string" ? record.field : undefined,
    message:
      typeof record.message === "string"
        ? record.message
        : "Validation finding returned without a message.",
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
    lineExtensionAmount: normalizeAmount(record.lineExtensionAmount),
    taxExclusiveAmount: normalizeAmount(record.taxExclusiveAmount),
    taxAmount: normalizeAmount(record.taxAmount),
    taxInclusiveAmount: normalizeAmount(record.taxInclusiveAmount),
    payableAmount: normalizeAmount(record.payableAmount)
  };
}

function normalizeAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return 0;
}

function normalizeValidationRun(value: unknown): SavedValidationRun | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    return null;
  }

  const findings = Array.isArray(record.findings)
    ? record.findings
        .map((finding) => normalizeFinding(finding))
        .filter((finding): finding is ValidationFinding => finding !== null)
    : [];

  return {
    id: record.id,
    invoiceNumber:
      typeof record.invoiceNumber === "string"
        ? record.invoiceNumber
        : "Untitled invoice",
    buyer: typeof record.buyer === "string" ? record.buyer : "Unknown buyer",
    seller: typeof record.seller === "string" ? record.seller : "Unknown seller",
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    technicalStatus:
      typeof record.technicalStatus === "string"
        ? record.technicalStatus
        : "failed",
    standardStatus:
      typeof record.standardStatus === "string" ? record.standardStatus : "warning",
    countrySimulationStatus:
      typeof record.countrySimulationStatus === "string"
        ? record.countrySimulationStatus
        : "not_relevant",
    vidaReadinessStatus:
      typeof record.vidaReadinessStatus === "string"
        ? record.vidaReadinessStatus
        : "not_relevant",
    confidence:
      typeof record.confidence === "string" ? record.confidence : "technical_preview",
    profile: typeof record.profile === "string" ? record.profile : "API_VALIDATION",
    currency: typeof record.currency === "string" ? record.currency : "EUR",
    totals: normalizeTotals(record.totals),
    findings,
    disclaimer:
      typeof record.disclaimer === "string"
        ? record.disclaimer
        : "This validation report is a development sandbox result. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
  };
}

export default function ValidationRunDetailPage() {
  const params = useParams<{ id: string }>();
  const fallbackRun = useMemo(() => getFallbackRunById(params.id), [params.id]);

  const [run, setRun] = useState<SavedValidationRun>(fallbackRun);
  const [isLoadingRun, setIsLoadingRun] = useState(true);
  const [runLoadMessage, setRunLoadMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadValidationRun() {
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

        const responseData: unknown = await response.json();

        if (!response.ok) {
          if (isMounted) {
            setRun(getFallbackRunById(params.id));
            setRunLoadMessage(
              "Could not load this API-owned validation run. Showing the closest demo report instead."
            );
          }

          return;
        }

        const payload = responseData as ValidationRunDetailResponse;
        const normalizedRun = normalizeValidationRun(payload.record);

        if (isMounted) {
          setRun(normalizedRun ?? getFallbackRunById(params.id));
        }
      } catch {
        if (isMounted) {
          setRun(getFallbackRunById(params.id));
          setRunLoadMessage(
            "The local validation run API is unavailable. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRun(false);
        }
      }
    }

    loadValidationRun();

    return () => {
      isMounted = false;
    };
  }, [params.id]);

  const evidence = useMemo(() => buildEvidence(run), [run]);

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <Link href="/workspace/validation-runs" className="back-link">
          <ArrowLeft size={17} />
          Validation runs
        </Link>

        <p className="workspace-kicker">Validation report</p>
        <h2>{isLoadingRun ? "Loading validation run" : run.id}</h2>
        <p>
          Full validation report preview for invoice {run.invoiceNumber}. This page
          reads the validation run through the local Next.js proxy from the dedicated
          Invoice Lantern API service.
        </p>

        {runLoadMessage ? (
          <div className="alert-item">
            <span />
            <p>{runLoadMessage}</p>
          </div>
        ) : null}
      </section>

      <section className="validation-run-grid">
        <div className="validation-run-layer">
          <div className="validation-layer-icon">
            <Layers3 size={22} />
          </div>
          <span>{getStatusTone(run.technicalStatus)}</span>
          <h3>Technical status</h3>
          <p>{formatStatus(run.technicalStatus)}</p>
        </div>

        <div className="validation-run-layer">
          <div className="validation-layer-icon">
            <FileCheck2 size={22} />
          </div>
          <span>{getStatusTone(run.standardStatus)}</span>
          <h3>Standard status</h3>
          <p>{formatStatus(run.standardStatus)}</p>
        </div>

        <div className="validation-run-layer">
          <div className="validation-layer-icon">
            <Globe2 size={22} />
          </div>
          <span>{getStatusTone(run.countrySimulationStatus)}</span>
          <h3>Country simulation</h3>
          <p>{formatStatus(run.countrySimulationStatus)}</p>
        </div>

        <div className="validation-run-layer">
          <div className="validation-layer-icon">
            <ShieldAlert size={22} />
          </div>
          <span>{getStatusTone(run.vidaReadinessStatus)}</span>
          <h3>ViDA readiness</h3>
          <p>{formatStatus(run.vidaReadinessStatus)}</p>
        </div>
      </section>

      <section className="workspace-map">
        <div>
          <FileText size={24} />
          <h3>Invoice context</h3>
          <p>
            Invoice {run.invoiceNumber} from {run.seller} to {run.buyer}. Profile:{" "}
            {run.profile}. Currency: {run.currency}. Created:{" "}
            {formatDateTime(run.createdAt)}.
          </p>
        </div>

        <div>
          <BadgeCheck size={24} />
          <h3>Confidence label</h3>
          <p>
            {formatStatus(run.confidence)}. This report is a technical preview and must
            not be interpreted as legal, tax, accounting, Peppol, ViDA, or authority
            approval.
          </p>
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Monetary totals</p>
            <h3>Calculated report summary</h3>
          </div>

          <div className="confidence-label">
            <Calculator size={17} />
            API result
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

      <section className="findings-console">
        <div className="findings-console-head">
          <div>
            <p>Findings</p>
            <h3>Rule findings and review messages</h3>
          </div>

          <div className="confidence-label">
            <ShieldAlert size={17} />
            {run.findings.length > 0 ? "review required" : "no findings"}
          </div>
        </div>

        <div className="finding-console-list">
          {run.findings.length === 0 ? (
            <div className="finding-console-row">
              <BadgeCheck size={18} />

              <div>
                <strong>NO_FINDINGS_RETURNED</strong>
                <p>The API did not return any findings for this validation run.</p>
              </div>

              <span>info</span>
            </div>
          ) : (
            run.findings.map((item) => (
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

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Evidence</p>
            <h3>Source and audit placeholders</h3>
          </div>

          <div className="confidence-label">
            <Database size={17} />
            future API-owned data
          </div>
        </div>

        <div className="workspace-table">
          {evidence.map((item) => (
            <div className="workspace-table-row" key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>

              <div>
                <span>source</span>
              </div>

              <div>
                <span className="status-pill">placeholder</span>
              </div>

              <strong>pending</strong>

              <Database size={17} />
            </div>
          ))}
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />

          <div>
            <p>Boundary notice</p>
            <h3>Not official validation.</h3>
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
              A future production report must include rule version, source reference,
              reviewed date, execution timestamp, organization ID, and audit log ID.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              Country and ViDA logic should remain clearly marked as simulation unless
              reviewed and maintained by qualified professionals.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
