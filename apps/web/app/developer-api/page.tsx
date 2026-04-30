import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  KeyRound,
  RadioTower,
  ShieldCheck
} from "lucide-react";
import { Reveal } from "../../components/reveal";
import { SiteHeader } from "../../components/site-header";
import "./developer-api.css";

const apiModules = [
  {
    icon: <Braces size={22} />,
    title: "Validation endpoint",
    description:
      "POST structured invoice JSON and receive a validation run ID, status fields, rule-based findings, confidence labels, and safe disclaimers."
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "Rule catalog endpoint",
    description:
      "Read published Invoice Lantern technical sandbox rules with versions, source labels, categories, severities, and legal-confidence labels."
  },
  {
    icon: <KeyRound size={22} />,
    title: "API key management",
    description:
      "Organization owners and admins can create scoped keys that are shown once, stored hashed, revocable, expirable, and tracked by last use."
  },
  {
    icon: <Braces size={22} />,
    title: "Request log metadata",
    description:
      "Workspace admins can review API usage logs with method, path, status, duration, key prefix, IP, user agent, and timestamps. Request bodies, XML payloads, full API keys, and full VAT IDs are not stored."
  },
  {
    icon: <RadioTower size={22} />,
    title: "Webhook simulator",
    description:
      "Planned. Sandbox webhook testing is planned for a later step. No webhook events are sent yet. This is not an official filing, reporting, or authority-submission feature."
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "Security controls",
    description:
      "Every endpoint needs schema validation, object authorization, rate limits, input size limits, secure API-key handling, and audit logging."
  }
];

export default function DeveloperApiPage() {
  return (
    <main className="site-shell subpage-shell developer-api-page">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/" className="back-link">
              <ArrowLeft size={17} />
              Home
            </Link>

            <p className="section-kicker">Developer API</p>

            <h1 className="subpage-title">
              A sandbox API for structured invoice testing.
            </h1>

            <p className="subpage-lead">
              The Developer API exposes selected sandbox technical validation
              tools through organization-owned API keys. It is not official
              filing, not authority submission, and not tax, legal, or
              accounting advice. API keys are shown once during creation and
              are sent with the X-API-Key header.
            </p>
          </Reveal>

          <div className="subpage-grid">
            {apiModules.map((item) => (
              <Reveal key={item.title}>
                <div className="subpage-card">
                  <div className="subpage-card-icon">{item.icon}</div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="terminal-shell subpage-terminal">
              <div className="terminal-top">
                <span />
                <span />
                <span />
                <p>X-API-Key: il_test_...</p>
              </div>

              <pre>{`# Create a key in Workspace > Developer > API keys.
# Full keys are shown once only. Send the key with X-API-Key.

curl -X POST http://localhost:4000/api/v1/invoices/validate \\
  -H "content-type: application/json" \\
  -H "X-API-Key: il_test_your_key_here" \\
  -d @invoice.json

{
  "validationRunId": "<generated-validation-run-id>",
  "technicalStatus": "passed_or_failed",
  "standardStatus": "ready_or_warning",
  "countrySimulationStatus": "not_relevant_or_review_required",
  "vidaReadinessStatus": "not_relevant_or_relevant_simulation",
  "findings": [
    {
      "code": "<finding-code>",
      "severity": "info_warning_or_fatal",
      "category": "CANONICAL",
      "fieldPath": "<field-path>",
      "fixSuggestion": "<technical-fix-suggestion>",
      "legalConfidence": "technical_or_simulation_or_review_required",
      "ruleSetCode": "INVOICE_LANTERN_CORE",
      "ruleVersion": "2026.04.1"
    }
  ],
  "disclaimer": "This result is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
}`}</pre>
            </div>
          </Reveal>

          <Reveal>
            <div className="terminal-shell subpage-terminal">
              <div className="terminal-top">
                <span />
                <span />
                <span />
                <p>Scopes</p>
              </div>

              <pre>{`invoices:validate        POST /api/v1/invoices/validate
invoices:export_ubl      POST /api/v1/invoices/export/ubl
invoices:parse_ubl       POST /api/v1/invoices/parse/ubl
vat:validate_format      POST /api/v1/vat/validate-format
rules:read               GET  /api/v1/validation/rules
validation_runs:read     GET  /api/v1/validation-runs/:id

Invoice Lantern API keys provide access to sandbox technical validation tools only.
They are not official filing credentials and do not provide tax authority submission capability.

API usage logs store metadata only: method, path, status, duration, key prefix, IP, user agent, and timestamps.
They do not store request bodies, XML payloads, full API keys, full VAT IDs, or key hashes.`}</pre>
            </div>
          </Reveal>

          <div className="next-page-row">
            <Link href="/boundaries" className="text-link-button">
              Continue to Boundaries
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
