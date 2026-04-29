import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspaceDeletionRunStatus = "prepared" | "executed" | "failed";

export type WorkspaceDeletionRunRecordCounts = {
  invoiceDrafts: number;
  validationRuns: number;
  xmlReadinessReports: number;
  workspaceExportPackages: number;
  activityEvents: number;
};

export type WorkspaceDeletionRunRecord = {
  id: string;
  runType: "privacy_request_deletion";
  status: WorkspaceDeletionRunStatus;
  sourcePrivacyRequestId: string;
  affectedCounts: WorkspaceDeletionRunRecordCounts;
  executedCounts: WorkspaceDeletionRunRecordCounts;
  totalAffectedCount: number;
  totalExecutedCount: number;
  errorMessage: string;
  executedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceDeletionRunCreatePayload = {
  sourcePrivacyRequestId: string;
};

export type AuthenticatedWorkspaceDeletionRunContext = {
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

type SupabaseWorkspaceDeletionRunRow = {
  id: string;
  organization_id: string;
  source_privacy_request_id: string | null;
  initiated_by: string | null;
  run_type: string;
  status: string;

  invoice_draft_affected_count: number;
  validation_run_affected_count: number;
  xml_report_affected_count: number;
  workspace_export_package_affected_count: number;
  activity_event_affected_count: number;

  invoice_draft_executed_count: number;
  validation_run_executed_count: number;
  xml_report_executed_count: number;
  workspace_export_package_executed_count: number;
  activity_event_executed_count: number;

  error_message: string;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseWorkspacePrivacyRequestRow = {
  id: string;
  organization_id: string;
  request_type: string;
  status: string;
  subject: string;
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

const MAX_WORKSPACE_DELETION_RUNS = 250;

const WORKSPACE_DELETION_RUN_SELECT_FIELDS =
  "id, organization_id, source_privacy_request_id, initiated_by, run_type, status, invoice_draft_affected_count, validation_run_affected_count, xml_report_affected_count, workspace_export_package_affected_count, activity_event_affected_count, invoice_draft_executed_count, validation_run_executed_count, xml_report_executed_count, workspace_export_package_executed_count, activity_event_executed_count, error_message, executed_at, created_at, updated_at";

const WORKSPACE_PRIVACY_REQUEST_SELECT_FIELDS =
  "id, organization_id, request_type, status, subject";

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

function normalizeDeletionRunStatus(value: string): WorkspaceDeletionRunStatus {
  if (value === "executed" || value === "failed") {
    return value;
  }

  return "prepared";
}

function normalizeDeletionRunRow(
  row: SupabaseWorkspaceDeletionRunRow
): WorkspaceDeletionRunRecord {
  const affectedCounts = {
    invoiceDrafts: row.invoice_draft_affected_count,
    validationRuns: row.validation_run_affected_count,
    xmlReadinessReports: row.xml_report_affected_count,
    workspaceExportPackages: row.workspace_export_package_affected_count,
    activityEvents: row.activity_event_affected_count
  };

  const executedCounts = {
    invoiceDrafts: row.invoice_draft_executed_count,
    validationRuns: row.validation_run_executed_count,
    xmlReadinessReports: row.xml_report_executed_count,
    workspaceExportPackages: row.workspace_export_package_executed_count,
    activityEvents: row.activity_event_executed_count
  };

  return {
    id: row.id,
    runType: "privacy_request_deletion",
    status: normalizeDeletionRunStatus(row.status),
    sourcePrivacyRequestId: row.source_privacy_request_id ?? "",
    affectedCounts,
    executedCounts,
    totalAffectedCount:
      affectedCounts.invoiceDrafts +
      affectedCounts.validationRuns +
      affectedCounts.xmlReadinessReports +
      affectedCounts.workspaceExportPackages +
      affectedCounts.activityEvents,
    totalExecutedCount:
      executedCounts.invoiceDrafts +
      executedCounts.validationRuns +
      executedCounts.xmlReadinessReports +
      executedCounts.workspaceExportPackages +
      executedCounts.activityEvents,
    errorMessage: row.error_message,
    executedAt: row.executed_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeRpcDeletionRunResult(
  value: unknown
): SupabaseWorkspaceDeletionRunRow | null {
  if (Array.isArray(value)) {
    const firstRecord = value[0];

    return isPlainObject(firstRecord)
      ? (firstRecord as SupabaseWorkspaceDeletionRunRow)
      : null;
  }

  return isPlainObject(value) ? (value as SupabaseWorkspaceDeletionRunRow) : null;
}

function isDeletionRunNotFoundError(message: string) {
  return message.toLowerCase().includes("deletion run was not found");
}

function isDeletionRunNotExecutableError(message: string) {
  return message.toLowerCase().includes("only prepared deletion runs can be executed");
}

function isDeletionRunInvalidSourceError(message: string) {
  return message
    .toLowerCase()
    .includes("deletion run source privacy request is invalid");
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
  context: AuthenticatedWorkspaceDeletionRunContext
) {
  return getSupabaseUserClient(context.accessToken);
}

async function getDeletionPrivacyRequest({
  supabase,
  organizationId,
  sourcePrivacyRequestId
}: {
  supabase: SupabaseClient;
  organizationId: string;
  sourcePrivacyRequestId: string;
}) {
  const { data, error } = await supabase
    .from("workspace_privacy_requests")
    .select(WORKSPACE_PRIVACY_REQUEST_SELECT_FIELDS)
    .eq("id", sourcePrivacyRequestId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read source privacy request: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const request = data as SupabaseWorkspacePrivacyRequestRow;

  if (request.request_type !== "deletion") {
    throw new Error("Deletion runs must be linked to a deletion privacy request.");
  }

  return request;
}

async function countWorkspaceRows({
  supabase,
  tableName,
  organizationId
}: {
  supabase: SupabaseClient;
  tableName: string;
  organizationId: string;
}) {
  const { count, error } = await supabase
    .from(tableName)
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("organization_id", organizationId);

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
    /*
     * Activity logging must not break deletion-run preparation.
     * The deletion-run row remains the authoritative audit record.
     */
    console.warn(`Workspace activity event was not recorded: ${error.message}`);
  }
}

async function insertDeletionRunPreparedActivityEvent({
  supabase,
  organizationId,
  userId,
  record,
  sourcePrivacyRequest
}: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  record: WorkspaceDeletionRunRecord;
  sourcePrivacyRequest: SupabaseWorkspacePrivacyRequestRow;
}) {
  await recordWorkspaceActivityEvent(supabase, {
    organizationId,
    actorUserId: userId,
    eventType: "deletion_run.prepared",
    entityType: "workspace_deletion_run",
    entityId: record.id,
    entityLabel: `Deletion review prepared for ${sourcePrivacyRequest.subject}`,
    severity: "warning",
    metadata: {
      sourcePrivacyRequestId: record.sourcePrivacyRequestId,
      sourcePrivacyRequestSubject: sourcePrivacyRequest.subject,
      sourcePrivacyRequestStatus: sourcePrivacyRequest.status,
      totalAffectedCount: record.totalAffectedCount,
      affectedCounts: record.affectedCounts
    }
  });
}

export function hasAuthenticatedWorkspaceDeletionRunContext(
  context: AuthenticatedWorkspaceDeletionRunContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function listAuthenticatedWorkspaceDeletionRuns(
  context: AuthenticatedWorkspaceDeletionRunContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("workspace_deletion_runs")
    .select(WORKSPACE_DELETION_RUN_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(MAX_WORKSPACE_DELETION_RUNS);

  if (error) {
    throw new Error(`Could not list deletion runs: ${error.message}`);
  }

  return ((data ?? []) as SupabaseWorkspaceDeletionRunRow[]).map((row) =>
    normalizeDeletionRunRow(row)
  );
}

export async function createAuthenticatedWorkspaceDeletionRun(
  context: AuthenticatedWorkspaceDeletionRunContext,
  payload: WorkspaceDeletionRunCreatePayload
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const sourcePrivacyRequestId = payload.sourcePrivacyRequestId.trim();

  if (!sourcePrivacyRequestId) {
    throw new Error("Deletion run requires a source privacy request.");
  }

  const sourcePrivacyRequest = await getDeletionPrivacyRequest({
    supabase,
    organizationId: workspace.organizationId,
    sourcePrivacyRequestId
  });

  if (!sourcePrivacyRequest) {
    return null;
  }

  const [
    invoiceDraftAffectedCount,
    validationRunAffectedCount,
    xmlReportAffectedCount,
    workspaceExportPackageAffectedCount,
    activityEventAffectedCount
  ] = await Promise.all([
    countWorkspaceRows({
      supabase,
      tableName: "invoice_drafts",
      organizationId: workspace.organizationId
    }),
    countWorkspaceRows({
      supabase,
      tableName: "validation_runs",
      organizationId: workspace.organizationId
    }),
    countWorkspaceRows({
      supabase,
      tableName: "xml_readiness_reports",
      organizationId: workspace.organizationId
    }),
    countWorkspaceRows({
      supabase,
      tableName: "workspace_export_packages",
      organizationId: workspace.organizationId
    }),
    countWorkspaceRows({
      supabase,
      tableName: "workspace_activity_events",
      organizationId: workspace.organizationId
    })
  ]);

  const { data, error } = await supabase
    .from("workspace_deletion_runs")
    .insert({
      organization_id: workspace.organizationId,
      source_privacy_request_id: sourcePrivacyRequest.id,
      initiated_by: context.userId,
      run_type: "privacy_request_deletion",
      status: "prepared",

      invoice_draft_affected_count: invoiceDraftAffectedCount,
      validation_run_affected_count: validationRunAffectedCount,
      xml_report_affected_count: xmlReportAffectedCount,
      workspace_export_package_affected_count: workspaceExportPackageAffectedCount,
      activity_event_affected_count: activityEventAffectedCount
    })
    .select(WORKSPACE_DELETION_RUN_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create deletion run: ${error.message}`);
  }

  const record = normalizeDeletionRunRow(data as SupabaseWorkspaceDeletionRunRow);

  try {
    await insertDeletionRunPreparedActivityEvent({
      supabase,
      organizationId: workspace.organizationId,
      userId: context.userId,
      record,
      sourcePrivacyRequest
    });
  } catch {
    /*
     * Deletion run creation should not fail only because activity logging failed.
     */
  }

  return record;
}

export async function executeAuthenticatedWorkspaceDeletionRun(
  context: AuthenticatedWorkspaceDeletionRunContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);

  /*
   * Destructive workspace deletion is intentionally executed through a Postgres
   * RPC. The RPC performs the delete/update/activity-log sequence inside the
   * database so the operation is atomic and does not partially delete records if
   * a later step fails.
   */
  const { data, error } = await supabase.rpc("execute_workspace_deletion_run", {
    deletion_run_id: id
  });

  if (error) {
    const message = error.message || "Could not execute deletion run.";

    if (isDeletionRunNotFoundError(message)) {
      return null;
    }

    if (isDeletionRunNotExecutableError(message)) {
      throw new Error("Only prepared deletion runs can be executed.");
    }

    if (isDeletionRunInvalidSourceError(message)) {
      throw new Error("Deletion run source privacy request is invalid.");
    }

    throw new Error(`Could not execute deletion run: ${message}`);
  }

  const row = normalizeRpcDeletionRunResult(data);

  if (!row) {
    return null;
  }

  return normalizeDeletionRunRow(row);
}
