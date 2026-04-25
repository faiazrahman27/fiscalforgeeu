import Link from "next/link";
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
import { validationFindings } from "../../../../lib/mock-data";

const validationRunDetails = {
  val_01HXABC: {
    id: "val_01HXABC",
    invoiceNumber: "FF-2026-001",
    buyer: "Muster GmbH",
    seller: "FiscalForge Demo Kft.",
    createdAt: "2026-04-24 14:32",
    technicalStatus: "failed",
    standardStatus: "warning",
    countrySimulationStatus: "review_required",
    vidaReadinessStatus: "relevant_simulation",
    confidence: "educational_simulation",
    profile: "PEPPOL_BIS_3",
    currency: "EUR",
    totals: {
      lineExtensionAmount: "1,250.00",
      taxExclusiveAmount: "1,250.00",
      taxAmount: "337.50",
      taxInclusiveAmount: "1,587.50",
      payableAmount: "1,587.50"
    },
    evidence: [
      {
        label: "Schema layer",
        value: "Canonical invoice model accepted with required-field findings."
      },
      {
        label: "Calculation layer",
        value: "Totals recalculated from line extension amount and VAT rate."
      },
      {
        label: "Country simulation",
        value: "Cross-border buyer/seller context requires professional review."
      },
      {
        label: "Rule source placeholder",
        value: "Future backend will attach source links, reviewed date, and rule version."
      }
    ]
  },
  val_01HXABD: {
    id: "val_01HXABD",
    invoiceNumber: "FF-2026-002",
    buyer: "Danube Consulting Kft.",
    seller: "FiscalForge Demo Kft.",
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
      taxInclusiveAmount: "1,016.00",
      payableAmount: "1,016.00"
    },
    evidence: [
      {
        label: "Schema layer",
        value: "Required browser-side fields are available."
      },
      {
        label: "Calculation layer",
        value: "Totals are internally consistent in the local preview."
      },
      {
        label: "Country simulation",
        value: "Domestic transaction context. No cross-border simulation applied."
      },
      {
        label: "Rule source placeholder",
        value: "Future backend will attach source links, reviewed date, and rule version."
      }
    ]
  },
  val_01HXABE: {
    id: "val_01HXABE",
    invoiceNumber: "FF-2026-003",
    buyer: "Nordic Trade AB",
    seller: "FiscalForge Demo Kft.",
    createdAt: "2026-04-22 09:45",
    technicalStatus: "passed",
    standardStatus: "warning",
    countrySimulationStatus: "review_required",
    vidaReadinessStatus: "relevant_simulation",
    confidence: "educational_simulation",
    profile: "PEPPOL_BIS_3",
    currency: "EUR",
    totals: {
      lineExtensionAmount: "2,400.00",
      taxExclusiveAmount: "2,400.00",
      taxAmount: "0.00",
      taxInclusiveAmount: "2,400.00",
      payableAmount: "2,400.00"
    },
    evidence: [
      {
        label: "Schema layer",
        value: "Canonical invoice model accepted for local preview."
      },
      {
        label: "Calculation layer",
        value: "Reverse-charge style scenario simulated with professional review notice."
      },
      {
        label: "Country simulation",
        value: "Cross-border buyer/seller context requires professional review."
      },
      {
        label: "Rule source placeholder",
        value: "Future backend will attach source links, reviewed date, and rule version."
      }
    ]
  }
};

type ValidationRunId = keyof typeof validationRunDetails;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getStatusTone(status: string) {
  if (
    status === "passed" ||
    status === "ready" ||
    status === "not_relevant" ||
    status === "technical_preview"
  ) {
    return "good";
  }

  return "warn";
}

function getRunById(id: string) {
  if (id in validationRunDetails) {
    return validationRunDetails[id as ValidationRunId];
  }

  return validationRunDetails.val_01HXABC;
}

export default async function ValidationRunDetailPage({ params }: PageProps) {
  const { id } = await params;
  const run = getRunById(id);

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
          Full validation report preview for invoice {run.invoiceNumber}. This page is
          still mock/local, but it now models the structure we need later from the real
          API: statuses, findings, monetary totals, evidence, source placeholders, and
          clear legal boundaries.
        </p>
      </section>

      <section className="validation-run-grid">
        <div className="validation-run-layer">
          <div className="validation-layer-icon">
            <Layers3 size={22} />
          </div>
          <span>{getStatusTone(run.technicalStatus)}</span>
          <h3>Technical status</h3>
          <p>{run.technicalStatus.replaceAll("_", " ")}</p>
        </div>

        <div className="validation-run-layer">
          <div className="validation-layer-icon">
            <FileCheck2 size={22} />
          </div>
          <span>{getStatusTone(run.standardStatus)}</span>
          <h3>Standard status</h3>
          <p>{run.standardStatus.replaceAll("_", " ")}</p>
        </div>

        <div className="validation-run-layer">
          <div className="validation-layer-icon">
            <Globe2 size={22} />
          </div>
          <span>{getStatusTone(run.countrySimulationStatus)}</span>
          <h3>Country simulation</h3>
          <p>{run.countrySimulationStatus.replaceAll("_", " ")}</p>
        </div>

        <div className="validation-run-layer">
          <div className="validation-layer-icon">
            <ShieldAlert size={22} />
          </div>
          <span>{getStatusTone(run.vidaReadinessStatus)}</span>
          <h3>ViDA readiness</h3>
          <p>{run.vidaReadinessStatus.replaceAll("_", " ")}</p>
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
            {run.confidence.replaceAll("_", " ")}. This report is a technical preview
            and must not be interpreted as legal, tax, accounting, Peppol, ViDA, or
            authority approval.
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
            local preview
          </div>
        </div>

        <div className="workspace-table">
          {Object.entries(run.totals).map(([label, value]) => (
            <div className="workspace-table-row" key={label}>
              <div>
                <strong>{label.replaceAll(/([A-Z])/g, " $1").trim()}</strong>
                <span>Amount from validation report preview</span>
              </div>

              <div>
                <span>{run.currency}</span>
              </div>

              <div>
                <span className="status-pill">calculated</span>
              </div>

              <strong>€{value}</strong>
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
            review required
          </div>
        </div>

        <div className="finding-console-list">
          {validationFindings.map((item) => (
            <div className="finding-console-row" key={item.code}>
              <AlertTriangle size={18} />

              <div>
                <strong>{item.code}</strong>
                <p>{item.message}</p>
              </div>

              <span>{item.severity}</span>
            </div>
          ))}
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
          {run.evidence.map((item) => (
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
            <p>
              This validation report is not legal, tax, accounting, financial, Peppol,
              EN 16931, ViDA, government, or authority validation.
            </p>
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
