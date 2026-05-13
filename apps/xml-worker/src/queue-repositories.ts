import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildRunningQueueLifecycleFromSummary,
  readQueueLifecycleRetryReadiness,
  readQueueLifecycleStaleRunningInfo,
  type ClaimQueuedXmlValidationJobInput,
  type CompleteXmlValidationQueueJobInput,
  type FailXmlValidationQueueJobInput,
  type FindStaleRunningXmlValidationJobInput,
  type RequeueXmlValidationQueueJobInput,
  type XmlValidationQueueJob,
  type XmlValidationQueueJobStatus,
  type XmlValidationQueueRepository
} from "./queue-runner.js";
import type { XmlWorkerCheck, XmlWorkerFinding } from "./worker-types.js";

const XML_VALIDATION_JOBS_FILE = "xml-validation-jobs.json";
const XML_VALIDATION_JOB_SELECT_FIELDS =
  "id, organization_id, xml_readiness_report_id, invoice_draft_id, validation_run_id, source_type, document_type, filename, xml_sha256, xml_size_bytes, status, requested_checks, completed_checks, failed_checks, worker_name, worker_version, started_at, completed_at, failed_at, error_code, error_message, result_summary, findings, disclaimer, created_by, created_at, updated_at";

type QueueStorageKind = "auto" | "local" | "supabase";

type LocalJsonCollection = {
  records?: unknown;
};

type SupabaseXmlValidationJobRow = {
  id: string;
  organization_id: string;
  document_type: string | null;
  xml_sha256: string;
  xml_size_bytes: number;
  status: string;
  requested_checks: unknown;
  completed_checks: unknown;
  failed_checks: unknown;
  worker_name: string | null;
  worker_version: string | null;
  started_at: string | null;
  result_summary: unknown;
  findings: unknown;
  disclaimer: string;
  created_at: string;
  updated_at: string;
};

export type CreateLocalXmlValidationQueueRepositoryInput = {
  dataDir: string;
  organizationId?: string;
};

export type CreateSupabaseXmlValidationQueueRepositoryInput = {
  supabaseUrl: string;
  serviceRoleKey: string;
  organizationId?: string;
};

export type CreateXmlValidationQueueRepositoryFromEnvInput = {
  env: Record<string, string | undefined>;
  dataDir: string;
  storage?: QueueStorageKind;
  organizationId?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function readNullableStringField(
  record: Record<string, unknown>,
  key: string
) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback = 0
) {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeStatus(value: unknown): XmlValidationQueueJobStatus {
  if (
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "queued";
}

function normalizeCheck(value: unknown): XmlWorkerCheck | null {
  if (
    value === "worker_readiness" ||
    value === "xsd_ubl" ||
    value === "schematron_peppol" ||
    value === "schematron_en16931" ||
    value === "schematron_peppol_placeholder"
  ) {
    return value;
  }

  if (value === "xsd_ubl_placeholder") {
    return "xsd_ubl";
  }

  return null;
}

function normalizeChecks(value: unknown): XmlWorkerCheck[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedChecks: XmlWorkerCheck[] = [];

  for (const item of value) {
    const check = normalizeCheck(item);

    if (check && !normalizedChecks.includes(check)) {
      normalizedChecks.push(check);
    }
  }

  return normalizedChecks;
}

function normalizeResultSummary(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function normalizeFinding(value: unknown): XmlWorkerFinding | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const checkType = normalizeCheck(value.checkType);

  if (!checkType) {
    return null;
  }

  return {
    ...value,
    checkType
  } as XmlWorkerFinding;
}

function normalizeFindings(value: unknown): XmlWorkerFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((finding) => normalizeFinding(finding))
    .filter((finding): finding is XmlWorkerFinding => finding !== null);
}

function normalizeLocalXmlValidationJobRecord(
  value: unknown
): XmlValidationQueueJob | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const organizationId = readStringField(value, "organizationId");
  const xmlSha256 = readStringField(value, "xmlSha256");
  const disclaimer = readStringField(value, "disclaimer");
  const createdAt = readStringField(value, "createdAt");
  const updatedAt = readStringField(value, "updatedAt", createdAt);

  if (!id || !organizationId || !xmlSha256 || !disclaimer || !createdAt) {
    return null;
  }

  return {
    id,
    organizationId,
    documentType: readNullableStringField(value, "documentType"),
    xmlSha256,
    xmlSizeBytes: readNumberField(value, "xmlSizeBytes"),
    status: normalizeStatus(value.status),
    requestedChecks: normalizeChecks(value.requestedChecks),
    completedChecks: normalizeChecks(value.completedChecks),
    failedChecks: normalizeChecks(value.failedChecks),
    workerName: readNullableStringField(value, "workerName"),
    workerVersion: readNullableStringField(value, "workerVersion"),
    startedAt: readNullableStringField(value, "startedAt"),
    resultSummary: normalizeResultSummary(value.resultSummary),
    findings: normalizeFindings(value.findings),
    disclaimer,
    createdAt,
    updatedAt
  };
}

function normalizeSupabaseXmlValidationJobRow(
  row: SupabaseXmlValidationJobRow
): XmlValidationQueueJob {
  return {
    id: row.id,
    organizationId: row.organization_id,
    documentType: row.document_type,
    xmlSha256: row.xml_sha256,
    xmlSizeBytes: row.xml_size_bytes,
    status: normalizeStatus(row.status),
    requestedChecks: normalizeChecks(row.requested_checks),
    completedChecks: normalizeChecks(row.completed_checks),
    failedChecks: normalizeChecks(row.failed_checks),
    workerName: row.worker_name,
    workerVersion: row.worker_version,
    startedAt: row.started_at,
    resultSummary: normalizeResultSummary(row.result_summary),
    findings: normalizeFindings(row.findings),
    disclaimer: row.disclaimer,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sortByOldestCreatedAt(records: XmlValidationQueueJob[]) {
  return [...records].sort((first, second) =>
    first.createdAt.localeCompare(second.createdAt)
  );
}

function getCollectionPath(dataDir: string) {
  return path.join(dataDir, XML_VALIDATION_JOBS_FILE);
}

function removeRawXmlFields(
  record: Record<string, unknown>
): Record<string, unknown> {
  const {
    xml,
    rawXml,
    xmlBody,
    raw_xml,
    xml_body,
    rawPayload,
    raw_payload,
    payload,
    ...safeRecord
  } = record;

  void xml;
  void rawXml;
  void xmlBody;
  void raw_xml;
  void xml_body;
  void rawPayload;
  void raw_payload;
  void payload;

  return safeRecord;
}

async function readLocalRecords(dataDir: string): Promise<Record<string, unknown>[]> {
  try {
    const rawContent = await readFile(getCollectionPath(dataDir), "utf8");
    const parsed = JSON.parse(rawContent) as LocalJsonCollection;

    return Array.isArray(parsed.records)
      ? parsed.records.filter(isPlainObject)
      : [];
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

async function writeLocalRecords(
  dataDir: string,
  records: Record<string, unknown>[]
) {
  await mkdir(dataDir, {
    recursive: true
  });

  const filePath = getCollectionPath(dataDir);
  const temporaryPath = `${filePath}.tmp`;
  const safeRecords = records.map((record) => removeRawXmlFields(record));

  await writeFile(
    temporaryPath,
    `${JSON.stringify({ records: safeRecords }, null, 2)}\n`,
    "utf8"
  );
  await rename(temporaryPath, filePath);
}

function shouldIncludeJob(input: {
  job: XmlValidationQueueJob;
  now: string;
  organizationId?: string;
}) {
  return (
    input.job.status === "queued" &&
    readQueueLifecycleRetryReadiness({
      summary: input.job.resultSummary,
      now: input.now
    }) &&
    (!input.organizationId || input.job.organizationId === input.organizationId)
  );
}

function findLocalQueuedJob(input: {
  records: Record<string, unknown>[];
  now: string;
  organizationId?: string;
}) {
  const jobs = input.records
    .map((record) => normalizeLocalXmlValidationJobRecord(record))
    .filter((record): record is XmlValidationQueueJob => record !== null)
    .filter((job) =>
      shouldIncludeJob({
        job,
        now: input.now,
        ...(input.organizationId ? { organizationId: input.organizationId } : {})
      })
    );

  return sortByOldestCreatedAt(jobs)[0] ?? null;
}

function findLocalStaleRunningJob(input: {
  records: Record<string, unknown>[];
  now: string;
  organizationId?: string;
}) {
  const jobs = input.records
    .map((record) => normalizeLocalXmlValidationJobRecord(record))
    .filter((record): record is XmlValidationQueueJob => record !== null)
    .filter(
      (job) =>
        job.status === "running" &&
        (!input.organizationId || job.organizationId === input.organizationId) &&
        readQueueLifecycleStaleRunningInfo({
          summary: job.resultSummary,
          now: input.now
        }).stale
    );

  return sortByOldestCreatedAt(jobs)[0] ?? null;
}

function withRunningLocalFields(input: {
  record: Record<string, unknown>;
  now: string;
  workerName: string;
  workerVersion: string;
}) {
  const existingSummary = normalizeResultSummary(input.record.resultSummary);
  const startedAt = readNullableStringField(input.record, "startedAt") ?? input.now;

  return {
    ...removeRawXmlFields(input.record),
    status: "running",
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    startedAt,
    resultSummary: {
      ...existingSummary,
      queue: buildRunningQueueLifecycleFromSummary({
        existingSummary,
        now: input.now,
        claimedBy: input.workerName
      })
    },
    updatedAt: input.now
  };
}

function withCompletedLocalFields(
  record: Record<string, unknown>,
  input: CompleteXmlValidationQueueJobInput
) {
  return {
    ...removeRawXmlFields(record),
    status: "completed",
    completedChecks: input.completedChecks,
    failedChecks: input.failedChecks,
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    startedAt: readNullableStringField(record, "startedAt") ?? input.completedAt,
    completedAt: input.completedAt,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
    resultSummary: input.resultSummary,
    findings: input.findings,
    disclaimer: input.disclaimer,
    updatedAt: input.completedAt
  };
}

function withFailedLocalFields(
  record: Record<string, unknown>,
  input: FailXmlValidationQueueJobInput
) {
  return {
    ...removeRawXmlFields(record),
    status: "failed",
    completedChecks: [],
    failedChecks: input.failedChecks,
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    startedAt: readNullableStringField(record, "startedAt") ?? input.failedAt,
    completedAt: null,
    failedAt: input.failedAt,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    resultSummary: input.resultSummary,
    findings: input.findings,
    disclaimer: input.disclaimer,
    updatedAt: input.failedAt
  };
}

function withRequeuedLocalFields(
  record: Record<string, unknown>,
  input: RequeueXmlValidationQueueJobInput
) {
  return {
    ...removeRawXmlFields(record),
    status: "queued",
    completedChecks: [],
    failedChecks: [],
    workerName: input.workerName,
    workerVersion: input.workerVersion,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    resultSummary: input.resultSummary,
    updatedAt: input.requeuedAt
  };
}

async function updateLocalJob(input: {
  dataDir: string;
  organizationId: string;
  jobId: string;
  update: (record: Record<string, unknown>) => Record<string, unknown>;
}) {
  const records = await readLocalRecords(input.dataDir);
  let updatedRecord: Record<string, unknown> | null = null;

  const nextRecords = records.map((record) => {
    const job = normalizeLocalXmlValidationJobRecord(record);

    if (
      !job ||
      job.organizationId !== input.organizationId ||
      job.id !== input.jobId
    ) {
      return removeRawXmlFields(record);
    }

    updatedRecord = input.update(record);
    return updatedRecord;
  });

  if (!updatedRecord) {
    return null;
  }

  await writeLocalRecords(input.dataDir, nextRecords);

  return normalizeLocalXmlValidationJobRecord(updatedRecord);
}

export function createLocalXmlValidationQueueRepository(
  input: CreateLocalXmlValidationQueueRepositoryInput
): XmlValidationQueueRepository {
  return {
    async claimQueuedJob(claimInput: ClaimQueuedXmlValidationJobInput) {
      const records = await readLocalRecords(input.dataDir);
      const now = claimInput.now ?? new Date().toISOString();
      const queuedJob = findLocalQueuedJob({
        records,
        now,
        ...(input.organizationId ? { organizationId: input.organizationId } : {})
      });

      if (!queuedJob) {
        return null;
      }

      let claimedRecord: Record<string, unknown> | null = null;
      const nextRecords = records.map((record) => {
        const job = normalizeLocalXmlValidationJobRecord(record);

        if (!job || job.id !== queuedJob.id || job.status !== "queued") {
          return removeRawXmlFields(record);
        }

        claimedRecord = withRunningLocalFields({
          record,
          now,
          workerName: claimInput.workerName,
          workerVersion: claimInput.workerVersion
        });

        return claimedRecord;
      });

      if (!claimedRecord) {
        return null;
      }

      await writeLocalRecords(input.dataDir, nextRecords);

      return normalizeLocalXmlValidationJobRecord(claimedRecord);
    },

    async findStaleRunningJob(
      staleInput: FindStaleRunningXmlValidationJobInput
    ) {
      const records = await readLocalRecords(input.dataDir);

      return findLocalStaleRunningJob({
        records,
        now: staleInput.now,
        ...(input.organizationId ? { organizationId: input.organizationId } : {})
      });
    },

    async requeueJob(requeueInput: RequeueXmlValidationQueueJobInput) {
      return updateLocalJob({
        dataDir: input.dataDir,
        organizationId: requeueInput.organizationId,
        jobId: requeueInput.jobId,
        update: (record) => withRequeuedLocalFields(record, requeueInput)
      });
    },

    async completeJob(completeInput: CompleteXmlValidationQueueJobInput) {
      return updateLocalJob({
        dataDir: input.dataDir,
        organizationId: completeInput.organizationId,
        jobId: completeInput.jobId,
        update: (record) => withCompletedLocalFields(record, completeInput)
      });
    },

    async failJob(failInput: FailXmlValidationQueueJobInput) {
      return updateLocalJob({
        dataDir: input.dataDir,
        organizationId: failInput.organizationId,
        jobId: failInput.jobId,
        update: (record) => withFailedLocalFields(record, failInput)
      });
    }
  };
}

function getSupabaseHeaders(input: {
  serviceRoleKey: string;
  preferRepresentation?: boolean;
}) {
  return {
    apikey: input.serviceRoleKey,
    authorization: `Bearer ${input.serviceRoleKey}`,
    "content-type": "application/json",
    ...(input.preferRepresentation ? { prefer: "return=representation" } : {})
  };
}

function buildSupabaseUrl(input: {
  supabaseUrl: string;
  organizationId?: string;
  jobId?: string;
  status?: XmlValidationQueueJobStatus;
}) {
  const url = new URL("/rest/v1/xml_validation_jobs", input.supabaseUrl);

  url.searchParams.set("select", XML_VALIDATION_JOB_SELECT_FIELDS);

  if (input.organizationId) {
    url.searchParams.set("organization_id", `eq.${input.organizationId}`);
  }

  if (input.jobId) {
    url.searchParams.set("id", `eq.${input.jobId}`);
  }

  if (input.status) {
    url.searchParams.set("status", `eq.${input.status}`);
  }

  return url;
}

async function readSupabaseRows(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  organizationId?: string;
  status?: XmlValidationQueueJobStatus;
  limit?: number;
}) {
  const url = buildSupabaseUrl({
    supabaseUrl: input.supabaseUrl,
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    ...(input.status ? { status: input.status } : {})
  });

  url.searchParams.set("order", "created_at.asc");
  url.searchParams.set("limit", String(input.limit ?? 100));

  const response = await fetch(url, {
    method: "GET",
    headers: getSupabaseHeaders({
      serviceRoleKey: input.serviceRoleKey
    })
  });

  if (!response.ok) {
    throw new Error(
      `Could not read queued XML validation jobs: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as SupabaseXmlValidationJobRow[];
}

async function patchSupabaseRows(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  organizationId: string;
  jobId: string;
  status?: XmlValidationQueueJobStatus;
  values: Record<string, unknown>;
}) {
  const url = buildSupabaseUrl({
    supabaseUrl: input.supabaseUrl,
    organizationId: input.organizationId,
    jobId: input.jobId,
    ...(input.status ? { status: input.status } : {})
  });
  const response = await fetch(url, {
    method: "PATCH",
    headers: getSupabaseHeaders({
      serviceRoleKey: input.serviceRoleKey,
      preferRepresentation: true
    }),
    body: JSON.stringify(input.values)
  });

  if (!response.ok) {
    throw new Error(
      `Could not update XML validation job: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as SupabaseXmlValidationJobRow[];
}

function getFirstSupabaseJob(rows: SupabaseXmlValidationJobRow[]) {
  const row = rows[0];

  return row ? normalizeSupabaseXmlValidationJobRow(row) : null;
}

function getFirstSupabaseQueuedJob(input: {
  rows: SupabaseXmlValidationJobRow[];
  now: string;
}) {
  const jobs = input.rows
    .map((row) => normalizeSupabaseXmlValidationJobRow(row))
    .filter((job) =>
      readQueueLifecycleRetryReadiness({
        summary: job.resultSummary,
        now: input.now
      })
    );

  return jobs[0] ?? null;
}

function getFirstSupabaseStaleRunningJob(input: {
  rows: SupabaseXmlValidationJobRow[];
  now: string;
}) {
  const jobs = input.rows
    .map((row) => normalizeSupabaseXmlValidationJobRow(row))
    .filter(
      (job) =>
        readQueueLifecycleStaleRunningInfo({
          summary: job.resultSummary,
          now: input.now
        }).stale
    );

  return jobs[0] ?? null;
}

function buildRunningSupabaseValues(input: {
  job: XmlValidationQueueJob;
  now: string;
  workerName: string;
  workerVersion: string;
}) {
  return {
    status: "running",
    worker_name: input.workerName,
    worker_version: input.workerVersion,
    started_at: input.job.startedAt ?? input.now,
    result_summary: {
      ...input.job.resultSummary,
      queue: buildRunningQueueLifecycleFromSummary({
        existingSummary: input.job.resultSummary,
        now: input.now,
        claimedBy: input.workerName
      })
    }
  };
}

function buildRequeuedSupabaseValues(
  input: RequeueXmlValidationQueueJobInput
) {
  return {
    status: "queued",
    completed_checks: [],
    failed_checks: [],
    worker_name: input.workerName,
    worker_version: input.workerVersion,
    started_at: null,
    completed_at: null,
    failed_at: null,
    error_code: input.errorCode,
    error_message: input.errorMessage,
    result_summary: input.resultSummary
  };
}

export function createSupabaseXmlValidationQueueRepository(
  input: CreateSupabaseXmlValidationQueueRepositoryInput
): XmlValidationQueueRepository {
  return {
    async claimQueuedJob(claimInput: ClaimQueuedXmlValidationJobInput) {
      const now = claimInput.now ?? new Date().toISOString();
      const rows = await readSupabaseRows({
        supabaseUrl: input.supabaseUrl,
        serviceRoleKey: input.serviceRoleKey,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        status: "queued"
      });
      const queuedJob = getFirstSupabaseQueuedJob({
        rows,
        now
      });

      if (!queuedJob) {
        return null;
      }

      const updatedRows = await patchSupabaseRows({
        supabaseUrl: input.supabaseUrl,
        serviceRoleKey: input.serviceRoleKey,
        organizationId: queuedJob.organizationId,
        jobId: queuedJob.id,
        status: "queued",
        values: buildRunningSupabaseValues({
          job: queuedJob,
          now,
          workerName: claimInput.workerName,
          workerVersion: claimInput.workerVersion
        })
      });

      return getFirstSupabaseJob(updatedRows);
    },

    async findStaleRunningJob(
      staleInput: FindStaleRunningXmlValidationJobInput
    ) {
      const rows = await readSupabaseRows({
        supabaseUrl: input.supabaseUrl,
        serviceRoleKey: input.serviceRoleKey,
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        status: "running"
      });

      return getFirstSupabaseStaleRunningJob({
        rows,
        now: staleInput.now
      });
    },

    async requeueJob(requeueInput: RequeueXmlValidationQueueJobInput) {
      const rows = await patchSupabaseRows({
        supabaseUrl: input.supabaseUrl,
        serviceRoleKey: input.serviceRoleKey,
        organizationId: requeueInput.organizationId,
        jobId: requeueInput.jobId,
        status: "running",
        values: buildRequeuedSupabaseValues(requeueInput)
      });

      return getFirstSupabaseJob(rows);
    },

    async completeJob(completeInput: CompleteXmlValidationQueueJobInput) {
      const rows = await patchSupabaseRows({
        supabaseUrl: input.supabaseUrl,
        serviceRoleKey: input.serviceRoleKey,
        organizationId: completeInput.organizationId,
        jobId: completeInput.jobId,
        values: {
          status: "completed",
          completed_checks: completeInput.completedChecks,
          failed_checks: completeInput.failedChecks,
          worker_name: completeInput.workerName,
          worker_version: completeInput.workerVersion,
          completed_at: completeInput.completedAt,
          failed_at: null,
          error_code: null,
          error_message: null,
          result_summary: completeInput.resultSummary,
          findings: completeInput.findings,
          disclaimer: completeInput.disclaimer
        }
      });

      return getFirstSupabaseJob(rows);
    },

    async failJob(failInput: FailXmlValidationQueueJobInput) {
      const rows = await patchSupabaseRows({
        supabaseUrl: input.supabaseUrl,
        serviceRoleKey: input.serviceRoleKey,
        organizationId: failInput.organizationId,
        jobId: failInput.jobId,
        values: {
          status: "failed",
          completed_checks: [],
          failed_checks: failInput.failedChecks,
          worker_name: failInput.workerName,
          worker_version: failInput.workerVersion,
          completed_at: null,
          failed_at: failInput.failedAt,
          error_code: failInput.errorCode,
          error_message: failInput.errorMessage,
          result_summary: failInput.resultSummary,
          findings: failInput.findings,
          disclaimer: failInput.disclaimer
        }
      });

      return getFirstSupabaseJob(rows);
    }
  };
}

function hasSupabaseQueueConfig(env: Record<string, string | undefined>) {
  return Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function createXmlValidationQueueRepositoryFromEnv(
  input: CreateXmlValidationQueueRepositoryFromEnvInput
): {
  storage: "local" | "supabase";
  repository: XmlValidationQueueRepository;
} {
  const storage = input.storage ?? "auto";
  const shouldUseSupabase =
    storage === "supabase" ||
    (storage === "auto" && hasSupabaseQueueConfig(input.env));

  if (shouldUseSupabase) {
    const supabaseUrl = input.env.SUPABASE_URL?.trim() ?? "";
    const serviceRoleKey = input.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for XML worker queue storage."
      );
    }

    return {
      storage: "supabase",
      repository: createSupabaseXmlValidationQueueRepository({
        supabaseUrl,
        serviceRoleKey,
        ...(input.organizationId ? { organizationId: input.organizationId } : {})
      })
    };
  }

  return {
    storage: "local",
    repository: createLocalXmlValidationQueueRepository({
      dataDir: input.dataDir,
      ...(input.organizationId ? { organizationId: input.organizationId } : {})
    })
  };
}
