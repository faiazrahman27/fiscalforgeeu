import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspaceDeletionRunStatus = "prepared" | "executed" | "failed";

export type WorkspaceDeletionRunRecordCounts = {
  invoiceDrafts: number;
  validationRuns: number;
  xmlReadinessReports: number;
  workspaceExportPackages: number;
  activityEvents: number;
  productionInvoices: number;
  businessProfiles: number;
  contacts: number;
  invoiceExports: number;
  vatNumberChecks: number;
  xmlValidationJobs: number;
  apiKeys: number;
  apiRequests: number;
  webhookEndpoints: number;
  webhookDeliveries: number;
  viesEvidenceChecks: number;
  vidaSimulationRuns: number;
  legalAcceptances: number;
  privacyRequestEvents: number;
  privacyAuditEvents: number;
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
  warnings: string[];
  disclaimer: string;
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

type SupabaseWorkspacePrivacyRequestRow = {
  id: string;
  organization_id: string;
  request_type: string;
  status: string;
  subject: string;
};

type DeletionDatasetConfig = {
  responseKey: keyof WorkspaceDeletionRunRecordCounts;
  tableName: string;
  columnPrefix: string;
  preservedByDefault?: boolean;
  executionMode: "delete" | "revoke" | "disable_secrets" | "preserve";
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
  "id, organization_id, source_privacy_request_id, initiated_by, run_type, status, invoice_draft_affected_count, validation_run_affected_count, xml_report_affected_count, workspace_export_package_affected_count, activity_event_affected_count, production_invoice_affected_count, business_profile_affected_count, contact_affected_count, invoice_export_affected_count, vat_number_check_affected_count, xml_validation_job_affected_count, api_key_affected_count, api_request_log_affected_count, webhook_endpoint_affected_count, webhook_delivery_affected_count, vies_evidence_affected_count, vida_simulation_affected_count, legal_acceptance_affected_count, privacy_request_event_affected_count, privacy_audit_event_affected_count, invoice_draft_executed_count, validation_run_executed_count, xml_report_executed_count, workspace_export_package_executed_count, activity_event_executed_count, production_invoice_executed_count, business_profile_executed_count, contact_executed_count, invoice_export_executed_count, vat_number_check_executed_count, xml_validation_job_executed_count, api_key_executed_count, api_request_log_executed_count, webhook_endpoint_executed_count, webhook_delivery_executed_count, vies_evidence_executed_count, vida_simulation_executed_count, legal_acceptance_executed_count, privacy_request_event_executed_count, privacy_audit_event_executed_count, error_message, executed_at, created_at, updated_at";

const WORKSPACE_PRIVACY_REQUEST_SELECT_FIELDS =
  "id, organization_id, request_type, status, subject";

export const DELETION_RUN_DATASETS: readonly DeletionDatasetConfig[] = [
  {
    responseKey: "invoiceDrafts",
    tableName: "invoice_drafts",
    columnPrefix: "invoice_draft",
    executionMode: "delete"
  },
  {
    responseKey: "validationRuns",
    tableName: "validation_runs",
    columnPrefix: "validation_run",
    executionMode: "delete"
  },
  {
    responseKey: "xmlReadinessReports",
    tableName: "xml_readiness_reports",
    columnPrefix: "xml_report",
    executionMode: "delete"
  },
  {
    responseKey: "workspaceExportPackages",
    tableName: "workspace_export_packages",
    columnPrefix: "workspace_export_package",
    executionMode: "delete"
  },
  {
    responseKey: "activityEvents",
    tableName: "workspace_activity_events",
    columnPrefix: "activity_event",
    executionMode: "preserve",
    preservedByDefault: true
  },
  {
    responseKey: "productionInvoices",
    tableName: "invoices",
    columnPrefix: "production_invoice",
    executionMode: "delete"
  },
  {
    responseKey: "businessProfiles",
    tableName: "business_profiles",
    columnPrefix: "business_profile",
    executionMode: "delete"
  },
  {
    responseKey: "contacts",
    tableName: "contacts",
    columnPrefix: "contact",
    executionMode: "delete"
  },
  {
    responseKey: "invoiceExports",
    tableName: "invoice_exports",
    columnPrefix: "invoice_export",
    executionMode: "delete"
  },
  {
    responseKey: "vatNumberChecks",
    tableName: "vat_number_checks",
    columnPrefix: "vat_number_check",
    executionMode: "delete"
  },
  {
    responseKey: "xmlValidationJobs",
    tableName: "xml_validation_jobs",
    columnPrefix: "xml_validation_job",
    executionMode: "delete"
  },
  {
    responseKey: "apiKeys",
    tableName: "api_keys",
    columnPrefix: "api_key",
    executionMode: "revoke"
  },
  {
    responseKey: "apiRequests",
    tableName: "api_requests",
    columnPrefix: "api_request_log",
    executionMode: "delete"
  },
  {
    responseKey: "webhookEndpoints",
    tableName: "webhook_endpoints",
    columnPrefix: "webhook_endpoint",
    executionMode: "disable_secrets"
  },
  {
    responseKey: "webhookDeliveries",
    tableName: "webhook_deliveries",
    columnPrefix: "webhook_delivery",
    executionMode: "delete"
  },
  {
    responseKey: "viesEvidenceChecks",
    tableName: "vies_evidence_checks",
    columnPrefix: "vies_evidence",
    executionMode: "delete"
  },
  {
    responseKey: "vidaSimulationRuns",
    tableName: "vida_simulation_runs",
    columnPrefix: "vida_simulation",
    executionMode: "delete"
  },
  {
    responseKey: "legalAcceptances",
    tableName: "legal_document_acceptances",
    columnPrefix: "legal_acceptance",
    executionMode: "preserve",
    preservedByDefault: true
  },
  {
    responseKey: "privacyRequestEvents",
    tableName: "privacy_request_events",
    columnPrefix: "privacy_request_event",
    executionMode: "preserve",
    preservedByDefault: true
  },
  {
    responseKey: "privacyAuditEvents",
    tableName: "workspace_privacy_audit_events",
    columnPrefix: "privacy_audit_event",
    executionMode: "preserve",
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

function readNumberField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? Math.max(0, Math.round(parsedValue)) : 0;
  }

  return 0;
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

function emptyCounts(): WorkspaceDeletionRunRecordCounts {
  return {
    invoiceDrafts: 0,
    validationRuns: 0,
    xmlReadinessReports: 0,
    workspaceExportPackages: 0,
    activityEvents: 0,
    productionInvoices: 0,
    businessProfiles: 0,
    contacts: 0,
    invoiceExports: 0,
    vatNumberChecks: 0,
    xmlValidationJobs: 0,
    apiKeys: 0,
    apiRequests: 0,
    webhookEndpoints: 0,
    webhookDeliveries: 0,
    viesEvidenceChecks: 0,
    vidaSimulationRuns: 0,
    legalAcceptances: 0,
    privacyRequestEvents: 0,
    privacyAuditEvents: 0
  };
}

function readCounts(
  row: Record<string, unknown>,
  suffix: "affected_count" | "executed_count"
): WorkspaceDeletionRunRecordCounts {
  const counts = emptyCounts();

  for (const dataset of DELETION_RUN_DATASETS) {
    counts[dataset.responseKey] = readNumberField(
      row,
      `${dataset.columnPrefix}_${suffix}`
    );
  }

  return counts;
}

function sumCounts(counts: WorkspaceDeletionRunRecordCounts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function getDeletionWarnings() {
  return [
    "Deletion execution is destructive for eligible workspace data and must be preceded by a prepared review.",
    "Public legal documents, platform rule sources, country packs, and platform-level rule metadata are not deleted by workspace deletion runs.",
    "Webhook endpoint secrets are nulled and endpoints are disabled instead of exposing raw secret material.",
    "API keys are revoked or minimized instead of exporting or revealing key hashes or full secrets.",
    ...DELETION_RUN_DATASETS.filter((dataset) => dataset.preservedByDefault).map(
      (dataset) =>
        `${dataset.tableName} is counted for review, but required privacy, legal, security, or audit evidence is preserved by default.`
    )
  ];
}

function normalizeDeletionRunRow(value: unknown): WorkspaceDeletionRunRecord {
  const row = isPlainObject(value) ? value : {};
  const affectedCounts = readCounts(row, "affected_count");
  const executedCounts = readCounts(row, "executed_count");

  return {
    id: readStringField(row, "id"),
    runType: "privacy_request_deletion",
    status: normalizeDeletionRunStatus(readStringField(row, "status")),
    sourcePrivacyRequestId: readStringField(row, "source_privacy_request_id"),
    affectedCounts,
    executedCounts,
    totalAffectedCount: sumCounts(affectedCounts),
    totalExecutedCount: sumCounts(executedCounts),
    warnings: getDeletionWarnings(),
    disclaimer:
      "Deletion runs are GDPR-aware privacy-support tooling only. They are not legal advice, privacy advice, tax advice, accounting advice, official filing advice, or a GDPR compliance guarantee.",
    errorMessage: readStringField(row, "error_message"),
    executedAt: readStringField(row, "executed_at"),
    createdAt: readStringField(row, "created_at"),
    updatedAt: readStringField(row, "updated_at")
  };
}

function normalizeRpcDeletionRunResult(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return isPlainObject(value) ? value : null;
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
      affectedCounts: record.affectedCounts,
      executionModes: DELETION_RUN_DATASETS.map((dataset) => ({
        dataset: dataset.responseKey,
        mode: dataset.executionMode
      })),
      legalAdvice: false,
      privacyComplianceGuarantee: false
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

  return (data ?? []).map((row) => normalizeDeletionRunRow(row));
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

  const insertValues: Record<string, unknown> = {
    organization_id: workspace.organizationId,
    source_privacy_request_id: sourcePrivacyRequest.id,
    initiated_by: context.userId,
    run_type: "privacy_request_deletion",
    status: "prepared"
  };

  await Promise.all(
    DELETION_RUN_DATASETS.map(async (dataset) => {
      insertValues[`${dataset.columnPrefix}_affected_count`] =
        await countWorkspaceRows({
          supabase,
          tableName: dataset.tableName,
          organizationId: workspace.organizationId
        });
    })
  );

  const { data, error } = await supabase
    .from("workspace_deletion_runs")
    .insert(insertValues)
    .select(WORKSPACE_DELETION_RUN_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create deletion run: ${error.message}`);
  }

  const record = normalizeDeletionRunRow(data);

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
