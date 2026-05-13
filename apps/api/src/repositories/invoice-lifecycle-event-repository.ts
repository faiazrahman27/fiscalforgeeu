import { randomUUID } from "node:crypto";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type InvoiceLifecycleStatus =
  | "draft"
  | "ready_for_review"
  | "validated"
  | "issued"
  | "archived"
  | "voided";

export type InvoiceLifecycleEventRecord = {
  id: string;
  organizationId: string;
  invoiceId: string;
  fromStatus: InvoiceLifecycleStatus | null;
  toStatus: InvoiceLifecycleStatus;
  reason: string | null;
  actorUserId: string | null;
  actorApiKeyId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CreateInvoiceLifecycleEventInput = {
  organizationId: string;
  invoiceId: string;
  fromStatus?: InvoiceLifecycleStatus | null;
  toStatus: InvoiceLifecycleStatus;
  reason?: string | null;
  actorUserId?: string | null;
  actorApiKeyId?: string | null;
  metadata?: Record<string, unknown>;
};

const INVOICE_LIFECYCLE_EVENTS_FILE = "invoice-lifecycle-events.json";
const storageProvider = getCollectionStorageProvider();

function assertOrganizationId(organizationId: string) {
  const trimmed = organizationId.trim();

  if (!trimmed) {
    throw new Error("Organization ID is required for invoice lifecycle events.");
  }

  return trimmed;
}

function sortByCreatedAt(records: InvoiceLifecycleEventRecord[]) {
  return [...records].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt)
  );
}

export async function createInvoiceLifecycleEvent(
  input: CreateInvoiceLifecycleEventInput
): Promise<InvoiceLifecycleEventRecord> {
  const organizationId = assertOrganizationId(input.organizationId);
  const record: InvoiceLifecycleEventRecord = {
    id: randomUUID(),
    organizationId,
    invoiceId: input.invoiceId,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus,
    reason: input.reason?.trim() || null,
    actorUserId: input.actorUserId ?? null,
    actorApiKeyId: input.actorApiKeyId ?? null,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString()
  };
  const records = await storageProvider.readCollection<InvoiceLifecycleEventRecord>(
    INVOICE_LIFECYCLE_EVENTS_FILE
  );

  await storageProvider.writeCollection(INVOICE_LIFECYCLE_EVENTS_FILE, [
    record,
    ...records
  ]);

  return record;
}

export async function listInvoiceLifecycleEvents(
  organizationIdInput: string,
  invoiceId: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await storageProvider.readCollection<InvoiceLifecycleEventRecord>(
    INVOICE_LIFECYCLE_EVENTS_FILE
  );

  return sortByCreatedAt(records).filter(
    (record) =>
      record.organizationId === organizationId && record.invoiceId === invoiceId
  );
}
