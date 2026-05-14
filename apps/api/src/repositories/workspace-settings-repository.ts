import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspaceRetentionMode = "manual" | "scheduled";
export type WorkspaceDataMinimizationMode = "standard" | "reduced" | "strict";

export type WorkspaceSettingsRecord = {
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
  storeUploadedXmlAfterValidation: boolean;
  retainValidationReports: boolean;
  retainViesEvidence: boolean;
  retainWebhookPayloadPreviews: boolean;
  allowDataExportRequests: boolean;
  allowDeletionRequests: boolean;
  includeApiLogsInExports: boolean;
  includeWebhookLogsInExports: boolean;
  includeLegalAcceptancesInExports: boolean;
  dataMinimizationMode: WorkspaceDataMinimizationMode;
  privacyContactEmail: string;
  securityContactEmail: string;
  updatedAt: string;
};

export type WorkspaceSettingsPayload = {
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
  storeUploadedXmlAfterValidation: boolean;
  retainValidationReports: boolean;
  retainViesEvidence: boolean;
  retainWebhookPayloadPreviews: boolean;
  allowDataExportRequests: boolean;
  allowDeletionRequests: boolean;
  includeApiLogsInExports: boolean;
  includeWebhookLogsInExports: boolean;
  includeLegalAcceptancesInExports: boolean;
  dataMinimizationMode: WorkspaceDataMinimizationMode;
  privacyContactEmail: string;
  securityContactEmail: string;
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
  xml_validation_job_retention_days: number;
  invoice_export_retention_days: number;
  api_request_log_retention_days: number;
  webhook_delivery_log_retention_days: number;
  vies_evidence_retention_days: number;
  vida_simulation_retention_days: number;
  activity_log_retention_days: number;
  privacy_request_retention_days: number;
  retention_run_retention_days: number;
  deletion_run_retention_days: number;
  legal_acceptance_retention_days: number;
  store_uploaded_xml_after_validation: boolean;
  retain_validation_reports: boolean;
  retain_vies_evidence: boolean;
  retain_webhook_payload_previews: boolean;
  allow_data_export_requests: boolean;
  allow_deletion_requests: boolean;
  include_api_logs_in_exports: boolean;
  include_webhook_logs_in_exports: boolean;
  include_legal_acceptances_in_exports: boolean;
  data_minimization_mode: string;
  privacy_contact_email: string;
  security_contact_email: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export class WorkspaceSettingsRepositoryError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "WorkspaceSettingsRepositoryError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const WORKSPACE_SETTINGS_SELECT_FIELDS =
  "organization_id, retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, xml_validation_job_retention_days, invoice_export_retention_days, api_request_log_retention_days, webhook_delivery_log_retention_days, vies_evidence_retention_days, vida_simulation_retention_days, activity_log_retention_days, privacy_request_retention_days, retention_run_retention_days, deletion_run_retention_days, legal_acceptance_retention_days, store_uploaded_xml_after_validation, retain_validation_reports, retain_vies_evidence, retain_webhook_payload_previews, allow_data_export_requests, allow_deletion_requests, include_api_logs_in_exports, include_webhook_logs_in_exports, include_legal_acceptances_in_exports, data_minimization_mode, privacy_contact_email, security_contact_email, updated_by, created_at, updated_at";

const WORKSPACE_SETTINGS_MANAGER_ROLES = new Set(["owner", "admin"]);

const defaultWorkspaceSettingsPayload: WorkspaceSettingsPayload = {
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
  legalAcceptanceRetentionDays: 2555,
  storeUploadedXmlAfterValidation: false,
  retainValidationReports: true,
  retainViesEvidence: true,
  retainWebhookPayloadPreviews: false,
  allowDataExportRequests: true,
  allowDeletionRequests: true,
  includeApiLogsInExports: true,
  includeWebhookLogsInExports: true,
  includeLegalAcceptancesInExports: true,
  dataMinimizationMode: "standard",
  privacyContactEmail: "",
  securityContactEmail: ""
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

function normalizeDataMinimizationMode(value: string): WorkspaceDataMinimizationMode {
  if (value === "reduced" || value === "strict") {
    return value;
  }

  return "standard";
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

function readBooleanField(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  const value = record[key];

  return typeof value === "boolean" ? value : fallback;
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
  const membershipRole = readStringField(value, "membership_role", "viewer");
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
  const record = row as unknown as Record<string, unknown>;

  return {
    retentionMode: normalizeRetentionMode(row.retention_mode),
    invoiceDraftRetentionDays: readNumberField(
      record,
      "invoice_draft_retention_days",
      defaultWorkspaceSettingsPayload.invoiceDraftRetentionDays
    ),
    validationRunRetentionDays: readNumberField(
      record,
      "validation_run_retention_days",
      defaultWorkspaceSettingsPayload.validationRunRetentionDays
    ),
    xmlReportRetentionDays: readNumberField(
      record,
      "xml_report_retention_days",
      defaultWorkspaceSettingsPayload.xmlReportRetentionDays
    ),
    xmlValidationJobRetentionDays: readNumberField(
      record,
      "xml_validation_job_retention_days",
      defaultWorkspaceSettingsPayload.xmlValidationJobRetentionDays
    ),
    invoiceExportRetentionDays: readNumberField(
      record,
      "invoice_export_retention_days",
      defaultWorkspaceSettingsPayload.invoiceExportRetentionDays
    ),
    apiRequestLogRetentionDays: readNumberField(
      record,
      "api_request_log_retention_days",
      defaultWorkspaceSettingsPayload.apiRequestLogRetentionDays
    ),
    webhookDeliveryLogRetentionDays: readNumberField(
      record,
      "webhook_delivery_log_retention_days",
      defaultWorkspaceSettingsPayload.webhookDeliveryLogRetentionDays
    ),
    viesEvidenceRetentionDays: readNumberField(
      record,
      "vies_evidence_retention_days",
      defaultWorkspaceSettingsPayload.viesEvidenceRetentionDays
    ),
    vidaSimulationRetentionDays: readNumberField(
      record,
      "vida_simulation_retention_days",
      defaultWorkspaceSettingsPayload.vidaSimulationRetentionDays
    ),
    activityLogRetentionDays: readNumberField(
      record,
      "activity_log_retention_days",
      defaultWorkspaceSettingsPayload.activityLogRetentionDays
    ),
    privacyRequestRetentionDays: readNumberField(
      record,
      "privacy_request_retention_days",
      defaultWorkspaceSettingsPayload.privacyRequestRetentionDays
    ),
    retentionRunRetentionDays: readNumberField(
      record,
      "retention_run_retention_days",
      defaultWorkspaceSettingsPayload.retentionRunRetentionDays
    ),
    deletionRunRetentionDays: readNumberField(
      record,
      "deletion_run_retention_days",
      defaultWorkspaceSettingsPayload.deletionRunRetentionDays
    ),
    legalAcceptanceRetentionDays: readNumberField(
      record,
      "legal_acceptance_retention_days",
      defaultWorkspaceSettingsPayload.legalAcceptanceRetentionDays
    ),
    storeUploadedXmlAfterValidation: readBooleanField(
      record,
      "store_uploaded_xml_after_validation",
      defaultWorkspaceSettingsPayload.storeUploadedXmlAfterValidation
    ),
    retainValidationReports: readBooleanField(
      record,
      "retain_validation_reports",
      defaultWorkspaceSettingsPayload.retainValidationReports
    ),
    retainViesEvidence: readBooleanField(
      record,
      "retain_vies_evidence",
      defaultWorkspaceSettingsPayload.retainViesEvidence
    ),
    retainWebhookPayloadPreviews: readBooleanField(
      record,
      "retain_webhook_payload_previews",
      defaultWorkspaceSettingsPayload.retainWebhookPayloadPreviews
    ),
    allowDataExportRequests: readBooleanField(
      record,
      "allow_data_export_requests",
      defaultWorkspaceSettingsPayload.allowDataExportRequests
    ),
    allowDeletionRequests: readBooleanField(
      record,
      "allow_deletion_requests",
      defaultWorkspaceSettingsPayload.allowDeletionRequests
    ),
    includeApiLogsInExports: readBooleanField(
      record,
      "include_api_logs_in_exports",
      defaultWorkspaceSettingsPayload.includeApiLogsInExports
    ),
    includeWebhookLogsInExports: readBooleanField(
      record,
      "include_webhook_logs_in_exports",
      defaultWorkspaceSettingsPayload.includeWebhookLogsInExports
    ),
    includeLegalAcceptancesInExports: readBooleanField(
      record,
      "include_legal_acceptances_in_exports",
      defaultWorkspaceSettingsPayload.includeLegalAcceptancesInExports
    ),
    dataMinimizationMode: normalizeDataMinimizationMode(
      row.data_minimization_mode
    ),
    privacyContactEmail: row.privacy_contact_email,
    securityContactEmail: row.security_contact_email,
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
    xml_validation_job_retention_days: payload.xmlValidationJobRetentionDays,
    invoice_export_retention_days: payload.invoiceExportRetentionDays,
    api_request_log_retention_days: payload.apiRequestLogRetentionDays,
    webhook_delivery_log_retention_days: payload.webhookDeliveryLogRetentionDays,
    vies_evidence_retention_days: payload.viesEvidenceRetentionDays,
    vida_simulation_retention_days: payload.vidaSimulationRetentionDays,
    activity_log_retention_days: payload.activityLogRetentionDays,
    privacy_request_retention_days: payload.privacyRequestRetentionDays,
    retention_run_retention_days: payload.retentionRunRetentionDays,
    deletion_run_retention_days: payload.deletionRunRetentionDays,
    legal_acceptance_retention_days: payload.legalAcceptanceRetentionDays,
    store_uploaded_xml_after_validation: payload.storeUploadedXmlAfterValidation,
    retain_validation_reports: payload.retainValidationReports,
    retain_vies_evidence: payload.retainViesEvidence,
    retain_webhook_payload_previews: payload.retainWebhookPayloadPreviews,
    allow_data_export_requests: payload.allowDataExportRequests,
    allow_deletion_requests: payload.allowDeletionRequests,
    include_api_logs_in_exports: payload.includeApiLogsInExports,
    include_webhook_logs_in_exports: payload.includeWebhookLogsInExports,
    include_legal_acceptances_in_exports: payload.includeLegalAcceptancesInExports,
    data_minimization_mode: payload.dataMinimizationMode,
    privacy_contact_email: payload.privacyContactEmail,
    security_contact_email: payload.securityContactEmail,
    updated_by: userId
  };
}

async function getWorkspaceForAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("bootstrap_personal_workspace");

  if (error) {
    throw new WorkspaceSettingsRepositoryError(
      "WORKSPACE_CONTEXT_UNAVAILABLE",
      `Workspace bootstrap failed: ${error.message}`,
      503
    );
  }

  const firstRecord = Array.isArray(data) ? data[0] : data;
  const workspace = normalizeWorkspaceBootstrapRecord(firstRecord);

  if (!workspace) {
    throw new WorkspaceSettingsRepositoryError(
      "WORKSPACE_CONTEXT_REQUIRED",
      "Workspace bootstrap returned an unreadable record.",
      409
    );
  }

  return workspace;
}

function createAuthenticatedSupabaseClient(
  context: AuthenticatedWorkspaceSettingsContext
) {
  return getSupabaseUserClient(context.accessToken);
}

function assertCanManageWorkspaceSettings(
  workspace: SupabaseWorkspaceBootstrapRecord
) {
  if (WORKSPACE_SETTINGS_MANAGER_ROLES.has(workspace.membershipRole)) {
    return;
  }

  throw new WorkspaceSettingsRepositoryError(
    "WORKSPACE_SETTINGS_MANAGER_ROLE_REQUIRED",
    "Workspace privacy and retention settings require an organization owner or admin role.",
    403
  );
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
      xmlValidationJobRetentionDays: payload.xmlValidationJobRetentionDays,
      invoiceExportRetentionDays: payload.invoiceExportRetentionDays,
      apiRequestLogRetentionDays: payload.apiRequestLogRetentionDays,
      webhookDeliveryLogRetentionDays: payload.webhookDeliveryLogRetentionDays,
      viesEvidenceRetentionDays: payload.viesEvidenceRetentionDays,
      vidaSimulationRetentionDays: payload.vidaSimulationRetentionDays,
      activityLogRetentionDays: payload.activityLogRetentionDays,
      privacyRequestRetentionDays: payload.privacyRequestRetentionDays,
      retentionRunRetentionDays: payload.retentionRunRetentionDays,
      deletionRunRetentionDays: payload.deletionRunRetentionDays,
      legalAcceptanceRetentionDays: payload.legalAcceptanceRetentionDays,
      storeUploadedXmlAfterValidation: payload.storeUploadedXmlAfterValidation,
      retainValidationReports: payload.retainValidationReports,
      retainViesEvidence: payload.retainViesEvidence,
      retainWebhookPayloadPreviews: payload.retainWebhookPayloadPreviews,
      allowDataExportRequests: payload.allowDataExportRequests,
      allowDeletionRequests: payload.allowDeletionRequests,
      includeApiLogsInExports: payload.includeApiLogsInExports,
      includeWebhookLogsInExports: payload.includeWebhookLogsInExports,
      includeLegalAcceptancesInExports: payload.includeLegalAcceptancesInExports,
      dataMinimizationMode: payload.dataMinimizationMode,
      privacyContactEmailConfigured: payload.privacyContactEmail.length > 0,
      securityContactEmailConfigured: payload.securityContactEmail.length > 0
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

  assertCanManageWorkspaceSettings(workspace);

  const { data, error } = await supabase
    .from("workspace_settings")
    .select(WORKSPACE_SETTINGS_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (error) {
    throw new WorkspaceSettingsRepositoryError(
      "WORKSPACE_SETTINGS_READ_FAILED",
      `Could not read workspace settings: ${error.message}`,
      500
    );
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
    throw new WorkspaceSettingsRepositoryError(
      "WORKSPACE_SETTINGS_CREATE_FAILED",
      `Could not create workspace settings: ${insertError.message}`,
      500
    );
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

  assertCanManageWorkspaceSettings(workspace);

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
    throw new WorkspaceSettingsRepositoryError(
      "WORKSPACE_SETTINGS_SAVE_FAILED",
      `Could not save workspace settings: ${error.message}`,
      500
    );
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
