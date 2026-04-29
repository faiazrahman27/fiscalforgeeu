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
  activityEvents: WorkspaceRetentionRunBucket;
  totalAffectedCount: number;
  totalExecutedCount: number;
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
  activityLogRetentionDays: number;
};

type SupabaseWorkspaceRetentionRunRow = {
  id: string;
  organization_id: string;
  initiated_by: string | null;
  run_type: string;
  status: string;
  retention_mode: string;
  invoice_draft_retention_days: number;
  validation_run_retention_days: number;
  xml_report_retention_days: number;
  activity_log_retention_days: number;
  invoice_draft_cutoff_date: string;
  validation_run_cutoff_date: string;
  xml_report_cutoff_date: string;
  activity_log_cutoff_date: string;
  invoice_draft_affected_count: number;
  validation_run_affected_count: number;
  xml_report_affected_count: number;
  activity_event_affected_count: number;
  invoice_draft_executed_count: number;
  validation_run_executed_count: number;
  xml_report_executed_count: number;
  activity_event_executed_count: number;
  error_message: string;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
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
  "id, organization_id, initiated_by, run_type, status, retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, activity_log_retention_days, invoice_draft_cutoff_date, validation_run_cutoff_date, xml_report_cutoff_date, activity_log_cutoff_date, invoice_draft_affected_count, validation_run_affected_count, xml_report_affected_count, activity_event_affected_count, invoice_draft_executed_count, validation_run_executed_count, xml_report_executed_count, activity_event_executed_count, error_message, executed_at, created_at, updated_at";

const WORKSPACE_SETTINGS_SELECT_FIELDS =
  "retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, activity_log_retention_days";

const defaultWorkspaceSettings: WorkspaceSettingsRecord = {
  retentionMode: "manual",
  invoiceDraftRetentionDays: 365,
  validationRunRetentionDays: 365,
  xmlReportRetentionDays: 180,
  activityLogRetentionDays: 365
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

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback: number
) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
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
      readNumberField(
        value,
        "invoice_draft_retention_days",
        defaultWorkspaceSettings.invoiceDraftRetentionDays
      )
    ),
    validationRunRetentionDays: clampRetentionDays(
      readNumberField(
        value,
        "validation_run_retention_days",
        defaultWorkspaceSettings.validationRunRetentionDays
      )
    ),
    xmlReportRetentionDays: clampRetentionDays(
      readNumberField(
        value,
        "xml_report_retention_days",
        defaultWorkspaceSettings.xmlReportRetentionDays
      )
    ),
    activityLogRetentionDays: clampRetentionDays(
      readNumberField(
        value,
        "activity_log_retention_days",
        defaultWorkspaceSettings.activityLogRetentionDays
      )
    )
  };
}

function calculateCutoffDate(retentionDays: number) {
  const cutoffDate = new Date();

  cutoffDate.setDate(cutoffDate.getDate() - clampRetentionDays(retentionDays));

  return cutoffDate.toISOString();
}

function normalizeRetentionRunRow(
  row: SupabaseWorkspaceRetentionRunRow
): WorkspaceRetentionRunRecord {
  const invoiceDrafts = {
    retentionDays: row.invoice_draft_retention_days,
    cutoffDate: row.invoice_draft_cutoff_date,
    affectedCount: row.invoice_draft_affected_count,
    executedCount: row.invoice_draft_executed_count
  };

  const validationRuns = {
    retentionDays: row.validation_run_retention_days,
    cutoffDate: row.validation_run_cutoff_date,
    affectedCount: row.validation_run_affected_count,
    executedCount: row.validation_run_executed_count
  };

  const xmlReadinessReports = {
    retentionDays: row.xml_report_retention_days,
    cutoffDate: row.xml_report_cutoff_date,
    affectedCount: row.xml_report_affected_count,
    executedCount: row.xml_report_executed_count
  };

  const activityEvents = {
    retentionDays: row.activity_log_retention_days,
    cutoffDate: row.activity_log_cutoff_date,
    affectedCount: row.activity_event_affected_count,
    executedCount: row.activity_event_executed_count
  };

  return {
    id: row.id,
    runType: "manual_retention_review",
    status: normalizeRetentionRunStatus(row.status),
    retentionMode: normalizeRetentionMode(row.retention_mode),
    invoiceDrafts,
    validationRuns,
    xmlReadinessReports,
    activityEvents,
    totalAffectedCount:
      invoiceDrafts.affectedCount +
      validationRuns.affectedCount +
      xmlReadinessReports.affectedCount +
      activityEvents.affectedCount,
    totalExecutedCount:
      invoiceDrafts.executedCount +
      validationRuns.executedCount +
      xmlReadinessReports.executedCount +
      activityEvents.executedCount,
    errorMessage: row.error_message,
    executedAt: row.executed_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

async function deleteRowsOlderThan({
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
  const { data, count, error } = await supabase
    .from(tableName)
    .delete({
      count: "exact"
    })
    .eq("organization_id", organizationId)
    .lt(dateColumn, cutoffDate)
    .select("id");

  if (error) {
    throw new Error(`Could not delete expired ${tableName}: ${error.message}`);
  }

  return count ?? data?.length ?? 0;
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
    /*
     * Activity logging must not break retention-run creation or execution.
     * The retention-run row remains the authoritative record.
     */
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
      invoiceDrafts: record.invoiceDrafts,
      validationRuns: record.validationRuns,
      xmlReadinessReports: record.xmlReadinessReports,
      activityEvents: record.activityEvents
    }
  });
}

async function insertRetentionRunExecutedActivityEvent({
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
    eventType: "retention_run.executed",
    entityType: "workspace_retention_run",
    entityId: record.id,
    entityLabel: `Retention review executed ${record.executedAt}`,
    severity: record.totalExecutedCount > 0 ? "warning" : "info",
    metadata: {
      retentionMode: record.retentionMode,
      totalAffectedCount: record.totalAffectedCount,
      totalExecutedCount: record.totalExecutedCount,
      invoiceDrafts: record.invoiceDrafts,
      validationRuns: record.validationRuns,
      xmlReadinessReports: record.xmlReadinessReports,
      activityEvents: record.activityEvents
    }
  });
}

async function markRetentionRunAsFailed({
  supabase,
  organizationId,
  retentionRunId,
  errorMessage
}: {
  supabase: SupabaseClient;
  organizationId: string;
  retentionRunId: string;
  errorMessage: string;
}) {
  const { data, error } = await supabase
    .from("workspace_retention_runs")
    .update({
      status: "failed",
      error_message: errorMessage
    })
    .eq("id", retentionRunId)
    .eq("organization_id", organizationId)
    .select(WORKSPACE_RETENTION_RUN_SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not mark retention run as failed: ${error.message}`);
  }

  return data
    ? normalizeRetentionRunRow(data as SupabaseWorkspaceRetentionRunRow)
    : null;
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

  return ((data ?? []) as SupabaseWorkspaceRetentionRunRow[]).map((row) =>
    normalizeRetentionRunRow(row)
  );
}

export async function createAuthenticatedWorkspaceRetentionRun(
  context: AuthenticatedWorkspaceRetentionRunContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const settings = await getWorkspaceSettings(supabase, workspace.organizationId);

  const invoiceDraftCutoffDate = calculateCutoffDate(
    settings.invoiceDraftRetentionDays
  );
  const validationRunCutoffDate = calculateCutoffDate(
    settings.validationRunRetentionDays
  );
  const xmlReportCutoffDate = calculateCutoffDate(settings.xmlReportRetentionDays);
  const activityLogCutoffDate = calculateCutoffDate(
    settings.activityLogRetentionDays
  );

  const [
    invoiceDraftAffectedCount,
    validationRunAffectedCount,
    xmlReportAffectedCount,
    activityEventAffectedCount
  ] = await Promise.all([
    countRowsOlderThan({
      supabase,
      tableName: "invoice_drafts",
      organizationId: workspace.organizationId,
      dateColumn: "updated_at",
      cutoffDate: invoiceDraftCutoffDate
    }),
    countRowsOlderThan({
      supabase,
      tableName: "validation_runs",
      organizationId: workspace.organizationId,
      dateColumn: "created_at",
      cutoffDate: validationRunCutoffDate
    }),
    countRowsOlderThan({
      supabase,
      tableName: "xml_readiness_reports",
      organizationId: workspace.organizationId,
      dateColumn: "uploaded_at",
      cutoffDate: xmlReportCutoffDate
    }),
    countRowsOlderThan({
      supabase,
      tableName: "workspace_activity_events",
      organizationId: workspace.organizationId,
      dateColumn: "created_at",
      cutoffDate: activityLogCutoffDate
    })
  ]);

  const { data, error } = await supabase
    .from("workspace_retention_runs")
    .insert({
      organization_id: workspace.organizationId,
      initiated_by: context.userId,
      run_type: "manual_retention_review",
      status: "prepared",
      retention_mode: settings.retentionMode,

      invoice_draft_retention_days: settings.invoiceDraftRetentionDays,
      validation_run_retention_days: settings.validationRunRetentionDays,
      xml_report_retention_days: settings.xmlReportRetentionDays,
      activity_log_retention_days: settings.activityLogRetentionDays,

      invoice_draft_cutoff_date: invoiceDraftCutoffDate,
      validation_run_cutoff_date: validationRunCutoffDate,
      xml_report_cutoff_date: xmlReportCutoffDate,
      activity_log_cutoff_date: activityLogCutoffDate,

      invoice_draft_affected_count: invoiceDraftAffectedCount,
      validation_run_affected_count: validationRunAffectedCount,
      xml_report_affected_count: xmlReportAffectedCount,
      activity_event_affected_count: activityEventAffectedCount
    })
    .select(WORKSPACE_RETENTION_RUN_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create retention run: ${error.message}`);
  }

  const record = normalizeRetentionRunRow(data as SupabaseWorkspaceRetentionRunRow);

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
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data: existingData, error: existingError } = await supabase
    .from("workspace_retention_runs")
    .select(WORKSPACE_RETENTION_RUN_SELECT_FIELDS)
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Could not read retention run: ${existingError.message}`);
  }

  if (!existingData) {
    return null;
  }

  const existingRecord = normalizeRetentionRunRow(
    existingData as SupabaseWorkspaceRetentionRunRow
  );

  if (existingRecord.status !== "prepared") {
    throw new Error("Only prepared retention runs can be executed.");
  }

  try {
    /*
     * Execution uses the saved cutoff dates from the prepared run, not current
     * workspace settings. This prevents changed settings or stale browser state
     * from changing the delete scope.
     *
     * Parent tables are deleted only through organization-scoped predicates.
     * Existing ON DELETE CASCADE constraints remove child rows for invoice
     * drafts, validation runs, and XML readiness reports.
     */
    const invoiceDraftExecutedCount = await deleteRowsOlderThan({
      supabase,
      tableName: "invoice_drafts",
      organizationId: workspace.organizationId,
      dateColumn: "updated_at",
      cutoffDate: existingRecord.invoiceDrafts.cutoffDate
    });

    const validationRunExecutedCount = await deleteRowsOlderThan({
      supabase,
      tableName: "validation_runs",
      organizationId: workspace.organizationId,
      dateColumn: "created_at",
      cutoffDate: existingRecord.validationRuns.cutoffDate
    });

    const xmlReportExecutedCount = await deleteRowsOlderThan({
      supabase,
      tableName: "xml_readiness_reports",
      organizationId: workspace.organizationId,
      dateColumn: "uploaded_at",
      cutoffDate: existingRecord.xmlReadinessReports.cutoffDate
    });

    const activityEventExecutedCount = await deleteRowsOlderThan({
      supabase,
      tableName: "workspace_activity_events",
      organizationId: workspace.organizationId,
      dateColumn: "created_at",
      cutoffDate: existingRecord.activityEvents.cutoffDate
    });

    const executedAt = new Date().toISOString();

    const { data, error } = await supabase
      .from("workspace_retention_runs")
      .update({
        status: "executed",
        invoice_draft_executed_count: invoiceDraftExecutedCount,
        validation_run_executed_count: validationRunExecutedCount,
        xml_report_executed_count: xmlReportExecutedCount,
        activity_event_executed_count: activityEventExecutedCount,
        error_message: "",
        executed_at: executedAt
      })
      .eq("id", existingRecord.id)
      .eq("organization_id", workspace.organizationId)
      .eq("status", "prepared")
      .select(WORKSPACE_RETENTION_RUN_SELECT_FIELDS)
      .single();

    if (error) {
      throw new Error(`Could not update executed retention run: ${error.message}`);
    }

    const executedRecord = normalizeRetentionRunRow(
      data as SupabaseWorkspaceRetentionRunRow
    );

    try {
      await insertRetentionRunExecutedActivityEvent({
        supabase,
        organizationId: workspace.organizationId,
        userId: context.userId,
        record: executedRecord
      });
    } catch {
      /*
       * Retention execution should not fail only because activity logging failed.
       */
    }

    return executedRecord;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Retention execution failed.";

    const failedRecord = await markRetentionRunAsFailed({
      supabase,
      organizationId: workspace.organizationId,
      retentionRunId: existingRecord.id,
      errorMessage
    });

    if (failedRecord) {
      await recordWorkspaceActivityEvent(supabase, {
        organizationId: workspace.organizationId,
        actorUserId: context.userId,
        eventType: "retention_run.failed",
        entityType: "workspace_retention_run",
        entityId: failedRecord.id,
        entityLabel: `Retention review failed ${failedRecord.updatedAt}`,
        severity: "error",
        metadata: {
          errorMessage,
          retentionMode: failedRecord.retentionMode,
          totalAffectedCount: failedRecord.totalAffectedCount,
          totalExecutedCount: failedRecord.totalExecutedCount
        }
      });
    }

    throw error;
  }
}
