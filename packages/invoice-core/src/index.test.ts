import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCoreValidationFindings,
  calculateInvoiceTotals,
  canonicalInvoiceSchema,
  type CanonicalInvoice
} from "./index.js";

type InvoiceOverrides = {
  document?: Partial<CanonicalInvoice["document"]>;
  seller?: Partial<CanonicalInvoice["seller"]>;
  buyer?: Partial<CanonicalInvoice["buyer"]>;
  lines?: CanonicalInvoice["lines"];
  taxSubtotals?: CanonicalInvoice["taxSubtotals"];
  totals?: Partial<CanonicalInvoice["totals"]>;
};

function buildInvoice(overrides: InvoiceOverrides = {}): CanonicalInvoice {
  const base = canonicalInvoiceSchema.parse({
    document: {
      type: "invoice",
      number: "INV-001",
      currency: "EUR",
      issueDate: "2026-04-29",
      dueDate: "2026-05-29"
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
    lines: overrides.lines ?? base.lines,
    taxSubtotals: overrides.taxSubtotals ?? base.taxSubtotals,
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

test("calculates allowances, charges, prepaid amount, and rounding into totals", () => {
  const invoice = buildInvoice({
    totals: {
      allowanceTotalAmount: "10.00",
      chargeTotalAmount: "5.00",
      prepaidAmount: "20.00",
      payableRoundingAmount: "0.01"
    }
  });

  const totals = calculateInvoiceTotals(invoice).totals;

  assert.equal(totals.lineExtensionAmount, "100.00");
  assert.equal(totals.allowanceTotalAmount, "10.00");
  assert.equal(totals.chargeTotalAmount, "5.00");
  assert.equal(totals.taxExclusiveAmount, "95.00");
  assert.equal(totals.taxAmount, "19.00");
  assert.equal(totals.taxInclusiveAmount, "114.00");
  assert.equal(totals.prepaidAmount, "20.00");
  assert.equal(totals.payableRoundingAmount, "0.01");
  assert.equal(totals.payableAmount, "94.01");
});

test("groups calculated tax subtotals by VAT category and VAT rate", () => {
  const invoice = buildInvoice({
    lines: [
      {
        id: "1",
        description: "Standard VAT service",
        quantity: "1",
        unitCode: "",
        unitPrice: "100.00",
        vatCategory: "S",
        vatRate: "19"
      },
      {
        id: "2",
        description: "Second standard VAT service",
        quantity: "2",
        unitCode: "",
        unitPrice: "50.00",
        vatCategory: "S",
        vatRate: "19"
      },
      {
        id: "3",
        description: "Zero VAT service",
        quantity: "1",
        unitCode: "",
        unitPrice: "25.00",
        vatCategory: "Z",
        vatRate: "0"
      }
    ]
  });

  const subtotals = calculateInvoiceTotals(invoice).taxSubtotals;

  assert.deepEqual(subtotals, [
    {
      vatCategory: "S",
      vatRate: "19",
      taxableAmount: "200.00",
      taxAmount: "38.00"
    },
    {
      vatCategory: "Z",
      vatRate: "0",
      taxableAmount: "25.00",
      taxAmount: "0.00"
    }
  ]);
});

test("flags missing issue date and due date before issue date", () => {
  const missingIssueDateInvoice = buildInvoice({
    document: {
      issueDate: ""
    }
  });

  const missingIssueDateCodes = buildCoreValidationFindings(
    missingIssueDateInvoice
  ).map((finding) => finding.code);

  assert.equal(
    missingIssueDateCodes.includes("DOCUMENT_ISSUE_DATE_RECOMMENDED"),
    true
  );

  const invalidDueDateInvoice = buildInvoice({
    document: {
      issueDate: "2026-04-29",
      dueDate: "2026-04-01"
    }
  });

  const invalidDueDateCodes = buildCoreValidationFindings(
    invalidDueDateInvoice
  ).map((finding) => finding.code);

  assert.equal(invalidDueDateCodes.includes("DUE_DATE_BEFORE_ISSUE_DATE"), true);
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

test("flags missing VAT category and invalid VAT rate", () => {
  const missingVatCategoryInvoice = buildInvoice({
    lines: [
      {
        id: "1",
        description: "Missing VAT category",
        quantity: "1",
        unitCode: "",
        unitPrice: "100.00",
        vatCategory: "",
        vatRate: "19"
      }
    ]
  });

  const missingVatCategoryCodes = buildCoreValidationFindings(
    missingVatCategoryInvoice
  ).map((finding) => finding.code);

  assert.equal(
    missingVatCategoryCodes.includes("LINE_VAT_CATEGORY_RECOMMENDED"),
    true
  );

  const missingVatRateInvoice = buildInvoice({
    lines: [
      {
        id: "1",
        description: "Missing VAT rate",
        quantity: "1",
        unitCode: "",
        unitPrice: "100.00",
        vatCategory: "S",
        vatRate: ""
      }
    ]
  });

  const missingVatRateCodes = buildCoreValidationFindings(
    missingVatRateInvoice
  ).map((finding) => finding.code);

  assert.equal(missingVatRateCodes.includes("LINE_VAT_RATE_REQUIRED"), true);

  const negativeVatRateInvoice = buildInvoice({
    lines: [
      {
        id: "1",
        description: "Negative VAT rate",
        quantity: "1",
        unitCode: "",
        unitPrice: "100.00",
        vatCategory: "S",
        vatRate: "-1"
      }
    ]
  });

  const negativeVatRateCodes = buildCoreValidationFindings(
    negativeVatRateInvoice
  ).map((finding) => finding.code);

  assert.equal(
    negativeVatRateCodes.includes("LINE_VAT_RATE_NON_NEGATIVE"),
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

test("flags document total mismatches", () => {
  const invoice = buildInvoice({
    totals: {
      lineExtensionAmount: "90.00",
      allowanceTotalAmount: "10.00",
      chargeTotalAmount: "5.00",
      taxExclusiveAmount: "1.00",
      taxAmount: "2.00",
      taxInclusiveAmount: "3.00",
      payableAmount: "4.00"
    }
  });

  const codes = buildCoreValidationFindings(invoice).map((finding) => finding.code);

  assert.equal(codes.includes("LINE_EXTENSION_AMOUNT_MISMATCH"), true);
  assert.equal(codes.includes("TAX_EXCLUSIVE_AMOUNT_MISMATCH"), true);
  assert.equal(codes.includes("TAX_AMOUNT_MISMATCH"), true);
  assert.equal(codes.includes("TAX_INCLUSIVE_AMOUNT_MISMATCH"), true);
  assert.equal(codes.includes("PAYABLE_AMOUNT_MISMATCH"), true);
});

test("flags tax subtotal mismatches and unmatched subtotal groups", () => {
  const invoice = buildInvoice({
    taxSubtotals: [
      {
        vatCategory: "S",
        vatRate: "19",
        taxableAmount: "50.00",
        taxAmount: "5.00"
      },
      {
        vatCategory: "Z",
        vatRate: "0",
        taxableAmount: "1.00",
        taxAmount: "0.00"
      }
    ]
  });

  const codes = buildCoreValidationFindings(invoice).map((finding) => finding.code);

  assert.equal(codes.includes("TAX_SUBTOTAL_TAXABLE_AMOUNT_MISMATCH"), true);
  assert.equal(codes.includes("TAX_SUBTOTAL_TAX_AMOUNT_MISMATCH"), true);
  assert.equal(codes.includes("TAX_SUBTOTAL_UNMATCHED"), true);
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

  if (!finding) {
    throw new Error("Expected DOCUMENT_NUMBER_REQUIRED finding.");
  }

  assert.equal(finding.ruleSetCode, "INVOICE_LANTERN_CORE");
  assert.equal(finding.ruleVersion, "2026.05.1");
  assert.equal(finding.legalConfidence, "technical");
  assert.equal(
    finding.fixSuggestion,
    "Add the invoice document number before validation or export."
  );
  assert.deepEqual(finding.sourceLabels, [
    "Invoice Lantern internal technical validation policy"
  ]);
});
