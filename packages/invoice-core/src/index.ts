import { Decimal } from "decimal.js";
import { z } from "zod";

export type ValidationFindingSeverity = "info" | "warning" | "fatal" | "blocked";

export type LegalConfidence =
  | "technical"
  | "standard_based"
  | "official_source_derived"
  | "educational_simulation"
  | "professional_review_required";

export type ValidationRuleStatus =
  | "draft"
  | "published"
  | "deprecated"
  | "suspended";

export type ValidationRuleCategory =
  | "SCHEMA"
  | "CANONICAL"
  | "CALCULATION"
  | "VAT_ID"
  | "VIES"
  | "UBL"
  | "CII"
  | "EN16931"
  | "PEPPOL"
  | "COUNTRY_PACK"
  | "VIDA_SIMULATION"
  | "LEGAL_LABEL";

export type ValidationRuleSourceType =
  | "internal_technical_policy"
  | "standard_documentation"
  | "official_eu_source"
  | "official_national_source"
  | "public_reference"
  | "professional_review";

export type ValidationRuleSourceMetadata = {
  sourceName: string;
  sourceType: ValidationRuleSourceType;
  jurisdiction: string;
  notes: string;
};

export type ValidationRuleMetadata = {
  code: string;
  title: string;
  description: string;
  category: ValidationRuleCategory;
  severity: ValidationFindingSeverity;
  fieldPath?: string;
  messageTemplate: string;
  fixSuggestion?: string;
  legalConfidence: LegalConfidence;
  version: string;
  status: ValidationRuleStatus;
  ruleSetCode: string;
  sourceLabels: string[];
  sources: ValidationRuleSourceMetadata[];
};

export type ValidationRuleSetMetadata = {
  code: string;
  name: string;
  description: string;
  version: string;
  status: ValidationRuleStatus;
  legalConfidence: LegalConfidence;
  rules: ValidationRuleMetadata[];
};

export type ValidationFinding = {
  code: string;
  severity: ValidationFindingSeverity;
  category: string;
  fieldPath: string;
  message: string;
  fixSuggestion?: string;
  legalConfidence: LegalConfidence;
  ruleSetCode?: string;
  ruleVersion?: string;
  sourceLabels?: string[];
};

export type InvoiceMoneyTotals = {
  lineExtensionAmount: string;
  taxExclusiveAmount: string;
  taxAmount: string;
  taxInclusiveAmount: string;
  allowanceTotalAmount?: string;
  chargeTotalAmount?: string;
  prepaidAmount?: string;
  payableRoundingAmount?: string;
  payableAmount: string;
};

export type CalculatedInvoiceLine = {
  id: string;
  index: number;
  description: string;
  quantity: string;
  unitCode: string;
  unitPrice: string;
  vatCategory: string;
  vatRate: string;
  netAmount: string;
  taxAmount: string;
};

export type CalculatedTaxSubtotal = {
  vatCategory: string;
  vatRate: string;
  taxableAmount: string;
  taxAmount: string;
};

export type InvoiceCalculationResult = {
  lines: CalculatedInvoiceLine[];
  taxSubtotals: CalculatedTaxSubtotal[];
  totals: InvoiceMoneyTotals;
};

const DECIMAL_STRING_PATTERN = /^-?(?:\d+|\d*\.\d+|\d+\.\d*)$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const MONEY_ROUNDING = Decimal.ROUND_HALF_UP;
export const CORE_VALIDATION_RULE_SET_CODE = "INVOICE_LANTERN_CORE";
export const CORE_VALIDATION_RULE_VERSION = "2026.04.1";

const INTERNAL_TECHNICAL_POLICY_SOURCE: ValidationRuleSourceMetadata = {
  sourceName: "Invoice Lantern internal technical validation policy",
  sourceType: "internal_technical_policy",
  jurisdiction: "platform",
  notes:
    "Internal technical sandbox rules for Invoice Lantern canonical invoice validation. These rules are not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority conclusions."
};

function coreRule(input: {
  code: string;
  title: string;
  description: string;
  category: ValidationRuleCategory;
  severity: ValidationFindingSeverity;
  fieldPath?: string;
  messageTemplate: string;
  fixSuggestion?: string;
  legalConfidence?: LegalConfidence;
}): ValidationRuleMetadata {
  const rule: ValidationRuleMetadata = {
    code: input.code,
    title: input.title,
    description: input.description,
    category: input.category,
    severity: input.severity,
    messageTemplate: input.messageTemplate,
    legalConfidence: input.legalConfidence ?? "technical",
    version: CORE_VALIDATION_RULE_VERSION,
    status: "published",
    ruleSetCode: CORE_VALIDATION_RULE_SET_CODE,
    sourceLabels: [INTERNAL_TECHNICAL_POLICY_SOURCE.sourceName],
    sources: [INTERNAL_TECHNICAL_POLICY_SOURCE]
  };

  if (input.fieldPath) {
    rule.fieldPath = input.fieldPath;
  }

  if (input.fixSuggestion) {
    rule.fixSuggestion = input.fixSuggestion;
  }

  return rule;
}

const CORE_VALIDATION_RULE_METADATA = {
  CANONICAL_SCHEMA_INVALID: coreRule({
    code: "CANONICAL_SCHEMA_INVALID",
    title: "Canonical invoice schema invalid",
    description:
      "The input payload must match the independent Invoice Lantern canonical invoice schema before validation can continue.",
    category: "SCHEMA",
    severity: "blocked",
    fieldPath: "invoice",
    messageTemplate: "{zodIssueMessage}",
    fixSuggestion: "Correct the invoice payload shape and decimal strings."
  }),
  DOCUMENT_NUMBER_REQUIRED: coreRule({
    code: "DOCUMENT_NUMBER_REQUIRED",
    title: "Document number required",
    description:
      "A document number is required for technical invoice validation readiness.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "document.number",
    messageTemplate: "Document number is required for invoice validation readiness.",
    fixSuggestion: "Add the invoice document number before validation or export."
  }),
  CURRENCY_REQUIRED: coreRule({
    code: "CURRENCY_REQUIRED",
    title: "Currency required",
    description:
      "A document currency is required so decimal-safe invoice calculations can be evaluated.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "document.currency",
    messageTemplate: "Document currency is required for invoice calculations.",
    fixSuggestion: "Use a 3-letter ISO-style currency code such as EUR."
  }),
  SELLER_NAME_REQUIRED: coreRule({
    code: "SELLER_NAME_REQUIRED",
    title: "Seller name required",
    description:
      "The canonical invoice model requires a seller name for technical validation.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "seller.name",
    messageTemplate: "Seller name is required in the canonical invoice model.",
    fixSuggestion: "Add the seller legal or trading name."
  }),
  SELLER_COUNTRY_REQUIRED: coreRule({
    code: "SELLER_COUNTRY_REQUIRED",
    title: "Seller country required",
    description:
      "The canonical invoice model requires a seller country code for technical validation.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "seller.country",
    messageTemplate: "Seller country is required in the canonical invoice model.",
    fixSuggestion: "Add the seller country code."
  }),
  BUYER_NAME_REQUIRED: coreRule({
    code: "BUYER_NAME_REQUIRED",
    title: "Buyer name required",
    description:
      "The canonical invoice model requires a buyer name for technical validation.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "buyer.name",
    messageTemplate: "Buyer name is required in the canonical invoice model.",
    fixSuggestion: "Add the buyer legal or trading name."
  }),
  BUYER_COUNTRY_REQUIRED: coreRule({
    code: "BUYER_COUNTRY_REQUIRED",
    title: "Buyer country required",
    description:
      "The canonical invoice model requires a buyer country code for technical validation.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "buyer.country",
    messageTemplate: "Buyer country is required in the canonical invoice model.",
    fixSuggestion: "Add the buyer country code."
  }),
  INVOICE_LINE_REQUIRED: coreRule({
    code: "INVOICE_LINE_REQUIRED",
    title: "Invoice line required",
    description:
      "At least one invoice line is required for technical invoice calculation readiness.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "lines",
    messageTemplate: "At least one invoice line is required.",
    fixSuggestion:
      "Add at least one line with description, quantity, price, and VAT rate."
  }),
  LINE_DESCRIPTION_REQUIRED: coreRule({
    code: "LINE_DESCRIPTION_REQUIRED",
    title: "Line description required",
    description:
      "Each invoice line needs a description in the canonical invoice model.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "lines.{index}.description",
    messageTemplate: "Line {lineLabel} requires a description.",
    fixSuggestion: "Add a short product or service description."
  }),
  LINE_QUANTITY_POSITIVE: coreRule({
    code: "LINE_QUANTITY_POSITIVE",
    title: "Line quantity positive",
    description:
      "Each invoice line quantity must be a positive decimal value for calculation readiness.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "lines.{index}.quantity",
    messageTemplate: "Line {lineLabel} quantity must be greater than zero.",
    fixSuggestion: "Use a positive decimal quantity such as 1 or 2.5."
  }),
  LINE_UNIT_PRICE_NON_NEGATIVE: coreRule({
    code: "LINE_UNIT_PRICE_NON_NEGATIVE",
    title: "Line unit price non-negative",
    description:
      "Each invoice line unit price must be zero or greater for calculation readiness.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "lines.{index}.unitPrice",
    messageTemplate: "Line {lineLabel} unit price must be zero or greater.",
    fixSuggestion: "Use a non-negative decimal unit price."
  }),
  LINE_NET_AMOUNT_MISMATCH: coreRule({
    code: "LINE_NET_AMOUNT_MISMATCH",
    title: "Line net amount mismatch",
    description:
      "A supplied line net amount should match quantity multiplied by unit price using decimal-safe calculation.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "lines.{index}.netAmount",
    messageTemplate:
      "Line {lineLabel} net amount does not match quantity multiplied by unit price."
  }),
  LINE_TAX_AMOUNT_MISMATCH: coreRule({
    code: "LINE_TAX_AMOUNT_MISMATCH",
    title: "Line tax amount mismatch",
    description:
      "A supplied line tax amount should match the calculated VAT amount using the line VAT rate.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "lines.{index}.taxAmount",
    messageTemplate:
      "Line {lineLabel} tax amount does not match the calculated VAT amount."
  }),
  TAX_AMOUNT_MISMATCH: coreRule({
    code: "TAX_AMOUNT_MISMATCH",
    title: "Tax amount mismatch",
    description:
      "A supplied invoice tax amount should match the sum of calculated line VAT amounts.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "totals.taxAmount",
    messageTemplate:
      "Tax amount does not match the sum of calculated line VAT amounts."
  }),
  PAYABLE_AMOUNT_MISMATCH: coreRule({
    code: "PAYABLE_AMOUNT_MISMATCH",
    title: "Payable amount mismatch",
    description:
      "A supplied payable amount should match the calculated tax-inclusive amount.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "totals.payableAmount",
    messageTemplate:
      "Payable total does not match the calculated tax-inclusive amount."
  }),
  ZERO_VALUE_LINE_WARNING: coreRule({
    code: "ZERO_VALUE_LINE_WARNING",
    title: "Zero value line warning",
    description:
      "Zero-value invoice lines are allowed by the sandbox model but should be reviewed.",
    category: "CALCULATION",
    severity: "warning",
    fieldPath: "lines.{index}",
    messageTemplate:
      "Line {lineLabel} has a zero net amount and should be reviewed.",
    fixSuggestion: "Confirm whether this zero-value line is intentional."
  }),
  CROSS_BORDER_REVIEW_REQUIRED: coreRule({
    code: "CROSS_BORDER_REVIEW_REQUIRED",
    title: "Cross-border review required",
    description:
      "Different seller and buyer country codes are marked for professional review in this sandbox.",
    category: "LEGAL_LABEL",
    severity: "warning",
    fieldPath: "buyer.country",
    messageTemplate:
      "Seller and buyer countries differ. VAT treatment and reporting readiness require professional review.",
    fixSuggestion:
      "Review cross-border VAT treatment with a qualified professional before operational use.",
    legalConfidence: "professional_review_required"
  }),
  BUYER_VAT_ID_REQUIRED_FOR_CROSS_BORDER_SIMULATION: coreRule({
    code: "BUYER_VAT_ID_REQUIRED_FOR_CROSS_BORDER_SIMULATION",
    title: "Buyer VAT ID required for cross-border simulation",
    description:
      "The sandbox requires a buyer VAT ID for cross-border B2B simulation readiness checks.",
    category: "VAT_ID",
    severity: "fatal",
    fieldPath: "buyer.vatId",
    messageTemplate:
      "Buyer VAT ID is required for this cross-border B2B simulation.",
    fixSuggestion:
      "Add the buyer VAT ID or route this invoice for professional review.",
    legalConfidence: "educational_simulation"
  })
} satisfies Record<string, ValidationRuleMetadata>;

export function getCoreValidationRuleMetadata(code: string) {
  return (CORE_VALIDATION_RULE_METADATA as Record<
    string,
    ValidationRuleMetadata | undefined
  >)[code];
}

export function listCoreValidationRuleCatalog(): ValidationRuleSetMetadata[] {
  return [
    {
      code: CORE_VALIDATION_RULE_SET_CODE,
      name: "Invoice Lantern Core Technical Rules",
      description:
        "Internal technical validation rules for the Invoice Lantern canonical invoice sandbox. They are not official validation and are not legal, tax, or accounting advice.",
      version: CORE_VALIDATION_RULE_VERSION,
      status: "published",
      legalConfidence: "technical",
      rules: Object.values(CORE_VALIDATION_RULE_METADATA)
    }
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTextInput(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return value;
}

function normalizeDecimalInput(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim().replace(",", ".");
  }

  return value;
}

function normalizeOptionalDecimalInput(value: unknown) {
  const normalized = normalizeDecimalInput(value);

  if (normalized === null || normalized === undefined) {
    return undefined;
  }

  if (typeof normalized === "string" && normalized.trim() === "") {
    return undefined;
  }

  return normalized;
}

export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && DECIMAL_STRING_PATTERN.test(value.trim());
}

const textSchema = (maxLength: number) =>
  z.preprocess(normalizeTextInput, z.string().trim().max(maxLength));

const optionalTextSchema = (maxLength: number) =>
  textSchema(maxLength).optional().default("");

const decimalStringSchema = z.preprocess(
  normalizeDecimalInput,
  z
    .string()
    .trim()
    .max(64)
    .refine(
      (value) => value === "" || isDecimalString(value),
      "Value must be blank or a decimal string"
    )
);

const optionalDecimalStringSchema = z.preprocess(
  normalizeOptionalDecimalInput,
  z
    .string()
    .trim()
    .max(64)
    .refine(isDecimalString, "Value must be a decimal string")
    .optional()
);

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(3)
  .refine(
    (value) => value === "" || CURRENCY_PATTERN.test(value),
    "Currency must be blank or a 3-letter ISO-style code"
  );

const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(2)
  .refine(
    (value) => value === "" || COUNTRY_PATTERN.test(value),
    "Country must be blank or a 2-letter ISO-style code"
  );

const partySchema = z.object({
  name: textSchema(160),
  country: countrySchema,
  vatId: optionalTextSchema(32).transform((value) => value.toUpperCase()),
  city: optionalTextSchema(120),
  postalCode: optionalTextSchema(32),
  street: optionalTextSchema(180),
  region: optionalTextSchema(120),
  electronicAddress: optionalTextSchema(160)
});

const documentSchema = z.preprocess(
  (value) => {
    if (!isRecord(value)) {
      return value;
    }

    return {
      ...value,
      type: value.type ?? value.invoiceType ?? "invoice"
    };
  },
  z.object({
    type: z.enum(["invoice", "credit_note"]).default("invoice"),
    number: textSchema(80),
    currency: currencySchema,
    issueDate: optionalTextSchema(32),
    dueDate: optionalTextSchema(32),
    profile: optionalTextSchema(40),
    buyerReference: optionalTextSchema(120),
    contractReference: optionalTextSchema(120)
  })
);

const invoiceLineSchema = z.object({
  id: optionalTextSchema(80),
  description: textSchema(280),
  quantity: decimalStringSchema,
  unitCode: optionalTextSchema(12).transform((value) => value.toUpperCase()),
  unitPrice: decimalStringSchema,
  vatCategory: optionalTextSchema(12).transform((value) => value.toUpperCase()),
  vatRate: decimalStringSchema,
  netAmount: optionalDecimalStringSchema,
  taxAmount: optionalDecimalStringSchema
});

const invoiceTotalsSchema = z
  .object({
    lineExtensionAmount: optionalDecimalStringSchema,
    taxExclusiveAmount: optionalDecimalStringSchema,
    taxAmount: optionalDecimalStringSchema,
    taxInclusiveAmount: optionalDecimalStringSchema,
    allowanceTotalAmount: optionalDecimalStringSchema,
    chargeTotalAmount: optionalDecimalStringSchema,
    prepaidAmount: optionalDecimalStringSchema,
    payableRoundingAmount: optionalDecimalStringSchema,
    payableAmount: optionalDecimalStringSchema
  })
  .optional()
  .default({});

const invoiceTaxSubtotalSchema = z.object({
  taxableAmount: optionalDecimalStringSchema,
  taxAmount: optionalDecimalStringSchema,
  vatCategory: optionalTextSchema(12).transform((value) => value.toUpperCase()),
  vatRate: decimalStringSchema
});

export const canonicalInvoiceSchema = z.object({
  document: documentSchema,
  seller: partySchema,
  buyer: partySchema,
  lines: z.array(invoiceLineSchema).max(200),
  taxSubtotals: z.array(invoiceTaxSubtotalSchema).max(100).optional().default([]),
  totals: invoiceTotalsSchema
});

export type CanonicalInvoice = z.infer<typeof canonicalInvoiceSchema>;

export type CanonicalInvoiceValidationResult =
  | {
      success: true;
      invoice: CanonicalInvoice;
      findings: ValidationFinding[];
    }
  | {
      success: false;
      error: z.ZodError;
      findings: ValidationFinding[];
    };

function decimalOrZero(value: string | undefined) {
  if (!value || !isDecimalString(value)) {
    return new Decimal(0);
  }

  return new Decimal(value);
}

function toMoney(value: Decimal) {
  return value.toDecimalPlaces(2, MONEY_ROUNDING).toFixed(2);
}

function toComparableMoney(value: string | undefined) {
  return toMoney(decimalOrZero(value));
}

function toRateKey(value: string) {
  return decimalOrZero(value).toDecimalPlaces(6, MONEY_ROUNDING).toString();
}

function amountsMatch(first: string, second: string) {
  return decimalOrZero(first).minus(decimalOrZero(second)).abs().lte("0.01");
}

function makeFinding(input: ValidationFinding): ValidationFinding {
  const metadata = getCoreValidationRuleMetadata(input.code);

  if (!metadata) {
    return input;
  }

  const finding: ValidationFinding = {
    ...input,
    category: metadata.category,
    legalConfidence: metadata.legalConfidence,
    ruleSetCode: metadata.ruleSetCode,
    ruleVersion: metadata.version,
    sourceLabels: [...metadata.sourceLabels]
  };

  if (!finding.fixSuggestion && metadata.fixSuggestion) {
    finding.fixSuggestion = metadata.fixSuggestion;
  }

  return finding;
}

function getLineLabel(line: CanonicalInvoice["lines"][number], index: number) {
  return line.id || String(index + 1);
}

function hasRequiredText(value: string) {
  return value.trim().length > 0;
}

export function calculateInvoiceTotals(
  invoice: CanonicalInvoice
): InvoiceCalculationResult {
  const calculatedLines = invoice.lines.map((line, index) => {
    const quantity = decimalOrZero(line.quantity);
    const unitPrice = decimalOrZero(line.unitPrice);
    const netAmount = toMoney(quantity.mul(unitPrice));
    const taxAmount = toMoney(
      decimalOrZero(netAmount).mul(decimalOrZero(line.vatRate)).div(100)
    );

    return {
      id: getLineLabel(line, index),
      index,
      description: line.description,
      quantity: line.quantity,
      unitCode: line.unitCode,
      unitPrice: line.unitPrice,
      vatCategory: line.vatCategory,
      vatRate: line.vatRate,
      netAmount,
      taxAmount
    };
  });

  const lineExtensionAmount = calculatedLines.reduce(
    (sum, line) => sum.plus(line.netAmount),
    new Decimal(0)
  );

  const taxAmount = calculatedLines.reduce(
    (sum, line) => sum.plus(line.taxAmount),
    new Decimal(0)
  );

  const taxInclusiveAmount = lineExtensionAmount.plus(taxAmount);

  const taxSubtotalMap = new Map<
    string,
    {
      vatCategory: string;
      vatRate: string;
      taxableAmount: Decimal;
      taxAmount: Decimal;
    }
  >();

  for (const line of calculatedLines) {
    const key = `${line.vatCategory || "UNSPECIFIED"}::${toRateKey(line.vatRate)}`;
    const existing = taxSubtotalMap.get(key);

    if (existing) {
      existing.taxableAmount = existing.taxableAmount.plus(line.netAmount);
      existing.taxAmount = existing.taxAmount.plus(line.taxAmount);
      continue;
    }

    taxSubtotalMap.set(key, {
      vatCategory: line.vatCategory,
      vatRate: line.vatRate,
      taxableAmount: decimalOrZero(line.netAmount),
      taxAmount: decimalOrZero(line.taxAmount)
    });
  }

  return {
    lines: calculatedLines,
    taxSubtotals: [...taxSubtotalMap.values()].map((subtotal) => ({
      vatCategory: subtotal.vatCategory,
      vatRate: subtotal.vatRate,
      taxableAmount: toMoney(subtotal.taxableAmount),
      taxAmount: toMoney(subtotal.taxAmount)
    })),
    totals: {
      lineExtensionAmount: toMoney(lineExtensionAmount),
      taxExclusiveAmount: toMoney(lineExtensionAmount),
      taxAmount: toMoney(taxAmount),
      taxInclusiveAmount: toMoney(taxInclusiveAmount),
      payableAmount: toMoney(taxInclusiveAmount)
    }
  };
}

export function buildCoreValidationFindings(
  invoice: CanonicalInvoice
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const calculations = calculateInvoiceTotals(invoice);

  if (!hasRequiredText(invoice.document.number)) {
    findings.push(
      makeFinding({
        code: "DOCUMENT_NUMBER_REQUIRED",
        severity: "fatal",
        category: "CANONICAL",
        fieldPath: "document.number",
        message: "Document number is required for invoice validation readiness.",
        fixSuggestion: "Add the invoice document number before validation or export.",
        legalConfidence: "technical"
      })
    );
  }

  if (!hasRequiredText(invoice.document.currency)) {
    findings.push(
      makeFinding({
        code: "CURRENCY_REQUIRED",
        severity: "fatal",
        category: "CANONICAL",
        fieldPath: "document.currency",
        message: "Document currency is required for invoice calculations.",
        fixSuggestion: "Use a 3-letter ISO-style currency code such as EUR.",
        legalConfidence: "technical"
      })
    );
  }

  if (!hasRequiredText(invoice.seller.name)) {
    findings.push(
      makeFinding({
        code: "SELLER_NAME_REQUIRED",
        severity: "fatal",
        category: "CANONICAL",
        fieldPath: "seller.name",
        message: "Seller name is required in the canonical invoice model.",
        fixSuggestion: "Add the seller legal or trading name.",
        legalConfidence: "technical"
      })
    );
  }

  if (!hasRequiredText(invoice.seller.country)) {
    findings.push(
      makeFinding({
        code: "SELLER_COUNTRY_REQUIRED",
        severity: "fatal",
        category: "CANONICAL",
        fieldPath: "seller.country",
        message: "Seller country is required in the canonical invoice model.",
        fixSuggestion: "Add the seller country code.",
        legalConfidence: "technical"
      })
    );
  }

  if (!hasRequiredText(invoice.buyer.name)) {
    findings.push(
      makeFinding({
        code: "BUYER_NAME_REQUIRED",
        severity: "fatal",
        category: "CANONICAL",
        fieldPath: "buyer.name",
        message: "Buyer name is required in the canonical invoice model.",
        fixSuggestion: "Add the buyer legal or trading name.",
        legalConfidence: "technical"
      })
    );
  }

  if (!hasRequiredText(invoice.buyer.country)) {
    findings.push(
      makeFinding({
        code: "BUYER_COUNTRY_REQUIRED",
        severity: "fatal",
        category: "CANONICAL",
        fieldPath: "buyer.country",
        message: "Buyer country is required in the canonical invoice model.",
        fixSuggestion: "Add the buyer country code.",
        legalConfidence: "technical"
      })
    );
  }

  if (invoice.lines.length === 0) {
    findings.push(
      makeFinding({
        code: "INVOICE_LINE_REQUIRED",
        severity: "fatal",
        category: "CANONICAL",
        fieldPath: "lines",
        message: "At least one invoice line is required.",
        fixSuggestion: "Add at least one line with description, quantity, price, and VAT rate.",
        legalConfidence: "technical"
      })
    );
  }

  invoice.lines.forEach((line, index) => {
    const lineLabel = getLineLabel(line, index);
    const fieldPrefix = `lines.${index}`;
    const calculatedLine = calculations.lines[index];

    if (!hasRequiredText(line.description)) {
      findings.push(
        makeFinding({
          code: "LINE_DESCRIPTION_REQUIRED",
          severity: "fatal",
          category: "CANONICAL",
          fieldPath: `${fieldPrefix}.description`,
          message: `Line ${lineLabel} requires a description.`,
          fixSuggestion: "Add a short product or service description.",
          legalConfidence: "technical"
        })
      );
    }

    if (!isDecimalString(line.quantity) || decimalOrZero(line.quantity).lte(0)) {
      findings.push(
        makeFinding({
          code: "LINE_QUANTITY_POSITIVE",
          severity: "fatal",
          category: "CALCULATION",
          fieldPath: `${fieldPrefix}.quantity`,
          message: `Line ${lineLabel} quantity must be greater than zero.`,
          fixSuggestion: "Use a positive decimal quantity such as 1 or 2.5.",
          legalConfidence: "technical"
        })
      );
    }

    if (!isDecimalString(line.unitPrice) || decimalOrZero(line.unitPrice).lt(0)) {
      findings.push(
        makeFinding({
          code: "LINE_UNIT_PRICE_NON_NEGATIVE",
          severity: "fatal",
          category: "CALCULATION",
          fieldPath: `${fieldPrefix}.unitPrice`,
          message: `Line ${lineLabel} unit price must be zero or greater.`,
          fixSuggestion: "Use a non-negative decimal unit price.",
          legalConfidence: "technical"
        })
      );
    }

    if (calculatedLine && decimalOrZero(calculatedLine.netAmount).eq(0)) {
      findings.push(
        makeFinding({
          code: "ZERO_VALUE_LINE_WARNING",
          severity: "warning",
          category: "CALCULATION",
          fieldPath: fieldPrefix,
          message: `Line ${lineLabel} has a zero net amount and should be reviewed.`,
          fixSuggestion: "Confirm whether this zero-value line is intentional.",
          legalConfidence: "technical"
        })
      );
    }

    if (
      calculatedLine &&
      line.netAmount !== undefined &&
      !amountsMatch(toComparableMoney(line.netAmount), calculatedLine.netAmount)
    ) {
      findings.push(
        makeFinding({
          code: "LINE_NET_AMOUNT_MISMATCH",
          severity: "fatal",
          category: "CALCULATION",
          fieldPath: `${fieldPrefix}.netAmount`,
          message: `Line ${lineLabel} net amount does not match quantity multiplied by unit price.`,
          fixSuggestion: `Use ${calculatedLine.netAmount} as the calculated line net amount or review the line inputs.`,
          legalConfidence: "technical"
        })
      );
    }

    if (
      calculatedLine &&
      line.taxAmount !== undefined &&
      !amountsMatch(toComparableMoney(line.taxAmount), calculatedLine.taxAmount)
    ) {
      findings.push(
        makeFinding({
          code: "LINE_TAX_AMOUNT_MISMATCH",
          severity: "fatal",
          category: "CALCULATION",
          fieldPath: `${fieldPrefix}.taxAmount`,
          message: `Line ${lineLabel} tax amount does not match the calculated VAT amount.`,
          fixSuggestion: `Use ${calculatedLine.taxAmount} as the calculated line tax amount or review the VAT rate.`,
          legalConfidence: "technical"
        })
      );
    }
  });

  if (
    invoice.totals.taxAmount !== undefined &&
    !amountsMatch(toComparableMoney(invoice.totals.taxAmount), calculations.totals.taxAmount)
  ) {
    findings.push(
      makeFinding({
        code: "TAX_AMOUNT_MISMATCH",
        severity: "fatal",
        category: "CALCULATION",
        fieldPath: "totals.taxAmount",
        message: "Tax amount does not match the sum of calculated line VAT amounts.",
        fixSuggestion: `Use ${calculations.totals.taxAmount} as the calculated tax amount or review line VAT rates.`,
        legalConfidence: "technical"
      })
    );
  }

  if (
    invoice.totals.payableAmount !== undefined &&
    !amountsMatch(
      toComparableMoney(invoice.totals.payableAmount),
      calculations.totals.payableAmount
    )
  ) {
    findings.push(
      makeFinding({
        code: "PAYABLE_AMOUNT_MISMATCH",
        severity: "fatal",
        category: "CALCULATION",
        fieldPath: "totals.payableAmount",
        message: "Payable total does not match the calculated tax-inclusive amount.",
        fixSuggestion: `Use ${calculations.totals.payableAmount} as the payable amount or review totals.`,
        legalConfidence: "technical"
      })
    );
  }

  const hasCrossBorderCountries =
    hasRequiredText(invoice.seller.country) &&
    hasRequiredText(invoice.buyer.country) &&
    invoice.seller.country !== invoice.buyer.country;

  if (hasCrossBorderCountries && !hasRequiredText(invoice.buyer.vatId)) {
    findings.push(
      makeFinding({
        code: "BUYER_VAT_ID_REQUIRED_FOR_CROSS_BORDER_SIMULATION",
        severity: "fatal",
        category: "VAT_ID",
        fieldPath: "buyer.vatId",
        message: "Buyer VAT ID is required for this cross-border B2B simulation.",
        fixSuggestion:
          "Add the buyer VAT ID or route this invoice for professional review.",
        legalConfidence: "educational_simulation"
      })
    );
  }

  if (hasCrossBorderCountries) {
    findings.push(
      makeFinding({
        code: "CROSS_BORDER_REVIEW_REQUIRED",
        severity: "warning",
        category: "LEGAL_LABEL",
        fieldPath: "buyer.country",
        message:
          "Seller and buyer countries differ. VAT treatment and reporting readiness require professional review.",
        fixSuggestion:
          "Review cross-border VAT treatment with a qualified professional before operational use.",
        legalConfidence: "professional_review_required"
      })
    );
  }

  return findings;
}

export function validateCanonicalInvoice(
  input: unknown
): CanonicalInvoiceValidationResult {
  const parsed = canonicalInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error,
      findings: parsed.error.issues.map((issue) =>
        makeFinding({
          code: "CANONICAL_SCHEMA_INVALID",
          severity: "blocked",
          category: "SCHEMA",
          fieldPath: issue.path.join(".") || "invoice",
          message: issue.message,
          fixSuggestion: "Correct the invoice payload shape and decimal strings.",
          legalConfidence: "technical"
        })
      )
    };
  }

  return {
    success: true,
    invoice: parsed.data,
    findings: buildCoreValidationFindings(parsed.data)
  };
}
