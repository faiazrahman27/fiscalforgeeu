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

test("learning scenario list endpoint returns educational preview-only templates", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/learning/scenarios",
    headers: apiHeaders()
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const scenarios = body.scenarios as Record<string, unknown>[];

  assert.equal(Array.isArray(scenarios), true);
  assert.equal(scenarios.length >= 10, true);
  assert.equal(body.notForProductionUse, true);
  assert.match(String(body.disclaimer), /educational templates/i);
  assert.ok(
    scenarios.some(
      (scenario) => scenario.scenarioId === "intra-eu-b2b-services"
    )
  );
  assert.doesNotMatch(response.body, /reverse charge applies/i);
  assert.doesNotMatch(response.body, /legally compliant/i);
  assert.doesNotMatch(response.body, /tax compliant/i);
  assert.doesNotMatch(response.body, /authority accepted/i);
});

test("learning scenario detail endpoint returns one scenario without production claims", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/learning/scenarios/cii-ready-xsd-not-configured",
    headers: apiHeaders()
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const scenario = body.scenario as Record<string, unknown>;

  assert.equal(scenario.scenarioId, "cii-ready-xsd-not-configured");
  assert.equal(scenario.notForProductionUse, true);
  assert.match(String(scenario.legalSafeExplanation), /CII XML/i);
  assert.doesNotMatch(response.body, /CII XSD.*successful/i);
  assert.doesNotMatch(response.body, /official filing/i);
});

test("learning scenario preview endpoint returns transaction simulation output", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/learning/scenarios/intra-eu-b2b-services/preview",
    headers: apiHeaders(),
    payload: JSON.stringify({})
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const transactionSimulation = body.transactionSimulation as Record<
    string,
    unknown
  >;
  const reverseChargeSimulation =
    transactionSimulation.reverseChargeSimulation as Record<string, unknown>;

  assert.equal(body.notForProductionUse, true);
  assert.equal(body.persisted, false);
  assert.equal(transactionSimulation.transactionClass, "intra_eu_b2b_services");
  assert.equal(reverseChargeSimulation.relevance, "possible");
  assert.match(String(body.disclaimer), /not production invoices/i);
  assert.doesNotMatch(response.body, /reverse charge applies/i);
  assert.doesNotMatch(response.body, /authority accepted/i);
});

test("learning scenario preview rejects unexpected fields", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/learning/scenarios/intra-eu-b2b-services/preview",
    headers: apiHeaders(),
    payload: JSON.stringify({
      createInvoice: true
    })
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /LEARNING_SCENARIO_PREVIEW_REQUEST_INVALID/);
});

test("learning scenario endpoint returns 404 for unknown scenario", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/learning/scenarios/not-real",
    headers: apiHeaders()
  });

  assert.equal(response.statusCode, 404);
  assert.match(response.body, /LEARNING_SCENARIO_NOT_FOUND/);
});

test("learning scenario API key scope and rate limit policy are registered", () => {
  assert.ok(
    (API_KEY_SCOPES as readonly string[]).includes("learning_scenarios:read")
  );

  const policy = API_RATE_LIMIT_POLICIES.learning_scenarios_read;

  assert.equal(policy.policyKey, "learning_scenarios_read");
  assert.equal(policy.scope, "learning_scenarios:read");
  assert.equal(policy.appliesTo, "api_key");
  assert.equal(policy.requestPathPrefix, "/api/v1/learning/scenarios");
});
