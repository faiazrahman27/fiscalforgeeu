import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceEditorDraftPayload } from "../schemas/invoice.js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type InvoiceDraftRecord = InvoiceEditorDraftPayload & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceDraftSummary = {
  id: string;
  number: string;
  buyer: string;
  buyerCountry: string;
  issueDate: string;
  status: "Draft";
  amount: string;
  currency: string;
  updatedAt: string;
};

export type AuthenticatedInvoiceDraftContext = {
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

type SupabaseInvoiceDraftRow = {
  id: string;
  organization_id: string;
  created_by: string;
  invoice_number: string;
  seller_name: string;
  seller_country: string;
  buyer_name: string;
  buyer_country: string;
  issue_date: string;
  due_date: string;
  invoice_type: string;
  profile: string;
  buyer_reference: string;
  contract_reference: string;
  currency: string;
  line_extension_amount: string;
  tax_exclusive_amount: string;
  tax_amount: string;
  tax_inclusive_amount: string;
  payable_amount: string;
  payload: unknown;
  summary: unknown;
  created_at: string;
  updated_at: string;
};

type InvoiceDraftPartyRole = "seller" | "buyer";

type InvoiceDraftPartyRow = {
  organization_id: string;
  invoice_draft_id: string;
  party_role: InvoiceDraftPartyRole;
  name: string;
  country: string;
  vat_id: string;
  city: string;
  postal_code: string;
  street: string;
  electronic_address: string;
};

type InvoiceDraftLineRow = {
  organization_id: string;
  invoice_draft_id: string;
  source_line_id: string;
  line_position: number;
  description: string;
  quantity: number;
  unit_code: string;
  unit_price: number;
  vat_category: string;
  vat_rate: number;
  net_amount: number;
};

type InvoiceDraftTaxSummaryRow = {
  organization_id: string;
  invoice_draft_id: string;
  vat_category: string;
  vat_rate: number;
  taxable_amount: number;
  tax_amount: number;
  currency: string;
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

const INVOICE_DRAFTS_FILE = "invoice-drafts.json";
const MAX_STORED_INVOICE_DRAFTS = 250;
const INVOICE_DRAFT_SELECT_FIELDS =
  "id, organization_id, created_by, invoice_number, seller_name, seller_country, buyer_name, buyer_country, issue_date, due_date, invoice_type, profile, buyer_reference, contract_reference, currency, line_extension_amount, tax_exclusive_amount, tax_amount, tax_inclusive_amount, payable_amount, payload, summary, created_at, updated_at";

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

function parseDecimalString(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(2));
}

function getDraftNumberKey(draft: Pick<InvoiceDraftRecord, "document">) {
  return draft.document.number.trim().toUpperCase();
}

function getPayloadNumberKey(payload: InvoiceEditorDraftPayload) {
  return payload.document.number.trim().toUpperCase();
}

function sortDraftsByUpdatedAt(drafts: InvoiceDraftRecord[]) {
  return [...drafts].sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt)
  );
}

function uniqueDraftsByInvoiceNumber(drafts: InvoiceDraftRecord[]) {
  const seen = new Set<string>();

  return sortDraftsByUpdatedAt(drafts).filter((draft) => {
    const key = getDraftNumberKey(draft);

    if (!key) {
      return true;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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

function normalizeSupabaseInvoiceDraftRow(
  row: SupabaseInvoiceDraftRow
): InvoiceDraftRecord | null {
  if (!isPlainObject(row.payload)) {
    return null;
  }

  const payload = row.payload as InvoiceEditorDraftPayload;

  if (
    !isPlainObject(payload.document) ||
    !isPlainObject(payload.buyer) ||
    !isPlainObject(payload.seller) ||
    !Array.isArray(payload.lines) ||
    !isPlainObject(payload.totals)
  ) {
    return null;
  }

  return {
    ...payload,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildSupabaseInvoiceDraftValues(
  payload: InvoiceEditorDraftPayload,
  organizationId: string,
  userId: string
) {
  return {
    organization_id: organizationId,
    created_by: userId,

    invoice_number: payload.document.number,
    issue_date: payload.document.issueDate,
    due_date: payload.document.dueDate,
    invoice_type: payload.document.invoiceType,
    profile: payload.document.profile,
    buyer_reference: payload.document.buyerReference,
    contract_reference: payload.document.contractReference,

    seller_name: payload.seller.name,
    seller_country: payload.seller.country,
    buyer_name: payload.buyer.name,
    buyer_country: payload.buyer.country,

    currency: payload.document.currency,
    line_extension_amount: payload.totals.lineExtensionAmount,
    tax_exclusive_amount: payload.totals.taxExclusiveAmount,
    tax_amount: payload.totals.taxAmount,
    tax_inclusive_amount: payload.totals.taxInclusiveAmount,
    payable_amount: payload.totals.payableAmount,

    payload,
    summary: {
      number: payload.document.number,
      issueDate: payload.document.issueDate,
      dueDate: payload.document.dueDate,
      invoiceType: payload.document.invoiceType,
      profile: payload.document.profile,
      buyerReference: payload.document.buyerReference,
      contractReference: payload.document.contractReference,

      seller: payload.seller.name,
      sellerCountry: payload.seller.country,
      buyer: payload.buyer.name,
      buyerCountry: payload.buyer.country,

      status: "Draft",
      currency: payload.document.currency,
      lineExtensionAmount: payload.totals.lineExtensionAmount,
      taxExclusiveAmount: payload.totals.taxExclusiveAmount,
      taxAmount: payload.totals.taxAmount,
      taxInclusiveAmount: payload.totals.taxInclusiveAmount,
      payableAmount: payload.totals.payableAmount,
      amount: `${payload.document.currency} ${payload.totals.payableAmount}`
    }
  };
}

function buildInvoiceDraftActivityMetadata(payload: InvoiceEditorDraftPayload) {
  return {
    invoiceNumber: payload.document.number,
    invoiceType: payload.document.invoiceType,
    profile: payload.document.profile,
    issueDate: payload.document.issueDate,
    dueDate: payload.document.dueDate,
    currency: payload.document.currency,
    sellerName: payload.seller.name,
    sellerCountry: payload.seller.country,
    buyerName: payload.buyer.name,
    buyerCountry: payload.buyer.country,
    lineCount: payload.lines.length,
    payableAmount: payload.totals.payableAmount
  };
}

function buildInvoiceDraftPartyRows(
  payload: InvoiceEditorDraftPayload,
  organizationId: string,
  invoiceDraftId: string
): InvoiceDraftPartyRow[] {
  return [
    {
      organization_id: organizationId,
      invoice_draft_id: invoiceDraftId,
      party_role: "seller",
      name: payload.seller.name,
      country: payload.seller.country,
      vat_id: payload.seller.vatId,
      city: payload.seller.city,
      postal_code: payload.seller.postalCode,
      street: payload.seller.street,
      electronic_address: payload.seller.electronicAddress
    },
    {
      organization_id: organizationId,
      invoice_draft_id: invoiceDraftId,
      party_role: "buyer",
      name: payload.buyer.name,
      country: payload.buyer.country,
      vat_id: payload.buyer.vatId,
      city: payload.buyer.city,
      postal_code: payload.buyer.postalCode,
      street: payload.buyer.street,
      electronic_address: payload.buyer.electronicAddress
    }
  ];
}

function calculateLineNetAmount(line: InvoiceEditorDraftPayload["lines"][number]) {
  const explicitNetAmount = parseDecimalString(line.netAmount);

  if (explicitNetAmount > 0) {
    return roundMoney(explicitNetAmount);
  }

  const quantity = parseDecimalString(line.quantity);
  const unitPrice = parseDecimalString(line.unitPrice);

  return roundMoney(quantity * unitPrice);
}

function buildInvoiceDraftLineRows(
  payload: InvoiceEditorDraftPayload,
  organizationId: string,
  invoiceDraftId: string
): InvoiceDraftLineRow[] {
  return payload.lines.map((line, index) => {
    return {
      organization_id: organizationId,
      invoice_draft_id: invoiceDraftId,
      source_line_id: line.id,
      line_position: index + 1,
      description: line.description,
      quantity: parseDecimalString(line.quantity),
      unit_code: line.unitCode,
      unit_price: parseDecimalString(line.unitPrice),
      vat_category: line.vatCategory,
      vat_rate: parseDecimalString(line.vatRate),
      net_amount: calculateLineNetAmount(line)
    };
  });
}

function buildInvoiceDraftTaxSummaryRows(
  payload: InvoiceEditorDraftPayload,
  organizationId: string,
  invoiceDraftId: string
): InvoiceDraftTaxSummaryRow[] {
  const taxSummaryMap = new Map<
    string,
    {
      vatCategory: string;
      vatRate: number;
      taxableAmount: number;
      taxAmount: number;
    }
  >();

  for (const line of payload.lines) {
    const vatCategory = line.vatCategory.trim();
    const vatRate = parseDecimalString(line.vatRate);
    const taxableAmount = calculateLineNetAmount(line);
    const taxAmount = roundMoney((taxableAmount * vatRate) / 100);
    const key = `${vatCategory}::${vatRate.toFixed(4)}`;

    const existingSummary = taxSummaryMap.get(key);

    if (existingSummary) {
      existingSummary.taxableAmount = roundMoney(
        existingSummary.taxableAmount + taxableAmount
      );
      existingSummary.taxAmount = roundMoney(existingSummary.taxAmount + taxAmount);
      continue;
    }

    taxSummaryMap.set(key, {
      vatCategory,
      vatRate,
      taxableAmount,
      taxAmount
    });
  }

  return [...taxSummaryMap.values()].map((summary) => ({
    organization_id: organizationId,
    invoice_draft_id: invoiceDraftId,
    vat_category: summary.vatCategory,
    vat_rate: summary.vatRate,
    taxable_amount: summary.taxableAmount,
    tax_amount: summary.taxAmount,
    currency: payload.document.currency
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
     * Activity logging must not break the main invoice operation.
     * The source record and relational rows remain the authoritative data.
     */
    console.warn(`Workspace activity event was not recorded: ${error.message}`);
  }
}

async function replaceInvoiceDraftRelationalRows(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceDraftId: string,
  payload: InvoiceEditorDraftPayload
) {
  const childTables = [
    "invoice_draft_tax_summaries",
    "invoice_draft_lines",
    "invoice_draft_parties"
  ];

  for (const tableName of childTables) {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("organization_id", organizationId)
      .eq("invoice_draft_id", invoiceDraftId);

    if (error) {
      throw new Error(
        `Could not clear ${tableName} rows for invoice draft: ${error.message}`
      );
    }
  }

  const partyRows = buildInvoiceDraftPartyRows(
    payload,
    organizationId,
    invoiceDraftId
  );

  const lineRows = buildInvoiceDraftLineRows(
    payload,
    organizationId,
    invoiceDraftId
  );

  const taxSummaryRows = buildInvoiceDraftTaxSummaryRows(
    payload,
    organizationId,
    invoiceDraftId
  );

  const { error: partyInsertError } = await supabase
    .from("invoice_draft_parties")
    .insert(partyRows);

  if (partyInsertError) {
    throw new Error(
      `Could not insert invoice draft party rows: ${partyInsertError.message}`
    );
  }

  if (lineRows.length > 0) {
    const { error: lineInsertError } = await supabase
      .from("invoice_draft_lines")
      .insert(lineRows);

    if (lineInsertError) {
      throw new Error(
        `Could not insert invoice draft line rows: ${lineInsertError.message}`
      );
    }
  }

  if (taxSummaryRows.length > 0) {
    const { error: taxSummaryInsertError } = await supabase
      .from("invoice_draft_tax_summaries")
      .insert(taxSummaryRows);

    if (taxSummaryInsertError) {
      throw new Error(
        `Could not insert invoice draft tax summary rows: ${taxSummaryInsertError.message}`
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

async function listSupabaseInvoiceDrafts(
  supabase: SupabaseClient,
  organizationId: string
) {
  const { data, error } = await supabase
    .from("invoice_drafts")
    .select(INVOICE_DRAFT_SELECT_FIELDS)
    .eq("organization_id", organizationId)
    .order("updated_at", {
      ascending: false
    })
    .limit(MAX_STORED_INVOICE_DRAFTS);

  if (error) {
    throw new Error(`Could not list Supabase invoice drafts: ${error.message}`);
  }

  return ((data ?? []) as SupabaseInvoiceDraftRow[])
    .map((row) => normalizeSupabaseInvoiceDraftRow(row))
    .filter((draft): draft is InvoiceDraftRecord => draft !== null);
}

function createAuthenticatedSupabaseClient(
  context: AuthenticatedInvoiceDraftContext
) {
  return getSupabaseUserClient(context.accessToken);
}

export function hasAuthenticatedInvoiceDraftContext(
  context: AuthenticatedInvoiceDraftContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export function buildDraftSummary(
  draft: InvoiceDraftRecord
): InvoiceDraftSummary {
  return {
    id: draft.id,
    number: draft.document.number,
    buyer: draft.buyer.name,
    buyerCountry: draft.buyer.country,
    issueDate: draft.document.issueDate,
    status: "Draft",
    amount: `${draft.document.currency} ${draft.totals.payableAmount}`,
    currency: draft.document.currency,
    updatedAt: draft.updatedAt
  };
}

/* -------------------------------------------------------------------------- */
/* Local JSON-backed draft storage                                            */
/* -------------------------------------------------------------------------- */

export async function listInvoiceDrafts() {
  return storageProvider.readCollection<InvoiceDraftRecord>(INVOICE_DRAFTS_FILE);
}

export async function listInvoiceDraftSummaries() {
  const drafts = await listInvoiceDrafts();

  return uniqueDraftsByInvoiceNumber(drafts).map(buildDraftSummary);
}

export async function createInvoiceDraft(
  payload: InvoiceEditorDraftPayload
): Promise<InvoiceDraftRecord> {
  const now = new Date().toISOString();
  const currentDrafts = await listInvoiceDrafts();
  const payloadNumberKey = getPayloadNumberKey(payload);

  const existingDraft = payloadNumberKey
    ? currentDrafts.find((draft) => {
        return getDraftNumberKey(draft) === payloadNumberKey;
      })
    : undefined;

  const nextDraft: InvoiceDraftRecord = existingDraft
    ? {
        ...payload,
        id: existingDraft.id,
        createdAt: existingDraft.createdAt,
        updatedAt: now
      }
    : {
        ...payload,
        id: `draft_${randomUUID()}`,
        createdAt: now,
        updatedAt: now
      };

  const nextDrafts = [
    nextDraft,
    ...currentDrafts.filter((draft) => {
      if (draft.id === nextDraft.id) {
        return false;
      }

      if (payloadNumberKey && getDraftNumberKey(draft) === payloadNumberKey) {
        return false;
      }

      return true;
    })
  ].slice(0, MAX_STORED_INVOICE_DRAFTS);

  await storageProvider.writeCollection(INVOICE_DRAFTS_FILE, nextDrafts);

  return nextDraft;
}

export async function updateInvoiceDraftById(
  id: string,
  payload: InvoiceEditorDraftPayload
) {
  const currentDrafts = await listInvoiceDrafts();
  const existingDraft = currentDrafts.find((draft) => draft.id === id);

  if (!existingDraft) {
    return null;
  }

  const now = new Date().toISOString();
  const payloadNumberKey = getPayloadNumberKey(payload);

  const nextDraft: InvoiceDraftRecord = {
    ...payload,
    id: existingDraft.id,
    createdAt: existingDraft.createdAt,
    updatedAt: now
  };

  const nextDrafts = [
    nextDraft,
    ...currentDrafts.filter((draft) => {
      if (draft.id === id) {
        return false;
      }

      if (payloadNumberKey && getDraftNumberKey(draft) === payloadNumberKey) {
        return false;
      }

      return true;
    })
  ].slice(0, MAX_STORED_INVOICE_DRAFTS);

  await storageProvider.writeCollection(INVOICE_DRAFTS_FILE, nextDrafts);

  return nextDraft;
}

export async function getInvoiceDraftById(id: string) {
  const drafts = await listInvoiceDrafts();

  return drafts.find((item) => item.id === id) ?? null;
}

export async function deleteInvoiceDraftById(id: string) {
  const drafts = await listInvoiceDrafts();
  const nextDrafts = drafts.filter((item) => item.id !== id);

  if (nextDrafts.length === drafts.length) {
    return false;
  }

  await storageProvider.writeCollection(INVOICE_DRAFTS_FILE, nextDrafts);

  return true;
}

/* -------------------------------------------------------------------------- */
/* Supabase user-scoped draft storage                                         */
/* -------------------------------------------------------------------------- */

export async function listAuthenticatedInvoiceDrafts(
  context: AuthenticatedInvoiceDraftContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  return listSupabaseInvoiceDrafts(supabase, workspace.organizationId);
}

export async function listAuthenticatedInvoiceDraftSummaries(
  context: AuthenticatedInvoiceDraftContext
) {
  const drafts = await listAuthenticatedInvoiceDrafts(context);

  return uniqueDraftsByInvoiceNumber(drafts).map(buildDraftSummary);
}

export async function createAuthenticatedInvoiceDraft(
  context: AuthenticatedInvoiceDraftContext,
  payload: InvoiceEditorDraftPayload
): Promise<InvoiceDraftRecord> {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const currentDrafts = await listSupabaseInvoiceDrafts(
    supabase,
    workspace.organizationId
  );

  const payloadNumberKey = getPayloadNumberKey(payload);

  const existingDraft = payloadNumberKey
    ? currentDrafts.find((draft) => getDraftNumberKey(draft) === payloadNumberKey)
    : undefined;

  if (existingDraft) {
    const { data, error } = await supabase
      .from("invoice_drafts")
      .update(
        buildSupabaseInvoiceDraftValues(
          payload,
          workspace.organizationId,
          context.userId
        )
      )
      .eq("id", existingDraft.id)
      .select(INVOICE_DRAFT_SELECT_FIELDS)
      .single();

    if (error) {
      throw new Error(`Could not update Supabase invoice draft: ${error.message}`);
    }

    const updatedDraft = normalizeSupabaseInvoiceDraftRow(
      data as SupabaseInvoiceDraftRow
    );

    if (!updatedDraft) {
      throw new Error("Supabase invoice draft update returned unreadable data.");
    }

    await replaceInvoiceDraftRelationalRows(
      supabase,
      workspace.organizationId,
      existingDraft.id,
      payload
    );

    await recordWorkspaceActivityEvent(supabase, {
      organizationId: workspace.organizationId,
      actorUserId: context.userId,
      eventType: "invoice_draft.updated",
      entityType: "invoice_draft",
      entityId: existingDraft.id,
      entityLabel: payload.document.number || existingDraft.document.number,
      metadata: buildInvoiceDraftActivityMetadata(payload)
    });

    return updatedDraft;
  }

  const { data, error } = await supabase
    .from("invoice_drafts")
    .insert(
      buildSupabaseInvoiceDraftValues(
        payload,
        workspace.organizationId,
        context.userId
      )
    )
    .select(INVOICE_DRAFT_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create Supabase invoice draft: ${error.message}`);
  }

  const createdDraft = normalizeSupabaseInvoiceDraftRow(
    data as SupabaseInvoiceDraftRow
  );

  if (!createdDraft) {
    throw new Error("Supabase invoice draft create returned unreadable data.");
  }

  await replaceInvoiceDraftRelationalRows(
    supabase,
    workspace.organizationId,
    createdDraft.id,
    payload
  );

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "invoice_draft.created",
    entityType: "invoice_draft",
    entityId: createdDraft.id,
    entityLabel: payload.document.number || createdDraft.id,
    metadata: buildInvoiceDraftActivityMetadata(payload)
  });

  return createdDraft;
}

export async function updateAuthenticatedInvoiceDraftById(
  context: AuthenticatedInvoiceDraftContext,
  id: string,
  payload: InvoiceEditorDraftPayload
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("invoice_drafts")
    .update(
      buildSupabaseInvoiceDraftValues(
        payload,
        workspace.organizationId,
        context.userId
      )
    )
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .select(INVOICE_DRAFT_SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not update Supabase invoice draft: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const updatedDraft = normalizeSupabaseInvoiceDraftRow(
    data as SupabaseInvoiceDraftRow
  );

  if (!updatedDraft) {
    throw new Error("Supabase invoice draft update returned unreadable data.");
  }

  await replaceInvoiceDraftRelationalRows(
    supabase,
    workspace.organizationId,
    updatedDraft.id,
    payload
  );

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "invoice_draft.updated",
    entityType: "invoice_draft",
    entityId: updatedDraft.id,
    entityLabel: payload.document.number || updatedDraft.id,
    metadata: buildInvoiceDraftActivityMetadata(payload)
  });

  return updatedDraft;
}

export async function getAuthenticatedInvoiceDraftById(
  context: AuthenticatedInvoiceDraftContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("invoice_drafts")
    .select(INVOICE_DRAFT_SELECT_FIELDS)
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read Supabase invoice draft: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return normalizeSupabaseInvoiceDraftRow(data as SupabaseInvoiceDraftRow);
}

export async function deleteAuthenticatedInvoiceDraftById(
  context: AuthenticatedInvoiceDraftContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  /*
   * Child rows are linked with ON DELETE CASCADE, so deleting the parent draft
   * also removes parties, lines, and tax summaries.
   */
  const { data, error } = await supabase
    .from("invoice_drafts")
    .delete()
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .select("id, invoice_number")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not delete Supabase invoice draft: ${error.message}`);
  }

  if (!data) {
    return false;
  }

  const deletedDraft = data as Pick<SupabaseInvoiceDraftRow, "id" | "invoice_number">;

  await recordWorkspaceActivityEvent(supabase, {
    organizationId: workspace.organizationId,
    actorUserId: context.userId,
    eventType: "invoice_draft.deleted",
    entityType: "invoice_draft",
    entityId: deletedDraft.id,
    entityLabel: deletedDraft.invoice_number || deletedDraft.id,
    metadata: {
      invoiceNumber: deletedDraft.invoice_number
    }
  });

  return true;
}
