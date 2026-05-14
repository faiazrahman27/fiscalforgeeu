import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import { openApiDocument } from "./openapi-document.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = record[key];

  assert.equal(isRecord(value), true, `${key} should be an object`);

  return value as Record<string, unknown>;
}

function getOpenApiDocument(value: unknown) {
  assert.equal(isRecord(value), true);

  return value as Record<string, unknown>;
}

function getPaths(document: Record<string, unknown>) {
  return readRecord(document, "paths");
}

function readOperation(
  paths: Record<string, unknown>,
  path: string,
  method: string
) {
  return readRecord(readRecord(paths, path), method);
}

test("GET /api/v1/openapi.json returns the active OpenAPI document", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/openapi.json"
  });

  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers["cache-control"]), /max-age=300/);

  const document = getOpenApiDocument(response.json());

  assert.equal(document.openapi, "3.1.0");

  const info = readRecord(document, "info");

  assert.equal(info.title, "Invoice Lantern Developer API");
  assert.match(String(info.description), /non-official/i);
  assert.match(String(info.description), /not official filing/i);
});

test("OpenAPI includes X-API-Key auth and signed-in workspace auth", () => {
  const document = getOpenApiDocument(openApiDocument);
  const components = readRecord(document, "components");
  const securitySchemes = readRecord(components, "securitySchemes");
  const apiKeyAuth = readRecord(securitySchemes, "ApiKeyAuth");
  const bearerAuth = readRecord(securitySchemes, "SupabaseBearerAuth");

  assert.equal(apiKeyAuth.type, "apiKey");
  assert.equal(apiKeyAuth.in, "header");
  assert.equal(apiKeyAuth.name, "X-API-Key");
  assert.equal(bearerAuth.type, "http");
  assert.equal(bearerAuth.scheme, "bearer");
});

test("OpenAPI documents the implemented developer-facing API route surface", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const components = readRecord(document, "components");
  const schemas = readRecord(components, "schemas");

  const requiredOperations = [
    ["/api-keys", "get"],
    ["/api-keys", "post"],
    ["/api-keys/{id}/revoke", "post"],
    ["/api-requests", "get"],
    ["/api-requests/summary", "get"],
    ["/api-usage/policies", "get"],
    ["/api-usage/current", "get"],
    ["/invoices", "get"],
    ["/invoices", "post"],
    ["/invoices/from-draft", "post"],
    ["/invoices/{id}", "get"],
    ["/invoices/{id}", "patch"],
    ["/invoices/{id}/transition", "post"],
    ["/invoices/{id}/lifecycle-events", "get"],
    ["/invoices/{id}/export/ubl", "post"],
    ["/invoices/{id}/simulate-vida", "post"],
    ["/invoices/validate", "post"],
    ["/invoices/export/ubl", "post"],
    ["/invoices/parse/ubl", "post"],
    ["/invoices/import/ubl", "post"],
    ["/invoices/exports", "get"],
    ["/xml/validation-jobs", "get"],
    ["/xml/validation-jobs", "post"],
    ["/xml/validation-jobs/{id}", "get"],
    ["/xml/uploads", "get"],
    ["/xml/uploads/{id}", "get"],
    ["/xml/uploads/{id}", "delete"],
    ["/xml/inspect", "post"],
    ["/vat/validate-format", "post"],
    ["/vat/check-vies", "post"],
    ["/vat/checks", "get"],
    ["/validation/rules", "get"],
    ["/validation-runs", "get"],
    ["/validation-runs/{id}", "get"],
    ["/validation-runs/{id}", "delete"],
    ["/validation-runs/{id}/report.pdf", "get"],
    ["/country-packs", "get"],
    ["/country-packs/{countryCode}", "get"],
    ["/transactions/simulate-vida", "post"],
    ["/transactions/vida-simulations", "get"],
    ["/transactions/vida-simulations/{id}", "get"]
  ] as const;

  for (const [path, method] of requiredOperations) {
    assert.ok(paths[path], `Expected OpenAPI path ${path}`);
    assert.ok(
      readRecord(paths, path)[method],
      `Expected OpenAPI operation ${method.toUpperCase()} ${path}`
    );
  }

  for (const schemaName of [
    "UblImportResponse",
    "InvoiceExportListResponse",
    "XmlInspectResponse",
    "XmlUploadListResponse",
    "VatCheckListResponse",
    "ValidationRunListResponse",
    "DeleteResponse"
  ]) {
    assert.ok(schemas[schemaName], `Expected schema ${schemaName}`);
  }
});

test("OpenAPI documents scopes and signed-user-only API boundaries", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);

  const scopedOperations = [
    ["/invoices/validate", "post", "invoices:validate"],
    ["/invoices/export/ubl", "post", "invoices:export_ubl"],
    ["/invoices/parse/ubl", "post", "invoices:parse_ubl"],
    ["/xml/validation-jobs", "post", "xml:validation_jobs"],
    ["/xml/validation-jobs", "get", "xml:validation_jobs"],
    ["/vat/validate-format", "post", "vat:validate_format"],
    ["/vat/check-vies", "post", "vat:check_vies"],
    ["/transactions/simulate-vida", "post", "transactions:simulate_vida"],
    ["/validation/rules", "get", "rules:read"],
    ["/validation-runs", "get", "validation_runs:read"],
    ["/validation-runs/{id}", "get", "validation_runs:read"],
    ["/validation-runs/{id}/report.pdf", "get", "validation_runs:read"]
  ] as const;

  for (const [path, method, scope] of scopedOperations) {
    const operation = readOperation(paths, path, method);
    assert.equal(operation["x-required-scope"], scope);
    assert.match(JSON.stringify(operation), new RegExp(scope.replace(":", ":")));
  }

  const importUbl = readOperation(paths, "/invoices/import/ubl", "post");
  const importSecurity = JSON.stringify(importUbl.security);

  assert.equal(importUbl["x-required-scope"], undefined);
  assert.match(importSecurity, /SupabaseBearerAuth/);
  assert.doesNotMatch(importSecurity, /ApiKeyAuth/);
  assert.match(
    String(importUbl.description),
    /Organization API keys are intentionally rejected/
  );
  assert.match(String(importUbl.description), /reserved invoices:import_ubl/);
  assert.match(String(importUbl.description), /use POST \/invoices\/parse\/ubl/);

  for (const [path, method] of [
    ["/api-keys", "get"],
    ["/api-requests", "get"],
    ["/api-usage/current", "get"],
    ["/invoices/exports", "get"],
    ["/vat/checks", "get"],
    ["/xml/inspect", "post"],
    ["/xml/uploads", "get"],
    ["/validation-runs/{id}", "delete"]
  ] as const) {
    const operation = readOperation(paths, path, method);
    const security = JSON.stringify(operation.security);

    assert.match(security, /SupabaseBearerAuth/);
    assert.doesNotMatch(security, /ApiKeyAuth/);
  }
});

test("OpenAPI documents ViDA simulation endpoint, scope, schemas, and legal boundary", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const components = readRecord(document, "components");
  const schemas = readRecord(components, "schemas");

  const transactionsSimulateVida = readRecord(
    paths,
    "/transactions/simulate-vida"
  );
  const post = readRecord(transactionsSimulateVida, "post");
  const responses = readRecord(post, "responses");

  const apiKeyScopeSchema = readRecord(schemas, "ApiKeyScope");
  const apiKeyScopeEnum = apiKeyScopeSchema.enum;

  assert.equal(
    Array.isArray(apiKeyScopeEnum),
    true,
    "ApiKeyScope enum should be an array"
  );

  assert.ok(
    (apiKeyScopeEnum as unknown[]).includes("transactions:simulate_vida"),
    "ApiKeyScope enum should include transactions:simulate_vida"
  );

  for (const statusCode of ["200", "400", "401", "403", "429"]) {
    assert.ok(
      responses[statusCode],
      `Expected ViDA simulation response ${statusCode}`
    );
  }

  const requestSchema = JSON.stringify(
    readRecord(schemas, "VidaSimulationRequest")
  );
  const responseSchema = JSON.stringify(
    readRecord(schemas, "VidaSimulationResponse")
  );
  const countryContextSchema = JSON.stringify(
    readRecord(schemas, "VidaCountryContext")
  );
  const normalizedInputSchema = JSON.stringify(
    readRecord(schemas, "VidaNormalizedInput")
  );
  const findingSchema = JSON.stringify(
    readRecord(schemas, "VidaReadinessFinding")
  );
  const serializedPost = JSON.stringify(post);
  const serializedVidaSchemas = JSON.stringify({
    requestSchema,
    responseSchema,
    countryContextSchema,
    normalizedInputSchema,
    findingSchema
  });

  assert.match(serializedPost, /transactions:simulate_vida/);
  assert.match(serializedPost, /ViDA-readiness simulation/i);
  assert.match(serializedPost, /not official/i);
  assert.match(serializedPost, /not legal/i);
  assert.match(serializedPost, /not tax/i);
  assert.match(serializedPost, /not accounting/i);
  assert.match(serializedPost, /not.*compliance guarantee/i);
  assert.match(serializedPost, /workspace persistence/i);

  assert.match(requestSchema, /sellerCountry/);
  assert.match(requestSchema, /buyerCountry/);
  assert.match(requestSchema, /sellerVatId/);
  assert.match(requestSchema, /buyerVatId/);
  assert.match(requestSchema, /buyerType/);
  assert.match(requestSchema, /sellerType/);
  assert.match(requestSchema, /transactionType/);
  assert.match(requestSchema, /supplyScenario/);
  assert.match(requestSchema, /structuredInvoiceSignals/);
  assert.match(requestSchema, /vatEvidence/);
  assert.match(requestSchema, /countryPackContext/);
  assert.match(requestSchema, /countryPackVersions/);
  assert.match(requestSchema, /persist/);
  assert.match(requestSchema, /invoiceDraftId/);
  assert.match(requestSchema, /validationRunId/);
  assert.match(
    requestSchema,
    /Organization API-key requests can run the simulation but cannot persist workspace records/
  );
  assert.match(requestSchema, /business/);
  assert.match(requestSchema, /consumer/);
  assert.match(requestSchema, /public_authority/);
  assert.match(requestSchema, /goods/);
  assert.match(requestSchema, /services/);
  assert.match(requestSchema, /digital_service/);

  assert.match(responseSchema, /simulationVersion/);
  assert.match(responseSchema, /transactionClass/);
  assert.match(responseSchema, /vidaRelevance/);
  assert.match(responseSchema, /readinessScore/);
  assert.match(responseSchema, /readinessStatus/);
  assert.match(responseSchema, /effectiveDateContext/);
  assert.match(responseSchema, /timeline/);
  assert.match(responseSchema, /legalConfidence/);
  assert.match(responseSchema, /countryContext/);
  assert.match(responseSchema, /normalizedInput/);
  assert.match(responseSchema, /evidenceSummary/);
  assert.match(responseSchema, /findings/);
  assert.match(responseSchema, /recommendedNextActions/);
  assert.match(responseSchema, /sourceReferences/);
  assert.match(responseSchema, /disclaimer/);
  assert.match(responseSchema, /persisted/);
  assert.match(responseSchema, /simulationRunId/);
  assert.match(responseSchema, /simulationRun/);

  assert.match(countryContextSchema, /sellerInEu/);
  assert.match(countryContextSchema, /buyerInEu/);
  assert.match(countryContextSchema, /sameCountry/);
  assert.match(countryContextSchema, /crossBorderEu/);
  assert.match(countryContextSchema, /sellerCountryPackStatus/);
  assert.match(countryContextSchema, /buyerCountryPackStatus/);

  assert.match(normalizedInputSchema, /sellerCountryCode/);
  assert.match(normalizedInputSchema, /buyerCountryCode/);
  assert.match(normalizedInputSchema, /sellerVatCountryCode/);
  assert.match(normalizedInputSchema, /buyerVatCountryCode/);
  assert.match(normalizedInputSchema, /sellerVatId/);
  assert.match(normalizedInputSchema, /buyerVatId/);

  assert.match(findingSchema, /category/);
  assert.match(findingSchema, /sourceRefs/);
  assert.match(findingSchema, /evidenceStatus/);
  assert.match(findingSchema, /legalConfidence/);
  assert.match(findingSchema, /sourceLabels/);
  assert.match(findingSchema, /fixSuggestion/);

  assert.doesNotMatch(
    serializedPost + serializedVidaSchemas,
    /\bofficially valid\b|\bViDA compliant\b|\bcompliance certified\b|\bauthority accepted\b|\baccepted by authority\b|\blegal determination\b|\btax determination\b|\bproves compliance\b/i
  );
});

test("OpenAPI documents ViDA simulation history endpoints, schemas, and safe boundaries", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const components = readRecord(document, "components");
  const schemas = readRecord(components, "schemas");

  const simulateVidaPath = readRecord(paths, "/transactions/simulate-vida");
  const simulateVidaPost = readRecord(simulateVidaPath, "post");

  const historyPath = readRecord(paths, "/transactions/vida-simulations");
  const historyGet = readRecord(historyPath, "get");

  const detailPath = readRecord(paths, "/transactions/vida-simulations/{id}");
  const detailGet = readRecord(detailPath, "get");

  const vidaSimulationRequest = JSON.stringify(
    readRecord(schemas, "VidaSimulationRequest")
  );
  const vidaSimulationResponse = JSON.stringify(
    readRecord(schemas, "VidaSimulationResponse")
  );
  const vidaSimulationRunSummary = JSON.stringify(
    readRecord(schemas, "VidaSimulationRunSummary")
  );
  const vidaSimulationRunDetail = JSON.stringify(
    readRecord(schemas, "VidaSimulationRunDetail")
  );
  const vidaSimulationHistoryResponse = JSON.stringify(
    readRecord(schemas, "VidaSimulationHistoryResponse")
  );
  const vidaSimulationDetailResponse = JSON.stringify(
    readRecord(schemas, "VidaSimulationDetailResponse")
  );

  const serializedSimulation = JSON.stringify(simulateVidaPost);
  const serializedHistory = JSON.stringify(historyGet);
  const serializedDetail = JSON.stringify(detailGet);
  const serializedSchemas = JSON.stringify({
    vidaSimulationRequest,
    vidaSimulationResponse,
    vidaSimulationRunSummary,
    vidaSimulationRunDetail,
    vidaSimulationHistoryResponse,
    vidaSimulationDetailResponse
  });

  assert.match(serializedSimulation, /transactions:simulate_vida/);
  assert.match(serializedSimulation, /persist/);
  assert.match(serializedSimulation, /workspace persistence/i);
  assert.match(serializedSimulation, /not official/i);
  assert.match(serializedSimulation, /not legal advice/i);
  assert.match(serializedSimulation, /not tax advice/i);
  assert.match(serializedSimulation, /not accounting advice/i);
  assert.match(serializedSimulation, /not a compliance guarantee/i);

  assert.match(serializedHistory, /List saved ViDA simulation runs/i);
  assert.match(serializedHistory, /SupabaseBearerAuth/);
  assert.match(serializedHistory, /invoiceDraftId/);
  assert.match(serializedHistory, /validationRunId/);
  assert.match(serializedHistory, /vidaRelevance/);
  assert.match(serializedHistory, /transactionClass/);
  assert.match(serializedHistory, /limit/);
  assert.match(serializedHistory, /VidaSimulationHistoryResponse/);
  assert.match(serializedHistory, /not official/i);
  assert.match(serializedHistory, /not legal advice/i);
  assert.match(serializedHistory, /not tax advice/i);
  assert.match(serializedHistory, /not accounting advice/i);
  assert.match(serializedHistory, /not compliance guarantees/i);

  assert.match(serializedDetail, /Get saved ViDA simulation run detail/i);
  assert.match(serializedDetail, /SupabaseBearerAuth/);
  assert.match(serializedDetail, /VidaSimulationDetailResponse/);
  assert.match(serializedDetail, /sanitized input snapshot/i);
  assert.match(serializedDetail, /request metadata/i);
  assert.match(serializedDetail, /not official ViDA software/i);
  assert.match(serializedDetail, /not legal advice/i);
  assert.match(serializedDetail, /not tax advice/i);
  assert.match(serializedDetail, /not accounting advice/i);
  assert.match(serializedDetail, /not a compliance guarantee/i);

  assert.match(vidaSimulationRequest, /persist/);
  assert.match(vidaSimulationRequest, /invoiceDraftId/);
  assert.match(vidaSimulationRequest, /validationRunId/);
  assert.match(
    vidaSimulationRequest,
    /Organization API-key requests can run the simulation but cannot persist workspace records/
  );

  assert.match(vidaSimulationResponse, /persisted/);
  assert.match(vidaSimulationResponse, /simulationRunId/);
  assert.match(vidaSimulationResponse, /simulationRun/);
  assert.match(vidaSimulationResponse, /readinessScore/);
  assert.match(vidaSimulationResponse, /evidenceSummary/);
  assert.match(vidaSimulationResponse, /sourceReferences/);

  assert.match(vidaSimulationRunSummary, /organizationId/);
  assert.match(vidaSimulationRunSummary, /createdBy/);
  assert.match(vidaSimulationRunSummary, /apiKeyId/);
  assert.match(vidaSimulationRunSummary, /invoiceDraftId/);
  assert.match(vidaSimulationRunSummary, /validationRunId/);
  assert.match(vidaSimulationRunSummary, /simulationVersion/);
  assert.match(vidaSimulationRunSummary, /transactionClass/);
  assert.match(vidaSimulationRunSummary, /vidaRelevance/);
  assert.match(vidaSimulationRunSummary, /readinessScore/);
  assert.match(vidaSimulationRunSummary, /readinessStatus/);
  assert.match(vidaSimulationRunSummary, /legalConfidence/);
  assert.match(vidaSimulationRunSummary, /evidenceSummary/);
  assert.match(vidaSimulationRunSummary, /sourceReferences/);
  assert.match(vidaSimulationRunSummary, /findingCount/);
  assert.match(vidaSimulationRunSummary, /reviewRequiredCount/);
  assert.match(vidaSimulationRunSummary, /disclaimer/);

  assert.match(vidaSimulationRunDetail, /inputPayload/);
  assert.match(vidaSimulationRunDetail, /resultPayload/);
  assert.match(vidaSimulationRunDetail, /findings/);
  assert.match(vidaSimulationRunDetail, /sourceLabels/);
  assert.match(vidaSimulationRunDetail, /recommendedNextActions/);
  assert.match(vidaSimulationRunDetail, /requestMetadata/);
  assert.match(vidaSimulationRunDetail, /Raw XML, full API keys, key hashes/);
  assert.match(
    vidaSimulationRunDetail,
    /Request bodies, raw XML, full API keys, key hashes/
  );

  assert.match(vidaSimulationHistoryResponse, /records/);
  assert.match(vidaSimulationDetailResponse, /record/);

  assert.doesNotMatch(
    serializedSchemas,
    /\bViDA compliant\b|\bofficially valid\b|\bauthority accepted\b|\baccepted by authority\b|\bcompliance certified\b|\blegal determination\b/i
  );
});

test("OpenAPI documents active endpoints and leaves planned endpoints inactive", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);

  for (const path of [
    "/api-keys",
    "/api-keys/{id}/revoke",
    "/api-requests",
    "/api-requests/summary",
    "/api-usage/policies",
    "/api-usage/current",
    "/invoices",
    "/invoices/from-draft",
    "/invoices/{id}",
    "/invoices/{id}/export/ubl",
    "/invoices/{id}/simulate-vida",
    "/invoices/{id}/transition",
    "/invoices/{id}/lifecycle-events",
    "/invoices/validate",
    "/invoices/export/ubl",
    "/invoices/parse/ubl",
    "/invoices/import/ubl",
    "/invoices/exports",
    "/xml/validation-jobs",
    "/xml/validation-jobs/{id}",
    "/xml/uploads",
    "/xml/uploads/{id}",
    "/xml/inspect",
    "/vat/validate-format",
    "/vat/check-vies",
    "/vat/checks",
    "/country-packs",
    "/country-packs/{countryCode}",
    "/transactions/simulate-vida",
    "/transactions/vida-simulations",
    "/transactions/vida-simulations/{id}",
    "/validation/rules",
    "/validation-runs",
    "/validation-runs/{id}",
    "/validation-runs/{id}/report.pdf"
  ]) {
    assert.ok(paths[path], `Expected active path ${path}`);
  }

  const documentedPathNames = Object.keys(paths).join("\n").toLowerCase();
  const importUblPath = JSON.stringify(readRecord(paths, "/invoices/import/ubl"));

  assert.match(importUblPath, /Organization API keys are intentionally rejected/);
  assert.match(documentedPathNames, /\/vat\/check-vies/);
  assert.doesNotMatch(documentedPathNames, /webhook/);
});

test("OpenAPI documents VIES evidence as explicit and legally cautious", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const components = readRecord(document, "components");
  const schemas = readRecord(components, "schemas");
  const apiKeyScopeSchema = readRecord(schemas, "ApiKeyScope");
  const apiKeyScopeEnum = apiKeyScopeSchema.enum;
  const viesPath = JSON.stringify(readRecord(paths, "/vat/check-vies"));
  const viesResponse = JSON.stringify(readRecord(schemas, "ViesCheckResponse"));
  const findingSchema = JSON.stringify(readRecord(schemas, "ValidationFinding"));

  assert.equal(Array.isArray(apiKeyScopeEnum), true);
  assert.ok((apiKeyScopeEnum as unknown[]).includes("vat:check_vies"));
  assert.match(viesPath, /VIES time-of-check evidence/i);
  assert.match(viesPath, /VIES unavailable is not invalid/i);
  assert.match(viesResponse, /Format valid is not VIES valid/i);
  assert.match(findingSchema, /legalConfidence/);
  assert.match(findingSchema, /sourceReferences/);
  assert.match(findingSchema, /ruleVersion/);
});

test("OpenAPI documents production invoice lifecycle endpoints and safe boundaries", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const components = readRecord(document, "components");
  const schemas = readRecord(components, "schemas");
  const invoiceList = JSON.stringify(readRecord(paths, "/invoices"));
  const fromDraft = JSON.stringify(readRecord(paths, "/invoices/from-draft"));
  const invoiceDetail = JSON.stringify(readRecord(paths, "/invoices/{id}"));
  const productionUblExport = JSON.stringify(
    readRecord(paths, "/invoices/{id}/export/ubl")
  );
  const invoiceVidaSimulation = JSON.stringify(
    readRecord(paths, "/invoices/{id}/simulate-vida")
  );
  const transition = JSON.stringify(
    readRecord(paths, "/invoices/{id}/transition")
  );
  const lifecycleEvents = JSON.stringify(
    readRecord(paths, "/invoices/{id}/lifecycle-events")
  );
  const productionInvoice = JSON.stringify(
    readRecord(schemas, "ProductionInvoice")
  );
  const canonicalInvoice = JSON.stringify(readRecord(schemas, "CanonicalInvoice"));
  const lifecycleStatus = JSON.stringify(
    readRecord(schemas, "InvoiceLifecycleStatus")
  );
  const validationSummary = JSON.stringify(
    readRecord(schemas, "ProductionInvoiceValidationSummary")
  );
  const invoiceTotals = JSON.stringify(readRecord(schemas, "InvoiceTotals"));
  const eventSchema = JSON.stringify(
    readRecord(schemas, "ProductionInvoiceLifecycleEvent")
  );
  const serialized = JSON.stringify({
    invoiceList,
    fromDraft,
    invoiceDetail,
    productionUblExport,
    invoiceVidaSimulation,
    transition,
    lifecycleEvents,
    productionInvoice,
    canonicalInvoice,
    invoiceTotals,
    lifecycleStatus,
    validationSummary,
    eventSchema
  });

  assert.match(invoiceList, /SupabaseBearerAuth/);
  assert.match(invoiceList, /tenant-scoped/i);
  assert.match(fromDraft, /without deleting the draft/i);
  assert.match(invoiceDetail, /organization id/i);
  assert.match(productionUblExport, /technical UBL 2\.1 export/i);
  assert.match(productionUblExport, /safe invoice_exports metadata/i);
  assert.match(productionUblExport, /not Peppol-certified/i);
  assert.match(invoiceVidaSimulation, /ViDA-readiness simulation/i);
  assert.match(invoiceVidaSimulation, /does not change invoice lifecycle status/i);
  assert.match(invoiceVidaSimulation, /not official filing/i);
  assert.match(invoiceVidaSimulation, /not.*compliance guarantee/i);
  assert.match(transition, /internal workspace state only/i);
  assert.match(transition, /not official filing/i);
  assert.match(transition, /not.*authority acceptance/i);
  assert.match(lifecycleEvents, /lifecycle history/i);
  assert.match(lifecycleStatus, /issued/);
  assert.match(lifecycleStatus, /internal only/i);
  assert.match(productionInvoice, /canonicalInvoice/);
  assert.match(productionInvoice, /calculationSummary/);
  assert.match(productionInvoice, /validationSummary/);
  assert.match(productionInvoice, /issuedAt/);
  assert.match(canonicalInvoice, /taxBreakdown/);
  assert.match(invoiceTotals, /taxTotalAmount/);
  assert.match(canonicalInvoice, /allowances/);
  assert.match(canonicalInvoice, /charges/);
  assert.match(canonicalInvoice, /additionalProperties/);
  assert.match(validationSummary, /not legal, tax, accounting/i);
  assert.match(eventSchema, /raw XML, full invoice bodies, secrets, or API keys/);
  assert.doesNotMatch(
    serialized,
    /\bauthority-submitted\b|\bPeppol-delivered\b|\blegally accepted\b|\bguaranteed compliant\b|\bofficially filed\b/i
  );
});

test("OpenAPI documents XML validation jobs with UBL XSD as configuration-gated", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const xmlValidationJobs = readRecord(paths, "/xml/validation-jobs");
  const post = readRecord(xmlValidationJobs, "post");
  const responses = readRecord(post, "responses");
  const components = readRecord(document, "components");
  const schemas = readRecord(components, "schemas");
  const createRequest = JSON.stringify(
    readRecord(schemas, "XmlValidationJobCreateRequest")
  );
  const artifactInfoSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobArtifactInfo")
  );
  const schemaArtifactSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchemaArtifact")
  );
  const dependencyGraphSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobDependencyGraph")
  );
  const schematronDiagnosticsSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronArtifactDiagnostics")
  );
  const schematronArtifactProvenanceSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronArtifactProvenance")
  );
  const schematronArtifactManifestVerificationSchema = JSON.stringify(
    readRecord(
      schemas,
      "XmlValidationJobSchematronArtifactManifestVerification"
    )
  );
  const schematronPreflightSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronExecutionPreflight")
  );
  const schematronPolicySchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronExecutionPolicy")
  );
  const schematronEngineCandidateSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronEngineCandidate")
  );
  const schematronXPathEngineSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronXPathEngineFoundation")
  );
  const schematronResultMapperSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronResultMappingContract")
  );
  const peppolBisExecutionPathSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobPeppolBisExecutionPathFoundation")
  );
  const en16931ExecutionPathSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobEn16931ExecutionPathFoundation")
  );
  const schematronExecutionOrchestratorSchema = JSON.stringify(
    readRecord(
      schemas,
      "XmlValidationJobSchematronExecutionOrchestratorFoundation"
    )
  );
  const xmlWorkerSchematronOrchestrationSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobXmlWorkerSchematronOrchestration")
  );
  const schematronArtifactSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronArtifactFileDiagnostics")
  );
  const findingSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobFinding")
  );
  const xmlValidationJobSchema = readRecord(schemas, "XmlValidationJob");
  const jobResultSummaryExample =
    JSON.stringify(
      readRecord(
        readRecord(xmlValidationJobSchema, "properties"),
        "resultSummary"
      ).example
    ) ?? "";
  const jobSchema = JSON.stringify(xmlValidationJobSchema);
  const serializedPost = JSON.stringify(post);

  assert.ok(responses["200"], "Expected XML validation job success response");
  assert.match(serializedPost, /xsd_ubl/);
  assert.match(serializedPost, /not_configured/i);
  assert.match(
    serializedPost,
    /passed or failed only after real local XSD validation executes/i
  );
  assert.match(
    serializedPost,
    /fatal\/error findings/i
  );
  assert.match(serializedPost, /local XSD artifacts/i);
  assert.match(serializedPost, /guarded local Schematron execution/i);
  assert.match(serializedPost, /schematron_peppol/);
  assert.match(serializedPost, /schematron_en16931/);
  assert.match(serializedPost, /SCHEMATRON_EXECUTION_MODE=execute/);
  assert.match(serializedPost, /SCHEMATRON_ENGINE=xpath_engine/);
  assert.match(serializedPost, /SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION/);
  assert.match(serializedPost, /reviewed local artifacts/i);
  assert.match(serializedPost, /PEPPOL_SCHEMATRON_ROOT_DIR/);
  assert.match(serializedPost, /PEPPOL_BIS_SCHEMATRON_PATH/);
  assert.match(serializedPost, /EN16931_SCHEMATRON_PATH/);
  assert.match(serializedPost, /SCHEMATRON_ARTIFACT_VERSION/);
  assert.match(serializedPost, /performs no remote fetching/i);
  assert.match(serializedPost, /unsupported Schematron\/XPath constructs/i);
  assert.match(serializedPost, /sanitized findings/i);
  assert.match(
    serializedPost,
    /markedValid=true means only the configured technical Schematron check/i
  );
  assert.match(serializedPost, /certification/i);
  assert.match(serializedPost, /authority acceptance/i);
  assert.match(
    serializedPost,
    /legal\/tax\/accounting guarantees/i
  );
  assert.match(createRequest, /"xsd_ubl"/);
  assert.doesNotMatch(createRequest, /xsd_ubl_placeholder/);
  assert.match(artifactInfoSchema, /validatorName/);
  assert.match(artifactInfoSchema, /validatorAvailable/);
  assert.match(artifactInfoSchema, /artifactVersion/);
  assert.match(artifactInfoSchema, /invoiceXsdPath/);
  assert.match(artifactInfoSchema, /creditNoteXsdPath/);
  assert.match(artifactInfoSchema, /invoiceSchema/);
  assert.match(artifactInfoSchema, /creditNoteSchema/);
  assert.match(schemaArtifactSchema, /sha256/);
  assert.match(schemaArtifactSchema, /available/);
  assert.match(schemaArtifactSchema, /missing/);
  assert.match(schemaArtifactSchema, /unreadable/);
  assert.match(schemaArtifactSchema, /out_of_root/);
  assert.match(artifactInfoSchema, /dependencyGraph/);
  assert.match(dependencyGraphSchema, /dependencyCount/);
  assert.match(dependencyGraphSchema, /external_reference_blocked/);
  assert.match(artifactInfoSchema, /checkedAt/);
  assert.match(schematronDiagnosticsSchema, /schematron_artifacts/);
  assert.match(schematronDiagnosticsSchema, /validationExecutionEnabled/);
  assert.match(schematronDiagnosticsSchema, /validatorAvailable/);
  assert.match(schematronDiagnosticsSchema, /readyArtifactCount/);
  assert.match(schematronDiagnosticsSchema, /peppolBisArtifact/);
  assert.match(schematronDiagnosticsSchema, /en16931Artifact/);
  assert.match(schematronDiagnosticsSchema, /sourceRegisterVersion/);
  assert.match(schematronDiagnosticsSchema, /sourceRegisterSummary/);
  assert.match(
    schematronDiagnosticsSchema,
    /schematron_artifact_source_register_v1/
  );
  assert.match(schematronDiagnosticsSchema, /artifactManifestVersion/);
  assert.match(schematronDiagnosticsSchema, /artifactManifestSummary/);
  assert.match(
    schematronDiagnosticsSchema,
    /schematron_artifact_manifest_v1/
  );
  assert.match(schematronArtifactProvenanceSchema, /artifactSlotId/);
  assert.match(schematronArtifactProvenanceSchema, /reviewStatus/);
  assert.match(schematronArtifactProvenanceSchema, /configuredEnvVars/);
  assert.match(schematronArtifactProvenanceSchema, /expectedSha256/);
  assert.match(schematronArtifactProvenanceSchema, /safeLabel/);
  assert.match(schematronArtifactProvenanceSchema, /rawXmlReturned/);
  assert.match(
    schematronArtifactProvenanceSchema,
    /schematronFileContentsReturned/
  );
  assert.match(
    schematronArtifactProvenanceSchema,
    /fullAbsoluteLocalPathsReturned/
  );
  assert.match(schematronArtifactProvenanceSchema, /remoteFetching/);
  assert.match(
    schematronArtifactManifestVerificationSchema,
    /schematron_artifact_manifest_v1/
  );
  assert.match(schematronArtifactManifestVerificationSchema, /hashStatus/);
  assert.match(schematronArtifactManifestVerificationSchema, /matched/);
  assert.match(schematronArtifactManifestVerificationSchema, /mismatched/);
  assert.match(
    schematronArtifactManifestVerificationSchema,
    /expected_hash_missing/
  );
  assert.match(
    schematronArtifactManifestVerificationSchema,
    /actual_hash_missing/
  );
  assert.match(
    schematronArtifactManifestVerificationSchema,
    /local_hash_matched/
  );
  assert.match(
    schematronArtifactManifestVerificationSchema,
    /local_hash_mismatched/
  );
  assert.match(schematronArtifactManifestVerificationSchema, /artifactExecuted/);
  assert.match(
    schematronArtifactManifestVerificationSchema,
    /artifactDownloaded/
  );
  assert.match(
    schematronArtifactManifestVerificationSchema,
    /hash match is not validation success/i
  );
  assert.match(schematronPreflightSchema, /schematron_execution_preflight/);
  assert.match(schematronPreflightSchema, /schematron_adapter_preflight_v1/);
  assert.match(schematronPreflightSchema, /preflight_only/);
  assert.match(schematronPreflightSchema, /ready_for_future_execution/);
  assert.match(schematronPreflightSchema, /unsupported/);
  assert.match(schematronPreflightSchema, /schematron_execution_disabled/);
  assert.match(
    schematronPreflightSchema,
    /schematron_execution_engine_not_implemented/
  );
  assert.match(schematronPreflightSchema, /does not execute validation/);
  assert.match(schematronPolicySchema, /schematron_execution_policy/);
  assert.match(schematronPolicySchema, /schematron_policy_v1/);
  assert.match(schematronPolicySchema, /disabled/);
  assert.match(schematronPolicySchema, /preflight_only/);
  assert.match(schematronPolicySchema, /execute/);
  assert.match(schematronPolicySchema, /blocked_requested_execution/);
  assert.match(schematronPolicySchema, /none/);
  assert.match(schematronPolicySchema, /placeholder/);
  assert.match(schematronPolicySchema, /future_xslt2/);
  assert.match(schematronPolicySchema, /future_schxslt/);
  assert.match(schematronPolicySchema, /xpath_engine/);
  assert.match(schematronPolicySchema, /internal_test_candidate/);
  assert.match(schematronPolicySchema, /unknown/);
  assert.match(schematronPolicySchema, /executionPermitted/);
  assert.match(schematronPolicySchema, /validationExecutionEnabled/);
  assert.match(schematronPolicySchema, /schematron_execution_preflight_only/);
  assert.match(
    schematronPolicySchema,
    /schematron_execution_disabled_by_policy/
  );
  assert.match(
    schematronPolicySchema,
    /schematron_execution_requested_but_blocked/
  );
  assert.match(
    schematronPolicySchema,
    /schematron_experimental_execution_not_available/
  );
  assert.match(
    schematronPolicySchema,
    /schematron_execution_requires_xpath_engine/
  );
  assert.match(
    schematronPolicySchema,
    /schematron_execution_requires_explicit_experimental_allow/
  );
  assert.match(
    schematronPolicySchema,
    /schematron_execution_explicitly_permitted/
  );
  assert.match(schematronPolicySchema, /SCHEMATRON_EXECUTION_MODE/);
  assert.match(schematronPolicySchema, /SCHEMATRON_ENGINE/);
  assert.match(
    schematronPolicySchema,
    /SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION/
  );
  assert.match(schematronPolicySchema, /reviewed local artifacts/);
  assert.match(schematronPolicySchema, /supported constructs/);
  assert.match(schematronEngineCandidateSchema, /schematron_engine_candidate/);
  assert.match(schematronEngineCandidateSchema, /schematron_engine_candidate_v1/);
  assert.match(schematronEngineCandidateSchema, /engineCandidateVersion/);
  assert.match(schematronEngineCandidateSchema, /availabilityStatus/);
  assert.match(schematronEngineCandidateSchema, /executionSupported/);
  assert.match(schematronEngineCandidateSchema, /executionEnabledByDefault/);
  assert.match(schematronEngineCandidateSchema, /packageName/);
  assert.match(schematronEngineCandidateSchema, /packageVersion/);
  assert.match(schematronEngineCandidateSchema, /none/);
  assert.match(schematronEngineCandidateSchema, /placeholder/);
  assert.match(schematronEngineCandidateSchema, /future_xslt2/);
  assert.match(schematronEngineCandidateSchema, /future_schxslt/);
  assert.match(schematronEngineCandidateSchema, /xpath_engine/);
  assert.match(schematronEngineCandidateSchema, /internal_test_candidate/);
  assert.match(schematronEngineCandidateSchema, /not_selected/);
  assert.match(schematronEngineCandidateSchema, /placeholder_only/);
  assert.match(schematronEngineCandidateSchema, /available/);
  assert.match(schematronEngineCandidateSchema, /unavailable/);
  assert.match(schematronEngineCandidateSchema, /unsupported/);
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_xslt2_engine_not_installed/
  );
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_schxslt_engine_not_installed/
  );
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_internal_test_candidate_available/
  );
  assert.match(schematronEngineCandidateSchema, /fontoxpath/);
  assert.match(schematronEngineCandidateSchema, /slimdom/);
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_xpath_fontoxpath_not_installed/
  );
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_xpath_slimdom_not_installed/
  );
  assert.match(
    schematronEngineCandidateSchema,
    /schematron_xpath_engine_candidate_available_execution_disabled_by_default/
  );
  assert.match(schematronEngineCandidateSchema, /xml_dom_execution/);
  assert.match(schematronEngineCandidateSchema, /xpath_assertion_execution/);
  assert.match(schematronEngineCandidateSchema, /schematron_xpath_engine_v1/);
  assert.match(schematronEngineCandidateSchema, /xpath_assertion_execution/);
  assert.match(schematronXPathEngineSchema, /schematron_xpath_engine_v1/);
  assert.match(schematronXPathEngineSchema, /xpath_engine/);
  assert.match(schematronXPathEngineSchema, /guarded local technical execution/);
  assert.match(
    schematronXPathEngineSchema,
    /supported XPath gates/
  );
  assert.match(schematronXPathEngineSchema, /guarded API\/worker artifact executor/);
  assert.match(schematronXPathEngineSchema, /not official validation/);
  assert.match(schematronXPathEngineSchema, /no Peppol certification/);
  assert.match(schematronXPathEngineSchema, /no EN 16931 compliance guarantee/);
  assert.match(
    schematronXPathEngineSchema,
    /no legal\/tax\/accounting compliance guarantee/
  );
  assert.match(schematronXPathEngineSchema, /no authority acceptance/);
  assert.match(schematronXPathEngineSchema, /rawXmlReturned/);
  assert.match(schematronXPathEngineSchema, /schematronFileContentsReturned/);
  assert.match(schematronXPathEngineSchema, /fullAbsoluteLocalPathsReturned/);
  assert.match(schematronXPathEngineSchema, /remoteFetching/);
  assert.match(schematronXPathEngineSchema, /extensionFunctions/);
  assert.match(schematronXPathEngineSchema, /normalWorkerExecutionEnabled/);
  assert.match(schematronResultMapperSchema, /schematron_result_mapper_v1/);
  assert.match(schematronResultMapperSchema, /schematron_result_mapping/);
  assert.match(schematronResultMapperSchema, /normalJobExecutionEnabled/);
  assert.match(schematronResultMapperSchema, /validationExecuted/);
  assert.match(schematronResultMapperSchema, /SCHEMATRON_ASSERTION_FAILED/);
  assert.match(schematronResultMapperSchema, /SCHEMATRON_REPORT_WARNING/);
  assert.match(schematronResultMapperSchema, /PEPPOL_SCHEMATRON_RULE_FAILED/);
  assert.match(schematronResultMapperSchema, /EN16931_SCHEMATRON_RULE_FAILED/);
  assert.match(schematronResultMapperSchema, /ruleId/);
  assert.match(schematronResultMapperSchema, /businessRuleId/);
  assert.match(schematronResultMapperSchema, /schematronLayer/);
  assert.match(schematronResultMapperSchema, /ruleLocation/);
  assert.match(schematronResultMapperSchema, /testExpression/);
  assert.match(schematronResultMapperSchema, /assertionText/);
  assert.match(schematronResultMapperSchema, /diagnosticReference/);
  assert.match(schematronResultMapperSchema, /rawXmlReturned/);
  assert.match(schematronResultMapperSchema, /schematronFileContentsReturned/);
  assert.match(schematronResultMapperSchema, /fullAbsoluteLocalPathsReturned/);
  assert.match(schematronResultMapperSchema, /remoteFetching/);
  assert.match(
    schematronResultMapperSchema,
    /guarded local Schematron execution/
  );
  assert.match(peppolBisExecutionPathSchema, /peppol_bis_execution_path_v1/);
  assert.match(peppolBisExecutionPathSchema, /peppol_bis_billing/);
  assert.match(peppolBisExecutionPathSchema, /normalJobExecutionEnabled/);
  assert.match(peppolBisExecutionPathSchema, /normalJobValidationExecuted/);
  assert.match(peppolBisExecutionPathSchema, /internal_test_only/);
  assert.match(peppolBisExecutionPathSchema, /blocked_by_policy/);
  assert.match(peppolBisExecutionPathSchema, /engine_unavailable/);
  assert.match(peppolBisExecutionPathSchema, /ready_for_future_execution/);
  assert.match(peppolBisExecutionPathSchema, /unsafe_input/);
  assert.match(peppolBisExecutionPathSchema, /PEPPOL_SCHEMATRON_RULE_FAILED/);
  assert.match(peppolBisExecutionPathSchema, /SCHEMATRON_REPORT_WARNING/);
  assert.match(peppolBisExecutionPathSchema, /rawXmlReturned/);
  assert.match(peppolBisExecutionPathSchema, /schematronFileContentsReturned/);
  assert.match(peppolBisExecutionPathSchema, /fullAbsoluteLocalPathsReturned/);
  assert.match(peppolBisExecutionPathSchema, /remoteFetching/);
  assert.match(peppolBisExecutionPathSchema, /javaOrSystemDependencyRequired/);
  assert.match(peppolBisExecutionPathSchema, /normalApiWorkerExecutionEnabled/);
  assert.match(en16931ExecutionPathSchema, /en16931_execution_path_v1/);
  assert.match(en16931ExecutionPathSchema, /en16931_tc434/);
  assert.match(en16931ExecutionPathSchema, /normalJobExecutionEnabled/);
  assert.match(en16931ExecutionPathSchema, /normalJobValidationExecuted/);
  assert.match(en16931ExecutionPathSchema, /internal_test_only/);
  assert.match(en16931ExecutionPathSchema, /blocked_by_policy/);
  assert.match(en16931ExecutionPathSchema, /engine_unavailable/);
  assert.match(en16931ExecutionPathSchema, /ready_for_future_execution/);
  assert.match(en16931ExecutionPathSchema, /unsafe_input/);
  assert.match(en16931ExecutionPathSchema, /EN16931_SCHEMATRON_RULE_FAILED/);
  assert.match(en16931ExecutionPathSchema, /SCHEMATRON_REPORT_WARNING/);
  assert.match(en16931ExecutionPathSchema, /rawXmlReturned/);
  assert.match(en16931ExecutionPathSchema, /schematronFileContentsReturned/);
  assert.match(en16931ExecutionPathSchema, /fullAbsoluteLocalPathsReturned/);
  assert.match(en16931ExecutionPathSchema, /remoteFetching/);
  assert.match(en16931ExecutionPathSchema, /javaOrSystemDependencyRequired/);
  assert.match(en16931ExecutionPathSchema, /normalApiWorkerExecutionEnabled/);
  assert.match(
    schematronExecutionOrchestratorSchema,
    /schematron_execution_orchestrator_v1/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /schematron_execution_orchestrator/
  );
  assert.match(schematronExecutionOrchestratorSchema, /peppol_bis_billing/);
  assert.match(schematronExecutionOrchestratorSchema, /en16931_tc434/);
  assert.match(
    schematronExecutionOrchestratorSchema,
    /normalJobExecutionEnabled/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /normalJobValidationExecuted/
  );
  assert.match(schematronExecutionOrchestratorSchema, /internal_test_only/);
  assert.match(schematronExecutionOrchestratorSchema, /layerSummaryFields/);
  assert.match(schematronExecutionOrchestratorSchema, /findingCount/);
  assert.match(schematronExecutionOrchestratorSchema, /fatalCount/);
  assert.match(schematronExecutionOrchestratorSchema, /warningCount/);
  assert.match(schematronExecutionOrchestratorSchema, /infoCount/);
  assert.match(schematronExecutionOrchestratorSchema, /partial/);
  assert.match(
    schematronExecutionOrchestratorSchema,
    /PEPPOL_SCHEMATRON_RULE_FAILED/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /EN16931_SCHEMATRON_RULE_FAILED/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /SCHEMATRON_REPORT_WARNING/
  );
  assert.match(schematronExecutionOrchestratorSchema, /rawXmlReturned/);
  assert.match(
    schematronExecutionOrchestratorSchema,
    /schematronFileContentsReturned/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /fullAbsoluteLocalPathsReturned/
  );
  assert.match(schematronExecutionOrchestratorSchema, /remoteFetching/);
  assert.match(
    schematronExecutionOrchestratorSchema,
    /javaOrSystemDependencyRequired/
  );
  assert.match(
    schematronExecutionOrchestratorSchema,
    /normalApiWorkerExecutionEnabled/
  );
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /xml_worker_schematron_orchestrator_v1/
  );
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /xml_worker_schematron_orchestration/
  );
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /schematron_execution_orchestrator_v1/
  );
  assert.match(xmlWorkerSchematronOrchestrationSchema, /preflight_only/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /execute/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /internal_test_only/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /guarded local execution/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /unsafe_input/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /engine_unavailable/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /findingCount/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /fatalCount/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /warningCount/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /infoCount/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /selectedLayers/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /layerSummaries/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /not official validation/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /raw XML/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /Schematron file contents/);
  assert.match(
    xmlWorkerSchematronOrchestrationSchema,
    /full absolute local filesystem paths/
  );
  assert.match(xmlWorkerSchematronOrchestrationSchema, /remote fetch/);
  assert.match(xmlWorkerSchematronOrchestrationSchema, /Java\/system dependency/);
  assert.match(schematronArtifactSchema, /relativePathUnderRoot/);
  assert.match(schematronArtifactSchema, /basename/);
  assert.match(schematronArtifactSchema, /sha256/);
  assert.match(schematronArtifactSchema, /artifactProvenance/);
  assert.match(schematronArtifactSchema, /manifestVerification/);
  assert.match(schematronArtifactSchema, /manifestHashStatus/);
  assert.match(schematronArtifactSchema, /expectedSha256Recorded/);
  assert.match(schematronArtifactSchema, /actualSha256Recorded/);
  assert.match(schematronArtifactSchema, /sourceLabels/);
  assert.match(schematronArtifactSchema, /documentationUrls/);
  assert.match(schematronArtifactSchema, /provenanceDisclaimer/);
  assert.match(schematronArtifactSchema, /full absolute local filesystem paths/);
  assert.match(findingSchema, /not_configured/);
  assert.match(findingSchema, /passed/);
  assert.match(findingSchema, /failed/);
  assert.match(findingSchema, /error/);
  assert.match(findingSchema, /not_implemented/);
  assert.match(findingSchema, /unsupported/);
  assert.match(findingSchema, /unsafe_input/);
  assert.match(findingSchema, /preflight_only/);
  assert.match(findingSchema, /technicalMessage/);
  assert.match(findingSchema, /technicalCode/);
  assert.match(findingSchema, /xmlLine/);
  assert.match(findingSchema, /schematronLayer/);
  assert.match(findingSchema, /ruleId/);
  assert.match(findingSchema, /businessRuleId/);
  assert.match(findingSchema, /ruleLocation/);
  assert.match(findingSchema, /testExpression/);
  assert.match(findingSchema, /assertionText/);
  assert.match(findingSchema, /diagnosticReference/);
  assert.match(findingSchema, /SCHEMATRON_EXECUTION_NOT_ENABLED/);
  assert.match(findingSchema, /SCHEMATRON_ASSERTION_FAILED/);
  assert.match(findingSchema, /SCHEMATRON_REPORT_WARNING/);
  assert.match(findingSchema, /PEPPOL_SCHEMATRON_RULE_FAILED/);
  assert.match(findingSchema, /EN16931_SCHEMATRON_RULE_FAILED/);
  assert.match(findingSchema, /schematron_result_mapper_v1/);
  assert.match(findingSchema, /guarded local Schematron execution/);
  assert.match(findingSchema, /never contain raw XML/);
  assert.match(findingSchema, /PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED/);
  assert.match(jobSchema, /xsd_ubl/);
  assert.match(jobSchema, /artifactInfo/);
  assert.match(jobSchema, /schematron_artifacts/);
  assert.match(jobSchema, /schematron_artifact_source_register_v1/);
  assert.match(jobSchema, /schematron_artifact_manifest_v1/);
  assert.match(jobSchema, /manifestVerification/);
  assert.match(jobSchema, /validationExecutionEnabled/);
  assert.match(jobSchema, /adapterVersion/);
  assert.match(jobSchema, /executionPreflight/);
  assert.match(jobSchema, /executionPolicy/);
  assert.match(jobSchema, /engineCandidate/);
  assert.match(jobSchema, /preflightStatus/);
  assert.match(jobSchema, /preflightReason/);
  assert.match(jobSchema, /policyVersion/);
  assert.match(jobSchema, /policyMode/);
  assert.match(jobSchema, /policyReason/);
  assert.match(jobSchema, /engineId/);
  assert.match(jobSchema, /engineCandidateVersion/);
  assert.match(jobSchema, /engineAvailabilityStatus/);
  assert.match(jobSchema, /engineExecutionSupported/);
  assert.match(jobSchema, /schematronOrchestration/);
  assert.match(jobSchema, /workerSchematronOrchestratorVersion/);
  assert.match(jobSchema, /orchestrationMode/);
  assert.match(jobSchema, /orchestrationStatus/);
  assert.match(jobSchema, /orchestrationReason/);
  assert.match(jobSchema, /selectedLayers/);
  assert.match(jobSchema, /layerSummaries/);
  assert.match(jobSchema, /executionPermitted/);
  assert.match(jobSchema, /findingContractVersion/);
  assert.match(jobSchema, /schematron_contract_v1/);
  assert.match(jobSchema, /supportedFutureFindingCodes/);
  assert.match(findingSchema, /schematronLayer/);
  assert.match(findingSchema, /ruleId/);
  assert.match(findingSchema, /businessRuleId/);
  assert.doesNotMatch(jobSchema, /xsd_ubl_placeholder/);
  assert.doesNotMatch(
    serializedPost,
    /\bSchematron passed\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bauthority accepted\b|\baccepted by authority\b|\bproves compliance\b|\bproves Peppol\b|\bproves EN 16931\b/i
  );
  assert.doesNotMatch(
    jobResultSummaryExample,
    /\bSchematron passed\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bauthority accepted\b|\baccepted by authority\b|\bproves compliance\b|\bproves Peppol\b|\bproves EN 16931\b|\bPeppol passed\b|\bEN 16931 passed\b/i
  );
});

test("OpenAPI reflects the current core validation rule version", () => {
  const serialized = JSON.stringify(openApiDocument);

  assert.match(serialized, /2026\.05\.1/);
  assert.doesNotMatch(serialized, /2026\.04\.1/);
});

test("OpenAPI includes common errors and rate-limit headers", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const invoiceValidate = readRecord(paths, "/invoices/validate");
  const post = readRecord(invoiceValidate, "post");
  const responses = readRecord(post, "responses");

  for (const statusCode of ["400", "401", "403", "404", "429", "500"]) {
    assert.ok(responses[statusCode], `Expected response ${statusCode}`);
  }

  const serialized = JSON.stringify(openApiDocument);

  assert.match(serialized, /X-RateLimit-Limit/);
  assert.match(serialized, /X-RateLimit-Remaining/);
  assert.match(serialized, /X-RateLimit-Reset/);
  assert.match(serialized, /Retry-After/);
  assert.match(serialized, /RATE_LIMIT_EXCEEDED/);
  assert.match(serialized, /INSUFFICIENT_SCOPE/);
  assert.match(serialized, /xml:validation_jobs/);
  assert.match(serialized, /configuration-gated local UBL XSD validation/);
  assert.match(serialized, /not_configured/);
  assert.match(
    serialized,
    /does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance/
  );
});

test("OpenAPI avoids sensitive key fields and only documents one-time create secret", () => {
  const document = getOpenApiDocument(openApiDocument);
  const paths = getPaths(document);
  const apiKeys = readRecord(paths, "/api-keys");
  const listApiKeys = JSON.stringify(readRecord(apiKeys, "get"));
  const createApiKey = JSON.stringify(readRecord(apiKeys, "post"));
  const serialized = JSON.stringify(openApiDocument);

  assert.equal(listApiKeys.includes("\"secret\""), false);
  assert.equal(createApiKey.includes("\"secret\""), true);
  assert.doesNotMatch(serialized, /key_hash/i);
  assert.doesNotMatch(serialized, /keyHash/);
  assert.doesNotMatch(serialized, /API_KEY_HASH_SECRET/);
  assert.doesNotMatch(serialized, /INVOICE_LANTERN_DEV_API_KEY/);
  assert.doesNotMatch(serialized, /DEV_API_KEY/);
});

test("OpenAPI keeps public examples legal-safe and Invoice Lantern branded", () => {
  const serialized = JSON.stringify(openApiDocument);

  assert.match(serialized, /Invoice Lantern Developer API/);
  assert.match(serialized, /il_test_your_key_here/);
  assert.match(serialized, /non-official/i);
  assert.match(serialized, /professional review/i);
  assert.doesNotMatch(serialized, /FiscalForge/i);
  assert.doesNotMatch(
    serialized,
    /\bViDA compliant\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bauthority accepted\b|\baccepted by authority\b|\bofficial filing software\b|\bproves compliance\b/i
  );
});
