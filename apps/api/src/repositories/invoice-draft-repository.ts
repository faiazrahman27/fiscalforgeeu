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
  currency: string;
  payable_amount: string;
  payload: unknown;
  summary: unknown;
  created_at: string;
  updated_at: string;
};

const INVOICE_DRAFTS_FILE = "invoice-drafts.json";
const MAX_STORED_INVOICE_DRAFTS = 250;
const INVOICE_DRAFT_SELECT_FIELDS =
  "id, organization_id, created_by, invoice_number, seller_name, seller_country, buyer_name, buyer_country, issue_date, currency, payable_amount, payload, summary, created_at, updated_at";

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
    seller_name: payload.seller.name,
    seller_country: payload.seller.country,
    buyer_name: payload.buyer.name,
    buyer_country: payload.buyer.country,
    issue_date: payload.document.issueDate,
    currency: payload.document.currency,
    payable_amount: payload.totals.payableAmount,
    payload,
    summary: {
      number: payload.document.number,
      seller: payload.seller.name,
      sellerCountry: payload.seller.country,
      buyer: payload.buyer.name,
      buyerCountry: payload.buyer.country,
      issueDate: payload.document.issueDate,
      status: "Draft",
      amount: `${payload.document.currency} ${payload.totals.payableAmount}`,
      currency: payload.document.currency
    }
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

  return normalizeSupabaseInvoiceDraftRow(data as SupabaseInvoiceDraftRow);
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

  const { data, error } = await supabase
    .from("invoice_drafts")
    .delete()
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not delete Supabase invoice draft: ${error.message}`);
  }

  return Boolean(data);
}
