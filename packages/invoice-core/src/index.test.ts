import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCoreValidationFindings,
  calculateInvoiceTotals,
  canonicalInvoiceSchema,
  type CanonicalInvoice
} from "./index.js";

function buildInvoice(
  overrides: Partial<CanonicalInvoice> = {}
): CanonicalInvoice {
  const base = canonicalInvoiceSchema.parse({
    document: {
      type: "invoice",
      number: "INV-001",
      currency: "EUR",
      issueDate: "2026-04-29"
    },
    seller: {
      name: "Invoice Lantern Seller",
      country: "DE",
      vatId: "DE123456789"
    },
    buyer: {
      name: "Invoice Lantern Buyer",
      country: "DE",
      vatId: "DE987654321"
    },
    lines: [
      {
        id: "1",
        description: "Readiness service",
        quantity: "1",
        unitPrice: "100.00",
        vatCategory: "S",
        vatRate: "19"
      }
    ]
  });

  return {
    ...base,
    ...overrides,
    document: {
      ...base.document,
      ...overrides.document
    },
    seller: {
      ...base.seller,
      ...overrides.seller
    },
    buyer: {
      ...base.buyer,
      ...overrides.buyer
    },
    totals: {
      ...base.totals,
      ...overrides.totals
    }
  };
}

test("uses decimal-safe string math for 0.10 plus 0.20", () => {
  const invoice = buildInvoice({
    lines: [
      {
        id: "1",
        description: "First amount",
        quantity: "1",
        unitCode: "",
        unitPrice: "0.10",
        vatCategory: "S",
        vatRate: "0"
      },
      {
        id: "2",
        description: "Second amount",
        quantity: "1",
        unitCode: "",
        unitPrice: "0.20",
        vatCategory: "S",
        vatRate: "0"
      }
    ]
  });

  assert.equal(calculateInvoiceTotals(invoice).totals.lineExtensionAmount, "0.30");
});

test("calculates line net amount from quantity and unit price", () => {
  const invoice = buildInvoice({
    lines: [
      {
        id: "1",
        description: "Fractional quantity",
        quantity: "2.5",
        unitCode: "",
        unitPrice: "4.00",
        vatCategory: "S",
        vatRate: "0"
      }
    ]
  });

  assert.equal(calculateInvoiceTotals(invoice).lines[0]?.netAmount, "10.00");
});

test("calculates tax amount and payable total", () => {
  const totals = calculateInvoiceTotals(buildInvoice()).totals;

  assert.equal(totals.taxAmount, "19.00");
  assert.equal(totals.payableAmount, "119.00");
});

test("flags cross-border buyer VAT and review behavior", () => {
  const invoice = buildInvoice({
    buyer: {
      name: "French Buyer",
      country: "FR",
      vatId: ""
    }
  });

  const findings = buildCoreValidationFindings(invoice);

  assert.equal(
    findings.some(
      (finding) =>
        finding.code === "BUYER_VAT_ID_REQUIRED_FOR_CROSS_BORDER_SIMULATION" &&
        finding.severity === "fatal"
    ),
    true
  );
  assert.equal(
    findings.some(
      (finding) =>
        finding.code === "CROSS_BORDER_REVIEW_REQUIRED" &&
        finding.severity === "warning"
    ),
    true
  );
});

test("flags zero-value lines as warnings", () => {
  const invoice = buildInvoice({
    lines: [
      {
        id: "1",
        description: "No-charge readiness line",
        quantity: "1",
        unitCode: "",
        unitPrice: "0.00",
        vatCategory: "S",
        vatRate: "0"
      }
    ]
  });

  const findings = buildCoreValidationFindings(invoice);

  assert.equal(
    findings.some(
      (finding) =>
        finding.code === "ZERO_VALUE_LINE_WARNING" &&
        finding.severity === "warning"
    ),
    true
  );
});

test("flags line net amount, tax amount, and payable total mismatches", () => {
  const invoice = buildInvoice({
    lines: [
      {
        id: "1",
        description: "Mismatched line",
        quantity: "1",
        unitCode: "",
        unitPrice: "100.00",
        vatCategory: "S",
        vatRate: "19",
        netAmount: "90.00",
        taxAmount: "1.00"
      }
    ],
    totals: {
      payableAmount: "1.00"
    }
  });

  const codes = buildCoreValidationFindings(invoice).map((finding) => finding.code);

  assert.equal(codes.includes("LINE_NET_AMOUNT_MISMATCH"), true);
  assert.equal(codes.includes("LINE_TAX_AMOUNT_MISMATCH"), true);
  assert.equal(codes.includes("PAYABLE_AMOUNT_MISMATCH"), true);
});

test("adds rule metadata to core validation findings", () => {
  const invoice = buildInvoice({
    document: {
      number: "",
      currency: "EUR",
      issueDate: "2026-04-29"
    }
  });

  const finding = buildCoreValidationFindings(invoice).find(
    (item) => item.code === "DOCUMENT_NUMBER_REQUIRED"
  );

  assert.ok(finding);
  assert.equal(finding.ruleSetCode, "INVOICE_LANTERN_CORE");
  assert.equal(finding.ruleVersion, "2026.04.1");
  assert.equal(finding.legalConfidence, "technical");
  assert.equal(
    finding.fixSuggestion,
    "Add the invoice document number before validation or export."
  );
  assert.deepEqual(finding.sourceLabels, [
    "Invoice Lantern internal technical validation policy"
  ]);
});
