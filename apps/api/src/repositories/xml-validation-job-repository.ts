import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleClient,
  getSupabaseUserClient,
  hasSupabaseServerConfig
} from "../lib/supabase/server-client.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";
import type {
  XmlValidationJobCheck,
  XmlValidationJobFinding
} from "../services/xml-validation-job-service.js";

export type XmlValidationJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type XmlValidationJobRecord = {
  id: string;
  organizationId: string;
  xmlReadinessReportId: string | null;
  invoiceDraftId: string | null;
  validationRunId: string | null;
  sourceType: "uploaded_xml" | "pasted_xml" | "generated_ubl" | "api_payload";
  documentType: string | null;
  filename: string | null;
  xmlSha256: string;
  xmlSizeBytes: number;
  status: XmlValidationJobStatus;
  requestedChecks: XmlValidationJobCheck[];
  completedChecks: XmlValidationJobCheck[];
  failedChecks: XmlValidationJobCheck[];
  workerName: string | null;
  workerVersion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultSummary: Record<string, unknown>;
  findings: XmlValidationJobFinding[];
  disclaimer: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateXmlValidationJobInput = {
  organizationId: string;
  xmlReadinessReportId?: string | null;
  invoiceDraftId?: string | null;
  validationRunId?: string | null;
  sourceType: XmlValidationJobRecord["sourceType"];
  documentType?: string | null;
  filename?: string | null;
  xmlSha256: string;
  xmlSizeBytes: number;
  requestedChecks: XmlValidationJobCheck[];
  disclaimer: string;
  createdBy?: string | null;
};

export type CompleteXmlValidationJobInput = {
  organizationId: string;
  jobId: string;
  completedChecks: XmlValidationJobCheck[];
  failedChecks: XmlValidationJobCheck[];
  workerName: string;
  workerVersion: string;
  resultSummary: Record<string, unknown>;
  findings: XmlValidationJobFinding[];
  disclaimer: string;
};

export type FailXmlValidationJobInput = {
  organizationId: string;
  jobId: string;
  errorCode: string;
  errorMessage: string;
  failedChecks?: XmlValidationJobCheck[];
};

export type AuthenticatedXmlValidationJobContext = {
  userId: string;
  accessToken: string;
};

type SupabaseWorkspaceBootstrapRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

type SupabaseXmlValidationJobRow = {
  id: string;
  organization_id: string;
  xml_readiness_report_id: string | null;
  invoice_draft_id: string | null;
  validation_run_id: string | null;
  source_type: string;
  document_type: string | null;
  filename: string | null;
  xml_sha256: string;
  xml_size_bytes: number;
  status: string;
  requested_checks: unknown;
  completed_checks: unknown;
  failed_checks: unknown;
  worker_name: string | null;
  worker_version: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  result_summary: unknown;
  findings: unknown;
  disclaimer: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const XML_VALIDATION_JOBS_FILE = "xml-validation-jobs.json";
const MAX_STORED_XML_VALIDATION_JOBS = 250;
const XML_VALIDATION_JOB_SELECT_FIELDS =
  "id, organization_id, xml_readiness_report_id, invoice_draft_id, validation_run_id, source_type, document_type, filename, xml_sha256, xml_size_bytes, status, requested_checks, completed_checks, failed_checks, worker_name, worker_version, started_at, completed_at, failed_at, error_code, error_message, result_summary, findings, disclaimer, created_by, created_at, updated_at";

const storageProvider = getCollectionStorageProvider();

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

function normalizeWorkspaceBootstrapRecord(
  value: unknown
): SupabaseWorkspaceBootstrapRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const organizationId = readStringField(value, "organization_id");
  const organizationName = readStringField(value, "organization_name");
  const organizationSlug = readStringField(value, "organization_slug");
  const membershipRole = readStringField(value, "membership_role", "member");
  const userEmail = readStringField(value, "user_email");

  if (!organizationId || !organizationName || !organizationSlug) {
    return null;
  }

  return {
    organizationId,
    organizationName,
    organizationSlug,
    membershipRole,
    userEmail
  };
}

function normalizeStatus(value: string): XmlValidationJobStatus {
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

function normalizeSourceType(value: string): XmlValidationJobRecord["sourceType"] {
  if (
    value === "pasted_xml" ||
    value === "generated_ubl" ||
    value === "api_payload"
  ) {
    return value;
  }

  return "uploaded_xml";
}

function normalizeChecks(value: unknown): XmlValidationJobCheck[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (check): check is XmlValidationJobCheck =>
      check === "worker_readiness" ||
      check === "xsd_ubl_placeholder" ||
      check === "schematron_peppol_placeholder"
  );
}

function normalizeResultSummary(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function normalizeFindings(value: unknown): XmlValidationJobFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPlainObject) as XmlValidationJobFinding[];
}

function sortJobsByCreatedAt(records: XmlValidationJobRecord[]) {
  return [...records].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt)
  );
}

function normalizeSupabaseXmlValidationJobRow(
  row: SupabaseXmlValidationJobRow
): XmlValidationJobRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    xmlReadinessReportId: row.xml_readiness_report_id,
    invoiceDraftId: row.invoice_draft_id,
    validationRunId: row.validation_run_id,
    sourceType: normalizeSourceType(row.source_type),
    documentType: row.document_type,
    filename: row.filename,
    xmlSha256: row.xml_sha256,
    xmlSizeBytes: row.xml_size_bytes,
    status: normalizeStatus(row.status),
    requestedChecks: normalizeChecks(row.requested_checks),
    completedChecks: normalizeChecks(row.completed_checks),
    failedChecks: normalizeChecks(row.failed_checks),
    workerName: row.worker_name,
    workerVersion: row.worker_version,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    resultSummary: normalizeResultSummary(row.result_summary),
    findings: normalizeFindings(row.findings),
    disclaimer: row.disclaimer,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildSupabaseXmlValidationJobValues(input: CreateXmlValidationJobInput) {
  return {
    organization_id: input.organizationId,
    xml_readiness_report_id: input.xmlReadinessReportId ?? null,
    invoice_draft_id: input.invoiceDraftId ?? null,
    validation_run_id: input.validationRunId ?? null,
    source_type: input.sourceType,
    document_type: input.documentType ?? null,
    filename: input.filename ?? null,
    xml_sha256: input.xmlSha256,
    xml_size_bytes: input.xmlSizeBytes,
    status: "queued",
    requested_checks: input.requestedChecks,
    completed_checks: [],
    failed_checks: [],
    result_summary: {},
    findings: [],
    disclaimer: input.disclaimer,
    created_by: input.createdBy ?? null
  };
}

async function getWorkspaceForAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("bootstrap_personal_workspace");

  if (error) {
    throw new Error(`Workspace bootstrap failed: ${error.message}`);
  }

  const firstRecord = Array.isArray(data) ? data[0] : data;
  const workspace = normalizeWorkspaceBootstrapRecord(firstRecord);

  if (!workspace) {
    throw new Error("Workspace bootstrap returned an unreadable record.");
  }

  return workspace;
}

function createAuthenticatedSupabaseClient(
  context: AuthenticatedXmlValidationJobContext
) {
  return getSupabaseUserClient(context.accessToken);
}

function createServiceRoleSupabaseClient() {
  return getSupabaseServiceRoleClient();
}

async function createSupabaseXmlValidationJob(
  supabase: SupabaseClient,
  input: CreateXmlValidationJobInput
) {
  const { data, error } = await supabase
    .from("xml_validation_jobs")
    .insert(buildSupabaseXmlValidationJobValues(input))
    .select(XML_VALIDATION_JOB_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create XML validation job: ${error.message}`);
  }

  return normalizeSupabaseXmlValidationJobRow(
    data as SupabaseXmlValidationJobRow
  );
}

async function getSupabaseXmlValidationJob(input: {
  supabase: SupabaseClient;
  organizationId: string;
  jobId: string;
}) {
  const { data, error } = await input.supabase
    .from("xml_validation_jobs")
    .select(XML_VALIDATION_JOB_SELECT_FIELDS)
    .eq("organization_id", input.organizationId)
    .eq("id", input.jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read XML validation job: ${error.message}`);
  }

  return data
    ? normalizeSupabaseXmlValidationJobRow(data as SupabaseXmlValidationJobRow)
    : null;
}

async function listSupabaseXmlValidationJobs(input: {
  supabase: SupabaseClient;
  organizationId: string;
  limit?: number;
  status?: XmlValidationJobStatus;
}) {
  let query = input.supabase
    .from("xml_validation_jobs")
    .select(XML_VALIDATION_JOB_SELECT_FIELDS)
    .eq("organization_id", input.organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(Math.min(Math.max(input.limit ?? 25, 1), 100));

  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not list XML validation jobs: ${error.message}`);
  }

  return ((data ?? []) as SupabaseXmlValidationJobRow[]).map((row) =>
    normalizeSupabaseXmlValidationJobRow(row)
  );
}

async function updateSupabaseXmlValidationJob(input: {
  supabase: SupabaseClient;
  organizationId: string;
  jobId: string;
  values: Record<string, unknown>;
}) {
  const { data, error } = await input.supabase
    .from("xml_validation_jobs")
    .update(input.values)
    .eq("organization_id", input.organizationId)
    .eq("id", input.jobId)
    .select(XML_VALIDATION_JOB_SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not update XML validation job: ${error.message}`);
  }

  return data
    ? normalizeSupabaseXmlValidationJobRow(data as SupabaseXmlValidationJobRow)
    : null;
}

export function hasAuthenticatedXmlValidationJobContext(
  context: AuthenticatedXmlValidationJobContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

/* -------------------------------------------------------------------------- */
/* Local JSON-backed XML validation job storage                               */
/* -------------------------------------------------------------------------- */

export async function listXmlValidationJobs(input: {
  organizationId: string;
  limit?: number;
  status?: XmlValidationJobStatus;
}) {
  const records = await storageProvider.readCollection<XmlValidationJobRecord>(
    XML_VALIDATION_JOBS_FILE
  );
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);

  return sortJobsByCreatedAt(records)
    .filter((record) => record.organizationId === input.organizationId)
    .filter((record) => !input.status || record.status === input.status)
    .slice(0, limit);
}

export async function getXmlValidationJob(input: {
  organizationId: string;
  jobId: string;
}) {
  const jobs = await listXmlValidationJobs({
    organizationId: input.organizationId,
    limit: MAX_STORED_XML_VALIDATION_JOBS
  });

  return jobs.find((job) => job.id === input.jobId) ?? null;
}

export async function createXmlValidationJob(
  input: CreateXmlValidationJobInput
): Promise<XmlValidationJobRecord> {
  const now = new Date().toISOString();
  const record: XmlValidationJobRecord = {
    id: `xmljob_${randomUUID()}`,
    organizationId: input.organizationId,
    xmlReadinessReportId: input.xmlReadinessReportId ?? null,
    invoiceDraftId: input.invoiceDraftId ?? null,
    validationRunId: input.validationRunId ?? null,
    sourceType: input.sourceType,
    documentType: input.documentType ?? null,
    filename: input.filename ?? null,
    xmlSha256: input.xmlSha256,
    xmlSizeBytes: input.xmlSizeBytes,
    status: "queued",
    requestedChecks: input.requestedChecks,
    completedChecks: [],
    failedChecks: [],
    workerName: null,
    workerVersion: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
    resultSummary: {},
    findings: [],
    disclaimer: input.disclaimer,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now
  };

  const currentRecords =
    await storageProvider.readCollection<XmlValidationJobRecord>(
      XML_VALIDATION_JOBS_FILE
    );
  const nextRecords = sortJobsByCreatedAt([record, ...currentRecords]).slice(
    0,
    MAX_STORED_XML_VALIDATION_JOBS
  );

  await storageProvider.writeCollection(XML_VALIDATION_JOBS_FILE, nextRecords);

  return record;
}

async function updateLocalXmlValidationJob(input: {
  organizationId: string;
  jobId: string;
  update: (record: XmlValidationJobRecord) => XmlValidationJobRecord;
}) {
  const currentRecords =
    await storageProvider.readCollection<XmlValidationJobRecord>(
      XML_VALIDATION_JOBS_FILE
    );
  let updatedRecord: XmlValidationJobRecord | null = null;

  const nextRecords = currentRecords.map((record) => {
    if (
      record.organizationId !== input.organizationId ||
      record.id !== input.jobId
    ) {
      return record;
    }

    updatedRecord = input.update(record);
    return updatedRecord;
  });

  if (!updatedRecord) {
    return null;
  }

  await storageProvider.writeCollection(XML_VALIDATION_JOBS_FILE, nextRecords);

  return updatedRecord;
}

export async function markJobRunning(input: {
  organizationId: string;
  jobId: string;
  workerName?: string;
  workerVersion?: string;
}) {
  const now = new Date().toISOString();

  return updateLocalXmlValidationJob({
    organizationId: input.organizationId,
    jobId: input.jobId,
    update: (record) => ({
      ...record,
      status: "running",
      workerName: input.workerName ?? record.workerName,
      workerVersion: input.workerVersion ?? record.workerVersion,
      startedAt: record.startedAt ?? now,
      updatedAt: now
    })
  });
}

export async function completeJob(input: CompleteXmlValidationJobInput) {
  const now = new Date().toISOString();

  return updateLocalXmlValidationJob({
    organizationId: input.organizationId,
    jobId: input.jobId,
    update: (record) => ({
      ...record,
      status: "completed",
      completedChecks: input.completedChecks,
      failedChecks: input.failedChecks,
      workerName: input.workerName,
      workerVersion: input.workerVersion,
      startedAt: record.startedAt ?? now,
      completedAt: now,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      resultSummary: input.resultSummary,
      findings: input.findings,
      disclaimer: input.disclaimer,
      updatedAt: now
    })
  });
}

export async function failJob(input: FailXmlValidationJobInput) {
  const now = new Date().toISOString();

  return updateLocalXmlValidationJob({
    organizationId: input.organizationId,
    jobId: input.jobId,
    update: (record) => ({
      ...record,
      status: "failed",
      failedChecks: input.failedChecks ?? record.requestedChecks,
      startedAt: record.startedAt ?? now,
      failedAt: now,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      updatedAt: now
    })
  });
}

/* -------------------------------------------------------------------------- */
/* Supabase user-scoped XML validation job storage                            */
/* -------------------------------------------------------------------------- */

export async function createAuthenticatedXmlValidationJob(
  context: AuthenticatedXmlValidationJobContext,
  input: Omit<CreateXmlValidationJobInput, "organizationId" | "createdBy">
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  return createSupabaseXmlValidationJob(supabase, {
    ...input,
    organizationId: workspace.organizationId,
    createdBy: context.userId
  });
}

export async function listAuthenticatedXmlValidationJobs(
  context: AuthenticatedXmlValidationJobContext,
  input: {
    limit?: number;
    status?: XmlValidationJobStatus;
  } = {}
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  return listSupabaseXmlValidationJobs({
    supabase,
    organizationId: workspace.organizationId,
    ...input
  });
}

export async function getAuthenticatedXmlValidationJob(
  context: AuthenticatedXmlValidationJobContext,
  jobId: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  return getSupabaseXmlValidationJob({
    supabase,
    organizationId: workspace.organizationId,
    jobId
  });
}

export async function markAuthenticatedJobRunning(
  context: AuthenticatedXmlValidationJobContext,
  input: Omit<Parameters<typeof markJobRunning>[0], "organizationId">
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const now = new Date().toISOString();

  return updateSupabaseXmlValidationJob({
    supabase,
    organizationId: workspace.organizationId,
    jobId: input.jobId,
    values: {
      status: "running",
      worker_name: input.workerName ?? null,
      worker_version: input.workerVersion ?? null,
      started_at: now
    }
  });
}

export async function completeAuthenticatedJob(
  context: AuthenticatedXmlValidationJobContext,
  input: Omit<CompleteXmlValidationJobInput, "organizationId">
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const now = new Date().toISOString();

  return updateSupabaseXmlValidationJob({
    supabase,
    organizationId: workspace.organizationId,
    jobId: input.jobId,
    values: {
      status: "completed",
      completed_checks: input.completedChecks,
      failed_checks: input.failedChecks,
      worker_name: input.workerName,
      worker_version: input.workerVersion,
      started_at: now,
      completed_at: now,
      failed_at: null,
      error_code: null,
      error_message: null,
      result_summary: input.resultSummary,
      findings: input.findings,
      disclaimer: input.disclaimer
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Organization API-key XML validation job storage                            */
/* -------------------------------------------------------------------------- */

export async function createOrganizationXmlValidationJob(
  input: CreateXmlValidationJobInput
) {
  if (!hasSupabaseServerConfig()) {
    return createXmlValidationJob(input);
  }

  return createSupabaseXmlValidationJob(createServiceRoleSupabaseClient(), input);
}

export async function listOrganizationXmlValidationJobs(input: {
  organizationId: string;
  limit?: number;
  status?: XmlValidationJobStatus;
}) {
  if (!hasSupabaseServerConfig()) {
    return listXmlValidationJobs(input);
  }

  return listSupabaseXmlValidationJobs({
    supabase: createServiceRoleSupabaseClient(),
    ...input
  });
}

export async function getOrganizationXmlValidationJob(input: {
  organizationId: string;
  jobId: string;
}) {
  if (!hasSupabaseServerConfig()) {
    return getXmlValidationJob(input);
  }

  return getSupabaseXmlValidationJob({
    supabase: createServiceRoleSupabaseClient(),
    ...input
  });
}

export async function markOrganizationJobRunning(
  input: Parameters<typeof markJobRunning>[0]
) {
  if (!hasSupabaseServerConfig()) {
    return markJobRunning(input);
  }

  const now = new Date().toISOString();

  return updateSupabaseXmlValidationJob({
    supabase: createServiceRoleSupabaseClient(),
    organizationId: input.organizationId,
    jobId: input.jobId,
    values: {
      status: "running",
      worker_name: input.workerName ?? null,
      worker_version: input.workerVersion ?? null,
      started_at: now
    }
  });
}

export async function completeOrganizationJob(
  input: CompleteXmlValidationJobInput
) {
  if (!hasSupabaseServerConfig()) {
    return completeJob(input);
  }

  const now = new Date().toISOString();

  return updateSupabaseXmlValidationJob({
    supabase: createServiceRoleSupabaseClient(),
    organizationId: input.organizationId,
    jobId: input.jobId,
    values: {
      status: "completed",
      completed_checks: input.completedChecks,
      failed_checks: input.failedChecks,
      worker_name: input.workerName,
      worker_version: input.workerVersion,
      started_at: now,
      completed_at: now,
      failed_at: null,
      error_code: null,
      error_message: null,
      result_summary: input.resultSummary,
      findings: input.findings,
      disclaimer: input.disclaimer
    }
  });
}

export async function failOrganizationJob(input: FailXmlValidationJobInput) {
  if (!hasSupabaseServerConfig()) {
    return failJob(input);
  }

  const now = new Date().toISOString();

  return updateSupabaseXmlValidationJob({
    supabase: createServiceRoleSupabaseClient(),
    organizationId: input.organizationId,
    jobId: input.jobId,
    values: {
      status: "failed",
      failed_checks: input.failedChecks ?? [],
      started_at: now,
      failed_at: now,
      error_code: input.errorCode,
      error_message: input.errorMessage
    }
  });
}
