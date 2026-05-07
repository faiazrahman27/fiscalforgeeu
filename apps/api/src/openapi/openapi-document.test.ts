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
    "/invoices/validate",
    "/invoices/export/ubl",
    "/invoices/parse/ubl",
    "/xml/validation-jobs",
    "/xml/validation-jobs/{id}",
    "/vat/validate-format",
    "/validation/rules",
    "/validation-runs/{id}",
    "/validation-runs/{id}/report.pdf"
  ]) {
    assert.ok(paths[path], `Expected active path ${path}`);
  }

  const documentedPathNames = Object.keys(paths).join("\n").toLowerCase();

  assert.equal(paths["/invoices/import/ubl"], undefined);
  assert.doesNotMatch(documentedPathNames, /vies/);
  assert.doesNotMatch(documentedPathNames, /webhook/);
  assert.doesNotMatch(documentedPathNames, /country/);
  assert.doesNotMatch(documentedPathNames, /vida/);
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
  const schematronPreflightSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronExecutionPreflight")
  );
  const schematronArtifactSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobSchematronArtifactFileDiagnostics")
  );
  const findingSchema = JSON.stringify(
    readRecord(schemas, "XmlValidationJobFinding")
  );
  const jobSchema = JSON.stringify(readRecord(schemas, "XmlValidationJob"));
  const serializedPost = JSON.stringify(post);

  assert.ok(responses["200"], "Expected XML validation job success response");
  assert.match(serializedPost, /xsd_ubl/);
  assert.match(serializedPost, /not_configured/i);
  assert.match(serializedPost, /passed or failed only after a real local XSD validation operation executes/i);
  assert.match(
    serializedPost,
    /error for controlled validator\/runtime or schema dependency failures/i
  );
  assert.match(serializedPost, /local UBL XSD artefacts/i);
  assert.match(serializedPost, /mapped Invoice Lantern findings/i);
  assert.match(serializedPost, /UBL_XSD_ELEMENT_INVALID/);
  assert.match(serializedPost, /UBL_XSD_REQUIRED_ELEMENT_MISSING/);
  assert.match(serializedPost, /UBL_XSD_VALUE_INVALID/);
  assert.match(serializedPost, /UBL_XSD_ROOT_DIR/);
  assert.match(serializedPost, /UBL_INVOICE_XSD_PATH/);
  assert.match(serializedPost, /UBL_CREDIT_NOTE_XSD_PATH/);
  assert.match(serializedPost, /UBL_XSD_ARTIFACT_VERSION/);
  assert.match(serializedPost, /Schematron artifact diagnostics/i);
  assert.match(serializedPost, /schematron_adapter_preflight_v1/);
  assert.match(serializedPost, /executionPreflight/);
  assert.match(serializedPost, /ready_for_future_execution/);
  assert.match(serializedPost, /schematron_execution_disabled/);
  assert.match(serializedPost, /schematron_execution_engine_not_implemented/);
  assert.match(serializedPost, /validationExecutionEnabled/);
  assert.match(serializedPost, /PEPPOL_SCHEMATRON_ROOT_DIR/);
  assert.match(serializedPost, /PEPPOL_BIS_SCHEMATRON_PATH/);
  assert.match(serializedPost, /EN16931_SCHEMATRON_PATH/);
  assert.match(serializedPost, /SCHEMATRON_ARTIFACT_VERSION/);
  assert.match(serializedPost, /Schematron execution is not implemented/i);
  assert.match(serializedPost, /no certification/i);
  assert.match(serializedPost, /no authority acceptance/i);
  assert.match(serializedPost, /no legal\/tax\/accounting compliance validation/i);
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
  assert.match(schematronArtifactSchema, /relativePathUnderRoot/);
  assert.match(schematronArtifactSchema, /basename/);
  assert.match(schematronArtifactSchema, /sha256/);
  assert.match(schematronArtifactSchema, /full absolute local filesystem paths/);
  assert.match(findingSchema, /not_configured/);
  assert.match(findingSchema, /passed/);
  assert.match(findingSchema, /failed/);
  assert.match(findingSchema, /error/);
  assert.match(findingSchema, /not_implemented/);
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
  assert.match(findingSchema, /PEPPOL_SCHEMATRON_RULE_FAILED/);
  assert.match(findingSchema, /EN16931_SCHEMATRON_RULE_FAILED/);
  assert.match(findingSchema, /never raw XML/);
  assert.match(findingSchema, /PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED/);
  assert.match(jobSchema, /xsd_ubl/);
  assert.match(jobSchema, /artifactInfo/);
  assert.match(jobSchema, /schematron_artifacts/);
  assert.match(jobSchema, /validationExecutionEnabled/);
  assert.match(jobSchema, /adapterVersion/);
  assert.match(jobSchema, /executionPreflight/);
  assert.match(jobSchema, /preflightStatus/);
  assert.match(jobSchema, /preflightReason/);
  assert.match(jobSchema, /findingContractVersion/);
  assert.match(jobSchema, /schematron_contract_v1/);
  assert.match(jobSchema, /supportedFutureFindingCodes/);
  assert.match(serializedPost, /findingContractVersion/);
  assert.match(serializedPost, /schematronLayer/);
  assert.match(serializedPost, /ruleId/);
  assert.match(serializedPost, /businessRuleId/);
  assert.doesNotMatch(jobSchema, /xsd_ubl_placeholder/);
  assert.doesNotMatch(
    serializedPost,
    /\bSchematron passed\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bauthority accepted\b|\baccepted by authority\b|\bproves compliance\b|\bproves Peppol\b|\bproves EN 16931\b/i
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
  assert.match(serialized, /UBL XSD checks are configuration-gated/);
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
