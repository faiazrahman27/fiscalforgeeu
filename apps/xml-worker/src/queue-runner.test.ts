import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createLocalXmlValidationQueueRepository } from "./queue-repositories.js";
import {
  buildRunningQueueLifecycleFromSummary,
  runXmlValidationQueueOnce,
  XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE,
  XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE,
  XML_VALIDATION_JOB_WORKER_NAME,
  XML_VALIDATION_JOB_WORKER_VERSION,
  type CompleteXmlValidationQueueJobInput,
  type FailXmlValidationQueueJobInput,
  type XmlValidationQueueJob,
  type XmlValidationQueueRepository
} from "./queue-runner.js";

const fixedNow = new Date("2026-05-07T10:30:00.000Z");
const queuedAt = "2026-05-07T10:00:00.000Z";
const startedAt = "2026-05-07T10:15:00.000Z";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function createClaimedJob(input: {
  xmlSha256?: string;
  xmlSizeBytes?: number;
  requestedChecks?: XmlValidationQueueJob["requestedChecks"];
} = {}): XmlValidationQueueJob {
  const resultSummary = {
    queue: buildRunningQueueLifecycleFromSummary({
      existingSummary: {
        queue: {
          queuedAt,
          attempt: 1,
          maxAttempts: 3,
          leaseSeconds: 120,
          timeoutSeconds: 300
        }
      },
      now: startedAt,
      claimedBy: XML_VALIDATION_JOB_WORKER_NAME
    })
  };

  return {
    id: "xmljob_test_001",
    organizationId: "org_test_001",
    documentType: "invoice",
    xmlSha256: input.xmlSha256 ?? "0".repeat(64),
    xmlSizeBytes: input.xmlSizeBytes ?? 123,
    status: "running",
    requestedChecks: input.requestedChecks ?? ["worker_readiness", "xsd_ubl"],
    completedChecks: [],
    failedChecks: [],
    workerName: XML_VALIDATION_JOB_WORKER_NAME,
    workerVersion: XML_VALIDATION_JOB_WORKER_VERSION,
    startedAt,
    resultSummary,
    findings: [],
    disclaimer:
      "This XML validation job is a technical sandbox worker-readiness and configured-check result. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance.",
    createdAt: queuedAt,
    updatedAt: startedAt
  };
}

function createFakeRepository(job: XmlValidationQueueJob | null) {
  let completeInput: CompleteXmlValidationQueueJobInput | null = null;
  let failInput: FailXmlValidationQueueJobInput | null = null;
  let claimCount = 0;

  const repository: XmlValidationQueueRepository = {
    async claimQueuedJob() {
      claimCount += 1;
      return job;
    },

    async completeJob(input) {
      completeInput = input;

      if (!job) {
        return null;
      }

      return {
        ...job,
        status: "completed",
        completedChecks: input.completedChecks,
        failedChecks: input.failedChecks,
        workerName: input.workerName,
        workerVersion: input.workerVersion,
        resultSummary: input.resultSummary,
        findings: input.findings,
        disclaimer: input.disclaimer,
        updatedAt: input.completedAt
      };
    },

    async failJob(input) {
      failInput = input;

      if (!job) {
        return null;
      }

      return {
        ...job,
        status: "failed",
        completedChecks: [],
        failedChecks: input.failedChecks,
        workerName: input.workerName,
        workerVersion: input.workerVersion,
        resultSummary: input.resultSummary,
        findings: input.findings,
        disclaimer: input.disclaimer,
        updatedAt: input.failedAt
      };
    }
  };

  return {
    repository,
    getClaimCount: () => claimCount,
    getCompleteInput: () => completeInput,
    getFailInput: () => failInput
  };
}

function readQueue(summary: Record<string, unknown>) {
  const queue = summary.queue;

  assert.equal(typeof queue, "object");
  assert.notEqual(queue, null);
  assert.equal(Array.isArray(queue), false);

  return queue as Record<string, unknown>;
}

test("queue runner reports idle safely when no queued jobs are available", async () => {
  const fake = createFakeRepository(null);
  const result = await runXmlValidationQueueOnce({
    repository: fake.repository,
    now: () => fixedNow
  });

  assert.equal(result.status, "idle");
  assert.equal(result.message, "No queued XML validation jobs are available.");
  assert.equal(result.workerName, XML_VALIDATION_JOB_WORKER_NAME);
  assert.equal(result.workerVersion, XML_VALIDATION_JOB_WORKER_VERSION);
  assert.equal(fake.getClaimCount(), 1);
  assert.equal(fake.getCompleteInput(), null);
  assert.equal(fake.getFailInput(), null);
});

test("queue runner fails metadata-only jobs without pretending validation ran", async () => {
  const rawXml = "<Invoice><ID>RAW-XML-SECRET-STEP-43</ID></Invoice>";
  const job = createClaimedJob({
    xmlSha256: sha256(rawXml),
    xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
    requestedChecks: [
      "worker_readiness",
      "xsd_ubl",
      "schematron_peppol_placeholder"
    ]
  });
  const fake = createFakeRepository(job);
  const result = await runXmlValidationQueueOnce({
    repository: fake.repository,
    now: () => fixedNow
  });
  const failInput = fake.getFailInput();

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE);
  assert.equal(result.errorMessage, XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE);
  assert.equal(fake.getCompleteInput(), null);
  assert.ok(failInput);
  assert.deepEqual(failInput.failedChecks, [
    "worker_readiness",
    "xsd_ubl",
    "schematron_peppol_placeholder"
  ]);
  assert.equal(failInput.workerName, XML_VALIDATION_JOB_WORKER_NAME);
  assert.equal(failInput.workerVersion, XML_VALIDATION_JOB_WORKER_VERSION);
  assert.equal(failInput.resultSummary.workerReady, false);
  assert.equal(failInput.resultSummary.queueRunnerReady, true);
  assert.equal(failInput.resultSummary.xmlSha256, sha256(rawXml));
  assert.equal(failInput.resultSummary.xmlSizeBytes, Buffer.byteLength(rawXml, "utf8"));

  const queue = readQueue(failInput.resultSummary);

  assert.equal(queue.status, "failed");
  assert.equal(queue.mode, "async_worker");
  assert.equal(queue.retryable, false);
  assert.equal(queue.failureCode, XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE);
  assert.equal(queue.failureMessage, XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE);
  assert.equal(queue.claimedBy, XML_VALIDATION_JOB_WORKER_NAME);

  const checkStatuses = failInput.resultSummary.checkStatuses as Record<
    string,
    unknown
  >;

  assert.equal(checkStatuses.worker_readiness, "error");
  assert.equal(checkStatuses.xsd_ubl, "error");
  assert.equal(checkStatuses.schematron_peppol_placeholder, "error");
  assert.equal(failInput.findings[0]?.code, XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE);
  assert.equal(JSON.stringify(failInput).includes(rawXml), false);
  assert.equal(JSON.stringify(failInput).includes("RAW-XML-SECRET-STEP-43"), false);
  assert.equal(JSON.stringify(result).includes(rawXml), false);
  assert.equal(JSON.stringify(result).includes("RAW-XML-SECRET-STEP-43"), false);
});

test("queue runner can complete a job when transient XML is supplied safely", async () => {
  const rawXml = "<Invoice><ID>TRANSIENT-XML-STEP-43</ID></Invoice>";
  const job = createClaimedJob({
    xmlSha256: sha256(rawXml),
    xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
    requestedChecks: ["worker_readiness"]
  });
  const fake = createFakeRepository(job);
  const result = await runXmlValidationQueueOnce({
    repository: fake.repository,
    loadTransientXml: async () => rawXml,
    now: () => fixedNow
  });
  const completeInput = fake.getCompleteInput();

  assert.equal(result.status, "completed");
  assert.equal(fake.getFailInput(), null);
  assert.ok(completeInput);
  assert.deepEqual(completeInput.completedChecks, ["worker_readiness"]);
  assert.deepEqual(completeInput.failedChecks, []);
  assert.equal(completeInput.resultSummary.xmlSha256, sha256(rawXml));
  assert.equal(
    completeInput.resultSummary.xmlSizeBytes,
    Buffer.byteLength(rawXml, "utf8")
  );

  const queue = readQueue(completeInput.resultSummary);

  assert.equal(queue.status, "completed");
  assert.equal(queue.mode, "async_worker");
  assert.equal(queue.retryable, false);
  assert.equal(queue.claimedBy, XML_VALIDATION_JOB_WORKER_NAME);
  assert.equal(JSON.stringify(completeInput).includes(rawXml), false);
  assert.equal(
    JSON.stringify(completeInput).includes("TRANSIENT-XML-STEP-43"),
    false
  );
  assert.equal(JSON.stringify(result).includes(rawXml), false);
  assert.equal(JSON.stringify(result).includes("TRANSIENT-XML-STEP-43"), false);
});

test("queue runner fails mismatched transient XML without validation output", async () => {
  const rawXml = "<Invoice><ID>MISMATCHED-XML-STEP-43</ID></Invoice>";
  const job = createClaimedJob({
    xmlSha256: "1".repeat(64),
    xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
    requestedChecks: ["xsd_ubl"]
  });
  const fake = createFakeRepository(job);
  const result = await runXmlValidationQueueOnce({
    repository: fake.repository,
    loadTransientXml: async () => rawXml,
    now: () => fixedNow
  });
  const failInput = fake.getFailInput();

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "XML_VALIDATION_JOB_TRANSIENT_XML_MISMATCH");
  assert.equal(fake.getCompleteInput(), null);
  assert.ok(failInput);
  assert.deepEqual(failInput.failedChecks, ["xsd_ubl"]);
  assert.equal(failInput.resultSummary.xsdUbl instanceof Object, true);
  assert.equal(JSON.stringify(failInput).includes(rawXml), false);
  assert.equal(JSON.stringify(failInput).includes("MISMATCHED-XML-STEP-43"), false);
});

test("local queue repository claims and fails a metadata-only job without storing raw XML", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "invoice-lantern-worker-"));
  const dataPath = join(dataDir, "xml-validation-jobs.json");

  await writeFile(
    dataPath,
    `${JSON.stringify(
      {
        records: [
          {
            id: "xmljob_local_001",
            organizationId: "org_local_001",
            documentType: "invoice",
            xmlSha256: "2".repeat(64),
            xmlSizeBytes: 44,
            status: "queued",
            requestedChecks: ["worker_readiness", "xsd_ubl"],
            completedChecks: [],
            failedChecks: [],
            workerName: null,
            workerVersion: null,
            startedAt: null,
            completedAt: null,
            failedAt: null,
            errorCode: null,
            errorMessage: null,
            resultSummary: {
              queue: {
                queuedAt
              }
            },
            findings: [],
            disclaimer:
              "This XML validation job is a technical sandbox worker-readiness and configured-check result. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance.",
            createdAt: queuedAt,
            updatedAt: queuedAt,
            rawXml: "LOCAL-RAW-SENTINEL-SHOULD-BE-REMOVED"
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const repository = createLocalXmlValidationQueueRepository({
    dataDir,
    organizationId: "org_local_001"
  });
  const result = await runXmlValidationQueueOnce({
    repository,
    now: () => fixedNow
  });
  const storedData = await readFile(dataPath, "utf8");
  const parsed = JSON.parse(storedData) as {
    records: Array<Record<string, unknown>>;
  };
  const storedJob = parsed.records[0];

  assert.ok(storedJob);
  assert.equal(result.status, "failed");
  assert.equal(storedJob.status, "failed");
  assert.equal(storedJob.errorCode, XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE);
  assert.deepEqual(storedJob.completedChecks, []);
  assert.deepEqual(storedJob.failedChecks, ["worker_readiness", "xsd_ubl"]);
  assert.equal("rawXml" in storedJob, false);
  assert.equal(storedData.includes("LOCAL-RAW-SENTINEL-SHOULD-BE-REMOVED"), false);

  const resultSummary = storedJob.resultSummary as Record<string, unknown>;
  const queue = readQueue(resultSummary);

  assert.equal(queue.status, "failed");
  assert.equal(queue.retryable, false);
  assert.equal(queue.failureCode, XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE);
});
