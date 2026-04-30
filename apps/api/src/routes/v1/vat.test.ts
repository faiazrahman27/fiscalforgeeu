import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";

const vatCheckDataPath = join(process.cwd(), ".data", "vat-number-checks.json");
const vatCheckMigrationPath = join(
  process.cwd(),
  "..",
  "..",
  "supabase",
  "migrations",
  "024_create_vat_number_checks.sql"
);

let originalVatCheckData: string | null = null;

before(async () => {
  try {
    originalVatCheckData = await readFile(vatCheckDataPath, "utf8");
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }

    originalVatCheckData = null;
  }

  await rm(vatCheckDataPath, {
    force: true
  });
});

after(async () => {
  if (originalVatCheckData === null) {
    await rm(vatCheckDataPath, {
      force: true
    });
    return;
  }

  await mkdir(dirname(vatCheckDataPath), {
    recursive: true
  });
  await writeFile(vatCheckDataPath, originalVatCheckData, "utf8");
});

function apiHeaders() {
  return {
    "x-api-key": env.DEV_API_KEY,
    "content-type": "application/json"
  };
}

function isFileNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecordsFromResponse(value: unknown) {
  assert.equal(isPlainObject(value), true);
  const records = (value as Record<string, unknown>).records;
  assert.equal(Array.isArray(records), true);

  return records as Record<string, unknown>[];
}

test("VAT number checks migration creates local-format evidence table", async () => {
  const migrationSql = await readFile(vatCheckMigrationPath, "utf8");

  assert.match(migrationSql, /create table if not exists public\.vat_number_checks/i);
  assert.match(migrationSql, /party_role.*seller.*buyer.*other/is);
  assert.match(migrationSql, /check_level.*local_format/is);
  assert.match(migrationSql, /source.*invoice_lantern_vat_format_rules/is);
  assert.match(migrationSql, /vat_id_fingerprint.*\{64\}/is);
  assert.match(migrationSql, /enable row level security/i);
  assert.match(migrationSql, /Workspace members can read VAT number checks/i);
  assert.match(migrationSql, /Workspace members can create VAT number checks/i);
});

test("VAT format endpoint returns a valid local format response", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/validate-format",
    headers: apiHeaders(),
    payload: JSON.stringify({
      vatId: "HU12345678",
      countryHint: "HU"
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.input, "HU12345678");
  assert.equal(body.normalized, "HU12345678");
  assert.equal(body.countryCode, "HU");
  assert.equal(body.formatValid, true);
  assert.equal(body.checkLevel, "local_format");
  assert.equal(body.source, "invoice_lantern_vat_format_rules");
  assert.match(String(body.message), /local format pattern for Hungary/i);
  assert.equal(Array.isArray(body.warnings), true);
  assert.equal((body.warnings as unknown[]).length, 0);
  assert.equal(body.persisted, false);
  assert.equal("checkRecordId" in body, false);
});

test("VAT format endpoint returns invalid local format response for malformed values", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/validate-format",
    headers: apiHeaders(),
    payload: JSON.stringify({
      vatId: "HU123",
      countryHint: "HU"
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.input, "HU123");
  assert.equal(body.normalized, "HU123");
  assert.equal(body.countryCode, "HU");
  assert.equal(body.formatValid, false);
  assert.match(String(body.message), /does not match/i);
  assert.equal(Array.isArray(body.warnings), true);
  assert.match(String(body.disclaimer), /local VAT ID format check only/i);
});

test("VAT format endpoint does not claim VIES validity", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/validate-format",
    headers: apiHeaders(),
    payload: JSON.stringify({
      vatId: "DE123456789"
    })
  });

  assert.equal(response.statusCode, 200);

  const bodyText = response.body;

  assert.match(bodyText, /not confirm/i);
  assert.doesNotMatch(bodyText, /vies valid/i);
  assert.doesNotMatch(bodyText, /officially valid/i);
  assert.doesNotMatch(bodyText, /verified/i);
  assert.doesNotMatch(bodyText, /proof of VAT registration/i);
});

test("VAT format endpoint does not call external network", async (t) => {
  const app = await buildApp();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  t.after(async () => {
    globalThis.fetch = originalFetch;
    await app.close();
  });

  globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
    fetchCalls += 1;
    throw new Error("External network calls are not allowed in VAT format tests.");
  }) as typeof fetch;

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/validate-format",
    headers: apiHeaders(),
    payload: JSON.stringify({
      vatId: "XI123456789"
    })
  });

  assert.equal(response.statusCode, 200);
  assert.equal(fetchCalls, 0);
});

test("VAT format endpoint persists a metadata-only evidence record when requested", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/validate-format",
    headers: apiHeaders(),
    payload: JSON.stringify({
      vatId: " de 123 456 789 ",
      countryHint: "DE",
      persist: true,
      invoiceDraftId: "draft-vat-1",
      validationRunId: "validation-vat-1",
      partyRole: "seller"
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.normalized, "DE123456789");
  assert.equal(body.formatValid, true);
  assert.equal(body.persisted, true);
  assert.equal(typeof body.checkRecordId, "string");
  assert.match(String(body.disclaimer), /local VAT ID format check only/i);

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/vat/checks?invoiceDraftId=draft-vat-1&validationRunId=validation-vat-1&partyRole=seller&limit=10",
    headers: apiHeaders()
  });

  assert.equal(listResponse.statusCode, 200);

  const records = getRecordsFromResponse(listResponse.json());
  const listedRecord = records.find((record) => record.id === body.checkRecordId);

  assert.ok(listedRecord);
  assert.equal(listedRecord.invoiceDraftId, "draft-vat-1");
  assert.equal(listedRecord.validationRunId, "validation-vat-1");
  assert.equal(listedRecord.partyRole, "seller");
  assert.equal(listedRecord.inputCountryHint, "DE");
  assert.equal(listedRecord.detectedCountryCode, "DE");
  assert.equal(listedRecord.normalizedVatId, "DE123456789");
  assert.equal(listedRecord.checkLevel, "local_format");
  assert.equal(listedRecord.source, "invoice_lantern_vat_format_rules");
  assert.equal(listedRecord.formatValid, true);
  assert.equal(Array.isArray(listedRecord.warnings), true);
  assert.match(String(listedRecord.disclaimer), /does not confirm/i);
  assert.equal("vatIdFingerprint" in listedRecord, false);
  assert.equal("fingerprint" in listedRecord, false);

  const buyerFilteredResponse = await app.inject({
    method: "GET",
    url: "/api/v1/vat/checks?partyRole=buyer&limit=10",
    headers: apiHeaders()
  });

  assert.equal(buyerFilteredResponse.statusCode, 200);
  assert.equal(getRecordsFromResponse(buyerFilteredResponse.json()).length, 0);

  const rawStoredChecks = await readFile(vatCheckDataPath, "utf8");
  const storedPayload = JSON.parse(rawStoredChecks) as Record<string, unknown>;
  const storedRecords = getRecordsFromResponse(storedPayload);
  const storedRecord = storedRecords.find(
    (record) => record.id === body.checkRecordId
  );

  assert.ok(storedRecord);
  assert.equal(storedRecord.normalizedVatId, "DE123456789");
  assert.match(String(storedRecord.vatIdFingerprint), /^[a-f0-9]{64}$/);
  assert.notEqual(storedRecord.vatIdFingerprint, storedRecord.normalizedVatId);
  assert.equal("input" in storedRecord, false);
  assert.equal("vatId" in storedRecord, false);
  assert.doesNotMatch(rawStoredChecks, / de 123 456 789 /i);
});

test("VAT check history response stays within local-format wording", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/vat/checks?limit=10",
    headers: apiHeaders()
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /local format/i);
  assert.doesNotMatch(response.body, /VIES valid/i);
  assert.doesNotMatch(response.body, /officially valid/i);
  assert.doesNotMatch(response.body, /proof of VAT registration/i);
});
