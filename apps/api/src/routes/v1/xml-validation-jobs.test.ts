import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { inspectXmlSafety } from "@invoice-lantern/ubl";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import {
  buildXmlValidationJobCompletion,
  detectXmlDocumentType,
  detectXmlRootElement
} from "../../services/xml-validation-job-service.js";
import {
  deleteTransientXmlPayload,
  inspectTransientXmlPayloadMetadata,
  type TransientXmlPayloadReference
} from "../../services/transient-xml-payload-store.js";

const xmlValidationJobDataPath = join(
  process.cwd(),
  ".data",
  "xml-validation-jobs.json"
);
const apiRootPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const projectRootPath = join(apiRootPath, "..", "..");
const migrationPath = join(
  projectRootPath,
  "supabase",
  "migrations",
  "026_create_xml_validation_jobs.sql"
);

let originalXmlValidationJobData: string | null = null;

const simpleUblInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INV-XML-JOB-001</cbc:ID>
  <cbc:IssueDate>2026-04-30</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
</Invoice>`;

before(async () => {
  originalXmlValidationJobData = await readOptionalFile(xmlValidationJobDataPath);

  await rm(xmlValidationJobDataPath, {
    force: true
  });
});

after(async () => {
  if (originalXmlValidationJobData === null) {
    await rm(xmlValidationJobDataPath, {
      force: true
    });
    return;
  }

  await mkdir(dirname(xmlValidationJobDataPath), {
    recursive: true
  });
  await writeFile(
    xmlValidationJobDataPath,
    originalXmlValidationJobData,
    "utf8"
  );
});

async function readOptionalFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function writeTestOnlyInvoiceXsdFixture(tempRoot: string) {
  const maindocPath = join(tempRoot, "xsd", "maindoc");
  const invoiceXsdPath = join(maindocPath, "UBL-Invoice-2.1.xsd");

  await mkdir(maindocPath, {
    recursive: true
  });
  await writeFile(
    invoiceXsdPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Invoice">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="ID" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`,
    "utf8"
  );

  return invoiceXsdPath;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  assert.equal(isPlainObject(value), true, `${label} should be an object`);

  return value as Record<string, unknown>;
}

function readTransientPayloadReference(
  value: unknown
): TransientXmlPayloadReference {
  const reference = readObject(value, "transientPayload");

  assert.equal(typeof reference.payloadId, "string");
  assert.equal(typeof reference.sha256, "string");
  assert.equal(typeof reference.byteLength, "number");
  assert.equal(typeof reference.createdAt, "string");
  assert.equal(typeof reference.expiresAt, "string");
  assert.equal(reference.storageProvider, "local_file_v1");

  return reference as TransientXmlPayloadReference;
}

async function createXmlValidationJob(requestedChecks = ["worker_readiness"]) {
  const app = await buildApp();

  try {
    return await app.inject({
      method: "POST",
      url: "/api/v1/xml/validation-jobs",
      headers: {
        "x-api-key": env.DEV_API_KEY,
        "content-type": "application/json"
      },
      payload: {
        xml: simpleUblInvoiceXml,
        filename: "job-test.xml",
        sourceType: "api_payload",
        requestedChecks
      }
    });
  } finally {
    await app.close();
  }
}

test("migration 026 creates metadata-only XML validation jobs table", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /create table if not exists public\.xml_validation_jobs/i);
  assert.match(migration, /xml_sha256 text not null/i);
  assert.match(migration, /xml_size_bytes integer not null/i);
  assert.match(
    migration,
    /status in \('queued',\s*'running',\s*'completed',\s*'failed',\s*'cancelled'\)/i
  );
  assert.match(migration, /alter table public\.xml_validation_jobs enable row level security/i);
  assert.doesNotMatch(migration, /\bxml_body\b/i);
  assert.doesNotMatch(migration, /\braw_xml\b/i);
});

test("XML validation job rejects unsafe XML before storage", async (t) => {
  const beforeData = await readOptionalFile(xmlValidationJobDataPath);
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/xml/validation-jobs",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/json"
    },
    payload: {
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Invoice [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<Invoice><ID>&xxe;</ID></Invoice>`,
      requestedChecks: ["worker_readiness"]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /XML_DOCTYPE_BLOCKED/);
  assert.equal(await readOptionalFile(xmlValidationJobDataPath), beforeData);
});

test("XML validation job stores metadata, SHA-256, queue lifecycle, and completed worker-readiness result", async () => {
  const response = await createXmlValidationJob();

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(isPlainObject(body.job), true);

  const job = body.job as Record<string, unknown>;

  assert.equal(job.status, "completed");
  assert.equal(job.xmlSha256, sha256(simpleUblInvoiceXml));
  assert.equal(job.xmlSizeBytes, Buffer.byteLength(simpleUblInvoiceXml, "utf8"));
  assert.deepEqual(job.requestedChecks, ["worker_readiness"]);
  assert.deepEqual(job.completedChecks, ["worker_readiness"]);
  assert.deepEqual(job.failedChecks, []);
  assert.match(
    String(job.disclaimer),
    /does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance/i
  );
  assert.equal(response.body.includes(simpleUblInvoiceXml), false);
  assert.equal(response.body.includes("<Invoice"), false);

  const resultSummary = readObject(job.resultSummary, "job.resultSummary");
  const queue = readObject(resultSummary.queue, "job.resultSummary.queue");

  assert.equal(queue.status, "completed");
  assert.equal(typeof queue.queueVersion, "string");
  assert.equal(typeof queue.mode, "string");
  assert.equal(typeof queue.attempt, "number");
  assert.equal(typeof queue.maxAttempts, "number");
  assert.equal(typeof queue.leaseSeconds, "number");
  assert.equal(typeof queue.timeoutSeconds, "number");
  assert.equal(queue.retryable, false);
  assert.match(String(queue.queuedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(queue.startedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(queue.completedAt), /^\d{4}-\d{2}-\d{2}T/);

  const storedData = await readOptionalFile(xmlValidationJobDataPath);

  assert.notEqual(storedData, null);
  assert.equal(storedData?.includes(simpleUblInvoiceXml), false);
  assert.equal(storedData?.includes("<Invoice"), false);
  assert.match(storedData ?? "", /xmlSha256/);
  assert.match(storedData ?? "", /"queue"/);
  assert.match(storedData ?? "", /"status"\s*:\s*"completed"/);
});

test("async XML validation job queues metadata and temporary payload reference only", async (t) => {
  const app = await buildApp();
  let transientPayload: TransientXmlPayloadReference | null = null;

  t.after(async () => {
    await app.close();

    if (transientPayload) {
      await deleteTransientXmlPayload({
        payloadId: transientPayload.payloadId
      });
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/xml/validation-jobs",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/json"
    },
    payload: {
      xml: simpleUblInvoiceXml,
      filename: "async-job-test.xml",
      sourceType: "api_payload",
      processingMode: "async_worker",
      requestedChecks: ["worker_readiness"]
    }
  });

  assert.equal(response.statusCode, 202);
  assert.equal(response.body.includes(simpleUblInvoiceXml), false);
  assert.equal(response.body.includes("<Invoice"), false);

  const body = response.json() as Record<string, unknown>;
  const job = readObject(body.job, "body.job");

  assert.equal(job.status, "queued");
  assert.deepEqual(job.completedChecks, []);
  assert.deepEqual(job.failedChecks, []);
  assert.equal(job.xmlSha256, sha256(simpleUblInvoiceXml));
  assert.equal(job.xmlSizeBytes, Buffer.byteLength(simpleUblInvoiceXml, "utf8"));

  const resultSummary = readObject(job.resultSummary, "job.resultSummary");
  const queue = readObject(resultSummary.queue, "job.resultSummary.queue");

  assert.equal(queue.status, "queued");
  assert.equal(queue.mode, "async_worker");

  transientPayload = readTransientPayloadReference(
    resultSummary.transientPayload
  );

  assert.equal(transientPayload.sha256, sha256(simpleUblInvoiceXml));
  assert.equal(
    transientPayload.byteLength,
    Buffer.byteLength(simpleUblInvoiceXml, "utf8")
  );
  assert.equal(JSON.stringify(transientPayload).includes(simpleUblInvoiceXml), false);
  assert.equal(JSON.stringify(transientPayload).includes("<Invoice"), false);

  const metadata = await inspectTransientXmlPayloadMetadata({
    payloadId: transientPayload.payloadId
  });

  assert.equal(metadata.exists, true);
  assert.equal(metadata.byteLength, Buffer.byteLength(simpleUblInvoiceXml, "utf8"));

  const storedData = await readOptionalFile(xmlValidationJobDataPath);

  assert.notEqual(storedData, null);
  assert.equal(storedData?.includes(simpleUblInvoiceXml), false);
  assert.equal(storedData?.includes("<Invoice"), false);
  assert.match(storedData ?? "", /"status"\s*:\s*"queued"/);
  assert.match(storedData ?? "", /"transientPayload"/);
});

test("XML validation job completion builds inline queue lifecycle metadata", async () => {
  const rootElement = detectXmlRootElement(simpleUblInvoiceXml);
  const documentType = detectXmlDocumentType(rootElement);
  const completion = await buildXmlValidationJobCompletion({
    xml: simpleUblInvoiceXml,
    xmlSha256: sha256(simpleUblInvoiceXml),
    xmlSizeBytes: Buffer.byteLength(simpleUblInvoiceXml, "utf8"),
    requestedChecks: ["worker_readiness"],
    safety: inspectXmlSafety(simpleUblInvoiceXml),
    rootElement,
    documentType,
    queueMode: "inline",
    queueAttempt: 2,
    queueClaimedBy: "test-inline-worker"
  });

  const queue = readObject(completion.resultSummary.queue, "completion.queue");

  assert.deepEqual(completion.completedChecks, ["worker_readiness"]);
  assert.deepEqual(completion.failedChecks, []);
  assert.equal(queue.status, "completed");
  assert.equal(queue.mode, "inline");
  assert.equal(queue.attempt, 2);
  assert.equal(queue.maxAttempts, 3);
  assert.equal(queue.retryable, false);
  assert.equal(queue.claimedBy, "test-inline-worker");
  assert.match(String(queue.queuedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(queue.startedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(queue.completedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(JSON.stringify(completion).includes(simpleUblInvoiceXml), false);
  assert.equal(JSON.stringify(completion).includes("<Invoice"), false);
});

test("XML validation job marks UBL XSD as not configured without pretending it passed", async () => {
  const response = await createXmlValidationJob([
    "worker_readiness",
    "xsd_ubl",
    "schematron_peppol_placeholder"
  ]);

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const job = body.job as Record<string, unknown>;

  assert.deepEqual(job.completedChecks, ["worker_readiness", "xsd_ubl"]);
  assert.deepEqual(job.failedChecks, ["schematron_peppol_placeholder"]);
  assert.equal(Array.isArray(job.findings), true);

  const findings = job.findings as Record<string, unknown>[];

  assert.equal(
    findings.some(
      (finding) =>
        finding.code === "UBL_XSD_NOT_CONFIGURED" &&
        finding.status === "not_configured"
    ),
    true
  );
  assert.equal(
    findings.some(
      (finding) =>
        finding.code === "PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED" &&
        finding.status === "not_implemented"
    ),
    true
  );

  const resultSummary = job.resultSummary as Record<string, unknown>;
  const queue = readObject(resultSummary.queue, "job.resultSummary.queue");
  const checkStatuses = resultSummary.checkStatuses as Record<string, unknown>;
  const xsdUbl = resultSummary.xsdUbl as Record<string, unknown>;
  const checkResults = resultSummary.checkResults as Record<string, unknown>[];
  const xsdCheckResult = checkResults.find(
    (result) => result.checkType === "xsd_ubl"
  ) as Record<string, unknown>;
  const artifactInfo = xsdUbl.artifactInfo as Record<string, unknown>;

  assert.equal(queue.status, "completed");
  assert.equal(queue.retryable, false);
  assert.equal(checkStatuses.xsd_ubl, "not_configured");
  assert.equal(xsdCheckResult.status, "not_configured");
  assert.equal(isPlainObject(xsdCheckResult.artifactInfo), true);
  assert.equal(xsdUbl.configured, false);
  assert.equal(xsdUbl.validationExecuted, false);
  assert.equal(xsdUbl.markedValid, false);
  assert.equal(xsdUbl.status, "not_configured");
  assert.equal(isPlainObject(artifactInfo), true);
  assert.equal(artifactInfo.configured, false);
  assert.equal(artifactInfo.validatorName, "xmllint-wasm");
  assert.equal(artifactInfo.validatorAvailable, true);
  assert.equal(artifactInfo.artifactVersion, null);
  assert.match(String(artifactInfo.checkedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(
    (artifactInfo.invoiceSchema as Record<string, unknown>).status,
    "not_configured"
  );
  assert.equal(
    (artifactInfo.creditNoteSchema as Record<string, unknown>).status,
    "not_configured"
  );
  assert.equal(
    (artifactInfo.dependencyGraph as Record<string, unknown>).status,
    "not_inspected"
  );

  assert.doesNotMatch(
    JSON.stringify(job),
    /\bXSD valid\b|\bSchematron passed\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bofficially valid\b|\blegally compliant\b|\baccepted by authority\b/i
  );
});

test("configured missing UBL XSD artefact paths produce safe not_configured metadata", async () => {
  const rootElement = detectXmlRootElement(simpleUblInvoiceXml);
  const documentType = detectXmlDocumentType(rootElement);
  const missingInvoiceXsdPath = join(
    process.cwd(),
    ".missing-test-artifacts",
    "UBL-Invoice-2.1.xsd"
  );
  const completion = await buildXmlValidationJobCompletion({
    xml: simpleUblInvoiceXml,
    xmlSha256: sha256(simpleUblInvoiceXml),
    xmlSizeBytes: Buffer.byteLength(simpleUblInvoiceXml, "utf8"),
    requestedChecks: ["xsd_ubl"],
    safety: inspectXmlSafety(simpleUblInvoiceXml),
    rootElement,
    documentType,
    xsdArtifactConfig: {
      invoiceXsdPath: missingInvoiceXsdPath,
      artifactVersion: "2.1"
    }
  });

  assert.deepEqual(completion.completedChecks, ["xsd_ubl"]);
  assert.deepEqual(completion.failedChecks, []);

  const queue = readObject(completion.resultSummary.queue, "completion.queue");
  const xsdUbl = completion.resultSummary.xsdUbl as Record<string, unknown>;
  const checkResults = completion.resultSummary.checkResults as Record<
    string,
    unknown
  >[];
  const xsdCheckResult = checkResults.find(
    (result) => result.checkType === "xsd_ubl"
  ) as Record<string, unknown>;
  const artifactInfo = xsdUbl.artifactInfo as Record<string, unknown>;

  assert.equal(queue.status, "completed");
  assert.equal(queue.mode, "inline");
  assert.equal(queue.retryable, false);
  assert.equal(xsdCheckResult.status, "not_configured");
  assert.equal(xsdUbl.configured, false);
  assert.equal(xsdUbl.validationExecuted, false);
  assert.equal(xsdUbl.markedValid, false);
  assert.equal(artifactInfo.configured, false);
  assert.equal(artifactInfo.invoiceXsdPath, missingInvoiceXsdPath);
  assert.equal(artifactInfo.artifactVersion, "2.1");
  assert.equal(
    (artifactInfo.invoiceSchema as Record<string, unknown>).configured,
    true
  );
  assert.equal(
    (artifactInfo.invoiceSchema as Record<string, unknown>).status,
    "missing"
  );
  assert.equal(
    (artifactInfo.invoiceSchema as Record<string, unknown>).sha256,
    null
  );
  assert.equal(
    (artifactInfo.dependencyGraph as Record<string, unknown>).status,
    "not_inspected"
  );
  assert.equal(
    completion.findings.some(
      (finding) =>
        finding.code === "UBL_XSD_NOT_CONFIGURED" &&
        finding.status === "not_configured"
    ),
    true
  );
  assert.equal(JSON.stringify(completion).includes(simpleUblInvoiceXml), false);
  assert.equal(JSON.stringify(completion).includes("<Invoice"), false);
});

test("configured readable UBL Invoice XSD artefact metadata is returned safely", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-api-xsd-"));
  const tinyInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice><ID>INV-XSD-API-001</ID></Invoice>`;

  try {
    const invoiceXsdPath = await writeTestOnlyInvoiceXsdFixture(tempRoot);
    const rootElement = detectXmlRootElement(tinyInvoiceXml);
    const documentType = detectXmlDocumentType(rootElement);
    const completion = await buildXmlValidationJobCompletion({
      xml: tinyInvoiceXml,
      xmlSha256: sha256(tinyInvoiceXml),
      xmlSizeBytes: Buffer.byteLength(tinyInvoiceXml, "utf8"),
      requestedChecks: ["xsd_ubl"],
      safety: inspectXmlSafety(tinyInvoiceXml),
      rootElement,
      documentType,
      xsdArtifactConfig: {
        rootDir: tempRoot,
        invoiceXsdPath,
        artifactVersion: "test-only"
      }
    });

    assert.deepEqual(completion.completedChecks, ["xsd_ubl"]);
    assert.deepEqual(completion.failedChecks, []);

    const queue = readObject(completion.resultSummary.queue, "completion.queue");
    const xsdUbl = completion.resultSummary.xsdUbl as Record<string, unknown>;
    const artifactInfo = xsdUbl.artifactInfo as Record<string, unknown>;
    const invoiceSchema = artifactInfo.invoiceSchema as Record<string, unknown>;
    const dependencyGraph = artifactInfo.dependencyGraph as Record<string, unknown>;

    assert.equal(queue.status, "completed");
    assert.equal(queue.mode, "inline");
    assert.equal(queue.retryable, false);
    assert.equal(xsdUbl.status, "passed");
    assert.equal(xsdUbl.configured, true);
    assert.equal(xsdUbl.validationExecuted, true);
    assert.equal(xsdUbl.markedValid, true);
    assert.equal(artifactInfo.configured, true);
    assert.equal(artifactInfo.validatorName, "xmllint-wasm");
    assert.equal(artifactInfo.validatorAvailable, true);
    assert.equal(artifactInfo.artifactVersion, "test-only");
    assert.equal(invoiceSchema.status, "available");
    assert.equal(invoiceSchema.readable, true);
    assert.match(String(invoiceSchema.sha256), /^[a-f0-9]{64}$/);
    assert.equal(dependencyGraph.status, "ready");
    assert.equal(dependencyGraph.dependencyCount, 0);
    assert.equal(JSON.stringify(completion).includes(tinyInvoiceXml), false);
    assert.equal(JSON.stringify(completion).includes("<Invoice"), false);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("configured readable UBL Invoice XSD failure returns mapped findings safely", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-api-xsd-"));
  const invalidInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice><Unexpected>INV-XSD-API-RAW-SECRET</Unexpected></Invoice>`;

  try {
    const invoiceXsdPath = await writeTestOnlyInvoiceXsdFixture(tempRoot);
    const rootElement = detectXmlRootElement(invalidInvoiceXml);
    const documentType = detectXmlDocumentType(rootElement);
    const completion = await buildXmlValidationJobCompletion({
      xml: invalidInvoiceXml,
      xmlSha256: sha256(invalidInvoiceXml),
      xmlSizeBytes: Buffer.byteLength(invalidInvoiceXml, "utf8"),
      requestedChecks: ["xsd_ubl"],
      safety: inspectXmlSafety(invalidInvoiceXml),
      rootElement,
      documentType,
      xsdArtifactConfig: {
        rootDir: tempRoot,
        invoiceXsdPath,
        artifactVersion: "test-only"
      }
    });

    assert.deepEqual(completion.completedChecks, []);
    assert.deepEqual(completion.failedChecks, ["xsd_ubl"]);

    const queue = readObject(completion.resultSummary.queue, "completion.queue");
    const xsdUbl = completion.resultSummary.xsdUbl as Record<string, unknown>;
    const checkResults = completion.resultSummary.checkResults as Record<
      string,
      unknown
    >[];
    const xsdCheckResult = checkResults.find(
      (result) => result.checkType === "xsd_ubl"
    ) as Record<string, unknown>;
    const checkFindings = xsdCheckResult.findings as Record<string, unknown>[];
    const mappedFinding = checkFindings[0] as Record<string, unknown>;

    assert.equal(queue.status, "completed");
    assert.equal(queue.mode, "inline");
    assert.equal(queue.retryable, false);
    assert.equal(xsdUbl.status, "failed");
    assert.equal(xsdUbl.configured, true);
    assert.equal(xsdUbl.validationExecuted, true);
    assert.equal(xsdUbl.markedValid, false);
    assert.equal(isPlainObject(xsdCheckResult.artifactInfo), true);
    assert.equal(mappedFinding.code, "UBL_XSD_ELEMENT_INVALID");
    assert.equal(mappedFinding.severity, "fatal");
    assert.equal(mappedFinding.checkType, "xsd_ubl");
    assert.equal(mappedFinding.field, "xml");
    assert.equal(mappedFinding.status, "failed");
    assert.equal(mappedFinding.legalConfidence, "technical");
    assert.equal(mappedFinding.technicalCode, "element_invalid");
    assert.equal(typeof mappedFinding.technicalMessage, "string");
    assert.equal(Array.isArray(mappedFinding.sourceLabels), true);
    assert.equal(
      (mappedFinding.sourceLabels as string[]).includes("xmllint-wasm"),
      true
    );
    assert.equal(JSON.stringify(completion).includes(invalidInvoiceXml), false);
    assert.equal(JSON.stringify(completion).includes("<Invoice"), false);
    assert.equal(
      JSON.stringify(completion).includes("INV-XSD-API-RAW-SECRET"),
      false
    );
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("legacy XSD placeholder check is rejected by schema instead of silently accepted", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/xml/validation-jobs",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/json"
    },
    payload: {
      xml: simpleUblInvoiceXml,
      filename: "legacy-placeholder.xml",
      sourceType: "api_payload",
      requestedChecks: ["xsd_ubl_placeholder"]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /XML validation job request failed schema validation/i);
  assert.match(response.body, /VALIDATION_ERROR/);
  assert.match(response.body, /requestedChecks\.0/);
  assert.match(response.body, /worker_readiness/);
  assert.match(response.body, /xsd_ubl/);
  assert.match(response.body, /schematron_peppol_placeholder/);
  assert.doesNotMatch(response.body, /UBL_XSD_NOT_CONFIGURED/);
  assert.doesNotMatch(response.body, /XML_VALIDATION_WORKER_READY/);
});

test("XML validation job list and read endpoints return metadata and queue state only", async (t) => {
  const createdResponse = await createXmlValidationJob();
  const createdJob = (createdResponse.json() as { job: { id: string } }).job;
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/xml/validation-jobs?limit=5&status=completed",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.body.includes(simpleUblInvoiceXml), false);
  assert.equal(listResponse.body.includes("<Invoice"), false);

  const listBody = listResponse.json() as Record<string, unknown>;

  assert.equal(Array.isArray(listBody.jobs), true);

  const jobs = listBody.jobs as Record<string, unknown>[];
  const listedJob = jobs.find((job) => job.id === createdJob.id);

  assert.equal(isPlainObject(listedJob), true);

  const listedResultSummary = readObject(
    (listedJob as Record<string, unknown>).resultSummary,
    "listedJob.resultSummary"
  );
  const listedQueue = readObject(
    listedResultSummary.queue,
    "listedJob.resultSummary.queue"
  );

  assert.equal(listedQueue.status, "completed");
  assert.equal(listedQueue.retryable, false);

  const readResponse = await app.inject({
    method: "GET",
    url: `/api/v1/xml/validation-jobs/${encodeURIComponent(createdJob.id)}`,
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.body.includes(simpleUblInvoiceXml), false);
  assert.equal(readResponse.body.includes("<Invoice"), false);

  const readBody = readResponse.json() as Record<string, unknown>;

  assert.equal(isPlainObject(readBody.job), true);
  assert.equal((readBody.job as Record<string, unknown>).id, createdJob.id);

  const readResultSummary = readObject(
    (readBody.job as Record<string, unknown>).resultSummary,
    "readBody.job.resultSummary"
  );
  const readQueue = readObject(
    readResultSummary.queue,
    "readBody.job.resultSummary.queue"
  );

  assert.equal(readQueue.status, "completed");
  assert.equal(readQueue.retryable, false);
});
