import assert from "node:assert/strict";
import test from "node:test";

import {
  COUNTRY_PACK_DISCLAIMER,
  EU_CORE_COUNTRY_PACK,
  getCountryPack,
  getEuMemberStateCountryCodes,
  isSupportedCountryPack,
  listCountryCodes,
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

test("lists EU core and all 27 EU member state country packs", () => {
  const countryCodes = listCountryCodes();

  assert.ok(countryCodes.includes("EU"));
  assert.equal(countryCodes.length, 28);
  assert.deepEqual(getEuMemberStateCountryCodes().sort(), [...EU_MEMBER_STATES].sort());

  for (const countryCode of EU_MEMBER_STATES) {
    assert.ok(countryCodes.includes(countryCode), `${countryCode} is missing`);
  }

  assert.equal(countryCodes.includes("EL"), false);
});

test("returns cloned country packs so callers cannot mutate module state", () => {
  const first = requireCountryPack("HU");
  first.countryName = "Changed";
  first.sourceReferences[0]!.title = "Changed";
  first.vatRates.reduced.push("99%");

  const second = requireCountryPack("HU");

  assert.equal(second.countryName, "Hungary");
  assert.notEqual(second.sourceReferences[0]!.title, "Changed");
  assert.equal(second.vatRates.reduced.includes("99%"), false);
});

test("normalizes country code input and maps Greece EL VAT prefix to GR pack", () => {
  const pack = getCountryPack(" hu ");
  const greece = getCountryPack("el");

  assert.equal(pack?.countryCode, "HU");
  assert.equal(pack?.defaultCurrency, "HUF");
  assert.equal(greece?.countryCode, "GR");
  assert.equal(greece?.vatNumber.prefix, "EL");
  assert.equal(isSupportedCountryPack("EL"), true);
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
    assert.ok(pack.status);
    assert.ok(pack.version);
    assert.ok(pack.legalConfidence);
    assert.ok(pack.reviewerLabel);
    assert.ok(pack.disclaimer);
    assert.ok(Array.isArray(pack.warnings));
    assert.ok(pack.warnings.length > 0);
    assert.ok(Array.isArray(pack.sourceReferences));
    assert.ok(pack.sourceReferences.length > 0);
    assert.ok(pack.vatNumber.prefix);
    assert.ok(pack.vatNumber.pattern);
    assert.ok(typeof pack.vatNumber.localFormatCheck === "boolean");
    assert.ok(typeof pack.vatNumber.checksumCheck === "boolean");
    assert.ok(pack.vatNumber.notes);
    assert.ok(pack.vatRates);
    assert.ok(pack.vatRates.notes);
    assert.ok(pack.vatRates.confidenceStatus);
    assert.ok(pack.eInvoicingStatus);
    assert.ok(pack.eInvoicingStatus.platformNotes);
    assert.ok(pack.eInvoicingStatus.effectiveDateNotes);
    assert.ok(pack.eInvoicingStatus.confidenceStatus);
    assert.ok(pack.sourceCoverageSummary.overall);
    assert.ok(Array.isArray(pack.sourceCoverageSummary.missingSourceWarnings));
  }
});

test("source references include reviewed source metadata", () => {
  for (const pack of listCountryPacks()) {
    for (const sourceReference of pack.sourceReferences) {
      assert.ok(sourceReference.id);
      assert.ok(sourceReference.title);
      assert.ok(sourceReference.publisher);
      assert.ok(sourceReference.jurisdiction);
      assert.ok(sourceReference.url);
      assert.ok(sourceReference.sourceType);
      assert.ok(sourceReference.reviewedAt);
      assert.ok(sourceReference.confidenceStatus);
      assert.ok(sourceReference.confidence);
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

test("legal and tax-like findings do not claim compliance or authority acceptance", () => {
  const serialized = JSON.stringify(listCountryPacks()).toLowerCase();

  assert.doesNotMatch(serialized, /certified compliance/);
  assert.doesNotMatch(serialized, /legally compliant/);
  assert.doesNotMatch(serialized, /tax compliant/);
  assert.doesNotMatch(serialized, /authority accepted/);
  assert.doesNotMatch(serialized, /official filing/);
  assert.doesNotMatch(serialized, /guaranteed/);
});

test("unknown or unreviewed national data is represented safely instead of invented", () => {
  for (const countryCode of EU_MEMBER_STATES) {
    const pack = requireCountryPack(countryCode);

    assert.equal(SAFE_UNKNOWN_VALUES.has(pack.vatRates.standard), true);
    assert.equal(pack.vatRates.reduced.length, 0);
    assert.equal(pack.vatRates.confidenceStatus, "not_reviewed");
    assert.equal(pack.eInvoicingStatus.b2bDomestic, "unknown");
    assert.equal(pack.eInvoicingStatus.clearanceModel, "unknown");
    assert.equal(
      pack.eInvoicingStatus.confidenceStatus,
      "professional_review_required"
    );
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
    assert.equal(
      expression.test(pack.vatNumber.exampleFormat ?? ""),
      true,
      `${countryCode} example should match local VAT pattern`
    );
  }
});
