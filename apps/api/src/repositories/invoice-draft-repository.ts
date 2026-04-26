import { randomUUID } from "node:crypto";
import type { InvoiceEditorDraftPayload } from "../schemas/invoice.js";
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

const INVOICE_DRAFTS_FILE = "invoice-drafts.json";
const MAX_STORED_INVOICE_DRAFTS = 250;
const storageProvider = getCollectionStorageProvider();

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

  const existingDraft = currentDrafts.find((draft) => {
    return getDraftNumberKey(draft) === payloadNumberKey;
  });

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
