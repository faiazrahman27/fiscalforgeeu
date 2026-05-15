import assert from "node:assert/strict";
import { test } from "node:test";
import type { CanonicalInvoice } from "@invoice-lantern/invoice-core";
import {
  VIDA_EFFECTIVE_DATE_CONTEXT,
  VIDA_SIMULATOR_DISCLAIMER,
  VIDA_SIMULATOR_VERSION,
  buildVidaCountryContext,
  buildVidaSimulationInputFromCanonicalInvoice,
  classifyVidaTransaction,
  isEuMemberStateCountryCode,
  listVidaSupportedEuCountries,
  normalizeVidaSimulationInput,
  simulateVidaReadiness,
  simulateVidaReadinessFromCanonicalInvoice,
  type VidaReadinessSimulationInput
} from "./index.js";

const EU_COUNTRY_CODES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE"
];

const completeEvidence = {
  structuredInvoiceSignals: {
    hasCanonicalInvoice: true,
    hasUblXml: true,
    hasCiiXml: false,
    xsdStatus: "passed",
    xsdUblStatus: "passed",
    xsdCiiStatus: "not_checked",
    schematronPeppolStatus: "passed",
    schematronEn16931Status: "passed",
    validationSummary: {
      status: "passed",
      totalFindings: 0,
      blockedCount: 0,
      fatalCount: 0,
      warningCount: 0,
      infoCount: 0
    }
  },
  vatEvidence: {
    sellerViesStatus: "valid",
    buyerViesStatus: "valid",
    checkedAt: "2026-05-14T10:00:00.000Z",
    sourceLabel: "cached VIES evidence"
  }
} satisfies Pick<
  VidaReadinessSimulationInput,
  "structuredInvoiceSignals" | "vatEvidence"
>;

const completeCiiEvidence = {
  structuredInvoiceSignals: {
    hasCanonicalInvoice: true,
    hasUblXml: false,
    hasCiiXml: true,
    xsdStatus: "passed",
    xsdUblStatus: "not_checked",
    xsdCiiStatus: "passed",
    schematronPeppolStatus: "not_checked",
    schematronEn16931Status: "passed",
    validationSummary: {
      status: "passed",
      totalFindings: 0,
      blockedCount: 0,
      fatalCount: 0,
      warningCount: 0,
      infoCount: 0
    }
  },
  vatEvidence: {
    sellerViesStatus: "valid",
    buyerViesStatus: "valid",
    checkedAt: "2026-05-14T10:00:00.000Z",
    sourceLabel: "cached VIES evidence"
  }
} satisfies Pick<
  VidaReadinessSimulationInput,
  "structuredInvoiceSignals" | "vatEvidence"
>;

function b2bInput(
  transactionType: VidaReadinessSimulationInput["transactionType"]
): VidaReadinessSimulationInput {
  return {
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType,
    invoiceDate: "2030-07-01",
    issueDate: "2030-07-01",
    currency: "EUR",
    amount: "1000.00",
    invoiceProfile: "EN16931",
    ...completeEvidence
  };
}

function ciiB2bInput(
  transactionType: VidaReadinessSimulationInput["transactionType"] = "services"
): VidaReadinessSimulationInput {
  return {
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType,
    invoiceDate: "2030-07-01",
    issueDate: "2030-07-01",
    currency: "EUR",
    amount: "1000.00",
    invoiceProfile: "EN16931",
    ...completeCiiEvidence
  };
}

test("normalizes ViDA simulation input safely", () => {
  const normalized = normalizeVidaSimulationInput({
    sellerCountry: " de ",
    buyerCountry: " el ",
    sellerVatId: " de 123 456 789 ",
    buyerVatId: " el-123456789 ",
    buyerType: "business",
    sellerType: "public_authority",
    transactionType: "services",
    supplyScenario: "intra_eu",
    invoiceDate: "2026-05-01",
    issueDate: "2026-05-02",
    currency: " eur ",
    amount: "100.00",
    invoiceProfile: "PEPPOL_BIS_3",
    countryPackVersions: {
      de: "2026.05.1",
      " el ": "2026.05.1",
      empty: " "
    },
    sourceRefs: [" eu-vida-package-context ", ""],
    sourceLabels: [" European Commission "]
  });

  assert.equal(normalized.sellerCountryCode, "DE");
  assert.equal(normalized.buyerCountryCode, "GR");
  assert.equal(normalized.sellerVatCountryCode, "DE");
  assert.equal(normalized.buyerVatCountryCode, "GR");
  assert.equal(normalized.sellerVatId, "DE123456789");
  assert.equal(normalized.buyerVatId, "EL123456789");
  assert.equal(normalized.buyerType, "business");
  assert.equal(normalized.sellerType, "public_authority");
  assert.equal(normalized.transactionType, "services");
  assert.equal(normalized.supplyScenario, "intra_eu");
  assert.equal(normalized.invoiceDate, "2026-05-01");
  assert.equal(normalized.issueDate, "2026-05-02");
  assert.equal(normalized.currency, "EUR");
  assert.equal(normalized.amount, "100.00");
  assert.equal(normalized.invoiceProfile, "PEPPOL_BIS_3");
  assert.deepEqual(normalized.countryPackVersions, {
    DE: "2026.05.1",
    GR: "2026.05.1"
  });
  assert.deepEqual(normalized.sourceRefs, ["eu-vida-package-context"]);
  assert.deepEqual(normalized.sourceLabels, ["European Commission"]);
});

test("normalizes structured CII evidence separately from generic XML evidence", () => {
  const normalized = normalizeVidaSimulationInput({
    sellerCountry: "DE",
    buyerCountry: "HU",
    buyerType: "business",
    transactionType: "services",
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: false,
      hasCiiXml: true,
      xsdStatus: "passed",
      xsdCiiStatus: "failed",
      schematronEn16931Status: "passed"
    }
  });

  assert.equal(normalized.structuredInvoiceSignals.hasCanonicalInvoice, true);
  assert.equal(normalized.structuredInvoiceSignals.hasUblXml, false);
  assert.equal(normalized.structuredInvoiceSignals.hasCiiXml, true);
  assert.equal(normalized.structuredInvoiceSignals.xsdStatus, "passed");
  assert.equal(normalized.structuredInvoiceSignals.xsdUblStatus, "not_checked");
  assert.equal(normalized.structuredInvoiceSignals.xsdCiiStatus, "failed");
  assert.equal(
    normalized.structuredInvoiceSignals.schematronEn16931Status,
    "passed"
  );
});

test("recognizes all EU Member State country codes through country-pack integration", () => {
  const supportedCountries = listVidaSupportedEuCountries();
  const supportedCodes = supportedCountries.map((country) => country.countryCode);

  assert.equal(supportedCountries.length, 27);

  for (const countryCode of EU_COUNTRY_CODES) {
    assert.equal(isEuMemberStateCountryCode(countryCode), true);
    assert.ok(supportedCodes.includes(countryCode));
  }

  assert.equal(isEuMemberStateCountryCode("EL"), false);
  assert.equal(isEuMemberStateCountryCode("US"), false);
  assert.equal(isEuMemberStateCountryCode(null), false);
});

test("keeps Greece as GR while allowing EL VAT prefix compatibility", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "EL",
    sellerVatId: "DE123456789",
    buyerVatId: "EL123456789",
    buyerType: "business",
    transactionType: "goods",
    ...completeEvidence
  });

  assert.equal(result.normalizedInput.buyerCountryCode, "GR");
  assert.equal(result.normalizedInput.buyerVatCountryCode, "GR");
  assert.equal(result.evidenceSummary.vatFormatEvidence.buyerStatus, "valid");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_GR_EL_VAT_PREFIX_COMPATIBILITY"
    )
  );
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
  assert.equal(context.sellerCountryPackStatus, "beta");
  assert.equal(context.buyerCountryPackStatus, "beta");
});

test("classifies cross-border EU B2B goods as high ViDA relevance", () => {
  const result = simulateVidaReadiness(b2bInput("goods"));

  assert.equal(result.simulationVersion, VIDA_SIMULATOR_VERSION);
  assert.equal(result.transactionClass, "intra_eu_b2b_goods");
  assert.equal(result.vidaRelevance, "high");
  assert.equal(result.countryContext.crossBorderEu, true);
  assert.match(result.reason, /different EU Member States/i);
  assert.match(result.effectiveDateContext, /1 July 2030/i);
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_INTRA_EU_B2B_RELEVANCE_SIGNAL"
    )
  );
});

test("classifies cross-border EU B2B service as high ViDA relevance", () => {
  const result = simulateVidaReadiness(b2bInput("services"));

  assert.equal(result.transactionClass, "intra_eu_b2b_service");
  assert.equal(result.vidaRelevance, "high");
});

test("classifies cross-border EU B2B digital service as high ViDA relevance", () => {
  const result = simulateVidaReadiness(b2bInput("digital_service"));

  assert.equal(result.transactionClass, "intra_eu_b2b_digital_service");
  assert.equal(result.vidaRelevance, "high");
});

test("classifies cross-border EU B2B mixed transaction as high ViDA relevance", () => {
  const result = simulateVidaReadiness(b2bInput("mixed"));

  assert.equal(result.transactionClass, "intra_eu_b2b_mixed");
  assert.equal(result.vidaRelevance, "high");
});

test("integrates tax-engine transaction simulation into ViDA output", () => {
  const result = simulateVidaReadiness(b2bInput("services"));

  assert.ok(result.transactionSimulation);
  assert.ok(result.transactionSimulation.reverseChargeSimulation);
  assert.ok(result.transactionSimulation.vatIdEvidence);
  assert.ok(Array.isArray(result.transactionSimulation.findings));
  assert.match(
    result.transactionSimulation.disclaimer,
    /not legal, tax, accounting/i
  );
});

test("adds reverse-charge review context when tax-engine simulation marks it relevant", () => {
  const result = simulateVidaReadiness(b2bInput("services"));

  assert.ok(
    result.findings.some(
      (finding) =>
        finding.code === "VIDA_REVERSE_CHARGE_REVIEW_CONTEXT" &&
        finding.legalConfidence === "professional_review_required"
    )
  );
});

test("supports CII XML evidence in ViDA readiness output", () => {
  const result = simulateVidaReadiness(ciiB2bInput("services"));

  assert.equal(result.normalizedInput.structuredInvoiceSignals.hasCiiXml, true);
  assert.equal(result.normalizedInput.structuredInvoiceSignals.hasUblXml, false);
  assert.equal(result.evidenceSummary.structuredInvoiceEvidence.hasCiiXml, true);
  assert.equal(result.evidenceSummary.xmlValidationEvidence.ciiXsdStatus, "passed");
  assert.equal(
    result.transactionSimulation.structuredInvoiceEvidence.hasCiiXml,
    true
  );
  assert.ok(
    result.findings.some(
      (finding) =>
        finding.code === "VIDA_CII_XML_EVIDENCE_PRESENT" &&
        finding.category === "CII"
    )
  );
});

test("CII XSD failure lowers technical readiness without legal conclusions", () => {
  const passed = simulateVidaReadiness(ciiB2bInput("services"));
  const failed = simulateVidaReadiness({
    ...ciiB2bInput("services"),
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: false,
      hasCiiXml: true,
      xsdStatus: "passed",
      xsdCiiStatus: "failed",
      schematronEn16931Status: "passed"
    }
  });

  assert.equal(failed.evidenceSummary.xmlValidationEvidence.ciiXsdStatus, "failed");
  assert.ok((failed.readinessScore ?? 0) < (passed.readinessScore ?? 0));
  assert.ok(
    failed.findings.some(
      (finding) =>
        finding.code === "VIDA_CII_XSD_FAILED" &&
        finding.category === "CII" &&
        finding.legalConfidence === "technical"
    )
  );
});

test("CII XSD not configured is not success", () => {
  const result = simulateVidaReadiness({
    ...ciiB2bInput("services"),
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: false,
      hasCiiXml: true,
      xsdStatus: "passed",
      xsdCiiStatus: "not_configured",
      schematronEn16931Status: "passed"
    }
  });

  assert.equal(
    result.evidenceSummary.xmlValidationEvidence.ciiXsdStatus,
    "not_configured"
  );
  assert.ok(
    result.findings.some(
      (finding) =>
        finding.code === "VIDA_CII_XSD_NOT_CONFIGURED" &&
        finding.category === "CII"
    )
  );
  assert.doesNotMatch(JSON.stringify(result), /CII XSD.*successful/i);
});

test("requires review when cross-border EU buyer type is unknown", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "HU",
    transactionType: "services",
    ...completeEvidence
  });

  assert.equal(result.transactionClass, "intra_eu_b2b_unknown");
  assert.equal(result.vidaRelevance, "review_required");
  assert.equal(result.legalConfidence, "professional_review_required");
  assert.equal(result.readinessStatus, "professional_review_required");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_BUYER_TYPE_REVIEW_REQUIRED"
    )
  );
});

test("classifies domestic EU business scenario as medium with country-pack warnings", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "HU",
    buyerCountry: "HU",
    sellerVatId: "HU12345678",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services",
    ...completeEvidence
  });

  assert.equal(result.transactionClass, "domestic_eu_business");
  assert.equal(result.vidaRelevance, "medium");
  assert.notEqual(result.readinessStatus, "not_relevant");
  assert.equal(result.countryContext.sameCountry, true);
  assert.equal(result.countryContext.crossBorderEu, false);
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_DOMESTIC_RULE_PACK_REVIEW_REQUIRED"
    )
  );
  assert.ok(
    result.findings.some((finding) => finding.category === "COUNTRY_PACK")
  );
});

test("does not treat B2C as cross-border B2B DRR", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "HU",
    buyerType: "consumer",
    transactionType: "services",
    ...completeEvidence
  });

  assert.equal(result.transactionClass, "intra_eu_b2c");
  assert.equal(result.vidaRelevance, "low");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_B2C_NOT_CROSS_BORDER_B2B_DRR"
    )
  );
});

test("requires review for public-authority context", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "HU",
    buyerType: "public_authority",
    transactionType: "services",
    ...completeEvidence
  });

  assert.equal(result.transactionClass, "intra_eu_public_authority");
  assert.equal(result.vidaRelevance, "review_required");
  assert.equal(result.legalConfidence, "professional_review_required");
  assert.match(result.reason, /public authority/i);
});

test("classifies non-EU contexts as not relevant or review required", () => {
  const oneSidedEu = simulateVidaReadiness({
    sellerCountry: "US",
    buyerCountry: "HU",
    buyerType: "business",
    transactionType: "services",
    ...completeEvidence
  });
  const neitherEu = simulateVidaReadiness({
    sellerCountry: "US",
    buyerCountry: "GB",
    buyerType: "business",
    transactionType: "services",
    ...completeEvidence
  });

  assert.equal(oneSidedEu.transactionClass, "non_eu_or_unsupported");
  assert.equal(oneSidedEu.vidaRelevance, "review_required");
  assert.equal(oneSidedEu.readinessStatus, "professional_review_required");
  assert.equal(neitherEu.transactionClass, "non_eu_or_unsupported");
  assert.equal(neitherEu.vidaRelevance, "not_relevant");
  assert.equal(neitherEu.readinessStatus, "not_relevant");
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
  assert.equal(result.readinessScore, null);
  assert.equal(result.readinessStatus, "needs_more_invoice_data");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_SELLER_COUNTRY_REQUIRED"
    )
  );
});

test("warns when likely cross-border EU B2B VAT IDs are missing", () => {
  const result = simulateVidaReadiness({
    sellerCountry: "DE",
    buyerCountry: "HU",
    buyerType: "business",
    transactionType: "services",
    ...completeEvidence
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

test("invalid VAT format lowers readiness score", () => {
  const valid = simulateVidaReadiness(b2bInput("services"));
  const invalid = simulateVidaReadiness({
    ...b2bInput("services"),
    buyerVatId: "HU12"
  });

  assert.equal(invalid.evidenceSummary.vatFormatEvidence.buyerStatus, "invalid");
  assert.ok(
    invalid.findings.some(
      (finding) => finding.code === "VIDA_BUYER_VAT_FORMAT_INVALID"
    )
  );
  assert.notEqual(valid.readinessScore, null);
  assert.notEqual(invalid.readinessScore, null);
  assert.ok((invalid.readinessScore ?? 0) < (valid.readinessScore ?? 0));
});

test("VIES unavailable warns but is not treated as invalid", () => {
  const result = simulateVidaReadiness({
    ...b2bInput("services"),
    vatEvidence: {
      sellerViesStatus: "valid",
      buyerViesStatus: "unavailable",
      checkedAt: "2026-05-14T10:00:00.000Z",
      sourceLabel: "cached VIES evidence"
    }
  });

  assert.equal(result.evidenceSummary.viesEvidence.buyerStatus, "unavailable");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_BUYER_VIES_UNAVAILABLE"
    )
  );
  assert.ok(
    !result.findings.some(
      (finding) => finding.code === "VIDA_BUYER_VIES_INVALID_EVIDENCE"
    )
  );
});

test("VIES valid is evidence only", () => {
  const result = simulateVidaReadiness(b2bInput("services"));

  assert.equal(result.evidenceSummary.viesEvidence.buyerStatus, "valid");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_BUYER_VIES_VALID_EVIDENCE_ONLY"
    )
  );
  assert.match(result.evidenceSummary.viesEvidence.note, /time-of-check/i);
});

test("failed XSD and Schematron lower technical readiness", () => {
  const passed = simulateVidaReadiness(b2bInput("services"));
  const failed = simulateVidaReadiness({
    ...b2bInput("services"),
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: true,
      hasCiiXml: false,
      xsdStatus: "failed",
      xsdUblStatus: "failed",
      xsdCiiStatus: "not_checked",
      schematronPeppolStatus: "failed",
      schematronEn16931Status: "failed"
    }
  });

  assert.ok((failed.readinessScore ?? 0) < (passed.readinessScore ?? 0));
  assert.equal(failed.readinessStatus, "needs_more_invoice_data");
  assert.ok(
    failed.findings.some((finding) => finding.code === "VIDA_XSD_FAILED")
  );
  assert.ok(
    failed.findings.some((finding) => finding.code === "VIDA_UBL_XSD_FAILED")
  );
  assert.ok(
    failed.findings.some(
      (finding) => finding.code === "VIDA_SCHEMATRON_PEPPOL_FAILED"
    )
  );
  assert.ok(
    failed.findings.some(
      (finding) => finding.code === "VIDA_SCHEMATRON_EN16931_FAILED"
    )
  );
});

test("not configured XSD and Schematron are not success", () => {
  const result = simulateVidaReadiness({
    ...b2bInput("services"),
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: true,
      hasCiiXml: false,
      xsdStatus: "not_configured",
      xsdUblStatus: "not_configured",
      xsdCiiStatus: "not_checked",
      schematronPeppolStatus: "not_configured",
      schematronEn16931Status: "not_configured"
    }
  });

  assert.equal(result.readinessStatus, "needs_more_invoice_data");
  assert.ok(
    result.findings.some((finding) => finding.code === "VIDA_XSD_NOT_CONFIGURED")
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_UBL_XSD_NOT_CONFIGURED"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_SCHEMATRON_PEPPOL_NOT_CONFIGURED"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIDA_SCHEMATRON_EN16931_NOT_CONFIGURED"
    )
  );
});

test("country-pack beta and professional-review coverage adds review warnings", () => {
  const result = simulateVidaReadiness(b2bInput("goods"));

  assert.equal(result.countryContext.sellerCountryPackStatus, "beta");
  assert.equal(
    result.countryContext.sellerCountryPackSourceCoverageStatus,
    "professional_review_required"
  );
  assert.ok(
    result.findings.some(
      (finding) =>
        finding.code === "VIDA_SELLER_COUNTRY_PACK_REVIEW_REQUIRED" &&
        finding.countryPackStatus === "beta" &&
        finding.legalConfidence === "professional_review_required"
    )
  );
});

test("readiness score is bounded between 0 and 100 when present", () => {
  const results = [
    simulateVidaReadiness(b2bInput("goods")),
    simulateVidaReadiness({
      sellerCountry: "DE",
      buyerCountry: "HU",
      buyerType: "business",
      transactionType: "services"
    }),
    simulateVidaReadiness({
      sellerCountry: "US",
      buyerCountry: "GB",
      buyerType: "business",
      transactionType: "services"
    })
  ];

  for (const result of results) {
    if (result.readinessScore !== null) {
      assert.ok(result.readinessScore >= 0);
      assert.ok(result.readinessScore <= 100);
    }
  }
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

test("builds simulation input from canonical invoice without changing invoice data", () => {
  const canonicalInvoice = {
    profile: "EN16931",
    document: {
      type: "invoice",
      number: "INV-1",
      issueDate: "2030-07-01",
      dueDate: "",
      taxPointDate: "",
      currency: "EUR",
      profile: "EN16931",
      buyerReference: "",
      contractReference: "",
      orderReference: "",
      projectReference: "",
      accountingCost: ""
    },
    seller: {
      name: "Seller GmbH",
      legalName: "",
      country: "DE",
      vatId: "DE123456789",
      taxRegistrationNumber: "",
      electronicAddress: "",
      electronicAddressScheme: "",
      email: "",
      phone: "",
      address: {
        street: "",
        additionalStreet: "",
        city: "",
        postalCode: "",
        region: "",
        country: "DE"
      },
      city: "",
      postalCode: "",
      street: "",
      additionalStreet: "",
      region: ""
    },
    buyer: {
      name: "Buyer Kft",
      legalName: "",
      country: "HU",
      vatId: "HU12345678",
      taxRegistrationNumber: "",
      electronicAddress: "",
      electronicAddressScheme: "",
      email: "",
      phone: "",
      address: {
        street: "",
        additionalStreet: "",
        city: "",
        postalCode: "",
        region: "",
        country: "HU"
      },
      city: "",
      postalCode: "",
      street: "",
      additionalStreet: "",
      region: ""
    },
    delivery: {
      deliveryDate: "",
      locationId: "",
      country: "",
      address: undefined
    },
    payment: {
      paymentMeansCode: "",
      paymentReference: "",
      terms: "",
      dueDate: "",
      accountLabel: "",
      accountLast4: ""
    },
    lines: [],
    allowances: [],
    charges: [],
    taxBreakdown: [],
    taxSubtotals: [],
    totals: {
      lineExtensionAmount: "100.00",
      allowanceTotalAmount: "0",
      chargeTotalAmount: "0",
      taxExclusiveAmount: "100.00",
      taxAmount: "27.00",
      taxTotalAmount: "27.00",
      taxInclusiveAmount: "127.00",
      prepaidAmount: "0",
      payableRoundingAmount: "0",
      payableAmount: "127.00"
    },
    metadata: {},
    legal: {
      legalConfidence: "technical",
      disclaimer: "Technical canonical invoice test object."
    }
  } as CanonicalInvoice;

  const input = buildVidaSimulationInputFromCanonicalInvoice(canonicalInvoice, {
    transactionType: "services",
    ...completeEvidence
  });
  const result = simulateVidaReadinessFromCanonicalInvoice(canonicalInvoice, {
    transactionType: "services",
    ...completeEvidence
  });

  assert.equal(input.sellerCountry, "DE");
  assert.equal(input.buyerCountry, "HU");
  assert.equal(input.amount, "127.00");
  assert.equal(input.structuredInvoiceSignals?.hasCanonicalInvoice, true);
  assert.equal(result.transactionClass, "intra_eu_b2b_service");
});

test("legal-safe constants and outputs avoid unsafe positive claims", () => {
  const result = simulateVidaReadiness(b2bInput("services"));
  const serialized = JSON.stringify(result);

  assert.match(VIDA_EFFECTIVE_DATE_CONTEXT, /readiness context/i);
  assert.match(VIDA_SIMULATOR_DISCLAIMER, /not official/i);
  assert.match(VIDA_SIMULATOR_DISCLAIMER, /not filing software/i);
  assert.match(VIDA_SIMULATOR_DISCLAIMER, /not a compliance guarantee/i);
  assert.doesNotMatch(serialized, /\bcertifies\b/i);
  assert.doesNotMatch(serialized, /\bcertified\b/i);
  assert.doesNotMatch(serialized, /guaranteed compliance/i);
  assert.doesNotMatch(serialized, /accepted by tax authority/i);
  assert.doesNotMatch(serialized, /valid for VAT reporting/i);
});
