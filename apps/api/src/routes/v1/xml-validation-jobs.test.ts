import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";

const xmlValidationJobDataPath = join(
  process.cwd(),
  ".data",
  "xml-validation-jobs.json"
);
const migrationPath = join(
  process.cwd(),
  "..",
  "..",
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

test("XML validation job stores metadata, SHA-256, and completed worker-readiness stub", async () => {
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
  assert.match(String(job.disclaimer), /Real XSD, Schematron, Peppol, and EN 16931 validation are not enabled yet/i);
  assert.equal(response.body.includes(simpleUblInvoiceXml), false);
  assert.equal(response.body.includes("<Invoice"), false);

  const storedData = await readOptionalFile(xmlValidationJobDataPath);

  assert.notEqual(storedData, null);
  assert.equal(storedData?.includes(simpleUblInvoiceXml), false);
  assert.equal(storedData?.includes("<Invoice"), false);
  assert.match(storedData ?? "", /xmlSha256/);
});

test("XML validation job marks placeholder checks as inactive safely", async () => {
  const response = await createXmlValidationJob([
    "worker_readiness",
    "xsd_ubl_placeholder",
    "schematron_peppol_placeholder"
  ]);

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const job = body.job as Record<string, unknown>;

  assert.deepEqual(job.completedChecks, ["worker_readiness"]);
  assert.deepEqual(job.failedChecks, [
    "xsd_ubl_placeholder",
    "schematron_peppol_placeholder"
  ]);
  assert.equal(Array.isArray(job.findings), true);

  const findings = job.findings as Record<string, unknown>[];

  assert.equal(
    findings.some(
      (finding) =>
        finding.code === "UBL_XSD_VALIDATION_NOT_ENABLED" &&
        finding.status === "not_implemented"
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
  assert.doesNotMatch(
    JSON.stringify(job),
    /\bXSD valid\b|\bSchematron passed\b|\bPeppol certified\b|\bEN 16931 compliant\b/i
  );
});

test("XML validation job list and read endpoints return metadata only", async (t) => {
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

  assert.equal(jobs.some((job) => job.id === createdJob.id), true);

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
});
