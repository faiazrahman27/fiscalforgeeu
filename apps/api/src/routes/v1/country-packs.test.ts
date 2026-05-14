import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../app.js";

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
}

test("country pack list endpoint returns legal-safe country pack catalogue", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/country-packs"
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.count, 28);
  assert.match(String(body.disclaimer), /educational simulations/i);
  assert.match(String(body.disclaimer), /do not provide legal, tax, accounting/i);
  assert.match(String(body.registrySource), /^(database|bundled)$/);

  const countryPacks = body.countryPacks as Record<string, unknown>[];

  assert.equal(Array.isArray(countryPacks), true);
  assert.ok(countryPacks.some((pack) => pack.countryCode === "EU"));
  assert.ok(countryPacks.some((pack) => pack.countryCode === "HU"));
  assert.ok(countryPacks.some((pack) => pack.countryCode === "DE"));
  assert.ok(countryPacks.some((pack) => pack.countryCode === "GR"));
  assert.equal(countryPacks.some((pack) => pack.countryCode === "EL"), false);

  const euPack = countryPacks.find((pack) => pack.countryCode === "EU");

  assertPlainObject(euPack);
  assertPlainObject(euPack.registry);
  assert.match(String(euPack.registry.registrySource), /^(database|bundled)$/);
  assert.equal(typeof euPack.registry.packVersion, "string");
  assert.equal(typeof euPack.registry.summary, "string");
  assertPlainObject(euPack.registry.capabilities);
});

test("country pack detail endpoint returns Hungary pack with registry metadata", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/country-packs/HU"
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const countryPack = body.countryPack as Record<string, unknown>;

  assert.equal(countryPack.countryCode, "HU");
  assert.equal(countryPack.countryName, "Hungary");
  assert.equal(countryPack.defaultCurrency, "HUF");
  assert.equal(countryPack.legalConfidence, "professional_review_required");
  assert.equal(countryPack.status, "beta");
  assert.equal(typeof countryPack.version, "string");
  assert.equal(typeof countryPack.reviewerLabel, "string");
  assert.match(String(body.disclaimer), /Country rule packs/i);
  assert.match(String(body.registrySource), /^(database|bundled)$/);

  assertPlainObject(countryPack.vatNumber);
  assertPlainObject(countryPack.vatRates);
  assertPlainObject(countryPack.eInvoicingStatus);
  assertPlainObject(countryPack.sourceCoverageSummary);
  assert.equal(
    (countryPack.sourceCoverageSummary as Record<string, unknown>).vatRates,
    "not_reviewed"
  );
  assert.equal(Array.isArray(countryPack.sourceReferences), true);
  assert.equal(Array.isArray(countryPack.warnings), true);
  assert.match(JSON.stringify(countryPack), /professional review/i);

  assertPlainObject(countryPack.registry);
  assert.match(String(countryPack.registry.registrySource), /^(database|bundled)$/);
  assert.equal(typeof countryPack.registry.packVersion, "string");
  assert.equal(typeof countryPack.registry.summary, "string");
  assert.equal(typeof countryPack.registry.disclaimer, "string");
  assertPlainObject(countryPack.registry.capabilities);
});

test("country pack detail endpoint maps Greece EL alias to GR pack", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/country-packs/EL"
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const countryPack = body.countryPack as Record<string, unknown>;
  const vatNumber = countryPack.vatNumber as Record<string, unknown>;

  assert.equal(countryPack.countryCode, "GR");
  assert.equal(countryPack.countryName, "Greece");
  assert.equal(vatNumber.prefix, "EL");
});

test("country pack detail endpoint normalizes lowercase country code", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/country-packs/de"
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const countryPack = body.countryPack as Record<string, unknown>;

  assert.equal(countryPack.countryCode, "DE");
  assert.equal(countryPack.countryName, "Germany");
  assertPlainObject(countryPack.registry);
});

test("country pack detail endpoint returns 404 for unsupported country", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/country-packs/US"
  });

  assert.equal(response.statusCode, 404);
  assert.match(response.body, /COUNTRY_PACK_NOT_FOUND/);
  assert.match(response.body, /not currently supported/i);
});

test("country pack detail endpoint rejects malformed country code", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/country-packs/HUNGARY"
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /INVALID_COUNTRY_CODE/);
  assert.match(response.body, /two-letter/i);
});
