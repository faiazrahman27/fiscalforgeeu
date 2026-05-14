import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import {
  resetViesServiceTestingOverrides,
  setViesServiceConfigForTesting,
  setViesTransportForTesting
} from "../../services/vies-check-service.js";

const vatCheckDataPath = join(process.cwd(), ".data", "vat-number-checks.json");
const viesEvidenceDataPath = join(
  process.cwd(),
  ".data",
  "vies-evidence-checks.json"
);
const vatCheckMigrationPath = join(
  process.cwd(),
  "..",
  "..",
  "supabase",
  "migrations",
  "024_create_vat_number_checks.sql"
);
const viesEvidenceMigrationPath = join(
  process.cwd(),
  "..",
  "..",
  "supabase",
  "migrations",
  "037_expand_validation_rules_and_vies_evidence.sql"
);

let originalVatCheckData: string | null = null;
let originalViesEvidenceData: string | null = null;

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

  try {
    originalViesEvidenceData = await readFile(viesEvidenceDataPath, "utf8");
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }

    originalViesEvidenceData = null;
  }

  await rm(viesEvidenceDataPath, {
    force: true
  });
});

after(async () => {
  resetViesServiceTestingOverrides();

  if (originalVatCheckData === null) {
    await rm(vatCheckDataPath, {
      force: true
    });
  } else {
    await mkdir(dirname(vatCheckDataPath), {
      recursive: true
    });
    await writeFile(vatCheckDataPath, originalVatCheckData, "utf8");
  }

  if (originalViesEvidenceData === null) {
    await rm(viesEvidenceDataPath, {
      force: true
    });
  } else {
    await mkdir(dirname(viesEvidenceDataPath), {
      recursive: true
    });
    await writeFile(viesEvidenceDataPath, originalViesEvidenceData, "utf8");
  }
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

function buildViesSoapResponse(input: {
  countryCode: string;
  vatNumber: string;
  valid: boolean;
  name?: string;
  address?: string;
  requestIdentifier?: string;
}) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    "<soap:Body>",
    '<checkVatResponse xmlns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">',
    `<countryCode>${input.countryCode}</countryCode>`,
    `<vatNumber>${input.vatNumber}</vatNumber>`,
    "<requestDate>2026-05-14+02:00</requestDate>",
    `<valid>${input.valid ? "true" : "false"}</valid>`,
    `<name>${input.name ?? "---"}</name>`,
    `<address>${input.address ?? "---"}</address>`,
    input.requestIdentifier
      ? `<requestIdentifier>${input.requestIdentifier}</requestIdentifier>`
      : "",
    "</checkVatResponse>",
    "</soap:Body>",
    "</soap:Envelope>"
  ].join("");
}

function buildViesSoapFault(message = "MS_UNAVAILABLE") {
  return [
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    "<soap:Body>",
    "<soap:Fault>",
    "<faultcode>soap:Server</faultcode>",
    `<faultstring>${message}</faultstring>`,
    "</soap:Fault>",
    "</soap:Body>",
    "</soap:Envelope>"
  ].join("");
}

function enableMockedVies() {
  setViesServiceConfigForTesting({
    enabled: true,
    serviceUrl: "https://example.invalid/vies",
    timeoutMs: 1000,
    rateLimitPerOrgPerDay: 100,
    rateLimitPerVatPerDay: 10
  });
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

test("VIES migration adds explicit evidence table and API scope", async () => {
  const migrationSql = await readFile(viesEvidenceMigrationPath, "utf8");

  assert.match(migrationSql, /create table if not exists public\.vies_evidence_checks/i);
  assert.match(migrationSql, /vat:check_vies/i);
  assert.match(migrationSql, /status in[\s\S]*rate_limited/i);
  assert.match(migrationSql, /raw_response_hash/i);
  assert.match(migrationSql, /enable row level security/i);
  assert.match(migrationSql, /Workspace members can read VIES evidence checks/i);
  assert.match(migrationSql, /Workspace members can create VIES evidence checks/i);
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

test("VIES endpoint defaults to not_checked and does not call transport when disabled", async (t) => {
  const app = await buildApp();
  let transportCalls = 0;

  t.after(async () => {
    resetViesServiceTestingOverrides();
    await app.close();
  });

  setViesServiceConfigForTesting({
    enabled: false
  });
  setViesTransportForTesting(async () => {
    transportCalls += 1;
    throw new Error("VIES transport must not be called while disabled.");
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: apiHeaders(),
    payload: JSON.stringify({
      countryCode: "DE",
      vatNumber: "DE123456789"
    })
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transportCalls, 0);

  const body = response.json() as Record<string, unknown>;

  assert.equal(isPlainObject(body.formatCheck), true);
  assert.equal((body.formatCheck as Record<string, unknown>).formatValid, true);
  assert.equal(body.status, "not_checked");
  assert.equal((body.viesCheck as Record<string, unknown>).viesValid, null);
  assert.equal(body.evidence, null);
  assert.match(String(body.disclaimer), /VAT format valid does not mean VIES valid/i);
  assert.match(response.body, /No live VIES evidence check was performed/i);
});

test("VIES endpoint skips live transport when local VAT format is invalid", async (t) => {
  const app = await buildApp();
  let transportCalls = 0;

  t.after(async () => {
    resetViesServiceTestingOverrides();
    await app.close();
  });

  enableMockedVies();
  setViesTransportForTesting(async () => {
    transportCalls += 1;
    throw new Error("VIES transport must not be called for invalid formats.");
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: apiHeaders(),
    payload: JSON.stringify({
      countryCode: "DE",
      vatNumber: "DE123"
    })
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transportCalls, 0);

  const body = response.json() as Record<string, unknown>;
  assert.equal((body.formatCheck as Record<string, unknown>).formatValid, false);
  assert.equal(body.status, "not_checked");
  assert.equal(body.evidence, null);
});

test("VIES endpoint parses and persists a valid mocked response safely", async (t) => {
  const app = await buildApp();
  let transportBody = "";

  t.after(async () => {
    resetViesServiceTestingOverrides();
    await app.close();
  });

  enableMockedVies();
  setViesTransportForTesting(async (request) => {
    transportBody = request.body;

    return {
      statusCode: 200,
      body: buildViesSoapResponse({
        countryCode: "DE",
        vatNumber: "123456789",
        valid: true,
        name: "Example GmbH",
        address: "Example Street 1",
        requestIdentifier: "WAPIAAAAWz42"
      }),
      responseTimeMs: 42
    };
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: apiHeaders(),
    payload: JSON.stringify({
      countryCode: "DE",
      vatNumber: "DE123456789",
      partyRole: "seller"
    })
  });

  assert.equal(response.statusCode, 200);
  assert.match(transportBody, /<urn:countryCode>DE<\/urn:countryCode>/);
  assert.match(transportBody, /<urn:vatNumber>123456789<\/urn:vatNumber>/);

  const body = response.json() as Record<string, unknown>;
  const evidence = body.evidence as Record<string, unknown>;
  const findings = body.findings as Record<string, unknown>[];

  assert.equal(body.status, "valid");
  assert.equal((body.viesCheck as Record<string, unknown>).viesValid, true);
  assert.equal(evidence.status, "valid");
  assert.equal(evidence.viesValid, true);
  assert.equal(evidence.viesName, "Example GmbH");
  assert.equal(evidence.responseTimeMs, 42);
  assert.match(String(evidence.rawResponseHash), /^[a-f0-9]{64}$/);
  assert.equal(findings[0]?.code, "VIES_EVIDENCE_VALID_AT_CHECK_TIME");
  assert.equal(findings[0]?.legalConfidence, "official_source_derived");
  assert.match(response.body, /time-of-check evidence/i);

  const rawStoredEvidence = await readFile(viesEvidenceDataPath, "utf8");
  assert.match(rawStoredEvidence, /"rawResponseHash":\s*"[a-f0-9]{64}"/);
  assert.doesNotMatch(rawStoredEvidence, /soap:Envelope/i);
  assert.doesNotMatch(rawStoredEvidence, /checkVatResponse/i);
});

test("VIES endpoint maps Greece country code to the EL VAT prefix", async (t) => {
  const app = await buildApp();
  let transportBody = "";

  t.after(async () => {
    resetViesServiceTestingOverrides();
    await app.close();
  });

  enableMockedVies();
  setViesTransportForTesting(async (request) => {
    transportBody = request.body;

    return {
      statusCode: 200,
      body: buildViesSoapResponse({
        countryCode: "EL",
        vatNumber: "123456789",
        valid: true
      }),
      responseTimeMs: 30
    };
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: apiHeaders(),
    payload: JSON.stringify({
      countryCode: "GR",
      vatNumber: "123456789"
    })
  });

  assert.equal(response.statusCode, 200);
  assert.match(transportBody, /<urn:countryCode>EL<\/urn:countryCode>/);
  assert.match(transportBody, /<urn:vatNumber>123456789<\/urn:vatNumber>/);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.status, "valid");
  assert.equal((body.formatCheck as Record<string, unknown>).countryCode, "EL");
  assert.equal((body.evidence as Record<string, unknown>).countryCode, "EL");
});

test("VIES endpoint parses a mocked invalid response without treating format as VIES-valid", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    resetViesServiceTestingOverrides();
    await app.close();
  });

  enableMockedVies();
  setViesTransportForTesting(async () => ({
    statusCode: 200,
    body: buildViesSoapResponse({
      countryCode: "DE",
      vatNumber: "123456789",
      valid: false
    }),
    responseTimeMs: 35
  }));

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: apiHeaders(),
    payload: JSON.stringify({
      countryCode: "DE",
      vatNumber: "DE123456789"
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal((body.formatCheck as Record<string, unknown>).formatValid, true);
  assert.equal(body.status, "invalid");
  assert.equal((body.viesCheck as Record<string, unknown>).viesValid, false);
  assert.match(response.body, /not valid at/i);
});

test("VIES endpoint handles SOAP faults and timeout-style failures safely", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    resetViesServiceTestingOverrides();
    await app.close();
  });

  enableMockedVies();
  setViesTransportForTesting(async () => ({
    statusCode: 500,
    body: buildViesSoapFault("MS_UNAVAILABLE"),
    responseTimeMs: 21
  }));

  const faultResponse = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: apiHeaders(),
    payload: JSON.stringify({
      countryCode: "DE",
      vatNumber: "DE123456789"
    })
  });

  assert.equal(faultResponse.statusCode, 200);
  assert.equal((faultResponse.json() as Record<string, unknown>).status, "unavailable");
  assert.match(faultResponse.body, /does not mean the VAT number is invalid/i);
  assert.doesNotMatch(faultResponse.body, /soap:Envelope/i);

  setViesTransportForTesting(async () => {
    const error = new Error("Abort");
    error.name = "AbortError";
    throw error;
  });

  const timeoutResponse = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: apiHeaders(),
    payload: JSON.stringify({
      countryCode: "DE",
      vatNumber: "DE123456789"
    })
  });

  assert.equal(timeoutResponse.statusCode, 200);
  assert.equal((timeoutResponse.json() as Record<string, unknown>).status, "unavailable");
  assert.doesNotMatch(timeoutResponse.body, /Abort/i);
});

test("VIES endpoint returns rate_limited before transport when configured limits are reached", async (t) => {
  const app = await buildApp();
  let transportCalls = 0;

  t.after(async () => {
    resetViesServiceTestingOverrides();
    await app.close();
  });

  setViesServiceConfigForTesting({
    enabled: true,
    serviceUrl: "https://example.invalid/vies",
    timeoutMs: 1000,
    rateLimitPerOrgPerDay: 0,
    rateLimitPerVatPerDay: 0
  });
  setViesTransportForTesting(async () => {
    transportCalls += 1;
    throw new Error("VIES transport must not be called when rate limited.");
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: apiHeaders(),
    payload: JSON.stringify({
      countryCode: "DE",
      vatNumber: "DE123456789"
    })
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transportCalls, 0);
  assert.equal((response.json() as Record<string, unknown>).status, "rate_limited");
  assert.match(response.body, /rate limit/i);
});

test("VIES endpoint requires authentication and rejects unknown fields", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const unauthenticatedResponse = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: {
      "content-type": "application/json"
    },
    payload: JSON.stringify({
      countryCode: "DE",
      vatNumber: "DE123456789"
    })
  });

  assert.equal(unauthenticatedResponse.statusCode, 401);

  const unknownFieldResponse = await app.inject({
    method: "POST",
    url: "/api/v1/vat/check-vies",
    headers: apiHeaders(),
    payload: JSON.stringify({
      countryCode: "DE",
      vatNumber: "DE123456789",
      rawSoap: true
    })
  });

  assert.equal(unknownFieldResponse.statusCode, 400);
  assert.match(unknownFieldResponse.body, /Unrecognized key/i);
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
