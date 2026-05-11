import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import { API_KEY_SCOPES } from "../../services/api-key-service.js";
import { API_RATE_LIMIT_POLICIES } from "../../services/api-rate-limit-policy.js";

function apiHeaders() {
  return {
    "x-api-key": env.DEV_API_KEY,
    "content-type": "application/json"
  };
}

test("ViDA simulation endpoint classifies cross-border EU B2B scenario", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/transactions/simulate-vida",
    headers: apiHeaders(),
    payload: JSON.stringify({
      sellerCountry: "DE",
      buyerCountry: "HU",
      sellerVatId: "DE123456789",
      buyerVatId: "HU12345678",
      buyerType: "business",
      transactionType: "services",
      invoiceDate: "2026-05-01",
      currency: "EUR",
      amount: "100.00",
      countryPackVersions: {
        DE: "2026.05.1",
        HU: "2026.05.1"
      }
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.simulationVersion, "2026.05.1");
  assert.equal(body.transactionClass, "intra_eu_b2b_service");
  assert.equal(body.vidaRelevance, "high");
  assert.equal(body.confidence, "educational_simulation");
  assert.equal(body.legalConfidence, "educational_simulation");
  assert.match(String(body.effectiveDateContext), /simulation/i);
  assert.match(String(body.disclaimer), /not official/i);
  assert.match(String(body.disclaimer), /not legal advice/i);
  assert.match(String(body.disclaimer), /not tax advice/i);
  assert.match(String(body.disclaimer), /not accounting advice/i);
  assert.match(String(body.disclaimer), /not a compliance guarantee/i);

  const countryContext = body.countryContext as Record<string, unknown>;

  assert.equal(countryContext.sellerInEu, true);
  assert.equal(countryContext.buyerInEu, true);
  assert.equal(countryContext.sameCountry, false);
  assert.equal(countryContext.crossBorderEu, true);

  const normalizedInput = body.normalizedInput as Record<string, unknown>;

  assert.equal(normalizedInput.sellerCountryCode, "DE");
  assert.equal(normalizedInput.buyerCountryCode, "HU");
  assert.equal(normalizedInput.sellerVatId, "DE123456789");
  assert.equal(normalizedInput.buyerVatId, "HU12345678");

  const findings = body.findings as Record<string, unknown>[];

  assert.equal(Array.isArray(findings), true);
  assert.ok(
    findings.some(
      (finding) => finding.code === "VIDA_INTRA_EU_B2B_RELEVANCE_SIGNAL"
    )
  );
});

test("ViDA simulation endpoint normalizes Greece alias safely", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/transactions/simulate-vida",
    headers: apiHeaders(),
    payload: JSON.stringify({
      sellerCountry: "GR",
      buyerCountry: "DE",
      buyerType: "business",
      transactionType: "goods"
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const normalizedInput = body.normalizedInput as Record<string, unknown>;

  assert.equal(normalizedInput.sellerCountryCode, "EL");
  assert.equal(normalizedInput.buyerCountryCode, "DE");
  assert.equal(body.transactionClass, "intra_eu_b2b_goods");
  assert.equal(body.vidaRelevance, "high");
});

test("ViDA simulation endpoint rejects missing country data at request validation", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/transactions/simulate-vida",
    headers: apiHeaders(),
    payload: JSON.stringify({
      sellerCountry: "",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "services"
    })
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /VIDA_SIMULATION_REQUEST_INVALID/);
});

test("ViDA simulation endpoint rejects unexpected fields", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/transactions/simulate-vida",
    headers: apiHeaders(),
    payload: JSON.stringify({
      sellerCountry: "DE",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "services",
      officialSubmission: true
    })
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /VIDA_SIMULATION_REQUEST_INVALID/);
});

test("ViDA simulation endpoint requires authentication", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/transactions/simulate-vida",
    headers: {
      "content-type": "application/json"
    },
    payload: JSON.stringify({
      sellerCountry: "DE",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "services"
    })
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /API_KEY_REQUIRED/);
});

test("ViDA simulation endpoint does not claim official validity or compliance", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/transactions/simulate-vida",
    headers: apiHeaders(),
    payload: JSON.stringify({
      sellerCountry: "DE",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "digital_service"
    })
  });

  assert.equal(response.statusCode, 200);

  assert.match(response.body, /simulation/i);
  assert.match(response.body, /not official/i);
  assert.match(response.body, /not a compliance guarantee/i);
  assert.doesNotMatch(response.body, /officially valid/i);
  assert.doesNotMatch(response.body, /ViDA compliant/i);
  assert.doesNotMatch(response.body, /compliance certified/i);
  assert.doesNotMatch(response.body, /authority accepted/i);
  assert.doesNotMatch(response.body, /legal determination/i);
});

test("ViDA simulation endpoint can persist, list, and read a workspace simulation run", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/v1/transactions/simulate-vida",
    headers: apiHeaders(),
    payload: JSON.stringify({
      sellerCountry: "DE",
      buyerCountry: "HU",
      sellerVatId: "DE123456789",
      buyerVatId: "HU12345678",
      buyerType: "business",
      transactionType: "services",
      invoiceDate: "2026-05-01",
      currency: "EUR",
      amount: "100.00",
      persist: true
    })
  });

  assert.equal(createResponse.statusCode, 200);

  const createBody = createResponse.json() as Record<string, unknown>;
  const simulationRunId = String(createBody.simulationRunId ?? "");

  assert.equal(createBody.persisted, true);
  assert.match(simulationRunId, /^vida_sim_/);
  assert.equal(createBody.transactionClass, "intra_eu_b2b_service");
  assert.equal(createBody.vidaRelevance, "high");

  const simulationRun = createBody.simulationRun as Record<string, unknown>;

  assert.equal(simulationRun.id, simulationRunId);
  assert.equal(simulationRun.source, "workspace");
  assert.equal(simulationRun.status, "completed");
  assert.equal(simulationRun.simulationVersion, "2026.05.1");
  assert.equal(simulationRun.sellerCountryCode, "DE");
  assert.equal(simulationRun.buyerCountryCode, "HU");
  assert.equal(simulationRun.transactionClass, "intra_eu_b2b_service");
  assert.equal(simulationRun.vidaRelevance, "high");
  assert.match(String(simulationRun.disclaimer), /not official/i);
  assert.match(String(simulationRun.disclaimer), /not a compliance guarantee/i);

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/transactions/vida-simulations?limit=25",
    headers: apiHeaders()
  });

  assert.equal(listResponse.statusCode, 200);

  const listBody = listResponse.json() as Record<string, unknown>;
  const records = listBody.records as Record<string, unknown>[];

  assert.equal(Array.isArray(records), true);
  assert.ok(
    records.some((record) => record.id === simulationRunId),
    "Expected saved ViDA simulation run in history list"
  );

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/v1/transactions/vida-simulations/${encodeURIComponent(
      simulationRunId
    )}`,
    headers: apiHeaders()
  });

  assert.equal(detailResponse.statusCode, 200);

  const detailBody = detailResponse.json() as Record<string, unknown>;
  const detailRecord = detailBody.record as Record<string, unknown>;

  assert.equal(detailRecord.id, simulationRunId);
  assert.equal(detailRecord.transactionClass, "intra_eu_b2b_service");
  assert.equal(detailRecord.vidaRelevance, "high");
  assert.ok(detailRecord.inputPayload, "Expected input payload snapshot");
  assert.ok(detailRecord.resultPayload, "Expected result payload snapshot");

  const resultPayload = detailRecord.resultPayload as Record<string, unknown>;

  assert.equal(resultPayload.transactionClass, "intra_eu_b2b_service");
  assert.match(String(resultPayload.disclaimer), /not official/i);
});

test("ViDA simulation API key scope is registered", () => {
  assert.ok(
    (API_KEY_SCOPES as readonly string[]).includes(
      "transactions:simulate_vida"
    )
  );
});

test("ViDA simulation endpoint has a dedicated API-key rate-limit policy", () => {
  const policy = API_RATE_LIMIT_POLICIES.transactions_simulate_vida;

  assert.equal(policy.policyKey, "transactions_simulate_vida");
  assert.equal(policy.scope, "transactions:simulate_vida");
  assert.equal(policy.appliesTo, "api_key");
  assert.equal(policy.requestPathPrefix, "/api/v1/transactions/simulate-vida");
  assert.equal(policy.windowSeconds, 15 * 60);
  assert.equal(policy.maxRequests, 30);
});