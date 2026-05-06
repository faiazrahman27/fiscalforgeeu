import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  canonicalInvoiceSchema,
  validateCanonicalInvoice
} from "@invoice-lantern/invoice-core";
import {
  canonicalToUblInvoiceXml,
  validateUblXsd,
  ublInvoiceXmlToCanonicalInvoice
} from "./index.js";

function buildUblInvoiceXml() {
  const invoice = canonicalInvoiceSchema.parse({
    document: {
      type: "invoice",
      number: "INV-UBL-001",
      issueDate: "2026-04-29",
      dueDate: "2026-05-29",
      currency: "EUR",
      buyerReference: "BR-001"
    },
    seller: {
      name: "Invoice Lantern Seller",
      country: "DE",
      vatId: "DE123456789",
      city: "Berlin",
      postalCode: "10115",
      street: "Example Street 1"
    },
    buyer: {
      name: "Invoice Lantern Buyer",
      country: "FR",
      vatId: "FR123456789",
      city: "Paris",
      postalCode: "75001",
      street: "Rue Example 2"
    },
    lines: [
      {
        id: "1",
        description: "UBL readiness service",
        quantity: "2",
        unitCode: "EA",
        unitPrice: "50.00",
        vatCategory: "S",
        vatRate: "20"
      }
    ]
  });

  return canonicalToUblInvoiceXml(invoice);
}

test("generates UBL XML with key invoice fields and no DTD or ENTITY", () => {
  const xml = buildUblInvoiceXml();

  assert.match(xml, /<cbc:ID>INV-UBL-001<\/cbc:ID>/);
  assert.match(xml, /<cbc:IssueDate>2026-04-29<\/cbc:IssueDate>/);
  assert.match(xml, /<cbc:DueDate>2026-05-29<\/cbc:DueDate>/);
  assert.match(xml, /<cbc:DocumentCurrencyCode>EUR<\/cbc:DocumentCurrencyCode>/);
  assert.match(xml, /<cac:AccountingSupplierParty>/);
  assert.match(xml, /<cac:AccountingCustomerParty>/);
  assert.match(xml, /<cbc:TaxAmount currencyID="EUR">20.00<\/cbc:TaxAmount>/);
  assert.match(xml, /<cbc:PayableAmount currencyID="EUR">120.00<\/cbc:PayableAmount>/);
  assert.match(xml, /<cac:InvoiceLine>/);
  assert.doesNotMatch(xml, /<!DOCTYPE/i);
  assert.doesNotMatch(xml, /<!ENTITY/i);
});

test("parses UBL invoice XML into a canonical invoice preview", () => {
  const result = ublInvoiceXmlToCanonicalInvoice(buildUblInvoiceXml());

  assert.equal(result.ok, true);
  assert.ok(result.invoice);
  assert.equal(result.detected.documentType, "invoice");
  assert.equal(result.detected.rootName, "Invoice");
  assert.equal(result.detected.invoiceNumber, "INV-UBL-001");
  assert.equal(result.detected.issueDate, "2026-04-29");
  assert.equal(result.detected.currency, "EUR");
  assert.equal(result.detected.sellerName, "Invoice Lantern Seller");
  assert.equal(result.detected.sellerCountry, "DE");
  assert.equal(result.detected.buyerName, "Invoice Lantern Buyer");
  assert.equal(result.detected.buyerCountry, "FR");

  assert.equal(result.invoice.document.number, "INV-UBL-001");
  assert.equal(result.invoice.document.issueDate, "2026-04-29");
  assert.equal(result.invoice.document.currency, "EUR");
  assert.equal(result.invoice.seller.name, "Invoice Lantern Seller");
  assert.equal(result.invoice.seller.country, "DE");
  assert.equal(result.invoice.seller.vatId, "DE123456789");
  assert.equal(result.invoice.buyer.name, "Invoice Lantern Buyer");
  assert.equal(result.invoice.buyer.country, "FR");
  assert.equal(result.invoice.buyer.vatId, "FR123456789");

  assert.equal(result.invoice.lines.length, 1);
  assert.equal(result.invoice.lines[0]?.id, "1");
  assert.equal(result.invoice.lines[0]?.description, "UBL readiness service");
  assert.equal(result.invoice.lines[0]?.quantity, "2");
  assert.equal(result.invoice.lines[0]?.unitCode, "EA");
  assert.equal(result.invoice.lines[0]?.unitPrice, "50.00");
  assert.equal(result.invoice.lines[0]?.netAmount, "100.00");
  assert.equal(result.invoice.lines[0]?.vatCategory, "S");
  assert.equal(result.invoice.lines[0]?.vatRate, "20");

  const validation = validateCanonicalInvoice(result.invoice);

  assert.equal(validation.success, true);
});

test("returns findings for missing required canonical fields without fake values", () => {
  const result = ublInvoiceXmlToCanonicalInvoice(`<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
</Invoice>`);

  assert.equal(result.ok, true);
  assert.ok(result.invoice);
  assert.equal(result.invoice.document.number, "");
  assert.equal(result.invoice.seller.name, "");
  assert.equal(result.invoice.buyer.name, "");
  assert.equal(result.invoice.lines.length, 0);

  const codes = result.findings.map((finding) => finding.code);

  assert.equal(codes.includes("DOCUMENT_NUMBER_REQUIRED"), true);
  assert.equal(codes.includes("SELLER_NAME_REQUIRED"), true);
  assert.equal(codes.includes("BUYER_NAME_REQUIRED"), true);
  assert.equal(codes.includes("INVOICE_LINE_REQUIRED"), true);
});

test("returns a safe unsupported finding for CreditNote XML", () => {
  const result = ublInvoiceXmlToCanonicalInvoice(`<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>CN-001</cbc:ID>
  <cbc:IssueDate>2026-04-29</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
</CreditNote>`);

  assert.equal(result.ok, false);
  assert.equal(result.detected.documentType, "credit_note");
  assert.equal(result.detected.invoiceNumber, "CN-001");
  assert.equal(
    result.findings.some(
      (finding) => finding.code === "UBL_CREDIT_NOTE_PARSE_UNSUPPORTED"
    ),
    true
  );
});

test("returns ok false for unknown XML roots", () => {
  const result = ublInvoiceXmlToCanonicalInvoice(`<?xml version="1.0" encoding="UTF-8"?>
<Order>
  <ID>ORDER-001</ID>
</Order>`);

  assert.equal(result.ok, false);
  assert.equal(result.detected.documentType, "unknown");
  assert.equal(
    result.findings.some(
      (finding) => finding.code === "UBL_UNKNOWN_DOCUMENT_ROOT"
    ),
    true
  );
});

test("rejects DTD and ENTITY XML before UBL parsing", () => {
  const result = ublInvoiceXmlToCanonicalInvoice(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Invoice [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>&xxe;</ID>
</Invoice>`);

  assert.equal(result.ok, false);
  assert.equal(
    result.findings.some(
      (finding) =>
        finding.code === "XML_DOCTYPE_BLOCKED" &&
        finding.severity === "blocked"
    ),
    true
  );
});

test("UBL XSD adapter returns not_configured without artefact configuration", () => {
  const result = validateUblXsd({
    xml: buildUblInvoiceXml(),
    rootElement: "Invoice",
    documentType: "invoice"
  });

  assert.equal(result.status, "not_configured");
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.artifactInfo.configured, false);
  assert.equal(
    result.artifactInfo.validatorName,
    "Invoice Lantern local UBL XSD adapter"
  );
  assert.equal(
    result.findings.some(
      (finding) =>
        finding.code === "UBL_XSD_NOT_CONFIGURED" &&
        finding.status === "not_configured"
    ),
    true
  );
});

test("UBL XSD adapter derives standard root artefact paths and stays safe when missing", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));

  try {
    const result = validateUblXsd({
      xml: buildUblInvoiceXml(),
      rootElement: "Invoice",
      documentType: "invoice",
      artifactConfig: {
        rootDir: tempRoot,
        artifactVersion: "2.1"
      }
    });

    assert.equal(result.status, "not_configured");
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(result.artifactInfo.configured, false);
    assert.match(
      result.artifactInfo.invoiceXsdPath ?? "",
      /xsd[\\/]+maindoc[\\/]+UBL-Invoice-2\.1\.xsd$/
    );
    assert.match(
      result.artifactInfo.creditNoteXsdPath ?? "",
      /xsd[\\/]+maindoc[\\/]+UBL-CreditNote-2\.1\.xsd$/
    );
    assert.equal(result.findings[0]?.code, "UBL_XSD_ARTIFACT_UNREADABLE");
    assert.equal(result.summary.configuredPathReadable, false);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("UBL XSD adapter reports controlled error for readable artefacts until a real validator is wired", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));
  const invoiceXsdPath = join(tempRoot, "UBL-Invoice-2.1.xsd");

  try {
    await writeFile(
      invoiceXsdPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"></xs:schema>`,
      "utf8"
    );

    const result = validateUblXsd({
      xml: buildUblInvoiceXml(),
      rootElement: "Invoice",
      documentType: "invoice",
      artifactConfig: {
        invoiceXsdPath,
        artifactVersion: "2.1"
      }
    });

    assert.equal(result.status, "error");
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(result.artifactInfo.configured, true);
    assert.equal(result.artifactInfo.invoiceXsdPath, invoiceXsdPath);
    assert.equal(result.artifactInfo.artifactVersion, "2.1");
    assert.equal(result.findings[0]?.code, "UBL_XSD_VALIDATOR_UNAVAILABLE");
    assert.equal(result.summary.configuredPathReadable, true);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});
