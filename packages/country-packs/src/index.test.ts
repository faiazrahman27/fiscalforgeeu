import assert from "node:assert/strict";
import test from "node:test";

import {
  COUNTRY_PACK_DISCLAIMER,
  EU_CORE_COUNTRY_PACK,
  assertCountryPacksValid,
  getCountryPack,
  getEuMemberStateCountryCodes,
  isEuMemberStateCountryCode,
  isSupportedCountryPack,
  listCountryCodes,
  listCountryPackValidationIssues,
  listCountryPacks,
  requireCountryPack
} from "./index.js";

const EU_MEMBER_STATES = [
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
] as const;

const SAFE_UNKNOWN_VALUES = new Set([
  null,
  "unknown",
  "not_reviewed",
  "professional_review_required",
  "eu_core_only"
]);

const ALLOWED_PACK_STATUSES = new Set([
  "eu_core_only",
  "draft",
  "beta",
  "reviewed",
  "reviewed_public_sources",
  "professional_review_required",
  "deprecated",
  "suspended"
]);

const ALLOWED_LEGAL_CONFIDENCE = new Set([
  "technical",
  "standard_based",
  "official_source_derived",
  "educational_simulation",
  "professional_review_required"
]);

const ALLOWED_SOURCE_TYPES = new Set([
  "eu",
  "national_authority",
  "standards_body",
  "internal_policy",
  "professional_review_required",
  "eu_law",
  "eu_guidance",
  "national_tax_authority",
  "national_einvoicing_authority",
  "standard",
  "peppol",
  "vies",
  "country_pack",
  "legal_notice",
  "other"
]);

test("lists EU core and all 27 EU member state country packs", () => {
  const countryCodes = listCountryCodes();

  assert.ok(countryCodes.includes("EU"));
  assert.equal(countryCodes.length, 28);
  assert.deepEqual(
    getEuMemberStateCountryCodes().sort(),
    [...EU_MEMBER_STATES].sort()
  );

  for (const countryCode of EU_MEMBER_STATES) {
    assert.ok(countryCodes.includes(countryCode), `${countryCode} is missing`);
  }

  assert.equal(countryCodes.includes("EL"), false);
});

test("country pack validation helper accepts the built-in pack registry", () => {
  assert.doesNotThrow(() => assertCountryPacksValid());

  for (const pack of listCountryPacks()) {
    const issues = listCountryPackValidationIssues(pack);
    const fatalIssues = issues.filter((issue) => issue.severity === "fatal");

    assert.deepEqual(
      fatalIssues,
      [],
      `${pack.countryCode} has fatal validation issues: ${JSON.stringify(
        fatalIssues
      )}`
    );
  }
});

test("returns cloned country packs so callers cannot mutate module state", () => {
  const first = requireCountryPack("HU");
  first.countryName = "Changed";
  first.sourceReferences[0]!.title = "Changed";
  first.sourceRefs[0]!.label = "Changed";
  first.vatRates.reduced.push("99%");
  first.disclaimers.push("Changed disclaimer");

  const second = requireCountryPack("HU");

  assert.equal(second.countryName, "Hungary");
  assert.notEqual(second.sourceReferences[0]!.title, "Changed");
  assert.notEqual(second.sourceRefs[0]!.label, "Changed");
  assert.equal(second.vatRates.reduced.includes("99%"), false);
  assert.equal(second.disclaimers.includes("Changed disclaimer"), false);
});

test("normalizes country code input and maps Greece EL VAT prefix to GR pack", () => {
  const pack = getCountryPack(" hu ");
  const greece = getCountryPack("el");

  assert.equal(pack?.countryCode, "HU");
  assert.equal(pack?.defaultCurrency, "HUF");
  assert.equal(greece?.countryCode, "GR");
  assert.equal(greece?.vatNumber.prefix, "EL");
  assert.equal(isSupportedCountryPack("EL"), true);
  assert.equal(isEuMemberStateCountryCode("EL"), true);
  assert.equal(isEuMemberStateCountryCode("US"), false);
});

test("returns null for unsupported country pack", () => {
  assert.equal(getCountryPack("US"), null);
  assert.equal(isSupportedCountryPack("US"), false);
});

test("throws for required unsupported country pack", () => {
  assert.throws(() => requireCountryPack("US"), /Unsupported country pack/);
});

test("keeps legal-safe country pack disclaimer", () => {
  assert.equal(EU_CORE_COUNTRY_PACK.disclaimer, COUNTRY_PACK_DISCLAIMER);
  assert.match(COUNTRY_PACK_DISCLAIMER, /educational simulations/);
  assert.match(COUNTRY_PACK_DISCLAIMER, /do not provide legal, tax, accounting/);
  assert.match(COUNTRY_PACK_DISCLAIMER, /official/);
  assert.match(COUNTRY_PACK_DISCLAIMER, /compliance advice/);
});

test("each country pack exposes required full-platform metadata", () => {
  const packs = listCountryPacks();

  for (const pack of packs) {
    assert.ok(pack.countryCode);
    assert.ok(pack.countryName);
    assert.ok(pack.defaultCurrency);
    assert.ok(ALLOWED_PACK_STATUSES.has(pack.status));
    assert.ok(pack.version);
    assert.ok(pack.packVersion);
    assert.equal(pack.version, pack.packVersion);
    assert.ok(ALLOWED_LEGAL_CONFIDENCE.has(pack.legalConfidence));
    assert.ok(pack.reviewerLabel);
    assert.ok(typeof pack.professionalReviewRequired === "boolean");
    assert.ok(pack.disclaimer);
    assert.ok(Array.isArray(pack.disclaimers));
    assert.ok(pack.disclaimers.length > 0);
    assert.ok(Array.isArray(pack.warnings));
    assert.ok(pack.warnings.length > 0);
    assert.ok(Array.isArray(pack.sourceReferences));
    assert.ok(pack.sourceReferences.length > 0);
    assert.ok(Array.isArray(pack.sourceRefs));
    assert.equal(pack.sourceRefs.length, pack.sourceReferences.length);
    assert.ok(pack.vatNumber.prefix);
    assert.ok(pack.vatNumber.pattern);
    assert.ok(pack.vatNumber.exampleMasked);
    assert.ok(typeof pack.vatNumber.localFormatCheck === "boolean");
    assert.ok(typeof pack.vatNumber.checksumCheck === "boolean");
    assert.ok(pack.vatNumber.notes);
    assert.ok(pack.vatRates);
    assert.ok(pack.vatRates.notes);
    assert.ok(pack.vatRates.exemptNotes);
    assert.ok(pack.vatRates.confidenceStatus);
    assert.ok(pack.vatRates.status);
    assert.ok(pack.eInvoicingStatus);
    assert.ok(pack.eInvoicingStatus.notes);
    assert.ok(pack.eInvoicingStatus.platformNotes);
    assert.ok(pack.eInvoicingStatus.effectiveDateNotes);
    assert.ok(pack.eInvoicingStatus.reportingModel);
    assert.ok(pack.eInvoicingStatus.confidenceStatus);
    assert.ok(pack.eInvoicingStatus.status);
    assert.ok(pack.transactionNotes);
    assert.ok(pack.transactionNotes.domestic);
    assert.ok(pack.transactionNotes.intraEuB2bGoods);
    assert.ok(pack.transactionNotes.intraEuB2bServices);
    assert.ok(pack.transactionNotes.intraEuB2c);
    assert.ok(pack.transactionNotes.nonEu);
    assert.ok(pack.sourceCoverageSummary.overall);
    assert.ok(Array.isArray(pack.sourceCoverageSummary.missingSourceWarnings));
  }
});

test("source references include reviewed source metadata", () => {
  for (const pack of listCountryPacks()) {
    for (const sourceReference of pack.sourceReferences) {
      assert.ok(sourceReference.id);
      assert.ok(sourceReference.label);
      assert.ok(sourceReference.title);
      assert.ok(sourceReference.publisher);
      assert.ok(sourceReference.jurisdiction);
      assert.ok(sourceReference.url);
      assert.ok(sourceReference.sourceType);
      assert.ok(
        ALLOWED_SOURCE_TYPES.has(sourceReference.sourceType),
        `${sourceReference.id} uses unsupported sourceType ${sourceReference.sourceType}`
      );
      assert.ok(sourceReference.reviewedAt);
      assert.ok(sourceReference.confidenceStatus);
      assert.ok(sourceReference.confidence);
    }
  }
});

test("sourceReferences and sourceRefs stay compatible", () => {
  for (const pack of listCountryPacks()) {
    assert.deepEqual(
      pack.sourceRefs.map((source) => source.id),
      pack.sourceReferences.map((source) => source.id)
    );
  }
});

test("every source reference used by pack sections resolves to source metadata", () => {
  for (const pack of listCountryPacks()) {
    const sourceIds = new Set(pack.sourceReferences.map((source) => source.id));
    const referencedIds = [
      ...pack.vatNumber.sourceRefIds,
      ...pack.vatRates.sourceRefIds,
      ...pack.eInvoicingStatus.sourceRefIds,
      ...pack.transactionNotes.sourceRefIds,
      ...pack.rules.flatMap((rule) => rule.sourceRefIds),
      ...pack.warnings.flatMap((warning) => warning.sourceRefIds ?? [])
    ];

    for (const sourceRefId of referencedIds) {
      assert.ok(
        sourceIds.has(sourceRefId),
        `${pack.countryCode} references missing source ${sourceRefId}`
      );
    }
  }
});

test("every rule source reference resolves to source metadata", () => {
  for (const pack of listCountryPacks()) {
    const sourceIds = new Set(pack.sourceReferences.map((source) => source.id));

    for (const rule of pack.rules) {
      assert.ok(rule.code);
      assert.ok(rule.title);
      assert.ok(rule.message);
      assert.ok(rule.version);
      assert.ok(rule.reviewStatus);
      assert.ok(ALLOWED_LEGAL_CONFIDENCE.has(rule.legalConfidence));
      assert.ok(typeof rule.professionalReviewRequired === "boolean");
      assert.ok(rule.sourceRefs.length > 0, `${rule.code} has no source refs`);
      assert.deepEqual(rule.sourceRefs, rule.sourceRefIds);

      for (const sourceRefId of rule.sourceRefIds) {
        assert.ok(
          sourceIds.has(sourceRefId),
          `${rule.code} references missing source ${sourceRefId}`
        );
      }
    }
  }
});

test("reviewed or reviewed-public-source rules always have source references", () => {
  for (const pack of listCountryPacks()) {
    for (const rule of pack.rules) {
      if (
        rule.reviewStatus === "reviewed" ||
        rule.reviewStatus === "reviewed_public_sources"
      ) {
        assert.ok(
          rule.sourceRefIds.length > 0,
          `${pack.countryCode} reviewed rule ${rule.code} has no source refs`
        );
      }
    }
  }
});

test("legal and tax-like findings do not claim compliance or authority acceptance", () => {
  const serialized = JSON.stringify(listCountryPacks()).toLowerCase();

  assert.doesNotMatch(serialized, /certified compliance/);
  assert.doesNotMatch(serialized, /legally compliant/);
  assert.doesNotMatch(serialized, /tax compliant/);
  assert.doesNotMatch(serialized, /authority accepted/);
  assert.doesNotMatch(serialized, /accepted by authority/);
  assert.doesNotMatch(serialized, /guaranteed compliance/);
  assert.doesNotMatch(serialized, /guaranteed legal/);
  assert.doesNotMatch(serialized, /guaranteed tax/);
});

test("unknown or unreviewed national data is represented safely instead of invented", () => {
  for (const countryCode of EU_MEMBER_STATES) {
    const pack = requireCountryPack(countryCode);

    assert.equal(SAFE_UNKNOWN_VALUES.has(pack.vatRates.standard), true);
    assert.equal(pack.vatRates.reduced.length, 0);
    assert.equal(pack.vatRates.superReduced.length, 0);
    assert.equal(pack.vatRates.parking.length, 0);
    assert.equal(pack.vatRates.zero.length, 0);
    assert.equal(pack.vatRates.confidenceStatus, "not_reviewed");
    assert.equal(pack.vatRates.status, "not_reviewed");
    assert.equal(pack.eInvoicingStatus.b2bDomestic, "unknown");
    assert.equal(pack.eInvoicingStatus.clearanceModel, "unknown");
    assert.equal(pack.eInvoicingStatus.reportingModel, "unknown");
    assert.equal(
      pack.eInvoicingStatus.confidenceStatus,
      "professional_review_required"
    );
    assert.equal(pack.eInvoicingStatus.status, "professional_review_required");
    assert.equal(pack.professionalReviewRequired, true);
    assert.ok(
      pack.warnings.some((warning) =>
        warning.code.endsWith("VAT_RATE_NOT_REVIEWED")
      )
    );
    assert.ok(
      pack.sourceCoverageSummary.missingSourceWarnings.some((warning) =>
        warning.includes("not represented")
      )
    );
  }
});

test("VAT local patterns remain executable for safe example formats", () => {
  for (const countryCode of EU_MEMBER_STATES) {
    const pack = requireCountryPack(countryCode);
    const expression = new RegExp(pack.vatNumber.pattern);

    assert.ok(pack.vatNumber.exampleFormat);
    assert.ok(pack.vatNumber.exampleMasked);
    assert.equal(
      expression.test(pack.vatNumber.exampleFormat ?? ""),
      true,
      `${countryCode} example should match local VAT pattern`
    );
  }
});

test("VAT local format metadata never presents local format as VIES validity", () => {
  for (const pack of listCountryPacks()) {
    const serializedVatRule = JSON.stringify(pack.vatNumber).toLowerCase();

    assert.match(serializedVatRule, /local/);
    assert.doesNotMatch(serializedVatRule, /vies valid/);
    assert.doesNotMatch(serializedVatRule, /vies-valid/);
    assert.doesNotMatch(serializedVatRule, /official acceptance/);
    assert.doesNotMatch(serializedVatRule, /registration confirmed/);
  }
});

test("EU member state packs are conservative and professional-review required", () => {
  for (const countryCode of EU_MEMBER_STATES) {
    const pack = requireCountryPack(countryCode);

    assert.equal(pack.euMemberState, true);
    assert.equal(pack.status, "professional_review_required");
    assert.equal(pack.legalConfidence, "professional_review_required");
    assert.equal(pack.sourceCoverageSummary.overall, "professional_review_required");
    assert.ok(
      pack.warnings.some(
        (warning) => warning.code === "COUNTRY_PACK_REVIEW_REQUIRED"
      )
    );
  }
});

test("EU core pack remains source-linked but does not become a national rule pack", () => {
  assert.equal(EU_CORE_COUNTRY_PACK.countryCode, "EU");
  assert.equal(EU_CORE_COUNTRY_PACK.euMemberState, false);
  assert.equal(EU_CORE_COUNTRY_PACK.status, "reviewed_public_sources");
  assert.equal(EU_CORE_COUNTRY_PACK.vatRates.standard, null);
  assert.equal(EU_CORE_COUNTRY_PACK.vatRates.status, "eu_core_only");
  assert.equal(EU_CORE_COUNTRY_PACK.eInvoicingStatus.b2bCrossBorder, "eu_core");
  assert.equal(EU_CORE_COUNTRY_PACK.professionalReviewRequired, true);
});
