import assert from "node:assert/strict";
import { test } from "node:test";
import {
  VIDA_EFFECTIVE_DATE_CONTEXT,
  VIDA_SIMULATOR_DISCLAIMER,
  VIDA_SIMULATOR_VERSION,
  buildVidaCountryContext,
  classifyVidaTransaction,
  isEuMemberStateCountryCode,
  normalizeVidaSimulationInput,
  simulateVidaReadiness
} from "./index.js";

test("normalizes ViDA simulation input safely", () => {
  const normalized = normalizeVidaSimulationInput({
    sellerCountry: " de ",
    buyerCountry: " gr ",
    sellerVatId: " de 123 456 789 ",
    buyerVatId: " hu-12345678 ",
    buyerType: "business",
    transactionType: "services",
    invoiceDate: "2026-05-01",
    currency: " eur ",
    amount: "100.00",
    countryPackVersions: {
      de: "2026.05.1",
      " hu ": "2026.05.1",
      empty: " "
    }
  });

  assert.equal(normalized.sellerCountryCode, "DE");
  assert.equal(normalized.buyerCountryCode, "EL");
  assert.equal(normalized.sellerVatId, "DE123456789");
  assert.equal(normalized.buyerVatId, "HU12345678");
  assert.equal(normalized.buyerType, "business");
  assert.equal(normalized.transactionType, "services");
  assert.equal(normalized.invoiceDate, "2026-05-01");
  assert.equal(normalized.currency, "EUR");
  assert.equal(normalized.amount, "100.00");
  assert.deepEqual(normalized.countryPackVersions, {
    DE: "2026.05.1",
    HU: "2026.05.1"
  });
});

test("recognizes supported EU Member State country codes", () => {
  assert.equal(isEuMemberStateCountryCode("DE"), true);
  assert.equal(isEuMemberStateCountryCode("HU"), true);
  assert.equal(isEuMemberStateCountryCode("EL"), true);
  assert.equal(isEuMemberStateCountryCode("US"), false);
  assert.equal(isEuMemberStateCountryCode(null), false);
});

test("builds EU cross-border country context", () => {
  const normalized = normalizeVidaSimulationInput({
    sellerCountry: "DE",
    buyerCountry: "HU"
  });
  const context = buildVidaCountryContext(normalized);

  assert.equal(context.sellerInEu, true);
  assert.equal(context.buyerInEu, true);
  assert.equal(context.sameCountry, false);
  assert.equal(context.crossBorderEu, true);
});

test("classifies cross-border EU B2B service as high ViDA relevance", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services",
    invoiceDate: "2030-07-01",
    currency: "EUR",
    amount: "1000.00",
    countryPackVersions: {
      DE: "2026.05.1",
      HU: "2026.05.1"
    }
  });

  assert.equal(result.simulationVersion, VIDA_SIMULATOR_VERSION);
  assert.equal(result.transactionClass, "intra_eu_b2b_service");
  assert.equal(result.vidaRelevance, "high");
  assert.equal(result.confidence, "educational_simulation");
  assert.equal(result.legalConfidence, "educational_simulation");
  assert.equal(result.countryContext.crossBorderEu, true);
  assert.match(result.reason, /different EU Member States/i);
  assert.match(result.effectiveDateContext, /1 July 2030/i);
  assert.match(result.disclaimer, /not an official ViDA determination/i);
  assert.match(result.disclaimer, /not legal advice/i);
  assert.match(result.disclaimer, /not tax advice/i);
  assert.match(result.disclaimer, /not a compliance guarantee/i);
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_INTRA_EU_B2B_RELEVANCE_SIGNAL"
    )
  );
  assert.ok(
    result.recommendedNextActions.some((action) =>
      /cross-border EU B2B readiness/i.test(action)
    )
  );
});

test("classifies cross-border EU B2B goods as high relevance", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "IT",
    buyerCountry: "FR",
    sellerVatId: "IT12345678901",
    buyerVatId: "FRAB123456789",
    buyerType: "business",
    transactionType: "goods"
  });

  assert.equal(result.transactionClass, "intra_eu_b2b_goods");
  assert.equal(result.vidaRelevance, "high");
  assert.equal(result.countryContext.crossBorderEu, true);
});

test("classifies cross-border EU B2B digital service as high relevance", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "NL",
    buyerCountry: "PL",
    sellerVatId: "NL123456789B01",
    buyerVatId: "PL1234567890",
    buyerType: "business",
    transactionType: "digital_service"
  });

  assert.equal(result.transactionClass, "intra_eu_b2b_digital_service");
  assert.equal(result.vidaRelevance, "high");
});

test("requires review when cross-border EU buyer type is unknown", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "HU",
    transactionType: "services"
  });

  assert.equal(result.transactionClass, "intra_eu_b2b_unknown");
  assert.equal(result.vidaRelevance, "review_required");
  assert.equal(result.legalConfidence, "professional_review_required");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_BUYER_TYPE_REVIEW_REQUIRED"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_PROFESSIONAL_REVIEW_REQUIRED"
    )
  );
});

test("warns when cross-border EU B2B VAT IDs are missing", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "HU",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.transactionClass, "intra_eu_b2b_service");
  assert.equal(result.vidaRelevance, "high");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_BUYER_VAT_ID_CONTEXT_MISSING"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_SELLER_VAT_ID_CONTEXT_MISSING"
    )
  );
});

test("classifies cross-border EU consumer transaction as low relevance", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "HU",
    buyerType: "consumer",
    transactionType: "services"
  });

  assert.equal(result.transactionClass, "intra_eu_b2c");
  assert.equal(result.vidaRelevance, "low");
  assert.match(result.reason, /consumer/i);
});

test("classifies cross-border EU public authority transaction as review required", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "HU",
    buyerType: "public_authority",
    transactionType: "services"
  });

  assert.equal(result.transactionClass, "intra_eu_public_authority");
  assert.equal(result.vidaRelevance, "review_required");
  assert.equal(result.legalConfidence, "professional_review_required");
  assert.match(result.reason, /public authority/i);
});

test("classifies domestic EU business scenario as medium relevance", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "HU",
    buyerCountry: "HU",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.transactionClass, "domestic_eu_business");
  assert.equal(result.vidaRelevance, "medium");
  assert.equal(result.countryContext.sameCountry, true);
  assert.equal(result.countryContext.crossBorderEu, false);
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_DOMESTIC_RULE_PACK_REVIEW_REQUIRED"
    )
  );
});

test("classifies non-EU or unsupported context as not relevant", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "US",
    buyerCountry: "HU",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.transactionClass, "non_eu_or_unsupported");
  assert.equal(result.vidaRelevance, "not_relevant");
  assert.equal(result.countryContext.sellerInEu, false);
  assert.equal(result.countryContext.buyerInEu, true);
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_UNSUPPORTED_COUNTRY_CONTEXT"
    )
  );
});

test("classifies missing country data as insufficient data", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "",
    buyerCountry: "HU",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.transactionClass, "insufficient_data");
  assert.equal(result.vidaRelevance, "not_relevant");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_SELLER_COUNTRY_REQUIRED"
    )
  );
});

test("classification helper returns expected transaction class", () => {
  const normalized = normalizeVidaSimulationInput({
    sellerCountry: "DE",
    buyerCountry: "HU",
    buyerType: "business",
    transactionType: "mixed"
  });
  const context = buildVidaCountryContext(normalized);

  assert.equal(
    classifyVidaTransaction(normalized, context),
    "intra_eu_b2b_mixed"
  );
});

test("legal-safe constants avoid official or compliance claims", () => {
  assert.match(VIDA_EFFECTIVE_DATE_CONTEXT, /simulation/i);
  assert.match(VIDA_SIMULATOR_DISCLAIMER, /not official/i);
  assert.match(VIDA_SIMULATOR_DISCLAIMER, /not filing software/i);
  assert.match(VIDA_SIMULATOR_DISCLAIMER, /not a compliance guarantee/i);
  assert.doesNotMatch(VIDA_SIMULATOR_DISCLAIMER, /certifies/i);
  assert.doesNotMatch(VIDA_SIMULATOR_DISCLAIMER, /accepted by authority/i);
});