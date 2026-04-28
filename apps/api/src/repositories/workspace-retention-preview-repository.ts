import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspaceRetentionPreviewRecord = {
  retentionMode: "manual" | "scheduled";
  generatedAt: string;
  invoiceDrafts: {
    retentionDays: number;
    cutoffDate: string;
    affectedCount: number;
  };
  validationRuns: {
    retentionDays: number;
    cutoffDate: string;
    affectedCount: number;
  };
  xmlReadinessReports: {
    retentionDays: number;
    cutoffDate: string;
    affectedCount: number;
  };
  activityEvents: {
    retentionDays: number;
    cutoffDate: string;
    affectedCount: number;
  };
};

export type AuthenticatedWorkspaceRetentionPreviewContext = {
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
  retention_mode: string;
  invoice_draft_retention_days: number;
  validation_run_retention_days: number;
  xml_report_retention_days: number;
  activity_log_retention_days: number;
};

const WORKSPACE_SETTINGS_SELECT_FIELDS =
  "retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, activity_log_retention_days";

const defaultWorkspaceSettings: SupabaseWorkspaceSettingsRow = {
  retention_mode: "manual",
  invoice_draft_retention_days: 365,
  validation_run_retention_days: 365,
  xml_report_retention_days: 180,
  activity_log_retention_days: 365
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

function normalizeRetentionMode(value: string): "manual" | "scheduled" {
  return value === "scheduled" ? "scheduled" : "manual";
}

function clampRetentionDays(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(3650, Math.round(value)));
}

function buildCutoffDate(retentionDays: number) {
  const cutoffDate = new Date();

  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - clampRetentionDays(retentionDays));

  return cutoffDate.toISOString();
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
  context: AuthenticatedWorkspaceRetentionPreviewContext
) {
  return getSupabaseUserClient(context.accessToken);
}

async function getWorkspaceSettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<SupabaseWorkspaceSettingsRow> {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select(WORKSPACE_SETTINGS_SELECT_FIELDS)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read workspace settings: ${error.message}`);
  }

  if (!data) {
    return defaultWorkspaceSettings;
  }

  return data as SupabaseWorkspaceSettingsRow;
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
    throw new Error(
      `Could not count retention preview rows for ${tableName}: ${error.message}`
    );
  }

  return count ?? 0;
}

export function hasAuthenticatedWorkspaceRetentionPreviewContext(
  context: AuthenticatedWorkspaceRetentionPreviewContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function getAuthenticatedWorkspaceRetentionPreview(
  context: AuthenticatedWorkspaceRetentionPreviewContext
): Promise<WorkspaceRetentionPreviewRecord> {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const settings = await getWorkspaceSettings(supabase, workspace.organizationId);

  const invoiceDraftRetentionDays = clampRetentionDays(
    settings.invoice_draft_retention_days
  );
  const validationRunRetentionDays = clampRetentionDays(
    settings.validation_run_retention_days
  );
  const xmlReportRetentionDays = clampRetentionDays(
    settings.xml_report_retention_days
  );
  const activityLogRetentionDays = clampRetentionDays(
    settings.activity_log_retention_days
  );

  const invoiceDraftCutoffDate = buildCutoffDate(invoiceDraftRetentionDays);
  const validationRunCutoffDate = buildCutoffDate(validationRunRetentionDays);
  const xmlReportCutoffDate = buildCutoffDate(xmlReportRetentionDays);
  const activityLogCutoffDate = buildCutoffDate(activityLogRetentionDays);

  const [
    invoiceDraftCount,
    validationRunCount,
    xmlReadinessReportCount,
    activityEventCount
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

  return {
    retentionMode: normalizeRetentionMode(settings.retention_mode),
    generatedAt: new Date().toISOString(),
    invoiceDrafts: {
      retentionDays: invoiceDraftRetentionDays,
      cutoffDate: invoiceDraftCutoffDate,
      affectedCount: invoiceDraftCount
    },
    validationRuns: {
      retentionDays: validationRunRetentionDays,
      cutoffDate: validationRunCutoffDate,
      affectedCount: validationRunCount
    },
    xmlReadinessReports: {
      retentionDays: xmlReportRetentionDays,
      cutoffDate: xmlReportCutoffDate,
      affectedCount: xmlReadinessReportCount
    },
    activityEvents: {
      retentionDays: activityLogRetentionDays,
      cutoffDate: activityLogCutoffDate,
      affectedCount: activityEventCount
    }
  };
}
