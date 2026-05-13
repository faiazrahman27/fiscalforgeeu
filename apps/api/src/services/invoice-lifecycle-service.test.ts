import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { buildApp } from "../app.js";
import {
  listInvoiceAllowances,
  listInvoiceCharges,
  listInvoiceLines,
  listInvoiceTaxes,
  listSecurityEvents
} from "../repositories/production-data-model-repository.js";
import {
  InvoiceLifecycleServiceError,
  createProductionInvoice,
  createProductionInvoiceFromDraft,
  getProductionInvoice,
  listProductionInvoiceLifecycleEvents,
  listProductionInvoices,
  transitionProductionInvoice,
  updateProductionInvoice
} from "./invoice-lifecycle-service.js";
import type {
  WorkspaceAuthorizationContext,
  WorkspaceRole
} from "../middleware/require-workspace-role.js";

const dataFiles = [
  "invoice-drafts.json",
  "production-invoices.json",
  "production-invoice-lines.json",
  "production-invoice-taxes.json",
  "production-invoice-allowances.json",
  "production-invoice-charges.json",
  "invoice-lifecycle-events.json",
  "security-events.json"
];

const backups = new Map<string, string | null>();
const organizationA = "00000000-0000-4000-8000-0000000000a1";
const organizationB = "00000000-0000-4000-8000-0000000000b1";
const ownerUserId = "00000000-0000-4000-8000-000000000101";
const reviewerUserId = "00000000-0000-4000-8000-000000000102";

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

function context(
  membershipRole: WorkspaceRole = "owner",
  organizationId = organizationA,
  userId = ownerUserId
): WorkspaceAuthorizationContext {
  return {
    userId,
    accessToken: "test-access-token",
    organizationId,
    organizationName:
      organizationId === organizationA ? "Organization A" : "Organization B",
    organizationSlug: organizationId === organizationA ? "org-a" : "org-b",
    membershipRole,
    userEmail: "owner@example.test"
  };
}

function buildCanonicalInvoice(invoiceNumber: string, lineCount = 1) {
  return {
    profile: "EN16931",
    document: {
      type: "invoice",
      number: invoiceNumber,
      issueDate: "2026-05-13",
      dueDate: "2026-06-13",
      currency: "EUR"
    },
    seller: {
      name: "Invoice Lantern Seller GmbH",
      legalName: "Invoice Lantern Seller GmbH",
      country: "DE",
      vatId: "DE123456789",
      address: {
        street: "Seller Street 1",
        city: "Berlin",
        postalCode: "10115",
        country: "DE"
      }
    },
    buyer: {
      name: "Invoice Lantern Buyer GmbH",
      country: "DE",
      vatId: "DE987654321",
      address: {
        street: "Buyer Street 2",
        city: "Munich",
        postalCode: "80331",
        country: "DE"
      }
    },
    payment: {
      terms: "Payment due after technical review.",
      accountLabel: "Operating account",
      accountLast4: "6789"
    },
    lines: Array.from({ length: lineCount }, (_value, index) => ({
      id: String(index + 1),
      description: `Technical validation sandbox service ${index + 1}`,
      itemName: "Sandbox service",
      quantity: index === 0 ? "2" : "1",
      unitCode: "EA",
      unitPrice: index === 0 ? "50.00" : "25.00",
      discountAmount: index === 0 ? "0.10" : "0.00",
      chargeAmount: index === 0 ? "0.20" : "0.00",
      netAmount: index === 0 ? "100.10" : "25.00",
      vatCategory: "S",
      vatRate: "19"
    })),
    allowances: [
      {
        id: "allow-doc",
        scope: "document",
        reason: "Educational sandbox discount",
        amount: "5.00",
        taxCategory: "S",
        vatRate: "19"
      },
      {
        id: "allow-line",
        scope: "line",
        lineId: "1",
        reason: "Line adjustment",
        amount: "1.00",
        taxCategory: "S",
        vatRate: "19"
      }
    ],
    charges: [
      {
        id: "charge-doc",
        scope: "document",
        reason: "Handling",
        amount: "2.50",
        taxCategory: "S",
        vatRate: "19"
      }
    ],
    totals: {
      prepaidAmount: "0.00",
      payableRoundingAmount: "0.00"
    }
  };
}

function buildDraftPayload(invoiceNumber: string) {
  return {
    document: {
      number: invoiceNumber,
      issueDate: "2026-05-13",
      dueDate: "2026-06-13",
      currency: "EUR",
      invoiceType: "invoice",
      profile: "EN16931",
      buyerReference: "",
      contractReference: ""
    },
    seller: {
      name: "Draft Seller GmbH",
      country: "DE",
      vatId: "DE123456789",
      city: "Berlin",
      postalCode: "10115",
      street: "Seller Street 1",
      electronicAddress: ""
    },
    buyer: {
      name: "Draft Buyer GmbH",
      country: "DE",
      vatId: "DE987654321",
      city: "Munich",
      postalCode: "80331",
      street: "Buyer Street 2",
      electronicAddress: ""
    },
    lines: [
      {
        id: "1",
        description: "Draft conversion service",
        quantity: "1",
        unitCode: "EA",
        unitPrice: "100.00",
        vatCategory: "S",
        vatRate: "19",
        netAmount: "100.00"
      }
    ],
    totals: {
      lineExtensionAmount: "100.00",
      taxExclusiveAmount: "100.00",
      taxAmount: "19.00",
      taxInclusiveAmount: "119.00",
      payableAmount: "119.00"
    }
  };
}

async function writeDraftRecords(records: Record<string, unknown>[]) {
  await mkdir(dirname(toDataPath("invoice-drafts.json")), {
    recursive: true
  });
  await writeFile(
    toDataPath("invoice-drafts.json"),
    `${JSON.stringify({ records }, null, 2)}\n`,
    "utf8"
  );
}

async function readDraftRecords() {
  const raw = await readFile(toDataPath("invoice-drafts.json"), "utf8");
  const parsed = JSON.parse(raw) as { records?: unknown[] };

  return Array.isArray(parsed.records) ? parsed.records : [];
}

async function assertServiceError(
  action: () => Promise<unknown>,
  input: {
    code: string;
    statusCode: number;
  }
) {
  await assert.rejects(
    action,
    (error) => {
      assert.ok(error instanceof InvoiceLifecycleServiceError);
      assert.equal(error.code, input.code);
      assert.equal(error.statusCode, input.statusCode);
      return true;
    }
  );
}

test("production invoice service persists canonical invoices and normalized children tenant-safely", async () => {
  const invoice = await createProductionInvoice({
    context: context("owner"),
    canonicalInvoice: buildCanonicalInvoice("INV-SVC-001"),
    source: "manual"
  });
  const lineRows = await listInvoiceLines(organizationA, invoice.id);
  const taxRows = await listInvoiceTaxes(organizationA, invoice.id);
  const allowanceRows = await listInvoiceAllowances(organizationA, invoice.id);
  const chargeRows = await listInvoiceCharges(organizationA, invoice.id);
  const loaded = await getProductionInvoice({
    context: context("viewer"),
    id: invoice.id
  });
  const crossTenantRead = await getProductionInvoice({
    context: context("owner", organizationB),
    id: invoice.id
  });

  assert.equal(invoice.status, "draft");
  assert.equal(invoice.invoiceNumber, "INV-SVC-001");
  assert.equal(invoice.draftId, null);
  assert.equal(invoice.legalConfidence, "technical");
  assert.match(
    invoice.validationSummary.disclaimer,
    /not legal, tax, accounting/i
  );
  assert.equal(invoice.calculationSummary.lines[0]?.netAmount, "100.10");
  assert.equal(lineRows.length, 1);
  assert.equal(lineRows[0]?.netAmount, "100.10");
  assert.equal(taxRows.length, 1);
  assert.equal(taxRows[0]?.taxAmount, "18.54");
  assert.equal(allowanceRows.length, 2);
  assert.equal(
    allowanceRows.some((row) => row.scope === "line" && row.invoiceLineId),
    true
  );
  assert.equal(chargeRows.length, 1);
  assert.equal(loaded?.id, invoice.id);
  assert.equal(crossTenantRead, null);
  assert.equal(
    (await listProductionInvoices({ context: context("owner") })).some(
      (record) => record.id === invoice.id
    ),
    true
  );
  assert.equal(
    (await listProductionInvoices({ context: context("owner", organizationB) })).some(
      (record) => record.id === invoice.id
    ),
    false
  );
});

test("production invoice updates replace child rows and keep tenant ownership", async () => {
  const created = await createProductionInvoice({
    context: context("accountant"),
    canonicalInvoice: buildCanonicalInvoice("INV-SVC-UPDATE-001"),
    source: "api"
  });
  const updated = await updateProductionInvoice({
    context: context("reviewer", organizationA, reviewerUserId),
    id: created.id,
    canonicalInvoice: buildCanonicalInvoice("INV-SVC-UPDATE-001", 2)
  });
  const lines = await listInvoiceLines(organizationA, created.id);

  assert.equal(updated?.id, created.id);
  assert.equal(updated?.status, "draft");
  assert.equal(lines.length, 2);
  assert.deepEqual(
    lines.map((line) => line.lineNumber),
    [1, 2]
  );
  assert.equal(lines[1]?.netAmount, "25.00");

  const crossTenantUpdate = await updateProductionInvoice({
    context: context("owner", organizationB),
    id: created.id,
    canonicalInvoice: buildCanonicalInvoice("INV-SVC-UPDATE-ORG-B")
  });

  assert.equal(crossTenantUpdate, null);
});

test("draft-to-production conversion stores the draft link and preserves the draft", async () => {
  const draftId = "00000000-0000-4000-8000-00000000d501";
  const createdAt = "2026-05-13T00:00:00.000Z";

  await writeDraftRecords([
    {
      ...buildDraftPayload("INV-DRAFT-CONVERT-001"),
      id: draftId,
      organizationId: organizationA,
      createdAt,
      updatedAt: createdAt
    }
  ]);

  const invoice = await createProductionInvoiceFromDraft({
    context: context("owner"),
    draftId,
    source: "manual"
  });
  const draftsAfterConversion = await readDraftRecords();

  assert.ok(invoice);
  assert.equal(invoice.draftId, draftId);
  assert.equal(invoice.invoiceNumber, "INV-DRAFT-CONVERT-001");
  assert.equal(invoice.canonicalInvoice.metadata.sourceDraftId, draftId);
  assert.equal(draftsAfterConversion.length, 1);
  assert.equal((draftsAfterConversion[0] as Record<string, unknown>).id, draftId);
});

test("draft-to-production conversion returns structured findings for incomplete drafts and keeps tenant scope", async () => {
  const invalidDraftId = "00000000-0000-4000-8000-00000000d502";
  const otherTenantDraftId = "00000000-0000-4000-8000-00000000d503";
  const createdAt = "2026-05-13T00:00:00.000Z";

  await writeDraftRecords([
    {
      ...buildDraftPayload(""),
      id: invalidDraftId,
      organizationId: organizationA,
      createdAt,
      updatedAt: createdAt
    },
    {
      ...buildDraftPayload("INV-DRAFT-OTHER-ORG"),
      id: otherTenantDraftId,
      organizationId: organizationB,
      createdAt,
      updatedAt: createdAt
    }
  ]);

  await assert.rejects(
    () =>
      createProductionInvoiceFromDraft({
        context: context("owner"),
        draftId: invalidDraftId,
        source: "manual"
      }),
    (error) => {
      assert.ok(error instanceof InvoiceLifecycleServiceError);
      assert.equal(error.code, "CANONICAL_INVOICE_BLOCKED");
      assert.equal(
        error.findings.some(
          (finding) => finding.code === "DOCUMENT_NUMBER_REQUIRED"
        ),
        true
      );
      assert.match(
        String(error.validationSummary?.disclaimer),
        /not legal, tax, accounting/i
      );
      return true;
    }
  );

  const crossTenantConversion = await createProductionInvoiceFromDraft({
    context: context("owner"),
    draftId: otherTenantDraftId,
    source: "manual"
  });

  assert.equal(crossTenantConversion, null);
  assert.equal((await readDraftRecords()).length, 2);
});

test("lifecycle transitions enforce policy, timestamps, and internal issued wording", async () => {
  const invoice = await createProductionInvoice({
    context: context("owner"),
    canonicalInvoice: buildCanonicalInvoice("INV-LIFE-001"),
    source: "manual"
  });
  const ready = await transitionProductionInvoice({
    context: context("reviewer", organizationA, reviewerUserId),
    id: invoice.id,
    toStatus: "ready_for_review",
    reason: "Ready for technical review"
  });
  const validated = await transitionProductionInvoice({
    context: context("owner"),
    id: invoice.id,
    toStatus: "validated"
  });
  const issued = await transitionProductionInvoice({
    context: context("owner"),
    id: invoice.id,
    toStatus: "issued",
    reason: "Internal workspace issuance only"
  });
  const events = await listProductionInvoiceLifecycleEvents({
    context: context("viewer"),
    invoiceId: invoice.id
  });

  assert.equal(ready?.status, "ready_for_review");
  assert.equal(typeof ready?.finalizedAt, "string");
  assert.equal(validated?.status, "validated");
  assert.equal(issued?.status, "issued");
  assert.equal(typeof issued?.issuedAt, "string");
  assert.equal(
    events?.some(
      (event) =>
        event.toStatus === "issued" &&
        String(event.metadata.legalBoundary).includes("internal")
    ),
    true
  );

  await assertServiceError(
    () =>
      updateProductionInvoice({
        context: context("owner"),
        id: invoice.id,
        canonicalInvoice: buildCanonicalInvoice("INV-LIFE-001-UPDATED")
      }),
    {
      code: "PRODUCTION_INVOICE_STATUS_LOCKED",
      statusCode: 409
    }
  );
});

test("invalid transitions, viewer mutation, and developer mutation are blocked", async () => {
  const invoice = await createProductionInvoice({
    context: context("admin"),
    canonicalInvoice: buildCanonicalInvoice("INV-LIFE-BLOCK-001"),
    source: "manual"
  });

  await assertServiceError(
    () =>
      transitionProductionInvoice({
        context: context("owner"),
        id: invoice.id,
        toStatus: "issued"
      }),
    {
      code: "INVOICE_LIFECYCLE_TRANSITION_INVALID",
      statusCode: 409
    }
  );

  await assertServiceError(
    () =>
      transitionProductionInvoice({
        context: context("viewer"),
        id: invoice.id,
        toStatus: "archived"
      }),
    {
      code: "PRODUCTION_INVOICE_MUTATION_ROLE_REQUIRED",
      statusCode: 403
    }
  );

  await assertServiceError(
    () =>
      createProductionInvoice({
        context: context("developer"),
        canonicalInvoice: buildCanonicalInvoice("INV-DEVELOPER-BLOCKED-001"),
        source: "manual"
      }),
    {
      code: "PRODUCTION_INVOICE_MUTATION_ROLE_REQUIRED",
      statusCode: 403
    }
  );

  const securityEvents = await listSecurityEvents(organizationA);

  assert.equal(
    securityEvents.some(
      (event) =>
        event.eventType === "invoice_lifecycle.invalid_transition_blocked" &&
        event.resourceId === invoice.id
    ),
    true
  );
});

test("archived and voided lifecycle behavior stays conservative", async () => {
  const archivedInvoice = await createProductionInvoice({
    context: context("owner"),
    canonicalInvoice: buildCanonicalInvoice("INV-LIFE-ARCHIVE-001"),
    source: "manual"
  });
  const archived = await transitionProductionInvoice({
    context: context("owner"),
    id: archivedInvoice.id,
    toStatus: "archived"
  });
  const archivedAgain = await transitionProductionInvoice({
    context: context("owner"),
    id: archivedInvoice.id,
    toStatus: "archived"
  });
  const voidedInvoice = await createProductionInvoice({
    context: context("owner"),
    canonicalInvoice: buildCanonicalInvoice("INV-LIFE-VOID-001"),
    source: "manual"
  });
  const voided = await transitionProductionInvoice({
    context: context("owner"),
    id: voidedInvoice.id,
    toStatus: "voided"
  });

  assert.equal(archived?.status, "archived");
  assert.equal(typeof archived?.archivedAt, "string");
  assert.equal(archivedAgain?.status, "archived");
  assert.equal(voided?.status, "voided");

  await assertServiceError(
    () =>
      transitionProductionInvoice({
        context: context("owner"),
        id: voidedInvoice.id,
        toStatus: "draft"
      }),
    {
      code: "INVOICE_LIFECYCLE_TRANSITION_INVALID",
      statusCode: 409
    }
  );
});

test("production invoice routes reject organization API keys as signed-user workspace auth", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/invoices",
    headers: {
      authorization:
        "Bearer il_test_abcdef12.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    }
  });
  const body = response.json() as Record<string, unknown>;

  assert.equal(response.statusCode, 401);
  assert.deepEqual(body.error, {
    code: "AUTH_TOKEN_REQUIRED",
    message: "API key authentication is not allowed for this endpoint.",
    details: null
  });
});

test("migration 036 declares lifecycle events with RLS and safe issued-state wording", async () => {
  const migrationPath = join(
    process.cwd(),
    "..",
    "..",
    "supabase",
    "migrations",
    "036_create_invoice_lifecycle_events.sql"
  );
  const migrationSql = await readFile(migrationPath, "utf8");

  assert.match(
    migrationSql,
    /create table if not exists public\.invoice_lifecycle_events\b/i
  );
  assert.match(
    migrationSql,
    /alter table public\.invoice_lifecycle_events enable row level security/i
  );
  assert.match(migrationSql, /public\.is_org_member\(organization_id\)/i);
  assert.match(migrationSql, /public\.can_create_invoice\(organization_id\)/i);
  assert.match(
    migrationSql,
    /invoice_lifecycle_events_org_invoice_created_desc_idx/i
  );
  assert.match(migrationSql, /does not mean official filing/i);
  assert.doesNotMatch(migrationSql, /authority[- ]approved|guaranteed compliant/i);
});
