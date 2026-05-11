import assert from "node:assert/strict";
import test from "node:test";

import {
  COUNTRY_PACK_DISCLAIMER,
  EU_CORE_COUNTRY_PACK,
  getCountryPack,
  isSupportedCountryPack,
  listCountryCodes,
  listCountryPacks,
  requireCountryPack
} from "./index.js";

test("lists EU core and all EU member state country packs", () => {
  const countryCodes = listCountryCodes();

  assert.ok(countryCodes.includes("EU"));
  assert.ok(countryCodes.includes("HU"));
  assert.ok(countryCodes.includes("DE"));
  assert.ok(countryCodes.includes("IT"));
  assert.equal(countryCodes.length, 28);
});

test("returns cloned country packs so callers cannot mutate module state", () => {
  const first = requireCountryPack("HU");
  first.countryName = "Changed";

  const second = requireCountryPack("HU");

  assert.equal(second.countryName, "Hungary");
});

test("normalizes country code input", () => {
  const pack = getCountryPack(" hu ");

  assert.equal(pack?.countryCode, "HU");
  assert.equal(pack?.defaultCurrency, "HUF");
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
});

test("country packs expose source references and professional review warning", () => {
  const packs = listCountryPacks();

  for (const pack of packs) {
    assert.ok(pack.sourceReferences.length > 0);
    assert.ok(pack.warnings.some((warning) => warning.code === "COUNTRY_REVIEW_REQUIRED"));
    assert.equal(pack.legalConfidence, "educational_simulation");
  }
});
