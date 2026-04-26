"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Calculator,
  FileCheck2,
  Layers3,
  ShieldAlert
} from "lucide-react";
import { validationRunLayers } from "../../../lib/mock-data";
import type { WorkspaceIconKey } from "../../../lib/types";

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

function getValidationIcon(iconKey: WorkspaceIconKey) {
  const icons: Record<string, ReactNode> = {
    schema: <Layers3 size={22} />,
    calculation: <Calculator size={22} />,
    ubl: <FileCheck2 size={22} />,
    legal: <ShieldAlert size={22} />
  };

  return icons[iconKey] ?? <FileCheck2 size={22} />;
}

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

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function getLatestRun(runs: SavedValidationRun[]) {
  return runs[0] ?? fallbackRuns[0];
}

export default function WorkspaceValidationRunsPage() {
  const [validationRuns, setValidationRuns] =
    useState<SavedValidationRun[]>(fallbackRuns);

  useEffect(() => {
    setValidationRuns(readStoredValidationRuns());
  }, []);

  const latestRun = useMemo(() => {
    return getLatestRun(validationRuns);
  }, [validationRuns]);

  const latestFindings = latestRun.findings;

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Validation Runs</p>
        <h2>Every validation result must be explainable.</h2>
        <p>
          This screen reads saved validation runs from local browser storage when
          available. New API validation reports from the invoice editor appear here
          before the history moves into the database.
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
            <p>Recent validation runs</p>
            <h3>Validation report queue</h3>
          </div>

          <div className="confidence-label">
            <BadgeCheck size={17} />
            local history enabled
          </div>
        </div>

        <div className="workspace-table">
          {validationRuns.map((run) => (
            <Link
              href={`/workspace/validation-runs/${run.id}`}
              className="workspace-table-row invoice-click-row"
              key={run.id}
            >
              <div>
                <strong>{run.id}</strong>
                <span>
                  {run.invoiceNumber} - {run.buyer}
                </span>
              </div>

              <div>
                <span className="status-pill">
                  {formatStatus(run.technicalStatus)}
                </span>
              </div>

              <div>
                <span>{run.createdAt}</span>
              </div>

              <strong>{formatStatus(run.standardStatus)}</strong>

              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section className="findings-console">
        <div className="findings-console-head">
          <div>
            <p>Latest run preview</p>
            <h3>{latestRun.id}</h3>
          </div>

          <Link
            href={`/workspace/validation-runs/${latestRun.id}`}
            className="confidence-label"
          >
            <BadgeCheck size={17} />
            open full report
          </Link>
        </div>

        <div className="finding-console-list">
          {latestFindings.length === 0 ? (
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
