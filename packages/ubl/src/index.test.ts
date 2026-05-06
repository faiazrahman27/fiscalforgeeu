import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  canonicalInvoiceSchema,
  validateCanonicalInvoice
} from "@invoice-lantern/invoice-core";
import {
  canonicalToUblInvoiceXml,
  inspectUblXsdArtifacts,
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
