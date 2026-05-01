import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  KeyRound,
  ShieldCheck
} from "lucide-react";
import { Reveal } from "../../../components/reveal";
import { SiteHeader } from "../../../components/site-header";
import { OpenApiReference } from "./openapi-reference";
import "../developer-api.css";

const scopeRows = [
  ["invoices:validate", "POST /api/v1/invoices/validate"],
  ["invoices:export_ubl", "POST /api/v1/invoices/export/ubl"],
  ["invoices:parse_ubl", "POST /api/v1/invoices/parse/ubl"],
  ["xml:validation_jobs", "POST/GET /api/v1/xml/validation-jobs"],
  ["vat:validate_format", "POST /api/v1/vat/validate-format"],
  ["rules:read", "GET /api/v1/validation/rules"],
  ["validation_runs:read", "GET /api/v1/validation-runs/:id"]
];

export default function DeveloperApiReferencePage() {
  return (
    <main className="site-shell subpage-shell developer-api-page api-reference-page">
      <SiteHeader />

      <section className="subpage-hero">
        <div className="section-inner">
          <Reveal>
            <Link href="/developer-api" className="back-link">
              <ArrowLeft size={17} />
              Developer API
            </Link>

            <p className="section-kicker">API documentation</p>

            <h1 className="subpage-title">
              OpenAPI reference for the active sandbox API.
            </h1>

            <p className="subpage-lead">
              This reference documents the implemented Invoice Lantern
              Developer API surface. It covers sandbox technical validation,
              UBL export and parsing, local VAT format checks, validation-rule
              metadata, validation-run detail reads, API key management, usage
              logs, and rate-limit policy views. It is not official filing, not
              authority submission, not tax, legal, or accounting advice, and
              not a compliance guarantee.
            </p>
          </Reveal>

          <Reveal>
            <div className="reference-action-row">
              <Link href="/workspace/developer/api-keys" className="text-link-button">
                <KeyRound size={18} />
                API key manager
              </Link>
              <a
                href="/api/local/openapi"
                className="text-link-button"
                target="_blank"
                rel="noreferrer"
              >
                <BookOpen size={18} />
                Open JSON
              </a>
            </div>
          </Reveal>

          <Reveal>
            <OpenApiReference />
          </Reveal>

          <div className="reference-doc-grid">
            <Reveal>
              <section className="terminal-shell reference-terminal">
                <div className="terminal-top">
                  <span />
                  <span />
                  <span />
                  <p>X-API-Key example</p>
                </div>
                <pre>{`curl -X POST http://localhost:4000/api/v1/vat/validate-format \\
  -H "content-type: application/json" \\
  -H "X-API-Key: il_test_your_key_here" \\
  -d '{"vatId":"HU12345678","countryHint":"HU"}'

# Keys are shown once during creation.
# Request logs do not store request bodies, XML payloads, full API keys,
# full VAT IDs, or key hashes.`}</pre>
              </section>
            </Reveal>

            <Reveal>
              <section className="terminal-shell reference-terminal">
                <div className="terminal-top">
                  <span />
                  <span />
                  <span />
                  <p>Rate-limit response</p>
                </div>
                <pre>{`HTTP/1.1 429 Too Many Requests
Retry-After: 123
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-05-01T12:15:00.000Z

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "This API key exceeded the sandbox rate limit.",
    "limit": 30,
    "windowSeconds": 900,
    "retryAfterSeconds": 123
  }
}`}</pre>
              </section>
            </Reveal>
          </div>

          <Reveal>
            <section className="reference-scope-table">
              <div className="reference-table-head">
                <div>
                  <p>Scopes</p>
                  <h2>Current API-key scopes</h2>
                </div>
                <ShieldCheck size={22} />
              </div>

              <div className="reference-scope-list">
                {scopeRows.map(([scope, endpoint]) => (
                  <div className="reference-scope-row" key={scope}>
                    <strong>{scope}</strong>
                    <span>{endpoint}</span>
                  </div>
                ))}
              </div>

              <p>
                The reserved `invoices:import_ubl` scope can exist on keys, but
                UBL draft import is not documented as an active organization
                API-key endpoint in this reference.
              </p>
            </section>
          </Reveal>

          <div className="next-page-row">
            <Link href="/workspace/developer" className="text-link-button">
              Workspace developer console
              <ArrowRight size={18} />
            </Link>
            <Link href="/developer-api" className="text-link-button">
              API overview
              <Code2 size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
