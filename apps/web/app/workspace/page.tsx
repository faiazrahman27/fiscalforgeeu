import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Braces,
  Database,
  FileCode2,
  FileText,
  KeyRound,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  UploadCloud
} from "lucide-react";

const stats = [
  {
    label: "Draft invoices",
    value: "12",
    note: "Structured invoice drafts prepared for validation."
  },
  {
    label: "Validation runs",
    value: "28",
    note: "Technical checks, warnings, and simulation results."
  },
  {
    label: "Open findings",
    value: "7",
    note: "Issues requiring user review before export."
  },
  {
    label: "API requests",
    value: "184",
    note: "Sandbox calls recorded for future API testing."
  }
];

const commandFlow = [
  {
    icon: <ReceiptText size={20} />,
    title: "Create invoice data",
    description:
      "Build canonical invoice data from seller, buyer, document, payment, VAT, and line-item inputs.",
    href: "/workspace/invoices/new"
  },
  {
    icon: <Activity size={20} />,
    title: "Run validation",
    description:
      "Inspect schema readiness, calculation logic, VAT-number format, legal-confidence labels, and simulation warnings.",
    href: "/workspace/validation-runs"
  },
  {
    icon: <UploadCloud size={20} />,
    title: "Upload XML",
    description:
      "Inspect XML structure, detect basic invoice fields, and prepare future UBL validation-worker handoff.",
    href: "/workspace/xml-upload"
  },
  {
    icon: <KeyRound size={20} />,
    title: "Prepare API testing",
    description:
      "Model sandbox API keys, request logs, webhook tests, scoped access, and rate-limited endpoint behavior.",
    href: "/workspace/developer"
  }
];

const alerts = [
  "API and web are separated. The frontend calls local Next.js proxy routes, which forward requests to the dedicated API service.",
  "Validation outputs must never claim legal, tax, accounting, Peppol, EN 16931, ViDA, or authority certification.",
  "Every real rule later needs a source reference, reviewed date, confidence level, and rule version.",
  "XML upload must block DTD, XXE, external entities, oversized files, and unsafe parser behavior."
];

export default function WorkspacePage() {
  return (
    <div className="workspace-page">
      <section className="workspace-hero">
        <div className="workspace-hero-copy">
          <p className="workspace-kicker">Command center</p>

          <h2>
            Turn invoice data into structured, explainable validation evidence.
          </h2>

          <p>
            This is the future authenticated product shell. The interface is shaped
            around the real Invoice Lantern workflow: invoice creation, validation,
            XML handling, API testing, audit trails, and privacy controls.
          </p>
        </div>
      </section>

      <section className="workspace-stat-strip">
        {stats.map((item) => (
          <div className="workspace-stat" key={item.label}>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <span>{item.note}</span>
          </div>
        ))}
      </section>

      <section className="workspace-command-grid">
        <div className="workspace-flow">
          {commandFlow.map((item) => (
            <Link href={item.href} className="workspace-flow-row" key={item.title}>
              <span className="flow-symbol">{item.icon}</span>

              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>

              <ArrowRight size={18} />
            </Link>
          ))}
        </div>

        <aside className="workspace-alerts">
          <div className="alerts-head">
            <AlertTriangle size={22} />

            <div>
              <p>Implementation guardrails</p>
              <h3>Do not overclaim.</h3>
            </div>
          </div>

          <div className="alert-list">
            {alerts.map((item) => (
              <div className="alert-item" key={item}>
                <span />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="workspace-map">
        <div>
          <Database size={24} />
          <h3>Product data layer</h3>
          <p>
            The frontend will later consume invoices, validation runs, API requests,
            privacy settings, audit events, and rule-pack metadata from the dedicated API
            service.
          </p>
        </div>

        <div>
          <ShieldCheck size={24} />
          <h3>Security-first shell</h3>
          <p>
            The interface is planned around organization ownership, RBAC, secure API key
            management, XML upload limits, audit logs, and GDPR-oriented controls.
          </p>
        </div>
      </section>

      <section className="workspace-step-grid">
        <div className="workspace-step">
          <div>
            <FileText size={21} />
          </div>
          <h3>Invoice studio</h3>
          <p>
            Create structured invoice records from canonical fields, not scanned pixels or
            untrusted visual extraction.
          </p>
        </div>

        <div className="workspace-step">
          <div>
            <FileCode2 size={21} />
          </div>
          <h3>XML handling</h3>
          <p>
            Prepare UBL XML generation, parsing, upload checks, safe parser behavior, and
            validation-worker handoff.
          </p>
        </div>

        <div className="workspace-step">
          <div>
            <Braces size={21} />
          </div>
          <h3>API layer</h3>
          <p>
            Keep web and API separated. The API will own validation, exports, logs, keys,
            webhooks, and rate limits.
          </p>
        </div>

        <div className="workspace-step">
          <div>
            <LockKeyhole size={21} />
          </div>
          <h3>Privacy controls</h3>
          <p>
            Build toward exports, deletion requests, retention settings, audit history,
            and clear data-processing boundaries.
          </p>
        </div>
      </section>
    </div>
  );
}
