import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspaceExportPackageType = "full_workspace";
export type WorkspaceExportPackageStatus = "prepared" | "failed";
export type WorkspaceExportPackageFormat = "json";

export type WorkspaceExportPackageRecordCounts = {
  invoiceDrafts: number;
  validationRuns: number;
  xmlReadinessReports: number;
  workspaceSettings: number;
  privacyRequests: number;
  activityEvents: number;
};

export type WorkspaceExportPackagePayload = {
  exportVersion: "1.0";
  generatedAt: string;
  packageType: WorkspaceExportPackageType;
  exportFormat: WorkspaceExportPackageFormat;
  workspace: {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    membershipRole: string;
    userEmail: string;
  };
  recordCounts: WorkspaceExportPackageRecordCounts;
  data: {
    invoiceDrafts: unknown[];
    validationRuns: unknown[];
    xmlReadinessReports: unknown[];
    workspaceSettings: unknown[];
    privacyRequests: unknown[];
    activityEvents: unknown[];
  };
  disclaimer: string;
};

export type WorkspaceExportPackageRecord = {
  id: string;
  packageType: WorkspaceExportPackageType;
  status: WorkspaceExportPackageStatus;
  exportName: string;
  exportFormat: WorkspaceExportPackageFormat;
  sourcePrivacyRequestId: string;
  recordCounts: WorkspaceExportPackageRecordCounts;
  packagePayload: WorkspaceExportPackagePayload | null;
  packageSizeBytes: number;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceExportPackageCreatePayload = {
  exportName: string;
  sourcePrivacyRequestId?: string;
};

export type AuthenticatedWorkspaceExportPackageContext = {
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

type SupabaseWorkspaceExportPackageRow = {
  id: string;
  organization_id: string;
  requested_by: string;
  source_privacy_request_id: string | null;
  package_type: string;
  status: string;
  export_name: string;
  export_format: string;
  record_counts: unknown;
  package_payload: unknown;
  package_size_bytes: number | string;
  error_message: string;
  created_at: string;
  updated_at: string;
};

const MAX_EXPORT_PACKAGES = 100;
const MAX_EXPORTED_RECORDS_PER_COLLECTION = 1000;

const WORKSPACE_EXPORT_PACKAGE_SELECT_FIELDS =
  "id, organization_id, requested_by, source_privacy_request_id, package_type, status, export_name, export_format, record_counts, package_payload, package_size_bytes, error_message, created_at, updated_at";

const INVOICE_DRAFT_EXPORT_SELECT_FIELDS =
  "id, organization_id, created_by, invoice_number, seller_name, seller_country, buyer_name, buyer_country, issue_date, due_date, invoice_type, profile, buyer_reference, contract_reference, currency, line_extension_amount, tax_exclusive_amount, tax_amount, tax_inclusive_amount, payable_amount, payload, summary, created_at, updated_at";

const VALIDATION_RUN_EXPORT_SELECT_FIELDS =
  "id, organization_id, created_by, invoice_number, buyer_name, seller_name, profile, issue_date, seller_country, buyer_country, technical_status, standard_status, country_simulation_status, vida_readiness_status, confidence, currency, findings_count, payable_amount, totals, findings, payload, disclaimer, created_at, updated_at";

const XML_REPORT_EXPORT_SELECT_FIELDS =
  "id, organization_id, created_by, file_name, file_size, detected_document, root_element, invoice_id, issue_date, currency, api_status, status, note, technical_status, readiness_status, document_status, calculation_status, profile_status, extracted_data, findings, findings_count, seller_name, buyer_name, line_count, payable_amount, tax_amount, summary, disclaimer, uploaded_at, created_at, updated_at";

const WORKSPACE_SETTINGS_EXPORT_SELECT_FIELDS =
  "organization_id, retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, activity_log_retention_days, allow_data_export_requests, allow_deletion_requests, updated_by, created_at, updated_at";

const PRIVACY_REQUEST_EXPORT_SELECT_FIELDS =
  "id, organization_id, requester_user_id, request_type, status, subject, details, requester_email, reviewer_user_id, review_note, completed_at, created_at, updated_at";

const ACTIVITY_EVENT_EXPORT_SELECT_FIELDS =
  "id, organization_id, actor_user_id, event_type, entity_type, entity_id, entity_label, severity, source, metadata, created_at";

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
  fallback = 0
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

function normalizePackageType(value: string): WorkspaceExportPackageType {
  return value === "full_workspace" ? "full_workspace" : "full_workspace";
}

function normalizePackageStatus(value: string): WorkspaceExportPackageStatus {
  return value === "failed" ? "failed" : "prepared";
}

function normalizePackageFormat(value: string): WorkspaceExportPackageFormat {
  return value === "json" ? "json" : "json";
}

function normalizeRecordCounts(value: unknown): WorkspaceExportPackageRecordCounts {
  if (!isPlainObject(value)) {
    return {
      invoiceDrafts: 0,
      validationRuns: 0,
      xmlReadinessReports: 0,
      workspaceSettings: 0,
      privacyRequests: 0,
      activityEvents: 0
    };
  }

  return {
    invoiceDrafts: readNumberField(value, "invoiceDrafts"),
    validationRuns: readNumberField(value, "validationRuns"),
    xmlReadinessReports: readNumberField(value, "xmlReadinessReports"),
    workspaceSettings: readNumberField(value, "workspaceSettings"),
    privacyRequests: readNumberField(value, "privacyRequests"),
    activityEvents: readNumberField(value, "activityEvents")
  };
}

function normalizePackagePayload(
  value: unknown
): WorkspaceExportPackagePayload | null {
  if (!isPlainObject(value)) {
    return null;
  }

  return value as WorkspaceExportPackagePayload;
}

function normalizeWorkspaceExportPackageRow(
  row: SupabaseWorkspaceExportPackageRow
): WorkspaceExportPackageRecord {
  return {
    id: row.id,
    packageType: normalizePackageType(row.package_type),
    status: normalizePackageStatus(row.status),
    exportName: row.export_name,
    exportFormat: normalizePackageFormat(row.export_format),
    sourcePrivacyRequestId: row.source_privacy_request_id ?? "",
    recordCounts: normalizeRecordCounts(row.record_counts),
    packagePayload: normalizePackagePayload(row.package_payload),
    packageSizeBytes: readNumberField(
      row as unknown as Record<string, unknown>,
      "package_size_bytes"
    ),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createAuthenticatedSupabaseClient(
  context: AuthenticatedWorkspaceExportPackageContext
) {
  return getSupabaseUserClient(context.accessToken);
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

async function readWorkspaceCollection({
  supabase,
  tableName,
  selectFields,
  organizationId,
  orderColumn
}: {
  supabase: SupabaseClient;
  tableName: string;
  selectFields: string;
  organizationId: string;
  orderColumn: string;
}) {
  const { data, error } = await supabase
    .from(tableName)
    .select(selectFields)
    .eq("organization_id", organizationId)
    .order(orderColumn, {
      ascending: false
    })
    .limit(MAX_EXPORTED_RECORDS_PER_COLLECTION);

  if (error) {
    throw new Error(`Could not read ${tableName} for export: ${error.message}`);
  }

  return data ?? [];
}

function buildRecordCounts(data: WorkspaceExportPackagePayload["data"]) {
  return {
    invoiceDrafts: data.invoiceDrafts.length,
    validationRuns: data.validationRuns.length,
    xmlReadinessReports: data.xmlReadinessReports.length,
    workspaceSettings: data.workspaceSettings.length,
    privacyRequests: data.privacyRequests.length,
    activityEvents: data.activityEvents.length
  };
}

function calculateJsonByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function buildExportPayload({
  workspace,
  exportData
}: {
  workspace: SupabaseWorkspaceBootstrapRecord;
  exportData: WorkspaceExportPackagePayload["data"];
}): WorkspaceExportPackagePayload {
  const recordCounts = buildRecordCounts(exportData);

  return {
    exportVersion: "1.0",
    generatedAt: new Date().toISOString(),
    packageType: "full_workspace",
    exportFormat: "json",
    workspace: {
      organizationId: workspace.organizationId,
      organizationName: workspace.organizationName,
      organizationSlug: workspace.organizationSlug,
      membershipRole: workspace.membershipRole,
      userEmail: workspace.userEmail
    },
    recordCounts,
    data: exportData,
    disclaimer:
      "This export package contains workspace data available to the signed-in user through Invoice Lantern. It is not a legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority record."
  };
}

function buildSupabaseExportPackageValues({
  payload,
  workspace,
  userId,
  packagePayload
}: {
  payload: WorkspaceExportPackageCreatePayload;
  workspace: SupabaseWorkspaceBootstrapRecord;
  userId: string;
  packagePayload: WorkspaceExportPackagePayload;
}) {
  return {
    organization_id: workspace.organizationId,
    requested_by: userId,
    source_privacy_request_id: payload.sourcePrivacyRequestId || null,
    package_type: "full_workspace",
    status: "prepared",
    export_name: payload.exportName,
    export_format: "json",
    record_counts: packagePayload.recordCounts,
    package_payload: packagePayload,
    package_size_bytes: calculateJsonByteLength(packagePayload),
    error_message: ""
  };
}

async function insertExportPackageActivityEvent({
  supabase,
  organizationId,
  userId,
  record
}: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  record: WorkspaceExportPackageRecord;
}) {
  await supabase.from("workspace_activity_events").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    event_type: "workspace_export_package.created",
    entity_type: "workspace_export_package",
    entity_id: record.id,
    entity_label: record.exportName,
    severity: "info",
    source: "api",
    metadata: {
      exportName: record.exportName,
      packageType: record.packageType,
      exportFormat: record.exportFormat,
      packageSizeBytes: record.packageSizeBytes,
      recordCounts: record.recordCounts,
      sourcePrivacyRequestId: record.sourcePrivacyRequestId
    }
  });
}

export function hasAuthenticatedWorkspaceExportPackageContext(
  context: AuthenticatedWorkspaceExportPackageContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function listAuthenticatedWorkspaceExportPackages(
  context: AuthenticatedWorkspaceExportPackageContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("workspace_export_packages")
    .select(WORKSPACE_EXPORT_PACKAGE_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(MAX_EXPORT_PACKAGES);

  if (error) {
    throw new Error(`Could not list export packages: ${error.message}`);
  }

  return ((data ?? []) as SupabaseWorkspaceExportPackageRow[]).map((row) =>
    normalizeWorkspaceExportPackageRow(row)
  );
}

export async function getAuthenticatedWorkspaceExportPackageById(
  context: AuthenticatedWorkspaceExportPackageContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("workspace_export_packages")
    .select(WORKSPACE_EXPORT_PACKAGE_SELECT_FIELDS)
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read export package: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return normalizeWorkspaceExportPackageRow(
    data as SupabaseWorkspaceExportPackageRow
  );
}

export async function createAuthenticatedWorkspaceExportPackage(
  context: AuthenticatedWorkspaceExportPackageContext,
  payload: WorkspaceExportPackageCreatePayload
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const exportData: WorkspaceExportPackagePayload["data"] = {
    invoiceDrafts: await readWorkspaceCollection({
      supabase,
      tableName: "invoice_drafts",
      selectFields: INVOICE_DRAFT_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "updated_at"
    }),
    validationRuns: await readWorkspaceCollection({
      supabase,
      tableName: "validation_runs",
      selectFields: VALIDATION_RUN_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "created_at"
    }),
    xmlReadinessReports: await readWorkspaceCollection({
      supabase,
      tableName: "xml_readiness_reports",
      selectFields: XML_REPORT_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "uploaded_at"
    }),
    workspaceSettings: await readWorkspaceCollection({
      supabase,
      tableName: "workspace_settings",
      selectFields: WORKSPACE_SETTINGS_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "updated_at"
    }),
    privacyRequests: await readWorkspaceCollection({
      supabase,
      tableName: "workspace_privacy_requests",
      selectFields: PRIVACY_REQUEST_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "created_at"
    }),
    activityEvents: await readWorkspaceCollection({
      supabase,
      tableName: "workspace_activity_events",
      selectFields: ACTIVITY_EVENT_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "created_at"
    })
  };

  const packagePayload = buildExportPayload({
    workspace,
    exportData
  });

  const { data, error } = await supabase
    .from("workspace_export_packages")
    .insert(
      buildSupabaseExportPackageValues({
        payload,
        workspace,
        userId: context.userId,
        packagePayload
      })
    )
    .select(WORKSPACE_EXPORT_PACKAGE_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create export package: ${error.message}`);
  }

  const record = normalizeWorkspaceExportPackageRow(
    data as SupabaseWorkspaceExportPackageRow
  );

  try {
    await insertExportPackageActivityEvent({
      supabase,
      organizationId: workspace.organizationId,
      userId: context.userId,
      record
    });
  } catch {
    /*
     * Export package creation should not fail only because activity logging
     * failed. Activity logging can be repaired independently.
     */
  }

  return record;
}
