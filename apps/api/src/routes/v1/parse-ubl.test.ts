import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";

const invoiceDraftDataPath = join(process.cwd(), ".data", "invoice-drafts.json");
const xmlUploadDataPath = join(process.cwd(), ".data", "xml-uploads.json");

let originalInvoiceDraftData: string | null = null;

const simpleUblInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:invoice-lantern:test:1</cbc:CustomizationID>
  <cbc:ProfileID>Invoice Lantern parser test</cbc:ProfileID>
  <cbc:ID>INV-PARSE-001</cbc:ID>
  <cbc:IssueDate>2026-04-29</cbc:IssueDate>
  <cbc:DueDate>2026-05-29</cbc:DueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Parser Seller GmbH</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Seller Street 1</cbc:StreetName>
        <cbc:CityName>Berlin</cbc:CityName>
        <cbc:PostalZone>10115</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE123456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Parser Buyer SAS</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Buyer Street 2</cbc:StreetName>
        <cbc:CityName>Paris</cbc:CityName>
        <cbc:PostalZone>75001</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>FR123456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">20.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">100.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">20.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>20</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">120.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">120.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">2</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>Parser service</cbc:Description>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>20</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">50.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

const importableUblInvoiceXml = simpleUblInvoiceXml.replace(
  "<cbc:ProfileID>Invoice Lantern parser test</cbc:ProfileID>",
  "<cbc:ProfileID>EN16931</cbc:ProfileID>"
);

before(async () => {
  originalInvoiceDraftData = await readOptionalFile(invoiceDraftDataPath);

  await rm(invoiceDraftDataPath, {
    force: true
  });
});

after(async () => {
  if (originalInvoiceDraftData === null) {
    await rm(invoiceDraftDataPath, {
      force: true
    });
    return;
  }

  await mkdir(dirname(invoiceDraftDataPath), {
    recursive: true
  });
  await writeFile(invoiceDraftDataPath, originalInvoiceDraftData, "utf8");
});

async function readOptionalFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readDraftRecords() {
  const draftData = await readOptionalFile(invoiceDraftDataPath);

  if (!draftData) {
    return [];
  }

  const parsed = JSON.parse(draftData) as Record<string, unknown>;

  return Array.isArray(parsed.records)
    ? (parsed.records as Record<string, unknown>[])
    : [];
}

function getFindings(body: Record<string, unknown>) {
  assert.equal(Array.isArray(body.findings), true);

  return body.findings as Record<string, unknown>[];
}

test("UBL parse endpoint returns parsed metadata for a simple invoice", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/parse/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/xml"
    },
    payload: simpleUblInvoiceXml
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.parsed, true);
  assert.match(String(body.disclaimer), /not official XML validation/i);
  assert.equal(isPlainObject(body.detected), true);

  const detected = body.detected as Record<string, unknown>;

  assert.equal(detected.documentType, "invoice");
  assert.equal(detected.invoiceNumber, "INV-PARSE-001");
  assert.equal(detected.issueDate, "2026-04-29");
  assert.equal(detected.currency, "EUR");
  assert.equal(detected.sellerName, "Parser Seller GmbH");
  assert.equal(detected.buyerName, "Parser Buyer SAS");

  assert.equal(isPlainObject(body.canonicalInvoice), true);
  const canonicalInvoice = body.canonicalInvoice as Record<string, unknown>;

  assert.equal(isPlainObject(canonicalInvoice.document), true);
  assert.equal(
    (canonicalInvoice.document as Record<string, unknown>).number,
    "INV-PARSE-001"
  );
  assert.equal(Array.isArray(canonicalInvoice.lines), true);
  assert.equal((canonicalInvoice.lines as unknown[]).length, 1);
  assert.equal(isPlainObject(body.totals), true);
});

test("UBL parse endpoint rejects unsafe XML before parsing", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/parse/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/xml"
    },
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Invoice [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>&xxe;</ID>
</Invoice>`
  });

  assert.equal(response.statusCode, 400);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.parsed, false);
  assert.match(String(body.disclaimer), /not official XML validation/i);
  assert.equal(Array.isArray(body.findings), true);
  assert.equal(
    (body.findings as Record<string, unknown>[]).some(
      (finding) => finding.code === "XML_DOCTYPE_BLOCKED"
    ),
    true
  );
});

test("UBL parse endpoint returns invoice-core findings for parsed invoices", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/parse/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/json"
    },
    payload: JSON.stringify({
      xml: simpleUblInvoiceXml.replace(
        "<cbc:ID>INV-PARSE-001</cbc:ID>",
        ""
      )
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.parsed, true);
  assert.equal(Array.isArray(body.findings), true);
  assert.equal(
    (body.findings as Record<string, unknown>[]).some(
      (finding) =>
        finding.code === "DOCUMENT_NUMBER_REQUIRED" &&
        finding.ruleSetCode === "INVOICE_LANTERN_CORE"
    ),
    true
  );
});

test("UBL parse endpoint does not create drafts or XML upload records", async (t) => {
  const beforeDrafts = await readOptionalFile(invoiceDraftDataPath);
  const beforeXmlUploads = await readOptionalFile(xmlUploadDataPath);
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/parse/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/xml"
    },
    payload: simpleUblInvoiceXml
  });

  assert.equal(response.statusCode, 200);
  assert.equal(await readOptionalFile(invoiceDraftDataPath), beforeDrafts);
  assert.equal(await readOptionalFile(xmlUploadDataPath), beforeXmlUploads);
  assert.equal(response.body.includes(simpleUblInvoiceXml), false);
});

test("UBL import endpoint creates an editable draft from a valid simple invoice", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/import/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/xml"
    },
    payload: importableUblInvoiceXml
  });

  assert.equal(response.statusCode, 201);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.created, true);
  assert.equal(typeof body.invoiceDraftId, "string");
  assert.match(String(body.disclaimer), /not official XML validation/i);
  assert.equal(String(body.redirectPath), `/workspace/invoices/${body.invoiceDraftId}`);
  assert.equal(isPlainObject(body.detected), true);
  assert.equal(isPlainObject(body.totals), true);

  const records = await readDraftRecords();
  const createdDraft = records.find((record) => record.id === body.invoiceDraftId);

  assert.ok(createdDraft);
  assert.equal(isPlainObject(createdDraft.document), true);
  assert.equal(isPlainObject(createdDraft.seller), true);
  assert.equal(isPlainObject(createdDraft.buyer), true);
  assert.equal(Array.isArray(createdDraft.lines), true);
  assert.equal(isPlainObject(createdDraft.totals), true);

  const document = createdDraft.document as Record<string, unknown>;
  const seller = createdDraft.seller as Record<string, unknown>;
  const buyer = createdDraft.buyer as Record<string, unknown>;
  const lines = createdDraft.lines as Record<string, unknown>[];
  const totals = createdDraft.totals as Record<string, unknown>;

  assert.equal(document.number, "INV-PARSE-001");
  assert.equal(document.issueDate, "2026-04-29");
  assert.equal(document.currency, "EUR");
  assert.equal(document.invoiceType, "invoice");
  assert.equal(document.profile, "EN16931");
  assert.equal(seller.name, "Parser Seller GmbH");
  assert.equal(seller.country, "DE");
  assert.equal(buyer.name, "Parser Buyer SAS");
  assert.equal(buyer.country, "FR");
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.description, "Parser service");
  assert.equal(lines[0]?.quantity, "2");
  assert.equal(lines[0]?.unitCode, "EA");
  assert.equal(lines[0]?.unitPrice, "50.00");
  assert.equal(lines[0]?.netAmount, "100.00");
  assert.equal(totals.lineExtensionAmount, "100.00");
  assert.equal(totals.taxAmount, "20.00");
  assert.equal(totals.payableAmount, "120.00");

  const rawDraftData = await readOptionalFile(invoiceDraftDataPath);

  assert.notEqual(rawDraftData, null);
  assert.equal(rawDraftData?.includes("<Invoice"), false);
  assert.equal(rawDraftData?.includes(importableUblInvoiceXml), false);
});

test("UBL import endpoint rejects unsafe XML and does not create a draft", async (t) => {
  const beforeDraftCount = (await readDraftRecords()).length;
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/import/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/xml"
    },
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Invoice [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>&xxe;</ID>
</Invoice>`
  });

  assert.equal(response.statusCode, 400);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.created, false);
  assert.equal(
    getFindings(body).some((finding) => finding.code === "XML_DOCTYPE_BLOCKED"),
    true
  );
  assert.equal((await readDraftRecords()).length, beforeDraftCount);
});

test("UBL import endpoint does not create a draft when parsing fails", async (t) => {
  const beforeDraftCount = (await readDraftRecords()).length;
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/import/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/xml"
    },
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<Order>
  <ID>ORDER-001</ID>
</Order>`
  });

  assert.equal(response.statusCode, 422);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.created, false);
  assert.equal(
    getFindings(body).some(
      (finding) => finding.code === "UBL_UNKNOWN_DOCUMENT_ROOT"
    ),
    true
  );
  assert.equal((await readDraftRecords()).length, beforeDraftCount);
});

test("UBL import endpoint does not create a draft for unsupported CreditNote XML", async (t) => {
  const beforeDraftCount = (await readDraftRecords()).length;
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/import/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/xml"
    },
    payload: `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>CN-001</cbc:ID>
  <cbc:IssueDate>2026-04-29</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
</CreditNote>`
  });

  assert.equal(response.statusCode, 422);

  const body = response.json() as Record<string, unknown>;

  assert.equal(body.created, false);
  assert.equal(
    getFindings(body).some(
      (finding) => finding.code === "UBL_CREDIT_NOTE_PARSE_UNSUPPORTED"
    ),
    true
  );
  assert.equal((await readDraftRecords()).length, beforeDraftCount);
});

test("UBL import endpoint returns findings when required fields are missing", async (t) => {
  const beforeDraftCount = (await readDraftRecords()).length;
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/import/ubl",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/json"
    },
    payload: JSON.stringify({
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:ProfileID>EN16931</cbc:ProfileID>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
</Invoice>`
    })
  });

  assert.equal(response.statusCode, 422);

  const body = response.json() as Record<string, unknown>;
  const findingCodes = getFindings(body).map((finding) => finding.code);

  assert.equal(body.created, false);
  assert.equal(findingCodes.includes("DOCUMENT_NUMBER_REQUIRED"), true);
  assert.equal(findingCodes.includes("SELLER_NAME_REQUIRED"), true);
  assert.equal(findingCodes.includes("BUYER_NAME_REQUIRED"), true);
  assert.equal(findingCodes.includes("INVOICE_LINE_REQUIRED"), true);
  assert.equal((await readDraftRecords()).length, beforeDraftCount);
});
