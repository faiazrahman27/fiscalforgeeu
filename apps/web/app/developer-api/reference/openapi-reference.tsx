"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, KeyRound, RefreshCw } from "lucide-react";

type OpenApiOperation = {
  summary?: unknown;
  description?: unknown;
  tags?: unknown;
  security?: unknown;
  responses?: unknown;
  "x-required-scope"?: unknown;
};

type OpenApiPathItem = Record<string, OpenApiOperation>;

type OpenApiDocument = {
  info?: {
    title?: unknown;
    version?: unknown;
    description?: unknown;
  };
  servers?: unknown;
  paths?: Record<string, OpenApiPathItem>;
};

type EndpointRow = {
  method: string;
  path: string;
  tag: string;
  summary: string;
  description: string;
  scope: string;
  auth: string;
  responses: string[];
};

const methodOrder = ["get", "post", "put", "patch", "delete"];

const fallbackRows: EndpointRow[] = [
  {
    method: "POST",
    path: "/api/v1/invoices/validate",
    tag: "Invoices",
    summary: "Validate a canonical invoice payload",
    description:
      "Runs sandbox technical invoice validation with X-API-Key authentication.",
    scope: "invoices:validate",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "429", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/invoices/export/ubl",
    tag: "UBL",
    summary: "Export UBL XML",
    description:
      "Generates UBL XML from canonical invoice JSON and returns safe export metadata.",
    scope: "invoices:export_ubl",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "422", "429", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/invoices/parse/ubl",
    tag: "UBL",
    summary: "Parse UBL XML",
    description:
      "Parses raw XML or JSON with an xml string into the canonical invoice shape.",
    scope: "invoices:parse_ubl",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "413", "415", "422", "429", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/invoices/import/ubl",
    tag: "UBL",
    summary: "Import UBL into editable draft",
    description:
      "Signed-user-only workspace route. Organization API keys can parse UBL but cannot create editable drafts.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["201", "400", "401", "403", "413", "415", "422", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/invoices/export/cii",
    tag: "CII",
    summary: "Export technical CII XML",
    description:
      "Generates UN/CEFACT CII-style XML from canonical invoice JSON and returns safe export metadata. This is technical sandbox XML support only.",
    scope: "invoices:export_cii",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "422", "429", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/invoices/parse/cii",
    tag: "CII",
    summary: "Parse CII XML",
    description:
      "Parses safe raw XML or JSON with an xml string into the canonical invoice shape with technical findings.",
    scope: "invoices:parse_cii",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "413", "415", "422", "429", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/invoices/import/cii",
    tag: "CII",
    summary: "Import CII into editable draft",
    description:
      "Signed-user-only workspace route. Organization API keys can parse CII but cannot create editable drafts.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["201", "400", "401", "403", "413", "415", "422", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/invoices/exports",
    tag: "UBL/CII",
    summary: "List XML export metadata",
    description:
      "Signed-user-only workspace route for safe UBL/CII export metadata. XML bodies, full keys, and key hashes are not returned.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/xml/validation-jobs",
    tag: "XML Validation Jobs",
    summary: "Create an XML validation job",
    description:
      "Creates an XML validation job with sanitized metadata and results. Supported checks include xsd_ubl, xsd_cii, schematron_peppol, and schematron_en16931. XSD and Schematron are guarded technical checks; not_configured, disabled, unsupported, unsafe_input, and preflight_only are not success.",
    scope: "xml:validation_jobs",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "413", "429", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/xml/validation-jobs",
    tag: "XML Validation Jobs",
    summary: "List XML validation jobs",
    description:
      "Lists XML validation jobs for the caller organization with sanitized metadata and results. Raw XML is never returned.",
    scope: "xml:validation_jobs",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "429", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/xml/validation-jobs/:id",
    tag: "XML Validation Jobs",
    summary: "Get XML validation job detail",
    description:
      "Returns one XML validation job with requested checks, check statuses, findings, and safe non-official disclaimers.",
    scope: "xml:validation_jobs",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "404", "429", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/xml/inspect",
    tag: "XML Validation Jobs",
    summary: "Inspect XML readiness",
    description:
      "Signed-user-only workspace route for sanitized XML readiness inspection. Raw XML is not returned.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "413", "415", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/xml/uploads",
    tag: "XML Validation Jobs",
    summary: "List XML upload records",
    description:
      "Signed-user-only workspace route for sanitized XML upload inspection history.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/transactions/simulate-vida",
    tag: "Transactions",
    summary: "Run ViDA-readiness simulation",
    description:
      "Returns transaction class, readiness score/status, evidence summary, timeline, source references, and safe non-official findings.",
    scope: "transactions:simulate_vida",
    auth: "X-API-Key or Bearer user token",
    responses: ["200", "400", "401", "403", "429", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/transactions/vida-simulations",
    tag: "Transactions",
    summary: "List saved ViDA simulations",
    description:
      "Signed-user-only workspace history for persisted educational ViDA-readiness simulations.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/invoices/:id/simulate-vida",
    tag: "Invoices",
    summary: "Run production invoice ViDA simulation",
    description:
      "Runs a signed-user simulation from a tenant-scoped production invoice canonical payload without changing lifecycle status.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["201", "400", "401", "403", "404", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/vat/validate-format",
    tag: "VAT",
    summary: "Validate local VAT format",
    description:
      "Runs local VAT ID format checks only. This is not VIES and not proof of registration.",
    scope: "vat:validate_format",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "429", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/vat/check-vies",
    tag: "VAT",
    summary: "Check VIES evidence",
    description:
      "Runs an optional backend VIES evidence check. Local format-valid is not VIES-valid, VIES unavailable is not invalid, and VIES valid is not legal, tax, accounting, filing, or compliance proof.",
    scope: "vat:check_vies",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "429", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/vat/checks",
    tag: "VAT",
    summary: "List VAT format checks",
    description:
      "Signed-user-only workspace history for local VAT format checks. This is not VIES evidence.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/validation/rules",
    tag: "Validation Rules",
    summary: "List validation rules",
    description:
      "Returns published Invoice Lantern technical sandbox validation rule metadata.",
    scope: "rules:read",
    auth: "X-API-Key",
    responses: ["200", "400", "401", "403", "429", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/validation-runs",
    tag: "Validation Runs",
    summary: "List validation run summaries",
    description:
      "Lists organization-owned validation run summaries for API keys with validation_runs:read.",
    scope: "validation_runs:read",
    auth: "X-API-Key or Bearer user token",
    responses: ["200", "400", "401", "403", "429", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/endpoints",
    tag: "Webhooks",
    summary: "List webhook simulator endpoints",
    description:
      "Signed-user-only workspace route for safe endpoint metadata. Raw webhook signing secrets are never returned.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "429", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/endpoints",
    tag: "Webhooks",
    summary: "Create webhook simulator endpoint",
    description:
      "Creates a safe HTTPS endpoint and returns the raw HMAC signing secret once. Unsafe URLs and missing encryption configuration are rejected.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["201", "400", "401", "403", "429", "500", "503"]
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/endpoints/:id/test",
    tag: "Webhooks",
    summary: "Send signed sandbox test event",
    description:
      "Sends one signed JSON sandbox event with Invoice-Lantern-Webhook-* headers and records a redacted delivery log.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "409", "429", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/webhooks/deliveries",
    tag: "Webhooks",
    summary: "List webhook delivery logs",
    description:
      "Lists redacted delivery logs with status, attempts, response status, bounded previews, and safe errors only.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "429", "500"]
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/deliveries/:id/retry",
    tag: "Webhooks",
    summary: "Retry failed webhook test delivery",
    description:
      "Creates one bounded retry attempt for a failed, blocked, or retry-scheduled sandbox delivery.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "409", "429", "500"]
  },
  {
    method: "GET",
    path: "/api/v1/api-keys",
    tag: "Authentication / API Keys",
    summary: "List organization API keys",
    description:
      "Signed-user-only workspace route that returns safe API key metadata without full secrets or key hashes.",
    scope: "No API-key scope",
    auth: "Bearer user token",
    responses: ["200", "400", "401", "403", "500"]
  }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readTag(value: unknown) {
  return Array.isArray(value) && typeof value[0] === "string"
    ? value[0]
    : "Developer API";
}

function readResponses(value: unknown) {
  return isRecord(value) ? Object.keys(value).sort() : [];
}

function readAuthLabel(security: unknown) {
  if (!Array.isArray(security)) {
    return "Public";
  }

  const labels = security
    .filter(isRecord)
    .flatMap((securityItem) => Object.keys(securityItem))
    .map((name) =>
      name === "ApiKeyAuth"
        ? "X-API-Key"
        : name === "SupabaseBearerAuth"
          ? "Bearer user token"
          : name
    );

  return labels.length > 0 ? labels.join(" or ") : "Public";
}

function collectRows(document: OpenApiDocument | null): EndpointRow[] {
  if (!document?.paths) {
    return fallbackRows;
  }

  const rows: EndpointRow[] = [];

  Object.entries(document.paths).forEach(([path, pathItem]) => {
    methodOrder.forEach((method) => {
      const operation = pathItem[method];

      if (!operation) {
        return;
      }

      rows.push({
        method: method.toUpperCase(),
        path: `/api/v1${path}`,
        tag: readTag(operation.tags),
        summary: readString(operation.summary, `${method.toUpperCase()} ${path}`),
        description: readString(operation.description),
        scope: readString(operation["x-required-scope"], "No API-key scope"),
        auth: readAuthLabel(operation.security),
        responses: readResponses(operation.responses)
      });
    });
  });

  return rows.length > 0 ? rows : fallbackRows;
}

function groupRows(rows: EndpointRow[]) {
  return rows.reduce<Record<string, EndpointRow[]>>((groups, row) => {
    groups[row.tag] = [...(groups[row.tag] ?? []), row];
    return groups;
  }, {});
}

export function OpenApiReference() {
  const [document, setDocument] = useState<OpenApiDocument | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Loading OpenAPI JSON.");

  const rows = useMemo(() => collectRows(document), [document]);
  const groups = useMemo(() => groupRows(rows), [rows]);
  const apiTitle = readString(
    document?.info?.title,
    "Invoice Lantern Developer API"
  );
  const apiVersion = readString(document?.info?.version, "0.1.0");

  async function loadDocument() {
    setStatus("loading");
    setMessage("Loading OpenAPI JSON.");

    try {
      const response = await fetch("/api/local/openapi", {
        cache: "no-store"
      });
      const data = (await response.json()) as unknown;

      if (!response.ok || !isRecord(data)) {
        throw new Error("OpenAPI document was not available.");
      }

      setDocument(data as OpenApiDocument);
      setStatus("loaded");
      setMessage("Loaded from /api/v1/openapi.json.");
    } catch {
      setDocument(null);
      setStatus("error");
      setMessage(
        "Live OpenAPI JSON is not reachable. Start the API server to load the current document."
      );
    }
  }

  useEffect(() => {
    void loadDocument();
  }, []);

  return (
    <section className="openapi-reference-shell">
      <div className="openapi-reference-head">
        <div>
          <p>OpenAPI reference</p>
          <h2>{apiTitle}</h2>
          <span>Version {apiVersion}</span>
        </div>

        <button type="button" onClick={() => void loadDocument()}>
          <RefreshCw size={16} />
          Reload JSON
        </button>
      </div>

      <div className={`openapi-status is-${status}`}>
        {status === "error" ? <AlertTriangle size={18} /> : <BookOpen size={18} />}
        <span>{message}</span>
        <a href="/api/local/openapi" target="_blank" rel="noreferrer">
          Open JSON
        </a>
      </div>

      <div className="openapi-auth-strip">
        <div>
          <KeyRound size={18} />
          <strong>X-API-Key</strong>
          <span>il_test_your_key_here</span>
        </div>
        <p>
          Organization API keys authenticate selected sandbox developer
          endpoints only. Workspace key management, webhook simulator endpoint
          management, delivery logs, and usage logs use signed-in user bearer
          authentication. This reference is not official filing, authority
          submission, tax advice, legal advice, accounting advice, or a
          compliance guarantee.
        </p>
      </div>

      <div className="openapi-groups">
        {Object.entries(groups).map(([tag, tagRows]) => (
          <section className="openapi-group" key={tag}>
            <h3>{tag}</h3>
            <div className="openapi-operation-list">
              {tagRows.map((row) => (
                <article
                  className="openapi-operation"
                  key={`${row.method}-${row.path}`}
                >
                  <header>
                    <span className={`openapi-method is-${row.method.toLowerCase()}`}>
                      {row.method}
                    </span>
                    <strong>{row.path}</strong>
                  </header>
                  <h4>{row.summary}</h4>
                  <p>{row.description.split("\n")[0]}</p>
                  <div className="openapi-operation-meta">
                    <span>Auth: {row.auth}</span>
                    <span>Scope: {row.scope}</span>
                    <span>Responses: {row.responses.join(", ")}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
