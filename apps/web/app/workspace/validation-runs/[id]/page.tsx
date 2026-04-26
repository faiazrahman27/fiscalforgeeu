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
  message: string;
};

type ValidationTotals = {
  lineExtensionAmount: string;
  taxExclusiveAmount: string;
  taxAmount: string;
  taxInclusiveAmount: string;
  payableAmount: string;
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

type EvidenceItem = {
  label: string;
  value: string;
};

const VALIDATION_RUN_STORAGE_KEY = "invoice-lantern.validationRuns.local";

const fallbackRuns: SavedValidationRun[] = [
  {
    id: "val_01HXABC",
    invoiceNumber: "IL-2026-001",
    buyer: "Muster GmbH",
    seller: "Invoice Lantern Demo Kft.",
    createdAt: "2026-04-24 14:32",
    technicalStatus: "failed",
    standardStatus: "warning",
    countrySimulationStatus: "review_required",
    vidaReadinessStatus: "relevant_simulation",
    confidence: "educational_simulation",
    profile: "PEPPOL_BIS_3",
    currency: "EUR",
    totals: {
      lineExtensionAmount: "1250.00",
      taxExclusiveAmount: "1250.00",
      taxAmount: "337.50",
      taxInclusiveAmount: "1587.50",
      payableAmount: "1587.50"
    },
    findings: [
      {
        code: "BUYER_VAT_ID_REQUIRED",
        severity: "fatal",
        message: "Buyer VAT ID is required for this cross-border B2B simulation."
      },
      {
        code: "CROSS_BORDER_REVIEW_REQUIRED",
        severity: "warning",
        message:
          "Seller and buyer countries differ. Country and VAT treatment require professional review."
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
    createdAt: "2026-04-23 18:10",
    technicalStatus: "passed",
    standardStatus: "ready",
    countrySimulationStatus: "not_relevant",
    vidaReadinessStatus: "not_relevant",
    confidence: "technical_preview",
    profile: "EN16931",
    currency: "EUR",
    totals: {
      lineExtensionAmount: "800.00",
      taxExclusiveAmount: "800.00",
      taxAmount: "216.00",
      taxInclusiveAmount: "1016.00",
      payableAmount: "1016.00"
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
    createdAt: "2026-04-22 09:45",
    technicalStatus: "passed",
    standardStatus: "warning",
    countrySimulationStatus: "review_required",
    vidaReadinessStatus: "relevant_simulation",
    confidence: "educational_simulation",
    profile: "PEPPOL_BIS_3",
    currency: "EUR",
    totals: {
      lineExtensionAmount: "2400.00",
      taxExclusiveAmount: "2400.00",
      taxAmount: "0.00",
      taxInclusiveAmount: "2400.00",
      payableAmount: "2400.00"
    },
    findings: [
      {
        code: "CROSS_BORDER_REVIEW_REQUIRED",
        severity: "warning",
        message:
          "Seller and buyer countries differ. Country and VAT treatment require professional review."
      }
    ],
    disclaimer:
      "This validation report is an educational simulation. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
  }
];

function readFirstLocalStorageValue(keys: string[]) {
  for (const key of keys) {
    const value = window.localStorage.getItem(key);

    if (value) {
      return value;
    }
  }

  return null;
}

function readStoredValidationRuns() {
  if (typeof window === "undefined") {
    return fallbackRuns;
  }

  const storedValue = readFirstLocalStorageValue([VALIDATION_RUN_STORAGE_KEY]);

  if (!storedValue) {
    return fallbackRuns;
  }

  try {
    const parsed = JSON.parse(storedValue);

    if (!Array.isArray(parsed)) {
      return fallbackRuns;
    }

    return parsed as SavedValidationRun[];
  } catch {
    return fallbackRuns;
  }
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

function formatTotalAmount(currency: string, value: string) {
  const safeCurrency = currency || "EUR";
  const safeValue = value || "0.00";

  return `${safeCurrency} ${safeValue}`;
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

function findRunById(runs: SavedValidationRun[], id: string) {
  return runs.find((run) => run.id === id) ?? fallbackRuns[0];
}

export default function ValidationRunDetailPage() {
  const params = useParams<{ id: string }>();
  const [runs, setRuns] = useState<SavedValidationRun[]>(fallbackRuns);

  useEffect(() => {
    setRuns(readStoredValidationRuns());
  }, []);

  const run = useMemo(() => {
    return findRunById(runs, params.id);
  }, [runs, params.id]);

  const evidence = useMemo(() => buildEvidence(run), [run]);

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <Link href="/workspace/validation-runs" className="back-link">
          <ArrowLeft size={17} />
          Validation runs
        </Link>

        <p className="workspace-kicker">Validation report</p>
        <h2>{run.id}</h2>
        <p>
          Full validation report preview for invoice {run.invoiceNumber}. This page
          reads saved local validation runs when available, then falls back to seeded
          demo reports.
        </p>
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
            {run.profile}. Currency: {run.currency}. Created: {run.createdAt}.
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
