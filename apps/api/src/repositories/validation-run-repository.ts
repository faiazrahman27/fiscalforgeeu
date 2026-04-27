import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceValidationRequest } from "../schemas/invoice.js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type FindingSeverity = "info" | "warning" | "fatal";

export type Finding = {
  code: string;
  severity: FindingSeverity;
  field: string;
  message: string;
  legalConfidence: "technical" | "educational_simulation" | "review_required";
};

export type ValidationTotals = {
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
  payableAmount: number;
};

export type ValidationRunRecord = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
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
  payload: unknown;
  disclaimer: string;
  created_at: string;
  updated_at: string;
};

type ValidationRunTotalsRow = {
  organization_id: string;
  validation_run_id: string;
  line_extension_amount: number;
  tax_exclusive_amount: number;
  tax_amount: number;
  tax_inclusive_amount: number;
  payable_amount: number;
  currency: string;
};

type ValidationRunFindingRow = {
  organization_id: string;
  validation_run_id: string;
  finding_position: number;
  code: string;
  severity: FindingSeverity;
  field_path: string;
  message: string;
  legal_confidence: Finding["legalConfidence"];
};

const VALIDATION_RUNS_FILE = "validation-runs.json";
const MAX_STORED_VALIDATION_RUNS = 250;
const VALIDATION_RUN_SELECT_FIELDS =
  "id, organization_id, created_by, invoice_number, buyer_name, seller_name, profile, issue_date, seller_country, buyer_country, technical_status, standard_status, country_simulation_status, vida_readiness_status, confidence, currency, findings_count, payable_amount, totals, findings, payload, disclaimer, created_at, updated_at";

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

function sortValidationRunsByCreatedAt(records: ValidationRunRecord[]) {
  return [...records].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt)
  );
}

function numberToCents(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

function centsToMoney(value: number) {
  return Number((value / 100).toFixed(2));
}

function calculateLineNetCents(quantity: number, unitPrice: number) {
  const unitPriceCents = numberToCents(unitPrice);

  return Math.round(quantity * unitPriceCents);
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
      lineExtensionAmount: 0,
      taxExclusiveAmount: 0,
      taxAmount: 0,
      taxInclusiveAmount: 0,
      payableAmount: 0
    };
  }

  return {
    lineExtensionAmount: readNumberField(value, "lineExtensionAmount"),
    taxExclusiveAmount: readNumberField(value, "taxExclusiveAmount"),
    taxAmount: readNumberField(value, "taxAmount"),
    taxInclusiveAmount: readNumberField(value, "taxInclusiveAmount"),
    payableAmount: readNumberField(value, "payableAmount")
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
  const legalConfidence = readStringField(value, "legalConfidence") as
    | "technical"
    | "educational_simulation"
    | "review_required";

  if (!code || !field || !message) {
    return null;
  }

  if (!["info", "warning", "fatal"].includes(severity)) {
    return null;
  }

  if (
    !["technical", "educational_simulation", "review_required"].includes(
      legalConfidence
    )
  ) {
    return null;
  }

  return {
    code,
    severity,
    field,
    message,
    legalConfidence
  };
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
    seller: row.seller_name,
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
    severity: finding.severity,
    field_path: finding.field,
    message: finding.message,
    legal_confidence: finding.legalConfidence
  }));
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
  const lineExtensionCents = payload.lines.reduce((sum, line) => {
    return sum + calculateLineNetCents(line.quantity, line.unitPrice);
  }, 0);

  const taxCents = payload.lines.reduce((sum, line) => {
    const lineNetCents = calculateLineNetCents(line.quantity, line.unitPrice);
    const lineTaxCents = Math.round((lineNetCents * line.vatRate) / 100);

    return sum + lineTaxCents;
  }, 0);

  const taxInclusiveCents = lineExtensionCents + taxCents;

  return {
    lineExtensionAmount: centsToMoney(lineExtensionCents),
    taxExclusiveAmount: centsToMoney(lineExtensionCents),
    taxAmount: centsToMoney(taxCents),
    taxInclusiveAmount: centsToMoney(taxInclusiveCents),
    payableAmount: centsToMoney(taxInclusiveCents)
  };
}

export function buildValidationFindings(
  payload: InvoiceValidationRequest
): Finding[] {
  const findings: Finding[] = [];
  const isCrossBorder = payload.seller.country !== payload.buyer.country;

  if (isCrossBorder && !payload.buyer.vatId) {
    findings.push({
      code: "BUYER_VAT_ID_REQUIRED",
      severity: "fatal",
      field: "buyer.vatId",
      message: "Buyer VAT ID is required for this cross-border B2B simulation.",
      legalConfidence: "educational_simulation"
    });
  }

  if (isCrossBorder) {
    findings.push({
      code: "CROSS_BORDER_REVIEW_REQUIRED",
      severity: "warning",
      field: "buyer.country",
      message:
        "Seller and buyer countries differ. Country and VAT treatment require professional review.",
      legalConfidence: "review_required"
    });
  }

  const hasZeroValueLine = payload.lines.some((line) => {
    return calculateLineNetCents(line.quantity, line.unitPrice) === 0;
  });

  if (hasZeroValueLine) {
    findings.push({
      code: "ZERO_VALUE_LINE_REVIEW",
      severity: "warning",
      field: "lines",
      message: "One or more invoice lines have zero value and should be reviewed.",
      legalConfidence: "technical"
    });
  }

  return findings;
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
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not delete Supabase validation run: ${error.message}`);
  }

  return Boolean(data);
}
