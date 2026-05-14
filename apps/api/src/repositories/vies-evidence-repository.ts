import { randomUUID } from "node:crypto";
import { getSupabaseServiceRoleClient, hasSupabaseServerConfig } from "../lib/supabase/server-client.js";
import { createVatIdFingerprint } from "./vat-number-check-repository.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export const VIES_EVIDENCE_STATUSES = [
  "valid",
  "invalid",
  "unavailable",
  "error",
  "not_checked",
  "unsupported",
  "rate_limited"
] as const;

export type ViesEvidenceStatus = (typeof VIES_EVIDENCE_STATUSES)[number];
export type ViesEvidenceRequestSource = "local_format" | "vies";
export type ViesEvidencePartyRole = "seller" | "buyer" | "other";

export type ViesEvidenceRecord = {
  id: string;
  organizationId: string;
  invoiceDraftId: string | null;
  validationRunId: string | null;
  partyRole: ViesEvidencePartyRole | null;
  countryCode: string;
  vatNumberNormalized: string;
  vatNumberDisplay: string;
  vatNumberFingerprint: string;
  requestSource: ViesEvidenceRequestSource;
  status: ViesEvidenceStatus;
  viesValid: boolean | null;
  viesName: string | null;
  viesAddress: string | null;
  requestIdentifier: string | null;
  checkedAt: string;
  sourceLabel: string;
  sourceUrl: string;
  responseTimeMs: number | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
  rawResponseHash: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
};

export type CreateViesEvidenceRecordInput = {
  organizationId: string;
  invoiceDraftId?: string | null;
  validationRunId?: string | null;
  partyRole?: ViesEvidencePartyRole | null;
  countryCode: string;
  vatNumberNormalized: string;
  vatNumberDisplay: string;
  requestSource: ViesEvidenceRequestSource;
  status: ViesEvidenceStatus;
  viesValid?: boolean | null;
  viesName?: string | null;
  viesAddress?: string | null;
  requestIdentifier?: string | null;
  checkedAt?: string;
  sourceLabel: string;
  sourceUrl: string;
  responseTimeMs?: number | null;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
  rawResponseHash?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export type CountViesEvidenceRecordsInput = {
  organizationId: string;
  vatNumberNormalized?: string;
  sinceIso: string;
};

export type GetLatestViesEvidenceRecordInput = {
  organizationId: string;
  countryCode: string;
  vatNumberNormalized: string;
};

type SupabaseViesEvidenceRow = {
  id: string;
  organization_id: string;
  invoice_draft_id: string | null;
  validation_run_id: string | null;
  party_role: string | null;
  country_code: string;
  vat_number_normalized: string;
  vat_number_display: string;
  vat_number_fingerprint: string;
  request_source: string;
  status: string;
  vies_valid: boolean | null;
  vies_name: string | null;
  vies_address: string | null;
  request_identifier: string | null;
  checked_at: string;
  source_label: string;
  source_url: string;
  response_time_ms: number | null;
  error_code: string | null;
  error_message_safe: string | null;
  raw_response_hash: string | null;
  metadata: unknown;
  created_by: string | null;
  created_at: string;
};

const VIES_EVIDENCE_CHECKS_FILE = "vies-evidence-checks.json";
const MAX_STORED_VIES_EVIDENCE_CHECKS = 500;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIES_EVIDENCE_SELECT_FIELDS =
  "id, organization_id, invoice_draft_id, validation_run_id, party_role, country_code, vat_number_normalized, vat_number_display, vat_number_fingerprint, request_source, status, vies_valid, vies_name, vies_address, request_identifier, checked_at, source_label, source_url, response_time_ms, error_code, error_message_safe, raw_response_hash, metadata, created_by, created_at";

const storageProvider = getCollectionStorageProvider();

function hasSupabaseOrganizationStorage(organizationId: string) {
  return hasSupabaseServerConfig() && UUID_PATTERN.test(organizationId);
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function normalizePartyRole(value: string | null | undefined) {
  if (value === "seller" || value === "buyer" || value === "other") {
    return value;
  }

  return null;
}

function normalizeStatus(value: string): ViesEvidenceStatus {
  return VIES_EVIDENCE_STATUSES.includes(value as ViesEvidenceStatus)
    ? (value as ViesEvidenceStatus)
    : "error";
}

function normalizeRequestSource(value: string): ViesEvidenceRequestSource {
  return value === "local_format" ? "local_format" : "vies";
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function sortViesEvidenceByCheckedAt(records: ViesEvidenceRecord[]) {
  return [...records].sort((first, second) =>
    second.checkedAt.localeCompare(first.checkedAt)
  );
}

function normalizeSupabaseViesEvidenceRow(
  row: SupabaseViesEvidenceRow
): ViesEvidenceRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    invoiceDraftId: row.invoice_draft_id,
    validationRunId: row.validation_run_id,
    partyRole: normalizePartyRole(row.party_role),
    countryCode: row.country_code,
    vatNumberNormalized: row.vat_number_normalized,
    vatNumberDisplay: row.vat_number_display,
    vatNumberFingerprint: row.vat_number_fingerprint,
    requestSource: normalizeRequestSource(row.request_source),
    status: normalizeStatus(row.status),
    viesValid: row.vies_valid,
    viesName: row.vies_name,
    viesAddress: row.vies_address,
    requestIdentifier: row.request_identifier,
    checkedAt: row.checked_at,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    responseTimeMs: row.response_time_ms,
    errorCode: row.error_code,
    errorMessageSafe: row.error_message_safe,
    rawResponseHash: row.raw_response_hash,
    metadata: normalizeMetadata(row.metadata),
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function buildLocalViesEvidenceRecord(
  input: CreateViesEvidenceRecordInput
): ViesEvidenceRecord {
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const vatNumberNormalized = input.vatNumberNormalized.trim().toUpperCase();

  return {
    id: `vies_${randomUUID()}`,
    organizationId: input.organizationId,
    invoiceDraftId: normalizeOptionalText(input.invoiceDraftId),
    validationRunId: normalizeOptionalText(input.validationRunId),
    partyRole: normalizePartyRole(input.partyRole),
    countryCode: input.countryCode.trim().toUpperCase(),
    vatNumberNormalized,
    vatNumberDisplay: input.vatNumberDisplay.trim().toUpperCase(),
    vatNumberFingerprint: createVatIdFingerprint(vatNumberNormalized),
    requestSource: input.requestSource,
    status: input.status,
    viesValid: input.viesValid ?? null,
    viesName: normalizeOptionalText(input.viesName),
    viesAddress: normalizeOptionalText(input.viesAddress),
    requestIdentifier: normalizeOptionalText(input.requestIdentifier),
    checkedAt,
    sourceLabel: input.sourceLabel,
    sourceUrl: input.sourceUrl,
    responseTimeMs: input.responseTimeMs ?? null,
    errorCode: normalizeOptionalText(input.errorCode),
    errorMessageSafe: normalizeOptionalText(input.errorMessageSafe),
    rawResponseHash: normalizeOptionalText(input.rawResponseHash),
    metadata: input.metadata ?? {},
    createdBy: normalizeOptionalText(input.createdBy),
    createdAt: checkedAt
  };
}

function buildSupabaseViesEvidenceValues(input: CreateViesEvidenceRecordInput) {
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const vatNumberNormalized = input.vatNumberNormalized.trim().toUpperCase();

  return {
    organization_id: input.organizationId,
    invoice_draft_id: normalizeOptionalText(input.invoiceDraftId),
    validation_run_id: normalizeOptionalText(input.validationRunId),
    party_role: normalizePartyRole(input.partyRole),
    country_code: input.countryCode.trim().toUpperCase(),
    vat_number_normalized: vatNumberNormalized,
    vat_number_display: input.vatNumberDisplay.trim().toUpperCase(),
    vat_number_fingerprint: createVatIdFingerprint(vatNumberNormalized),
    request_source: input.requestSource,
    status: input.status,
    vies_valid: input.viesValid ?? null,
    vies_name: normalizeOptionalText(input.viesName),
    vies_address: normalizeOptionalText(input.viesAddress),
    request_identifier: normalizeOptionalText(input.requestIdentifier),
    checked_at: checkedAt,
    source_label: input.sourceLabel,
    source_url: input.sourceUrl,
    response_time_ms: input.responseTimeMs ?? null,
    error_code: normalizeOptionalText(input.errorCode),
    error_message_safe: normalizeOptionalText(input.errorMessageSafe),
    raw_response_hash: normalizeOptionalText(input.rawResponseHash),
    metadata: input.metadata ?? {},
    created_by: normalizeOptionalText(input.createdBy)
  };
}

export async function saveViesEvidenceRecord(
  input: CreateViesEvidenceRecordInput
) {
  if (hasSupabaseOrganizationStorage(input.organizationId)) {
    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("vies_evidence_checks")
      .insert(buildSupabaseViesEvidenceValues(input))
      .select(VIES_EVIDENCE_SELECT_FIELDS)
      .single();

    if (error) {
      throw new Error(`Could not create VIES evidence record: ${error.message}`);
    }

    return normalizeSupabaseViesEvidenceRow(data as SupabaseViesEvidenceRow);
  }

  const record = buildLocalViesEvidenceRecord(input);
  const currentRecords =
    await storageProvider.readCollection<ViesEvidenceRecord>(
      VIES_EVIDENCE_CHECKS_FILE
    );

  const nextRecords = sortViesEvidenceByCheckedAt([
    record,
    ...currentRecords.filter((existingRecord) => existingRecord.id !== record.id)
  ]).slice(0, MAX_STORED_VIES_EVIDENCE_CHECKS);

  await storageProvider.writeCollection(VIES_EVIDENCE_CHECKS_FILE, nextRecords);

  return record;
}

export async function countViesEvidenceRecords(
  input: CountViesEvidenceRecordsInput
) {
  const sinceIso = input.sinceIso;
  const vatNumberNormalized = input.vatNumberNormalized?.trim().toUpperCase();

  if (hasSupabaseOrganizationStorage(input.organizationId)) {
    const supabase = getSupabaseServiceRoleClient();
    let query = supabase
      .from("vies_evidence_checks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", input.organizationId)
      .gte("checked_at", sinceIso);

    if (vatNumberNormalized) {
      query = query.eq("vat_number_normalized", vatNumberNormalized);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Could not count VIES evidence records: ${error.message}`);
    }

    return count ?? 0;
  }

  const records = await storageProvider.readCollection<ViesEvidenceRecord>(
    VIES_EVIDENCE_CHECKS_FILE
  );

  return records.filter((record) => {
    if (record.organizationId !== input.organizationId) {
      return false;
    }

    if (record.checkedAt < sinceIso) {
      return false;
    }

    if (
      vatNumberNormalized &&
      record.vatNumberNormalized !== vatNumberNormalized
    ) {
      return false;
    }

    return true;
  }).length;
}

export async function getLatestViesEvidenceRecord(
  input: GetLatestViesEvidenceRecordInput
) {
  const countryCode = input.countryCode.trim().toUpperCase();
  const vatNumberNormalized = input.vatNumberNormalized.trim().toUpperCase();

  if (hasSupabaseOrganizationStorage(input.organizationId)) {
    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("vies_evidence_checks")
      .select(VIES_EVIDENCE_SELECT_FIELDS)
      .eq("organization_id", input.organizationId)
      .eq("country_code", countryCode)
      .eq("vat_number_normalized", vatNumberNormalized)
      .order("checked_at", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not read VIES evidence record: ${error.message}`);
    }

    return data
      ? normalizeSupabaseViesEvidenceRow(data as SupabaseViesEvidenceRow)
      : null;
  }

  const records = await storageProvider.readCollection<ViesEvidenceRecord>(
    VIES_EVIDENCE_CHECKS_FILE
  );

  return (
    sortViesEvidenceByCheckedAt(records).find(
      (record) =>
        record.organizationId === input.organizationId &&
        record.countryCode === countryCode &&
        record.vatNumberNormalized === vatNumberNormalized
    ) ?? null
  );
}
