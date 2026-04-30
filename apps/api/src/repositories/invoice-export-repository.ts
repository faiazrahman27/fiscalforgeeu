import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type InvoiceExportStatus =
  | "generated"
  | "downloaded"
  | "failed"
  | "deleted";

export type InvoiceExportRecord = {
  id: string;
  invoiceDraftId: string | null;
  validationRunId: string | null;
  exportType: "ubl_invoice";
  format: "xml";
  profile: string;
  filename: string;
  contentType: string;
  xmlSha256: string;
  xmlSizeBytes: number;
  status: InvoiceExportStatus;
  disclaimer: string;
  createdAt: string;
};

export type CreateInvoiceExportRecordInput = {
  invoiceDraftId?: string | null;
  validationRunId?: string | null;
  exportType: "ubl_invoice";
  format: "xml";
  profile: string;
  filename: string;
  contentType: string;
  xmlSha256: string;
  xmlSizeBytes: number;
  status?: InvoiceExportStatus;
  disclaimer: string;
};

export type InvoiceExportListFilters = {
  invoiceDraftId?: string | undefined;
  validationRunId?: string | undefined;
  limit?: number | undefined;
};

export type AuthenticatedInvoiceExportContext = {
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

type SupabaseInvoiceExportRow = {
  id: string;
  organization_id: string;
  invoice_draft_id: string | null;
  validation_run_id: string | null;
  export_type: string;
  format: string;
  profile: string;
  filename: string;
  content_type: string;
  xml_sha256: string;
  xml_size_bytes: number;
  status: string;
  disclaimer: string;
  generated_by: string | null;
  created_at: string;
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

const INVOICE_EXPORTS_FILE = "invoice-exports.json";
const MAX_STORED_INVOICE_EXPORTS = 250;
const DEFAULT_EXPORT_LIMIT = 25;
const MAX_EXPORT_LIMIT = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVOICE_EXPORT_SELECT_FIELDS =
  "id, organization_id, invoice_draft_id, validation_run_id, export_type, format, profile, filename, content_type, xml_sha256, xml_size_bytes, status, disclaimer, generated_by, created_at";

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

function normalizeInvoiceExportStatus(value: string): InvoiceExportStatus {
  if (
    value === "downloaded" ||
    value === "failed" ||
    value === "deleted"
  ) {
    return value;
  }

  return "generated";
}

function normalizeSupabaseInvoiceExportRow(
  row: SupabaseInvoiceExportRow
): InvoiceExportRecord {
  return {
    id: row.id,
    invoiceDraftId: row.invoice_draft_id,
    validationRunId: row.validation_run_id,
    exportType: "ubl_invoice",
    format: "xml",
    profile: row.profile,
    filename: row.filename,
    contentType: row.content_type,
    xmlSha256: row.xml_sha256,
    xmlSizeBytes: row.xml_size_bytes,
    status: normalizeInvoiceExportStatus(row.status),
    disclaimer: row.disclaimer,
    createdAt: row.created_at
  };
}

function sortInvoiceExportsByCreatedAt(records: InvoiceExportRecord[]) {
  return [...records].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt)
  );
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isInteger(limit) || !limit) {
    return DEFAULT_EXPORT_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_EXPORT_LIMIT);
}

function normalizeOptionalId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function buildSupabaseInvoiceExportValues(
  input: CreateInvoiceExportRecordInput,
  organizationId: string,
  userId: string,
  invoiceDraftId: string | null,
  validationRunId: string | null
) {
  return {
    organization_id: organizationId,
    invoice_draft_id: invoiceDraftId,
    validation_run_id: validationRunId,
    export_type: input.exportType,
    format: input.format,
    profile: input.profile,
    filename: input.filename,
    content_type: input.contentType,
    xml_sha256: input.xmlSha256,
    xml_size_bytes: input.xmlSizeBytes,
    status: input.status ?? "generated",
    disclaimer: input.disclaimer,
    generated_by: userId
  };
}

function buildInvoiceExportActivityMetadata(record: InvoiceExportRecord) {
  return {
    invoiceDraftId: record.invoiceDraftId,
    validationRunId: record.validationRunId,
    exportType: record.exportType,
    format: record.format,
    profile: record.profile,
    filename: record.filename,
    contentType: record.contentType,
    xmlSha256: record.xmlSha256,
    xmlSizeBytes: record.xmlSizeBytes,
    status: record.status
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
  context: AuthenticatedInvoiceExportContext
) {
  return getSupabaseUserClient(context.accessToken);
}

async function resolveWorkspaceOwnedReference({
  supabase,
  organizationId,
  tableName,
  id,
  label
}: {
  supabase: SupabaseClient;
  organizationId: string;
  tableName: "invoice_drafts" | "validation_runs";
  id: string | null;
  label: string;
}) {
  if (!id) {
    return null;
  }

  if (!UUID_PATTERN.test(id)) {
    throw new Error(`Associated ${label} ID must be a database UUID.`);
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not verify associated ${label}: ${error.message}`);
  }

  if (!data || !isPlainObject(data) || readStringField(data, "id") !== id) {
    throw new Error(`Associated ${label} was not found in this workspace.`);
  }

  return id;
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
     * Activity logging must not break export metadata persistence.
     * The invoice_exports row is the authoritative export record.
     */
    console.warn(`Workspace activity event was not recorded: ${error.message}`);
  }
}

export function hasAuthenticatedInvoiceExportContext(
  context: AuthenticatedInvoiceExportContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function saveInvoiceExportRecord(
  input: CreateInvoiceExportRecordInput
): Promise<InvoiceExportRecord> {
  const now = new Date().toISOString();
  const record: InvoiceExportRecord = {
    id: `export_${randomUUID()}`,
    invoiceDraftId: normalizeOptionalId(input.invoiceDraftId),
    validationRunId: normalizeOptionalId(input.validationRunId),
    exportType: input.exportType,
    format: input.format,
    profile: input.profile,
    filename: input.filename,
    contentType: input.contentType,
    xmlSha256: input.xmlSha256,
    xmlSizeBytes: input.xmlSizeBytes,
    status: input.status ?? "generated",
    disclaimer: input.disclaimer,
    createdAt: now
  };

  const currentRecords =
    await storageProvider.readCollection<InvoiceExportRecord>(
      INVOICE_EXPORTS_FILE
    );

  const nextRecords = sortInvoiceExportsByCreatedAt([
    record,
    ...currentRecords.filter((existingRecord) => existingRecord.id !== record.id)
  ]).slice(0, MAX_STORED_INVOICE_EXPORTS);

  await storageProvider.writeCollection(INVOICE_EXPORTS_FILE, nextRecords);

  return record;
}

export async function listInvoiceExportRecords(
  filters: InvoiceExportListFilters = {}
) {
  const records = await storageProvider.readCollection<InvoiceExportRecord>(
    INVOICE_EXPORTS_FILE
  );

  const invoiceDraftId = filters.invoiceDraftId?.trim();
  const validationRunId = filters.validationRunId?.trim();
  const limit = normalizeLimit(filters.limit);

  return sortInvoiceExportsByCreatedAt(records)
    .filter((record) => {
      if (invoiceDraftId && record.invoiceDraftId !== invoiceDraftId) {
        return false;
      }

      if (validationRunId && record.validationRunId !== validationRunId) {
        return false;
      }

      return true;
    })
    .slice(0, limit);
}

export async function saveAuthenticatedInvoiceExportRecord(
  context: AuthenticatedInvoiceExportContext,
  input: CreateInvoiceExportRecordInput
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const invoiceDraftId = await resolveWorkspaceOwnedReference({
    supabase,
    organizationId: workspace.organizationId,
    tableName: "invoice_drafts",
    id: normalizeOptionalId(input.invoiceDraftId),
    label: "invoice draft"
  });

  const validationRunId = await resolveWorkspaceOwnedReference({
    supabase,
    organizationId: workspace.organizationId,
    tableName: "validation_runs",
    id: normalizeOptionalId(input.validationRunId),
    label: "validation run"
  });

  const { data, error } = await supabase
    .from("invoice_exports")
    .insert(
      buildSupabaseInvoiceExportValues(
        input,
        workspace.organizationId,
        context.userId,
        invoiceDraftId,
        validationRunId
      )
    )
    .select(INVOICE_EXPORT_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create Supabase invoice export: ${error.message}`);
  }

  const record = normalizeSupabaseInvoiceExportRow(
    data as SupabaseInvoiceExportRow
  );

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "invoice_export.generated",
    entityType: "invoice_export",
    entityId: record.id,
    entityLabel: record.filename || record.id,
    metadata: buildInvoiceExportActivityMetadata(record)
  });

  return record;
}

export async function listAuthenticatedInvoiceExportRecords(
  context: AuthenticatedInvoiceExportContext,
  filters: InvoiceExportListFilters = {}
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const invoiceDraftId = normalizeOptionalId(filters.invoiceDraftId);
  const validationRunId = normalizeOptionalId(filters.validationRunId);
  const limit = normalizeLimit(filters.limit);

  let query = supabase
    .from("invoice_exports")
    .select(INVOICE_EXPORT_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(limit);

  if (invoiceDraftId) {
    query = query.eq("invoice_draft_id", invoiceDraftId);
  }

  if (validationRunId) {
    query = query.eq("validation_run_id", validationRunId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not list Supabase invoice exports: ${error.message}`);
  }

  return ((data ?? []) as SupabaseInvoiceExportRow[]).map((row) =>
    normalizeSupabaseInvoiceExportRow(row)
  );
}
