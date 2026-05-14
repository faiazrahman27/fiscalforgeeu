import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  VidaBuyerType,
  VidaLegalConfidence,
  VidaReadinessFinding,
  VidaReadinessSimulationInput,
  VidaReadinessSimulationResult,
  VidaReadinessStatus,
  VidaRelevance,
  VidaSourceReference,
  VidaTimelineItem,
  VidaTransactionClass,
  VidaTransactionType
} from "@invoice-lantern/vida-simulator";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type VidaSimulationRunSource = "workspace" | "developer_api" | "system";
export type VidaSimulationRunStatus = "completed" | "failed";

export type VidaSimulationRunRecord = {
  id: string;
  organizationId: string;
  createdBy: string | null;
  apiKeyId: string | null;
  invoiceDraftId: string | null;
  validationRunId: string | null;
  source: VidaSimulationRunSource;
  status: VidaSimulationRunStatus;
  simulationVersion: string;
  sellerCountryCode: string | null;
  buyerCountryCode: string | null;
  buyerType: VidaBuyerType;
  transactionType: VidaTransactionType;
  transactionClass: VidaTransactionClass;
  vidaRelevance: VidaRelevance;
  readinessScore: number | null;
  readinessStatus: VidaReadinessStatus;
  legalConfidence: VidaLegalConfidence;
  invoiceDate: string | null;
  currencyCode: string | null;
  amountText: string | null;
  countryPackVersions: Record<string, string>;
  inputPayload: Record<string, unknown>;
  normalizedInput: Record<string, unknown>;
  countryContext: Record<string, unknown>;
  evidenceSummary: Record<string, unknown>;
  timeline: VidaTimelineItem[];
  sourceReferences: VidaSourceReference[];
  resultPayload: Record<string, unknown>;
  findings: VidaReadinessFinding[];
  sourceLabels: string[];
  recommendedNextActions: string[];
  findingCount: number;
  infoCount: number;
  warningCount: number;
  reviewRequiredCount: number;
  reason: string;
  effectiveDateContext: string;
  disclaimer: string;
  errorCode: string | null;
  errorMessage: string | null;
  requestMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateVidaSimulationRunInput = {
  inputPayload: VidaReadinessSimulationInput;
  result: VidaReadinessSimulationResult;
  invoiceDraftId?: string | null;
  validationRunId?: string | null;
  apiKeyId?: string | null;
  source?: VidaSimulationRunSource;
  requestMetadata?: Record<string, unknown>;
};

export type VidaSimulationRunListFilters = {
  invoiceDraftId?: string | undefined;
  validationRunId?: string | undefined;
  vidaRelevance?: VidaRelevance | undefined;
  transactionClass?: VidaTransactionClass | undefined;
  limit?: number | undefined;
};

export type AuthenticatedVidaSimulationRunContext = {
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

type SupabaseVidaSimulationRunRow = {
  id: string;
  organization_id: string;
  created_by: string | null;
  api_key_id: string | null;
  invoice_draft_id: string | null;
  validation_run_id: string | null;
  source: string;
  status: string;
  simulation_version: string;
  seller_country_code: string | null;
  buyer_country_code: string | null;
  buyer_type: string;
  transaction_type: string;
  transaction_class: string;
  vida_relevance: string;
  legal_confidence: string;
  invoice_date: string | null;
  currency_code: string | null;
  amount_text: string | null;
  country_pack_versions: unknown;
  input_payload: unknown;
  normalized_input: unknown;
  country_context: unknown;
  result_payload: unknown;
  findings: unknown;
  source_labels: unknown;
  recommended_next_actions: unknown;
  finding_count: number;
  info_count: number;
  warning_count: number;
  review_required_count: number;
  reason: string;
  effective_date_context: string;
  disclaimer: string;
  error_code: string | null;
  error_message: string | null;
  request_metadata: unknown;
  created_at: string;
  updated_at: string;
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

const VIDA_SIMULATION_RUNS_FILE = "vida-simulation-runs.json";
const MAX_STORED_VIDA_SIMULATION_RUNS = 250;
const DEFAULT_RUN_LIMIT = 25;
const MAX_RUN_LIMIT = 100;
const LOCAL_ORGANIZATION_ID = "local";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VIDA_SIMULATION_RUN_ID_PATTERN =
  /^(vida_sim_)?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VIDA_SIMULATION_RUN_SELECT_FIELDS =
  "id, organization_id, created_by, api_key_id, invoice_draft_id, validation_run_id, source, status, simulation_version, seller_country_code, buyer_country_code, buyer_type, transaction_type, transaction_class, vida_relevance, legal_confidence, invoice_date, currency_code, amount_text, country_pack_versions, input_payload, normalized_input, country_context, result_payload, findings, source_labels, recommended_next_actions, finding_count, info_count, warning_count, review_required_count, reason, effective_date_context, disclaimer, error_code, error_message, request_metadata, created_at, updated_at";

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

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalId(value: string | null | undefined) {
  return normalizeOptionalText(value);
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isInteger(limit) || !limit) {
    return DEFAULT_RUN_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_RUN_LIMIT);
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeCountryPackVersions(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const normalizedKey = key.trim().toUpperCase();
    const normalizedValue = rawValue.trim();

    if (normalizedKey && normalizedValue) {
      normalized[normalizedKey] = normalizedValue;
    }
  }

  return normalized;
}

function normalizeBuyerType(value: string): VidaBuyerType {
  if (
    value === "business" ||
    value === "consumer" ||
    value === "public_authority" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeTransactionType(value: string): VidaTransactionType {
  if (
    value === "goods" ||
    value === "services" ||
    value === "digital_service" ||
    value === "mixed" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeTransactionClass(value: string): VidaTransactionClass {
  if (
    value === "intra_eu_b2b_goods" ||
    value === "intra_eu_b2b_service" ||
    value === "intra_eu_b2b_digital_service" ||
    value === "intra_eu_b2b_mixed" ||
    value === "intra_eu_b2b_unknown" ||
    value === "intra_eu_b2c" ||
    value === "intra_eu_public_authority" ||
    value === "domestic_eu_business" ||
    value === "domestic_eu_consumer" ||
    value === "domestic_eu_unknown" ||
    value === "non_eu_or_unsupported" ||
    value === "insufficient_data"
  ) {
    return value;
  }

  return "insufficient_data";
}

function normalizeVidaRelevance(value: string): VidaRelevance {
  if (
    value === "high" ||
    value === "medium" ||
    value === "low" ||
    value === "not_relevant" ||
    value === "review_required"
  ) {
    return value;
  }

  return "review_required";
}

function normalizeLegalConfidence(value: string): VidaLegalConfidence {
  if (
    value === "technical" ||
    value === "standard_based" ||
    value === "official_source_derived" ||
    value === "educational_simulation" ||
    value === "professional_review_required"
  ) {
    return value;
  }

  return "educational_simulation";
}

function normalizeReadinessStatus(value: string): VidaReadinessStatus {
  if (
    value === "ready_for_technical_review" ||
    value === "needs_more_invoice_data" ||
    value === "needs_vat_evidence" ||
    value === "needs_country_review" ||
    value === "not_relevant" ||
    value === "professional_review_required"
  ) {
    return value;
  }

  return "professional_review_required";
}

function normalizeReadinessScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeFindingSeverity(
  value: string
): VidaReadinessFinding["severity"] | null {
  if (
    value === "info" ||
    value === "warning" ||
    value === "review_required" ||
    value === "blocked"
  ) {
    return value;
  }

  return null;
}

function normalizeFindingCategory(
  value: string
): VidaReadinessFinding["category"] {
  if (
    value === "VIDA_SIMULATION" ||
    value === "VAT_ID" ||
    value === "VIES" ||
    value === "COUNTRY_PACK" ||
    value === "STRUCTURED_INVOICE" ||
    value === "UBL" ||
    value === "XSD" ||
    value === "SCHEMATRON" ||
    value === "LEGAL_LABEL"
  ) {
    return value;
  }

  return "VIDA_SIMULATION";
}

function normalizeFindingCountryPackStatus(
  value: string | undefined
): NonNullable<VidaReadinessFinding["countryPackStatus"]> | null {
  if (
    value === "eu_core_only" ||
    value === "draft" ||
    value === "beta" ||
    value === "reviewed" ||
    value === "professional_review_required" ||
    value === "deprecated" ||
    value === "suspended" ||
    value === "unknown"
  ) {
    return value;
  }

  return null;
}

function normalizeFindingEvidenceStatus(
  value: string | undefined
): NonNullable<VidaReadinessFinding["evidenceStatus"]> | null {
  if (
    value === "present" ||
    value === "missing" ||
    value === "valid" ||
    value === "invalid" ||
    value === "passed" ||
    value === "failed" ||
    value === "not_configured" ||
    value === "not_checked" ||
    value === "unavailable" ||
    value === "unknown"
  ) {
    return value;
  }

  return null;
}

function normalizeSource(value: string): VidaSimulationRunSource {
  if (value === "developer_api" || value === "system") {
    return value;
  }

  return "workspace";
}

function normalizeStatus(value: string): VidaSimulationRunStatus {
  return value === "failed" ? "failed" : "completed";
}

function normalizeFindings(value: unknown): VidaReadinessFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((item) => {
      const code = readStringField(item, "code");
      const severity = normalizeFindingSeverity(
        readStringField(item, "severity")
      );
      const category = normalizeFindingCategory(
        readStringField(item, "category")
      );
      const message = readStringField(item, "message");
      const legalConfidence = readStringField(
        item,
        "legalConfidence",
        "educational_simulation"
      );
      const fixSuggestion = readStringField(item, "fixSuggestion");
      const sourceLabels = normalizeStringArray(item.sourceLabels);
      const sourceRefs = normalizeStringArray(item.sourceRefs);
      const countryPackVersion = normalizeOptionalText(
        typeof item.countryPackVersion === "string"
          ? item.countryPackVersion
          : null
      );
      const countryPackStatus = normalizeFindingCountryPackStatus(
        typeof item.countryPackStatus === "string"
          ? item.countryPackStatus
          : undefined
      );
      const evidenceStatus = normalizeFindingEvidenceStatus(
        typeof item.evidenceStatus === "string"
          ? item.evidenceStatus
          : undefined
      );

      if (!code || !severity || !message || !fixSuggestion) {
        return null;
      }

      const finding: VidaReadinessFinding = {
        code,
        severity,
        category,
        message,
        fixSuggestion,
        sourceLabels,
        sourceRefs,
        legalConfidence: normalizeLegalConfidence(legalConfidence)
      };

      if (countryPackVersion) {
        finding.countryPackVersion = countryPackVersion;
      }

      if (countryPackStatus) {
        finding.countryPackStatus = countryPackStatus;
      }

      if (evidenceStatus) {
        finding.evidenceStatus = evidenceStatus;
      }

      return finding;
    })
    .filter((item): item is VidaReadinessFinding => item !== null);
}

function countFindings(findings: VidaReadinessFinding[]) {
  return findings.reduce(
    (counts, finding) => {
      if (finding.severity === "review_required" || finding.severity === "blocked") {
        counts.reviewRequiredCount += 1;
      } else if (finding.severity === "warning") {
        counts.warningCount += 1;
      } else {
        counts.infoCount += 1;
      }

      return counts;
    },
    {
      infoCount: 0,
      warningCount: 0,
      reviewRequiredCount: 0
    }
  );
}

function collectSourceLabels(findings: VidaReadinessFinding[]) {
  const labels = new Set<string>();

  for (const finding of findings) {
    for (const label of finding.sourceLabels) {
      const normalizedLabel = label.trim();

      if (normalizedLabel) {
        labels.add(normalizedLabel);
      }
    }
  }

  return [...labels].sort((first, second) => first.localeCompare(second));
}

function isValidVidaSimulationRunId(value: string) {
  return VIDA_SIMULATION_RUN_ID_PATTERN.test(value);
}

function normalizeSupabaseVidaSimulationRunRow(
  row: SupabaseVidaSimulationRunRow
): VidaSimulationRunRecord {
  const findings = normalizeFindings(row.findings);
  const resultPayload = normalizeObject(row.result_payload);

  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    apiKeyId: row.api_key_id,
    invoiceDraftId: row.invoice_draft_id,
    validationRunId: row.validation_run_id,
    source: normalizeSource(row.source),
    status: normalizeStatus(row.status),
    simulationVersion: row.simulation_version,
    sellerCountryCode: row.seller_country_code,
    buyerCountryCode: row.buyer_country_code,
    buyerType: normalizeBuyerType(row.buyer_type),
    transactionType: normalizeTransactionType(row.transaction_type),
    transactionClass: normalizeTransactionClass(row.transaction_class),
    vidaRelevance: normalizeVidaRelevance(row.vida_relevance),
    readinessScore: normalizeReadinessScore(resultPayload.readinessScore),
    readinessStatus: normalizeReadinessStatus(
      readStringField(resultPayload, "readinessStatus")
    ),
    legalConfidence: normalizeLegalConfidence(row.legal_confidence),
    invoiceDate: row.invoice_date,
    currencyCode: row.currency_code,
    amountText: row.amount_text,
    countryPackVersions: normalizeCountryPackVersions(
      row.country_pack_versions
    ),
    inputPayload: normalizeObject(row.input_payload),
    normalizedInput: normalizeObject(row.normalized_input),
    countryContext: normalizeObject(row.country_context),
    evidenceSummary: normalizeObject(resultPayload.evidenceSummary),
    timeline: normalizeUnknownArray(resultPayload.timeline) as VidaTimelineItem[],
    sourceReferences: normalizeUnknownArray(
      resultPayload.sourceReferences
    ) as VidaSourceReference[],
    resultPayload,
    findings,
    sourceLabels: normalizeStringArray(row.source_labels),
    recommendedNextActions: normalizeStringArray(
      row.recommended_next_actions
    ),
    findingCount: row.finding_count,
    infoCount: row.info_count,
    warningCount: row.warning_count,
    reviewRequiredCount: row.review_required_count,
    reason: row.reason,
    effectiveDateContext: row.effective_date_context,
    disclaimer: row.disclaimer,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    requestMetadata: normalizeObject(row.request_metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sortVidaSimulationRunsByCreatedAt(records: VidaSimulationRunRecord[]) {
  return [...records].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt)
  );
}

function buildVidaSimulationRunValues(
  input: CreateVidaSimulationRunInput,
  organizationId: string,
  userId: string | null,
  invoiceDraftId: string | null,
  validationRunId: string | null
) {
  const result = input.result;
  const findings = normalizeFindings(result.findings);
  const findingCounts = countFindings(findings);
  const sourceLabels = collectSourceLabels(findings);
  const normalizedInput = normalizeObject(result.normalizedInput);
  const countryContext = normalizeObject(result.countryContext);
  const countryPackVersions = normalizeCountryPackVersions(
    result.normalizedInput.countryPackVersions
  );

  return {
    organization_id: organizationId,
    created_by: userId,
    api_key_id: normalizeOptionalId(input.apiKeyId),
    invoice_draft_id: invoiceDraftId,
    validation_run_id: validationRunId,
    source: input.source ?? "workspace",
    status: "completed",
    simulation_version: result.simulationVersion,
    seller_country_code: result.normalizedInput.sellerCountryCode,
    buyer_country_code: result.normalizedInput.buyerCountryCode,
    buyer_type: result.normalizedInput.buyerType,
    transaction_type: result.normalizedInput.transactionType,
    transaction_class: result.transactionClass,
    vida_relevance: result.vidaRelevance,
    legal_confidence: result.legalConfidence,
    invoice_date: result.normalizedInput.invoiceDate,
    currency_code: result.normalizedInput.currency,
    amount_text: result.normalizedInput.amount,
    country_pack_versions: countryPackVersions,
    input_payload: normalizeObject(input.inputPayload),
    normalized_input: normalizedInput,
    country_context: countryContext,
    result_payload: normalizeObject(result),
    findings,
    source_labels: sourceLabels,
    recommended_next_actions: normalizeStringArray(
      result.recommendedNextActions
    ),
    finding_count: findings.length,
    info_count: findingCounts.infoCount,
    warning_count: findingCounts.warningCount,
    review_required_count: findingCounts.reviewRequiredCount,
    reason: result.reason,
    effective_date_context: result.effectiveDateContext,
    disclaimer: result.disclaimer,
    error_code: null,
    error_message: null,
    request_metadata: normalizeObject(input.requestMetadata)
  };
}

function buildLocalVidaSimulationRunRecord(
  input: CreateVidaSimulationRunInput
): VidaSimulationRunRecord {
  const now = new Date().toISOString();
  const values = buildVidaSimulationRunValues(
    input,
    LOCAL_ORGANIZATION_ID,
    null,
    normalizeOptionalId(input.invoiceDraftId),
    normalizeOptionalId(input.validationRunId)
  );

  return normalizeSupabaseVidaSimulationRunRow({
    id: `vida_sim_${randomUUID()}`,
    organization_id: values.organization_id,
    created_by: values.created_by,
    api_key_id: values.api_key_id,
    invoice_draft_id: values.invoice_draft_id,
    validation_run_id: values.validation_run_id,
    source: values.source,
    status: values.status,
    simulation_version: values.simulation_version,
    seller_country_code: values.seller_country_code,
    buyer_country_code: values.buyer_country_code,
    buyer_type: values.buyer_type,
    transaction_type: values.transaction_type,
    transaction_class: values.transaction_class,
    vida_relevance: values.vida_relevance,
    legal_confidence: values.legal_confidence,
    invoice_date: values.invoice_date,
    currency_code: values.currency_code,
    amount_text: values.amount_text,
    country_pack_versions: values.country_pack_versions,
    input_payload: values.input_payload,
    normalized_input: values.normalized_input,
    country_context: values.country_context,
    result_payload: values.result_payload,
    findings: values.findings,
    source_labels: values.source_labels,
    recommended_next_actions: values.recommended_next_actions,
    finding_count: values.finding_count,
    info_count: values.info_count,
    warning_count: values.warning_count,
    review_required_count: values.review_required_count,
    reason: values.reason,
    effective_date_context: values.effective_date_context,
    disclaimer: values.disclaimer,
    error_code: values.error_code,
    error_message: values.error_message,
    request_metadata: values.request_metadata,
    created_at: now,
    updated_at: now
  });
}

function buildVidaSimulationActivityMetadata(record: VidaSimulationRunRecord) {
  return {
    source: record.source,
    simulationVersion: record.simulationVersion,
    transactionClass: record.transactionClass,
    vidaRelevance: record.vidaRelevance,
    readinessScore: record.readinessScore,
    readinessStatus: record.readinessStatus,
    legalConfidence: record.legalConfidence,
    sellerCountryCode: record.sellerCountryCode,
    buyerCountryCode: record.buyerCountryCode,
    buyerType: record.buyerType,
    transactionType: record.transactionType,
    invoiceDraftId: record.invoiceDraftId,
    validationRunId: record.validationRunId,
    findingCount: record.findingCount,
    infoCount: record.infoCount,
    warningCount: record.warningCount,
    reviewRequiredCount: record.reviewRequiredCount
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
  context: AuthenticatedVidaSimulationRunContext
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
     * Activity logging must not break ViDA simulation persistence.
     * The vida_simulation_runs row remains the authoritative audit record.
     */
    console.warn(`Workspace activity event was not recorded: ${error.message}`);
  }
}

export function hasAuthenticatedVidaSimulationRunContext(
  context: AuthenticatedVidaSimulationRunContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function saveVidaSimulationRunRecord(
  input: CreateVidaSimulationRunInput
) {
  const record = buildLocalVidaSimulationRunRecord(input);
  const currentRecords =
    await storageProvider.readCollection<VidaSimulationRunRecord>(
      VIDA_SIMULATION_RUNS_FILE
    );

  const nextRecords = sortVidaSimulationRunsByCreatedAt([
    record,
    ...currentRecords.filter((existingRecord) => existingRecord.id !== record.id)
  ]).slice(0, MAX_STORED_VIDA_SIMULATION_RUNS);

  await storageProvider.writeCollection(VIDA_SIMULATION_RUNS_FILE, nextRecords);

  return record;
}

export async function listVidaSimulationRunRecords(
  filters: VidaSimulationRunListFilters = {}
) {
  const records =
    await storageProvider.readCollection<VidaSimulationRunRecord>(
      VIDA_SIMULATION_RUNS_FILE
    );
  const invoiceDraftId = filters.invoiceDraftId?.trim();
  const validationRunId = filters.validationRunId?.trim();
  const vidaRelevance = filters.vidaRelevance;
  const transactionClass = filters.transactionClass;
  const limit = normalizeLimit(filters.limit);

  return sortVidaSimulationRunsByCreatedAt(records)
    .filter((record) => {
      if (invoiceDraftId && record.invoiceDraftId !== invoiceDraftId) {
        return false;
      }

      if (validationRunId && record.validationRunId !== validationRunId) {
        return false;
      }

      if (vidaRelevance && record.vidaRelevance !== vidaRelevance) {
        return false;
      }

      if (transactionClass && record.transactionClass !== transactionClass) {
        return false;
      }

      return true;
    })
    .slice(0, limit);
}

export async function getVidaSimulationRunRecord(id: string) {
  const records =
    await storageProvider.readCollection<VidaSimulationRunRecord>(
      VIDA_SIMULATION_RUNS_FILE
    );

  return records.find((record) => record.id === id) ?? null;
}

export async function saveAuthenticatedVidaSimulationRunRecord(
  context: AuthenticatedVidaSimulationRunContext,
  input: CreateVidaSimulationRunInput
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
    .from("vida_simulation_runs")
    .insert(
      buildVidaSimulationRunValues(
        input,
        workspace.organizationId,
        context.userId,
        invoiceDraftId,
        validationRunId
      )
    )
    .select(VIDA_SIMULATION_RUN_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(
      `Could not create Supabase ViDA simulation run: ${error.message}`
    );
  }

  const record = normalizeSupabaseVidaSimulationRunRow(
    data as SupabaseVidaSimulationRunRow
  );

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "vida.simulation_run.created",
    entityType: "vida_simulation_run",
    entityId: record.id,
    entityLabel: `${record.transactionClass} · ${record.vidaRelevance}`,
    severity:
      record.reviewRequiredCount > 0 || record.warningCount > 0
        ? "warning"
        : "info",
    metadata: buildVidaSimulationActivityMetadata(record)
  });

  return record;
}

export async function listAuthenticatedVidaSimulationRunRecords(
  context: AuthenticatedVidaSimulationRunContext,
  filters: VidaSimulationRunListFilters = {}
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const invoiceDraftId = normalizeOptionalId(filters.invoiceDraftId);
  const validationRunId = normalizeOptionalId(filters.validationRunId);
  const vidaRelevance = filters.vidaRelevance;
  const transactionClass = filters.transactionClass;
  const limit = normalizeLimit(filters.limit);

  let query = supabase
    .from("vida_simulation_runs")
    .select(VIDA_SIMULATION_RUN_SELECT_FIELDS)
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

  if (vidaRelevance) {
    query = query.eq("vida_relevance", vidaRelevance);
  }

  if (transactionClass) {
    query = query.eq("transaction_class", transactionClass);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Could not list Supabase ViDA simulation runs: ${error.message}`
    );
  }

  return ((data ?? []) as SupabaseVidaSimulationRunRow[]).map((row) =>
    normalizeSupabaseVidaSimulationRunRow(row)
  );
}

export async function getAuthenticatedVidaSimulationRunRecord(
  context: AuthenticatedVidaSimulationRunContext,
  id: string
) {
  const simulationRunId = id.trim();

  if (!isValidVidaSimulationRunId(simulationRunId)) {
    return null;
  }

  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("vida_simulation_runs")
    .select(VIDA_SIMULATION_RUN_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .eq("id", simulationRunId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not read Supabase ViDA simulation run: ${error.message}`
    );
  }

  return data
    ? normalizeSupabaseVidaSimulationRunRow(
        data as SupabaseVidaSimulationRunRow
      )
    : null;
}
