import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STRUCTURED_INVOICE_EVIDENCE_DISCLAIMER,
  TRANSACTION_SIMULATION_DISCLAIMER,
  VAT_FORMAT_DISCLAIMER,
  VIES_EVIDENCE_DISCLAIMER,
  classifyTransaction,
  extractVatCountry,
  getVatFormatCountryName,
  isEuMemberState,
  normalizeJurisdictionCountryCode,
  normalizeVatId,
  validateVatFormat
} from "./index.js";

test("normalization removes safe separators and uppercases letters", () => {
  assert.equal(normalizeVatId(" de 123-456.789/ "), "DE123456789");
});

test("country extraction detects supported VAT prefixes", () => {
  assert.equal(extractVatCountry("hu 12345678"), "HU");
  assert.equal(extractVatCountry("XI123456789"), "XI");
  assert.equal(extractVatCountry("US123456789"), null);
});

test("known local VAT format examples pass", () => {
  for (const vatId of [
    "HU12345678",
    "DE123456789",
    "FRXX123456789",
    "IT12345678901",
    "NL123456789B01",
    "XI123456789"
  ]) {
    const result = validateVatFormat(vatId);

    assert.equal(result.formatValid, true, vatId);
    assert.equal(result.checkLevel, "local_format");
    assert.equal(result.source, "invoice_lantern_vat_format_rules");
    assert.match(result.message, /local format pattern/i);
  }
});

test("country names are exposed for supported VAT format rules", () => {
  assert.equal(getVatFormatCountryName("DE"), "Germany");
  assert.equal(getVatFormatCountryName("hu"), "Hungary");
  assert.equal(getVatFormatCountryName("GR"), "Greece");
  assert.equal(getVatFormatCountryName("US"), undefined);
});

test("malformed VAT IDs fail safely", () => {
  const result = validateVatFormat("HU123");

  assert.equal(result.formatValid, false);
  assert.equal(result.countryCode, "HU");
  assert.match(result.message, /does not match/i);
  assert.equal(result.warnings.length > 0, true);
});

test("unsupported countries fail without official conclusions", () => {
  const result = validateVatFormat("US123456789");

  assert.equal(result.formatValid, false);
  assert.equal(result.countryCode, "US");
  assert.match(result.message, /does not currently support/i);
});

test("empty input fails safely", () => {
  const result = validateVatFormat("   ");

  assert.equal(result.formatValid, false);
  assert.equal(result.normalized, "");
  assert.equal(result.countryCode, undefined);
  assert.match(result.message, /enter a VAT ID/i);
});

test("country hints can validate unprefixed VAT IDs", () => {
  const result = validateVatFormat("123456789", "DE");

  assert.equal(result.formatValid, true);
  assert.equal(result.normalized, "DE123456789");
  assert.equal(result.countryCode, "DE");
  assert.match(result.warnings.join(" "), /country hint was used/i);
});

test("Greece country hint maps to the EL VAT prefix used by VIES", () => {
  const result = validateVatFormat("123456789", "GR");

  assert.equal(result.formatValid, true);
  assert.equal(result.normalized, "EL123456789");
  assert.equal(result.countryCode, "EL");
  assert.equal(result.countryName, "Greece");
});

test("country hint mismatch fails with a warning", () => {
  const result = validateVatFormat("DE123456789", "HU");

  assert.equal(result.formatValid, false);
  assert.equal(result.countryCode, "DE");
  assert.match(result.warnings.join(" "), /conflicts/i);
});

test("disclaimer is always included", () => {
  for (const result of [
    validateVatFormat("DE123456789"),
    validateVatFormat("DE123"),
    validateVatFormat(""),
    validateVatFormat("123456789", "DE")
  ]) {
    assert.match(result.disclaimer, /local VAT ID format check only/i);
    assert.equal(result.disclaimer, VAT_FORMAT_DISCLAIMER);
  }
});

test("VAT format results avoid VIES and official validity claims", () => {
  const resultText = JSON.stringify(validateVatFormat("DE123456789"));

  assert.doesNotMatch(resultText, /\bvies valid\b/i);
  assert.doesNotMatch(resultText, /verified/i);
  assert.doesNotMatch(resultText, /officially valid/i);
  assert.doesNotMatch(resultText, /confirmed by VIES/i);
});

test("VAT format warnings always preserve VIES boundary", () => {
  for (const result of [
    validateVatFormat("DE123456789"),
    validateVatFormat("DE123"),
    validateVatFormat(""),
    validateVatFormat("123456789", "DE")
  ]) {
    assert.match(result.warnings.join(" "), /technical only/i);
    assert.match(result.warnings.join(" "), /separate from VIES evidence/i);
  }
});

test("jurisdiction country normalization maps EL to GR for EU context", () => {
  assert.equal(normalizeJurisdictionCountryCode(" el "), "GR");
  assert.equal(normalizeJurisdictionCountryCode("gr"), "GR");
  assert.equal(normalizeJurisdictionCountryCode("DE"), "DE");
  assert.equal(normalizeJurisdictionCountryCode("USA"), null);
  assert.equal(normalizeJurisdictionCountryCode(undefined), null);
});

test("EU member state helper handles Greece alias and non-EU countries", () => {
  assert.equal(isEuMemberState("DE"), true);
  assert.equal(isEuMemberState("EL"), true);
  assert.equal(isEuMemberState("GR"), true);
  assert.equal(isEuMemberState("US"), false);
  assert.equal(isEuMemberState(undefined), false);
});

test("classifies intra-EU B2B service context with reverse-charge simulation warning", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "GR",
    sellerVatId: "DE123456789",
    buyerVatId: "EL123456789",
    buyerType: "business",
    transactionType: "services",
    buyerViesStatus: "not_checked",
    sellerViesStatus: "not_checked",
    countryPackVersions: {
      DE: "2026.05.1",
      GR: "2026.05.1"
    },
    countryPackStatuses: {
      DE: "professional_review_required",
      GR: "professional_review_required"
    },
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: true,
      xsdUblStatus: "passed",
      schematronPeppolStatus: "passed",
      schematronEn16931Status: "passed"
    }
  });

  assert.equal(result.transactionClass, "intra_eu_b2b_services");
  assert.equal(result.euContext.crossBorderEu, true);
  assert.equal(result.euContext.sellerIsEu, true);
  assert.equal(result.euContext.buyerIsEu, true);
  assert.equal(result.reverseChargeSimulation.relevance, "possible");
  assert.equal(result.reverseChargeSimulation.professionalReviewRequired, true);
  assert.equal(result.legalConfidence, "professional_review_required");
  assert.equal(result.vatIdEvidence.sellerFormatStatus, "valid");
  assert.equal(result.vatIdEvidence.buyerFormatStatus, "valid");
  assert.equal(result.vatIdEvidence.buyerViesStatus, "not_checked");
  assert.equal(result.structuredInvoiceEvidence.hasCanonicalInvoice, true);
  assert.equal(result.structuredInvoiceEvidence.hasUblXml, true);
  assert.equal(result.structuredInvoiceEvidence.hasCiiXml, false);
  assert.equal(result.structuredInvoiceEvidence.xsdUblStatus, "passed");
  assert.ok(
    result.findings.some(
      (finding) =>
        finding.code === "POSSIBLE_INTRA_EU_B2B_REVERSE_CHARGE_CONTEXT"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VAT_TREATMENT_PROFESSIONAL_REVIEW_REQUIRED"
    )
  );
  assert.ok(
    result.findings.some((finding) => finding.code === "UBL_XML_EVIDENCE_PRESENT")
  );
  assert.match(result.disclaimer, /educational technical simulations only/i);
});

test("classifies intra-EU B2B goods context separately from services", () => {
  const result = classifyTransaction({
    sellerCountry: "HU",
    buyerCountry: "DE",
    sellerVatId: "HU12345678",
    buyerVatId: "DE123456789",
    buyerType: "business",
    transactionType: "goods"
  });

  assert.equal(result.transactionClass, "intra_eu_b2b_goods");
  assert.equal(result.reverseChargeSimulation.relevance, "possible");
});

test("classifies digital_service and digital_services as intra-EU B2B services", () => {
  const singular = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "digital_service"
  });

  const plural = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "digital_services"
  });

  assert.equal(singular.transactionClass, "intra_eu_b2b_services");
  assert.equal(plural.transactionClass, "intra_eu_b2b_services");
  assert.equal(singular.reverseChargeSimulation.relevance, "possible");
  assert.equal(plural.reverseChargeSimulation.relevance, "possible");
});

test("classifies domestic transaction without reverse-charge relevance", () => {
  const result = classifyTransaction({
    sellerCountry: "HU",
    buyerCountry: "HU",
    sellerVatId: "HU12345678",
    buyerVatId: "HU87654321",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.transactionClass, "domestic");
  assert.equal(result.euContext.crossBorderEu, false);
  assert.equal(result.reverseChargeSimulation.relevance, "not_relevant");
  assert.match(result.reverseChargeSimulation.message, /No intra-EU B2B/i);
});

test("classifies EU to non-EU and non-EU to EU transaction contexts safely", () => {
  const euToNonEu = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "US",
    buyerType: "business",
    transactionType: "services"
  });

  const nonEuToEu = classifyTransaction({
    sellerCountry: "US",
    buyerCountry: "DE",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(euToNonEu.transactionClass, "eu_to_non_eu");
  assert.equal(nonEuToEu.transactionClass, "non_eu_to_eu");
  assert.equal(euToNonEu.reverseChargeSimulation.relevance, "not_relevant");
  assert.equal(nonEuToEu.reverseChargeSimulation.relevance, "not_relevant");
});

test("classifies intra-EU B2C context separately from B2B context", () => {
  const goods = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "FR",
    buyerType: "consumer",
    transactionType: "goods"
  });

  const services = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "FR",
    buyerType: "consumer",
    transactionType: "services"
  });

  assert.equal(goods.transactionClass, "intra_eu_b2c_goods");
  assert.equal(services.transactionClass, "intra_eu_b2c_services");
  assert.equal(goods.reverseChargeSimulation.relevance, "not_relevant");
  assert.equal(services.reverseChargeSimulation.relevance, "not_relevant");
});

test("classifies incomplete transaction context as unknown with review findings", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerType: "unknown",
    transactionType: "unknown"
  });

  assert.equal(result.transactionClass, "unknown");
  assert.equal(result.euContext.sellerCountry, "DE");
  assert.equal(result.euContext.buyerCountry, null);
  assert.equal(result.reverseChargeSimulation.relevance, "unknown");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "TRANSACTION_COUNTRY_CONTEXT_INCOMPLETE"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "BUYER_TYPE_REVIEW_REQUIRED"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "TRANSACTION_TYPE_REVIEW_REQUIRED"
    )
  );
});

test("buyer VAT ID missing in intra-EU B2B context produces a review finding", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.transactionClass, "intra_eu_b2b_services");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "BUYER_VAT_ID_REVIEW_REQUIRED"
    )
  );
  assert.match(result.vatIdEvidence.warnings.join(" "), /Buyer VAT ID/i);
});

test("invalid VAT format produces technical format findings without official conclusions", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123",
    buyerVatId: "HU123",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.vatIdEvidence.sellerFormatStatus, "invalid");
  assert.equal(result.vatIdEvidence.buyerFormatStatus, "invalid");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "SELLER_VAT_FORMAT_REVIEW_REQUIRED"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "BUYER_VAT_FORMAT_REVIEW_REQUIRED"
    )
  );
});

test("VIES unavailable is treated separately from invalid", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services",
    buyerViesStatus: "unavailable"
  });

  assert.equal(result.vatIdEvidence.buyerViesStatus, "unavailable");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "VIES_UNAVAILABLE_NOT_INVALID"
    )
  );
  assert.match(result.vatIdEvidence.warnings.join(" "), /not the same as invalid/i);
});

test("VIES not checked is represented explicitly when VAT IDs are present", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.vatIdEvidence.buyerViesStatus, "not_checked");
  assert.equal(result.vatIdEvidence.sellerViesStatus, "not_checked");
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "BUYER_VIES_EVIDENCE_NOT_CHECKED"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "SELLER_VIES_EVIDENCE_NOT_CHECKED"
    )
  );
});

test("structured invoice evidence defaults to missing and creates technical warnings", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.structuredInvoiceEvidence.hasCanonicalInvoice, false);
  assert.equal(result.structuredInvoiceEvidence.hasUblXml, false);
  assert.equal(result.structuredInvoiceEvidence.hasCiiXml, false);
  assert.equal(result.structuredInvoiceEvidence.xsdStatus, "not_checked");
  assert.ok(
    result.structuredInvoiceEvidence.warnings.some((warning) =>
      warning.includes("Canonical invoice evidence")
    )
  );
  assert.ok(
    result.findings.some(
      (finding) =>
        finding.code === "STRUCTURED_CANONICAL_INVOICE_EVIDENCE_MISSING"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "STRUCTURED_XML_EVIDENCE_MISSING"
    )
  );
});

test("UBL structured evidence is represented separately from CII evidence", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services",
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: true,
      hasCiiXml: false,
      xsdUblStatus: "passed",
      schematronPeppolStatus: "passed",
      schematronEn16931Status: "passed"
    }
  });

  assert.equal(result.structuredInvoiceEvidence.hasCanonicalInvoice, true);
  assert.equal(result.structuredInvoiceEvidence.hasUblXml, true);
  assert.equal(result.structuredInvoiceEvidence.hasCiiXml, false);
  assert.equal(result.structuredInvoiceEvidence.xsdUblStatus, "passed");
  assert.equal(result.structuredInvoiceEvidence.schematronPeppolStatus, "passed");
  assert.equal(result.structuredInvoiceEvidence.schematronEn16931Status, "passed");
  assert.ok(
    result.findings.some((finding) => finding.code === "UBL_XML_EVIDENCE_PRESENT")
  );
  assert.equal(
    result.findings.some((finding) => finding.code === "CII_XML_EVIDENCE_PRESENT"),
    false
  );
});

test("CII structured evidence is represented separately from UBL evidence", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services",
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: false,
      hasCiiXml: true,
      xsdCiiStatus: "passed",
      schematronEn16931Status: "passed"
    }
  });

  assert.equal(result.structuredInvoiceEvidence.hasCanonicalInvoice, true);
  assert.equal(result.structuredInvoiceEvidence.hasUblXml, false);
  assert.equal(result.structuredInvoiceEvidence.hasCiiXml, true);
  assert.equal(result.structuredInvoiceEvidence.xsdCiiStatus, "passed");
  assert.equal(result.structuredInvoiceEvidence.schematronEn16931Status, "passed");
  assert.ok(
    result.findings.some((finding) => finding.code === "CII_XML_EVIDENCE_PRESENT")
  );
  assert.equal(
    result.findings.some((finding) => finding.code === "UBL_XML_EVIDENCE_PRESENT"),
    false
  );
});

test("CII XSD not configured is not treated as successful validation", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services",
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasCiiXml: true,
      xsdCiiStatus: "not_configured"
    }
  });

  assert.equal(result.structuredInvoiceEvidence.hasCiiXml, true);
  assert.equal(result.structuredInvoiceEvidence.xsdCiiStatus, "not_configured");
  assert.ok(
    result.structuredInvoiceEvidence.warnings.some((warning) =>
      warning.includes("CII XSD evidence is not configured")
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "CII_XSD_EVIDENCE_NOT_CONFIGURED"
    )
  );
});

test("UBL XSD not configured is not treated as successful validation", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services",
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: true,
      xsdUblStatus: "not_configured"
    }
  });

  assert.equal(result.structuredInvoiceEvidence.hasUblXml, true);
  assert.equal(result.structuredInvoiceEvidence.xsdUblStatus, "not_configured");
  assert.ok(
    result.structuredInvoiceEvidence.warnings.some((warning) =>
      warning.includes("UBL XSD evidence is not configured")
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "UBL_XSD_EVIDENCE_NOT_CONFIGURED"
    )
  );
});

test("failed XML and Schematron evidence produces technical findings", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services",
    structuredInvoiceSignals: {
      hasCanonicalInvoice: true,
      hasUblXml: true,
      hasCiiXml: true,
      xsdStatus: "failed",
      xsdUblStatus: "failed",
      xsdCiiStatus: "failed",
      schematronPeppolStatus: "failed",
      schematronEn16931Status: "failed"
    }
  });

  assert.ok(
    result.findings.some(
      (finding) => finding.code === "GENERIC_XSD_EVIDENCE_FAILED"
    )
  );
  assert.ok(
    result.findings.some((finding) => finding.code === "UBL_XSD_EVIDENCE_FAILED")
  );
  assert.ok(
    result.findings.some((finding) => finding.code === "CII_XSD_EVIDENCE_FAILED")
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "PEPPOL_SCHEMATRON_EVIDENCE_FAILED"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "EN16931_SCHEMATRON_EVIDENCE_FAILED"
    )
  );
});

test("country pack context preserves versions and review statuses", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    buyerType: "business",
    transactionType: "services",
    countryPackVersions: {
      DE: "2026.05.1",
      HU: "2026.05.1"
    },
    countryPackStatuses: {
      DE: "professional_review_required",
      HU: "professional_review_required"
    }
  });

  assert.equal(result.countryPackContext.ruleVersions.DE, "2026.05.1");
  assert.equal(result.countryPackContext.ruleVersions.HU, "2026.05.1");
  assert.equal(
    result.countryPackContext.sellerCountryPackStatus,
    "professional_review_required"
  );
  assert.equal(
    result.countryPackContext.buyerCountryPackStatus,
    "professional_review_required"
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "SELLER_COUNTRY_PACK_REVIEW_REQUIRED"
    )
  );
  assert.ok(
    result.findings.some(
      (finding) => finding.code === "BUYER_COUNTRY_PACK_REVIEW_REQUIRED"
    )
  );
});

test("country pack context accepts EL alias while preserving GR jurisdiction keys", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "EL",
    buyerType: "business",
    transactionType: "services",
    countryPackVersions: {
      DE: "2026.05.1",
      EL: "2026.05.1"
    },
    countryPackStatuses: {
      DE: "professional_review_required",
      EL: "professional_review_required"
    }
  });

  assert.equal(result.euContext.buyerCountry, "GR");
  assert.equal(result.countryPackContext.ruleVersions.DE, "2026.05.1");
  assert.equal(result.countryPackContext.ruleVersions.GR, "2026.05.1");
  assert.equal(
    result.countryPackContext.buyerCountryPackStatus,
    "professional_review_required"
  );
});

test("transaction findings are versioned and source-linked", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services"
  });

  assert.ok(result.findings.length > 0);

  for (const finding of result.findings) {
    assert.ok(finding.code);
    assert.ok(finding.message);
    assert.ok(finding.fixSuggestion);
    assert.ok(finding.ruleSetCode);
    assert.ok(finding.ruleVersion);
    assert.ok(Array.isArray(finding.sourceRefIds));
    assert.ok(finding.sourceRefIds.length > 0);
    assert.ok(typeof finding.professionalReviewRequired === "boolean");
  }
});

test("transaction simulation includes all required disclaimers", () => {
  const result = classifyTransaction({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services"
  });

  assert.equal(result.disclaimer, TRANSACTION_SIMULATION_DISCLAIMER);
  assert.ok(result.disclaimers.includes(VAT_FORMAT_DISCLAIMER));
  assert.ok(result.disclaimers.includes(VIES_EVIDENCE_DISCLAIMER));
  assert.ok(result.disclaimers.includes(STRUCTURED_INVOICE_EVIDENCE_DISCLAIMER));
  assert.ok(result.disclaimers.includes(TRANSACTION_SIMULATION_DISCLAIMER));
});

test("transaction simulation avoids legal, tax, filing, and authority guarantee claims", () => {
  const resultText = JSON.stringify(
    classifyTransaction({
      sellerCountry: "DE",
      buyerCountry: "HU",
      sellerVatId: "DE123456789",
      buyerVatId: "HU12345678",
      buyerType: "business",
      transactionType: "services",
      buyerViesStatus: "valid",
      structuredInvoiceSignals: {
        hasCanonicalInvoice: true,
        hasUblXml: true,
        hasCiiXml: true,
        xsdUblStatus: "passed",
        xsdCiiStatus: "passed",
        schematronPeppolStatus: "passed",
        schematronEn16931Status: "passed"
      }
    })
  ).toLowerCase();

  assert.doesNotMatch(resultText, /legally compliant/);
  assert.doesNotMatch(resultText, /tax compliant/);
  assert.doesNotMatch(resultText, /official filing/);
  assert.doesNotMatch(resultText, /authority accepted/);
  assert.doesNotMatch(resultText, /accepted by authority/);
  assert.doesNotMatch(resultText, /guaranteed/);
  assert.doesNotMatch(resultText, /confirmed by vies/);
});
