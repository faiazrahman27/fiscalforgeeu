import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  calculateInvoiceTotals,
  canonicalInvoiceSchema,
  validateCanonicalInvoice
} from "@invoice-lantern/invoice-core";
import {
  canonicalToUblInvoiceXml,
  inspectUblXsdArtifacts,
  validateUblXsd,
  ublInvoiceXmlToCanonicalInvoice
} from "./index.js";

function buildFullCanonicalInvoice() {
  return canonicalInvoiceSchema.parse({
    document: {
      type: "invoice",
      number: "INV-UBL-001",
      issueDate: "2026-04-29",
      dueDate: "2026-05-29",
      taxPointDate: "2026-04-30",
      currency: "EUR",
      buyerReference: "BR-001",
      orderReference: "ORDER-001",
      contractReference: "CONTRACT-001",
      projectReference: "PROJECT-001",
      accountingCost: "ACCT-001"
    },
    seller: {
      name: "Invoice Lantern Seller",
      legalName: "Invoice Lantern Seller GmbH",
      country: "DE",
      vatId: "DE123456789",
      taxRegistrationNumber: "HRB-SELLER-1",
      city: "Berlin",
      postalCode: "10115",
      street: "Example Street 1",
      additionalStreet: "Building A",
      region: "BE",
      electronicAddress: "seller@example.test",
      electronicAddressScheme: "EM",
      email: "seller@example.test",
      phone: "+493012345"
    },
    buyer: {
      name: "Invoice Lantern Buyer",
      legalName: "Invoice Lantern Buyer GmbH",
      country: "DE",
      vatId: "DE987654321",
      taxRegistrationNumber: "HRB-BUYER-2",
      city: "Munich",
      postalCode: "80331",
      street: "Buyer Street 2",
      electronicAddress: "buyer@example.test",
      electronicAddressScheme: "EM",
      email: "buyer@example.test"
    },
    delivery: {
      deliveryDate: "2026-05-01",
      locationId: "DELIVERY-001",
      country: "DE",
      address: {
        street: "Delivery Street 3",
        city: "Hamburg",
        postalCode: "20095",
        country: "DE"
      }
    },
    payment: {
      paymentMeansCode: "30",
      paymentReference: "RF18539007547034",
      terms: "Due within 30 days for technical sandbox testing.",
      dueDate: "2026-05-29",
      accountLabel: "Operating account",
      accountLast4: "6789"
    },
    lines: [
      {
        id: "1",
        description: "UBL readiness service",
        quantity: "2",
        unitCode: "EA",
        unitPrice: "50.00",
        discountAmount: "5.00",
        chargeAmount: "2.00",
        vatCategory: "S",
        vatRate: "19",
        itemName: "Readiness service",
        accountingCost: "LINE-ACCT-1",
        orderLineReference: "10"
      },
      {
        id: "2",
        description: "Interoperability review",
        quantity: "1",
        unitCode: "HUR",
        unitPrice: "25.00",
        vatCategory: "S",
        vatRate: "19",
        itemName: "Review"
      }
    ],
    allowances: [
      {
        id: "ALLOW-DOC-1",
        scope: "document",
        reason: "Educational sandbox discount",
        reasonCode: "95",
        amount: "10.00",
        baseAmount: "122.00",
        percentage: "8.1967",
        taxCategory: "S",
        vatRate: "19"
      }
    ],
    charges: [
      {
        id: "CHARGE-DOC-1",
        scope: "document",
        reason: "Handling",
        amount: "3.00",
        taxCategory: "S",
        vatRate: "19"
      }
    ]
  });
}

function buildUblInvoiceXml() {
  return canonicalToUblInvoiceXml(buildFullCanonicalInvoice());
}

function getUblMetadata(invoice: { metadata: Record<string, unknown> }) {
  const metadata = invoice.metadata.ubl;

  assert.equal(typeof metadata, "object");
  assert.notEqual(metadata, null);

  return metadata as Record<string, unknown>;
}

test("generates UBL XML with expanded canonical fields and safe wording", () => {
  const xml = buildUblInvoiceXml();

  assert.match(xml, /<cbc:ID>INV-UBL-001<\/cbc:ID>/);
  assert.match(xml, /<cbc:IssueDate>2026-04-29<\/cbc:IssueDate>/);
  assert.match(xml, /<cbc:DueDate>2026-05-29<\/cbc:DueDate>/);
  assert.match(xml, /<cbc:TaxPointDate>2026-04-30<\/cbc:TaxPointDate>/);
  assert.match(xml, /<cbc:DocumentCurrencyCode>EUR<\/cbc:DocumentCurrencyCode>/);
  assert.match(xml, /<cbc:BuyerReference>BR-001<\/cbc:BuyerReference>/);
  assert.match(xml, /<cac:OrderReference>/);
  assert.match(xml, /<cac:ContractDocumentReference>/);
  assert.match(xml, /<cac:ProjectReference>/);
  assert.match(xml, /<cbc:AccountingCost>ACCT-001<\/cbc:AccountingCost>/);
  assert.match(xml, /<cac:AccountingSupplierParty>/);
  assert.match(xml, /<cac:AccountingCustomerParty>/);
  assert.match(xml, /<cbc:EndpointID schemeID="EM">seller@example\.test<\/cbc:EndpointID>/);
  assert.match(xml, /<cac:Delivery>/);
  assert.match(xml, /<cac:PaymentMeans>/);
  assert.match(xml, /<cac:PaymentTerms>/);
  assert.match(xml, /<cac:AllowanceCharge>/);
  assert.match(xml, /<cbc:AllowanceTotalAmount currencyID="EUR">10.00<\/cbc:AllowanceTotalAmount>/);
  assert.match(xml, /<cbc:ChargeTotalAmount currencyID="EUR">3.00<\/cbc:ChargeTotalAmount>/);
  assert.match(xml, /<cbc:TaxAmount currencyID="EUR">21.85<\/cbc:TaxAmount>/);
  assert.match(xml, /<cbc:PayableAmount currencyID="EUR">136.85<\/cbc:PayableAmount>/);
  assert.match(xml, /<cac:InvoiceLine>/);
  assert.match(xml, /not official validation/i);
  assert.match(xml, /not Peppol-certified/i);
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
  assert.equal(result.detected.dueDate, "2026-05-29");
  assert.equal(result.detected.taxPointDate, "2026-04-30");
  assert.equal(result.detected.currency, "EUR");
  assert.equal(result.detected.sellerName, "Invoice Lantern Seller");
  assert.equal(result.detected.sellerCountry, "DE");
  assert.equal(result.detected.buyerName, "Invoice Lantern Buyer");
  assert.equal(result.detected.buyerCountry, "DE");
  assert.equal(result.detected.lineCount, 2);

  assert.equal(result.invoice.document.number, "INV-UBL-001");
  assert.equal(result.invoice.document.issueDate, "2026-04-29");
  assert.equal(result.invoice.document.dueDate, "2026-05-29");
  assert.equal(result.invoice.document.taxPointDate, "2026-04-30");
  assert.equal(result.invoice.document.currency, "EUR");
  assert.equal(result.invoice.document.buyerReference, "BR-001");
  assert.equal(result.invoice.document.orderReference, "ORDER-001");
  assert.equal(result.invoice.document.contractReference, "CONTRACT-001");
  assert.equal(result.invoice.document.projectReference, "PROJECT-001");
  assert.equal(result.invoice.document.accountingCost, "ACCT-001");
  assert.equal(result.invoice.seller.name, "Invoice Lantern Seller");
  assert.equal(result.invoice.seller.legalName, "Invoice Lantern Seller GmbH");
  assert.equal(result.invoice.seller.country, "DE");
  assert.equal(result.invoice.seller.vatId, "DE123456789");
  assert.equal(result.invoice.seller.electronicAddress, "seller@example.test");
  assert.equal(result.invoice.seller.electronicAddressScheme, "EM");
  assert.equal(result.invoice.buyer.name, "Invoice Lantern Buyer");
  assert.equal(result.invoice.buyer.country, "DE");
  assert.equal(result.invoice.buyer.vatId, "DE987654321");
  assert.equal(result.invoice.delivery?.deliveryDate, "2026-05-01");
  assert.equal(result.invoice.delivery?.locationId, "DELIVERY-001");
  assert.equal(result.invoice.payment?.paymentMeansCode, "30");
  assert.equal(result.invoice.payment?.paymentReference, "RF18539007547034");

  assert.equal(result.invoice.lines.length, 2);
  assert.equal(result.invoice.lines[0]?.id, "1");
  assert.equal(result.invoice.lines[0]?.description, "UBL readiness service");
  assert.equal(result.invoice.lines[0]?.quantity, "2");
  assert.equal(result.invoice.lines[0]?.unitCode, "EA");
  assert.equal(result.invoice.lines[0]?.unitPrice, "50.00");
  assert.equal(result.invoice.lines[0]?.discountAmount, "5.00");
  assert.equal(result.invoice.lines[0]?.chargeAmount, "2.00");
  assert.equal(result.invoice.lines[0]?.netAmount, "97.00");
  assert.equal(result.invoice.lines[0]?.vatCategory, "S");
  assert.equal(result.invoice.lines[0]?.vatRate, "19");
  assert.equal(result.invoice.allowances.length, 2);
  assert.equal(result.invoice.charges.length, 2);
  assert.equal(result.invoice.taxBreakdown[0]?.taxableAmount, "115.00");
  assert.equal(result.invoice.taxBreakdown[0]?.taxAmount, "21.85");
  assert.equal(result.invoice.totals.payableAmount, "136.85");

  const metadata = getUblMetadata(result.invoice);

  assert.equal(metadata.parsedAs, "ubl_2.1_technical_canonical_preview");

  const validation = validateCanonicalInvoice(result.invoice);

  assert.equal(validation.success, true);
});

test("round-trips canonical invoice through UBL with stable parties, lines, taxes, and totals", () => {
  const invoice = buildFullCanonicalInvoice();
  const originalTotals = calculateInvoiceTotals(invoice);
  const result = ublInvoiceXmlToCanonicalInvoice(canonicalToUblInvoiceXml(invoice));

  assert.equal(result.ok, true);
  assert.ok(result.invoice);

  const roundTripTotals = calculateInvoiceTotals(result.invoice);

  assert.equal(result.invoice.document.number, invoice.document.number);
  assert.equal(result.invoice.seller.name, invoice.seller.name);
  assert.equal(result.invoice.seller.vatId, invoice.seller.vatId);
  assert.equal(result.invoice.buyer.name, invoice.buyer.name);
  assert.equal(result.invoice.buyer.vatId, invoice.buyer.vatId);
  assert.equal(result.invoice.lines.length, invoice.lines.length);
  assert.equal(result.invoice.lines[0]?.discountAmount, "5.00");
  assert.equal(result.invoice.lines[0]?.chargeAmount, "2.00");
  assert.equal(result.invoice.allowances[0]?.amount, "10.00");
  assert.equal(result.invoice.charges[0]?.amount, "3.00");
  assert.equal(
    roundTripTotals.totals.lineExtensionAmount,
    originalTotals.totals.lineExtensionAmount
  );
  assert.equal(
    roundTripTotals.totals.taxExclusiveAmount,
    originalTotals.totals.taxExclusiveAmount
  );
  assert.equal(roundTripTotals.totals.taxAmount, originalTotals.totals.taxAmount);
  assert.equal(
    roundTripTotals.totals.taxInclusiveAmount,
    originalTotals.totals.taxInclusiveAmount
  );
  assert.equal(
    roundTripTotals.totals.payableAmount,
    originalTotals.totals.payableAmount
  );
  assert.deepEqual(roundTripTotals.taxBreakdown, originalTotals.taxBreakdown);
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

test("generates and parses UBL CreditNote XML through the canonical model", () => {
  const creditNote = canonicalInvoiceSchema.parse({
    ...buildFullCanonicalInvoice(),
    document: {
      ...buildFullCanonicalInvoice().document,
      type: "credit_note",
      number: "CN-UBL-001"
    }
  });
  const xml = canonicalToUblInvoiceXml(creditNote);
  const result = ublInvoiceXmlToCanonicalInvoice(xml);

  assert.match(xml, /<CreditNote\b/);
  assert.match(xml, /<cbc:CreditNoteTypeCode>381<\/cbc:CreditNoteTypeCode>/);
  assert.match(xml, /<cac:CreditNoteLine>/);
  assert.match(xml, /<cbc:CreditedQuantity unitCode="EA">2<\/cbc:CreditedQuantity>/);
  assert.equal(result.ok, true);
  assert.ok(result.invoice);
  assert.equal(result.detected.documentType, "credit_note");
  assert.equal(result.detected.invoiceNumber, "CN-UBL-001");
  assert.equal(result.invoice.document.type, "credit_note");
  assert.equal(result.invoice.lines[0]?.quantity, "2");
});

test("preserves unsupported detected UBL fields as metadata with warnings", () => {
  const xml = buildUblInvoiceXml().replace(
    "<cac:AccountingSupplierParty>",
    `<cac:AdditionalDocumentReference>
    <cbc:ID>ATTACHMENT-001</cbc:ID>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>`
  );
  const result = ublInvoiceXmlToCanonicalInvoice(xml);

  assert.equal(result.ok, true);
  assert.ok(result.invoice);
  assert.equal(result.detected.unsupportedFieldCount, 1);
  assert.equal(
    result.findings.some(
      (finding) =>
        finding.code === "UBL_UNSUPPORTED_FIELD_DETECTED" &&
        finding.severity === "warning" &&
        finding.fieldPath.includes("AdditionalDocumentReference")
    ),
    true
  );

  const metadata = getUblMetadata(result.invoice);
  const unsupportedFields = metadata.unsupportedFields as Record<string, unknown>[];

  assert.equal(Array.isArray(unsupportedFields), true);
  assert.equal(unsupportedFields[0]?.field, "AdditionalDocumentReference");
  assert.deepEqual(unsupportedFields[0]?.sampleIds, ["ATTACHMENT-001"]);
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

test("rejects excessive XML nesting before UBL parsing", () => {
  const nestedXml = `${"<?xml version=\"1.0\" encoding=\"UTF-8\"?>"}${"<Invoice>".repeat(160)}${"</Invoice>".repeat(160)}`;
  const result = ublInvoiceXmlToCanonicalInvoice(nestedXml);

  assert.equal(result.ok, false);
  assert.equal(
    result.findings.some(
      (finding) =>
        finding.code === "XML_NESTING_TOO_DEEP" &&
        finding.severity === "blocked"
    ),
    true
  );
});

test("UBL XSD adapter returns not_configured without artefact configuration", async () => {
  const result = await validateUblXsd({
    xml: buildUblInvoiceXml(),
    rootElement: "Invoice",
    documentType: "invoice"
  });

  assert.equal(result.status, "not_configured");
  assert.equal(result.checkType, "xsd_ubl");
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.artifactInfo.configured, false);
  assert.equal(result.artifactInfo.validatorName, "xmllint-wasm");
  assert.equal(result.artifactInfo.validatorAvailable, true);
  assert.equal(result.artifactInfo.artifactVersion, null);
  assert.equal(result.artifactInfo.invoiceSchema.status, "not_configured");
  assert.equal(result.artifactInfo.invoiceSchema.readable, false);
  assert.equal(result.artifactInfo.invoiceSchema.sha256, null);
  assert.equal(result.artifactInfo.creditNoteSchema.status, "not_configured");
  assert.equal(result.artifactInfo.dependencyGraph.status, "not_inspected");
  assert.match(result.artifactInfo.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(result.summary.validatorAvailable, true);
  assert.equal(result.summary.validatorName, "xmllint-wasm");
  assert.equal(
    result.findings.some(
      (finding) =>
        finding.code === "UBL_XSD_NOT_CONFIGURED" &&
        finding.status === "not_configured" &&
        finding.legalConfidence === "technical"
    ),
    true
  );
});

test("UBL XSD adapter derives standard root artefact paths and stays safe when missing", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));

  try {
    const result = await validateUblXsd({
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
    assert.equal(result.artifactInfo.invoiceSchema.configured, true);
    assert.equal(result.artifactInfo.invoiceSchema.readable, false);
    assert.equal(result.artifactInfo.invoiceSchema.status, "missing");
    assert.equal(result.artifactInfo.invoiceSchema.sha256, null);
    assert.equal(result.artifactInfo.creditNoteSchema.configured, true);
    assert.equal(result.artifactInfo.creditNoteSchema.status, "missing");
    assert.equal(result.findings[0]?.code, "UBL_XSD_NOT_CONFIGURED");
    assert.equal(result.summary.configuredPathReadable, false);
    assert.equal(result.summary.validationExecuted, false);
    assert.equal(result.summary.markedValid, false);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("UBL XSD adapter reports controlled error when local schema dependencies cannot resolve", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));
  const maindocPath = join(tempRoot, "xsd", "maindoc");
  const invoiceXsdPath = join(maindocPath, "UBL-Invoice-2.1.xsd");

  try {
    await mkdir(maindocPath, {
      recursive: true
    });
    await writeFile(
      invoiceXsdPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:include schemaLocation="../common/Missing-Test-Only-Dependency.xsd"/>
  <xs:element name="Invoice" type="InvoiceType"/>
</xs:schema>`,
      "utf8"
    );

    const result = await validateUblXsd({
      xml: buildUblInvoiceXml(),
      rootElement: "Invoice",
      documentType: "invoice",
      artifactConfig: {
        rootDir: tempRoot,
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
    assert.equal(result.artifactInfo.invoiceSchema.readable, true);
    assert.match(result.artifactInfo.invoiceSchema.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(result.artifactInfo.dependencyGraph.inspected, true);
    assert.equal(result.artifactInfo.dependencyGraph.status, "missing_dependency");
    assert.equal(result.findings[0]?.code, "UBL_XSD_VALIDATOR_ERROR");
    assert.equal(result.summary.validatorAvailable, true);
    assert.equal(result.summary.schemaPathUsed, invoiceXsdPath);
    assert.equal(result.summary.reason, "schema_dependency_missing");
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

async function writeTestOnlyInvoiceXsdFixture(tempRoot: string) {
  const maindocPath = join(tempRoot, "xsd", "maindoc");
  const commonPath = join(tempRoot, "xsd", "common");
  const invoiceXsdPath = join(maindocPath, "UBL-Invoice-2.1.xsd");
  const baseXsdPath = join(commonPath, "Invoice-Test-Only-Base.xsd");

  await mkdir(maindocPath, {
    recursive: true
  });
  await mkdir(commonPath, {
    recursive: true
  });
  await writeFile(
    invoiceXsdPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:include schemaLocation="../common/Invoice-Test-Only-Base.xsd"/>
  <xs:element name="Invoice" type="InvoiceType"/>
</xs:schema>`,
    "utf8"
  );
  await writeFile(
    baseXsdPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="InvoiceType">
    <xs:sequence>
      <xs:element name="ID" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`,
    "utf8"
  );

  return invoiceXsdPath;
}

async function writeTestOnlyCreditNoteXsdFixture(tempRoot: string) {
  const maindocPath = join(tempRoot, "xsd", "maindoc");
  const creditNoteXsdPath = join(maindocPath, "UBL-CreditNote-2.1.xsd");

  await mkdir(maindocPath, {
    recursive: true
  });
  await writeFile(
    creditNoteXsdPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="CreditNote">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="ID" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`,
    "utf8"
  );

  return creditNoteXsdPath;
}

test("UBL XSD artefact registry reports readable invoice schema metadata", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));

  try {
    const invoiceXsdPath = await writeTestOnlyInvoiceXsdFixture(tempRoot);
    const inspection = await inspectUblXsdArtifacts({
      rootDir: tempRoot,
      invoiceXsdPath,
      artifactVersion: "test-only"
    });

    assert.equal(inspection.artifactInfo.configured, true);
    assert.equal(inspection.artifactInfo.artifactVersion, "test-only");
    assert.equal(inspection.invoiceSchema.configured, true);
    assert.equal(inspection.invoiceSchema.readable, true);
    assert.equal(inspection.invoiceSchema.usable, true);
    assert.equal(inspection.invoiceSchema.status, "available");
    assert.equal(inspection.invoiceSchema.path, invoiceXsdPath);
    assert.match(inspection.invoiceSchema.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(inspection.creditNoteSchema.status, "not_configured");
    assert.equal(inspection.artifactInfo.dependencyGraph.status, "not_inspected");
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("UBL XSD artefact registry reports readable credit note schema metadata", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));

  try {
    const creditNoteXsdPath = await writeTestOnlyCreditNoteXsdFixture(tempRoot);
    const inspection = await inspectUblXsdArtifacts({
      rootDir: tempRoot,
      creditNoteXsdPath,
      artifactVersion: "test-only"
    });

    assert.equal(inspection.artifactInfo.configured, true);
    assert.equal(inspection.creditNoteSchema.configured, true);
    assert.equal(inspection.creditNoteSchema.readable, true);
    assert.equal(inspection.creditNoteSchema.usable, true);
    assert.equal(inspection.creditNoteSchema.status, "available");
    assert.equal(inspection.creditNoteSchema.path, creditNoteXsdPath);
    assert.match(inspection.creditNoteSchema.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(inspection.invoiceSchema.status, "not_configured");
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("UBL XSD adapter reports unreadable configured schema path metadata", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));
  const directoryAsSchemaPath = join(tempRoot, "xsd", "maindoc");

  try {
    await mkdir(directoryAsSchemaPath, {
      recursive: true
    });

    const result = await validateUblXsd({
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<Invoice><ID>INV-XSD-UNREADABLE-001</ID></Invoice>`,
      rootElement: "Invoice",
      documentType: "invoice",
      artifactConfig: {
        rootDir: tempRoot,
        invoiceXsdPath: directoryAsSchemaPath,
        artifactVersion: "test-only"
      }
    });

    assert.equal(result.status, "not_configured");
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(result.artifactInfo.configured, false);
    assert.equal(result.artifactInfo.invoiceSchema.configured, true);
    assert.equal(result.artifactInfo.invoiceSchema.status, "unreadable");
    assert.equal(result.artifactInfo.invoiceSchema.reason, "not_a_file");
    assert.equal(result.artifactInfo.invoiceSchema.sha256, null);
    assert.equal(result.summary.reason, "local_ubl_xsd_artifact_unreadable");
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("UBL XSD adapter blocks configured schema paths outside the artefact root", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-root-"));
  const outsideRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-out-"));
  const outsideInvoiceXsdPath = join(outsideRoot, "UBL-Invoice-2.1.xsd");

  try {
    await writeFile(
      outsideInvoiceXsdPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Invoice" type="xs:string"/>
</xs:schema>`,
      "utf8"
    );

    const result = await validateUblXsd({
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>INV-XSD-OUT-OF-ROOT-001</Invoice>`,
      rootElement: "Invoice",
      documentType: "invoice",
      artifactConfig: {
        rootDir: tempRoot,
        invoiceXsdPath: outsideInvoiceXsdPath,
        artifactVersion: "test-only"
      }
    });

    assert.equal(result.status, "not_configured");
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(result.artifactInfo.configured, false);
    assert.equal(result.artifactInfo.invoiceSchema.configured, true);
    assert.equal(result.artifactInfo.invoiceSchema.status, "out_of_root");
    assert.equal(result.artifactInfo.invoiceSchema.readable, false);
    assert.equal(result.artifactInfo.invoiceSchema.sha256, null);
    assert.equal(
      result.summary.reason,
      "local_ubl_xsd_artifact_outside_configured_root"
    );
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
    await rm(outsideRoot, {
      force: true,
      recursive: true
    });
  }
});

test("UBL XSD adapter returns passed only after real local XSD validation executes", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));
  const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice><ID>INV-XSD-VALID-001</ID></Invoice>`;

  try {
    const invoiceXsdPath = await writeTestOnlyInvoiceXsdFixture(tempRoot);
    const result = await validateUblXsd({
      xml: validXml,
      rootElement: "Invoice",
      documentType: "invoice",
      artifactConfig: {
        rootDir: tempRoot,
        invoiceXsdPath,
        artifactVersion: "test-only"
      }
    });

    assert.equal(result.status, "passed");
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, true);
    assert.equal(result.artifactInfo.configured, true);
    assert.equal(result.artifactInfo.validatorName, "xmllint-wasm");
    assert.equal(result.artifactInfo.validatorAvailable, true);
    assert.equal(result.artifactInfo.artifactVersion, "test-only");
    assert.equal(result.artifactInfo.invoiceSchema.status, "available");
    assert.equal(result.artifactInfo.invoiceSchema.readable, true);
    assert.match(result.artifactInfo.invoiceSchema.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(result.artifactInfo.dependencyGraph.inspected, true);
    assert.equal(result.artifactInfo.dependencyGraph.status, "ready");
    assert.equal(result.artifactInfo.dependencyGraph.dependencyCount, 1);
    assert.equal(result.summary.configured, true);
    assert.equal(result.summary.validationExecuted, true);
    assert.equal(result.summary.markedValid, true);
    assert.equal(result.summary.errorCount, 0);
    assert.equal(result.summary.schemaPathUsed, invoiceXsdPath);
    assert.equal(result.summary.artifactVersion, "test-only");
    assert.equal(result.summary.dependencyGraphStatus, "ready");
    assert.equal(result.findings[0]?.code, "UBL_XSD_VALIDATION_PASSED");
    assert.equal(JSON.stringify(result).includes(validXml), false);
    assert.equal(JSON.stringify(result).includes("<Invoice"), false);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("UBL XSD adapter can select a configured readable CreditNote schema", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));
  const creditNoteXml = `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote><ID>CN-XSD-VALID-001</ID></CreditNote>`;

  try {
    const creditNoteXsdPath = await writeTestOnlyCreditNoteXsdFixture(tempRoot);
    const result = await validateUblXsd({
      xml: creditNoteXml,
      rootElement: "CreditNote",
      documentType: "credit_note",
      artifactConfig: {
        rootDir: tempRoot,
        creditNoteXsdPath,
        artifactVersion: "test-only"
      }
    });

    assert.equal(result.status, "passed");
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, true);
    assert.equal(result.artifactInfo.configured, true);
    assert.equal(result.artifactInfo.creditNoteSchema.status, "available");
    assert.equal(result.artifactInfo.creditNoteSchema.readable, true);
    assert.match(
      result.artifactInfo.creditNoteSchema.sha256 ?? "",
      /^[a-f0-9]{64}$/
    );
    assert.equal(result.summary.schemaPathUsed, creditNoteXsdPath);
    assert.equal(JSON.stringify(result).includes(creditNoteXml), false);
    assert.equal(JSON.stringify(result).includes("<CreditNote"), false);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("UBL XSD adapter returns failed after real local XSD validation finds schema errors", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-ubl-xsd-"));
  const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice><Unexpected>INV-XSD-INVALID-001</Unexpected></Invoice>`;

  try {
    const invoiceXsdPath = await writeTestOnlyInvoiceXsdFixture(tempRoot);
    const result = await validateUblXsd({
      xml: invalidXml,
      rootElement: "Invoice",
      documentType: "invoice",
      artifactConfig: {
        rootDir: tempRoot,
        invoiceXsdPath,
        artifactVersion: "test-only"
      }
    });

    assert.equal(result.status, "failed");
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, false);
    assert.equal(result.artifactInfo.configured, true);
    assert.equal(result.artifactInfo.artifactVersion, "test-only");
    assert.equal(result.artifactInfo.invoiceSchema.status, "available");
    assert.match(result.artifactInfo.invoiceSchema.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(result.artifactInfo.dependencyGraph.status, "ready");
    assert.equal(result.artifactInfo.dependencyGraph.dependencyCount, 1);
    assert.equal(result.summary.configured, true);
    assert.equal(result.summary.validationExecuted, true);
    assert.equal(result.summary.markedValid, false);
    assert.equal(result.summary.errorCount, 1);
    assert.equal(result.summary.rawErrorCount, 1);
    assert.equal(result.summary.mappedFindingCount, 1);
    assert.equal(result.summary.schemaPathUsed, invoiceXsdPath);
    assert.equal(result.summary.artifactVersion, "test-only");
    assert.equal(result.summary.dependencyGraphStatus, "ready");
    assert.equal(
      result.findings.some(
        (finding) =>
          finding.code === "UBL_XSD_ELEMENT_INVALID" &&
          finding.severity === "fatal" &&
          finding.checkType === "xsd_ubl" &&
          finding.status === "failed" &&
          finding.legalConfidence === "technical" &&
          finding.technicalCode === "element_invalid" &&
          typeof finding.technicalMessage === "string" &&
          finding.sourceLabels?.includes("xmllint-wasm")
      ),
      true
    );
    assert.equal(JSON.stringify(result).includes(invalidXml), false);
    assert.equal(JSON.stringify(result).includes("<Invoice"), false);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});
