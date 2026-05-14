import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspaceRetentionPreviewBucket = {
  retentionDays: number;
  cutoffDate: string;
  affectedCount: number;
};

export type WorkspaceRetentionPreviewRecord = {
  retentionMode: "manual" | "scheduled";
  generatedAt: string;
  invoiceDrafts: WorkspaceRetentionPreviewBucket;
  validationRuns: WorkspaceRetentionPreviewBucket;
  xmlReadinessReports: WorkspaceRetentionPreviewBucket;
  xmlValidationJobs: WorkspaceRetentionPreviewBucket;
  invoiceExports: WorkspaceRetentionPreviewBucket;
  apiRequests: WorkspaceRetentionPreviewBucket;
  webhookDeliveries: WorkspaceRetentionPreviewBucket;
  viesEvidenceChecks: WorkspaceRetentionPreviewBucket;
  vidaSimulationRuns: WorkspaceRetentionPreviewBucket;
  activityEvents: WorkspaceRetentionPreviewBucket;
  privacyRequests: WorkspaceRetentionPreviewBucket;
  retentionRuns: WorkspaceRetentionPreviewBucket;
  deletionRuns: WorkspaceRetentionPreviewBucket;
  legalAcceptances: WorkspaceRetentionPreviewBucket;
  warnings: string[];
  disclaimer: string;
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

type WorkspaceSettingsRecord = {
  retentionMode: "manual" | "scheduled";
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
  responseKey: keyof Omit<
    WorkspaceRetentionPreviewRecord,
    "retentionMode" | "generatedAt" | "warnings" | "disclaimer"
  >;
  settingKey: keyof Omit<WorkspaceSettingsRecord, "retentionMode">;
  tableName: string;
  dateColumn: string;
  preservedByDefault?: boolean;
};

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

export const RETENTION_PREVIEW_DATASETS: readonly RetentionDatasetConfig[] = [
  {
    responseKey: "invoiceDrafts",
    settingKey: "invoiceDraftRetentionDays",
    tableName: "invoice_drafts",
    dateColumn: "updated_at"
  },
  {
    responseKey: "validationRuns",
    settingKey: "validationRunRetentionDays",
    tableName: "validation_runs",
    dateColumn: "created_at"
  },
  {
    responseKey: "xmlReadinessReports",
    settingKey: "xmlReportRetentionDays",
    tableName: "xml_readiness_reports",
    dateColumn: "uploaded_at"
  },
  {
    responseKey: "xmlValidationJobs",
    settingKey: "xmlValidationJobRetentionDays",
    tableName: "xml_validation_jobs",
    dateColumn: "created_at"
  },
  {
    responseKey: "invoiceExports",
    settingKey: "invoiceExportRetentionDays",
    tableName: "invoice_exports",
    dateColumn: "created_at"
  },
  {
    responseKey: "apiRequests",
    settingKey: "apiRequestLogRetentionDays",
    tableName: "api_requests",
    dateColumn: "created_at"
  },
  {
    responseKey: "webhookDeliveries",
    settingKey: "webhookDeliveryLogRetentionDays",
    tableName: "webhook_deliveries",
    dateColumn: "created_at"
  },
  {
    responseKey: "viesEvidenceChecks",
    settingKey: "viesEvidenceRetentionDays",
    tableName: "vies_evidence_checks",
    dateColumn: "created_at"
  },
  {
    responseKey: "vidaSimulationRuns",
    settingKey: "vidaSimulationRetentionDays",
    tableName: "vida_simulation_runs",
    dateColumn: "created_at"
  },
  {
    responseKey: "activityEvents",
    settingKey: "activityLogRetentionDays",
    tableName: "workspace_activity_events",
    dateColumn: "created_at"
  },
  {
    responseKey: "privacyRequests",
    settingKey: "privacyRequestRetentionDays",
    tableName: "workspace_privacy_requests",
    dateColumn: "created_at",
    preservedByDefault: true
  },
  {
    responseKey: "retentionRuns",
    settingKey: "retentionRunRetentionDays",
    tableName: "workspace_retention_runs",
    dateColumn: "created_at",
    preservedByDefault: true
  },
  {
    responseKey: "deletionRuns",
    settingKey: "deletionRunRetentionDays",
    tableName: "workspace_deletion_runs",
    dateColumn: "created_at",
    preservedByDefault: true
  },
  {
    responseKey: "legalAcceptances",
    settingKey: "legalAcceptanceRetentionDays",
    tableName: "legal_document_acceptances",
    dateColumn: "accepted_at",
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
    return Math.max(0, Math.min(3650, Math.round(value)));
  }

  return fallback;
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

function normalizeWorkspaceSettings(value: unknown): WorkspaceSettingsRecord {
  if (!isPlainObject(value)) {
    return defaultWorkspaceSettings;
  }

  return {
    retentionMode: normalizeRetentionMode(readStringField(value, "retention_mode")),
    invoiceDraftRetentionDays: readNumberField(
      value,
      "invoice_draft_retention_days",
      defaultWorkspaceSettings.invoiceDraftRetentionDays
    ),
    validationRunRetentionDays: readNumberField(
      value,
      "validation_run_retention_days",
      defaultWorkspaceSettings.validationRunRetentionDays
    ),
    xmlReportRetentionDays: readNumberField(
      value,
      "xml_report_retention_days",
      defaultWorkspaceSettings.xmlReportRetentionDays
    ),
    xmlValidationJobRetentionDays: readNumberField(
      value,
      "xml_validation_job_retention_days",
      defaultWorkspaceSettings.xmlValidationJobRetentionDays
    ),
    invoiceExportRetentionDays: readNumberField(
      value,
      "invoice_export_retention_days",
      defaultWorkspaceSettings.invoiceExportRetentionDays
    ),
    apiRequestLogRetentionDays: readNumberField(
      value,
      "api_request_log_retention_days",
      defaultWorkspaceSettings.apiRequestLogRetentionDays
    ),
    webhookDeliveryLogRetentionDays: readNumberField(
      value,
      "webhook_delivery_log_retention_days",
      defaultWorkspaceSettings.webhookDeliveryLogRetentionDays
    ),
    viesEvidenceRetentionDays: readNumberField(
      value,
      "vies_evidence_retention_days",
      defaultWorkspaceSettings.viesEvidenceRetentionDays
    ),
    vidaSimulationRetentionDays: readNumberField(
      value,
      "vida_simulation_retention_days",
      defaultWorkspaceSettings.vidaSimulationRetentionDays
    ),
    activityLogRetentionDays: readNumberField(
      value,
      "activity_log_retention_days",
      defaultWorkspaceSettings.activityLogRetentionDays
    ),
    privacyRequestRetentionDays: readNumberField(
      value,
      "privacy_request_retention_days",
      defaultWorkspaceSettings.privacyRequestRetentionDays
    ),
    retentionRunRetentionDays: readNumberField(
      value,
      "retention_run_retention_days",
      defaultWorkspaceSettings.retentionRunRetentionDays
    ),
    deletionRunRetentionDays: readNumberField(
      value,
      "deletion_run_retention_days",
      defaultWorkspaceSettings.deletionRunRetentionDays
    ),
    legalAcceptanceRetentionDays: readNumberField(
      value,
      "legal_acceptance_retention_days",
      defaultWorkspaceSettings.legalAcceptanceRetentionDays
    )
  };
}

async function getWorkspaceSettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<WorkspaceSettingsRecord> {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select(WORKSPACE_SETTINGS_SELECT_FIELDS)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read workspace settings: ${error.message}`);
  }

  return normalizeWorkspaceSettings(data);
}

async function countRowsOlderThanSafe({
  supabase,
  tableName,
  organizationId,
  dateColumn,
  cutoffDate,
  warnings
}: {
  supabase: SupabaseClient;
  tableName: string;
  organizationId: string;
  dateColumn: string;
  cutoffDate: string;
  warnings: string[];
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
    warnings.push(`Could not count retention candidates for ${tableName}.`);
    return 0;
  }

  return count ?? 0;
}

function emptyBucket(): WorkspaceRetentionPreviewBucket {
  return {
    retentionDays: 0,
    cutoffDate: "",
    affectedCount: 0
  };
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
  const warnings = RETENTION_PREVIEW_DATASETS.filter(
    (dataset) => dataset.preservedByDefault
  ).map(
    (dataset) =>
      `${dataset.tableName} is counted for review, but required privacy, legal, security, or audit evidence is preserved by default unless a future reviewed policy explicitly permits minimization.`
  );

  const buckets = Object.fromEntries(
    RETENTION_PREVIEW_DATASETS.map((dataset) => [
      dataset.responseKey,
      emptyBucket()
    ])
  ) as Record<
    RetentionDatasetConfig["responseKey"],
    WorkspaceRetentionPreviewBucket
  >;

  await Promise.all(
    RETENTION_PREVIEW_DATASETS.map(async (dataset) => {
      const retentionDays = clampRetentionDays(settings[dataset.settingKey]);
      const cutoffDate = buildCutoffDate(retentionDays);
      const affectedCount = await countRowsOlderThanSafe({
        supabase,
        tableName: dataset.tableName,
        organizationId: workspace.organizationId,
        dateColumn: dataset.dateColumn,
        cutoffDate,
        warnings
      });

      buckets[dataset.responseKey] = {
        retentionDays,
        cutoffDate,
        affectedCount
      };
    })
  );

  return {
    retentionMode: settings.retentionMode,
    generatedAt: new Date().toISOString(),
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
    warnings,
    disclaimer:
      "Retention previews are GDPR-aware privacy-support tooling only. They are not legal advice, privacy advice, tax advice, accounting advice, official filing advice, or a GDPR compliance guarantee."
  };
}
