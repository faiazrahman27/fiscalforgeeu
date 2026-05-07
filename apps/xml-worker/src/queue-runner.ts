import { createHash } from "node:crypto";
import { inspectXmlSafety } from "@invoice-lantern/ubl";
import { runStubXmlValidator } from "./stub-validator.js";
import {
  cleanupTransientXmlPayloads,
  deleteTransientXmlPayload,
  readTransientXmlPayload,
  readTransientXmlPayloadReferenceFromSummary,
  XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE,
  XML_TRANSIENT_PAYLOAD_SIZE_MISMATCH_CODE,
  XML_TRANSIENT_PAYLOAD_UNSAFE_CODE,
  type CleanupTransientXmlPayloadsSummary
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

const XML_VALIDATION_JOB_TRANSIENT_XML_UNSAFE_MESSAGE =
  "The transient XML input failed XML safety inspection. No XML validation was executed and no success result was inferred.";
export const XML_VALIDATION_WORKER_EXECUTION_FAILED_CODE =
  "XML_VALIDATION_WORKER_EXECUTION_FAILED";
export const XML_VALIDATION_WORKER_EXECUTION_FAILED_MESSAGE =
  "The XML validation worker encountered a processing error. No XML validation success result was inferred.";
export const XML_VALIDATION_WORKER_TIMEOUT_CODE =
  "XML_VALIDATION_WORKER_TIMEOUT";
export const XML_VALIDATION_WORKER_TIMEOUT_MESSAGE =
  "The XML validation worker timed out while processing this job. No XML validation success result was inferred.";
export const XML_VALIDATION_JOB_STALE_RUNNING_REQUEUED_CODE =
  "XML_VALIDATION_JOB_STALE_RUNNING_REQUEUED";
export const XML_VALIDATION_JOB_STALE_RUNNING_REQUEUED_MESSAGE =
  "A stale running XML validation job lease expired and the job was returned to the queue. No XML validation success result was inferred.";
export const XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_CODE =
  "XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED";
export const XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_MESSAGE =
  "The XML validation job exhausted its maximum worker attempts. No XML validation success result was inferred.";

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
  now?: string;
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

export type RequeueXmlValidationQueueJobInput = {
  organizationId: string;
  jobId: string;
  requeuedAt: string;
  errorCode: string;
  errorMessage: string;
  workerName: string;
  workerVersion: string;
  resultSummary: Record<string, unknown>;
};

export type FindStaleRunningXmlValidationJobInput = {
  workerName: string;
  workerVersion: string;
  now: string;
};

export type XmlValidationQueueRepository = {
  claimQueuedJob(
    input: ClaimQueuedXmlValidationJobInput
  ): Promise<XmlValidationQueueJob | null>;
  findStaleRunningJob(
    input: FindStaleRunningXmlValidationJobInput
  ): Promise<XmlValidationQueueJob | null>;
  requeueJob(
    input: RequeueXmlValidationQueueJobInput
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

export type XmlValidationWorkerEvent = {
  status:
    | "cleanup_performed"
    | "idle"
    | "job_claimed"
    | "job_completed"
    | "job_failed"
    | "job_requeued";
  workerName: string;
  workerVersion: string;
  jobId?: string;
  organizationId?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  attempt?: number;
  maxAttempts?: number;
  cleanup?: CleanupTransientXmlPayloadsSummary;
};

export type XmlValidationQueueRunnerResult = {
  status: "idle" | "completed" | "failed" | "requeued";
  workerName: string;
  workerVersion: string;
  message: string;
  jobId?: string;
  organizationId?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  attempt?: number;
  maxAttempts?: number;
  cleanup?: CleanupTransientXmlPayloadsSummary;
  events: XmlValidationWorkerEvent[];
};

export type RunXmlValidationQueueOnceInput = {
  repository: XmlValidationQueueRepository;
  loadTransientXml?: XmlValidationTransientXmlProvider;
  transientPayloadStore?: {
    rootDir?: string;
    maxBytes?: number;
    cleanupTtlSeconds?: number;
    now?: () => Date;
  };
  validator?: (request: {
    xml: string;
    requestedChecks: XmlWorkerCheck[];
  }) => Promise<XmlWorkerResult>;
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

function readQueueBoolean(
  queue: Record<string, unknown> | null,
  key: string
): boolean | undefined {
  if (!queue) {
    return undefined;
  }

  const value = queue[key];

  return typeof value === "boolean" ? value : undefined;
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

export function readQueueLifecycleAttemptInfo(summary: Record<string, unknown>) {
  const queue = readQueueLifecycle(summary);
  const attempt = readQueueNumber(queue, "attempt") ?? 1;
  const maxAttempts =
    readQueueNumber(queue, "maxAttempts") ??
    XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS;
  const retryable = readQueueBoolean(queue, "retryable") ?? attempt < maxAttempts;

  return {
    attempt,
    maxAttempts,
    retryable
  };
}

export function readQueueLifecycleRetryReadiness(input: {
  summary: Record<string, unknown>;
  now: string;
}) {
  const queue = readQueueLifecycle(input.summary);
  const nextAttemptAt = readQueueString(queue, "nextAttemptAt");

  if (!nextAttemptAt) {
    return true;
  }

  const nextAttemptDate = new Date(nextAttemptAt);
  const nowDate = new Date(input.now);

  return (
    Number.isNaN(nextAttemptDate.getTime()) ||
    Number.isNaN(nowDate.getTime()) ||
    nextAttemptDate.getTime() <= nowDate.getTime()
  );
}

export function readQueueLifecycleStaleRunningInfo(input: {
  summary: Record<string, unknown>;
  now: string;
}) {
  const queue = readQueueLifecycle(input.summary);
  const status = readQueueString(queue, "status");
  const leaseExpiresAt = readQueueString(queue, "leaseExpiresAt");
  const attemptInfo = readQueueLifecycleAttemptInfo(input.summary);

  if (status !== "running" || !leaseExpiresAt) {
    return {
      stale: false,
      ...attemptInfo
    };
  }

  const leaseExpiresAtDate = new Date(leaseExpiresAt);
  const nowDate = new Date(input.now);
  const stale =
    !Number.isNaN(leaseExpiresAtDate.getTime()) &&
    !Number.isNaN(nowDate.getTime()) &&
    leaseExpiresAtDate.getTime() <= nowDate.getTime();

  return {
    stale,
    ...attemptInfo
  };
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

function buildRequeuedXmlValidationJobLifecycle(input: {
  mode?: XmlValidationJobQueueMode;
  queuedAt?: Date | string;
  requeuedAt?: Date | string;
  failedAt?: Date | string;
  attempt?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
  timeoutSeconds?: number;
  claimedBy?: string;
  failureCode: string;
  failureMessage: string;
  nextAttemptDelaySeconds?: number;
}): XmlValidationQueueLifecycle {
  const requeuedAt = toIsoDateTime(input.requeuedAt);
  const failedAt = toIsoDateTime(input.failedAt ?? requeuedAt);
  const queuedAt = toIsoDateTime(input.queuedAt ?? requeuedAt);
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
  const retryable = attempt < maxAttempts;
  const nextAttemptDelaySeconds =
    input.nextAttemptDelaySeconds !== undefined
      ? Math.max(0, input.nextAttemptDelaySeconds)
      : 60;

  return {
    queueVersion: XML_VALIDATION_JOB_QUEUE_VERSION,
    mode: input.mode ?? "async_worker",
    status: "queued",
    attempt,
    maxAttempts,
    leaseSeconds,
    timeoutSeconds,
    retryable,
    queuedAt,
    nextAttemptAt: addSecondsToIsoDateTime(
      requeuedAt,
      nextAttemptDelaySeconds
    ),
    failedAt,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
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

function buildRequeuedQueueLifecycleForJob(input: {
  job: XmlValidationQueueJob;
  requeuedAt: string;
  workerName: string;
  errorCode: string;
  errorMessage: string;
  nextAttemptDelaySeconds: number;
}): XmlValidationQueueLifecycle {
  const existingQueue = readQueueLifecycle(input.job.resultSummary);
  const mode = readQueueMode(existingQueue);
  const queuedAt = readQueueString(existingQueue, "queuedAt");
  const currentAttempt = readQueueNumber(existingQueue, "attempt") ?? 1;
  const maxAttempts = readQueueNumber(existingQueue, "maxAttempts");
  const leaseSeconds = readQueueNumber(existingQueue, "leaseSeconds");
  const timeoutSeconds = readQueueNumber(existingQueue, "timeoutSeconds");
  const failedAt = readQueueString(existingQueue, "failedAt");
  const claimedBy =
    input.workerName.trim().length > 0
      ? input.workerName.trim()
      : readQueueString(existingQueue, "claimedBy");

  return buildRequeuedXmlValidationJobLifecycle({
    requeuedAt: input.requeuedAt,
    failureCode: input.errorCode,
    failureMessage: input.errorMessage,
    attempt: currentAttempt + 1,
    nextAttemptDelaySeconds: input.nextAttemptDelaySeconds,
    ...(mode ? { mode } : {}),
    ...(queuedAt ? { queuedAt } : {}),
    ...(failedAt ? { failedAt } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(leaseSeconds ? { leaseSeconds } : {}),
    ...(timeoutSeconds ? { timeoutSeconds } : {}),
    ...(claimedBy ? { claimedBy } : {})
  });
}

export function buildRequeuedQueueLifecycleFromSummary(input: {
  existingSummary: Record<string, unknown>;
  now: string;
  errorCode: string;
  errorMessage: string;
  claimedBy?: string | null;
  nextAttemptDelaySeconds?: number;
}): XmlValidationQueueLifecycle {
  const existingQueue = readQueueLifecycle(input.existingSummary);
  const mode = readQueueMode(existingQueue);
  const queuedAt = readQueueString(existingQueue, "queuedAt");
  const failedAt = readQueueString(existingQueue, "failedAt");
  const currentAttempt = readQueueNumber(existingQueue, "attempt") ?? 1;
  const maxAttempts = readQueueNumber(existingQueue, "maxAttempts");
  const leaseSeconds = readQueueNumber(existingQueue, "leaseSeconds");
  const timeoutSeconds = readQueueNumber(existingQueue, "timeoutSeconds");
  const claimedBy =
    input.claimedBy && input.claimedBy.trim().length > 0
      ? input.claimedBy.trim()
      : readQueueString(existingQueue, "claimedBy");

  return buildRequeuedXmlValidationJobLifecycle({
    requeuedAt: input.now,
    failureCode: input.errorCode,
    failureMessage: input.errorMessage,
    attempt: currentAttempt + 1,
    nextAttemptDelaySeconds: input.nextAttemptDelaySeconds ?? 0,
    ...(mode ? { mode } : {}),
    ...(queuedAt ? { queuedAt } : {}),
    ...(failedAt ? { failedAt } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(leaseSeconds ? { leaseSeconds } : {}),
    ...(timeoutSeconds ? { timeoutSeconds } : {}),
    ...(claimedBy ? { claimedBy } : {})
  });
}

function readQueueTimeoutSeconds(job: XmlValidationQueueJob) {
  const existingQueue = readQueueLifecycle(job.resultSummary);

  return (
    readQueueNumber(existingQueue, "timeoutSeconds") ??
    XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS
  );
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
      "Retry the XML validation job or review the local async worker configuration if this error persists.",
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
        validationExecutionEnabled: false,
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

function buildQueueRequeueResult(input: {
  job: XmlValidationQueueJob;
  workerName: string;
  workerVersion: string;
  requeuedAt: string;
  errorCode: string;
  errorMessage: string;
  nextAttemptDelaySeconds: number;
}): RequeueXmlValidationQueueJobInput {
  const queue = buildRequeuedQueueLifecycleForJob({
    job: input.job,
    requeuedAt: input.requeuedAt,
    workerName: input.workerName,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    nextAttemptDelaySeconds: input.nextAttemptDelaySeconds
  });

  return {
    organizationId: input.job.organizationId,
    jobId: input.job.id,
    requeuedAt: input.requeuedAt,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    resultSummary: {
      ...input.job.resultSummary,
      queue
    }
  };
}

function buildJobEvent(input: {
  status: XmlValidationWorkerEvent["status"];
  workerName: string;
  workerVersion: string;
  job?: XmlValidationQueueJob;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  attempt?: number;
  maxAttempts?: number;
  cleanup?: CleanupTransientXmlPayloadsSummary;
}): XmlValidationWorkerEvent {
  return {
    status: input.status,
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    ...(input.job
      ? {
          jobId: input.job.id,
          organizationId: input.job.organizationId
        }
      : {}),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
    ...(typeof input.retryable === "boolean"
      ? { retryable: input.retryable }
      : {}),
    ...(input.attempt !== undefined ? { attempt: input.attempt } : {}),
    ...(input.maxAttempts !== undefined
      ? { maxAttempts: input.maxAttempts }
      : {}),
    ...(input.cleanup ? { cleanup: input.cleanup } : {})
  };
}

async function finishClaimedJobFailure(input: {
  repository: XmlValidationQueueRepository;
  job: XmlValidationQueueJob;
  failedAt: string;
  workerName: string;
  workerVersion: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  nextAttemptDelaySeconds?: number;
  events: XmlValidationWorkerEvent[];
}): Promise<XmlValidationQueueRunnerResult> {
  const attemptInfo = readQueueLifecycleAttemptInfo(input.job.resultSummary);

  if (input.retryable && attemptInfo.attempt < attemptInfo.maxAttempts) {
    const requeue = buildQueueRequeueResult({
      job: input.job,
      workerName: input.workerName,
      workerVersion: input.workerVersion,
      requeuedAt: input.failedAt,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      nextAttemptDelaySeconds: input.nextAttemptDelaySeconds ?? 60
    });
    const requeuedJob = await input.repository.requeueJob(requeue);
    const requeuedQueue = readQueueLifecycle(requeue.resultSummary);
    const nextAttempt =
      readQueueNumber(requeuedQueue, "attempt") ?? attemptInfo.attempt + 1;
    const resultJob = requeuedJob ?? {
      ...input.job,
      status: "queued" as const,
      resultSummary: requeue.resultSummary
    };
    const requeueEvent = buildJobEvent({
      status: "job_requeued",
      workerName: input.workerName,
      workerVersion: input.workerVersion,
      job: resultJob,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      retryable: true,
      attempt: nextAttempt,
      maxAttempts: attemptInfo.maxAttempts
    });

    return {
      status: "requeued",
      workerName: input.workerName,
      workerVersion: input.workerVersion,
      message: input.errorMessage,
      jobId: input.job.id,
      organizationId: input.job.organizationId,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      retryable: true,
      attempt: nextAttempt,
      maxAttempts: attemptInfo.maxAttempts,
      events: [...input.events, requeueEvent]
    };
  }

  const exhaustedAttempts = input.retryable && attemptInfo.attempt >= attemptInfo.maxAttempts;
  const errorCode = exhaustedAttempts
    ? XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_CODE
    : input.errorCode;
  const errorMessage = exhaustedAttempts
    ? XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_MESSAGE
    : input.errorMessage;
  const failure = buildQueueFailureResult({
    job: input.job,
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    failedAt: input.failedAt,
    errorCode,
    errorMessage,
    retryable: false
  });
  const failedJob = (await input.repository.failJob(failure)) ?? input.job;
  const failedEvent = buildJobEvent({
    status: "job_failed",
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    job: failedJob,
    errorCode,
    errorMessage,
    retryable: false,
    attempt: attemptInfo.attempt,
    maxAttempts: attemptInfo.maxAttempts
  });

  return {
    status: "failed",
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    message: errorMessage,
    jobId: input.job.id,
    organizationId: input.job.organizationId,
    errorCode,
    errorMessage,
    retryable: false,
    attempt: attemptInfo.attempt,
    maxAttempts: attemptInfo.maxAttempts,
    events: [...input.events, failedEvent]
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
  if (getUtf8ByteLength(input.xml) !== input.job.xmlSizeBytes) {
    return {
      safe: false,
      errorCode: XML_TRANSIENT_PAYLOAD_SIZE_MISMATCH_CODE,
      errorMessage:
        "The transient XML input size did not match the queued job metadata. No XML validation was executed and no success result was inferred."
    };
  }

  if (calculateXmlSha256(input.xml) !== input.job.xmlSha256) {
    return {
      safe: false,
      errorCode: XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE,
      errorMessage:
        "The transient XML input hash did not match the queued job metadata. No XML validation was executed and no success result was inferred."
    };
  }

  const safety = inspectXmlSafety(input.xml, {
    ...(input.maxBytes !== undefined ? { maxBytes: input.maxBytes } : {})
  });

  if (!safety.safe) {
    return {
      safe: false,
      errorCode: safety.code ?? XML_TRANSIENT_PAYLOAD_UNSAFE_CODE,
      errorMessage: XML_VALIDATION_JOB_TRANSIENT_XML_UNSAFE_MESSAGE
    };
  }

  return {
    safe: true
  };
}

async function runValidatorWithTimeout(input: {
  validator: NonNullable<RunXmlValidationQueueOnceInput["validator"]>;
  xml: string;
  requestedChecks: XmlWorkerCheck[];
  timeoutSeconds: number;
}): Promise<
  | {
      status: "completed";
      workerResult: XmlWorkerResult;
    }
  | {
      status: "failed";
      errorCode: string;
      errorMessage: string;
      retryable: boolean;
    }
> {
  const timeoutMilliseconds = Math.max(1, input.timeoutSeconds) * 1000;
  let timeout: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      input
        .validator({
          xml: input.xml,
          requestedChecks: input.requestedChecks
        })
        .then((workerResult) => ({
          status: "completed" as const,
          workerResult
        }))
        .catch(() => ({
          status: "failed" as const,
          errorCode: XML_VALIDATION_WORKER_EXECUTION_FAILED_CODE,
          errorMessage: XML_VALIDATION_WORKER_EXECUTION_FAILED_MESSAGE,
          retryable: true
        })),
      new Promise<{
        status: "failed";
        errorCode: string;
        errorMessage: string;
        retryable: boolean;
      }>((resolve) => {
        timeout = setTimeout(() => {
          resolve({
            status: "failed",
            errorCode: XML_VALIDATION_WORKER_TIMEOUT_CODE,
            errorMessage: XML_VALIDATION_WORKER_TIMEOUT_MESSAGE,
            retryable: true
          });
        }, timeoutMilliseconds);
        timeout.unref();
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function runXmlValidationQueueOnce(
  input: RunXmlValidationQueueOnceInput
): Promise<XmlValidationQueueRunnerResult> {
  const workerName = input.workerName ?? XML_VALIDATION_JOB_WORKER_NAME;
  const workerVersion = input.workerVersion ?? XML_VALIDATION_JOB_WORKER_VERSION;
  const now = input.now ?? (() => new Date());
  const cleanup = input.transientPayloadStore
    ? await cleanupTransientXmlPayloads({
        ...(input.transientPayloadStore.rootDir
          ? { rootDir: input.transientPayloadStore.rootDir }
          : {}),
        now: now(),
        ...(input.transientPayloadStore.cleanupTtlSeconds !== undefined
          ? { ttlSeconds: input.transientPayloadStore.cleanupTtlSeconds }
          : {})
      })
    : undefined;
  const cleanupEvents: XmlValidationWorkerEvent[] = cleanup
    ? [
        buildJobEvent({
          status: "cleanup_performed",
          workerName,
          workerVersion,
          cleanup
        })
      ]
    : [];
  const staleNow = now().toISOString();
  const staleJob = await input.repository.findStaleRunningJob({
    workerName,
    workerVersion,
    now: staleNow
  });

  if (staleJob) {
    const staleInfo = readQueueLifecycleAttemptInfo(staleJob.resultSummary);
    const staleResult = await finishClaimedJobFailure({
      repository: input.repository,
      job: staleJob,
      failedAt: staleNow,
      workerName,
      workerVersion,
      errorCode: XML_VALIDATION_JOB_STALE_RUNNING_REQUEUED_CODE,
      errorMessage:
        staleInfo.attempt < staleInfo.maxAttempts
          ? XML_VALIDATION_JOB_STALE_RUNNING_REQUEUED_MESSAGE
          : XML_VALIDATION_JOB_MAX_ATTEMPTS_EXCEEDED_MESSAGE,
      retryable: true,
      nextAttemptDelaySeconds: 0,
      events: cleanupEvents
    });

    if (staleResult.status === "failed") {
      await deleteTransientPayloadForJob({
        job: staleJob,
        ...(input.transientPayloadStore?.rootDir
          ? { rootDir: input.transientPayloadStore.rootDir }
          : {})
      });
    }

    return {
      ...staleResult,
      ...(cleanup ? { cleanup } : {})
    };
  }

  const claimNow = now().toISOString();
  const job = await input.repository.claimQueuedJob({
    workerName,
    workerVersion,
    now: claimNow
  });

  if (!job) {
    const idleEvent = buildJobEvent({
      status: "idle",
      workerName,
      workerVersion
    });

    return {
      status: "idle",
      workerName,
      workerVersion,
      message: "No queued XML validation jobs are available.",
      ...(cleanup ? { cleanup } : {}),
      events: [...cleanupEvents, idleEvent]
    };
  }

  const attemptInfo = readQueueLifecycleAttemptInfo(job.resultSummary);
  const claimEvent = buildJobEvent({
    status: "job_claimed",
    workerName,
    workerVersion,
    job,
    retryable: attemptInfo.retryable,
    attempt: attemptInfo.attempt,
    maxAttempts: attemptInfo.maxAttempts
  });
  const events = [...cleanupEvents, claimEvent];
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
      const result = await finishClaimedJobFailure({
        repository: input.repository,
        job,
        failedAt,
        workerName,
        workerVersion,
        errorCode: payloadResult.errorCode,
        errorMessage: payloadResult.errorMessage,
        retryable: payloadResult.retryable,
        events
      });

      if (result.status !== "requeued") {
        await deleteTransientPayloadForJob({
          job,
          ...(transientPayloadRootDir ? { rootDir: transientPayloadRootDir } : {})
        });
      }

      return {
        ...result,
        ...(cleanup ? { cleanup } : {})
      };
    }

    transientXml = payloadResult.xml;
    shouldDeleteTransientPayload = true;
  } else {
    const result = await finishClaimedJobFailure({
      repository: input.repository,
      job,
      failedAt,
      workerName,
      workerVersion,
      errorCode: XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE,
      errorMessage: XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE,
      retryable: false,
      events
    });

    return {
      ...result,
      ...(cleanup ? { cleanup } : {})
    };
  }

  if (!transientXml) {
    const result = await finishClaimedJobFailure({
      repository: input.repository,
      job,
      failedAt,
      workerName,
      workerVersion,
      errorCode: XML_VALIDATION_JOB_XML_UNAVAILABLE_CODE,
      errorMessage: XML_VALIDATION_JOB_XML_UNAVAILABLE_MESSAGE,
      retryable: false,
      events
    });

    if (shouldDeleteTransientPayload && result.status !== "requeued") {
      await deleteTransientPayloadForJob({
        job,
        ...(transientPayloadRootDir ? { rootDir: transientPayloadRootDir } : {})
      });
    }

    return {
      ...result,
      ...(cleanup ? { cleanup } : {})
    };
  }

  const transientXmlValidation = validateTransientXmlForJob({
    xml: transientXml,
    job,
    ...(input.transientPayloadStore?.maxBytes !== undefined
      ? { maxBytes: input.transientPayloadStore.maxBytes }
      : {})
  });

  if (!transientXmlValidation.safe) {
    const result = await finishClaimedJobFailure({
      repository: input.repository,
      job,
      failedAt,
      workerName,
      workerVersion,
      errorCode: transientXmlValidation.errorCode,
      errorMessage: transientXmlValidation.errorMessage,
      retryable: false,
      events
    });

    if (shouldDeleteTransientPayload && result.status !== "requeued") {
      await deleteTransientPayloadForJob({
        job,
        ...(transientPayloadRootDir ? { rootDir: transientPayloadRootDir } : {})
      });
    }

    return {
      ...result,
      ...(cleanup ? { cleanup } : {})
    };
  }

  let shouldKeepTransientPayloadForRetry = false;

  try {
    const validation = await runValidatorWithTimeout({
      validator: input.validator ?? runStubXmlValidator,
      xml: transientXml,
      requestedChecks: normalizeRequestedChecks(job.requestedChecks),
      timeoutSeconds: readQueueTimeoutSeconds(job)
    });

    if (validation.status === "failed") {
      const result = await finishClaimedJobFailure({
        repository: input.repository,
        job,
        failedAt,
        workerName,
        workerVersion,
        errorCode: validation.errorCode,
        errorMessage: validation.errorMessage,
        retryable: validation.retryable,
        events
      });

      shouldKeepTransientPayloadForRetry = result.status === "requeued";

      return {
        ...result,
        ...(cleanup ? { cleanup } : {})
      };
    }

    const completedAt = now().toISOString();
    const completion = buildCompletionResult({
      job,
      workerName,
      workerVersion,
      completedAt,
      workerResult: validation.workerResult
    });
    const completedJob = await input.repository.completeJob(completion);
    const completedEvent = buildJobEvent({
      status: "job_completed",
      workerName,
      workerVersion,
      job: completedJob ?? job,
      retryable: false,
      attempt: attemptInfo.attempt,
      maxAttempts: attemptInfo.maxAttempts
    });

    return {
      status: "completed",
      workerName,
      workerVersion,
      message: "Queued XML validation job completed from transient XML input.",
      jobId: job.id,
      organizationId: job.organizationId,
      retryable: false,
      attempt: attemptInfo.attempt,
      maxAttempts: attemptInfo.maxAttempts,
      ...(cleanup ? { cleanup } : {}),
      events: [...events, completedEvent]
    };
  } catch {
    const result = await finishClaimedJobFailure({
      repository: input.repository,
      job,
      failedAt,
      workerName,
      workerVersion,
      errorCode: XML_VALIDATION_WORKER_EXECUTION_FAILED_CODE,
      errorMessage: XML_VALIDATION_WORKER_EXECUTION_FAILED_MESSAGE,
      retryable: true,
      events
    });

    shouldKeepTransientPayloadForRetry = result.status === "requeued";

    return {
      ...result,
      ...(cleanup ? { cleanup } : {})
    };
  } finally {
    if (shouldDeleteTransientPayload && !shouldKeepTransientPayloadForRetry) {
      await deleteTransientPayloadForJob({
        job,
        ...(transientPayloadRootDir ? { rootDir: transientPayloadRootDir } : {})
      });
    }
  }
}
