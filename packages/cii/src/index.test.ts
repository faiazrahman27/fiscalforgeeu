import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalInvoice } from "@invoice-lantern/invoice-core";
import {
  CII_TECHNICAL_DISCLAIMER,
  buildCiiExportFindings,
  canonicalToCiiInvoiceXml,
  ciiInvoiceXmlToCanonicalInvoice,
  detectCiiDocumentType,
  inspectCiiXmlSafety
} from "./index.js";

function buildCanonicalInvoice(
  overrides: Partial<CanonicalInvoice> = {}
): CanonicalInvoice {
  return {
    profile: "EN16931",
    document: {
      type: "invoice",
      number: "INV-CII-001",
      issueDate: "2026-05-15",
      dueDate: "2026-06-14",
      taxPointDate: "",
      currency: "EUR",
      profile: "EN16931",
      buyerReference: "BUYER-REF-1",
      contractReference: "",
      orderReference: "",
      projectReference: "",
      accountingCost: ""
    },
    seller: {
      name: "Lantern Seller GmbH",
      legalName: "Lantern Seller GmbH",
      country: "DE",
      vatId: "DE123456789",
      taxRegistrationNumber: "HRB 1000",
      electronicAddress: "seller@example.test",
      electronicAddressScheme: "EM",
      email: "seller@example.test",
      phone: "+491234567890",
      address: {
        street: "Seller Street 1",
        additionalStreet: "",
        city: "Berlin",
        postalCode: "10115",
        region: "",
        country: "DE"
      },
      city: "Berlin",
      postalCode: "10115",
      street: "Seller Street 1",
      additionalStreet: "",
      region: ""
    },
    buyer: {
      name: "Lantern Buyer BV",
      legalName: "Lantern Buyer BV",
      country: "NL",
      vatId: "NL123456789B01",
      taxRegistrationNumber: "",
      electronicAddress: "buyer@example.test",
      electronicAddressScheme: "EM",
      email: "buyer@example.test",
      phone: "",
      address: {
        street: "Buyer Road 2",
        additionalStreet: "",
        city: "Amsterdam",
        postalCode: "1012",
        region: "",
        country: "NL"
      },
      city: "Amsterdam",
      postalCode: "1012",
      street: "Buyer Road 2",
      additionalStreet: "",
      region: ""
    },
    payment: {
      paymentMeansCode: "",
      paymentReference: "INV-CII-001",
      terms: "Pay within 30 days.",
      dueDate: "2026-06-14",
      accountLabel: "",
      accountLast4: ""
    },
    lines: [
      {
        id: "1",
        description: "Technical validation service",
        itemName: "Validation service",
        quantity: "2.50",
        unitCode: "HUR",
        unitPrice: "100.00",
        discountAmount: "",
        chargeAmount: "",
        netAmount: "250.00",
        taxAmount: "47.50",
        vatCategory: "S",
        vatRate: "19",
        accountingCost: "",
        orderLineReference: ""
      }
    ],
    allowances: [],
    charges: [],
    taxBreakdown: [
      {
        taxCategory: "S",
        taxScheme: "VAT",
        vatCategory: "S",
        vatRate: "19",
        taxableAmount: "250.00",
        taxAmount: "47.50",
        exemptionReason: "",
        exemptionReasonCode: ""
      }
    ],
    taxSubtotals: [
      {
        taxCategory: "S",
        taxScheme: "VAT",
        vatCategory: "S",
        vatRate: "19",
        taxableAmount: "250.00",
        taxAmount: "47.50",
        exemptionReason: "",
        exemptionReasonCode: ""
      }
    ],
    totals: {
      lineExtensionAmount: "250.00",
      allowanceTotalAmount: "",
      chargeTotalAmount: "",
      taxExclusiveAmount: "250.00",
      taxAmount: "47.50",
      taxTotalAmount: "47.50",
      taxInclusiveAmount: "297.50",
      prepaidAmount: "",
      payableRoundingAmount: "",
      payableAmount: "297.50"
    },
    metadata: {},
    legal: {
      legalConfidence: "technical",
      disclaimer:
        "Invoice Lantern technical test invoice. Not legal, tax, accounting, filing, certification, or authority advice."
    },
    ...overrides
  };
}

test("generates CII XML from a valid canonical invoice", () => {
  const xml = canonicalToCiiInvoiceXml(buildCanonicalInvoice());

  assert.match(xml, /<rsm:CrossIndustryInvoice/);
  assert.match(xml, /<ram:ID>INV-CII-001<\/ram:ID>/);
  assert.match(xml, /<ram:InvoiceCurrencyCode>EUR<\/ram:InvoiceCurrencyCode>/);
  assert.match(xml, /Technical validation service/);
});

test("generated XML includes CII root and safe namespaces", () => {
  const xml = canonicalToCiiInvoiceXml(buildCanonicalInvoice());

  assert.match(
    xml,
    /xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"/
  );
  assert.match(
    xml,
    /xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"/
  );
  assert.doesNotMatch(xml, /<!DOCTYPE/i);
  assert.doesNotMatch(xml, /<!ENTITY/i);
});

test("parses generated CII XML back into canonical invoice structure", () => {
  const invoice = buildCanonicalInvoice();
  const xml = canonicalToCiiInvoiceXml(invoice);
  const parsed = ciiInvoiceXmlToCanonicalInvoice(xml);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.invoice?.document.number, invoice.document.number);
  assert.equal(parsed.invoice?.document.issueDate, invoice.document.issueDate);
  assert.equal(parsed.invoice?.document.dueDate, invoice.document.dueDate);
  assert.equal(parsed.invoice?.seller.name, invoice.seller.name);
  assert.equal(parsed.invoice?.buyer.country, invoice.buyer.country);
  assert.equal(parsed.invoice?.lines[0]?.description, invoice.lines[0]?.description);
});

test("rejects DTD, XXE, and ENTITY input", () => {
  const unsafeXml = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">&xxe;</rsm:CrossIndustryInvoice>`;
  const safety = inspectCiiXmlSafety(unsafeXml);
  const parsed = ciiInvoiceXmlToCanonicalInvoice(unsafeXml);

  assert.equal(safety.safe, false);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.findings[0]?.severity, "blocked");
  assert.match(parsed.findings[0]?.message ?? "", /DOCTYPE|DTD|ENTITY|external/i);
});

test("rejects oversized or excessive-depth XML", () => {
  const xml = canonicalToCiiInvoiceXml(buildCanonicalInvoice());
  const oversized = ciiInvoiceXmlToCanonicalInvoice(xml, {
    maxBytes: 20
  });
  const deepXml = `${"<a>".repeat(160)}${"</a>".repeat(160)}`;
  const excessiveDepth = ciiInvoiceXmlToCanonicalInvoice(deepXml, {
    maxDepth: 25
  });

  assert.equal(oversized.ok, false);
  assert.equal(oversized.findings[0]?.code, "XML_BODY_TOO_LARGE");
  assert.equal(excessiveDepth.ok, false);
  assert.equal(excessiveDepth.findings[0]?.code, "XML_NESTING_TOO_DEEP");
});

test("preserves decimal strings", () => {
  const xml = canonicalToCiiInvoiceXml(buildCanonicalInvoice());
  const parsed = ciiInvoiceXmlToCanonicalInvoice(xml);

  assert.equal(parsed.invoice?.lines[0]?.quantity, "2.50");
  assert.equal(parsed.invoice?.lines[0]?.unitPrice, "100.00");
  assert.equal(parsed.invoice?.lines[0]?.netAmount, "250.00");
  assert.equal(parsed.invoice?.totals.payableAmount, "297.50");
});

test("returns legal-safe technical disclaimer and findings", () => {
  const invoice = buildCanonicalInvoice();
  const xml = canonicalToCiiInvoiceXml(invoice);
  const parsed = ciiInvoiceXmlToCanonicalInvoice(xml);
  const exportFindings = buildCiiExportFindings(invoice);

  assert.match(CII_TECHNICAL_DISCLAIMER, /not official CII certification/i);
  assert.match(parsed.disclaimer, /not official CII certification/i);
  assert.ok(parsed.findings.some((finding) => finding.category === "CII"));
  assert.ok(
    exportFindings.some(
      (finding) => finding.legalConfidence === "professional_review_required"
    )
  );
});

test("handles invoice and credit note type safely where possible", () => {
  const invoiceXml = canonicalToCiiInvoiceXml(buildCanonicalInvoice());
  const creditNoteXml = canonicalToCiiInvoiceXml(
    buildCanonicalInvoice({
      document: {
        ...buildCanonicalInvoice().document,
        type: "credit_note",
        number: "CN-CII-001"
      }
    })
  );
  const parsedCreditNote = ciiInvoiceXmlToCanonicalInvoice(creditNoteXml);

  assert.equal(detectCiiDocumentType(invoiceXml), "invoice");
  assert.equal(detectCiiDocumentType(creditNoteXml), "credit_note");
  assert.equal(parsedCreditNote.invoice?.document.type, "credit_note");
});
