import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractVatCountry,
  getVatFormatCountryName,
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
  }
});

test("results avoid VIES and official validity claims", () => {
  const resultText = JSON.stringify(validateVatFormat("DE123456789"));

  assert.doesNotMatch(resultText, /vies valid/i);
  assert.doesNotMatch(resultText, /verified/i);
  assert.doesNotMatch(resultText, /officially valid/i);
  assert.doesNotMatch(resultText, /confirmed by VIES/i);
});
