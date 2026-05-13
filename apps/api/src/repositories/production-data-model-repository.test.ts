import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import {
  businessProfileCreateSchema,
  invoiceAttachmentCreateSchema,
  sourceReferenceCreateSchema
} from "../schemas/production-data-model.js";
import {
  ProductionDataModelRepositoryError,
  createBusinessProfile,
  createContact,
  createInvoice,
  createInvoiceAllowance,
  createInvoiceAttachment,
  createInvoiceCharge,
  createInvoiceLine,
  createInvoiceTax,
  createOrganizationSourceReference,
  createPlatformSourceReference,
  createSecurityEvent,
  createSourceReferenceLink,
  getBusinessProfileById,
  getContactById,
  getInvoiceById,
  getInvoiceLineById,
  getSourceReferenceByIdForOrganization,
  listBusinessProfiles,
  listContacts,
  listInvoiceAllowances,
  listInvoiceAttachments,
  listInvoiceCharges,
  listInvoiceLines,
  listInvoiceTaxes,
  listInvoices,
  listSecurityEvents,
  listSourceReferenceLinksForTarget,
  listSourceReferencesForOrganization
} from "./production-data-model-repository.js";

const dataFiles = [
  "business-profiles.json",
  "contacts.json",
  "production-invoices.json",
  "production-invoice-lines.json",
  "production-invoice-taxes.json",
  "production-invoice-allowances.json",
  "production-invoice-charges.json",
  "production-invoice-attachments.json",
  "security-events.json",
  "source-references.json",
  "source-reference-links.json"
];

const backups = new Map<string, string | null>();
const organizationA = "00000000-0000-4000-8000-0000000000a1";
const organizationB = "00000000-0000-4000-8000-0000000000b1";

before(async () => {
  for (const fileName of dataFiles) {
    const filePath = toDataPath(fileName);

    try {
      backups.set(fileName, await readFile(filePath, "utf8"));
    } catch (error) {
      if (!isFileNotFoundError(error)) {
        throw error;
      }

      backups.set(fileName, null);
    }

    await rm(filePath, {
      force: true
    });
  }
});

after(async () => {
  for (const fileName of dataFiles) {
    const filePath = toDataPath(fileName);
    const backup = backups.get(fileName) ?? null;

    if (backup === null) {
      await rm(filePath, {
        force: true
      });
      continue;
    }

    await mkdir(dirname(filePath), {
      recursive: true
    });
    await writeFile(filePath, backup, "utf8");
  }
});

function toDataPath(fileName: string) {
  return join(process.cwd(), ".data", fileName);
}

function isFileNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function assertRepositoryError(error: unknown, code: string) {
  assert.ok(error instanceof ProductionDataModelRepositoryError);
  assert.equal(error.code, code);
}

function buildBusinessProfile(displayName: string, countryCode = "DE") {
  return {
    profileType: "seller" as const,
    displayName,
    countryCode,
    vatId: `${countryCode}123456789`,
    bankAccountLabel: "Operating account",
    bankAccountLast4: "6789"
  };
}

function buildInvoice(invoiceNumber: string) {
  return {
    invoiceNumber,
    invoiceType: "invoice" as const,
    issueDate: "2026-05-13",
    currency: "EUR"
  };
}

function buildLine(lineNumber: number) {
  return {
    lineNumber,
    description: "Technical validation sandbox service",
    quantity: "2",
    unitCode: "EA",
    unitPrice: "50.00",
    netAmount: "100.00",
    vatCategory: "S",
    vatRate: "19"
  };
}

test("business profiles are tenant-scoped and avoid full bank account collection", async () => {
  const profileA = await createBusinessProfile(
    organizationA,
    buildBusinessProfile("Seller A")
  );
  const profileB = await createBusinessProfile(
    organizationB,
    buildBusinessProfile("Seller B", "FR")
  );

  const organizationAProfiles = await listBusinessProfiles(organizationA);
  const crossOrganizationRead = await getBusinessProfileById(
    organizationA,
    profileB.id
  );

  assert.equal(organizationAProfiles.length, 1);
  assert.equal(organizationAProfiles[0]?.id, profileA.id);
  assert.equal(crossOrganizationRead, null);
  assert.equal("bankAccountNumber" in profileA, false);
  assert.equal("iban" in profileA, false);

  assert.throws(() =>
    businessProfileCreateSchema.parse({
      ...buildBusinessProfile("Unsafe bank profile"),
      iban: "DE89370400440532013000"
    })
  );
});

test("contacts are tenant-scoped and cannot link to another organization's profile", async () => {
  const profileA = await createBusinessProfile(
    organizationA,
    buildBusinessProfile("Contact seller A")
  );
  const profileB = await createBusinessProfile(
    organizationB,
    buildBusinessProfile("Contact seller B", "NL")
  );
  const contactA = await createContact(organizationA, {
    businessProfileId: profileA.id,
    contactType: "business",
    displayName: "Buyer A",
    email: "buyer-a@example.test",
    countryCode: "DE"
  });
  const contactB = await createContact(organizationB, {
    businessProfileId: profileB.id,
    contactType: "business",
    displayName: "Buyer B",
    countryCode: "NL"
  });

  const contactsA = await listContacts(organizationA);
  const crossOrganizationRead = await getContactById(organizationA, contactB.id);

  assert.equal(contactsA.some((contact) => contact.id === contactA.id), true);
  assert.equal(contactsA.some((contact) => contact.id === contactB.id), false);
  assert.equal(crossOrganizationRead, null);

  await assert.rejects(
    () =>
      createContact(organizationA, {
        businessProfileId: profileB.id,
        displayName: "Cross-tenant contact"
      }),
    (error) => {
      assertRepositoryError(error, "BUSINESS_PROFILE_NOT_FOUND");
      return true;
    }
  );
});

test("production invoices coexist with drafts and tenant-scope normalized child rows", async () => {
  const invoiceA = await createInvoice(organizationA, buildInvoice("INV-A-001"));
  const invoiceB = await createInvoice(organizationB, buildInvoice("INV-B-001"));
  const lineA = await createInvoiceLine(organizationA, invoiceA.id, buildLine(1));
  const lineB = await createInvoiceLine(organizationB, invoiceB.id, buildLine(1));
  const taxA = await createInvoiceTax(organizationA, invoiceA.id, {
    invoiceLineId: lineA.id,
    taxCategory: "S",
    vatRate: "19",
    taxableAmount: "100.00",
    taxAmount: "19.00"
  });
  const allowanceA = await createInvoiceAllowance(organizationA, invoiceA.id, {
    scope: "document",
    amount: "5.00",
    reason: "Educational sandbox discount"
  });
  const chargeA = await createInvoiceCharge(organizationA, invoiceA.id, {
    scope: "line",
    invoiceLineId: lineA.id,
    amount: "2.50",
    reason: "Handling"
  });

  assert.equal((await listInvoices(organizationA)).length, 1);
  assert.equal(await getInvoiceById(organizationA, invoiceB.id), null);
  assert.equal((await listInvoiceLines(organizationA, invoiceA.id))[0]?.id, lineA.id);
  assert.equal((await listInvoiceTaxes(organizationA, invoiceA.id))[0]?.id, taxA.id);
  assert.equal(
    (await listInvoiceAllowances(organizationA, invoiceA.id))[0]?.id,
    allowanceA.id
  );
  assert.equal(
    (await listInvoiceCharges(organizationA, invoiceA.id))[0]?.id,
    chargeA.id
  );
  assert.equal(
    await getInvoiceLineById(organizationA, invoiceA.id, lineB.id),
    null
  );

  await assert.rejects(
    () => listInvoiceLines(organizationB, invoiceA.id),
    (error) => {
      assertRepositoryError(error, "INVOICE_NOT_FOUND");
      return true;
    }
  );

  await assert.rejects(
    () =>
      createInvoiceTax(organizationA, invoiceA.id, {
        invoiceLineId: lineB.id,
        taxCategory: "S",
        taxableAmount: "100.00",
        taxAmount: "19.00"
      }),
    (error) => {
      assertRepositoryError(error, "INVOICE_LINE_NOT_FOUND");
      return true;
    }
  );
});

test("invoice attachments remain supporting metadata unless source XML is structured", async () => {
  const invoice = await createInvoice(organizationA, buildInvoice("INV-ATT-001"));
  const sourceXml = await createInvoiceAttachment(organizationA, {
    invoiceId: invoice.id,
    originalFilename: "invoice.xml",
    contentType: "application/xml",
    sizeBytes: 1200,
    attachmentType: "source_xml",
    validationRole: "structured_source"
  });
  const importedPdf = await createInvoiceAttachment(organizationA, {
    invoiceId: invoice.id,
    originalFilename: "supporting.pdf",
    contentType: "application/pdf",
    sizeBytes: 2400,
    attachmentType: "imported_pdf",
    validationRole: "supporting_only"
  });

  assert.equal(sourceXml.validationRole, "structured_source");
  assert.equal(importedPdf.validationRole, "supporting_only");
  assert.equal(
    (await listInvoiceAttachments(organizationA, { invoiceId: invoice.id })).length,
    2
  );

  assert.throws(() =>
    invoiceAttachmentCreateSchema.parse({
      invoiceId: invoice.id,
      originalFilename: "scan.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
      attachmentType: "imported_pdf",
      validationRole: "structured_source"
    })
  );
});

test("security events are organization-scoped and redact sensitive metadata", async () => {
  const event = await createSecurityEvent({
    organizationId: organizationA,
    eventType: "api_key.missing_scope",
    severity: "warning",
    outcome: "blocked",
    metadata: {
      apiKey: "il_test_secret_value",
      nested: {
        authorization: "Bearer secret",
        safe: "retained"
      }
    }
  });
  await createSecurityEvent({
    organizationId: organizationB,
    eventType: "rate_limit.hit",
    metadata: {
      safe: true
    }
  });

  const eventsA = await listSecurityEvents(organizationA);

  assert.equal(eventsA.length, 1);
  assert.equal(eventsA[0]?.id, event.id);
  assert.equal(eventsA[0]?.metadata.apiKey, "[redacted]");
  assert.deepEqual(eventsA[0]?.metadata.nested, {
    authorization: "[redacted]",
    safe: "retained"
  });
});

test("source references support platform and organization visibility", async () => {
  const invoice = await createInvoice(organizationA, buildInvoice("INV-SRC-001"));
  const platformSource = await createPlatformSourceReference({
    sourceType: "internal_policy",
    title: "Invoice Lantern internal technical validation policy",
    confidenceStatus: "reviewed"
  });
  const organizationSourceA = await createOrganizationSourceReference(
    organizationA,
    {
      sourceType: "legal_notice",
      title: "Organization review note",
      confidenceStatus: "professional_review_required"
    }
  );
  const organizationSourceB = await createOrganizationSourceReference(
    organizationB,
    {
      sourceType: "legal_notice",
      title: "Other organization note"
    }
  );
  const sourceLink = await createSourceReferenceLink(organizationA, {
    sourceReferenceId: platformSource.id,
    targetTable: "invoices",
    targetId: invoice.id,
    linkType: "disclaimer"
  });

  const visibleToA = await listSourceReferencesForOrganization(organizationA);

  assert.equal(
    visibleToA.some((source) => source.id === platformSource.id),
    true
  );
  assert.equal(
    visibleToA.some((source) => source.id === organizationSourceA.id),
    true
  );
  assert.equal(
    visibleToA.some((source) => source.id === organizationSourceB.id),
    false
  );
  assert.equal(
    await getSourceReferenceByIdForOrganization(
      organizationA,
      organizationSourceB.id
    ),
    null
  );
  assert.equal(
    (await listSourceReferenceLinksForTarget(organizationA, {
      targetTable: "invoices",
      targetId: invoice.id
    }))[0]?.id,
    sourceLink.id
  );

  assert.throws(() =>
    sourceReferenceCreateSchema.parse({
      sourceType: "standard"
    })
  );
});

test("migration 034 declares the production model, RLS, and safety constraints", async () => {
  const migrationPath = join(
    process.cwd(),
    "..",
    "..",
    "supabase",
    "migrations",
    "034_create_production_invoice_data_model.sql"
  );
  const migrationSql = await readFile(migrationPath, "utf8");
  const expectedTables = [
    "business_profiles",
    "contacts",
    "invoices",
    "invoice_lines",
    "invoice_taxes",
    "invoice_allowances",
    "invoice_charges",
    "invoice_attachments",
    "security_events",
    "source_references",
    "source_reference_links"
  ];

  for (const tableName of expectedTables) {
    assert.match(
      migrationSql,
      new RegExp(`create table if not exists public\\.${tableName}\\b`, "i")
    );
    assert.match(
      migrationSql,
      new RegExp(
        `alter table public\\.${tableName} enable row level security`,
        "i"
      )
    );
  }

  assert.match(migrationSql, /public\.can_create_invoice\(organization_id\)/);
  assert.match(migrationSql, /public\.can_manage_org\(organization_id\)/);
  assert.match(migrationSql, /public\.is_org_member\(organization_id\)/);
  assert.match(migrationSql, /invoices_organization_invoice_number_active_idx/);
  assert.match(
    migrationSql,
    /validation_role <> 'structured_source' or attachment_type = 'source_xml'/
  );
  assert.match(
    migrationSql,
    /source_references_scope_organization_chk/
  );
  assert.match(migrationSql, /security_events_organization_created_at_desc_idx/);
  assert.doesNotMatch(migrationSql, /bank_account_number|iban/i);
  assert.match(migrationSql, /not legal, tax, accounting/i);
});
