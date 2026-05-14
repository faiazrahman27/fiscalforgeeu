import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
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
    icon: <BookOpen size={22} />,
    title: "OpenAPI reference",
    description:
      "Browse the active OpenAPI document, auth requirements, scopes, response schemas, examples, and rate-limit headers for the current sandbox Developer API."
  },
  {
    icon: <Braces size={22} />,
    title: "Validation endpoint",
    description:
      "POST structured invoice JSON and receive a validation run ID, status fields, rule-based findings, confidence labels, and safe disclaimers."
  },
  {
    icon: <Braces size={22} />,
    title: "XML validation jobs",
    description:
      "Create metadata-only XML validation jobs for worker readiness, xsd_ubl, schematron_peppol, and schematron_en16931. XSD and Schematron are guarded technical checks; raw XML is not stored in job records."
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "VIES evidence checks",
    description:
      "POST VAT numbers to the backend VIES evidence endpoint through scoped API keys. VIES evidence is time-of-check evidence only and is separate from local format checks."
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
    icon: <ShieldCheck size={22} />,
    title: "Rate limits",
    description:
      "Sandbox API usage limits protect developer endpoints from abuse and unrestricted resource consumption. Graceful 429 responses include Retry-After and X-RateLimit headers."
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

            <div className="reference-action-row">
              <Link href="/developer-api/reference" className="text-link-button">
                <BookOpen size={18} />
                API reference
              </Link>
              <Link
                href="/workspace/developer/api-keys"
                className="text-link-button"
              >
                <KeyRound size={18} />
                API key manager
              </Link>
            </div>
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
      "ruleVersion": "2026.05.1"
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
                <p>XML validation jobs</p>
              </div>

              <pre>{`# Create a metadata-only XML validation job.
# Raw XML is accepted for processing but is not stored in job records or API request logs.
# UBL XSD and Schematron checks are guarded technical checks.
# not_configured, disabled, unsupported, unsafe_input, and preflight_only are not success.

curl -X POST http://localhost:4000/api/v1/xml/validation-jobs \\
  -H "content-type: application/json" \\
  -H "X-API-Key: il_test_your_key_here" \\
  -d '{
    "xml": "<Invoice>...</Invoice>",
    "filename": "sandbox-invoice.xml",
    "sourceType": "api_payload",
    "requestedChecks": [
      "worker_readiness",
      "xsd_ubl",
      "schematron_peppol",
      "schematron_en16931"
    ]
  }'

{
  "job": {
    "status": "completed",
    "requestedChecks": [
      "worker_readiness",
      "xsd_ubl",
      "schematron_peppol",
      "schematron_en16931"
    ],
    "completedChecks": [
      "worker_readiness",
      "xsd_ubl"
    ],
    "failedChecks": [
      "schematron_peppol"
    ],
    "findings": [
      {
        "code": "UBL_XSD_NOT_CONFIGURED",
        "status": "not_configured",
        "message": "UBL XSD validation was requested, but local UBL XSD artefacts are not configured in this environment."
      }
    ],
    "disclaimer": "This job does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance."
  }
}`}</pre>
            </div>
          </Reveal>

          <Reveal>
            <div className="terminal-shell subpage-terminal">
              <div className="terminal-top">
                <span />
                <span />
                <span />
                <p>VIES evidence</p>
              </div>

              <pre>{`# Optional VIES evidence check.
# Local format-valid is not VIES-valid. VIES unavailable is not invalid.
# VIES valid is not legal, tax, accounting, filing, or compliance proof.

curl -X POST http://localhost:4000/api/v1/vat/check-vies \\
  -H "content-type: application/json" \\
  -H "X-API-Key: il_test_your_key_here" \\
  -d '{
    "countryCode": "DE",
    "vatNumber": "DE123456789",
    "partyRole": "buyer"
  }'

{
  "status": "valid_invalid_unavailable_error_not_checked_unsupported_or_rate_limited",
  "formatCheck": {
    "formatValid": true,
    "message": "Local format result only."
  },
  "viesCheck": {
    "status": "valid",
    "viesValid": true,
    "checkedAt": "<timestamp>",
    "source": {
      "label": "VAT Information Exchange System (VIES)"
    }
  },
  "disclaimer": "VIES evidence is time-of-check evidence only."
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
xml:validation_jobs      POST /api/v1/xml/validation-jobs
xml:validation_jobs      GET  /api/v1/xml/validation-jobs
xml:validation_jobs      GET  /api/v1/xml/validation-jobs/:id
vat:validate_format      POST /api/v1/vat/validate-format
vat:check_vies           POST /api/v1/vat/check-vies
rules:read               GET  /api/v1/validation/rules
validation_runs:read     GET  /api/v1/validation-runs/:id

Signed-in workspace production invoice lifecycle routes use Supabase session auth:
GET    /api/v1/invoices
GET    /api/v1/invoices/:id
POST   /api/v1/invoices/from-draft
POST   /api/v1/invoices/:id/transition
POST   /api/v1/invoices/:id/export/ubl

Invoice Lantern API keys provide access to sandbox technical validation tools only.
They are not official filing credentials and do not provide tax authority submission capability.

API usage logs store metadata only: method, path, status, duration, key prefix, IP, user agent, and timestamps.
They do not store request bodies, XML payloads, full API keys, full VAT IDs, or key hashes.`}</pre>
            </div>
          </Reveal>

          <Reveal>
            <div className="terminal-shell subpage-terminal">
              <div className="terminal-top">
                <span />
                <span />
                <span />
                <p>Rate limits</p>
              </div>

              <pre>{`Sandbox developer API limits:
rules:read               120 requests per 15 minutes per API key
vat:validate_format       60 requests per 15 minutes per API key
vat:check_vies            20 requests per 15 minutes per API key
invoices:validate         30 requests per 15 minutes per API key
invoices:export_ubl       30 requests per 15 minutes per API key
invoices:parse_ubl        30 requests per 15 minutes per API key
xml:validation_jobs       15 requests per 15 minutes per API key
organization total       300 requests per 15 minutes

Rate limits protect the sandbox API from abuse and unrestricted resource consumption.
They are not an SLA and are not a compliance guarantee.

HTTP/1.1 429 Too Many Requests
Retry-After: 123
X-RateLimit-Limit: 15
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-05-01T12:15:00.000Z

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "This API key exceeded the sandbox rate limit for XML validation jobs.",
    "limit": 15,
    "windowSeconds": 900,
    "retryAfterSeconds": 123
  }
}`}</pre>
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
