import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CANONICAL_INVOICE_LEGAL_DISCLAIMER,
  calculateInvoiceTotals,
  canonicalInvoiceSchema,
  validateCanonicalInvoice,
  type CanonicalInvoice,
  type InvoiceCalculationResult,
  type LegalConfidence,
  type ValidationFinding
} from "@invoice-lantern/invoice-core";
import {
  WORKSPACE_ROLE_SETS,
  type WorkspaceAuthorizationContext,
  type WorkspaceRole
} from "../middleware/require-workspace-role.js";
import {
  getInvoiceDraftById,
  type InvoiceDraftRecord
} from "../repositories/invoice-draft-repository.js";
import {
  ProductionDataModelRepositoryError,
  createInvoice,
  createInvoiceAllowance,
  createInvoiceCharge,
  createInvoiceLine,
  createInvoiceTax,
  createSecurityEvent,
  deleteInvoiceChildrenByInvoiceId,
  getInvoiceById,
  listInvoices,
  updateInvoiceById,
  type InvoiceRecord
} from "../repositories/production-data-model-repository.js";
import {
  createInvoiceLifecycleEvent,
  listInvoiceLifecycleEvents,
  type InvoiceLifecycleEventRecord,
  type InvoiceLifecycleStatus
} from "../repositories/invoice-lifecycle-event-repository.js";
import {
  getSupabaseServiceRoleClient,
  getSupabaseUserClient,
  hasSupabaseServerConfig
} from "../lib/supabase/server-client.js";

export type ProductionInvoiceSource =
  | "manual"
  | "api"
  | "ubl_import"
  | "cii_import";

export type ProductionInvoiceValidationSummary = {
  status: "ready" | "blocked";
  infoCount: number;
  warningCount: number;
  fatalCount: number;
  blockedCount: number;
  findings: ValidationFinding[];
  disclaimer: string;
};

export type ProductionInvoiceResponse = {
  id: string;
  organizationId: string;
  draftId: string | null;
  invoiceNumber: string;
  invoiceType: "invoice" | "credit_note";
  profile: "EN16931" | "PEPPOL_BIS_3" | "COUNTRY_PACK";
  issueDate: string;
  dueDate: string | null;
  currency: string;
  status: InvoiceLifecycleStatus;
  legalConfidence: LegalConfidence;
  source: string;
  canonicalInvoice: CanonicalInvoice;
  calculationSummary: InvoiceCalculationResult;
  validationSummary: ProductionInvoiceValidationSummary;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  issuedAt: string | null;
  archivedAt: string | null;
};

export class InvoiceLifecycleServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly findings: ValidationFinding[];
  readonly calculationSummary: InvoiceCalculationResult | null;
  readonly validationSummary: ProductionInvoiceValidationSummary | null;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details: {
      findings?: ValidationFinding[];
      calculationSummary?: InvoiceCalculationResult | null;
      validationSummary?: ProductionInvoiceValidationSummary | null;
    } = {}
  ) {
    super(message);
    this.name = "InvoiceLifecycleServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.findings = details.findings ?? [];
    this.calculationSummary = details.calculationSummary ?? null;
    this.validationSummary = details.validationSummary ?? null;
  }
}

type PreparedCanonicalInvoice = {
  invoice: CanonicalInvoice;
  calculationSummary: InvoiceCalculationResult;
  validationSummary: ProductionInvoiceValidationSummary;
  findings: ValidationFinding[];
};

type SupabaseInvoiceRow = {
  id: string;
  organization_id: string;
  draft_id: string | null;
  invoice_number: string;
  invoice_type: "invoice" | "credit_note";
  profile: "EN16931" | "PEPPOL_BIS_3" | "COUNTRY_PACK";
  issue_date: string;
  due_date: string | null;
  currency: string;
  status: InvoiceLifecycleStatus;
  legal_confidence: LegalConfidence;
  source: string;
  canonical_json: unknown;
  calculation_summary: unknown;
  validation_summary: unknown;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  issued_at: string | null;
  archived_at: string | null;
};

type SupabaseLifecycleEventRow = {
  id: string;
  organization_id: string;
  invoice_id: string;
  from_status: InvoiceLifecycleStatus | null;
  to_status: InvoiceLifecycleStatus;
  reason: string | null;
  actor_user_id: string | null;
  actor_api_key_id: string | null;
  metadata: unknown;
  created_at: string;
};

const INVOICE_SELECT_FIELDS =
  "id, organization_id, draft_id, invoice_number, invoice_type, profile, issue_date, due_date, currency, status, legal_confidence, source, canonical_json, calculation_summary, validation_summary, created_at, updated_at, finalized_at, issued_at, archived_at";

const LIFECYCLE_EVENT_SELECT_FIELDS =
  "id, organization_id, invoice_id, from_status, to_status, reason, actor_user_id, actor_api_key_id, metadata, created_at";

const ALLOWED_TRANSITIONS = {
  draft: ["ready_for_review", "archived", "voided"],
  ready_for_review: ["draft", "validated", "archived", "voided"],
  validated: ["ready_for_review", "issued", "archived", "voided"],
  issued: ["archived", "voided"],
  archived: ["archived"],
  voided: ["voided"]
} as const satisfies Record<InvoiceLifecycleStatus, readonly InvoiceLifecycleStatus[]>;

const INVOICE_READER_ROLES = new Set<WorkspaceRole>(
  WORKSPACE_ROLE_SETS.invoiceDraftReaders
);
const INVOICE_MUTATOR_ROLES = new Set<WorkspaceRole>(
  WORKSPACE_ROLE_SETS.invoiceDraftEditors
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyOrNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function optionalDate(value: string | null | undefined) {
  return nonEmptyOrNull(value);
}

function hasBlockingFindings(findings: readonly ValidationFinding[]) {
  return findings.some(
    (finding) => finding.severity === "fatal" || finding.severity === "blocked"
  );
}

function countFindings(findings: ValidationFinding[]) {
  return findings.reduce(
    (counts, finding) => {
      counts[finding.severity] += 1;
      return counts;
    },
    {
      info: 0,
      warning: 0,
      fatal: 0,
      blocked: 0
    }
  );
}

function buildValidationSummary(
  findings: ValidationFinding[]
): ProductionInvoiceValidationSummary {
  const counts = countFindings(findings);

  return {
    status: counts.fatal > 0 || counts.blocked > 0 ? "blocked" : "ready",
    infoCount: counts.info,
    warningCount: counts.warning,
    fatalCount: counts.fatal,
    blockedCount: counts.blocked,
    findings,
    disclaimer: CANONICAL_INVOICE_LEGAL_DISCLAIMER
  };
}

function assertCanRead(context: WorkspaceAuthorizationContext) {
  if (INVOICE_READER_ROLES.has(context.membershipRole)) {
    return;
  }

  throw new InvoiceLifecycleServiceError(
    "PRODUCTION_INVOICE_READ_ROLE_REQUIRED",
    "Production invoice reading requires workspace membership with an allowed invoice-read role.",
    403
  );
}

function assertCanMutate(context: WorkspaceAuthorizationContext) {
  if (INVOICE_MUTATOR_ROLES.has(context.membershipRole)) {
    return;
  }

  throw new InvoiceLifecycleServiceError(
    "PRODUCTION_INVOICE_MUTATION_ROLE_REQUIRED",
    "Production invoice changes require an organization owner, admin, accountant, or reviewer role.",
    403
  );
}

function prepareCanonicalInvoice(input: unknown): PreparedCanonicalInvoice {
  const validation = validateCanonicalInvoice(input);

  if (!validation.success) {
    throw new InvoiceLifecycleServiceError(
      "CANONICAL_INVOICE_SCHEMA_INVALID",
      "Canonical invoice failed schema validation.",
      400,
      {
        findings: validation.findings,
        validationSummary: buildValidationSummary(validation.findings)
      }
    );
  }

  const initialCalculation = calculateInvoiceTotals(validation.invoice);
  const normalizedInvoice = canonicalInvoiceSchema.parse({
    ...validation.invoice,
    lines: validation.invoice.lines.map((line, index) => ({
      ...line,
      discountAmount: initialCalculation.lines[index]?.discountAmount,
      chargeAmount: initialCalculation.lines[index]?.chargeAmount,
      netAmount: initialCalculation.lines[index]?.netAmount,
      taxAmount: initialCalculation.lines[index]?.taxAmount
    })),
    taxBreakdown: initialCalculation.taxBreakdown,
    taxSubtotals: initialCalculation.taxSubtotals,
    totals: {
      ...validation.invoice.totals,
      ...initialCalculation.totals
    },
    legal: validation.invoice.legal
  });
  const calculationSummary = calculateInvoiceTotals(normalizedInvoice);
  const findings = validation.findings;
  const validationSummary = buildValidationSummary(findings);

  if (hasBlockingFindings(findings)) {
    throw new InvoiceLifecycleServiceError(
      "CANONICAL_INVOICE_BLOCKED",
      "Canonical invoice has fatal or blocked technical validation findings.",
      422,
      {
        findings,
        calculationSummary,
        validationSummary
      }
    );
  }

  return {
    invoice: normalizedInvoice,
    calculationSummary,
    validationSummary,
    findings
  };
}

function buildInvoiceCreateInput(
  context: WorkspaceAuthorizationContext,
  prepared: PreparedCanonicalInvoice,
  input: {
    source: ProductionInvoiceSource;
    draftId?: string | null | undefined;
    status?: InvoiceLifecycleStatus;
  }
) {
  const invoice = prepared.invoice;
  const legal = invoice.legal;

  return {
    draftId: input.draftId ?? undefined,
    invoiceNumber: invoice.document.number,
    invoiceType: invoice.document.type,
    profile: invoice.profile,
    issueDate: invoice.document.issueDate,
    dueDate: optionalDate(invoice.document.dueDate),
    taxPointDate: optionalDate(invoice.document.taxPointDate),
    currency: invoice.document.currency,
    buyerReference: nonEmptyOrNull(invoice.document.buyerReference),
    contractReference: nonEmptyOrNull(invoice.document.contractReference),
    orderReference: nonEmptyOrNull(invoice.document.orderReference),
    projectReference: nonEmptyOrNull(invoice.document.projectReference),
    accountingCost: nonEmptyOrNull(invoice.document.accountingCost),
    paymentTerms: nonEmptyOrNull(invoice.payment?.terms),
    paymentMeansCode: nonEmptyOrNull(invoice.payment?.paymentMeansCode),
    paymentReference: nonEmptyOrNull(invoice.payment?.paymentReference),
    sellerSnapshot: invoice.seller,
    buyerSnapshot: invoice.buyer,
    deliverySnapshot: invoice.delivery ?? {},
    paymentSnapshot: invoice.payment ?? {},
    canonicalJson: invoice,
    calculationSummary: prepared.calculationSummary,
    validationSummary: prepared.validationSummary,
    legalDisclaimer: legal.disclaimer || CANONICAL_INVOICE_LEGAL_DISCLAIMER,
    legalConfidence: legal.legalConfidence,
    status: input.status ?? "draft",
    source: input.source,
    createdBy: context.userId,
    updatedBy: context.userId,
    finalizedAt: null,
    issuedAt: null,
    archivedAt: null
  };
}

function buildLineInputs(prepared: PreparedCanonicalInvoice) {
  return prepared.invoice.lines.map((line, index) => {
    const calculatedLine = prepared.calculationSummary.lines[index];

    return {
      lineNumber: index + 1,
      description: line.description,
      itemName: nonEmptyOrNull(line.itemName),
      quantity: calculatedLine?.quantity ?? line.quantity,
      unitCode: line.unitCode,
      unitPrice: calculatedLine?.unitPrice ?? line.unitPrice,
      discountAmount: calculatedLine?.discountAmount ?? "0.00",
      chargeAmount: calculatedLine?.chargeAmount ?? "0.00",
      netAmount: calculatedLine?.netAmount ?? line.netAmount ?? "0.00",
      vatCategory: line.vatCategory,
      vatRate: calculatedLine?.vatRate ?? line.vatRate,
      accountingCost: nonEmptyOrNull(line.accountingCost),
      orderLineReference: nonEmptyOrNull(line.orderLineReference),
      metadata: {
        canonicalLineId: line.id || String(index + 1)
      }
    };
  });
}

function buildTaxInputs(prepared: PreparedCanonicalInvoice) {
  return prepared.calculationSummary.taxBreakdown.map((tax) => ({
    taxCategory: tax.taxCategory,
    taxScheme: tax.taxScheme,
    vatRate: tax.vatRate,
    taxableAmount: tax.taxableAmount,
    taxAmount: tax.taxAmount,
    exemptionReason: nonEmptyOrNull(tax.exemptionReason),
    exemptionReasonCode: nonEmptyOrNull(tax.exemptionReasonCode),
    metadata: {
      source: "canonical_tax_breakdown"
    }
  }));
}

function buildAdjustmentInput(
  adjustment: CanonicalInvoice["allowances"][number],
  lineIdMap: Map<string, string>
) {
  return {
    invoiceLineId:
      adjustment.scope === "line" && adjustment.lineId
        ? lineIdMap.get(adjustment.lineId) ?? null
        : null,
    scope: adjustment.scope,
    reason: nonEmptyOrNull(adjustment.reason),
    reasonCode: nonEmptyOrNull(adjustment.reasonCode),
    amount: adjustment.amount,
    baseAmount: adjustment.baseAmount ?? null,
    percentage: adjustment.percentage ?? null,
    taxCategory: nonEmptyOrNull(adjustment.taxCategory),
    vatRate: adjustment.vatRate ?? null,
    metadata: {
      canonicalAdjustmentId: adjustment.id || null,
      canonicalLineId: adjustment.lineId || null
    }
  };
}

async function persistJsonInvoiceChildren(
  organizationId: string,
  invoiceId: string,
  prepared: PreparedCanonicalInvoice
) {
  await deleteInvoiceChildrenByInvoiceId(organizationId, invoiceId);

  const lineIdMap = new Map<string, string>();
  const lineInputs = buildLineInputs(prepared);

  for (const [index, lineInput] of lineInputs.entries()) {
    const lineRecord = await createInvoiceLine(organizationId, invoiceId, lineInput);
    const canonicalLineId =
      String(lineInput.metadata.canonicalLineId || "") || String(index + 1);

    lineIdMap.set(canonicalLineId, lineRecord.id);
  }

  for (const taxInput of buildTaxInputs(prepared)) {
    await createInvoiceTax(organizationId, invoiceId, taxInput);
  }

  for (const allowance of prepared.invoice.allowances) {
    await createInvoiceAllowance(
      organizationId,
      invoiceId,
      buildAdjustmentInput(allowance, lineIdMap)
    );
  }

  for (const charge of prepared.invoice.charges) {
    await createInvoiceCharge(
      organizationId,
      invoiceId,
      buildAdjustmentInput(charge, lineIdMap)
    );
  }
}

function normalizeCanonicalInvoice(value: unknown): CanonicalInvoice {
  return canonicalInvoiceSchema.parse(value);
}

function normalizeCalculationSummary(value: unknown): InvoiceCalculationResult {
  if (isPlainObject(value) && Array.isArray(value.lines)) {
    const parsedCanonical = canonicalInvoiceSchema.safeParse({
      document: {
        type: "invoice",
        number: "SUMMARY",
        issueDate: "2026-01-01",
        currency: "EUR"
      },
      seller: {
        name: "Summary",
        country: "DE"
      },
      buyer: {
        name: "Summary",
        country: "DE"
      },
      lines: [
        {
          description: "Summary",
          quantity: "1",
          unitCode: "EA",
          unitPrice: "0",
          vatCategory: "S",
          vatRate: "0"
        }
      ]
    });

    if (parsedCanonical.success) {
      return value as InvoiceCalculationResult;
    }
  }

  return calculateInvoiceTotals(normalizeCanonicalInvoice(value));
}

function normalizeValidationSummary(
  value: unknown
): ProductionInvoiceValidationSummary {
  if (isPlainObject(value) && Array.isArray(value.findings)) {
    return value as ProductionInvoiceValidationSummary;
  }

  return buildValidationSummary([]);
}

function buildResponseFromInvoiceRecord(record: InvoiceRecord): ProductionInvoiceResponse {
  const canonicalInvoice = normalizeCanonicalInvoice(record.canonicalJson);
  const calculationSummary = normalizeCalculationSummary(record.calculationSummary);
  const validationSummary = normalizeValidationSummary(record.validationSummary);

  return {
    id: record.id,
    organizationId: record.organizationId,
    draftId: record.draftId ?? null,
    invoiceNumber: record.invoiceNumber,
    invoiceType: record.invoiceType,
    profile: record.profile,
    issueDate: record.issueDate,
    dueDate: record.dueDate ?? null,
    currency: record.currency,
    status: record.status,
    legalConfidence: record.legalConfidence,
    source: record.source,
    canonicalInvoice,
    calculationSummary,
    validationSummary,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    finalizedAt: record.finalizedAt ?? null,
    issuedAt: record.issuedAt ?? null,
    archivedAt: record.archivedAt ?? null
  };
}

function buildResponseFromSupabaseRow(row: SupabaseInvoiceRow): ProductionInvoiceResponse {
  return {
    id: row.id,
    organizationId: row.organization_id,
    draftId: row.draft_id,
    invoiceNumber: row.invoice_number,
    invoiceType: row.invoice_type,
    profile: row.profile,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    status: row.status,
    legalConfidence: row.legal_confidence,
    source: row.source,
    canonicalInvoice: normalizeCanonicalInvoice(row.canonical_json),
    calculationSummary: row.calculation_summary as InvoiceCalculationResult,
    validationSummary: normalizeValidationSummary(row.validation_summary),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at,
    issuedAt: row.issued_at,
    archivedAt: row.archived_at
  };
}

function buildJsonLifecycleMetadata(input: {
  source: string;
  invoiceNumber: string;
  note?: string;
}) {
  return {
    source: input.source,
    invoiceNumber: input.invoiceNumber,
    note: input.note ?? null,
    legalBoundary:
      "Invoice status is an internal Invoice Lantern workspace lifecycle state only. It is not official filing, authority acceptance, Peppol delivery, legal advice, tax advice, or accounting advice."
  };
}

async function recordJsonLifecycleEvent(input: {
  context: WorkspaceAuthorizationContext;
  invoiceId: string;
  fromStatus?: InvoiceLifecycleStatus | null | undefined;
  toStatus: InvoiceLifecycleStatus;
  reason?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
}) {
  return createInvoiceLifecycleEvent({
    organizationId: input.context.organizationId,
    invoiceId: input.invoiceId,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus,
    reason: input.reason ?? null,
    actorUserId: input.context.userId,
    metadata: input.metadata ?? {}
  });
}

async function recordSecurityEventSafe(input: {
  context: WorkspaceAuthorizationContext;
  eventType: string;
  severity?: "info" | "warning" | "high" | "critical";
  resourceId?: string;
  outcome?: "success" | "failure" | "blocked" | "recorded";
  metadata?: Record<string, unknown>;
}) {
  try {
    if (hasSupabaseServerConfig()) {
      const supabase = getSupabaseServiceRoleClient();

      await supabase.from("security_events").insert({
        organization_id: input.context.organizationId,
        actor_user_id: input.context.userId,
        event_type: input.eventType,
        severity: input.severity ?? "warning",
        category: "invoice_lifecycle",
        resource_type: "invoice",
        resource_id: input.resourceId ?? null,
        outcome: input.outcome ?? "blocked",
        metadata: input.metadata ?? {}
      });
      return;
    }

    await createSecurityEvent({
      organizationId: input.context.organizationId,
      actorUserId: input.context.userId,
      eventType: input.eventType,
      severity: input.severity ?? "warning",
      category: "invoice_lifecycle",
      resourceType: "invoice",
      resourceId: input.resourceId,
      outcome: input.outcome ?? "blocked",
      metadata: input.metadata ?? {}
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`Invoice lifecycle security event was not recorded: ${message}`);
  }
}

async function recordWorkspaceActivitySafe(input: {
  context: WorkspaceAuthorizationContext;
  eventType: string;
  entityId: string;
  entityLabel: string;
  severity?: "info" | "warning" | "error";
  metadata?: Record<string, unknown>;
}) {
  if (!hasSupabaseServerConfig()) {
    return;
  }

  try {
    const supabase = getSupabaseUserClient(input.context.accessToken);

    await supabase.from("workspace_activity_events").insert({
      organization_id: input.context.organizationId,
      actor_user_id: input.context.userId,
      event_type: input.eventType,
      entity_type: "invoice",
      entity_id: input.entityId,
      entity_label: input.entityLabel,
      severity: input.severity ?? "info",
      source: "api",
      metadata: input.metadata ?? {}
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`Invoice lifecycle activity event was not recorded: ${message}`);
  }
}

function mapSupabaseInvoiceValues(
  context: WorkspaceAuthorizationContext,
  prepared: PreparedCanonicalInvoice,
  input: {
    source: ProductionInvoiceSource;
    draftId?: string | null | undefined;
    status?: InvoiceLifecycleStatus;
    timestamps?: Partial<{
      finalizedAt: string | null;
      issuedAt: string | null;
      archivedAt: string | null;
    }>;
  }
) {
  const values = buildInvoiceCreateInput(context, prepared, input);

  return {
    organization_id: context.organizationId,
    draft_id: values.draftId ?? null,
    invoice_number: values.invoiceNumber,
    invoice_type: values.invoiceType,
    profile: values.profile,
    issue_date: values.issueDate,
    due_date: values.dueDate,
    tax_point_date: values.taxPointDate,
    currency: values.currency,
    buyer_reference: values.buyerReference,
    contract_reference: values.contractReference,
    order_reference: values.orderReference,
    project_reference: values.projectReference,
    accounting_cost: values.accountingCost,
    payment_terms: values.paymentTerms,
    payment_means_code: values.paymentMeansCode,
    payment_reference: values.paymentReference,
    seller_snapshot: values.sellerSnapshot,
    buyer_snapshot: values.buyerSnapshot,
    delivery_snapshot: values.deliverySnapshot,
    payment_snapshot: values.paymentSnapshot,
    canonical_json: values.canonicalJson,
    calculation_summary: values.calculationSummary,
    validation_summary: values.validationSummary,
    legal_disclaimer: values.legalDisclaimer,
    legal_confidence: values.legalConfidence,
    status: values.status,
    source: values.source,
    created_by: context.userId,
    updated_by: context.userId,
    finalized_at: input.timestamps?.finalizedAt ?? values.finalizedAt,
    issued_at: input.timestamps?.issuedAt ?? values.issuedAt,
    archived_at: input.timestamps?.archivedAt ?? values.archivedAt
  };
}

async function persistSupabaseInvoiceChildren(
  supabase: SupabaseClient,
  context: WorkspaceAuthorizationContext,
  invoiceId: string,
  prepared: PreparedCanonicalInvoice
) {
  for (const tableName of [
    "invoice_taxes",
    "invoice_allowances",
    "invoice_charges",
    "invoice_lines"
  ]) {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("organization_id", context.organizationId)
      .eq("invoice_id", invoiceId);

    if (error) {
      throw new InvoiceLifecycleServiceError(
        "PRODUCTION_INVOICE_CHILD_REPLACE_FAILED",
        `Could not clear ${tableName} rows for production invoice.`,
        500
      );
    }
  }

  const lineRows = buildLineInputs(prepared).map((line) => ({
    organization_id: context.organizationId,
    invoice_id: invoiceId,
    line_number: line.lineNumber,
    description: line.description,
    item_name: line.itemName,
    quantity: line.quantity,
    unit_code: line.unitCode,
    unit_price: line.unitPrice,
    discount_amount: line.discountAmount,
    charge_amount: line.chargeAmount,
    net_amount: line.netAmount,
    vat_category: line.vatCategory,
    vat_rate: line.vatRate,
    accounting_cost: line.accountingCost,
    order_line_reference: line.orderLineReference,
    metadata: line.metadata
  }));

  const lineIdMap = new Map<string, string>();

  if (lineRows.length > 0) {
    const { data, error } = await supabase
      .from("invoice_lines")
      .insert(lineRows)
      .select("id, line_number, metadata");

    if (error) {
      throw new InvoiceLifecycleServiceError(
        "PRODUCTION_INVOICE_LINE_PERSIST_FAILED",
        "Could not persist production invoice lines.",
        500
      );
    }

    for (const row of (data ?? []) as Array<{
      id: string;
      line_number: number;
      metadata: unknown;
    }>) {
      const metadata = isPlainObject(row.metadata) ? row.metadata : {};
      const canonicalLineId =
        typeof metadata.canonicalLineId === "string"
          ? metadata.canonicalLineId
          : String(row.line_number);

      lineIdMap.set(canonicalLineId, row.id);
    }
  }

  const taxRows = buildTaxInputs(prepared).map((tax) => ({
    organization_id: context.organizationId,
    invoice_id: invoiceId,
    invoice_line_id: null,
    tax_category: tax.taxCategory,
    tax_scheme: tax.taxScheme,
    vat_rate: tax.vatRate,
    taxable_amount: tax.taxableAmount,
    tax_amount: tax.taxAmount,
    exemption_reason: tax.exemptionReason,
    exemption_reason_code: tax.exemptionReasonCode,
    metadata: tax.metadata
  }));

  if (taxRows.length > 0) {
    const { error } = await supabase.from("invoice_taxes").insert(taxRows);

    if (error) {
      throw new InvoiceLifecycleServiceError(
        "PRODUCTION_INVOICE_TAX_PERSIST_FAILED",
        "Could not persist production invoice tax breakdown rows.",
        500
      );
    }
  }

  const allowanceRows = prepared.invoice.allowances.map((allowance) => {
    const input = buildAdjustmentInput(allowance, lineIdMap);

    return {
      organization_id: context.organizationId,
      invoice_id: invoiceId,
      invoice_line_id: input.invoiceLineId,
      scope: input.scope,
      reason: input.reason,
      reason_code: input.reasonCode,
      amount: input.amount,
      base_amount: input.baseAmount,
      percentage: input.percentage,
      tax_category: input.taxCategory,
      vat_rate: input.vatRate,
      metadata: input.metadata
    };
  });

  if (allowanceRows.length > 0) {
    const { error } = await supabase
      .from("invoice_allowances")
      .insert(allowanceRows);

    if (error) {
      throw new InvoiceLifecycleServiceError(
        "PRODUCTION_INVOICE_ALLOWANCE_PERSIST_FAILED",
        "Could not persist production invoice allowance rows.",
        500
      );
    }
  }

  const chargeRows = prepared.invoice.charges.map((charge) => {
    const input = buildAdjustmentInput(charge, lineIdMap);

    return {
      organization_id: context.organizationId,
      invoice_id: invoiceId,
      invoice_line_id: input.invoiceLineId,
      scope: input.scope,
      reason: input.reason,
      reason_code: input.reasonCode,
      amount: input.amount,
      base_amount: input.baseAmount,
      percentage: input.percentage,
      tax_category: input.taxCategory,
      vat_rate: input.vatRate,
      metadata: input.metadata
    };
  });

  if (chargeRows.length > 0) {
    const { error } = await supabase.from("invoice_charges").insert(chargeRows);

    if (error) {
      throw new InvoiceLifecycleServiceError(
        "PRODUCTION_INVOICE_CHARGE_PERSIST_FAILED",
        "Could not persist production invoice charge rows.",
        500
      );
    }
  }
}

async function createSupabaseLifecycleEvent(input: {
  supabase: SupabaseClient;
  context: WorkspaceAuthorizationContext;
  invoiceId: string;
  fromStatus?: InvoiceLifecycleStatus | null | undefined;
  toStatus: InvoiceLifecycleStatus;
  reason?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
}) {
  const { error } = await input.supabase.from("invoice_lifecycle_events").insert({
    organization_id: input.context.organizationId,
    invoice_id: input.invoiceId,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus,
    reason: input.reason ?? null,
    actor_user_id: input.context.userId,
    metadata: input.metadata ?? {}
  });

  if (error) {
    console.warn(`Invoice lifecycle event was not recorded: ${error.message}`);
  }
}

async function recordLifecycleEvent(input: {
  supabase?: SupabaseClient;
  context: WorkspaceAuthorizationContext;
  invoiceId: string;
  fromStatus?: InvoiceLifecycleStatus | null | undefined;
  toStatus: InvoiceLifecycleStatus;
  reason?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
}) {
  if (hasSupabaseServerConfig() && input.supabase) {
    await createSupabaseLifecycleEvent({
      supabase: input.supabase,
      context: input.context,
      invoiceId: input.invoiceId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: input.reason,
      metadata: input.metadata
    });
    return;
  }

  await recordJsonLifecycleEvent({
    context: input.context,
    invoiceId: input.invoiceId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reason: input.reason,
    metadata: input.metadata
  });
}

async function createProductionInvoiceJson(input: {
  context: WorkspaceAuthorizationContext;
  prepared: PreparedCanonicalInvoice;
  source: ProductionInvoiceSource;
  draftId?: string | null | undefined;
}) {
  const invoiceRecord = await createInvoice(
    input.context.organizationId,
    buildInvoiceCreateInput(input.context, input.prepared, {
      source: input.source,
      draftId: input.draftId ?? null
    })
  );

  await persistJsonInvoiceChildren(
    input.context.organizationId,
    invoiceRecord.id,
    input.prepared
  );

  await recordLifecycleEvent({
    context: input.context,
    invoiceId: invoiceRecord.id,
    fromStatus: null,
    toStatus: invoiceRecord.status,
    metadata: buildJsonLifecycleMetadata({
      source: input.source,
      invoiceNumber: invoiceRecord.invoiceNumber
    })
  });

  return buildResponseFromInvoiceRecord(invoiceRecord);
}

async function createProductionInvoiceSupabase(input: {
  context: WorkspaceAuthorizationContext;
  prepared: PreparedCanonicalInvoice;
  source: ProductionInvoiceSource;
  draftId?: string | null | undefined;
}) {
  const supabase = getSupabaseUserClient(input.context.accessToken);
  const { data, error } = await supabase
    .from("invoices")
    .insert(
      mapSupabaseInvoiceValues(input.context, input.prepared, {
        source: input.source,
        draftId: input.draftId ?? null
      })
    )
    .select(INVOICE_SELECT_FIELDS)
    .single();

  if (error) {
    throw new InvoiceLifecycleServiceError(
      "PRODUCTION_INVOICE_CREATE_FAILED",
      `Could not create production invoice: ${error.message}`,
      500
    );
  }

  const row = data as SupabaseInvoiceRow;

  try {
    await persistSupabaseInvoiceChildren(
      supabase,
      input.context,
      row.id,
      input.prepared
    );
  } catch (error) {
    await supabase
      .from("invoices")
      .delete()
      .eq("id", row.id)
      .eq("organization_id", input.context.organizationId);
    throw error;
  }

  await recordLifecycleEvent({
    supabase,
    context: input.context,
    invoiceId: row.id,
    fromStatus: null,
    toStatus: row.status,
    metadata: buildJsonLifecycleMetadata({
      source: input.source,
      invoiceNumber: row.invoice_number
    })
  });

  return buildResponseFromSupabaseRow(row);
}

export async function createProductionInvoice(input: {
  context: WorkspaceAuthorizationContext;
  canonicalInvoice: unknown;
  source?: ProductionInvoiceSource;
  draftId?: string | null | undefined;
}) {
  assertCanMutate(input.context);

  const prepared = prepareCanonicalInvoice(input.canonicalInvoice);
  const source = input.source ?? "manual";
  const response = hasSupabaseServerConfig()
    ? await createProductionInvoiceSupabase({
        context: input.context,
        prepared,
        source,
        draftId: input.draftId
      })
    : await createProductionInvoiceJson({
        context: input.context,
        prepared,
        source,
        draftId: input.draftId
      });

  await recordWorkspaceActivitySafe({
    context: input.context,
    eventType: input.draftId
      ? "production_invoice.created_from_draft"
      : "production_invoice.created",
    entityId: response.id,
    entityLabel: response.invoiceNumber,
    metadata: {
      invoiceNumber: response.invoiceNumber,
      draftId: input.draftId ?? null,
      source,
      status: response.status,
      payableAmount: response.calculationSummary.totals.payableAmount
    }
  });

  return response;
}

async function getSupabaseInvoice(
  context: WorkspaceAuthorizationContext,
  id: string
) {
  const supabase = getSupabaseUserClient(context.accessToken);
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("id", id)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (error) {
    throw new InvoiceLifecycleServiceError(
      "PRODUCTION_INVOICE_READ_FAILED",
      `Could not read production invoice: ${error.message}`,
      500
    );
  }

  return data ? buildResponseFromSupabaseRow(data as SupabaseInvoiceRow) : null;
}

export async function getProductionInvoice(input: {
  context: WorkspaceAuthorizationContext;
  id: string;
}) {
  assertCanRead(input.context);

  if (hasSupabaseServerConfig()) {
    return getSupabaseInvoice(input.context, input.id);
  }

  const record = await getInvoiceById(input.context.organizationId, input.id);

  return record ? buildResponseFromInvoiceRecord(record) : null;
}

export async function listProductionInvoices(input: {
  context: WorkspaceAuthorizationContext;
  filters?: {
    status?: InvoiceLifecycleStatus;
    invoiceNumber?: string;
  };
}) {
  assertCanRead(input.context);

  if (hasSupabaseServerConfig()) {
    const supabase = getSupabaseUserClient(input.context.accessToken);
    let query = supabase
      .from("invoices")
      .select(INVOICE_SELECT_FIELDS)
      .eq("organization_id", input.context.organizationId)
      .order("updated_at", {
        ascending: false
      });

    if (input.filters?.status) {
      query = query.eq("status", input.filters.status);
    }

    if (input.filters?.invoiceNumber) {
      query = query.eq("invoice_number", input.filters.invoiceNumber);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      throw new InvoiceLifecycleServiceError(
        "PRODUCTION_INVOICE_LIST_FAILED",
        `Could not list production invoices: ${error.message}`,
        500
      );
    }

    return ((data ?? []) as SupabaseInvoiceRow[]).map((row) =>
      buildResponseFromSupabaseRow(row)
    );
  }

  const records = await listInvoices(input.context.organizationId, input.filters);

  return records.map((record) => buildResponseFromInvoiceRecord(record));
}

function assertInvoiceIsEditable(invoice: ProductionInvoiceResponse) {
  if (
    invoice.status === "draft" ||
    invoice.status === "ready_for_review" ||
    invoice.status === "validated"
  ) {
    return;
  }

  throw new InvoiceLifecycleServiceError(
    "PRODUCTION_INVOICE_STATUS_LOCKED",
    "Issued, archived, and voided invoices cannot be edited in Step 5 without a future correction flow.",
    409
  );
}

function getStatusAfterContentUpdate(currentStatus: InvoiceLifecycleStatus) {
  return currentStatus === "validated" ? "ready_for_review" : currentStatus;
}

function getTimestampUpdatesForStatus(status: InvoiceLifecycleStatus) {
  const now = new Date().toISOString();

  return {
    finalizedAt:
      status === "ready_for_review" || status === "validated" ? now : undefined,
    issuedAt: status === "issued" ? now : undefined,
    archivedAt: status === "archived" ? now : undefined
  };
}

export async function updateProductionInvoice(input: {
  context: WorkspaceAuthorizationContext;
  id: string;
  canonicalInvoice: unknown;
}) {
  assertCanMutate(input.context);

  const existing = await getProductionInvoice({
    context: input.context,
    id: input.id
  });

  if (!existing) {
    return null;
  }

  assertInvoiceIsEditable(existing);

  const prepared = prepareCanonicalInvoice(input.canonicalInvoice);
  const nextStatus = getStatusAfterContentUpdate(existing.status);
  const timestampUpdates = getTimestampUpdatesForStatus(nextStatus);

  if (hasSupabaseServerConfig()) {
    const supabase = getSupabaseUserClient(input.context.accessToken);
    const {
      created_by: _createdBy,
      ...supabaseInvoiceUpdateValues
    } = mapSupabaseInvoiceValues(input.context, prepared, {
      source: existing.source as ProductionInvoiceSource,
      draftId: existing.draftId,
      status: nextStatus,
      timestamps: {
        finalizedAt:
          timestampUpdates.finalizedAt ?? existing.finalizedAt ?? null,
        issuedAt: existing.issuedAt,
        archivedAt: existing.archivedAt
      }
    });
    const { data, error } = await supabase
      .from("invoices")
      .update(supabaseInvoiceUpdateValues)
      .eq("id", input.id)
      .eq("organization_id", input.context.organizationId)
      .select(INVOICE_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw new InvoiceLifecycleServiceError(
        "PRODUCTION_INVOICE_UPDATE_FAILED",
        `Could not update production invoice: ${error.message}`,
        500
      );
    }

    if (!data) {
      return null;
    }

    const row = data as SupabaseInvoiceRow;

    await persistSupabaseInvoiceChildren(supabase, input.context, row.id, prepared);

    if (nextStatus !== existing.status) {
      await recordLifecycleEvent({
        supabase,
        context: input.context,
        invoiceId: row.id,
        fromStatus: existing.status,
        toStatus: nextStatus,
        reason: "Invoice content updated after validation.",
        metadata: buildJsonLifecycleMetadata({
          source: "api",
          invoiceNumber: row.invoice_number,
          note: "Content update moved the invoice back to review."
        })
      });
    }

    const response = buildResponseFromSupabaseRow(row);

    await recordWorkspaceActivitySafe({
      context: input.context,
      eventType: "production_invoice.updated",
      entityId: response.id,
      entityLabel: response.invoiceNumber,
      metadata: {
        invoiceNumber: response.invoiceNumber,
        previousStatus: existing.status,
        status: response.status
      }
    });

    return response;
  }

  const updated = await updateInvoiceById(input.context.organizationId, input.id, {
    ...buildInvoiceCreateInput(input.context, prepared, {
      source: existing.source as ProductionInvoiceSource,
      draftId: existing.draftId,
      status: nextStatus
    }),
    finalizedAt: timestampUpdates.finalizedAt ?? existing.finalizedAt,
    issuedAt: existing.issuedAt,
    archivedAt: existing.archivedAt
  });

  if (!updated) {
    return null;
  }

  await persistJsonInvoiceChildren(input.context.organizationId, input.id, prepared);

  if (nextStatus !== existing.status) {
    await recordLifecycleEvent({
      context: input.context,
      invoiceId: input.id,
      fromStatus: existing.status,
      toStatus: nextStatus,
      reason: "Invoice content updated after validation.",
      metadata: buildJsonLifecycleMetadata({
        source: "api",
        invoiceNumber: updated.invoiceNumber,
        note: "Content update moved the invoice back to review."
      })
    });
  }

  const response = buildResponseFromInvoiceRecord(updated);

  await recordWorkspaceActivitySafe({
    context: input.context,
    eventType: "production_invoice.updated",
    entityId: response.id,
    entityLabel: response.invoiceNumber,
    metadata: {
      invoiceNumber: response.invoiceNumber,
      previousStatus: existing.status,
      status: response.status
    }
  });

  return response;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function getDraftForConversion(
  context: WorkspaceAuthorizationContext,
  draftId: string
): Promise<InvoiceDraftRecord | null> {
  if (!hasSupabaseServerConfig()) {
    const draft = await getInvoiceDraftById(draftId);

    if (!draft) {
      return null;
    }

    const draftOrganizationId = (draft as InvoiceDraftRecord & {
      organizationId?: unknown;
    }).organizationId;

    if (
      typeof draftOrganizationId === "string" &&
      draftOrganizationId.trim() &&
      draftOrganizationId !== context.organizationId
    ) {
      return null;
    }

    return draft;
  }

  const supabase = getSupabaseUserClient(context.accessToken);
  const { data, error } = await supabase
    .from("invoice_drafts")
    .select("id, payload, created_at, updated_at")
    .eq("id", draftId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (error) {
    throw new InvoiceLifecycleServiceError(
      "INVOICE_DRAFT_READ_FAILED",
      `Could not read invoice draft for conversion: ${error.message}`,
      500
    );
  }

  if (!data || !isPlainObject(data) || !isPlainObject(data.payload)) {
    return null;
  }

  return {
    ...(data.payload as InvoiceDraftRecord),
    id: String(data.id),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at)
  };
}

function buildCanonicalInputFromDraft(draft: InvoiceDraftRecord) {
  const { id, createdAt, updatedAt, ...payload } = draft as InvoiceDraftRecord & {
    organizationId?: string;
    metadata?: unknown;
  };
  const { organizationId: _organizationId, ...draftPayload } = payload;
  const draftRecord = draftPayload as typeof draftPayload & {
    metadata?: unknown;
  };
  const existingMetadata = isPlainObject(draftRecord.metadata)
    ? draftRecord.metadata
    : {};

  return {
    ...draftPayload,
    metadata: {
      ...existingMetadata,
      source: "invoice_draft",
      sourceDraftId: id,
      sourceDraftCreatedAt: createdAt,
      sourceDraftUpdatedAt: updatedAt
    }
  };
}

export async function createProductionInvoiceFromDraft(input: {
  context: WorkspaceAuthorizationContext;
  draftId: string;
  source?: ProductionInvoiceSource;
}) {
  assertCanMutate(input.context);

  const draft = await getDraftForConversion(input.context, input.draftId);

  if (!draft) {
    return null;
  }

  return createProductionInvoice({
    context: input.context,
    canonicalInvoice: buildCanonicalInputFromDraft(draft),
    source: input.source ?? "manual",
    draftId: isUuid(input.draftId) ? input.draftId : null
  });
}

function isAllowedTransition(
  fromStatus: InvoiceLifecycleStatus,
  toStatus: InvoiceLifecycleStatus
) {
  if (fromStatus === toStatus) {
    return fromStatus === "archived" || fromStatus === "voided";
  }

  return (ALLOWED_TRANSITIONS[fromStatus] as readonly InvoiceLifecycleStatus[]).includes(
    toStatus
  );
}

function buildTransitionUpdate(
  invoice: ProductionInvoiceResponse,
  toStatus: InvoiceLifecycleStatus
) {
  const now = new Date().toISOString();

  return {
    status: toStatus,
    finalizedAt:
      (toStatus === "ready_for_review" || toStatus === "validated") &&
      !invoice.finalizedAt
        ? now
        : invoice.finalizedAt,
    issuedAt: toStatus === "issued" && !invoice.issuedAt ? now : invoice.issuedAt,
    archivedAt:
      toStatus === "archived" && !invoice.archivedAt ? now : invoice.archivedAt
  };
}

export async function transitionProductionInvoice(input: {
  context: WorkspaceAuthorizationContext;
  id: string;
  toStatus: InvoiceLifecycleStatus;
  reason?: string | undefined;
}) {
  assertCanMutate(input.context);

  const invoice = await getProductionInvoice({
    context: input.context,
    id: input.id
  });

  if (!invoice) {
    return null;
  }

  if (!isAllowedTransition(invoice.status, input.toStatus)) {
    await recordSecurityEventSafe({
      context: input.context,
      eventType: "invoice_lifecycle.invalid_transition_blocked",
      resourceId: invoice.id,
      metadata: {
        fromStatus: invoice.status,
        toStatus: input.toStatus,
        invoiceNumber: invoice.invoiceNumber
      }
    });

    throw new InvoiceLifecycleServiceError(
      "INVOICE_LIFECYCLE_TRANSITION_INVALID",
      "Requested invoice status transition is not allowed by the Step 5 lifecycle policy.",
      409
    );
  }

  const update = buildTransitionUpdate(invoice, input.toStatus);
  let response: ProductionInvoiceResponse;

  if (hasSupabaseServerConfig()) {
    const supabase = getSupabaseUserClient(input.context.accessToken);
    const { data, error } = await supabase
      .from("invoices")
      .update({
        status: update.status,
        finalized_at: update.finalizedAt,
        issued_at: update.issuedAt,
        archived_at: update.archivedAt,
        updated_by: input.context.userId
      })
      .eq("id", input.id)
      .eq("organization_id", input.context.organizationId)
      .select(INVOICE_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw new InvoiceLifecycleServiceError(
        "INVOICE_LIFECYCLE_TRANSITION_FAILED",
        `Could not transition production invoice: ${error.message}`,
        500
      );
    }

    if (!data) {
      return null;
    }

    response = buildResponseFromSupabaseRow(data as SupabaseInvoiceRow);

    await recordLifecycleEvent({
      supabase,
      context: input.context,
      invoiceId: response.id,
      fromStatus: invoice.status,
      toStatus: response.status,
      reason: input.reason ?? null,
      metadata: buildJsonLifecycleMetadata({
        source: "api",
        invoiceNumber: response.invoiceNumber
      })
    });
  } else {
    const updated = await updateInvoiceById(input.context.organizationId, input.id, {
      status: update.status,
      finalizedAt: update.finalizedAt,
      issuedAt: update.issuedAt,
      archivedAt: update.archivedAt,
      updatedBy: input.context.userId
    });

    if (!updated) {
      return null;
    }

    response = buildResponseFromInvoiceRecord(updated);

    await recordLifecycleEvent({
      context: input.context,
      invoiceId: response.id,
      fromStatus: invoice.status,
      toStatus: response.status,
      reason: input.reason ?? null,
      metadata: buildJsonLifecycleMetadata({
        source: "api",
        invoiceNumber: response.invoiceNumber
      })
    });
  }

  await recordWorkspaceActivitySafe({
    context: input.context,
    eventType:
      response.status === "archived"
        ? "production_invoice.archived"
        : response.status === "voided"
          ? "production_invoice.voided"
          : "production_invoice.status_transitioned",
    entityId: response.id,
    entityLabel: response.invoiceNumber,
    severity: response.status === "voided" ? "warning" : "info",
    metadata: {
      invoiceNumber: response.invoiceNumber,
      fromStatus: invoice.status,
      toStatus: response.status,
      reason: input.reason ?? null,
      issuedStateBoundary:
        "The issued status is internal only and is not official filing, authority acceptance, Peppol delivery, legal advice, tax advice, or accounting advice."
    }
  });

  return response;
}

function normalizeLifecycleEventRow(
  row: SupabaseLifecycleEventRow
): InvoiceLifecycleEventRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    invoiceId: row.invoice_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    actorUserId: row.actor_user_id,
    actorApiKeyId: row.actor_api_key_id,
    metadata: isPlainObject(row.metadata) ? row.metadata : {},
    createdAt: row.created_at
  };
}

export async function listProductionInvoiceLifecycleEvents(input: {
  context: WorkspaceAuthorizationContext;
  invoiceId: string;
}) {
  assertCanRead(input.context);

  const invoice = await getProductionInvoice({
    context: input.context,
    id: input.invoiceId
  });

  if (!invoice) {
    return null;
  }

  if (hasSupabaseServerConfig()) {
    const supabase = getSupabaseUserClient(input.context.accessToken);
    const { data, error } = await supabase
      .from("invoice_lifecycle_events")
      .select(LIFECYCLE_EVENT_SELECT_FIELDS)
      .eq("organization_id", input.context.organizationId)
      .eq("invoice_id", input.invoiceId)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      throw new InvoiceLifecycleServiceError(
        "INVOICE_LIFECYCLE_EVENTS_READ_FAILED",
        `Could not read invoice lifecycle events: ${error.message}`,
        500
      );
    }

    return ((data ?? []) as SupabaseLifecycleEventRow[]).map((row) =>
      normalizeLifecycleEventRow(row)
    );
  }

  return listInvoiceLifecycleEvents(input.context.organizationId, input.invoiceId);
}

export function mapRepositoryError(error: unknown) {
  if (error instanceof InvoiceLifecycleServiceError) {
    return error;
  }

  if (error instanceof ProductionDataModelRepositoryError) {
    const statusCode =
      error.code === "INVOICE_NOT_FOUND" ||
      error.code === "BUSINESS_PROFILE_NOT_FOUND" ||
      error.code === "CONTACT_NOT_FOUND"
        ? 404
        : error.code === "INVOICE_NUMBER_NOT_UNIQUE"
          ? 409
          : 400;

    return new InvoiceLifecycleServiceError(error.code, error.message, statusCode);
  }

  return error;
}
