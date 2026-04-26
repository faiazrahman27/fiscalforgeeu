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

type ValidationRunListResponse = {
  records?: ValidationRunSummary[];
};

type ValidationRunDetailResponse = {
  record?: SavedValidationRun;
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

function getValidationIcon(iconKey: WorkspaceIconKey) {
  const icons: Record<string, ReactNode> = {
    schema: <Layers3 size={22} />,
    calculation: <Calculator size={22} />,
    ubl: <FileCheck2 size={22} />,
    legal: <ShieldAlert size={22} />
  };

  return icons[iconKey] ?? <FileCheck2 size={22} />;
}

function buildFallbackSummary(run: SavedValidationRun): ValidationRunSummary {
  return {
    id: run.id,
    invoiceNumber: run.invoiceNumber,
    buyer: run.buyer,
    seller: run.seller,
    createdAt: run.createdAt,
    technicalStatus: run.technicalStatus,
    standardStatus: run.standardStatus,
    countrySimulationStatus: run.countrySimulationStatus,
    vidaReadinessStatus: run.vidaReadinessStatus,
    confidence: run.confidence,
    profile: run.profile,
    currency: run.currency,
    findingsCount: run.findings.length,
    payableAmount: run.totals.payableAmount
  };
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

function normalizeValidationRunSummary(
  value: unknown
): ValidationRunSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    return null;
  }

  return {
    id: record.id,
    invoiceNumber:
      typeof record.invoiceNumber === "string" ? record.invoiceNumber : "Untitled invoice",
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
    findingsCount:
      typeof record.findingsCount === "number" && Number.isFinite(record.findingsCount)
        ? record.findingsCount
        : 0,
    payableAmount:
      typeof record.payableAmount === "number" && Number.isFinite(record.payableAmount)
        ? record.payableAmount
        : 0
  };
}

export default function WorkspaceValidationRunsPage() {
  const [validationRuns, setValidationRuns] = useState<ValidationRunSummary[]>(
    fallbackRuns.map(buildFallbackSummary)
  );
  const [latestRunDetail, setLatestRunDetail] =
    useState<SavedValidationRun | null>(fallbackRuns[0]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [runLoadMessage, setRunLoadMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadValidationRuns() {
      setIsLoadingRuns(true);
      setRunLoadMessage("");

      try {
        const response = await fetch("/api/local/validation-runs", {
          method: "GET",
          cache: "no-store"
        });

        const responseData: unknown = await response.json();

        if (!response.ok) {
          setRunLoadMessage(
            "Could not load API-owned validation runs. Showing demo reports instead."
          );
          return;
        }

        const apiData = responseData as ValidationRunListResponse;
        const records = Array.isArray(apiData.records) ? apiData.records : [];

        const normalizedRuns = records
          .map((item) => normalizeValidationRunSummary(item))
          .filter((item): item is ValidationRunSummary => item !== null);

        if (!isMounted) {
          return;
        }

        if (normalizedRuns.length === 0) {
          setValidationRuns(fallbackRuns.map(buildFallbackSummary));
          setLatestRunDetail(fallbackRuns[0]);
          return;
        }

        setValidationRuns(normalizedRuns);

        const latestRunId = normalizedRuns[0].id;
        const detailResponse = await fetch(
          `/api/local/validation-runs/${encodeURIComponent(latestRunId)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        const detailData: unknown = await detailResponse.json();

        if (!detailResponse.ok) {
          setLatestRunDetail(null);
          return;
        }

        const detailPayload = detailData as ValidationRunDetailResponse;

        if (isMounted) {
          setLatestRunDetail(detailPayload.record ?? null);
        }
      } catch {
        if (isMounted) {
          setRunLoadMessage(
            "The local validation run API is unavailable. Make sure apps/api and apps/web are both running."
          );
          setValidationRuns(fallbackRuns.map(buildFallbackSummary));
          setLatestRunDetail(fallbackRuns[0]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingRuns(false);
        }
      }
    }

    loadValidationRuns();

    return () => {
      isMounted = false;
    };
  }, []);

  const latestRun = useMemo(() => {
    return validationRuns[0] ?? buildFallbackSummary(fallbackRuns[0]);
  }, [validationRuns]);

  const latestFindings = latestRunDetail?.findings ?? [];

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Validation Runs</p>
        <h2>Every validation result must be explainable.</h2>
        <p>
          This screen reads validation run history through the local Next.js proxy from
          the dedicated Invoice Lantern API service. Demo reports remain as fallback
          records during local development.
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
                <strong>Loading validation runs</strong>
                <span>Reading records from the local API proxy.</span>
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
          ) : (
            validationRuns.map((run) => (
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
                  <span>{formatDateTime(run.createdAt)}</span>
                </div>

                <strong>{formatStatus(run.standardStatus)}</strong>

                <ArrowRight size={17} />
              </Link>
            ))
          )}
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
