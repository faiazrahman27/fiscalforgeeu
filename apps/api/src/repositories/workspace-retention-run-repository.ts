import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspaceRetentionMode = "manual" | "scheduled";

export type WorkspaceRetentionRunStatus = "prepared" | "executed" | "failed";

export type WorkspaceRetentionRunBucket = {
  retentionDays: number;
  cutoffDate: string;
  affectedCount: number;
  executedCount: number;
};

export type WorkspaceRetentionRunRecord = {
  id: string;
  runType: "manual_retention_review";
  status: WorkspaceRetentionRunStatus;
  retentionMode: WorkspaceRetentionMode;
  invoiceDrafts: WorkspaceRetentionRunBucket;
  validationRuns: WorkspaceRetentionRunBucket;
  xmlReadinessReports: WorkspaceRetentionRunBucket;
  xmlValidationJobs: WorkspaceRetentionRunBucket;
  invoiceExports: WorkspaceRetentionRunBucket;
  apiRequests: WorkspaceRetentionRunBucket;
  webhookDeliveries: WorkspaceRetentionRunBucket;
  viesEvidenceChecks: WorkspaceRetentionRunBucket;
  vidaSimulationRuns: WorkspaceRetentionRunBucket;
  activityEvents: WorkspaceRetentionRunBucket;
  privacyRequests: WorkspaceRetentionRunBucket;
  retentionRuns: WorkspaceRetentionRunBucket;
  deletionRuns: WorkspaceRetentionRunBucket;
  legalAcceptances: WorkspaceRetentionRunBucket;
  totalAffectedCount: number;
  totalExecutedCount: number;
  warnings: string[];
  disclaimer: string;
  errorMessage: string;
  executedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthenticatedWorkspaceRetentionRunContext = {
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

type WorkspaceSettingsRecord = {
  retentionMode: WorkspaceRetentionMode;
  invoiceDraftRetentionDays: number;
  validationRunRetentionDays: number;
  xmlReportRetentionDays: number;
  xmlValidationJobRetentionDays: number;
  invoiceExportRetentionDays: number;
  apiRequestLogRetentionDays: number;
  webhookDeliveryLogRetentionDays: number;
  viesEvidenceRetentionDays: number;
  vidaSimulationRetentionDays: number;
  activityLogRetentionDays: number;
  privacyRequestRetentionDays: number;
  retentionRunRetentionDays: number;
  deletionRunRetentionDays: number;
  legalAcceptanceRetentionDays: number;
};

type RetentionDatasetConfig = {
  responseKey: keyof Pick<
    WorkspaceRetentionRunRecord,
    | "invoiceDrafts"
    | "validationRuns"
    | "xmlReadinessReports"
    | "xmlValidationJobs"
    | "invoiceExports"
    | "apiRequests"
    | "webhookDeliveries"
    | "viesEvidenceChecks"
    | "vidaSimulationRuns"
    | "activityEvents"
    | "privacyRequests"
    | "retentionRuns"
    | "deletionRuns"
    | "legalAcceptances"
  >;
  settingKey: keyof Omit<WorkspaceSettingsRecord, "retentionMode">;
  tableName: string;
  dateColumn: string;
  columnPrefix: string;
  preservedByDefault?: boolean;
};

type WorkspaceActivityEventInput = {
  organizationId: string;
  actorUserId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  severity?: "info" | "warning" | "error";
  source?: "api";
  metadata?: Record<string, unknown>;
};

const MAX_WORKSPACE_RETENTION_RUNS = 250;

const WORKSPACE_RETENTION_RUN_SELECT_FIELDS =
  "id, organization_id, initiated_by, run_type, status, retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, xml_validation_job_retention_days, invoice_export_retention_days, api_request_log_retention_days, webhook_delivery_log_retention_days, vies_evidence_retention_days, vida_simulation_retention_days, activity_log_retention_days, privacy_request_retention_days, retention_run_retention_days, deletion_run_retention_days, legal_acceptance_retention_days, invoice_draft_cutoff_date, validation_run_cutoff_date, xml_report_cutoff_date, xml_validation_job_cutoff_date, invoice_export_cutoff_date, api_request_log_cutoff_date, webhook_delivery_log_cutoff_date, vies_evidence_cutoff_date, vida_simulation_cutoff_date, activity_log_cutoff_date, privacy_request_cutoff_date, retention_run_cutoff_date, deletion_run_cutoff_date, legal_acceptance_cutoff_date, invoice_draft_affected_count, validation_run_affected_count, xml_report_affected_count, xml_validation_job_affected_count, invoice_export_affected_count, api_request_log_affected_count, webhook_delivery_log_affected_count, vies_evidence_affected_count, vida_simulation_affected_count, activity_event_affected_count, privacy_request_affected_count, retention_run_affected_count, deletion_run_affected_count, legal_acceptance_affected_count, invoice_draft_executed_count, validation_run_executed_count, xml_report_executed_count, xml_validation_job_executed_count, invoice_export_executed_count, api_request_log_executed_count, webhook_delivery_log_executed_count, vies_evidence_executed_count, vida_simulation_executed_count, activity_event_executed_count, privacy_request_executed_count, retention_run_executed_count, deletion_run_executed_count, legal_acceptance_executed_count, error_message, executed_at, created_at, updated_at";

const WORKSPACE_SETTINGS_SELECT_FIELDS =
  "retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, xml_validation_job_retention_days, invoice_export_retention_days, api_request_log_retention_days, webhook_delivery_log_retention_days, vies_evidence_retention_days, vida_simulation_retention_days, activity_log_retention_days, privacy_request_retention_days, retention_run_retention_days, deletion_run_retention_days, legal_acceptance_retention_days";

const defaultWorkspaceSettings: WorkspaceSettingsRecord = {
  retentionMode: "manual",
  invoiceDraftRetentionDays: 365,
  validationRunRetentionDays: 365,
  xmlReportRetentionDays: 180,
  xmlValidationJobRetentionDays: 180,
  invoiceExportRetentionDays: 365,
  apiRequestLogRetentionDays: 180,
  webhookDeliveryLogRetentionDays: 180,
  viesEvidenceRetentionDays: 365,
  vidaSimulationRetentionDays: 365,
  activityLogRetentionDays: 365,
  privacyRequestRetentionDays: 1095,
  retentionRunRetentionDays: 1095,
  deletionRunRetentionDays: 1095,
  legalAcceptanceRetentionDays: 2555
};

export const RETENTION_RUN_DATASETS: readonly RetentionDatasetConfig[] = [
  {
    responseKey: "invoiceDrafts",
    settingKey: "invoiceDraftRetentionDays",
    tableName: "invoice_drafts",
    dateColumn: "updated_at",
    columnPrefix: "invoice_draft"
  },
  {
    responseKey: "validationRuns",
    settingKey: "validationRunRetentionDays",
    tableName: "validation_runs",
    dateColumn: "created_at",
    columnPrefix: "validation_run"
  },
  {
    responseKey: "xmlReadinessReports",
    settingKey: "xmlReportRetentionDays",
    tableName: "xml_readiness_reports",
    dateColumn: "uploaded_at",
    columnPrefix: "xml_report"
  },
  {
    responseKey: "xmlValidationJobs",
    settingKey: "xmlValidationJobRetentionDays",
    tableName: "xml_validation_jobs",
    dateColumn: "created_at",
    columnPrefix: "xml_validation_job"
  },
  {
    responseKey: "invoiceExports",
    settingKey: "invoiceExportRetentionDays",
    tableName: "invoice_exports",
    dateColumn: "created_at",
    columnPrefix: "invoice_export"
  },
  {
    responseKey: "apiRequests",
    settingKey: "apiRequestLogRetentionDays",
    tableName: "api_requests",
    dateColumn: "created_at",
    columnPrefix: "api_request_log"
  },
  {
    responseKey: "webhookDeliveries",
    settingKey: "webhookDeliveryLogRetentionDays",
    tableName: "webhook_deliveries",
    dateColumn: "created_at",
    columnPrefix: "webhook_delivery_log"
  },
  {
    responseKey: "viesEvidenceChecks",
    settingKey: "viesEvidenceRetentionDays",
    tableName: "vies_evidence_checks",
    dateColumn: "created_at",
    columnPrefix: "vies_evidence"
  },
  {
    responseKey: "vidaSimulationRuns",
    settingKey: "vidaSimulationRetentionDays",
    tableName: "vida_simulation_runs",
    dateColumn: "created_at",
    columnPrefix: "vida_simulation"
  },
  {
    responseKey: "activityEvents",
    settingKey: "activityLogRetentionDays",
    tableName: "workspace_activity_events",
    dateColumn: "created_at",
    columnPrefix: "activity_event"
  },
  {
    responseKey: "privacyRequests",
    settingKey: "privacyRequestRetentionDays",
    tableName: "workspace_privacy_requests",
    dateColumn: "created_at",
    columnPrefix: "privacy_request",
    preservedByDefault: true
  },
  {
    responseKey: "retentionRuns",
    settingKey: "retentionRunRetentionDays",
    tableName: "workspace_retention_runs",
    dateColumn: "created_at",
    columnPrefix: "retention_run",
    preservedByDefault: true
  },
  {
    responseKey: "deletionRuns",
    settingKey: "deletionRunRetentionDays",
    tableName: "workspace_deletion_runs",
    dateColumn: "created_at",
    columnPrefix: "deletion_run",
    preservedByDefault: true
  },
  {
    responseKey: "legalAcceptances",
    settingKey: "legalAcceptanceRetentionDays",
    tableName: "legal_document_acceptances",
    dateColumn: "accepted_at",
    columnPrefix: "legal_acceptance",
    preservedByDefault: true
  }
];

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

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback: number
) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? Math.max(0, Math.round(parsedValue)) : fallback;
  }

  return fallback;
}

function normalizeRetentionMode(value: string): WorkspaceRetentionMode {
  return value === "scheduled" ? "scheduled" : "manual";
}

function normalizeRetentionRunStatus(value: string): WorkspaceRetentionRunStatus {
  if (value === "executed" || value === "failed") {
    return value;
  }

  return "prepared";
}

function clampRetentionDays(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(3650, Math.round(value)));
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

function normalizeWorkspaceSettingsRow(value: unknown): WorkspaceSettingsRecord {
  if (!isPlainObject(value)) {
    return defaultWorkspaceSettings;
  }

  return {
    retentionMode: normalizeRetentionMode(readStringField(value, "retention_mode")),
    invoiceDraftRetentionDays: clampRetentionDays(
      readNumberField(value, "invoice_draft_retention_days", 365)
    ),
    validationRunRetentionDays: clampRetentionDays(
      readNumberField(value, "validation_run_retention_days", 365)
    ),
    xmlReportRetentionDays: clampRetentionDays(
      readNumberField(value, "xml_report_retention_days", 180)
    ),
    xmlValidationJobRetentionDays: clampRetentionDays(
      readNumberField(value, "xml_validation_job_retention_days", 180)
    ),
    invoiceExportRetentionDays: clampRetentionDays(
      readNumberField(value, "invoice_export_retention_days", 365)
    ),
    apiRequestLogRetentionDays: clampRetentionDays(
      readNumberField(value, "api_request_log_retention_days", 180)
    ),
    webhookDeliveryLogRetentionDays: clampRetentionDays(
      readNumberField(value, "webhook_delivery_log_retention_days", 180)
    ),
    viesEvidenceRetentionDays: clampRetentionDays(
      readNumberField(value, "vies_evidence_retention_days", 365)
    ),
    vidaSimulationRetentionDays: clampRetentionDays(
      readNumberField(value, "vida_simulation_retention_days", 365)
    ),
    activityLogRetentionDays: clampRetentionDays(
      readNumberField(value, "activity_log_retention_days", 365)
    ),
    privacyRequestRetentionDays: clampRetentionDays(
      readNumberField(value, "privacy_request_retention_days", 1095)
    ),
    retentionRunRetentionDays: clampRetentionDays(
      readNumberField(value, "retention_run_retention_days", 1095)
    ),
    deletionRunRetentionDays: clampRetentionDays(
      readNumberField(value, "deletion_run_retention_days", 1095)
    ),
    legalAcceptanceRetentionDays: clampRetentionDays(
      readNumberField(value, "legal_acceptance_retention_days", 2555)
    )
  };
}

function calculateCutoffDate(retentionDays: number) {
  const cutoffDate = new Date();

  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - clampRetentionDays(retentionDays));

  return cutoffDate.toISOString();
}

function getRetentionWarnings() {
  return RETENTION_RUN_DATASETS.filter((dataset) => dataset.preservedByDefault).map(
    (dataset) =>
      `${dataset.tableName} is counted for retention review, but required privacy, legal, security, or audit evidence is preserved by default unless a future reviewed policy explicitly permits minimization.`
  );
}

function normalizeRetentionBucket(
  row: Record<string, unknown>,
  dataset: RetentionDatasetConfig
): WorkspaceRetentionRunBucket {
  return {
    retentionDays: readNumberField(
      row,
      `${dataset.columnPrefix}_retention_days`,
      0
    ),
    cutoffDate: readStringField(row, `${dataset.columnPrefix}_cutoff_date`),
    affectedCount: readNumberField(
      row,
      `${dataset.columnPrefix}_affected_count`,
      0
    ),
    executedCount: readNumberField(
      row,
      `${dataset.columnPrefix}_executed_count`,
      0
    )
  };
}

function normalizeRetentionRunRow(value: unknown): WorkspaceRetentionRunRecord {
  const row = isPlainObject(value) ? value : {};
  const buckets = Object.fromEntries(
    RETENTION_RUN_DATASETS.map((dataset) => [
      dataset.responseKey,
      normalizeRetentionBucket(row, dataset)
    ])
  ) as Record<RetentionDatasetConfig["responseKey"], WorkspaceRetentionRunBucket>;
  const totalAffectedCount = Object.values(buckets).reduce(
    (total, bucket) => total + bucket.affectedCount,
    0
  );
  const totalExecutedCount = Object.values(buckets).reduce(
    (total, bucket) => total + bucket.executedCount,
    0
  );

  return {
    id: readStringField(row, "id"),
    runType: "manual_retention_review",
    status: normalizeRetentionRunStatus(readStringField(row, "status")),
    retentionMode: normalizeRetentionMode(readStringField(row, "retention_mode")),
    invoiceDrafts: buckets.invoiceDrafts,
    validationRuns: buckets.validationRuns,
    xmlReadinessReports: buckets.xmlReadinessReports,
    xmlValidationJobs: buckets.xmlValidationJobs,
    invoiceExports: buckets.invoiceExports,
    apiRequests: buckets.apiRequests,
    webhookDeliveries: buckets.webhookDeliveries,
    viesEvidenceChecks: buckets.viesEvidenceChecks,
    vidaSimulationRuns: buckets.vidaSimulationRuns,
    activityEvents: buckets.activityEvents,
    privacyRequests: buckets.privacyRequests,
    retentionRuns: buckets.retentionRuns,
    deletionRuns: buckets.deletionRuns,
    legalAcceptances: buckets.legalAcceptances,
    totalAffectedCount,
    totalExecutedCount,
    warnings: getRetentionWarnings(),
    disclaimer:
      "Retention runs are GDPR-aware privacy-support tooling only. Execution does not decide statutory legal, tax, accounting, filing, privacy, or audit-retention duties and is not a GDPR compliance guarantee.",
    errorMessage: readStringField(row, "error_message"),
    executedAt: readStringField(row, "executed_at"),
    createdAt: readStringField(row, "created_at"),
    updatedAt: readStringField(row, "updated_at")
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
  context: AuthenticatedWorkspaceRetentionRunContext
) {
  return getSupabaseUserClient(context.accessToken);
}

async function getWorkspaceSettings(
  supabase: SupabaseClient,
  organizationId: string
) {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select(WORKSPACE_SETTINGS_SELECT_FIELDS)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read workspace settings: ${error.message}`);
  }

  return normalizeWorkspaceSettingsRow(data);
}

async function countRowsOlderThan({
  supabase,
  tableName,
  organizationId,
  dateColumn,
  cutoffDate
}: {
  supabase: SupabaseClient;
  tableName: string;
  organizationId: string;
  dateColumn: string;
  cutoffDate: string;
}) {
  const { count, error } = await supabase
    .from(tableName)
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("organization_id", organizationId)
    .lt(dateColumn, cutoffDate);

  if (error) {
    throw new Error(`Could not count ${tableName}: ${error.message}`);
  }

  return count ?? 0;
}

async function recordWorkspaceActivityEvent(
  supabase: SupabaseClient,
  input: WorkspaceActivityEventInput
) {
  const { error } = await supabase.from("workspace_activity_events").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_label: input.entityLabel,
    severity: input.severity ?? "info",
    source: input.source ?? "api",
    metadata: input.metadata ?? {}
  });

  if (error) {
    console.warn(`Workspace activity event was not recorded: ${error.message}`);
  }
}

async function insertRetentionRunPreparedActivityEvent({
  supabase,
  organizationId,
  userId,
  record
}: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  record: WorkspaceRetentionRunRecord;
}) {
  await recordWorkspaceActivityEvent(supabase, {
    organizationId,
    actorUserId: userId,
    eventType: "retention_run.prepared",
    entityType: "workspace_retention_run",
    entityId: record.id,
    entityLabel: `Retention review prepared ${record.createdAt}`,
    severity: record.totalAffectedCount > 0 ? "warning" : "info",
    metadata: {
      retentionMode: record.retentionMode,
      totalAffectedCount: record.totalAffectedCount,
      affectedDatasets: RETENTION_RUN_DATASETS.map((dataset) => ({
        dataset: dataset.responseKey,
        affectedCount: record[dataset.responseKey].affectedCount,
        preservedByDefault: Boolean(dataset.preservedByDefault)
      })),
      legalAdvice: false,
      privacyComplianceGuarantee: false
    }
  });
}

function normalizeRpcRetentionRunResult(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return isPlainObject(value) ? value : null;
}

function isRetentionRunNotFoundError(message: string) {
  return message.toLowerCase().includes("retention run was not found");
}

function isRetentionRunNotExecutableError(message: string) {
  return message.toLowerCase().includes("only prepared retention runs can be executed");
}

export function hasAuthenticatedWorkspaceRetentionRunContext(
  context: AuthenticatedWorkspaceRetentionRunContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function listAuthenticatedWorkspaceRetentionRuns(
  context: AuthenticatedWorkspaceRetentionRunContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("workspace_retention_runs")
    .select(WORKSPACE_RETENTION_RUN_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(MAX_WORKSPACE_RETENTION_RUNS);

  if (error) {
    throw new Error(`Could not list retention runs: ${error.message}`);
  }

  return (data ?? []).map((row) => normalizeRetentionRunRow(row));
}

export async function createAuthenticatedWorkspaceRetentionRun(
  context: AuthenticatedWorkspaceRetentionRunContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const settings = await getWorkspaceSettings(supabase, workspace.organizationId);
  const insertValues: Record<string, unknown> = {
    organization_id: workspace.organizationId,
    initiated_by: context.userId,
    run_type: "manual_retention_review",
    status: "prepared",
    retention_mode: settings.retentionMode
  };

  await Promise.all(
    RETENTION_RUN_DATASETS.map(async (dataset) => {
      const retentionDays = clampRetentionDays(settings[dataset.settingKey]);
      const cutoffDate = calculateCutoffDate(retentionDays);
      const affectedCount = await countRowsOlderThan({
        supabase,
        tableName: dataset.tableName,
        organizationId: workspace.organizationId,
        dateColumn: dataset.dateColumn,
        cutoffDate
      });

      insertValues[`${dataset.columnPrefix}_retention_days`] = retentionDays;
      insertValues[`${dataset.columnPrefix}_cutoff_date`] = cutoffDate;
      insertValues[`${dataset.columnPrefix}_affected_count`] = affectedCount;
    })
  );

  const { data, error } = await supabase
    .from("workspace_retention_runs")
    .insert(insertValues)
    .select(WORKSPACE_RETENTION_RUN_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create retention run: ${error.message}`);
  }

  const record = normalizeRetentionRunRow(data);

  try {
    await insertRetentionRunPreparedActivityEvent({
      supabase,
      organizationId: workspace.organizationId,
      userId: context.userId,
      record
    });
  } catch {
    /*
     * Retention run creation should not fail only because activity logging failed.
     */
  }

  return record;
}

export async function executeAuthenticatedWorkspaceRetentionRun(
  context: AuthenticatedWorkspaceRetentionRunContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const { data, error } = await supabase.rpc("execute_workspace_retention_run", {
    retention_run_id: id
  });

  if (error) {
    const message = error.message || "Could not execute retention run.";

    if (isRetentionRunNotFoundError(message)) {
      return null;
    }

    if (isRetentionRunNotExecutableError(message)) {
      throw new Error("Only prepared retention runs can be executed.");
    }

    throw new Error(`Could not execute retention run: ${message}`);
  }

  const row = normalizeRpcRetentionRunResult(data);

  if (!row) {
    return null;
  }

  return normalizeRetentionRunRow(row);
}
