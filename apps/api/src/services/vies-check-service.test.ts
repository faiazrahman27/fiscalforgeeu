import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import {
  checkViesEvidence,
  resetViesServiceTestingOverrides,
  setViesServiceConfigForTesting,
  setViesTransportForTesting
} from "./vies-check-service.js";

const viesEvidenceDataPath = join(
  process.cwd(),
  ".data",
  "vies-evidence-checks.json"
);

let originalViesEvidenceData: string | null = null;

before(async () => {
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

  if (originalViesEvidenceData === null) {
    await rm(viesEvidenceDataPath, {
      force: true
    });
    return;
  }

  await mkdir(dirname(viesEvidenceDataPath), {
    recursive: true
  });
  await writeFile(viesEvidenceDataPath, originalViesEvidenceData, "utf8");
});

function isFileNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function enableViesForServiceTest() {
  setViesServiceConfigForTesting({
    enabled: true,
    serviceUrl: "https://example.invalid/vies",
    timeoutMs: 500,
    rateLimitPerOrgPerDay: 100,
    rateLimitPerVatPerDay: 10
  });
}

function soapResponse(valid: boolean) {
  return [
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    "<soap:Body>",
    '<checkVatResponse xmlns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">',
    "<countryCode>DE</countryCode>",
    "<vatNumber>123456789</vatNumber>",
    `<valid>${valid ? "true" : "false"}</valid>`,
    "<name>Example GmbH</name>",
    "<address>Example Street 1</address>",
    "<requestIdentifier>WAPI123</requestIdentifier>",
    "</checkVatResponse>",
    "</soap:Body>",
    "</soap:Envelope>"
  ].join("");
}

test("VIES service skips live transport when local VAT format is invalid", async () => {
  let transportCalls = 0;

  enableViesForServiceTest();
  setViesTransportForTesting(async () => {
    transportCalls += 1;
    throw new Error("transport should not be called");
  });

  const result = await checkViesEvidence({
    organizationId: "local",
    countryCode: "DE",
    vatNumber: "DE123"
  });

  assert.equal(result.formatCheck.formatValid, false);
  assert.equal(result.status, "not_checked");
  assert.equal(result.evidence, null);
  assert.equal(transportCalls, 0);
});

test("VIES service parses valid and invalid mocked responses", async () => {
  enableViesForServiceTest();
  setViesTransportForTesting(async () => ({
    statusCode: 200,
    body: soapResponse(true),
    responseTimeMs: 12
  }));

  const validResult = await checkViesEvidence({
    organizationId: "local",
    countryCode: "DE",
    vatNumber: "DE123456789"
  });

  assert.equal(validResult.status, "valid");
  assert.equal(validResult.viesValid, true);
  assert.equal(validResult.evidence?.viesName, "Example GmbH");
  assert.match(validResult.evidence?.rawResponseHash ?? "", /^[a-f0-9]{64}$/);

  setViesTransportForTesting(async () => ({
    statusCode: 200,
    body: soapResponse(false),
    responseTimeMs: 10
  }));

  const invalidResult = await checkViesEvidence({
    organizationId: "local",
    countryCode: "DE",
    vatNumber: "DE123456789"
  });

  assert.equal(invalidResult.status, "invalid");
  assert.equal(invalidResult.viesValid, false);
});

test("VIES service handles SOAP faults, timeouts, disabled config, and rate limits safely", async () => {
  setViesServiceConfigForTesting({
    enabled: false
  });

  const disabledResult = await checkViesEvidence({
    organizationId: "local",
    countryCode: "DE",
    vatNumber: "DE123456789"
  });

  assert.equal(disabledResult.status, "not_checked");
  assert.equal(disabledResult.evidence, null);

  enableViesForServiceTest();
  setViesTransportForTesting(async () => ({
    statusCode: 500,
    body:
      "<Envelope><Body><Fault><faultcode>Server</faultcode><faultstring>MS_UNAVAILABLE</faultstring></Fault></Body></Envelope>",
    responseTimeMs: 9
  }));

  const faultResult = await checkViesEvidence({
    organizationId: "local",
    countryCode: "DE",
    vatNumber: "DE123456789"
  });

  assert.equal(faultResult.status, "unavailable");
  assert.equal(faultResult.evidence?.errorMessageSafe, "MS_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(faultResult), /Envelope/);

  setViesTransportForTesting(async () => {
    const error = new Error("Abort");
    error.name = "AbortError";
    throw error;
  });

  const timeoutResult = await checkViesEvidence({
    organizationId: "local",
    countryCode: "DE",
    vatNumber: "DE123456789"
  });

  assert.equal(timeoutResult.status, "unavailable");
  assert.equal(timeoutResult.evidence?.errorCode, "VIES_TIMEOUT");
  assert.doesNotMatch(JSON.stringify(timeoutResult), /Abort/);

  setViesServiceConfigForTesting({
    enabled: true,
    serviceUrl: "https://example.invalid/vies",
    timeoutMs: 500,
    rateLimitPerOrgPerDay: 0,
    rateLimitPerVatPerDay: 0
  });

  const rateLimitedResult = await checkViesEvidence({
    organizationId: "local",
    countryCode: "DE",
    vatNumber: "DE123456789"
  });

  assert.equal(rateLimitedResult.status, "rate_limited");
});
