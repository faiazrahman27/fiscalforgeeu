import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  Globe2,
  KeyRound,
  RadioTower,
  ShieldCheck
} from "lucide-react";
import { Reveal } from "../../../components/reveal";
import { SiteFooter } from "../../../components/site-footer";
import { SiteHeader } from "../../../components/site-header";
import { OpenApiReference } from "./openapi-reference";
import "../developer-api.css";

const scopeRows = [
  ["invoices:validate", "POST /api/v1/invoices/validate"],
  ["invoices:export_ubl", "POST /api/v1/invoices/export/ubl"],
  ["invoices:parse_ubl", "POST /api/v1/invoices/parse/ubl"],
  ["invoices:import_ubl", "Reserved; draft import is signed-user-only"],
  ["invoices:export_cii", "POST /api/v1/invoices/export/cii"],
  ["invoices:parse_cii", "POST /api/v1/invoices/parse/cii"],
  ["invoices:import_cii", "Reserved; draft import is signed-user-only"],
  ["xml:validation_jobs", "POST/GET /api/v1/xml/validation-jobs"],
  ["vat:validate_format", "POST /api/v1/vat/validate-format"],
  ["vat:check_vies", "POST /api/v1/vat/check-vies"],
  ["transactions:simulate_vida", "POST /api/v1/transactions/simulate-vida"],
  ["rules:read", "GET /api/v1/validation/rules"],
  ["validation_runs:read", "GET /api/v1/validation-runs and /:id"]
];

const publicReadOnlyRows = [
  ["Country-pack catalogue", "GET /api/v1/country-packs"],
  ["Country-pack detail", "GET /api/v1/country-packs/:countryCode"],
  ["OpenAPI document", "GET /api/v1/openapi.json"]
];

const signedUserRows = [
  ["Webhook endpoints", "GET/POST /api/v1/webhooks/endpoints"],
  ["Webhook endpoint detail", "GET/PATCH/DELETE /api/v1/webhooks/endpoints/:id"],
  ["Rotate webhook secret", "POST /api/v1/webhooks/endpoints/:id/rotate-secret"],
  ["Send test event", "POST /api/v1/webhooks/endpoints/:id/test"],
  ["Delivery logs", "GET /api/v1/webhooks/deliveries and /:id"],
  ["Retry delivery", "POST /api/v1/webhooks/deliveries/:id/retry"]
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
              UBL and CII export and parsing, signed-user-only UBL/CII draft
              import, XML validation jobs, local VAT format checks, explicit
              VIES evidence, ViDA-readiness simulations, country-pack catalogue reads,
              validation-rule metadata, validation-run list/detail reads, API key
              management, usage logs, and rate-limit policy views. It is not
              official filing, not authority submission, not tax, legal, or
              accounting advice, and not a compliance guarantee.
            </p>
          </Reveal>

          <Reveal>
            <div className="reference-action-row">
              <Link href="/workspace/developer/api-keys" className="text-link-button">
                <KeyRound size={18} />
                API key manager
              </Link>
              <Link href="/workspace/developer/webhooks" className="text-link-button">
                <RadioTower size={18} />
                Webhook simulator
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
                  <p>ViDA simulation</p>
                </div>
                <pre>{`curl -X POST http://localhost:4000/api/v1/transactions/simulate-vida \\
  -H "content-type: application/json" \\
  -H "X-API-Key: il_test_your_key_here" \\
  -d '{
    "sellerCountry": "DE",
    "buyerCountry": "HU",
    "sellerVatId": "DE123456789",
    "buyerVatId": "HU12345678",
    "buyerType": "business",
    "transactionType": "services",
    "invoiceDate": "2026-05-01",
    "currency": "EUR",
    "amount": "100.00"
  }'

# Requires the transactions:simulate_vida API-key scope.
# This is an educational readiness simulation only.
# It is not official ViDA software, not filing, not authority submission,
# not legal, tax, or accounting advice, and not a compliance guarantee.`}</pre>
              </section>
            </Reveal>

            <Reveal>
              <section className="terminal-shell reference-terminal">
                <div className="terminal-top">
                  <span />
                  <span />
                  <span />
                  <p>Country-pack catalogue</p>
                </div>
                <pre>{`curl http://localhost:4000/api/v1/country-packs

curl http://localhost:4000/api/v1/country-packs/HU

# Country packs are read-only educational simulations.
# They expose VAT-pattern, source-reference, lifecycle, capability,
# and registry metadata when available.
# They do not certify legal, tax, accounting, Peppol, EN 16931,
# ViDA, filing, or authority compliance.`}</pre>
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
                The reserved `invoices:import_ubl` and `invoices:import_cii`
                scopes can exist on keys, but XML draft import is documented as
                a signed-user-only workspace route. Organization API keys can
                parse UBL/CII XML with the parse scopes; they cannot create
                editable drafts.
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section className="reference-scope-table">
              <div className="reference-table-head">
                <div>
                  <p>Signed-user routes</p>
                  <h2>Webhook simulator</h2>
                </div>
                <RadioTower size={22} />
              </div>

              <div className="reference-scope-list">
                {signedUserRows.map(([label, endpoint]) => (
                  <div className="reference-scope-row" key={endpoint}>
                    <strong>{label}</strong>
                    <span>{endpoint}</span>
                  </div>
                ))}
              </div>

              <p>
                Webhook management uses Supabase bearer sessions for owner,
                admin, and developer workspace roles. Organization API keys do
                not manage webhook endpoints or secrets. Test events use HMAC
                SHA-256 headers and delivery logs redact signatures, secrets,
                raw XML, raw SOAP, and response previews.
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section className="reference-scope-table">
              <div className="reference-table-head">
                <div>
                  <p>Public read-only endpoints</p>
                  <h2>Reference and country-pack metadata</h2>
                </div>
                <Globe2 size={22} />
              </div>

              <div className="reference-scope-list">
                {publicReadOnlyRows.map(([label, endpoint]) => (
                  <div className="reference-scope-row" key={endpoint}>
                    <strong>{label}</strong>
                    <span>{endpoint}</span>
                  </div>
                ))}
              </div>

              <p>
                Country-pack endpoints are read-only catalogue endpoints. They
                are documented separately from API-key scopes because they do
                not perform user-owned invoice validation, XML processing, VAT
                verification, filing, or authority submission.
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

      <SiteFooter />
    </main>
  );
}
