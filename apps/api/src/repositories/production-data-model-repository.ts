import { randomUUID } from "node:crypto";
import {
  businessProfileCreateSchema,
  businessProfileUpdateSchema,
  contactCreateSchema,
  contactUpdateSchema,
  invoiceAllowanceCreateSchema,
  invoiceAttachmentCreateSchema,
  invoiceChargeCreateSchema,
  invoiceCreateSchema,
  invoiceLineCreateSchema,
  invoiceTaxCreateSchema,
  invoiceUpdateSchema,
  securityEventCreateSchema,
  sourceReferenceCreateSchema,
  sourceReferenceLinkCreateSchema,
  type BusinessProfileCreateInput,
  type BusinessProfileCreateData,
  type BusinessProfileUpdateInput,
  type ContactCreateInput,
  type ContactCreateData,
  type ContactUpdateInput,
  type InvoiceAllowanceCreateInput,
  type InvoiceAllowanceCreateData,
  type InvoiceAttachmentCreateInput,
  type InvoiceAttachmentCreateData,
  type InvoiceChargeCreateInput,
  type InvoiceChargeCreateData,
  type InvoiceCreateInput,
  type InvoiceCreateData,
  type InvoiceLineCreateInput,
  type InvoiceLineCreateData,
  type InvoiceTaxCreateInput,
  type InvoiceTaxCreateData,
  type InvoiceUpdateInput,
  type InvoiceUpdateData,
  type SecurityEventCreateInput,
  type SecurityEventCreateData,
  type SourceReferenceCreateInput,
  type SourceReferenceCreateData,
  type SourceReferenceLinkCreateInput,
  type SourceReferenceLinkCreateData
} from "../schemas/production-data-model.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

type JsonObject = Record<string, unknown>;

type BaseTenantRecord = {
  id: string;
  organizationId: string;
  createdAt: string;
};

type UpdatedTenantRecord = BaseTenantRecord & {
  updatedAt: string;
};

export type BusinessProfileRecord = UpdatedTenantRecord &
  BusinessProfileCreateData;

export type ContactRecord = UpdatedTenantRecord & ContactCreateData;

export type InvoiceRecord = UpdatedTenantRecord & InvoiceCreateData;

export type InvoiceLineRecord = UpdatedTenantRecord &
  InvoiceLineCreateData & {
    organizationId: string;
    invoiceId: string;
  };

export type InvoiceTaxRecord = UpdatedTenantRecord &
  InvoiceTaxCreateData & {
    organizationId: string;
    invoiceId: string;
  };

export type InvoiceAllowanceRecord = UpdatedTenantRecord &
  InvoiceAllowanceCreateData & {
    organizationId: string;
    invoiceId: string;
  };

export type InvoiceChargeRecord = UpdatedTenantRecord &
  InvoiceChargeCreateData & {
    organizationId: string;
    invoiceId: string;
  };

export type InvoiceAttachmentRecord = BaseTenantRecord &
  InvoiceAttachmentCreateData & {
    organizationId: string;
  };

export type SecurityEventRecord = {
  id: string;
  organizationId: string | null;
  actorUserId?: string | null;
  actorApiKeyId?: string | null;
  eventType: string;
  severity: "info" | "warning" | "high" | "critical";
  category: string;
  ipHash?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  outcome: "success" | "failure" | "blocked" | "recorded";
  metadata: JsonObject;
  createdAt: string;
};

export type SourceReferenceRecord = SourceReferenceCreateData & {
    id: string;
    organizationId: string | null;
    scope: "platform" | "organization";
    createdAt: string;
    updatedAt: string;
  };

export type SourceReferenceLinkRecord = BaseTenantRecord &
  SourceReferenceLinkCreateData & {
    organizationId: string;
  };

export type BusinessProfileListFilters = {
  profileType?: BusinessProfileRecord["profileType"];
  status?: BusinessProfileRecord["status"];
};

export type ContactListFilters = {
  status?: ContactRecord["status"];
  businessProfileId?: string;
};

export type InvoiceListFilters = {
  status?: InvoiceRecord["status"];
  invoiceNumber?: string;
};

export class ProductionDataModelRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProductionDataModelRepositoryError";
    this.code = code;
  }
}

const BUSINESS_PROFILES_FILE = "business-profiles.json";
const CONTACTS_FILE = "contacts.json";
const INVOICES_FILE = "production-invoices.json";
const INVOICE_LINES_FILE = "production-invoice-lines.json";
const INVOICE_TAXES_FILE = "production-invoice-taxes.json";
const INVOICE_ALLOWANCES_FILE = "production-invoice-allowances.json";
const INVOICE_CHARGES_FILE = "production-invoice-charges.json";
const INVOICE_ATTACHMENTS_FILE = "production-invoice-attachments.json";
const SECURITY_EVENTS_FILE = "security-events.json";
const SOURCE_REFERENCES_FILE = "source-references.json";
const SOURCE_REFERENCE_LINKS_FILE = "source-reference-links.json";

const SENSITIVE_METADATA_KEY_PATTERN =
  /(authorization|password|secret|token|api[_-]?key|key[_-]?hash|private[_-]?key|request[_-]?body|raw[_-]?xml)/iu;

const storageProvider = getCollectionStorageProvider();

function assertOrganizationId(organizationId: string) {
  const trimmed = organizationId.trim();

  if (!trimmed) {
    throw new ProductionDataModelRepositoryError(
      "ORGANIZATION_ID_REQUIRED",
      "Organization ID is required for tenant-owned production data."
    );
  }

  return trimmed;
}

function nowIso() {
  return new Date().toISOString();
}

function sortByUpdatedAt<T extends { updatedAt?: string; createdAt: string }>(
  records: T[]
) {
  return [...records].sort((first, second) =>
    (second.updatedAt ?? second.createdAt).localeCompare(
      first.updatedAt ?? first.createdAt
    )
  );
}

async function readCollection<T>(fileName: string) {
  return storageProvider.readCollection<T>(fileName);
}

async function writeCollection<T>(fileName: string, records: T[]) {
  await storageProvider.writeCollection(fileName, records);
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSecurityMetadata(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return "[redacted]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSecurityMetadata(item, depth + 1));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_METADATA_KEY_PATTERN.test(key)
        ? "[redacted]"
        : sanitizeSecurityMetadata(nestedValue, depth + 1)
    ])
  );
}

function withoutUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function withoutUndefinedProvidedFields<
  TInput extends Record<string, unknown>,
  TParsed extends Record<string, unknown>
>(input: TInput, parsed: TParsed): Partial<TParsed> {
  return Object.fromEntries(
    Object.entries(parsed).filter(
      ([key, value]) =>
        Object.prototype.hasOwnProperty.call(input, key) && value !== undefined
    )
  ) as Partial<TParsed>;
}

async function assertBusinessProfileBelongsToOrganization(
  organizationId: string,
  businessProfileId: string | null | undefined
) {
  if (!businessProfileId) {
    return;
  }

  const profile = await getBusinessProfileById(organizationId, businessProfileId);

  if (!profile) {
    throw new ProductionDataModelRepositoryError(
      "BUSINESS_PROFILE_NOT_FOUND",
      "Referenced business profile was not found in this organization."
    );
  }
}

async function assertContactBelongsToOrganization(
  organizationId: string,
  contactId: string | null | undefined
) {
  if (!contactId) {
    return;
  }

  const contact = await getContactById(organizationId, contactId);

  if (!contact) {
    throw new ProductionDataModelRepositoryError(
      "CONTACT_NOT_FOUND",
      "Referenced contact was not found in this organization."
    );
  }
}

async function assertInvoiceBelongsToOrganization(
  organizationId: string,
  invoiceId: string
) {
  const invoice = await getInvoiceById(organizationId, invoiceId);

  if (!invoice) {
    throw new ProductionDataModelRepositoryError(
      "INVOICE_NOT_FOUND",
      "Referenced invoice was not found in this organization."
    );
  }

  return invoice;
}

async function assertInvoiceLineBelongsToInvoice(
  organizationId: string,
  invoiceId: string,
  invoiceLineId: string | null | undefined
) {
  if (!invoiceLineId) {
    return;
  }

  const line = await getInvoiceLineById(organizationId, invoiceId, invoiceLineId);

  if (!line) {
    throw new ProductionDataModelRepositoryError(
      "INVOICE_LINE_NOT_FOUND",
      "Referenced invoice line was not found in this organization invoice."
    );
  }
}

export async function createBusinessProfile(
  organizationIdInput: string,
  input: BusinessProfileCreateInput
): Promise<BusinessProfileRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = businessProfileCreateSchema.parse(input);
  const now = nowIso();
  const record: BusinessProfileRecord = {
    id: randomUUID(),
    organizationId,
    createdAt: now,
    updatedAt: now,
    ...parsed
  };
  const records = await readCollection<BusinessProfileRecord>(
    BUSINESS_PROFILES_FILE
  );

  await writeCollection(BUSINESS_PROFILES_FILE, [record, ...records]);

  return record;
}

export async function listBusinessProfiles(
  organizationIdInput: string,
  filters: BusinessProfileListFilters = {}
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<BusinessProfileRecord>(
    BUSINESS_PROFILES_FILE
  );

  return sortByUpdatedAt(records).filter((record) => {
    if (record.organizationId !== organizationId) {
      return false;
    }

    if (filters.profileType && record.profileType !== filters.profileType) {
      return false;
    }

    if (filters.status && record.status !== filters.status) {
      return false;
    }

    return true;
  });
}

export async function getBusinessProfileById(
  organizationIdInput: string,
  id: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<BusinessProfileRecord>(
    BUSINESS_PROFILES_FILE
  );

  return (
    records.find(
      (record) => record.id === id && record.organizationId === organizationId
    ) ?? null
  );
}

export async function updateBusinessProfileById(
  organizationIdInput: string,
  id: string,
  input: BusinessProfileUpdateInput
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = businessProfileUpdateSchema.parse(input);
  const records = await readCollection<BusinessProfileRecord>(
    BUSINESS_PROFILES_FILE
  );
  const existingRecord = records.find(
    (record) => record.id === id && record.organizationId === organizationId
  );

  if (!existingRecord) {
    return null;
  }

  const updatedRecord = {
    ...existingRecord,
    ...withoutUndefined(parsed),
    id: existingRecord.id,
    organizationId,
    createdAt: existingRecord.createdAt,
    updatedAt: nowIso()
  } as BusinessProfileRecord;

  await writeCollection(
    BUSINESS_PROFILES_FILE,
    records.map((record) =>
      record.id === id && record.organizationId === organizationId
        ? updatedRecord
        : record
    )
  );

  return updatedRecord;
}

export async function deleteBusinessProfileById(
  organizationIdInput: string,
  id: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<BusinessProfileRecord>(
    BUSINESS_PROFILES_FILE
  );
  const nextRecords = records.filter(
    (record) => !(record.id === id && record.organizationId === organizationId)
  );

  if (nextRecords.length === records.length) {
    return false;
  }

  await writeCollection(BUSINESS_PROFILES_FILE, nextRecords);

  return true;
}

export async function createContact(
  organizationIdInput: string,
  input: ContactCreateInput
): Promise<ContactRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = contactCreateSchema.parse(input);
  await assertBusinessProfileBelongsToOrganization(
    organizationId,
    parsed.businessProfileId
  );

  const now = nowIso();
  const record: ContactRecord = {
    id: randomUUID(),
    organizationId,
    createdAt: now,
    updatedAt: now,
    ...parsed
  };
  const records = await readCollection<ContactRecord>(CONTACTS_FILE);

  await writeCollection(CONTACTS_FILE, [record, ...records]);

  return record;
}

export async function listContacts(
  organizationIdInput: string,
  filters: ContactListFilters = {}
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<ContactRecord>(CONTACTS_FILE);

  return sortByUpdatedAt(records).filter((record) => {
    if (record.organizationId !== organizationId) {
      return false;
    }

    if (filters.status && record.status !== filters.status) {
      return false;
    }

    if (
      filters.businessProfileId &&
      record.businessProfileId !== filters.businessProfileId
    ) {
      return false;
    }

    return true;
  });
}

export async function getContactById(organizationIdInput: string, id: string) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<ContactRecord>(CONTACTS_FILE);

  return (
    records.find(
      (record) => record.id === id && record.organizationId === organizationId
    ) ?? null
  );
}

export async function updateContactById(
  organizationIdInput: string,
  id: string,
  input: ContactUpdateInput
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = contactUpdateSchema.parse(input);
  await assertBusinessProfileBelongsToOrganization(
    organizationId,
    parsed.businessProfileId
  );

  const records = await readCollection<ContactRecord>(CONTACTS_FILE);
  const existingRecord = records.find(
    (record) => record.id === id && record.organizationId === organizationId
  );

  if (!existingRecord) {
    return null;
  }

  const updatedRecord = {
    ...existingRecord,
    ...withoutUndefined(parsed),
    id: existingRecord.id,
    organizationId,
    createdAt: existingRecord.createdAt,
    updatedAt: nowIso()
  } as ContactRecord;

  await writeCollection(
    CONTACTS_FILE,
    records.map((record) =>
      record.id === id && record.organizationId === organizationId
        ? updatedRecord
        : record
    )
  );

  return updatedRecord;
}

export async function createInvoice(
  organizationIdInput: string,
  input: InvoiceCreateInput
): Promise<InvoiceRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = invoiceCreateSchema.parse(input);

  await assertBusinessProfileBelongsToOrganization(
    organizationId,
    parsed.sellerProfileId
  );
  await assertBusinessProfileBelongsToOrganization(
    organizationId,
    parsed.buyerProfileId
  );
  await assertContactBelongsToOrganization(organizationId, parsed.buyerContactId);
  await assertContactBelongsToOrganization(
    organizationId,
    parsed.sellerContactId
  );

  const now = nowIso();
  const record: InvoiceRecord = {
    id: randomUUID(),
    organizationId,
    createdAt: now,
    updatedAt: now,
    ...parsed
  };
  const records = await readCollection<InvoiceRecord>(INVOICES_FILE);

  if (
    record.status !== "voided" &&
    records.some(
      (existingRecord) =>
        existingRecord.organizationId === organizationId &&
        existingRecord.status !== "voided" &&
        existingRecord.invoiceNumber === record.invoiceNumber
    )
  ) {
    throw new ProductionDataModelRepositoryError(
      "INVOICE_NUMBER_NOT_UNIQUE",
      "Invoice number already exists for this organization."
    );
  }

  await writeCollection(INVOICES_FILE, [record, ...records]);

  return record;
}

export async function listInvoices(
  organizationIdInput: string,
  filters: InvoiceListFilters = {}
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<InvoiceRecord>(INVOICES_FILE);

  return sortByUpdatedAt(records).filter((record) => {
    if (record.organizationId !== organizationId) {
      return false;
    }

    if (filters.status && record.status !== filters.status) {
      return false;
    }

    if (filters.invoiceNumber && record.invoiceNumber !== filters.invoiceNumber) {
      return false;
    }

    return true;
  });
}

export async function getInvoiceById(organizationIdInput: string, id: string) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<InvoiceRecord>(INVOICES_FILE);

  return (
    records.find(
      (record) => record.id === id && record.organizationId === organizationId
    ) ?? null
  );
}

export async function updateInvoiceById(
  organizationIdInput: string,
  id: string,
  input: InvoiceUpdateInput
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = invoiceUpdateSchema.parse(input);
  const parsedUpdates = withoutUndefinedProvidedFields(
    input as Record<string, unknown>,
    parsed as Record<string, unknown>
  ) as InvoiceUpdateData;

  await assertBusinessProfileBelongsToOrganization(
    organizationId,
    parsedUpdates.sellerProfileId
  );
  await assertBusinessProfileBelongsToOrganization(
    organizationId,
    parsedUpdates.buyerProfileId
  );
  await assertContactBelongsToOrganization(
    organizationId,
    parsedUpdates.buyerContactId
  );
  await assertContactBelongsToOrganization(
    organizationId,
    parsedUpdates.sellerContactId
  );

  const records = await readCollection<InvoiceRecord>(INVOICES_FILE);
  const existingRecord = records.find(
    (record) => record.id === id && record.organizationId === organizationId
  );

  if (!existingRecord) {
    return null;
  }

  const nextInvoiceNumber =
    parsedUpdates.invoiceNumber ?? existingRecord.invoiceNumber;
  const nextStatus = parsedUpdates.status ?? existingRecord.status;

  if (
    nextStatus !== "voided" &&
    records.some(
      (record) =>
        record.id !== id &&
        record.organizationId === organizationId &&
        record.status !== "voided" &&
        record.invoiceNumber === nextInvoiceNumber
    )
  ) {
    throw new ProductionDataModelRepositoryError(
      "INVOICE_NUMBER_NOT_UNIQUE",
      "Invoice number already exists for this organization."
    );
  }

  const updatedRecord = {
    ...existingRecord,
    ...withoutUndefined(parsedUpdates),
    id: existingRecord.id,
    organizationId,
    createdAt: existingRecord.createdAt,
    updatedAt: nowIso()
  } as InvoiceRecord;

  await writeCollection(
    INVOICES_FILE,
    records.map((record) =>
      record.id === id && record.organizationId === organizationId
        ? updatedRecord
        : record
    )
  );

  return updatedRecord;
}

export async function createInvoiceLine(
  organizationIdInput: string,
  invoiceId: string,
  input: InvoiceLineCreateInput
): Promise<InvoiceLineRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = invoiceLineCreateSchema.parse(input);
  await assertInvoiceBelongsToOrganization(organizationId, invoiceId);

  const records = await readCollection<InvoiceLineRecord>(INVOICE_LINES_FILE);

  if (
    records.some(
      (record) =>
        record.organizationId === organizationId &&
        record.invoiceId === invoiceId &&
        record.lineNumber === parsed.lineNumber
    )
  ) {
    throw new ProductionDataModelRepositoryError(
      "INVOICE_LINE_NUMBER_NOT_UNIQUE",
      "Invoice line number already exists for this invoice."
    );
  }

  const now = nowIso();
  const record: InvoiceLineRecord = {
    id: randomUUID(),
    organizationId,
    invoiceId,
    createdAt: now,
    updatedAt: now,
    ...parsed
  };

  await writeCollection(INVOICE_LINES_FILE, [record, ...records]);

  return record;
}

export async function listInvoiceLines(
  organizationIdInput: string,
  invoiceId: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  await assertInvoiceBelongsToOrganization(organizationId, invoiceId);
  const records = await readCollection<InvoiceLineRecord>(INVOICE_LINES_FILE);

  return records
    .filter(
      (record) =>
        record.organizationId === organizationId && record.invoiceId === invoiceId
    )
    .sort((first, second) => first.lineNumber - second.lineNumber);
}

export async function getInvoiceLineById(
  organizationIdInput: string,
  invoiceId: string,
  id: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<InvoiceLineRecord>(INVOICE_LINES_FILE);

  return (
    records.find(
      (record) =>
        record.id === id &&
        record.invoiceId === invoiceId &&
        record.organizationId === organizationId
    ) ?? null
  );
}

export async function createInvoiceTax(
  organizationIdInput: string,
  invoiceId: string,
  input: InvoiceTaxCreateInput
): Promise<InvoiceTaxRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = invoiceTaxCreateSchema.parse(input);
  await assertInvoiceBelongsToOrganization(organizationId, invoiceId);
  await assertInvoiceLineBelongsToInvoice(
    organizationId,
    invoiceId,
    parsed.invoiceLineId
  );

  const now = nowIso();
  const record: InvoiceTaxRecord = {
    id: randomUUID(),
    organizationId,
    invoiceId,
    createdAt: now,
    updatedAt: now,
    ...parsed
  };
  const records = await readCollection<InvoiceTaxRecord>(INVOICE_TAXES_FILE);

  await writeCollection(INVOICE_TAXES_FILE, [record, ...records]);

  return record;
}

export async function listInvoiceTaxes(
  organizationIdInput: string,
  invoiceId: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  await assertInvoiceBelongsToOrganization(organizationId, invoiceId);
  const records = await readCollection<InvoiceTaxRecord>(INVOICE_TAXES_FILE);

  return records.filter(
    (record) =>
      record.organizationId === organizationId && record.invoiceId === invoiceId
  );
}

export async function createInvoiceAllowance(
  organizationIdInput: string,
  invoiceId: string,
  input: InvoiceAllowanceCreateInput
): Promise<InvoiceAllowanceRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = invoiceAllowanceCreateSchema.parse(input);
  await assertInvoiceBelongsToOrganization(organizationId, invoiceId);
  await assertInvoiceLineBelongsToInvoice(
    organizationId,
    invoiceId,
    parsed.invoiceLineId
  );

  const now = nowIso();
  const record: InvoiceAllowanceRecord = {
    id: randomUUID(),
    organizationId,
    invoiceId,
    createdAt: now,
    updatedAt: now,
    ...parsed
  };
  const records = await readCollection<InvoiceAllowanceRecord>(
    INVOICE_ALLOWANCES_FILE
  );

  await writeCollection(INVOICE_ALLOWANCES_FILE, [record, ...records]);

  return record;
}

export async function listInvoiceAllowances(
  organizationIdInput: string,
  invoiceId: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  await assertInvoiceBelongsToOrganization(organizationId, invoiceId);
  const records = await readCollection<InvoiceAllowanceRecord>(
    INVOICE_ALLOWANCES_FILE
  );

  return records.filter(
    (record) =>
      record.organizationId === organizationId && record.invoiceId === invoiceId
  );
}

export async function createInvoiceCharge(
  organizationIdInput: string,
  invoiceId: string,
  input: InvoiceChargeCreateInput
): Promise<InvoiceChargeRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = invoiceChargeCreateSchema.parse(input);
  await assertInvoiceBelongsToOrganization(organizationId, invoiceId);
  await assertInvoiceLineBelongsToInvoice(
    organizationId,
    invoiceId,
    parsed.invoiceLineId
  );

  const now = nowIso();
  const record: InvoiceChargeRecord = {
    id: randomUUID(),
    organizationId,
    invoiceId,
    createdAt: now,
    updatedAt: now,
    ...parsed
  };
  const records = await readCollection<InvoiceChargeRecord>(INVOICE_CHARGES_FILE);

  await writeCollection(INVOICE_CHARGES_FILE, [record, ...records]);

  return record;
}

export async function listInvoiceCharges(
  organizationIdInput: string,
  invoiceId: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  await assertInvoiceBelongsToOrganization(organizationId, invoiceId);
  const records = await readCollection<InvoiceChargeRecord>(INVOICE_CHARGES_FILE);

  return records.filter(
    (record) =>
      record.organizationId === organizationId && record.invoiceId === invoiceId
  );
}

export async function deleteInvoiceChildrenByInvoiceId(
  organizationIdInput: string,
  invoiceId: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  await assertInvoiceBelongsToOrganization(organizationId, invoiceId);

  const [taxes, allowances, charges, lines] = await Promise.all([
    readCollection<InvoiceTaxRecord>(INVOICE_TAXES_FILE),
    readCollection<InvoiceAllowanceRecord>(INVOICE_ALLOWANCES_FILE),
    readCollection<InvoiceChargeRecord>(INVOICE_CHARGES_FILE),
    readCollection<InvoiceLineRecord>(INVOICE_LINES_FILE)
  ]);

  await Promise.all([
    writeCollection(
      INVOICE_TAXES_FILE,
      taxes.filter(
        (record) =>
          record.organizationId !== organizationId || record.invoiceId !== invoiceId
      )
    ),
    writeCollection(
      INVOICE_ALLOWANCES_FILE,
      allowances.filter(
        (record) =>
          record.organizationId !== organizationId || record.invoiceId !== invoiceId
      )
    ),
    writeCollection(
      INVOICE_CHARGES_FILE,
      charges.filter(
        (record) =>
          record.organizationId !== organizationId || record.invoiceId !== invoiceId
      )
    ),
    writeCollection(
      INVOICE_LINES_FILE,
      lines.filter(
        (record) =>
          record.organizationId !== organizationId || record.invoiceId !== invoiceId
      )
    )
  ]);
}

export async function createInvoiceAttachment(
  organizationIdInput: string,
  input: InvoiceAttachmentCreateInput
): Promise<InvoiceAttachmentRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = invoiceAttachmentCreateSchema.parse(input);

  if (parsed.invoiceId) {
    await assertInvoiceBelongsToOrganization(organizationId, parsed.invoiceId);
  }

  const now = nowIso();
  const record: InvoiceAttachmentRecord = {
    id: randomUUID(),
    organizationId,
    createdAt: now,
    ...parsed
  };
  const records = await readCollection<InvoiceAttachmentRecord>(
    INVOICE_ATTACHMENTS_FILE
  );

  await writeCollection(INVOICE_ATTACHMENTS_FILE, [record, ...records]);

  return record;
}

export async function listInvoiceAttachments(
  organizationIdInput: string,
  input: {
    invoiceId?: string;
    invoiceDraftId?: string;
  } = {}
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<InvoiceAttachmentRecord>(
    INVOICE_ATTACHMENTS_FILE
  );

  return records.filter((record) => {
    if (record.organizationId !== organizationId) {
      return false;
    }

    if (input.invoiceId && record.invoiceId !== input.invoiceId) {
      return false;
    }

    if (input.invoiceDraftId && record.invoiceDraftId !== input.invoiceDraftId) {
      return false;
    }

    return true;
  });
}

export async function createSecurityEvent(
  input: SecurityEventCreateInput
): Promise<SecurityEventRecord> {
  const parsed = securityEventCreateSchema.parse(input);
  const sanitizedMetadata = sanitizeSecurityMetadata(parsed.metadata);

  if (!isPlainObject(sanitizedMetadata)) {
    throw new ProductionDataModelRepositoryError(
      "SECURITY_EVENT_METADATA_INVALID",
      "Security event metadata must be a JSON object."
    );
  }

  const record: SecurityEventRecord = {
    id: randomUUID(),
    organizationId: parsed.organizationId ?? null,
    eventType: parsed.eventType,
    severity: parsed.severity,
    category: parsed.category,
    outcome: parsed.outcome,
    metadata: sanitizedMetadata,
    createdAt: nowIso()
  };

  if (parsed.actorUserId !== undefined) {
    record.actorUserId = parsed.actorUserId;
  }

  if (parsed.actorApiKeyId !== undefined) {
    record.actorApiKeyId = parsed.actorApiKeyId;
  }

  if (parsed.ipHash !== undefined) {
    record.ipHash = parsed.ipHash;
  }

  if (parsed.userAgent !== undefined) {
    record.userAgent = parsed.userAgent;
  }

  if (parsed.requestId !== undefined) {
    record.requestId = parsed.requestId;
  }

  if (parsed.resourceType !== undefined) {
    record.resourceType = parsed.resourceType;
  }

  if (parsed.resourceId !== undefined) {
    record.resourceId = parsed.resourceId;
  }

  const records = await readCollection<SecurityEventRecord>(SECURITY_EVENTS_FILE);

  await writeCollection(SECURITY_EVENTS_FILE, [record, ...records]);

  return record;
}

export async function listSecurityEvents(organizationIdInput: string) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<SecurityEventRecord>(SECURITY_EVENTS_FILE);

  return records
    .filter((record) => record.organizationId === organizationId)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function createPlatformSourceReference(
  input: SourceReferenceCreateInput
): Promise<SourceReferenceRecord> {
  const parsed = sourceReferenceCreateSchema.parse(input);
  const now = nowIso();
  const record: SourceReferenceRecord = {
    id: randomUUID(),
    organizationId: null,
    scope: "platform",
    createdAt: now,
    updatedAt: now,
    ...parsed
  };
  const records = await readCollection<SourceReferenceRecord>(
    SOURCE_REFERENCES_FILE
  );

  await writeCollection(SOURCE_REFERENCES_FILE, [record, ...records]);

  return record;
}

export async function createOrganizationSourceReference(
  organizationIdInput: string,
  input: SourceReferenceCreateInput
): Promise<SourceReferenceRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = sourceReferenceCreateSchema.parse(input);
  const now = nowIso();
  const record: SourceReferenceRecord = {
    id: randomUUID(),
    organizationId,
    scope: "organization",
    createdAt: now,
    updatedAt: now,
    ...parsed
  };
  const records = await readCollection<SourceReferenceRecord>(
    SOURCE_REFERENCES_FILE
  );

  await writeCollection(SOURCE_REFERENCES_FILE, [record, ...records]);

  return record;
}

export async function listSourceReferencesForOrganization(
  organizationIdInput: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<SourceReferenceRecord>(
    SOURCE_REFERENCES_FILE
  );

  return sortByUpdatedAt(records).filter(
    (record) =>
      record.scope === "platform" ||
      (record.scope === "organization" && record.organizationId === organizationId)
  );
}

export async function getSourceReferenceByIdForOrganization(
  organizationIdInput: string,
  id: string
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await listSourceReferencesForOrganization(organizationId);

  return records.find((record) => record.id === id) ?? null;
}

export async function createSourceReferenceLink(
  organizationIdInput: string,
  input: SourceReferenceLinkCreateInput
): Promise<SourceReferenceLinkRecord> {
  const organizationId = assertOrganizationId(organizationIdInput);
  const parsed = sourceReferenceLinkCreateSchema.parse(input);
  const sourceReference = await getSourceReferenceByIdForOrganization(
    organizationId,
    parsed.sourceReferenceId
  );

  if (!sourceReference) {
    throw new ProductionDataModelRepositoryError(
      "SOURCE_REFERENCE_NOT_FOUND",
      "Referenced source was not visible in this organization."
    );
  }

  const record: SourceReferenceLinkRecord = {
    id: randomUUID(),
    organizationId,
    createdAt: nowIso(),
    ...parsed
  };
  const records = await readCollection<SourceReferenceLinkRecord>(
    SOURCE_REFERENCE_LINKS_FILE
  );

  await writeCollection(SOURCE_REFERENCE_LINKS_FILE, [record, ...records]);

  return record;
}

export async function listSourceReferenceLinksForTarget(
  organizationIdInput: string,
  input: {
    targetTable: string;
    targetId: string;
  }
) {
  const organizationId = assertOrganizationId(organizationIdInput);
  const records = await readCollection<SourceReferenceLinkRecord>(
    SOURCE_REFERENCE_LINKS_FILE
  );

  return records.filter(
    (record) =>
      record.organizationId === organizationId &&
      record.targetTable === input.targetTable &&
      record.targetId === input.targetId
  );
}
