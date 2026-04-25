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
import {
  validationFindings,
  validationRunLayers
} from "../../../lib/mock-data";
import type { WorkspaceIconKey } from "../../../lib/types";

const validationRuns = [
  {
    id: "val_01HXABC",
    invoiceNumber: "FF-2026-001",
    buyer: "Muster GmbH",
    technicalStatus: "failed",
    standardStatus: "warning",
    countrySimulationStatus: "review required",
    vidaReadinessStatus: "relevant simulation",
    createdAt: "2026-04-24 14:32",
    confidence: "educational simulation"
  },
  {
    id: "val_01HXABD",
    invoiceNumber: "FF-2026-002",
    buyer: "Danube Consulting Kft.",
    technicalStatus: "passed",
    standardStatus: "ready",
    countrySimulationStatus: "not relevant",
    vidaReadinessStatus: "not relevant",
    createdAt: "2026-04-23 18:10",
    confidence: "technical preview"
  },
  {
    id: "val_01HXABE",
    invoiceNumber: "FF-2026-003",
    buyer: "Nordic Trade AB",
    technicalStatus: "passed",
    standardStatus: "warning",
    countrySimulationStatus: "review required",
    vidaReadinessStatus: "relevant simulation",
    createdAt: "2026-04-22 09:45",
    confidence: "educational simulation"
  }
];

function getValidationIcon(iconKey: WorkspaceIconKey) {
  const icons: Record<string, React.ReactNode> = {
    schema: <Layers3 size={22} />,
    calculation: <Calculator size={22} />,
    ubl: <FileCheck2 size={22} />,
    legal: <ShieldAlert size={22} />
  };

  return icons[iconKey] ?? <FileCheck2 size={22} />;
}

export default function WorkspaceValidationRunsPage() {
  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Validation Runs</p>
        <h2>Every validation result must be explainable.</h2>
        <p>
          This screen will later show real validation runs from the API. The design
          already separates technical status, standard-style status, country simulation,
          ViDA relevance, findings, and disclaimers.
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
            report detail enabled
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
                  {run.invoiceNumber} · {run.buyer}
                </span>
              </div>

              <div>
                <span className="status-pill">{run.technicalStatus}</span>
              </div>

              <div>
                <span>{run.createdAt}</span>
              </div>

              <strong>{run.standardStatus}</strong>

              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section className="findings-console">
        <div className="findings-console-head">
          <div>
            <p>Latest run preview</p>
            <h3>val_01HXABC</h3>
          </div>

          <Link
            href="/workspace/validation-runs/val_01HXABC"
            className="confidence-label"
          >
            <BadgeCheck size={17} />
            open full report
          </Link>
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
    </div>
  );
}
