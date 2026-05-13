import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createLocalXmlValidationQueueRepository } from "./queue-repositories.js";
import {
  buildRunningQueueLifecycleFromSummary,
  runXmlValidationQueueOnce,
  XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_CODE,
  XML_VALIDATION_JOB_STALE_RUNNING_REQUEUED_CODE,
  XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE,
  XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE,
  XML_VALIDATION_WORKER_EXECUTION_FAILED_CODE,
  XML_VALIDATION_JOB_WORKER_NAME,
  XML_VALIDATION_JOB_WORKER_VERSION,
  type CompleteXmlValidationQueueJobInput,
  type FailXmlValidationQueueJobInput,
  type RequeueXmlValidationQueueJobInput,
  type XmlValidationQueueJob,
  type XmlValidationQueueRepository
} from "./queue-runner.js";
import {
  createTransientXmlPayload,
  inspectTransientXmlPayloadMetadata,
  XML_TRANSIENT_PAYLOAD_EXPIRED_CODE,
  XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE,
  XML_TRANSIENT_PAYLOAD_MISSING_CODE,
  XML_TRANSIENT_PAYLOAD_SIZE_MISMATCH_CODE
} from "./transient-xml-payload-store.js";

const fixedNow = new Date("2026-05-07T10:30:00.000Z");
const queuedAt = "2026-05-07T10:00:00.000Z";
const startedAt = "2026-05-07T10:15:00.000Z";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function writeTestOnlyInvoiceXsdFixture(tempRoot: string) {
  const maindocPath = join(tempRoot, "xsd", "maindoc");
  const commonPath = join(tempRoot, "xsd", "common");
  const invoiceXsdPath = join(maindocPath, "UBL-Invoice-2.1.xsd");
  const baseXsdPath = join(commonPath, "Invoice-Test-Only-Base.xsd");

  await mkdir(maindocPath, {
    recursive: true
  });
  await mkdir(commonPath, {
    recursive: true
  });
  await writeFile(
    invoiceXsdPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:include schemaLocation="../common/Invoice-Test-Only-Base.xsd"/>
  <xs:element name="Invoice" type="InvoiceType"/>
</xs:schema>`,
    "utf8"
  );
  await writeFile(
    baseXsdPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="InvoiceType">
    <xs:sequence>
      <xs:element name="ID" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`,
    "utf8"
  );

  return invoiceXsdPath;
}

function captureUblXsdEnv() {
  return {
    UBL_XSD_ROOT_DIR: process.env.UBL_XSD_ROOT_DIR,
    UBL_INVOICE_XSD_PATH: process.env.UBL_INVOICE_XSD_PATH,
    UBL_CREDIT_NOTE_XSD_PATH: process.env.UBL_CREDIT_NOTE_XSD_PATH,
    UBL_XSD_ARTIFACT_VERSION: process.env.UBL_XSD_ARTIFACT_VERSION
  };
}

function captureSchematronEnv() {
  return {
    PEPPOL_SCHEMATRON_ROOT_DIR: process.env.PEPPOL_SCHEMATRON_ROOT_DIR,
    PEPPOL_BIS_SCHEMATRON_PATH: process.env.PEPPOL_BIS_SCHEMATRON_PATH,
    EN16931_SCHEMATRON_PATH: process.env.EN16931_SCHEMATRON_PATH,
    SCHEMATRON_ARTIFACT_VERSION: process.env.SCHEMATRON_ARTIFACT_VERSION,
    SCHEMATRON_EXECUTION_MODE: process.env.SCHEMATRON_EXECUTION_MODE,
    SCHEMATRON_ENGINE: process.env.SCHEMATRON_ENGINE,
    SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION:
      process.env.SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION
  };
}

async function writeQueueSchematronFixture(tempRoot: string) {
  const peppolPath = join(tempRoot, "peppol.sch");
  const en16931Path = join(tempRoot, "en16931.sch");

  await writeFile(
    peppolPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xpath3">
  <pattern id="queue-peppol">
    <rule context="/Invoice">
      <assert id="PEPPOL-QUEUE-RULE" test="normalize-space(ID) = 'QUEUE-SCHEMATRON-EXEC'">Peppol-style queue assertion passed.</assert>
    </rule>
  </pattern>
</schema>`,
    "utf8"
  );
  await writeFile(
    en16931Path,
    `<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xpath3">
  <pattern id="queue-en16931">
    <rule context="/Invoice">
      <assert id="EN16931-QUEUE-RULE" test="normalize-space(ID) = 'QUEUE-SCHEMATRON-EXEC'">EN 16931-style queue assertion passed.</assert>
    </rule>
  </pattern>
</schema>`,
    "utf8"
  );

  return {
    peppolPath,
    en16931Path
  };
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function createClaimedJob(input: {
  xmlSha256?: string;
  xmlSizeBytes?: number;
  requestedChecks?: XmlValidationQueueJob["requestedChecks"];
  resultSummary?: Record<string, unknown>;
} = {}): XmlValidationQueueJob {
  const resultSummary = input.resultSummary ?? {
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

function createFakeRepository(
  job: XmlValidationQueueJob | null,
  input: {
    staleJob?: XmlValidationQueueJob | null;
  } = {}
) {
  let completeInput: CompleteXmlValidationQueueJobInput | null = null;
  let failInput: FailXmlValidationQueueJobInput | null = null;
  let requeueInput: RequeueXmlValidationQueueJobInput | null = null;
  let claimCount = 0;
  let staleReadCount = 0;

  const repository: XmlValidationQueueRepository = {
    async claimQueuedJob() {
      claimCount += 1;
      return job;
    },

    async findStaleRunningJob() {
      staleReadCount += 1;
      return input.staleJob ?? null;
    },

    async requeueJob(requeueJobInput) {
      requeueInput = requeueJobInput;
      const sourceJob = input.staleJob ?? job;

      if (!sourceJob) {
        return null;
      }

      return {
        ...sourceJob,
        status: "queued",
        workerName: requeueJobInput.workerName,
        workerVersion: requeueJobInput.workerVersion,
        resultSummary: requeueJobInput.resultSummary,
        updatedAt: requeueJobInput.requeuedAt
      };
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
    getStaleReadCount: () => staleReadCount,
    getCompleteInput: () => completeInput,
    getFailInput: () => failInput,
    getRequeueInput: () => requeueInput
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
  assert.equal("job" in result, false);
  assert.equal(result.events.some((event) => event.status === "job_claimed"), true);
  assert.equal(
    result.events.some((event) => event.status === "job_completed"),
    true
  );
});

test("queue runner persists safe real Schematron execution summaries", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-queue-sch-"));
  const originalEnv = captureSchematronEnv();
  const rawXml = "<Invoice><ID>QUEUE-SCHEMATRON-EXEC</ID></Invoice>";
  const job = createClaimedJob({
    xmlSha256: sha256(rawXml),
    xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
    requestedChecks: ["schematron_peppol"]
  });
  const fake = createFakeRepository(job);

  try {
    const fixture = await writeQueueSchematronFixture(tempRoot);

    process.env.PEPPOL_SCHEMATRON_ROOT_DIR = tempRoot;
    process.env.PEPPOL_BIS_SCHEMATRON_PATH = fixture.peppolPath;
    process.env.EN16931_SCHEMATRON_PATH = fixture.en16931Path;
    process.env.SCHEMATRON_ARTIFACT_VERSION = "queue-step-8-test";
    process.env.SCHEMATRON_EXECUTION_MODE = "execute";
    process.env.SCHEMATRON_ENGINE = "xpath_engine";
    process.env.SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION = "true";

    const result = await runXmlValidationQueueOnce({
      repository: fake.repository,
      loadTransientXml: async () => rawXml,
      now: () => fixedNow
    });
    const completeInput = fake.getCompleteInput();

    assert.equal(result.status, "completed");
    assert.ok(completeInput);
    assert.deepEqual(completeInput.completedChecks, ["schematron_peppol"]);
    assert.deepEqual(completeInput.failedChecks, []);

    const schematronPeppol = completeInput.resultSummary
      .schematronPeppol as Record<string, unknown>;
    const checkStatuses = completeInput.resultSummary
      .checkStatuses as Record<string, unknown>;

    assert.equal(checkStatuses.schematron_peppol, "passed");
    assert.equal(schematronPeppol.implemented, true);
    assert.equal(schematronPeppol.policyMode, "execute");
    assert.equal(schematronPeppol.engineId, "xpath_engine");
    assert.equal(schematronPeppol.validationExecuted, true);
    assert.equal(schematronPeppol.markedValid, true);
    assert.equal(schematronPeppol.status, "passed");
    assert.equal(JSON.stringify(completeInput).includes(rawXml), false);
    assert.equal(JSON.stringify(completeInput).includes(fixture.peppolPath), false);
    assert.equal(JSON.stringify(completeInput).includes(fixture.en16931Path), false);
    assert.equal(JSON.stringify(completeInput).includes(tempRoot), false);
    assert.doesNotMatch(
      JSON.stringify(completeInput),
      /\bPeppol certified\b|\bEN 16931 compliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i
    );
  } finally {
    restoreEnv(originalEnv);
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("queue runner requeues retryable worker execution failures when attempts remain", async () => {
  const rawXml = "<Invoice><ID>RETRYABLE-WORKER-FAILURE</ID></Invoice>";
  const job = createClaimedJob({
    xmlSha256: sha256(rawXml),
    xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
    requestedChecks: ["worker_readiness"],
    resultSummary: {
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
    }
  });
  const fake = createFakeRepository(job);
  const result = await runXmlValidationQueueOnce({
    repository: fake.repository,
    loadTransientXml: async () => rawXml,
    validator: async () => {
      throw new Error("simulated worker failure");
    },
    now: () => fixedNow
  });
  const requeueInput = fake.getRequeueInput();

  assert.equal(result.status, "requeued");
  assert.equal(result.errorCode, XML_VALIDATION_WORKER_EXECUTION_FAILED_CODE);
  assert.equal(result.retryable, true);
  assert.equal(result.attempt, 2);
  assert.equal(result.maxAttempts, 3);
  assert.equal(fake.getCompleteInput(), null);
  assert.equal(fake.getFailInput(), null);
  assert.ok(requeueInput);

  const queue = readQueue(requeueInput.resultSummary);

  assert.equal(queue.status, "queued");
  assert.equal(queue.attempt, 2);
  assert.equal(queue.failureCode, XML_VALIDATION_WORKER_EXECUTION_FAILED_CODE);
  assert.equal(JSON.stringify(result).includes(rawXml), false);
  assert.equal(JSON.stringify(requeueInput).includes(rawXml), false);
});

test("queue runner fails retryable worker failures when max attempts are exhausted", async () => {
  const rawXml = "<Invoice><ID>MAX-ATTEMPTS-WORKER-FAILURE</ID></Invoice>";
  const job = createClaimedJob({
    xmlSha256: sha256(rawXml),
    xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
    requestedChecks: ["worker_readiness"],
    resultSummary: {
      queue: buildRunningQueueLifecycleFromSummary({
        existingSummary: {
          queue: {
            queuedAt,
            attempt: 3,
            maxAttempts: 3,
            leaseSeconds: 120,
            timeoutSeconds: 300
          }
        },
        now: startedAt,
        claimedBy: XML_VALIDATION_JOB_WORKER_NAME
      })
    }
  });
  const fake = createFakeRepository(job);
  const result = await runXmlValidationQueueOnce({
    repository: fake.repository,
    loadTransientXml: async () => rawXml,
    validator: async () => {
      throw new Error("simulated worker failure");
    },
    now: () => fixedNow
  });
  const failInput = fake.getFailInput();

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_CODE);
  assert.equal(result.retryable, false);
  assert.equal(result.attempt, 3);
  assert.equal(fake.getRequeueInput(), null);
  assert.ok(failInput);
  assert.equal(
    failInput.errorCode,
    XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_CODE
  );

  const queue = readQueue(failInput.resultSummary);

  assert.equal(queue.status, "failed");
  assert.equal(queue.retryable, false);
  assert.equal(queue.failureCode, XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_CODE);
  assert.equal(JSON.stringify(result).includes(rawXml), false);
  assert.equal(JSON.stringify(failInput).includes(rawXml), false);
});

test("queue runner requeues stale running jobs with expired leases", async () => {
  const staleJob = createClaimedJob({
    requestedChecks: ["worker_readiness"],
    resultSummary: {
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
    }
  });
  const fake = createFakeRepository(null, {
    staleJob
  });
  const result = await runXmlValidationQueueOnce({
    repository: fake.repository,
    now: () => fixedNow
  });
  const requeueInput = fake.getRequeueInput();

  assert.equal(result.status, "requeued");
  assert.equal(result.errorCode, XML_VALIDATION_JOB_STALE_RUNNING_REQUEUED_CODE);
  assert.equal(fake.getClaimCount(), 0);
  assert.ok(requeueInput);

  const queue = readQueue(requeueInput.resultSummary);

  assert.equal(queue.status, "queued");
  assert.equal(queue.attempt, 2);
  assert.equal(
    queue.failureCode,
    XML_VALIDATION_JOB_STALE_RUNNING_REQUEUED_CODE
  );
});

test("queue runner fails stale running jobs when attempts are exhausted", async () => {
  const staleJob = createClaimedJob({
    requestedChecks: ["worker_readiness"],
    resultSummary: {
      queue: buildRunningQueueLifecycleFromSummary({
        existingSummary: {
          queue: {
            queuedAt,
            attempt: 3,
            maxAttempts: 3,
            leaseSeconds: 120,
            timeoutSeconds: 300
          }
        },
        now: startedAt,
        claimedBy: XML_VALIDATION_JOB_WORKER_NAME
      })
    }
  });
  const fake = createFakeRepository(null, {
    staleJob
  });
  const result = await runXmlValidationQueueOnce({
    repository: fake.repository,
    now: () => fixedNow
  });
  const failInput = fake.getFailInput();

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_CODE);
  assert.equal(result.retryable, false);
  assert.equal(fake.getClaimCount(), 0);
  assert.ok(failInput);
  assert.equal(
    failInput.errorCode,
    XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_CODE
  );
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
  assert.equal(result.errorCode, XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE);
  assert.equal(fake.getCompleteInput(), null);
  assert.ok(failInput);
  assert.deepEqual(failInput.failedChecks, ["xsd_ubl"]);
  assert.equal(failInput.resultSummary.xsdUbl instanceof Object, true);
  assert.equal(JSON.stringify(failInput).includes(rawXml), false);
  assert.equal(JSON.stringify(failInput).includes("MISMATCHED-XML-STEP-43"), false);
});

test("queue runner fails size-mismatched transient XML without validation output", async () => {
  const rawXml = "<Invoice><ID>SIZE-MISMATCHED-XML-STEP-7</ID></Invoice>";
  const job = createClaimedJob({
    xmlSha256: sha256(rawXml),
    xmlSizeBytes: Buffer.byteLength(rawXml, "utf8") + 1,
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
  assert.equal(result.errorCode, XML_TRANSIENT_PAYLOAD_SIZE_MISMATCH_CODE);
  assert.equal(fake.getCompleteInput(), null);
  assert.ok(failInput);
  assert.deepEqual(failInput.failedChecks, ["xsd_ubl"]);
  assert.equal(JSON.stringify(failInput).includes(rawXml), false);
  assert.equal(
    JSON.stringify(failInput).includes("SIZE-MISMATCHED-XML-STEP-7"),
    false
  );
});

test("queue runner completes from transient payload reference and deletes payload", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "invoice-lantern-runner-"));
  const rawXml = "<Invoice><ID>TRANSIENT-RUNNER-STEP-44</ID></Invoice>";

  try {
    const reference = await createTransientXmlPayload({
      xml: rawXml,
      rootDir,
      now: fixedNow,
      ttlSeconds: 600
    });
    const job = createClaimedJob({
      xmlSha256: sha256(rawXml),
      xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
      requestedChecks: ["worker_readiness"],
      resultSummary: {
        queue: buildRunningQueueLifecycleFromSummary({
          existingSummary: {
            queue: {
              queuedAt
            }
          },
          now: startedAt,
          claimedBy: XML_VALIDATION_JOB_WORKER_NAME
        }),
        transientPayload: reference
      }
    });
    const fake = createFakeRepository(job);
    const result = await runXmlValidationQueueOnce({
      repository: fake.repository,
      transientPayloadStore: {
        rootDir,
        maxBytes: 2 * 1024 * 1024,
        now: () => fixedNow
      },
      now: () => fixedNow
    });
    const completeInput = fake.getCompleteInput();
    const metadata = await inspectTransientXmlPayloadMetadata({
      payloadId: reference.payloadId,
      rootDir
    });

    assert.equal(result.status, "completed");
    assert.ok(completeInput);
    assert.deepEqual(completeInput.completedChecks, ["worker_readiness"]);
    assert.equal(metadata.exists, false);
    assert.equal(JSON.stringify(completeInput).includes(rawXml), false);
    assert.equal(
      JSON.stringify(completeInput).includes("TRANSIENT-RUNNER-STEP-44"),
      false
    );
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});

test("queue runner persists real configured XSD completion from transient XML", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "invoice-lantern-runner-"));
  const xsdRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-runner-xsd-"));
  const originalEnv = captureUblXsdEnv();
  const rawXml = "<Invoice><ID>TRANSIENT-RUNNER-XSD-REAL</ID></Invoice>";

  try {
    const invoiceXsdPath = await writeTestOnlyInvoiceXsdFixture(xsdRoot);
    const reference = await createTransientXmlPayload({
      xml: rawXml,
      rootDir,
      now: fixedNow,
      ttlSeconds: 600
    });

    process.env.UBL_XSD_ROOT_DIR = xsdRoot;
    process.env.UBL_INVOICE_XSD_PATH = invoiceXsdPath;
    delete process.env.UBL_CREDIT_NOTE_XSD_PATH;
    process.env.UBL_XSD_ARTIFACT_VERSION = "runner-test-only";

    const job = createClaimedJob({
      xmlSha256: sha256(rawXml),
      xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
      requestedChecks: ["xsd_ubl"],
      resultSummary: {
        queue: buildRunningQueueLifecycleFromSummary({
          existingSummary: {
            queue: {
              queuedAt
            }
          },
          now: startedAt,
          claimedBy: XML_VALIDATION_JOB_WORKER_NAME
        }),
        transientPayload: reference
      }
    });
    const fake = createFakeRepository(job);
    const result = await runXmlValidationQueueOnce({
      repository: fake.repository,
      transientPayloadStore: {
        rootDir,
        maxBytes: 2 * 1024 * 1024,
        now: () => fixedNow
      },
      now: () => fixedNow
    });
    const completeInput = fake.getCompleteInput();
    const metadata = await inspectTransientXmlPayloadMetadata({
      payloadId: reference.payloadId,
      rootDir
    });

    assert.equal(result.status, "completed");
    assert.ok(completeInput);
    assert.deepEqual(completeInput.completedChecks, ["xsd_ubl"]);
    assert.deepEqual(completeInput.failedChecks, []);
    assert.equal(metadata.exists, false);

    const xsdUbl = completeInput.resultSummary.xsdUbl as Record<string, unknown>;
    const checkStatuses = completeInput.resultSummary.checkStatuses as Record<
      string,
      unknown
    >;

    assert.equal(checkStatuses.xsd_ubl, "passed");
    assert.equal(xsdUbl.configured, true);
    assert.equal(xsdUbl.validationExecuted, true);
    assert.equal(xsdUbl.markedValid, true);
    assert.equal(xsdUbl.status, "passed");
    assert.match(String(xsdUbl.disclaimer), /technical schema check only/i);
    assert.equal(JSON.stringify(completeInput).includes(rawXml), false);
    assert.equal(
      JSON.stringify(completeInput).includes("TRANSIENT-RUNNER-XSD-REAL"),
      false
    );
  } finally {
    restoreEnv(originalEnv);
    await rm(rootDir, {
      force: true,
      recursive: true
    });
    await rm(xsdRoot, {
      force: true,
      recursive: true
    });
  }
});

test("queue runner stores worker Schematron orchestration metadata without raw XML", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "invoice-lantern-runner-sch-"));
  const rawXml =
    "<Invoice><ID>TRANSIENT-RUNNER-SCHEMATRON-58</ID></Invoice>";

  try {
    const reference = await createTransientXmlPayload({
      xml: rawXml,
      rootDir,
      now: fixedNow,
      ttlSeconds: 600
    });
    const job = createClaimedJob({
      xmlSha256: sha256(rawXml),
      xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
      requestedChecks: ["schematron_peppol_placeholder"],
      resultSummary: {
        queue: buildRunningQueueLifecycleFromSummary({
          existingSummary: {
            queue: {
              queuedAt
            }
          },
          now: startedAt,
          claimedBy: XML_VALIDATION_JOB_WORKER_NAME
        }),
        transientPayload: reference
      }
    });
    const fake = createFakeRepository(job);
    const result = await runXmlValidationQueueOnce({
      repository: fake.repository,
      transientPayloadStore: {
        rootDir,
        maxBytes: 2 * 1024 * 1024,
        now: () => fixedNow
      },
      now: () => fixedNow
    });
    const completeInput = fake.getCompleteInput();
    const metadata = await inspectTransientXmlPayloadMetadata({
      payloadId: reference.payloadId,
      rootDir
    });

    assert.equal(result.status, "completed");
    assert.ok(completeInput);
    assert.deepEqual(completeInput.completedChecks, []);
    assert.deepEqual(completeInput.failedChecks, [
      "schematron_peppol_placeholder"
    ]);
    assert.equal(metadata.exists, false);

    const schematronPeppol = completeInput.resultSummary
      .schematronPeppol as Record<string, unknown>;
    const orchestration = schematronPeppol.schematronOrchestration as Record<
      string,
      unknown
    >;

    assert.equal(
      schematronPeppol.workerSchematronOrchestratorVersion,
      "xml_worker_schematron_orchestrator_v1"
    );
    assert.equal(schematronPeppol.orchestrationMode, "preflight_only");
    assert.equal(orchestration.validationExecutionEnabled, false);
    assert.equal(orchestration.validationExecuted, false);
    assert.equal(orchestration.markedValid, false);
    assert.equal(JSON.stringify(completeInput).includes(rawXml), false);
    assert.equal(
      JSON.stringify(completeInput).includes("TRANSIENT-RUNNER-SCHEMATRON-58"),
      false
    );
    assert.equal(JSON.stringify(result).includes(rawXml), false);
    assert.equal(
      JSON.stringify(result).includes("TRANSIENT-RUNNER-SCHEMATRON-58"),
      false
    );
    assert.doesNotMatch(
      JSON.stringify(completeInput),
      /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i
    );
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});

test("queue runner fails missing transient payload and keeps raw XML absent", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "invoice-lantern-runner-"));
  const reference = {
    payloadId: "xmlpayload_11111111-1111-4111-8111-111111111111",
    sha256: "1".repeat(64),
    byteLength: 12,
    createdAt: fixedNow.toISOString(),
    expiresAt: new Date(fixedNow.getTime() + 60000).toISOString(),
    storageProvider: "local_file_v1" as const
  };
  const job = createClaimedJob({
    requestedChecks: ["worker_readiness"],
    resultSummary: {
      queue: buildRunningQueueLifecycleFromSummary({
        existingSummary: {
          queue: {
            queuedAt
          }
        },
        now: startedAt,
        claimedBy: XML_VALIDATION_JOB_WORKER_NAME
      }),
      transientPayload: reference
    }
  });

  try {
    const fake = createFakeRepository(job);
    const result = await runXmlValidationQueueOnce({
      repository: fake.repository,
      transientPayloadStore: {
        rootDir,
        now: () => fixedNow
      },
      now: () => fixedNow
    });
    const failInput = fake.getFailInput();

    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, XML_TRANSIENT_PAYLOAD_MISSING_CODE);
    assert.ok(failInput);
    assert.equal(failInput.errorCode, XML_TRANSIENT_PAYLOAD_MISSING_CODE);
    assert.equal(JSON.stringify(failInput).includes("<Invoice"), false);
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});

test("queue runner fails expired transient payload and deletes payload", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "invoice-lantern-runner-"));
  const rawXml = "<Invoice><ID>TRANSIENT-RUNNER-EXPIRED</ID></Invoice>";

  try {
    const reference = await createTransientXmlPayload({
      xml: rawXml,
      rootDir,
      now: fixedNow,
      ttlSeconds: 60
    });
    const job = createClaimedJob({
      xmlSha256: sha256(rawXml),
      xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
      requestedChecks: ["worker_readiness"],
      resultSummary: {
        queue: buildRunningQueueLifecycleFromSummary({
          existingSummary: {
            queue: {
              queuedAt
            }
          },
          now: startedAt,
          claimedBy: XML_VALIDATION_JOB_WORKER_NAME
        }),
        transientPayload: reference
      }
    });
    const fake = createFakeRepository(job);
    const result = await runXmlValidationQueueOnce({
      repository: fake.repository,
      transientPayloadStore: {
        rootDir,
        now: () => new Date(fixedNow.getTime() + 61000)
      },
      now: () => fixedNow
    });
    const metadata = await inspectTransientXmlPayloadMetadata({
      payloadId: reference.payloadId,
      rootDir
    });

    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, XML_TRANSIENT_PAYLOAD_EXPIRED_CODE);
    assert.equal(metadata.exists, false);
    assert.equal(JSON.stringify(result).includes(rawXml), false);
    assert.equal(JSON.stringify(result).includes("TRANSIENT-RUNNER-EXPIRED"), false);
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});

test("queue runner fails hash-mismatched transient payload and deletes payload", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "invoice-lantern-runner-"));
  const rawXml = "<Invoice><ID>TRANSIENT-RUNNER-HASH</ID></Invoice>";

  try {
    const reference = await createTransientXmlPayload({
      xml: rawXml,
      rootDir,
      now: fixedNow,
      ttlSeconds: 600
    });
    await writeFile(
      join(rootDir, `${reference.payloadId}.xml`),
      "<Invoice><ID>TRANSIENT-RUNNER-MASH</ID></Invoice>",
      "utf8"
    );

    const job = createClaimedJob({
      xmlSha256: sha256(rawXml),
      xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
      requestedChecks: ["worker_readiness"],
      resultSummary: {
        queue: buildRunningQueueLifecycleFromSummary({
          existingSummary: {
            queue: {
              queuedAt
            }
          },
          now: startedAt,
          claimedBy: XML_VALIDATION_JOB_WORKER_NAME
        }),
        transientPayload: reference
      }
    });
    const fake = createFakeRepository(job);
    const result = await runXmlValidationQueueOnce({
      repository: fake.repository,
      transientPayloadStore: {
        rootDir,
        now: () => fixedNow
      },
      now: () => fixedNow
    });
    const metadata = await inspectTransientXmlPayloadMetadata({
      payloadId: reference.payloadId,
      rootDir
    });

    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE);
    assert.equal(metadata.exists, false);
    assert.equal(JSON.stringify(result).includes(rawXml), false);
    assert.equal(JSON.stringify(result).includes("TRANSIENT-RUNNER-MASH"), false);
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
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
