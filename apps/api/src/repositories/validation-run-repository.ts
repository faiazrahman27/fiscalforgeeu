import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCoreValidationFindings,
  calculateInvoiceTotals,
  type LegalConfidence,
  type ValidationFindingSeverity
} from "@invoice-lantern/invoice-core";
import type { InvoiceValidationRequest } from "../schemas/invoice.js";
import {
  getSupabaseServiceRoleClient,
  getSupabaseUserClient,
  hasSupabaseServerConfig
} from "../lib/supabase/server-client.js";
import type { ValidationSourceReference } from "../schemas/validation-engine.js";
import {
  buildCountryPackValidationFindings,
  enrichValidationFindings
} from "../services/validation-finding-enrichment.js";
import { buildVatFormatValidationFindings } from "../services/vat-format-validation-findings.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type FindingSeverity = ValidationFindingSeverity;

export type Finding = {
  code: string;
  severity: ValidationFindingSeverity;
  category: string;
  field: string;
  fieldPath: string;
  message: string;
  fixSuggestion?: string | undefined;
  legalConfidence: LegalConfidence;
  ruleSetCode?: string | undefined;
  ruleVersion?: string | undefined;
  sourceLabels?: string[] | undefined;
  ruleId?: string | undefined;
  sourceRefIds?: string[] | undefined;
  sourceReferences?: ValidationSourceReference[] | undefined;
  checkType?: string | undefined;
  layer?: string | undefined;
  createdAt?: string | undefined;
  status?: string | undefined;
  evidenceId?: string | undefined;
  xmlLine?: number | undefined;
  technicalCode?: string | undefined;
  technicalMessage?: string | undefined;
  businessRuleId?: string | undefined;
  countryPackVersion?: string | undefined;
  countryPackStatus?: string | undefined;
  countryPackCountryCode?: string | undefined;
};

export type ValidationTotals = {
  lineExtensionAmount: string;
  taxExclusiveAmount: string;
  taxAmount: string;
  taxInclusiveAmount: string;
  payableAmount: string;
};

export type ValidationRunRecord = {
  id: string;
  organizationId?: string;
  invoiceNumber: string;
  buyer: string;
  buyerCountry?: string;
  seller: string;
  sellerCountry?: string;
  issueDate?: string;
  createdAt: string;
  technicalStatus: "passed" | "failed";
  standardStatus: "ready" | "warning";
  countrySimulationStatus: "not_relevant" | "review_required";
  vidaReadinessStatus: "not_relevant" | "relevant_simulation";
  confidence: "technical_preview" | "educational_simulation";
  profile: "API_VALIDATION";
  currency: string;
  totals: ValidationTotals;
  findings: Finding[];
  disclaimer: string;
};

export type AuthenticatedValidationRunContext = {
  userId: string;
  accessToken: string;
};

export type OrganizationValidationRunContext = {
  organizationId: string;
  userId: string;
};

type SupabaseWorkspaceBootstrapRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

type SupabaseValidationRunRow = {
  id: string;
  organization_id: string;
  created_by: string;
  invoice_number: string;
  buyer_name: string;
  seller_name: string;
  profile: string;
  issue_date: string;
  seller_country: string;
  buyer_country: string;
  technical_status: string;
  standard_status: string;
  country_simulation_status: string;
  vida_readiness_status: string;
  confidence: string;
  currency: string;
  findings_count: number;
  payable_amount: string | number;
  totals: unknown;
  findings: unknown;
  payload?: unknown;
  disclaimer: string;
  created_at: string;
  updated_at: string;
};

type ValidationRunTotalsRow = {
  organization_id: string;
  validation_run_id: string;
  line_extension_amount: string;
  tax_exclusive_amount: string;
  tax_amount: string;
  tax_inclusive_amount: string;
  payable_amount: string;
  currency: string;
};

type ValidationRunFindingRow = {
  organization_id: string;
  validation_run_id: string;
  finding_position: number;
  code: string;
  severity: "info" | "warning" | "fatal";
  field_path: string;
  message: string;
  legal_confidence: LegalConfidence;
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

const VALIDATION_RUNS_FILE = "validation-runs.json";
const MAX_STORED_VALIDATION_RUNS = 250;
const VALIDATION_RUN_SELECT_FIELDS =
  "id, organization_id, created_by, invoice_number, buyer_name, seller_name, profile, issue_date, seller_country, buyer_country, technical_status, standard_status, country_simulation_status, vida_readiness_status, confidence, currency, findings_count, payable_amount, totals, findings, disclaimer, created_at, updated_at";

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

function readAmountField(
  record: Record<string, unknown>,
  key: string,
  fallback = "0.00"
) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function readStringArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readOptionalNumberField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readSourceReferencesField(
  record: Record<string, unknown>,
  key: string
): ValidationSourceReference[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item)
    )
    .map((item) => {
      const sourceName = readStringField(item, "sourceName");

      if (!sourceName) {
        return null;
      }

      const source: ValidationSourceReference = {
        sourceName
      };
      const optionalFields = [
        "id",
        "sourceLabel",
        "sourceType",
        "sourceUrl",
        "jurisdiction",
        "reviewedAt",
        "effectiveFrom",
        "effectiveUntil",
        "notes"
      ] as const;

      for (const optionalField of optionalFields) {
        const fieldValue = readStringField(item, optionalField);

        if (fieldValue) {
          source[optionalField] = fieldValue;
        }
      }

      return source;
    })
    .filter((item): item is ValidationSourceReference => item !== null);
}

function sortValidationRunsByCreatedAt(records: ValidationRunRecord[]) {
  return [...records].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt)
  );
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

function normalizeValidationTotals(value: unknown): ValidationTotals {
  if (!isPlainObject(value)) {
    return {
      lineExtensionAmount: "0.00",
      taxExclusiveAmount: "0.00",
      taxAmount: "0.00",
      taxInclusiveAmount: "0.00",
      payableAmount: "0.00"
    };
  }

  return {
    lineExtensionAmount: readAmountField(value, "lineExtensionAmount"),
    taxExclusiveAmount: readAmountField(value, "taxExclusiveAmount"),
    taxAmount: readAmountField(value, "taxAmount"),
    taxInclusiveAmount: readAmountField(value, "taxInclusiveAmount"),
    payableAmount: readAmountField(value, "payableAmount")
  };
}

function normalizeFinding(value: unknown): Finding | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code");
  const severity = readStringField(value, "severity") as FindingSeverity;
  const field = readStringField(value, "field");
  const message = readStringField(value, "message");
  const rawLegalConfidence = readStringField(value, "legalConfidence");
  const legalConfidence =
    rawLegalConfidence === "review_required"
      ? "professional_review_required"
      : (rawLegalConfidence as LegalConfidence);
  const category = readStringField(value, "category", "validation");
  const fieldPath = readStringField(value, "fieldPath", field);
  const fixSuggestion = readStringField(value, "fixSuggestion");
  const ruleSetCode = readStringField(value, "ruleSetCode");
  const ruleVersion = readStringField(value, "ruleVersion");
  const sourceLabels = readStringArrayField(value, "sourceLabels");
  const sourceRefIds = readStringArrayField(value, "sourceRefIds");
  const sourceReferences = readSourceReferencesField(value, "sourceReferences");
  const ruleId = readStringField(value, "ruleId");
  const checkType = readStringField(value, "checkType");
  const layer = readStringField(value, "layer");
  const createdAt = readStringField(value, "createdAt");
  const status = readStringField(value, "status");
  const evidenceId = readStringField(value, "evidenceId");
  const technicalCode = readStringField(value, "technicalCode");
  const technicalMessage = readStringField(value, "technicalMessage");
  const businessRuleId = readStringField(value, "businessRuleId");
  const countryPackVersion = readStringField(value, "countryPackVersion");
  const countryPackStatus = readStringField(value, "countryPackStatus");
  const countryPackCountryCode = readStringField(
    value,
    "countryPackCountryCode"
  );
  const xmlLine = readOptionalNumberField(value, "xmlLine");

  if (!code || !field || !message) {
    return null;
  }

  if (!["info", "warning", "fatal", "blocked"].includes(severity)) {
    return null;
  }

  if (
    ![
      "technical",
      "standard_based",
      "official_source_derived",
      "educational_simulation",
      "professional_review_required"
    ].includes(legalConfidence)
  ) {
    return null;
  }

  const finding: Finding = {
    code,
    severity,
    category,
    field,
    fieldPath,
    message,
    legalConfidence
  };

  if (fixSuggestion) {
    finding.fixSuggestion = fixSuggestion;
  }

  if (ruleSetCode) {
    finding.ruleSetCode = ruleSetCode;
  }

  if (ruleVersion) {
    finding.ruleVersion = ruleVersion;
  }

  if (sourceLabels.length > 0) {
    finding.sourceLabels = sourceLabels;
  }

  if (sourceRefIds.length > 0) {
    finding.sourceRefIds = sourceRefIds;
  }

  if (sourceReferences.length > 0) {
    finding.sourceReferences = sourceReferences;
  }

  if (ruleId) {
    finding.ruleId = ruleId;
  }

  if (checkType) {
    finding.checkType = checkType;
  }

  if (layer) {
    finding.layer = layer;
  }

  if (createdAt) {
    finding.createdAt = createdAt;
  }

  if (status) {
    finding.status = status;
  }

  if (evidenceId) {
    finding.evidenceId = evidenceId;
  }

  if (typeof xmlLine === "number") {
    finding.xmlLine = xmlLine;
  }

  if (technicalCode) {
    finding.technicalCode = technicalCode;
  }

  if (technicalMessage) {
    finding.technicalMessage = technicalMessage;
  }

  if (businessRuleId) {
    finding.businessRuleId = businessRuleId;
  }

  if (countryPackVersion) {
    finding.countryPackVersion = countryPackVersion;
  }

  if (countryPackStatus) {
    finding.countryPackStatus = countryPackStatus;
  }

  if (countryPackCountryCode) {
    finding.countryPackCountryCode = countryPackCountryCode;
  }

  return finding;
}

function normalizeFindings(value: unknown): Finding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((finding) => normalizeFinding(finding))
    .filter((finding): finding is Finding => finding !== null);
}

function normalizeTechnicalStatus(
  value: string
): ValidationRunRecord["technicalStatus"] {
  return value === "failed" ? "failed" : "passed";
}

function normalizeStandardStatus(
  value: string
): ValidationRunRecord["standardStatus"] {
  return value === "warning" ? "warning" : "ready";
}

function normalizeCountrySimulationStatus(
  value: string
): ValidationRunRecord["countrySimulationStatus"] {
  return value === "review_required" ? "review_required" : "not_relevant";
}

function normalizeVidaReadinessStatus(
  value: string
): ValidationRunRecord["vidaReadinessStatus"] {
  return value === "relevant_simulation"
    ? "relevant_simulation"
    : "not_relevant";
}

function normalizeConfidence(value: string): ValidationRunRecord["confidence"] {
  return value === "educational_simulation"
    ? "educational_simulation"
    : "technical_preview";
}

function normalizeSupabaseValidationRunRow(
  row: SupabaseValidationRunRow
): ValidationRunRecord {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    buyer: row.buyer_name,
    buyerCountry: row.buyer_country,
    seller: row.seller_name,
    sellerCountry: row.seller_country,
    issueDate: row.issue_date,
    createdAt: row.created_at,
    technicalStatus: normalizeTechnicalStatus(row.technical_status),
    standardStatus: normalizeStandardStatus(row.standard_status),
    countrySimulationStatus: normalizeCountrySimulationStatus(
      row.country_simulation_status
    ),
    vidaReadinessStatus: normalizeVidaReadinessStatus(
      row.vida_readiness_status
    ),
    confidence: normalizeConfidence(row.confidence),
    profile: "API_VALIDATION",
    currency: row.currency,
    totals: normalizeValidationTotals(row.totals),
    findings: normalizeFindings(row.findings),
    disclaimer: row.disclaimer
  };
}

function buildSupabaseValidationRunValues(
  record: ValidationRunRecord,
  requestPayload: InvoiceValidationRequest,
  organizationId: string,
  userId: string
) {
  return {
    organization_id: organizationId,
    created_by: userId,
    invoice_number: record.invoiceNumber,
    buyer_name: record.buyer,
    seller_name: record.seller,
    profile: record.profile,
    issue_date: requestPayload.document.issueDate,
    seller_country: requestPayload.seller.country,
    buyer_country: requestPayload.buyer.country,
    technical_status: record.technicalStatus,
    standard_status: record.standardStatus,
    country_simulation_status: record.countrySimulationStatus,
    vida_readiness_status: record.vidaReadinessStatus,
    confidence: record.confidence,
    currency: record.currency,
    findings_count: record.findings.length,
    payable_amount: record.totals.payableAmount,
    totals: record.totals,
    findings: record.findings,
    payload: {
      request: requestPayload,
      result: record
    },
    disclaimer: record.disclaimer,
    created_at: record.createdAt
  };
}

function buildValidationRunActivityMetadata(
  record: ValidationRunRecord,
  requestPayload?: InvoiceValidationRequest
) {
  return {
    invoiceNumber: record.invoiceNumber,
    sellerName: record.seller,
    buyerName: record.buyer,
    sellerCountry: requestPayload?.seller.country ?? record.sellerCountry ?? "",
    buyerCountry: requestPayload?.buyer.country ?? record.buyerCountry ?? "",
    issueDate: requestPayload?.document.issueDate ?? "",
    currency: record.currency,
    technicalStatus: record.technicalStatus,
    standardStatus: record.standardStatus,
    countrySimulationStatus: record.countrySimulationStatus,
    vidaReadinessStatus: record.vidaReadinessStatus,
    confidence: record.confidence,
    findingsCount: record.findings.length,
    payableAmount: record.totals.payableAmount
  };
}

function buildValidationRunTotalsRow(
  record: ValidationRunRecord,
  organizationId: string,
  validationRunId: string
): ValidationRunTotalsRow {
  return {
    organization_id: organizationId,
    validation_run_id: validationRunId,
    line_extension_amount: record.totals.lineExtensionAmount,
    tax_exclusive_amount: record.totals.taxExclusiveAmount,
    tax_amount: record.totals.taxAmount,
    tax_inclusive_amount: record.totals.taxInclusiveAmount,
    payable_amount: record.totals.payableAmount,
    currency: record.currency
  };
}

function toPersistedFindingSeverity(
  severity: FindingSeverity
): ValidationRunFindingRow["severity"] {
  return severity === "blocked" ? "fatal" : severity;
}

function buildValidationRunFindingRows(
  record: ValidationRunRecord,
  organizationId: string,
  validationRunId: string
): ValidationRunFindingRow[] {
  return record.findings.map((finding, index) => ({
    organization_id: organizationId,
    validation_run_id: validationRunId,
    finding_position: index + 1,
    code: finding.code,
    severity: toPersistedFindingSeverity(finding.severity),
    field_path: finding.fieldPath || finding.field,
    message: finding.message,
    legal_confidence: finding.legalConfidence
  }));
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
     * Activity logging must not break the main validation operation.
     * The validation run and relational rows remain the authoritative data.
     */
    console.warn(`Workspace activity event was not recorded: ${error.message}`);
  }
}

async function replaceValidationRunRelationalRows(
  supabase: SupabaseClient,
  organizationId: string,
  validationRunId: string,
  record: ValidationRunRecord
) {
  const childTables = ["validation_run_findings", "validation_run_totals"];

  for (const tableName of childTables) {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("organization_id", organizationId)
      .eq("validation_run_id", validationRunId);

    if (error) {
      throw new Error(
        `Could not clear ${tableName} rows for validation run: ${error.message}`
      );
    }
  }

  const { error: totalsInsertError } = await supabase
    .from("validation_run_totals")
    .insert(buildValidationRunTotalsRow(record, organizationId, validationRunId));

  if (totalsInsertError) {
    throw new Error(
      `Could not insert validation run totals row: ${totalsInsertError.message}`
    );
  }

  const findingRows = buildValidationRunFindingRows(
    record,
    organizationId,
    validationRunId
  );

  if (findingRows.length > 0) {
    const { error: findingsInsertError } = await supabase
      .from("validation_run_findings")
      .insert(findingRows);

    if (findingsInsertError) {
      throw new Error(
        `Could not insert validation run finding rows: ${findingsInsertError.message}`
      );
    }
  }
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
  context: AuthenticatedValidationRunContext
) {
  return getSupabaseUserClient(context.accessToken);
}

export function hasAuthenticatedValidationRunContext(
  context: AuthenticatedValidationRunContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export function calculateValidationTotals(
  payload: InvoiceValidationRequest
): ValidationTotals {
  return calculateInvoiceTotals(payload).totals;
}

export function buildValidationFindings(
  payload: InvoiceValidationRequest
): Finding[] {
  return [
    ...enrichValidationFindings([
    ...buildCoreValidationFindings(payload).map((finding) => ({
      ...finding,
      field: finding.fieldPath
    })),
    ...buildVatFormatValidationFindings(payload)
  ]),
    ...buildCountryPackValidationFindings(payload)
  ] as Finding[];
}

/* -------------------------------------------------------------------------- */
/* Local JSON-backed validation run storage                                   */
/* -------------------------------------------------------------------------- */

export async function listValidationRuns() {
  const records = await storageProvider.readCollection<ValidationRunRecord>(
    VALIDATION_RUNS_FILE
  );

  return sortValidationRunsByCreatedAt(records);
}

export async function listOrganizationValidationRuns(organizationId: string) {
  if (!hasSupabaseServerConfig()) {
    const records = await listValidationRuns();

    return records.filter((record) => record.organizationId === organizationId);
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("validation_runs")
    .select(VALIDATION_RUN_SELECT_FIELDS)
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(MAX_STORED_VALIDATION_RUNS);

  if (error) {
    throw new Error(`Could not list organization validation runs: ${error.message}`);
  }

  return ((data ?? []) as SupabaseValidationRunRow[]).map((row) =>
    normalizeSupabaseValidationRunRow(row)
  );
}

export async function getValidationRunById(id: string) {
  const runs = await listValidationRuns();

  return runs.find((run) => run.id === id) ?? null;
}

export async function saveValidationRun(record: ValidationRunRecord) {
  const currentRuns = await listValidationRuns();

  const nextRuns = sortValidationRunsByCreatedAt([
    record,
    ...currentRuns.filter((existingRun) => existingRun.id !== record.id)
  ]).slice(0, MAX_STORED_VALIDATION_RUNS);

  await storageProvider.writeCollection(VALIDATION_RUNS_FILE, nextRuns);

  return record;
}

export async function deleteValidationRunById(id: string) {
  const runs = await listValidationRuns();
  const nextRuns = runs.filter((run) => run.id !== id);

  if (nextRuns.length === runs.length) {
    return false;
  }

  await storageProvider.writeCollection(VALIDATION_RUNS_FILE, nextRuns);

  return true;
}

/* -------------------------------------------------------------------------- */
/* Supabase user-scoped validation run storage                                */
/* -------------------------------------------------------------------------- */

export async function listAuthenticatedValidationRuns(
  context: AuthenticatedValidationRunContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("validation_runs")
    .select(VALIDATION_RUN_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(MAX_STORED_VALIDATION_RUNS);

  if (error) {
    throw new Error(`Could not list Supabase validation runs: ${error.message}`);
  }

  return ((data ?? []) as SupabaseValidationRunRow[]).map((row) =>
    normalizeSupabaseValidationRunRow(row)
  );
}

export async function getAuthenticatedValidationRunById(
  context: AuthenticatedValidationRunContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("validation_runs")
    .select(VALIDATION_RUN_SELECT_FIELDS)
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read Supabase validation run: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return normalizeSupabaseValidationRunRow(data as SupabaseValidationRunRow);
}

export async function getOrganizationValidationRunById(
  organizationId: string,
  id: string
) {
  if (!hasSupabaseServerConfig()) {
    const runs = await listOrganizationValidationRuns(organizationId);

    return runs.find((run) => run.id === id) ?? null;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("validation_runs")
    .select(VALIDATION_RUN_SELECT_FIELDS)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not read organization validation run: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return normalizeSupabaseValidationRunRow(data as SupabaseValidationRunRow);
}

export async function saveAuthenticatedValidationRun(
  context: AuthenticatedValidationRunContext,
  record: ValidationRunRecord,
  requestPayload: InvoiceValidationRequest
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("validation_runs")
    .insert(
      buildSupabaseValidationRunValues(
        record,
        requestPayload,
        workspace.organizationId,
        context.userId
      )
    )
    .select(VALIDATION_RUN_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create Supabase validation run: ${error.message}`);
  }

  const savedRecord = normalizeSupabaseValidationRunRow(
    data as SupabaseValidationRunRow
  );

  try {
    await replaceValidationRunRelationalRows(
      supabase,
      workspace.organizationId,
      savedRecord.id,
      savedRecord
    );
  } catch (relationalError) {
    /*
     * Supabase client calls are not wrapped in a database transaction here.
     * If child-row persistence fails, remove the parent row to avoid a partial
     * validation run record. ON DELETE CASCADE clears any child rows that may
     * have been inserted before the failure.
     */
    await supabase
      .from("validation_runs")
      .delete()
      .eq("id", savedRecord.id)
      .eq("organization_id", workspace.organizationId);

    throw relationalError;
  }

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "validation_run.created",
    entityType: "validation_run",
    entityId: savedRecord.id,
    entityLabel: savedRecord.invoiceNumber || savedRecord.id,
    severity: savedRecord.technicalStatus === "failed" ? "warning" : "info",
    metadata: buildValidationRunActivityMetadata(savedRecord, requestPayload)
  });

  return savedRecord;
}

export async function saveOrganizationValidationRun(
  context: OrganizationValidationRunContext,
  record: ValidationRunRecord,
  requestPayload: InvoiceValidationRequest
) {
  if (!hasSupabaseServerConfig()) {
    return saveValidationRun({
      ...record,
      organizationId: context.organizationId
    });
  }

  const supabase = getSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("validation_runs")
    .insert(
      buildSupabaseValidationRunValues(
        record,
        requestPayload,
        context.organizationId,
        context.userId
      )
    )
    .select(VALIDATION_RUN_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(
      `Could not create organization validation run: ${error.message}`
    );
  }

  const savedRecord = normalizeSupabaseValidationRunRow(
    data as SupabaseValidationRunRow
  );

  try {
    await replaceValidationRunRelationalRows(
      supabase,
      context.organizationId,
      savedRecord.id,
      savedRecord
    );
  } catch (relationalError) {
    await supabase
      .from("validation_runs")
      .delete()
      .eq("id", savedRecord.id)
      .eq("organization_id", context.organizationId);

    throw relationalError;
  }

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: context.organizationId,
    actorUserId: context.userId,
    eventType: "validation_run.created",
    entityType: "validation_run",
    entityId: savedRecord.id,
    entityLabel: savedRecord.invoiceNumber || savedRecord.id,
    severity: savedRecord.technicalStatus === "failed" ? "warning" : "info",
    metadata: buildValidationRunActivityMetadata(savedRecord, requestPayload)
  });

  return savedRecord;
}

export async function deleteAuthenticatedValidationRunById(
  context: AuthenticatedValidationRunContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  /*
   * Child rows are linked with ON DELETE CASCADE, so deleting the parent run
   * also removes totals and findings.
   */
  const { data, error } = await supabase
    .from("validation_runs")
    .delete()
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .select(
      "id, invoice_number, technical_status, standard_status, findings_count, payable_amount, currency"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Could not delete Supabase validation run: ${error.message}`);
  }

  if (!data) {
    return false;
  }

  const deletedRun = data as {
    id: string;
    invoice_number: string;
    technical_status: string;
    standard_status: string;
    findings_count: number;
    payable_amount: string | number;
    currency: string;
  };

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "validation_run.deleted",
    entityType: "validation_run",
    entityId: deletedRun.id,
    entityLabel: deletedRun.invoice_number || deletedRun.id,
    metadata: {
      invoiceNumber: deletedRun.invoice_number,
      technicalStatus: deletedRun.technical_status,
      standardStatus: deletedRun.standard_status,
      findingsCount: deletedRun.findings_count,
      payableAmount: deletedRun.payable_amount,
      currency: deletedRun.currency
    }
  });

  return true;
}

export async function recordAuthenticatedValidationReportPdfExported(
  context: AuthenticatedValidationRunContext,
  record: ValidationRunRecord,
  filename: string
) {
  try {
    const supabase = createAuthenticatedSupabaseClient(context);
    const workspace = await getWorkspaceForAuthenticatedUser(supabase);

    await recordWorkspaceActivityEvent(supabase, {
      organizationId: workspace.organizationId,
      actorUserId: context.userId,
      eventType: "validation_report.pdf_exported",
      entityType: "validation_run",
      entityId: record.id,
      entityLabel: record.invoiceNumber || record.id,
      metadata: {
        ...buildValidationRunActivityMetadata(record),
        exportFormat: "pdf",
        filename
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`Validation report PDF activity event was not recorded: ${message}`);
  }
}
