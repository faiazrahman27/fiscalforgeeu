import { createHash } from "node:crypto";
import { inspectXmlSafety } from "@invoice-lantern/ubl";
import { runStubXmlValidator } from "./stub-validator.js";
import {
  deleteTransientXmlPayload,
  readTransientXmlPayload,
  readTransientXmlPayloadReferenceFromSummary
} from "./transient-xml-payload-store.js";
import type {
  XmlWorkerCheck,
  XmlWorkerFinding,
  XmlWorkerResult
} from "./worker-types.js";

export const XML_VALIDATION_JOB_DISCLAIMER =
  "This XML validation job is a technical sandbox worker-readiness and configured-check result. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance.";

export const XML_VALIDATION_JOB_WORKER_NAME = "invoice-lantern-xml-worker";
export const XML_VALIDATION_JOB_WORKER_VERSION = "0.2.0";

export const XML_VALIDATION_JOB_QUEUE_VERSION = "2026.05.1";
export const XML_VALIDATION_JOB_QUEUE_LEASE_SECONDS = 120;
export const XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS = 300;
export const XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS = 3;

export const XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE =
  "XML_VALIDATION_JOB_XML_PAYLOAD_UNAVAILABLE";
export const XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE =
  "This queued XML validation job cannot be processed by the async worker because Invoice Lantern stores validation job metadata only, not raw XML payloads. No XML validation was executed and no success result was inferred.";

const XML_VALIDATION_JOB_TRANSIENT_XML_MISMATCH_CODE =
  "XML_VALIDATION_JOB_TRANSIENT_XML_MISMATCH";
const XML_VALIDATION_JOB_TRANSIENT_XML_MISMATCH_MESSAGE =
  "The transient XML input did not match the queued job metadata. No XML validation was executed and no success result was inferred.";
const XML_VALIDATION_JOB_TRANSIENT_XML_UNSAFE_CODE =
  "XML_VALIDATION_JOB_TRANSIENT_XML_UNSAFE";
const XML_VALIDATION_JOB_TRANSIENT_XML_UNSAFE_MESSAGE =
  "The transient XML input failed XML safety inspection. No XML validation was executed and no success result was inferred.";
const XML_VALIDATION_JOB_WORKER_EXCEPTION_CODE =
  "XML_VALIDATION_JOB_WORKER_EXCEPTION";
const XML_VALIDATION_JOB_WORKER_EXCEPTION_MESSAGE =
  "The XML validation worker encountered a processing error. No XML validation success result was inferred.";

export type XmlValidationQueueLifecycleStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type XmlValidationJobQueueMode = "inline" | "async_worker";

export type XmlValidationQueueLifecycle = {
  queueVersion: string;
  mode: XmlValidationJobQueueMode;
  status: XmlValidationQueueLifecycleStatus;
  attempt: number;
  maxAttempts: number;
  leaseSeconds: number;
  timeoutSeconds: number;
  retryable: boolean;
  queuedAt: string;
  nextAttemptAt?: string;
  claimedBy?: string;
  claimedAt?: string;
  leaseExpiresAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  failureCode?: string;
  failureMessage?: string;
};

export type XmlValidationQueueJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type XmlValidationQueueJob = {
  id: string;
  organizationId: string;
  documentType: string | null;
  xmlSha256: string;
  xmlSizeBytes: number;
  status: XmlValidationQueueJobStatus;
  requestedChecks: XmlWorkerCheck[];
  completedChecks: XmlWorkerCheck[];
  failedChecks: XmlWorkerCheck[];
  workerName: string | null;
  workerVersion: string | null;
  startedAt: string | null;
  resultSummary: Record<string, unknown>;
  findings: XmlWorkerFinding[];
  disclaimer: string;
  createdAt: string;
  updatedAt: string;
};

export type ClaimQueuedXmlValidationJobInput = {
  workerName: string;
  workerVersion: string;
};

export type CompleteXmlValidationQueueJobInput = {
  organizationId: string;
  jobId: string;
  completedAt: string;
  completedChecks: XmlWorkerCheck[];
  failedChecks: XmlWorkerCheck[];
  workerName: string;
  workerVersion: string;
  resultSummary: Record<string, unknown>;
  findings: XmlWorkerFinding[];
  disclaimer: string;
};

export type FailXmlValidationQueueJobInput = {
  organizationId: string;
  jobId: string;
  failedAt: string;
  errorCode: string;
  errorMessage: string;
  failedChecks: XmlWorkerCheck[];
  workerName: string;
  workerVersion: string;
  resultSummary: Record<string, unknown>;
  findings: XmlWorkerFinding[];
  disclaimer: string;
};

export type XmlValidationQueueRepository = {
  claimQueuedJob(
    input: ClaimQueuedXmlValidationJobInput
  ): Promise<XmlValidationQueueJob | null>;
  completeJob(
    input: CompleteXmlValidationQueueJobInput
  ): Promise<XmlValidationQueueJob | null>;
  failJob(
    input: FailXmlValidationQueueJobInput
  ): Promise<XmlValidationQueueJob | null>;
};

export type XmlValidationTransientXmlProvider = (
  job: XmlValidationQueueJob
) => Promise<string | null>;

export type XmlValidationQueueRunnerResult = {
  status: "idle" | "completed" | "failed";
  workerName: string;
  workerVersion: string;
  message: string;
  jobId?: string;
  organizationId?: string;
  errorCode?: string;
  errorMessage?: string;
  job?: XmlValidationQueueJob;
};

export type RunXmlValidationQueueOnceInput = {
  repository: XmlValidationQueueRepository;
  loadTransientXml?: XmlValidationTransientXmlProvider;
  transientPayloadStore?: {
    rootDir?: string;
    maxBytes?: number;
    now?: () => Date;
  };
  workerName?: string;
  workerVersion?: string;
  now?: () => Date;
};

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function toIsoDateTime(value: Date | string | undefined) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return new Date().toISOString();
}

function addSecondsToIsoDateTime(value: string, seconds: number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  date.setSeconds(date.getSeconds() + seconds);

  return date.toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readQueueLifecycle(
  summary: Record<string, unknown>
): Record<string, unknown> | null {
  const value = summary.queue;

  return isPlainObject(value) ? value : null;
}

function readQueueString(
  queue: Record<string, unknown> | null,
  key: string
): string | undefined {
  if (!queue) {
    return undefined;
  }

  const value = queue[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readQueueNumber(
  queue: Record<string, unknown> | null,
  key: string
): number | undefined {
  if (!queue) {
    return undefined;
  }

  const value = queue[key];

  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function readQueueMode(
  queue: Record<string, unknown> | null
): XmlValidationJobQueueMode | undefined {
  if (!queue) {
    return undefined;
  }

  return queue.mode === "inline" || queue.mode === "async_worker"
    ? queue.mode
    : undefined;
}

function normalizeRequestedChecks(
  checks: readonly XmlWorkerCheck[]
): XmlWorkerCheck[] {
  const requestedChecks: XmlWorkerCheck[] =
    checks.length > 0 ? [...checks] : ["worker_readiness"];

  return [...new Set(requestedChecks)];
}

function calculateXmlSha256(xml: string) {
  return createHash("sha256").update(xml, "utf8").digest("hex");
}

function getUtf8ByteLength(xml: string) {
  return Buffer.byteLength(xml, "utf8");
}

function summarizeRequestedCheckErrors(checks: readonly XmlWorkerCheck[]) {
  return checks.reduce<Record<string, string>>((summary, check) => {
    summary[check] = "error";
    return summary;
  }, {});
}

function buildRunningXmlValidationJobLifecycle(input: {
  queuedAt?: Date | string;
  now?: Date | string;
  attempt?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
  timeoutSeconds?: number;
  claimedBy?: string;
}): XmlValidationQueueLifecycle {
  const startedAt = toIsoDateTime(input.now);
  const queuedAt = toIsoDateTime(input.queuedAt ?? startedAt);
  const leaseSeconds = normalizePositiveInteger(
    input.leaseSeconds,
    XML_VALIDATION_JOB_QUEUE_LEASE_SECONDS
  );
  const timeoutSeconds = normalizePositiveInteger(
    input.timeoutSeconds,
    XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS
  );
  const maxAttempts = normalizePositiveInteger(
    input.maxAttempts,
    XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS
  );
  const attempt = normalizePositiveInteger(input.attempt, 1);

  return {
    queueVersion: XML_VALIDATION_JOB_QUEUE_VERSION,
    mode: "async_worker",
    status: "running",
    attempt,
    maxAttempts,
    leaseSeconds,
    timeoutSeconds,
    retryable: attempt < maxAttempts,
    queuedAt,
    claimedAt: startedAt,
    leaseExpiresAt: addSecondsToIsoDateTime(startedAt, leaseSeconds),
    startedAt,
    ...(input.claimedBy ? { claimedBy: input.claimedBy } : {})
  };
}

function buildCompletedXmlValidationJobLifecycle(input: {
  mode?: XmlValidationJobQueueMode;
  queuedAt?: Date | string;
  startedAt?: Date | string;
  completedAt?: Date | string;
  attempt?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
  timeoutSeconds?: number;
  claimedBy?: string;
}): XmlValidationQueueLifecycle {
  const completedAt = toIsoDateTime(input.completedAt);
  const queuedAt = toIsoDateTime(input.queuedAt ?? completedAt);
  const startedAt = toIsoDateTime(input.startedAt ?? completedAt);
  const leaseSeconds = normalizePositiveInteger(
    input.leaseSeconds,
    XML_VALIDATION_JOB_QUEUE_LEASE_SECONDS
  );
  const timeoutSeconds = normalizePositiveInteger(
    input.timeoutSeconds,
    XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS
  );
  const maxAttempts = normalizePositiveInteger(
    input.maxAttempts,
    XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS
  );
  const attempt = normalizePositiveInteger(input.attempt, 1);

  return {
    queueVersion: XML_VALIDATION_JOB_QUEUE_VERSION,
    mode: input.mode ?? "async_worker",
    status: "completed",
    attempt,
    maxAttempts,
    leaseSeconds,
    timeoutSeconds,
    retryable: false,
    queuedAt,
    startedAt,
    completedAt,
    ...(input.claimedBy ? { claimedBy: input.claimedBy } : {})
  };
}

function buildFailedXmlValidationJobLifecycle(input: {
  mode?: XmlValidationJobQueueMode;
  queuedAt?: Date | string;
  startedAt?: Date | string;
  failedAt?: Date | string;
  attempt?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
  timeoutSeconds?: number;
  claimedBy?: string;
  failureCode: string;
  failureMessage: string;
  retryable?: boolean;
}): XmlValidationQueueLifecycle {
  const failedAt = toIsoDateTime(input.failedAt);
  const queuedAt = toIsoDateTime(input.queuedAt ?? failedAt);
  const startedAt = toIsoDateTime(input.startedAt ?? failedAt);
  const leaseSeconds = normalizePositiveInteger(
    input.leaseSeconds,
    XML_VALIDATION_JOB_QUEUE_LEASE_SECONDS
  );
  const timeoutSeconds = normalizePositiveInteger(
    input.timeoutSeconds,
    XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS
  );
  const maxAttempts = normalizePositiveInteger(
    input.maxAttempts,
    XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS
  );
  const attempt = normalizePositiveInteger(input.attempt, 1);
  const retryable = input.retryable ?? attempt < maxAttempts;

  return {
    queueVersion: XML_VALIDATION_JOB_QUEUE_VERSION,
    mode: input.mode ?? "async_worker",
    status: "failed",
    attempt,
    maxAttempts,
    leaseSeconds,
    timeoutSeconds,
    retryable,
    queuedAt,
    startedAt,
    failedAt,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
    ...(retryable
      ? { nextAttemptAt: addSecondsToIsoDateTime(failedAt, 60) }
      : {}),
    ...(input.claimedBy ? { claimedBy: input.claimedBy } : {})
  };
}

export function buildRunningQueueLifecycleFromSummary(input: {
  existingSummary: Record<string, unknown>;
  now: string;
  claimedBy?: string | null;
}): XmlValidationQueueLifecycle {
  const existingQueue = readQueueLifecycle(input.existingSummary);
  const queuedAt = readQueueString(existingQueue, "queuedAt");
  const attempt = readQueueNumber(existingQueue, "attempt");
  const maxAttempts = readQueueNumber(existingQueue, "maxAttempts");
  const leaseSeconds = readQueueNumber(existingQueue, "leaseSeconds");
  const timeoutSeconds = readQueueNumber(existingQueue, "timeoutSeconds");
  const claimedBy =
    input.claimedBy && input.claimedBy.trim().length > 0
      ? input.claimedBy.trim()
      : readQueueString(existingQueue, "claimedBy");

  return buildRunningXmlValidationJobLifecycle({
    now: input.now,
    ...(queuedAt ? { queuedAt } : {}),
    ...(attempt ? { attempt } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(leaseSeconds ? { leaseSeconds } : {}),
    ...(timeoutSeconds ? { timeoutSeconds } : {}),
    ...(claimedBy ? { claimedBy } : {})
  });
}

function buildCompletedQueueLifecycleForJob(input: {
  job: XmlValidationQueueJob;
  completedAt: string;
  workerName: string;
}): XmlValidationQueueLifecycle {
  const existingQueue = readQueueLifecycle(input.job.resultSummary);
  const mode = readQueueMode(existingQueue);
  const queuedAt = readQueueString(existingQueue, "queuedAt");
  const startedAt =
    input.job.startedAt && input.job.startedAt.trim().length > 0
      ? input.job.startedAt
      : readQueueString(existingQueue, "startedAt");
  const attempt = readQueueNumber(existingQueue, "attempt");
  const maxAttempts = readQueueNumber(existingQueue, "maxAttempts");
  const leaseSeconds = readQueueNumber(existingQueue, "leaseSeconds");
  const timeoutSeconds = readQueueNumber(existingQueue, "timeoutSeconds");
  const claimedBy =
    input.workerName.trim().length > 0
      ? input.workerName.trim()
      : readQueueString(existingQueue, "claimedBy");

  return buildCompletedXmlValidationJobLifecycle({
    completedAt: input.completedAt,
    ...(mode ? { mode } : {}),
    ...(queuedAt ? { queuedAt } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(attempt ? { attempt } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(leaseSeconds ? { leaseSeconds } : {}),
    ...(timeoutSeconds ? { timeoutSeconds } : {}),
    ...(claimedBy ? { claimedBy } : {})
  });
}

function buildFailedQueueLifecycleForJob(input: {
  job: XmlValidationQueueJob;
  failedAt: string;
  workerName: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}): XmlValidationQueueLifecycle {
  const existingQueue = readQueueLifecycle(input.job.resultSummary);
  const mode = readQueueMode(existingQueue);
  const queuedAt = readQueueString(existingQueue, "queuedAt");
  const startedAt =
    input.job.startedAt && input.job.startedAt.trim().length > 0
      ? input.job.startedAt
      : readQueueString(existingQueue, "startedAt");
  const attempt = readQueueNumber(existingQueue, "attempt");
  const maxAttempts = readQueueNumber(existingQueue, "maxAttempts");
  const leaseSeconds = readQueueNumber(existingQueue, "leaseSeconds");
  const timeoutSeconds = readQueueNumber(existingQueue, "timeoutSeconds");
  const claimedBy =
    input.workerName.trim().length > 0
      ? input.workerName.trim()
      : readQueueString(existingQueue, "claimedBy");

  return buildFailedXmlValidationJobLifecycle({
    failedAt: input.failedAt,
    failureCode: input.errorCode,
    failureMessage: input.errorMessage,
    retryable: input.retryable,
    ...(mode ? { mode } : {}),
    ...(queuedAt ? { queuedAt } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(attempt ? { attempt } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(leaseSeconds ? { leaseSeconds } : {}),
    ...(timeoutSeconds ? { timeoutSeconds } : {}),
    ...(claimedBy ? { claimedBy } : {})
  });
}

function buildQueueFailureFinding(input: {
  errorCode: string;
  errorMessage: string;
}): XmlWorkerFinding {
  return {
    code: input.errorCode,
    severity: "warning",
    checkType: "worker_readiness",
    field: "xml",
    message: input.errorMessage,
    status: "error",
    legalConfidence: "technical",
    fixSuggestion:
      "Use the inline XML validation API path until a future transient XML handoff is available for asynchronous worker processing.",
    sourceLabels: ["Invoice Lantern XML validation queue"]
  };
}

function buildQueueFailureResult(input: {
  job: XmlValidationQueueJob;
  workerName: string;
  workerVersion: string;
  failedAt: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}): FailXmlValidationQueueJobInput {
  const requestedChecks = normalizeRequestedChecks(input.job.requestedChecks);
  const failedChecks = [...requestedChecks];
  const finding = buildQueueFailureFinding({
    errorCode: input.errorCode,
    errorMessage: input.errorMessage
  });
  const queue = buildFailedQueueLifecycleForJob({
    job: input.job,
    failedAt: input.failedAt,
    workerName: input.workerName,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    retryable: input.retryable
  });

  return {
    organizationId: input.job.organizationId,
    jobId: input.job.id,
    failedAt: input.failedAt,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    failedChecks,
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    resultSummary: {
      workerReady: false,
      queueRunnerReady: true,
      xmlSha256: input.job.xmlSha256,
      xmlSizeBytes: input.job.xmlSizeBytes,
      rootElement: "unknown",
      documentType: input.job.documentType ?? "unknown",
      safetyPolicyPassed: false,
      requestedChecks,
      completedChecks: [],
      failedChecks,
      inactiveChecks: failedChecks,
      checkResults: [
        {
          checkType: "worker_readiness",
          status: "error",
          findings: [finding],
          summary: {
            validationExecuted: false,
            errorCode: input.errorCode,
            retryable: queue.retryable
          }
        }
      ],
      checkStatuses: summarizeRequestedCheckErrors(requestedChecks),
      queue,
      activeValidation: {
        xsd: false,
        schematron: false,
        peppolArtifacts: false,
        en16931Certification: false
      },
      xsdUbl: {
        requested: requestedChecks.includes("xsd_ubl"),
        configured: false,
        validationExecuted: false,
        markedValid: false
      },
      schematronPeppol: {
        requested: requestedChecks.includes("schematron_peppol_placeholder"),
        implemented: false,
        validationExecuted: false,
        markedValid: false
      }
    },
    findings: [finding],
    disclaimer: XML_VALIDATION_JOB_DISCLAIMER
  };
}

function buildCompletionResult(input: {
  job: XmlValidationQueueJob;
  workerName: string;
  workerVersion: string;
  completedAt: string;
  workerResult: XmlWorkerResult;
}): CompleteXmlValidationQueueJobInput {
  const queue = buildCompletedQueueLifecycleForJob({
    job: input.job,
    completedAt: input.completedAt,
    workerName: input.workerName
  });

  return {
    organizationId: input.job.organizationId,
    jobId: input.job.id,
    completedAt: input.completedAt,
    completedChecks: input.workerResult.completedChecks,
    failedChecks: input.workerResult.failedChecks,
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    resultSummary: {
      ...input.workerResult.resultSummary,
      xmlSha256: input.job.xmlSha256,
      xmlSizeBytes: input.job.xmlSizeBytes,
      queue
    },
    findings: input.workerResult.findings,
    disclaimer: input.workerResult.disclaimer
  };
}

async function failClaimedJob(input: {
  repository: XmlValidationQueueRepository;
  job: XmlValidationQueueJob;
  failedAt: string;
  workerName: string;
  workerVersion: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}): Promise<XmlValidationQueueRunnerResult> {
  const failure = buildQueueFailureResult({
    job: input.job,
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    failedAt: input.failedAt,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    retryable: input.retryable
  });
  const failedJob = await input.repository.failJob(failure);
  const resultJob = failedJob ?? input.job;

  return {
    status: "failed",
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    message: input.errorMessage,
    jobId: input.job.id,
    organizationId: input.job.organizationId,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    job: resultJob
  };
}

async function deleteTransientPayloadForJob(input: {
  job: XmlValidationQueueJob;
  rootDir?: string;
}) {
  const reference = readTransientXmlPayloadReferenceFromSummary(
    input.job.resultSummary
  );

  if (!reference) {
    return false;
  }

  try {
    return await deleteTransientXmlPayload({
      payloadId: reference.payloadId,
      ...(input.rootDir ? { rootDir: input.rootDir } : {})
    });
  } catch {
    return false;
  }
}

async function loadTransientXmlFromStore(input: {
  job: XmlValidationQueueJob;
  store: NonNullable<RunXmlValidationQueueOnceInput["transientPayloadStore"]>;
}) {
  const reference = readTransientXmlPayloadReferenceFromSummary(
    input.job.resultSummary
  );

  if (!reference) {
    return {
      status: "failed" as const,
      errorCode: XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE,
      errorMessage: XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE,
      retryable: false
    };
  }

  return readTransientXmlPayload({
    reference,
    ...(input.store.rootDir ? { rootDir: input.store.rootDir } : {}),
    ...(input.store.maxBytes !== undefined
      ? { maxBytes: input.store.maxBytes }
      : {}),
    ...(input.store.now ? { now: input.store.now() } : {})
  });
}

function validateTransientXmlForJob(input: {
  xml: string;
  job: XmlValidationQueueJob;
  maxBytes?: number;
}):
  | {
      safe: true;
    }
  | {
      safe: false;
      errorCode: string;
      errorMessage: string;
    } {
  if (
    calculateXmlSha256(input.xml) !== input.job.xmlSha256 ||
    getUtf8ByteLength(input.xml) !== input.job.xmlSizeBytes
  ) {
    return {
      safe: false,
      errorCode: XML_VALIDATION_JOB_TRANSIENT_XML_MISMATCH_CODE,
      errorMessage: XML_VALIDATION_JOB_TRANSIENT_XML_MISMATCH_MESSAGE
    };
  }

  const safety = inspectXmlSafety(input.xml, {
    ...(input.maxBytes !== undefined ? { maxBytes: input.maxBytes } : {})
  });

  if (!safety.safe) {
    return {
      safe: false,
      errorCode:
        safety.code ?? XML_VALIDATION_JOB_TRANSIENT_XML_UNSAFE_CODE,
      errorMessage: XML_VALIDATION_JOB_TRANSIENT_XML_UNSAFE_MESSAGE
    };
  }

  return {
    safe: true
  };
}

export async function runXmlValidationQueueOnce(
  input: RunXmlValidationQueueOnceInput
): Promise<XmlValidationQueueRunnerResult> {
  const workerName = input.workerName ?? XML_VALIDATION_JOB_WORKER_NAME;
  const workerVersion = input.workerVersion ?? XML_VALIDATION_JOB_WORKER_VERSION;
  const now = input.now ?? (() => new Date());
  const job = await input.repository.claimQueuedJob({
    workerName,
    workerVersion
  });

  if (!job) {
    return {
      status: "idle",
      workerName,
      workerVersion,
      message: "No queued XML validation jobs are available."
    };
  }

  const failedAt = now().toISOString();
  const transientPayloadRootDir = input.transientPayloadStore?.rootDir;
  let transientXml: string | null = null;
  let shouldDeleteTransientPayload = false;

  if (input.loadTransientXml) {
    transientXml = await input.loadTransientXml(job);
  } else if (input.transientPayloadStore) {
    const payloadResult = await loadTransientXmlFromStore({
      job,
      store: input.transientPayloadStore
    });

    if (payloadResult.status === "failed") {
      const result = await failClaimedJob({
        repository: input.repository,
        job,
        failedAt,
        workerName,
        workerVersion,
        errorCode: payloadResult.errorCode,
        errorMessage: payloadResult.errorMessage,
        retryable: payloadResult.retryable
      });

      await deleteTransientPayloadForJob({
        job,
        ...(transientPayloadRootDir ? { rootDir: transientPayloadRootDir } : {})
      });

      return result;
    }

    transientXml = payloadResult.xml;
    shouldDeleteTransientPayload = true;
  } else {
    return failClaimedJob({
      repository: input.repository,
      job,
      failedAt,
      workerName,
      workerVersion,
      errorCode: XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE,
      errorMessage: XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE,
      retryable: false
    });
  }

  if (!transientXml) {
    const result = await failClaimedJob({
      repository: input.repository,
      job,
      failedAt,
      workerName,
      workerVersion,
      errorCode: XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE,
      errorMessage: XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE,
      retryable: false
    });

    if (shouldDeleteTransientPayload) {
      await deleteTransientPayloadForJob({
        job,
        ...(transientPayloadRootDir ? { rootDir: transientPayloadRootDir } : {})
      });
    }

    return result;
  }

  const transientXmlValidation = validateTransientXmlForJob({
    xml: transientXml,
    job,
    ...(input.transientPayloadStore?.maxBytes !== undefined
      ? { maxBytes: input.transientPayloadStore.maxBytes }
      : {})
  });

  if (!transientXmlValidation.safe) {
    const result = await failClaimedJob({
      repository: input.repository,
      job,
      failedAt,
      workerName,
      workerVersion,
      errorCode: transientXmlValidation.errorCode,
      errorMessage: transientXmlValidation.errorMessage,
      retryable: false
    });

    if (shouldDeleteTransientPayload) {
      await deleteTransientPayloadForJob({
        job,
        ...(transientPayloadRootDir ? { rootDir: transientPayloadRootDir } : {})
      });
    }

    return result;
  }

  try {
    const workerResult = await runStubXmlValidator({
      xml: transientXml,
      requestedChecks: normalizeRequestedChecks(job.requestedChecks)
    });
    const completedAt = now().toISOString();
    const completion = buildCompletionResult({
      job,
      workerName,
      workerVersion,
      completedAt,
      workerResult
    });
    const completedJob = await input.repository.completeJob(completion);

    return {
      status: "completed",
      workerName,
      workerVersion,
      message: "Queued XML validation job completed from transient XML input.",
      jobId: job.id,
      organizationId: job.organizationId,
      job: completedJob ?? job
    };
  } catch {
    return await failClaimedJob({
      repository: input.repository,
      job,
      failedAt,
      workerName,
      workerVersion,
      errorCode: XML_VALIDATION_JOB_WORKER_EXCEPTION_CODE,
      errorMessage: XML_VALIDATION_JOB_WORKER_EXCEPTION_MESSAGE,
      retryable: true
    });
  } finally {
    if (shouldDeleteTransientPayload) {
      await deleteTransientPayloadForJob({
        job,
        ...(transientPayloadRootDir ? { rootDir: transientPayloadRootDir } : {})
      });
    }
  }
}
