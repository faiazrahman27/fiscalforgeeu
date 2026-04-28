import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspaceRetentionMode = "manual" | "scheduled";

export type WorkspaceSettingsRecord = {
  retentionMode: WorkspaceRetentionMode;
  invoiceDraftRetentionDays: number;
  validationRunRetentionDays: number;
  xmlReportRetentionDays: number;
  activityLogRetentionDays: number;
  allowDataExportRequests: boolean;
  allowDeletionRequests: boolean;
  updatedAt: string;
};

export type WorkspaceSettingsPayload = {
  retentionMode: WorkspaceRetentionMode;
  invoiceDraftRetentionDays: number;
  validationRunRetentionDays: number;
  xmlReportRetentionDays: number;
  activityLogRetentionDays: number;
  allowDataExportRequests: boolean;
  allowDeletionRequests: boolean;
};

export type AuthenticatedWorkspaceSettingsContext = {
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

type SupabaseWorkspaceSettingsRow = {
  organization_id: string;
  retention_mode: string;
  invoice_draft_retention_days: number;
  validation_run_retention_days: number;
  xml_report_retention_days: number;
  activity_log_retention_days: number;
  allow_data_export_requests: boolean;
  allow_deletion_requests: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const WORKSPACE_SETTINGS_SELECT_FIELDS =
  "organization_id, retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, activity_log_retention_days, allow_data_export_requests, allow_deletion_requests, updated_by, created_at, updated_at";

const defaultWorkspaceSettingsPayload: WorkspaceSettingsPayload = {
  retentionMode: "manual",
  invoiceDraftRetentionDays: 365,
  validationRunRetentionDays: 365,
  xmlReportRetentionDays: 180,
  activityLogRetentionDays: 365,
  allowDataExportRequests: true,
  allowDeletionRequests: true
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

function normalizeRetentionMode(value: string): WorkspaceRetentionMode {
  return value === "scheduled" ? "scheduled" : "manual";
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

function normalizeWorkspaceSettingsRow(
  row: SupabaseWorkspaceSettingsRow
): WorkspaceSettingsRecord {
  return {
    retentionMode: normalizeRetentionMode(row.retention_mode),
    invoiceDraftRetentionDays: row.invoice_draft_retention_days,
    validationRunRetentionDays: row.validation_run_retention_days,
    xmlReportRetentionDays: row.xml_report_retention_days,
    activityLogRetentionDays: row.activity_log_retention_days,
    allowDataExportRequests: row.allow_data_export_requests,
    allowDeletionRequests: row.allow_deletion_requests,
    updatedAt: row.updated_at
  };
}

function buildSupabaseWorkspaceSettingsValues(
  payload: WorkspaceSettingsPayload,
  organizationId: string,
  userId: string
) {
  return {
    organization_id: organizationId,
    retention_mode: payload.retentionMode,
    invoice_draft_retention_days: payload.invoiceDraftRetentionDays,
    validation_run_retention_days: payload.validationRunRetentionDays,
    xml_report_retention_days: payload.xmlReportRetentionDays,
    activity_log_retention_days: payload.activityLogRetentionDays,
    allow_data_export_requests: payload.allowDataExportRequests,
    allow_deletion_requests: payload.allowDeletionRequests,
    updated_by: userId
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
  context: AuthenticatedWorkspaceSettingsContext
) {
  return getSupabaseUserClient(context.accessToken);
}

async function insertWorkspaceSettingsActivityEvent(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  payload: WorkspaceSettingsPayload
) {
  await supabase.from("workspace_activity_events").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    event_type: "workspace_settings.updated",
    entity_type: "workspace_settings",
    entity_id: organizationId,
    entity_label: "Workspace privacy settings",
    severity: "info",
    source: "api",
    metadata: {
      retentionMode: payload.retentionMode,
      invoiceDraftRetentionDays: payload.invoiceDraftRetentionDays,
      validationRunRetentionDays: payload.validationRunRetentionDays,
      xmlReportRetentionDays: payload.xmlReportRetentionDays,
      activityLogRetentionDays: payload.activityLogRetentionDays,
      allowDataExportRequests: payload.allowDataExportRequests,
      allowDeletionRequests: payload.allowDeletionRequests
    }
  });
}

export function hasAuthenticatedWorkspaceSettingsContext(
  context: AuthenticatedWorkspaceSettingsContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function getAuthenticatedWorkspaceSettings(
  context: AuthenticatedWorkspaceSettingsContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("workspace_settings")
    .select(WORKSPACE_SETTINGS_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read workspace settings: ${error.message}`);
  }

  if (data) {
    return normalizeWorkspaceSettingsRow(data as SupabaseWorkspaceSettingsRow);
  }

  const { data: insertedData, error: insertError } = await supabase
    .from("workspace_settings")
    .insert(
      buildSupabaseWorkspaceSettingsValues(
        defaultWorkspaceSettingsPayload,
        workspace.organizationId,
        context.userId
      )
    )
    .select(WORKSPACE_SETTINGS_SELECT_FIELDS)
    .single();

  if (insertError) {
    throw new Error(`Could not create workspace settings: ${insertError.message}`);
  }

  return normalizeWorkspaceSettingsRow(
    insertedData as SupabaseWorkspaceSettingsRow
  );
}

export async function updateAuthenticatedWorkspaceSettings(
  context: AuthenticatedWorkspaceSettingsContext,
  payload: WorkspaceSettingsPayload
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("workspace_settings")
    .upsert(
      buildSupabaseWorkspaceSettingsValues(
        payload,
        workspace.organizationId,
        context.userId
      ),
      {
        onConflict: "organization_id"
      }
    )
    .select(WORKSPACE_SETTINGS_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not save workspace settings: ${error.message}`);
  }

  try {
    await insertWorkspaceSettingsActivityEvent(
      supabase,
      workspace.organizationId,
      context.userId,
      payload
    );
  } catch {
    /*
     * Settings should still save even if the non-critical activity event insert
     * fails because of a future policy or activity-log issue.
     */
  }

  return normalizeWorkspaceSettingsRow(data as SupabaseWorkspaceSettingsRow);
}
