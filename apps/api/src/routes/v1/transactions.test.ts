import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import { API_KEY_SCOPES } from "../../services/api-key-service.js";
import { API_RATE_LIMIT_POLICIES } from "../../services/api-rate-limit-policy.js";
import { VIDA_SIMULATOR_VERSION } from "@invoice-lantern/vida-simulator";

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

  assert.equal(body.simulationVersion, VIDA_SIMULATOR_VERSION);
  assert.equal(body.transactionClass, "intra_eu_b2b_service");
  assert.equal(body.vidaRelevance, "high");
  assert.equal(body.confidence, "professional_review_required");
  assert.equal(body.legalConfidence, "professional_review_required");
  assert.equal(typeof body.readinessScore, "number");
  assert.equal(body.readinessStatus, "needs_more_invoice_data");
  assert.equal(body.persisted, false);
  assert.equal(body.simulationRunId, undefined);
  assert.equal(body.simulationRun, undefined);
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
  assert.equal(countryContext.sellerCountryPackStatus, "professional_review_required");
  assert.equal(countryContext.buyerCountryPackStatus, "professional_review_required");

  const normalizedInput = body.normalizedInput as Record<string, unknown>;

  assert.equal(normalizedInput.sellerCountryCode, "DE");
  assert.equal(normalizedInput.buyerCountryCode, "HU");
  assert.equal(normalizedInput.sellerVatId, "DE123456789");
  assert.equal(normalizedInput.buyerVatId, "HU12345678");

  const evidenceSummary = body.evidenceSummary as Record<string, unknown>;
  const timeline = body.timeline as Record<string, unknown>[];
  const sourceReferences = body.sourceReferences as Record<string, unknown>[];

  assert.equal(typeof evidenceSummary, "object");
  assert.equal(Array.isArray(timeline), true);
  assert.ok(timeline.some((item) => item.date === "2030-07-01"));
  assert.equal(Array.isArray(sourceReferences), true);
  assert.ok(
    sourceReferences.some((item) => item.id === "eu-vida-package-context")
  );

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

  assert.equal(normalizedInput.sellerCountryCode, "GR");
  assert.equal(normalizedInput.buyerCountryCode, "DE");
  assert.equal(body.transactionClass, "intra_eu_b2b_goods");
  assert.equal(body.vidaRelevance, "high");
  assert.equal(body.persisted, false);
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

test("ViDA simulation endpoint returns expanded evidence, timeline, and source-linked output", async (t) => {
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
      buyerCountry: "GR",
      sellerVatId: "DE123456789",
      buyerVatId: "EL123456789",
      buyerType: "business",
      sellerType: "business",
      transactionType: "mixed",
      supplyScenario: "intra_eu",
      invoiceDate: "2030-07-01",
      issueDate: "2030-07-01",
      currency: "EUR",
      amount: "100.00",
      invoiceProfile: "PEPPOL_BIS_3",
      structuredInvoiceSignals: {
        hasCanonicalInvoice: true,
        hasUblXml: true,
        hasCiiXml: false,
        xsdStatus: "passed",
        schematronPeppolStatus: "passed",
        schematronEn16931Status: "passed",
        validationSummary: {
          status: "passed",
          totalFindings: 0
        }
      },
      vatEvidence: {
        sellerViesStatus: "valid",
        buyerViesStatus: "unavailable",
        checkedAt: "2026-05-14T10:00:00.000Z",
        sourceLabel: "cached VIES evidence"
      },
      sourceRefs: ["eu-vida-package-context"],
      sourceLabels: ["European Commission ViDA context"]
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const evidenceSummary = body.evidenceSummary as Record<string, unknown>;
  const findings = body.findings as Record<string, unknown>[];

  assert.equal(body.transactionClass, "intra_eu_b2b_mixed");
  assert.equal(body.vidaRelevance, "high");
  assert.equal(typeof body.readinessScore, "number");
  assert.equal(body.persisted, false);
  assert.equal(
    (evidenceSummary.viesEvidence as Record<string, unknown>).buyerStatus,
    "unavailable"
  );
  assert.ok(
    findings.some(
      (finding) => finding.code === "VIDA_BUYER_VIES_UNAVAILABLE"
    )
  );
  assert.ok(
    findings.some(
      (finding) => finding.code === "VIDA_GR_EL_VAT_PREFIX_COMPATIBILITY"
    )
  );
  assert.doesNotMatch(response.body, /<soap/i);
  assert.doesNotMatch(response.body, /<Invoice/i);
  assert.doesNotMatch(response.body, /service_role/i);
  assert.doesNotMatch(response.body, /SUPABASE_SERVICE_ROLE/i);
});

test("ViDA simulation endpoint rejects unexpected nested evidence fields", async (t) => {
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
      vatEvidence: {
        buyerViesStatus: "valid",
        rawSoap: "<Envelope />"
      }
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

test("ViDA simulation endpoint rejects workspace persistence without signed-in workspace auth", async (t) => {
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
      persist: true
    })
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /WORKSPACE_AUTH_REQUIRED/);
  assert.match(response.body, /Sign in/i);
});

test("ViDA simulation history list requires signed-in workspace auth", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/transactions/vida-simulations?limit=25",
    headers: apiHeaders()
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /AUTH_TOKEN_REQUIRED/);
});

test("ViDA simulation history detail requires signed-in workspace auth", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/transactions/vida-simulations/vida_sim_test",
    headers: apiHeaders()
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /AUTH_TOKEN_REQUIRED/);
});

test("ViDA simulation history does not accept an organization API key as bearer auth", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const fakeOrganizationApiKey =
    "il_test_abcdef12.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/transactions/vida-simulations?limit=25",
    headers: {
      authorization: `Bearer ${fakeOrganizationApiKey}`
    }
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /AUTH_TOKEN_REQUIRED/);
  assert.match(response.body, /API key authentication is not allowed/i);
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
