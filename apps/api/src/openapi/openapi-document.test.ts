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
  assert.match(serialized, /Real XSD, Schematron, Peppol, and EN 16931 validation are not enabled yet/);
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
