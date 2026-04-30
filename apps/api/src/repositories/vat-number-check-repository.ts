import { createHash, createHmac, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type VatNumberCheckPartyRole = "seller" | "buyer" | "other";

export type VatNumberCheckRecord = {
  id: string;
  organizationId: string;
  invoiceDraftId: string | null;
  validationRunId: string | null;
  partyRole: VatNumberCheckPartyRole | null;
  inputCountryHint: string | null;
  detectedCountryCode: string | null;
  normalizedVatId: string;
  vatIdFingerprint: string;
  checkLevel: "local_format";
  source: "invoice_lantern_vat_format_rules";
  formatValid: boolean;
  message: string;
  warnings: string[];
  disclaimer: string;
  checkedBy: string | null;
  createdAt: string;
};

export type CreateVatNumberCheckRecordInput = {
  invoiceDraftId?: string | null;
  validationRunId?: string | null;
  partyRole?: VatNumberCheckPartyRole | null;
  inputCountryHint?: string | null;
  detectedCountryCode?: string | null;
  normalizedVatId: string;
  formatValid: boolean;
  message: string;
  warnings: string[];
  disclaimer: string;
};

export type VatNumberCheckListFilters = {
  invoiceDraftId?: string | undefined;
  validationRunId?: string | undefined;
  partyRole?: VatNumberCheckPartyRole | undefined;
  limit?: number | undefined;
};

export type AuthenticatedVatNumberCheckContext = {
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

type SupabaseVatNumberCheckRow = {
  id: string;
  organization_id: string;
  invoice_draft_id: string | null;
  validation_run_id: string | null;
  party_role: string | null;
  input_country_hint: string | null;
  detected_country_code: string | null;
  normalized_vat_id: string;
  vat_id_fingerprint: string;
  check_level: string;
  source: string;
  format_valid: boolean;
  message: string;
  warnings: unknown;
  disclaimer: string;
  checked_by: string | null;
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

const VAT_NUMBER_CHECKS_FILE = "vat-number-checks.json";
const MAX_STORED_VAT_NUMBER_CHECKS = 250;
const DEFAULT_CHECK_LIMIT = 25;
const MAX_CHECK_LIMIT = 100;
const LOCAL_ORGANIZATION_ID = "local";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VAT_NUMBER_CHECK_SELECT_FIELDS =
  "id, organization_id, invoice_draft_id, validation_run_id, party_role, input_country_hint, detected_country_code, normalized_vat_id, vat_id_fingerprint, check_level, source, format_valid, message, warnings, disclaimer, checked_by, created_at";

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

function normalizePartyRole(value: string | null | undefined) {
  if (value === "seller" || value === "buyer" || value === "other") {
    return value;
  }

  return null;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalId(value: string | null | undefined) {
  return normalizeOptionalText(value);
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isInteger(limit) || !limit) {
    return DEFAULT_CHECK_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_CHECK_LIMIT);
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSupabaseVatNumberCheckRow(
  row: SupabaseVatNumberCheckRow
): VatNumberCheckRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    invoiceDraftId: row.invoice_draft_id,
    validationRunId: row.validation_run_id,
    partyRole: normalizePartyRole(row.party_role),
    inputCountryHint: row.input_country_hint,
    detectedCountryCode: row.detected_country_code,
    normalizedVatId: row.normalized_vat_id,
    vatIdFingerprint: row.vat_id_fingerprint,
    checkLevel: "local_format",
    source: "invoice_lantern_vat_format_rules",
    formatValid: row.format_valid,
    message: row.message,
    warnings: normalizeWarnings(row.warnings),
    disclaimer: row.disclaimer,
    checkedBy: row.checked_by,
    createdAt: row.created_at
  };
}

function sortVatNumberChecksByCreatedAt(records: VatNumberCheckRecord[]) {
  return [...records].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt)
  );
}

function buildLocalVatNumberCheckRecord(
  input: CreateVatNumberCheckRecordInput
): VatNumberCheckRecord {
  return {
    id: `vat_check_${randomUUID()}`,
    organizationId: LOCAL_ORGANIZATION_ID,
    invoiceDraftId: normalizeOptionalId(input.invoiceDraftId),
    validationRunId: normalizeOptionalId(input.validationRunId),
    partyRole: normalizePartyRole(input.partyRole),
    inputCountryHint: normalizeOptionalText(input.inputCountryHint),
    detectedCountryCode: normalizeOptionalText(input.detectedCountryCode),
    normalizedVatId: input.normalizedVatId,
    vatIdFingerprint: createVatIdFingerprint(input.normalizedVatId),
    checkLevel: "local_format",
    source: "invoice_lantern_vat_format_rules",
    formatValid: input.formatValid,
    message: input.message,
    warnings: normalizeWarnings(input.warnings),
    disclaimer: input.disclaimer,
    checkedBy: null,
    createdAt: new Date().toISOString()
  };
}

function buildSupabaseVatNumberCheckValues(
  input: CreateVatNumberCheckRecordInput,
  organizationId: string,
  userId: string,
  invoiceDraftId: string | null,
  validationRunId: string | null
) {
  return {
    organization_id: organizationId,
    invoice_draft_id: invoiceDraftId,
    validation_run_id: validationRunId,
    party_role: normalizePartyRole(input.partyRole),
    input_country_hint: normalizeOptionalText(input.inputCountryHint),
    detected_country_code: normalizeOptionalText(input.detectedCountryCode),
    normalized_vat_id: input.normalizedVatId,
    vat_id_fingerprint: createVatIdFingerprint(input.normalizedVatId),
    check_level: "local_format",
    source: "invoice_lantern_vat_format_rules",
    format_valid: input.formatValid,
    message: input.message,
    warnings: normalizeWarnings(input.warnings),
    disclaimer: input.disclaimer,
    checked_by: userId
  };
}

function buildVatNumberCheckActivityMetadata(record: VatNumberCheckRecord) {
  return {
    invoiceDraftId: record.invoiceDraftId,
    validationRunId: record.validationRunId,
    partyRole: record.partyRole,
    inputCountryHint: record.inputCountryHint,
    detectedCountryCode: record.detectedCountryCode,
    checkLevel: record.checkLevel,
    source: record.source,
    formatValid: record.formatValid,
    warningCount: record.warnings.length
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
  context: AuthenticatedVatNumberCheckContext
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
     * Activity logging must not break VAT check evidence persistence.
     * The vat_number_checks row remains the authoritative record.
     */
    console.warn(`Workspace activity event was not recorded: ${error.message}`);
  }
}

export function hasAuthenticatedVatNumberCheckContext(
  context: AuthenticatedVatNumberCheckContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export function createVatIdFingerprint(normalizedVatId: string) {
  const fingerprintInput = normalizedVatId.trim().toUpperCase();
  const hmacSecret = env.VAT_FINGERPRINT_SECRET.trim();

  if (hmacSecret) {
    return createHmac("sha256", hmacSecret)
      .update(fingerprintInput, "utf8")
      .digest("hex");
  }

  return createHash("sha256").update(fingerprintInput, "utf8").digest("hex");
}

export async function saveVatNumberCheckRecord(
  input: CreateVatNumberCheckRecordInput
) {
  const record = buildLocalVatNumberCheckRecord(input);
  const currentRecords =
    await storageProvider.readCollection<VatNumberCheckRecord>(
      VAT_NUMBER_CHECKS_FILE
    );

  const nextRecords = sortVatNumberChecksByCreatedAt([
    record,
    ...currentRecords.filter((existingRecord) => existingRecord.id !== record.id)
  ]).slice(0, MAX_STORED_VAT_NUMBER_CHECKS);

  await storageProvider.writeCollection(VAT_NUMBER_CHECKS_FILE, nextRecords);

  return record;
}

export async function listVatNumberCheckRecords(
  filters: VatNumberCheckListFilters = {}
) {
  const records = await storageProvider.readCollection<VatNumberCheckRecord>(
    VAT_NUMBER_CHECKS_FILE
  );
  const invoiceDraftId = filters.invoiceDraftId?.trim();
  const validationRunId = filters.validationRunId?.trim();
  const partyRole = filters.partyRole;
  const limit = normalizeLimit(filters.limit);

  return sortVatNumberChecksByCreatedAt(records)
    .filter((record) => {
      if (invoiceDraftId && record.invoiceDraftId !== invoiceDraftId) {
        return false;
      }

      if (validationRunId && record.validationRunId !== validationRunId) {
        return false;
      }

      if (partyRole && record.partyRole !== partyRole) {
        return false;
      }

      return true;
    })
    .slice(0, limit);
}

export async function saveAuthenticatedVatNumberCheckRecord(
  context: AuthenticatedVatNumberCheckContext,
  input: CreateVatNumberCheckRecordInput
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
    .from("vat_number_checks")
    .insert(
      buildSupabaseVatNumberCheckValues(
        input,
        workspace.organizationId,
        context.userId,
        invoiceDraftId,
        validationRunId
      )
    )
    .select(VAT_NUMBER_CHECK_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create Supabase VAT check: ${error.message}`);
  }

  const record = normalizeSupabaseVatNumberCheckRow(
    data as SupabaseVatNumberCheckRow
  );

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "vat.local_format_check.created",
    entityType: "vat_number_check",
    entityId: record.id,
    entityLabel: record.normalizedVatId || record.id,
    severity: record.formatValid ? "info" : "warning",
    metadata: buildVatNumberCheckActivityMetadata(record)
  });

  return record;
}

export async function listAuthenticatedVatNumberCheckRecords(
  context: AuthenticatedVatNumberCheckContext,
  filters: VatNumberCheckListFilters = {}
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const invoiceDraftId = normalizeOptionalId(filters.invoiceDraftId);
  const validationRunId = normalizeOptionalId(filters.validationRunId);
  const partyRole = filters.partyRole;
  const limit = normalizeLimit(filters.limit);

  let query = supabase
    .from("vat_number_checks")
    .select(VAT_NUMBER_CHECK_SELECT_FIELDS)
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

  if (partyRole) {
    query = query.eq("party_role", partyRole);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not list Supabase VAT checks: ${error.message}`);
  }

  return ((data ?? []) as SupabaseVatNumberCheckRow[]).map((row) =>
    normalizeSupabaseVatNumberCheckRow(row)
  );
}
