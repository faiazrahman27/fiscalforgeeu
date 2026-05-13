import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";

const exportDataPath = join(process.cwd(), ".data", "invoice-exports.json");

let originalExportData: string | null = null;

const validInvoicePayload = {
  document: {
    type: "invoice",
    number: "TST-UBL-001",
    currency: "EUR",
    issueDate: "2026-04-29",
    dueDate: "2026-05-29",
    taxPointDate: "2026-04-30",
    profile: "EN16931",
    buyerReference: "BR-EXPORT-001",
    orderReference: "ORDER-EXPORT-001",
    contractReference: "CONTRACT-EXPORT-001",
    projectReference: "PROJECT-EXPORT-001",
    accountingCost: "ACCT-EXPORT-001"
  },
  seller: {
    name: "Invoice Lantern Seller",
    legalName: "Invoice Lantern Seller GmbH",
    country: "DE",
    vatId: "DE123456789",
    electronicAddress: "seller@example.test",
    electronicAddressScheme: "EM",
    street: "Seller Street 1",
    city: "Berlin",
    postalCode: "10115"
  },
  buyer: {
    name: "Invoice Lantern Buyer",
    country: "DE",
    vatId: "DE987654321",
    electronicAddress: "buyer@example.test",
    electronicAddressScheme: "EM",
    street: "Buyer Street 2",
    city: "Munich",
    postalCode: "80331"
  },
  delivery: {
    deliveryDate: "2026-05-01",
    locationId: "DELIVERY-EXPORT-001",
    country: "DE"
  },
  payment: {
    paymentMeansCode: "30",
    paymentReference: "RF18539007547034",
    terms: "Due within 30 days."
  },
  lines: [
    {
      id: "1",
      description: "Technical validation sandbox service",
      quantity: "2",
      unitCode: "EA",
      unitPrice: "50.00",
      discountAmount: "5.00",
      chargeAmount: "2.00",
      vatCategory: "S",
      vatRate: "19"
    }
  ],
  allowances: [
    {
      id: "ALLOW-EXPORT-1",
      scope: "document",
      reason: "Educational sandbox discount",
      amount: "10.00",
      taxCategory: "S",
      vatRate: "19"
    }
  ],
  charges: [
    {
      id: "CHARGE-EXPORT-1",
      scope: "document",
      reason: "Handling",
      amount: "3.00",
      taxCategory: "S",
      vatRate: "19"
    }
  ]
};

before(async () => {
  try {
    originalExportData = await readFile(exportDataPath, "utf8");
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }

    originalExportData = null;
  }

  await rm(exportDataPath, {
    force: true
  });
});

after(async () => {
  if (originalExportData === null) {
    await rm(exportDataPath, {
      force: true
    });
    return;
  }

  await mkdir(dirname(exportDataPath), {
    recursive: true
  });
  await writeFile(exportDataPath, originalExportData, "utf8");
});

function isFileNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecordsFromResponse(value: unknown) {
  assert.equal(isPlainObject(value), true);
  const records = (value as Record<string, unknown>).records;
  assert.equal(Array.isArray(records), true);

  return records as Record<string, unknown>[];
}

test("UBL export returns SHA-256 metadata and persists metadata-only export records", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const exportResponse = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/export/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY
    },
    payload: validInvoicePayload
  });

  assert.equal(exportResponse.statusCode, 200);

  const exportBody = exportResponse.json() as Record<string, unknown>;
  const xml = exportBody.xml;
  const xmlSha256 = exportBody.xmlSha256;
  const xmlSizeBytes = exportBody.xmlSizeBytes;
  const disclaimer = exportBody.disclaimer;

  assert.equal(typeof xml, "string");
  assert.match(xml as string, /<Invoice\b/);
  assert.match(xml as string, /<cbc:BuyerReference>BR-EXPORT-001<\/cbc:BuyerReference>/);
  assert.match(xml as string, /<cac:OrderReference>/);
  assert.match(xml as string, /<cac:Delivery>/);
  assert.match(xml as string, /<cac:PaymentMeans>/);
  assert.match(xml as string, /<cac:AllowanceCharge>/);
  assert.match(xml as string, /<cbc:AllowanceTotalAmount currencyID="EUR">10.00<\/cbc:AllowanceTotalAmount>/);
  assert.match(xml as string, /not Peppol-certified/i);
  assert.equal(
    xmlSha256,
    createHash("sha256").update(xml as string, "utf8").digest("hex")
  );
  assert.equal(xmlSizeBytes, Buffer.byteLength(xml as string, "utf8"));
  assert.equal(typeof exportBody.exportId, "string");
  assert.equal(typeof exportBody.filename, "string");
  assert.equal(exportBody.contentType, "application/xml; charset=utf-8");
  assert.equal(typeof exportBody.createdAt, "string");
  assert.equal(typeof disclaimer, "string");
  assert.match(disclaimer as string, /not official validation/i);

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/invoices/exports?limit=10",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(listResponse.statusCode, 200);

  const records = getRecordsFromResponse(listResponse.json());
  const listedRecord = records.find((record) => record.id === exportBody.exportId);

  assert.ok(listedRecord);
  assert.equal(listedRecord.filename, exportBody.filename);
  assert.equal(listedRecord.xmlSha256, exportBody.xmlSha256);
  assert.equal(listedRecord.xmlSizeBytes, exportBody.xmlSizeBytes);
  assert.equal(listedRecord.status, "generated");
  assert.equal(listedRecord.profile, "EN16931");
  assert.equal("xml" in listedRecord, false);

  const filteredResponse = await app.inject({
    method: "GET",
    url: "/api/v1/invoices/exports?invoiceDraftId=other-draft&limit=10",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(filteredResponse.statusCode, 200);
  assert.equal(getRecordsFromResponse(filteredResponse.json()).length, 0);

  const rawStoredExports = await readFile(exportDataPath, "utf8");
  const storedPayload = JSON.parse(rawStoredExports) as Record<string, unknown>;
  const storedRecords = getRecordsFromResponse(storedPayload);
  const storedRecord = storedRecords.find((record) => record.id === exportBody.exportId);

  assert.ok(storedRecord);
  assert.equal(storedRecord.xmlSha256, exportBody.xmlSha256);
  assert.equal("xml" in storedRecord, false);
});
