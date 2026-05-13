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
  taxTotalAmount: string;
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
  discountAmount: string;
  chargeAmount: string;
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

export type CalculatedTaxBreakdown = {
  taxCategory: string;
  taxScheme: string;
  vatRate: string;
  taxableAmount: string;
  taxAmount: string;
  exemptionReason?: string;
  exemptionReasonCode?: string;
};

export type InvoiceCalculationResult = {
  lines: CalculatedInvoiceLine[];
  taxSubtotals: CalculatedTaxSubtotal[];
  taxBreakdown: CalculatedTaxBreakdown[];
  totals: InvoiceMoneyTotals;
};

const DECIMAL_STRING_PATTERN = /^-?(?:\d+|\d*\.\d+|\d+\.\d*)$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_ROUNDING = Decimal.ROUND_HALF_UP;

export const CORE_VALIDATION_RULE_SET_CODE = "INVOICE_LANTERN_CORE";
export const CORE_VALIDATION_RULE_VERSION = "2026.05.1";

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
  DOCUMENT_ISSUE_DATE_REQUIRED: coreRule({
    code: "DOCUMENT_ISSUE_DATE_REQUIRED",
    title: "Document issue date required",
    description:
      "An issue date is required for invoice lifecycle, calculation, and downstream XML/export readiness review.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "document.issueDate",
    messageTemplate:
      "Document issue date is required for invoice lifecycle readiness.",
    fixSuggestion: "Add the invoice issue date in YYYY-MM-DD format."
  }),
  DUE_DATE_BEFORE_ISSUE_DATE: coreRule({
    code: "DUE_DATE_BEFORE_ISSUE_DATE",
    title: "Due date before issue date",
    description:
      "A due date earlier than the issue date is marked for review in the technical sandbox.",
    category: "CANONICAL",
    severity: "warning",
    fieldPath: "document.dueDate",
    messageTemplate:
      "Document due date is earlier than the issue date and should be reviewed.",
    fixSuggestion:
      "Confirm the due date or adjust it so it is not earlier than the issue date."
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
  LINE_UNIT_CODE_REQUIRED: coreRule({
    code: "LINE_UNIT_CODE_REQUIRED",
    title: "Line unit code required",
    description:
      "Each invoice line needs a unit code so quantities can be interpreted consistently by later export and validation steps.",
    category: "CANONICAL",
    severity: "fatal",
    fieldPath: "lines.{index}.unitCode",
    messageTemplate: "Line {lineLabel} requires a unit code.",
    fixSuggestion: "Add a unit code such as EA, HUR, KGM, or another reviewed unit code."
  }),
  LINE_VAT_CATEGORY_RECOMMENDED: coreRule({
    code: "LINE_VAT_CATEGORY_RECOMMENDED",
    title: "Line VAT category recommended",
    description:
      "A VAT category code is recommended for each line so tax grouping and XML readiness can be reviewed.",
    category: "VAT_ID",
    severity: "warning",
    fieldPath: "lines.{index}.vatCategory",
    messageTemplate:
      "Line {lineLabel} has no VAT category code and should be reviewed.",
    fixSuggestion:
      "Add a VAT category code such as S, Z, E, AE, K, G, O, or another reviewed category value."
  }),
  LINE_VAT_RATE_REQUIRED: coreRule({
    code: "LINE_VAT_RATE_REQUIRED",
    title: "Line VAT rate required",
    description:
      "Each invoice line needs a VAT rate decimal value for technical tax calculation readiness.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "lines.{index}.vatRate",
    messageTemplate: "Line {lineLabel} requires a VAT rate.",
    fixSuggestion: "Add a VAT rate decimal value such as 0, 5, 19, or 27."
  }),
  LINE_VAT_RATE_NON_NEGATIVE: coreRule({
    code: "LINE_VAT_RATE_NON_NEGATIVE",
    title: "Line VAT rate non-negative",
    description:
      "Each invoice line VAT rate must be zero or greater for calculation readiness.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "lines.{index}.vatRate",
    messageTemplate: "Line {lineLabel} VAT rate must be zero or greater.",
    fixSuggestion: "Use a non-negative VAT rate decimal value."
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
  LINE_EXTENSION_AMOUNT_MISMATCH: coreRule({
    code: "LINE_EXTENSION_AMOUNT_MISMATCH",
    title: "Line extension amount mismatch",
    description:
      "A supplied line extension total should match the sum of calculated line net amounts.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "totals.lineExtensionAmount",
    messageTemplate:
      "Line extension amount does not match the sum of calculated line net amounts."
  }),
  TAX_EXCLUSIVE_AMOUNT_MISMATCH: coreRule({
    code: "TAX_EXCLUSIVE_AMOUNT_MISMATCH",
    title: "Tax exclusive amount mismatch",
    description:
      "A supplied tax-exclusive total should match the calculated net total after document-level allowances and charges.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "totals.taxExclusiveAmount",
    messageTemplate:
      "Tax exclusive amount does not match the calculated net total after allowances and charges."
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
  TAX_INCLUSIVE_AMOUNT_MISMATCH: coreRule({
    code: "TAX_INCLUSIVE_AMOUNT_MISMATCH",
    title: "Tax inclusive amount mismatch",
    description:
      "A supplied tax-inclusive total should match calculated tax-exclusive amount plus tax amount.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "totals.taxInclusiveAmount",
    messageTemplate:
      "Tax inclusive amount does not match calculated tax-exclusive amount plus tax amount."
  }),
  PAYABLE_AMOUNT_MISMATCH: coreRule({
    code: "PAYABLE_AMOUNT_MISMATCH",
    title: "Payable amount mismatch",
    description:
      "A supplied payable amount should match the calculated tax-inclusive amount after prepaid amount and rounding adjustment.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "totals.payableAmount",
    messageTemplate:
      "Payable total does not match the calculated payable amount."
  }),
  TAX_SUBTOTAL_UNMATCHED: coreRule({
    code: "TAX_SUBTOTAL_UNMATCHED",
    title: "Tax subtotal unmatched",
    description:
      "A supplied tax subtotal should match a calculated VAT category and rate group from invoice lines.",
    category: "CALCULATION",
    severity: "warning",
    fieldPath: "taxBreakdown.{index}",
    messageTemplate:
      "Tax subtotal {lineLabel} does not match any calculated line VAT category and rate group.",
    fixSuggestion:
      "Review the subtotal VAT category and VAT rate against the invoice lines."
  }),
  TAX_SUBTOTAL_TAXABLE_AMOUNT_MISMATCH: coreRule({
    code: "TAX_SUBTOTAL_TAXABLE_AMOUNT_MISMATCH",
    title: "Tax subtotal taxable amount mismatch",
    description:
      "A supplied tax subtotal taxable amount should match the calculated taxable amount for its VAT category and rate.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "taxBreakdown.{index}.taxableAmount",
    messageTemplate:
      "Tax subtotal {lineLabel} taxable amount does not match calculated line totals."
  }),
  TAX_SUBTOTAL_TAX_AMOUNT_MISMATCH: coreRule({
    code: "TAX_SUBTOTAL_TAX_AMOUNT_MISMATCH",
    title: "Tax subtotal tax amount mismatch",
    description:
      "A supplied tax subtotal tax amount should match the calculated tax amount for its VAT category and rate.",
    category: "CALCULATION",
    severity: "fatal",
    fieldPath: "taxBreakdown.{index}.taxAmount",
    messageTemplate:
      "Tax subtotal {lineLabel} tax amount does not match calculated line tax totals."
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

function isBoundedDecimalString(value: string) {
  if (!isDecimalString(value)) {
    return false;
  }

  try {
    return new Decimal(value).abs().lte("999999999999999.999999");
  } catch {
    return false;
  }
}

function isDateOnlyString(value: string) {
  const trimmedValue = value.trim();

  if (!DATE_ONLY_PATTERN.test(trimmedValue)) {
    return false;
  }

  const [rawYear, rawMonth, rawDay] = trimmedValue.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
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
      (value) => value === "" || isBoundedDecimalString(value),
      "Value must be blank or a bounded decimal string"
    )
);

const optionalDecimalStringSchema = z.preprocess(
  normalizeOptionalDecimalInput,
  z
    .string()
    .trim()
    .max(64)
    .refine(isBoundedDecimalString, "Value must be a bounded decimal string")
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

const dateOnlyTextSchema = textSchema(32).refine(
  (value) => value === "" || isDateOnlyString(value),
  "Date must be blank or a valid ISO date string in YYYY-MM-DD format"
);

const profileSchema = z.enum(["EN16931", "PEPPOL_BIS_3", "COUNTRY_PACK"]);

export const CANONICAL_INVOICE_LEGAL_DISCLAIMER =
  "Invoice Lantern stores canonical invoice data as an independent technical validation and readiness sandbox record. Results are informational only and are not legal, tax, accounting, financial, professional, official filing, authority acceptance, Peppol certification, EN 16931 certification, or compliance advice.";

function normalizeOptionalStringAlias(
  primary: unknown,
  fallback: unknown,
  defaultValue = ""
) {
  if (typeof primary === "string" && primary.trim().length > 0) {
    return primary;
  }

  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback;
  }

  return primary ?? fallback ?? defaultValue;
}

function normalizePartyInput(value: unknown) {
  if (!isRecord(value)) {
    return value;
  }

  const address = isRecord(value.address) ? value.address : {};
  const country = normalizeOptionalStringAlias(value.country, address.country);
  const street = normalizeOptionalStringAlias(value.street, address.street);
  const additionalStreet = normalizeOptionalStringAlias(
    value.additionalStreet,
    address.additionalStreet
  );
  const city = normalizeOptionalStringAlias(value.city, address.city);
  const postalCode = normalizeOptionalStringAlias(
    value.postalCode,
    address.postalCode
  );
  const region = normalizeOptionalStringAlias(value.region, address.region);

  return {
    ...value,
    country,
    street,
    additionalStreet,
    city,
    postalCode,
    region,
    address: {
      ...address,
      street,
      additionalStreet,
      city,
      postalCode,
      region,
      country: normalizeOptionalStringAlias(address.country, country)
    }
  };
}

function normalizeDocumentInput(value: unknown) {
  if (!isRecord(value)) {
    return value;
  }

  const { invoiceType, ...document } = value;

  return {
    ...document,
    type: document.type ?? invoiceType ?? "invoice"
  };
}

function normalizeProfileInput(value: unknown) {
  if (value === "EN16931" || value === "PEPPOL_BIS_3" || value === "COUNTRY_PACK") {
    return value;
  }

  if (typeof value !== "string") {
    return "EN16931";
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("peppol")) {
    return "PEPPOL_BIS_3";
  }

  if (normalized.includes("en16931") || normalized.includes("en 16931")) {
    return "EN16931";
  }

  if (normalized.includes("country_pack")) {
    return "COUNTRY_PACK";
  }

  return "EN16931";
}

function normalizeTaxBreakdownInput(value: unknown) {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    taxCategory: value.taxCategory ?? value.vatCategory ?? "",
    vatCategory: value.vatCategory ?? value.taxCategory ?? ""
  };
}

function normalizeCanonicalInvoiceInput(value: unknown) {
  if (!isRecord(value)) {
    return value;
  }

  const document = isRecord(value.document) ? value.document : {};
  const totals = isRecord(value.totals) ? value.totals : {};
  const profile = normalizeProfileInput(value.profile ?? document.profile);
  const taxBreakdown = value.taxBreakdown ?? value.taxSubtotals ?? [];
  const taxSubtotals = value.taxSubtotals ?? taxBreakdown;
  const taxTotalAmount = totals.taxTotalAmount ?? totals.taxAmount;
  const taxAmount = totals.taxAmount ?? totals.taxTotalAmount;
  const normalizedDocument = normalizeDocumentInput(document);

  return {
    ...value,
    profile,
    document: {
      ...(isRecord(normalizedDocument) ? normalizedDocument : {}),
      profile
    },
    seller: normalizePartyInput(value.seller),
    buyer: normalizePartyInput(value.buyer),
    totals: {
      ...totals,
      taxAmount,
      taxTotalAmount
    },
    taxBreakdown,
    taxSubtotals
  };
}

const addressSchema = z
  .object({
    street: optionalTextSchema(180),
    additionalStreet: optionalTextSchema(180),
    city: optionalTextSchema(120),
    postalCode: optionalTextSchema(32),
    region: optionalTextSchema(120),
    country: countrySchema
  })
  .strict();

const partySchema = z
  .preprocess(
    normalizePartyInput,
    z
      .object({
        name: textSchema(160),
        legalName: optionalTextSchema(240),
        country: countrySchema,
        vatId: optionalTextSchema(32).transform((value) => value.toUpperCase()),
        taxRegistrationNumber: optionalTextSchema(120),
        electronicAddress: optionalTextSchema(160),
        electronicAddressScheme: optionalTextSchema(40),
        email: optionalTextSchema(320),
        phone: optionalTextSchema(80),
        address: addressSchema,
        city: optionalTextSchema(120),
        postalCode: optionalTextSchema(32),
        street: optionalTextSchema(180),
        additionalStreet: optionalTextSchema(180),
        region: optionalTextSchema(120)
      })
      .strict()
  );

const documentSchema = z.preprocess(
  normalizeDocumentInput,
  z
    .object({
      type: z.enum(["invoice", "credit_note"]).default("invoice"),
      number: textSchema(80),
      issueDate: dateOnlyTextSchema,
      dueDate: dateOnlyTextSchema.optional().default(""),
      taxPointDate: dateOnlyTextSchema.optional().default(""),
      currency: currencySchema,
      profile: profileSchema.optional().default("EN16931"),
      buyerReference: optionalTextSchema(120),
      contractReference: optionalTextSchema(120),
      orderReference: optionalTextSchema(120),
      projectReference: optionalTextSchema(120),
      accountingCost: optionalTextSchema(120)
    })
    .strict()
);

const invoiceLineSchema = z
  .object({
    id: optionalTextSchema(80),
    description: textSchema(1000),
    itemName: optionalTextSchema(240),
    quantity: decimalStringSchema,
    unitCode: optionalTextSchema(24).transform((value) => value.toUpperCase()),
    unitPrice: decimalStringSchema,
    discountAmount: optionalDecimalStringSchema,
    chargeAmount: optionalDecimalStringSchema,
    netAmount: optionalDecimalStringSchema,
    taxAmount: optionalDecimalStringSchema,
    vatCategory: optionalTextSchema(40).transform((value) => value.toUpperCase()),
    vatRate: decimalStringSchema,
    accountingCost: optionalTextSchema(120),
    orderLineReference: optionalTextSchema(120)
  })
  .strict();

const invoiceTotalsSchema = z
  .object({
    lineExtensionAmount: optionalDecimalStringSchema,
    allowanceTotalAmount: optionalDecimalStringSchema,
    chargeTotalAmount: optionalDecimalStringSchema,
    taxExclusiveAmount: optionalDecimalStringSchema,
    taxAmount: optionalDecimalStringSchema,
    taxTotalAmount: optionalDecimalStringSchema,
    taxInclusiveAmount: optionalDecimalStringSchema,
    prepaidAmount: optionalDecimalStringSchema,
    payableRoundingAmount: optionalDecimalStringSchema,
    payableAmount: optionalDecimalStringSchema
  })
  .strict()
  .optional()
  .default({});

const invoiceAdjustmentSchema = z
  .object({
    id: optionalTextSchema(80),
    scope: z.enum(["document", "line"]),
    lineId: optionalTextSchema(80),
    reason: optionalTextSchema(500),
    reasonCode: optionalTextSchema(80),
    amount: decimalStringSchema,
    baseAmount: optionalDecimalStringSchema,
    percentage: optionalDecimalStringSchema,
    taxCategory: optionalTextSchema(40).transform((value) => value.toUpperCase()),
    vatRate: optionalDecimalStringSchema
  })
  .strict();

const invoiceTaxBreakdownSchema = z.preprocess(
  normalizeTaxBreakdownInput,
  z
    .object({
      taxCategory: optionalTextSchema(40).transform((value) =>
        value.toUpperCase()
      ),
      taxScheme: optionalTextSchema(40).transform((value) =>
        value ? value.toUpperCase() : "VAT"
      ),
      vatCategory: optionalTextSchema(40).transform((value) =>
        value.toUpperCase()
      ),
      vatRate: decimalStringSchema,
      taxableAmount: optionalDecimalStringSchema,
      taxAmount: optionalDecimalStringSchema,
      exemptionReason: optionalTextSchema(500),
      exemptionReasonCode: optionalTextSchema(80)
    })
    .strict()
);

const deliverySchema = z
  .object({
    deliveryDate: dateOnlyTextSchema.optional().default(""),
    locationId: optionalTextSchema(120),
    country: countrySchema.optional().default(""),
    address: addressSchema.optional()
  })
  .strict()
  .optional();

const paymentSchema = z
  .object({
    paymentMeansCode: optionalTextSchema(40),
    paymentReference: optionalTextSchema(120),
    terms: optionalTextSchema(2000),
    dueDate: dateOnlyTextSchema.optional().default(""),
    accountLabel: optionalTextSchema(120),
    accountLast4: optionalTextSchema(4)
  })
  .strict()
  .optional();

const canonicalMetadataSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .default({});

const legalSchema = z
  .object({
    legalConfidence: z
      .enum([
        "technical",
        "standard_based",
        "official_source_derived",
        "educational_simulation",
        "professional_review_required"
      ])
      .default("technical"),
    disclaimer: textSchema(2000).default(CANONICAL_INVOICE_LEGAL_DISCLAIMER)
  })
  .strict()
  .optional()
  .default({
    legalConfidence: "technical",
    disclaimer: CANONICAL_INVOICE_LEGAL_DISCLAIMER
  });

export const canonicalInvoiceSchema = z
  .preprocess(
    normalizeCanonicalInvoiceInput,
    z
      .object({
        profile: profileSchema.default("EN16931"),
        document: documentSchema,
        seller: partySchema,
        buyer: partySchema,
        delivery: deliverySchema,
        payment: paymentSchema,
        lines: z.array(invoiceLineSchema).max(500),
        allowances: z.array(invoiceAdjustmentSchema).max(500).optional().default([]),
        charges: z.array(invoiceAdjustmentSchema).max(500).optional().default([]),
        taxBreakdown: z
          .array(invoiceTaxBreakdownSchema)
          .max(500)
          .optional()
          .default([]),
        taxSubtotals: z
          .array(invoiceTaxBreakdownSchema)
          .max(500)
          .optional()
          .default([]),
        totals: invoiceTotalsSchema,
        metadata: canonicalMetadataSchema,
        legal: legalSchema
      })
      .strict()
  )
  .transform((invoice) => {
    const taxBreakdown =
      invoice.taxBreakdown.length > 0 ? invoice.taxBreakdown : invoice.taxSubtotals;
    const taxSubtotals =
      invoice.taxSubtotals.length > 0 ? invoice.taxSubtotals : taxBreakdown;
    const taxTotalAmount = invoice.totals.taxTotalAmount ?? invoice.totals.taxAmount;
    const taxAmount = invoice.totals.taxAmount ?? invoice.totals.taxTotalAmount;

    return {
      ...invoice,
      document: {
        ...invoice.document,
        profile: invoice.profile
      },
      taxBreakdown,
      taxSubtotals,
      totals: {
        ...invoice.totals,
        taxAmount,
        taxTotalAmount
      }
    };
  });

export type CanonicalInvoice = z.infer<typeof canonicalInvoiceSchema>;
export type CanonicalInvoiceInput = z.input<typeof canonicalInvoiceSchema>;

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

function getTaxCategory(input: { taxCategory?: string; vatCategory?: string }) {
  return input.taxCategory || input.vatCategory || "UNSPECIFIED";
}

function toTaxGroupKey(input: {
  taxCategory?: string;
  vatCategory?: string;
  vatRate: string;
}) {
  return `${getTaxCategory(input)}::${toRateKey(input.vatRate)}`;
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

function parseDateOnly(value: string) {
  const trimmedValue = value.trim();

  if (!DATE_ONLY_PATTERN.test(trimmedValue)) {
    return null;
  }

  const [rawYear, rawMonth, rawDay] = trimmedValue.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function findCalculatedTaxSubtotal(
  calculatedSubtotals: readonly CalculatedTaxBreakdown[],
  subtotal: CanonicalInvoice["taxSubtotals"][number]
) {
  const key = toTaxGroupKey({
    taxCategory: subtotal.taxCategory,
    vatCategory: subtotal.vatCategory,
    vatRate: subtotal.vatRate
  });

  return (
    calculatedSubtotals.find(
      (calculatedSubtotal) =>
        toTaxGroupKey({
          taxCategory: calculatedSubtotal.taxCategory,
          vatRate: calculatedSubtotal.vatRate
        }) === key
    ) ?? null
  );
}

export function calculateInvoiceTotals(
  invoice: CanonicalInvoice
): InvoiceCalculationResult {
  const calculatedLines = invoice.lines.map((line, index) => {
    const quantity = decimalOrZero(line.quantity);
    const unitPrice = decimalOrZero(line.unitPrice);
    const discountAmount = decimalOrZero(line.discountAmount);
    const chargeAmount = decimalOrZero(line.chargeAmount);
    const netAmount = toMoney(
      quantity.mul(unitPrice).minus(discountAmount).plus(chargeAmount)
    );
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
      discountAmount: toMoney(discountAmount),
      chargeAmount: toMoney(chargeAmount),
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

  const documentAllowances = invoice.allowances.filter(
    (allowance) => allowance.scope === "document"
  );
  const documentCharges = invoice.charges.filter(
    (charge) => charge.scope === "document"
  );
  const allowanceTotalAmount =
    documentAllowances.length > 0
      ? documentAllowances.reduce(
          (sum, allowance) => sum.plus(decimalOrZero(allowance.amount)),
          new Decimal(0)
        )
      : decimalOrZero(invoice.totals.allowanceTotalAmount);
  const chargeTotalAmount =
    documentCharges.length > 0
      ? documentCharges.reduce(
          (sum, charge) => sum.plus(decimalOrZero(charge.amount)),
          new Decimal(0)
        )
      : decimalOrZero(invoice.totals.chargeTotalAmount);
  const prepaidAmount = decimalOrZero(invoice.totals.prepaidAmount);
  const payableRoundingAmount = decimalOrZero(
    invoice.totals.payableRoundingAmount
  );

  const taxExclusiveAmount = lineExtensionAmount
    .minus(allowanceTotalAmount)
    .plus(chargeTotalAmount);

  const taxSubtotalMap = new Map<
    string,
    {
      taxCategory: string;
      taxScheme: string;
      vatRate: string;
      taxableAmount: Decimal;
      exemptionReason?: string;
      exemptionReasonCode?: string;
    }
  >();

  for (const line of calculatedLines) {
    const key = toTaxGroupKey(line);
    const existing = taxSubtotalMap.get(key);

    if (existing) {
      existing.taxableAmount = existing.taxableAmount.plus(line.netAmount);
      continue;
    }

    taxSubtotalMap.set(key, {
      taxCategory: line.vatCategory,
      taxScheme: "VAT",
      vatRate: line.vatRate,
      taxableAmount: decimalOrZero(line.netAmount)
    });
  }

  for (const allowance of documentAllowances) {
    if (!allowance.taxCategory || !allowance.vatRate) {
      continue;
    }

    const key = toTaxGroupKey({
      taxCategory: allowance.taxCategory,
      vatRate: allowance.vatRate
    });
    const existing = taxSubtotalMap.get(key);

    if (existing) {
      existing.taxableAmount = existing.taxableAmount.minus(
        decimalOrZero(allowance.amount)
      );
      continue;
    }

    taxSubtotalMap.set(key, {
      taxCategory: allowance.taxCategory,
      taxScheme: "VAT",
      vatRate: allowance.vatRate,
      taxableAmount: decimalOrZero(allowance.amount).negated()
    });
  }

  for (const charge of documentCharges) {
    if (!charge.taxCategory || !charge.vatRate) {
      continue;
    }

    const key = toTaxGroupKey({
      taxCategory: charge.taxCategory,
      vatRate: charge.vatRate
    });
    const existing = taxSubtotalMap.get(key);

    if (existing) {
      existing.taxableAmount = existing.taxableAmount.plus(
        decimalOrZero(charge.amount)
      );
      continue;
    }

    taxSubtotalMap.set(key, {
      taxCategory: charge.taxCategory,
      taxScheme: "VAT",
      vatRate: charge.vatRate,
      taxableAmount: decimalOrZero(charge.amount)
    });
  }

  const taxBreakdown = [...taxSubtotalMap.values()].map((subtotal) => {
    const taxableAmount = toMoney(subtotal.taxableAmount);
    const taxAmount = toMoney(
      decimalOrZero(taxableAmount).mul(decimalOrZero(subtotal.vatRate)).div(100)
    );
    const breakdown: CalculatedTaxBreakdown = {
      taxCategory: subtotal.taxCategory,
      taxScheme: subtotal.taxScheme,
      vatRate: subtotal.vatRate,
      taxableAmount,
      taxAmount
    };

    if (subtotal.exemptionReason) {
      breakdown.exemptionReason = subtotal.exemptionReason;
    }

    if (subtotal.exemptionReasonCode) {
      breakdown.exemptionReasonCode = subtotal.exemptionReasonCode;
    }

    return breakdown;
  });

  const taxAmount = taxBreakdown.reduce(
    (sum, subtotal) => sum.plus(subtotal.taxAmount),
    new Decimal(0)
  );

  const taxInclusiveAmount = taxExclusiveAmount.plus(taxAmount);
  const payableAmount = taxInclusiveAmount
    .minus(prepaidAmount)
    .plus(payableRoundingAmount);

  const totals: InvoiceMoneyTotals = {
    lineExtensionAmount: toMoney(lineExtensionAmount),
    taxExclusiveAmount: toMoney(taxExclusiveAmount),
    taxAmount: toMoney(taxAmount),
    taxTotalAmount: toMoney(taxAmount),
    taxInclusiveAmount: toMoney(taxInclusiveAmount),
    payableAmount: toMoney(payableAmount)
  };

  if (invoice.totals.allowanceTotalAmount !== undefined) {
    totals.allowanceTotalAmount = toMoney(allowanceTotalAmount);
  }

  if (invoice.totals.chargeTotalAmount !== undefined) {
    totals.chargeTotalAmount = toMoney(chargeTotalAmount);
  }

  if (invoice.totals.prepaidAmount !== undefined) {
    totals.prepaidAmount = toMoney(prepaidAmount);
  }

  if (invoice.totals.payableRoundingAmount !== undefined) {
    totals.payableRoundingAmount = toMoney(payableRoundingAmount);
  }

  return {
    lines: calculatedLines,
    taxSubtotals: taxBreakdown.map((subtotal) => ({
      vatCategory: subtotal.taxCategory,
      vatRate: subtotal.vatRate,
      taxableAmount: subtotal.taxableAmount,
      taxAmount: subtotal.taxAmount
    })),
    taxBreakdown,
    totals
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

  if (!hasRequiredText(invoice.document.issueDate)) {
    findings.push(
      makeFinding({
        code: "DOCUMENT_ISSUE_DATE_REQUIRED",
        severity: "fatal",
        category: "CANONICAL",
        fieldPath: "document.issueDate",
        message:
          "Document issue date is required for invoice lifecycle readiness.",
        fixSuggestion: "Add the invoice issue date in YYYY-MM-DD format.",
        legalConfidence: "technical"
      })
    );
  }

  const issueDateTime = parseDateOnly(invoice.document.issueDate);
  const dueDateTime = parseDateOnly(invoice.document.dueDate);

  if (
    issueDateTime !== null &&
    dueDateTime !== null &&
    dueDateTime < issueDateTime
  ) {
    findings.push(
      makeFinding({
        code: "DUE_DATE_BEFORE_ISSUE_DATE",
        severity: "warning",
        category: "CANONICAL",
        fieldPath: "document.dueDate",
        message:
          "Document due date is earlier than the issue date and should be reviewed.",
        fixSuggestion:
          "Confirm the due date or adjust it so it is not earlier than the issue date.",
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
        fieldPath: "seller.address.country",
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
        fieldPath: "buyer.address.country",
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

    if (!hasRequiredText(line.unitCode)) {
      findings.push(
        makeFinding({
          code: "LINE_UNIT_CODE_REQUIRED",
          severity: "fatal",
          category: "CANONICAL",
          fieldPath: `${fieldPrefix}.unitCode`,
          message: `Line ${lineLabel} requires a unit code.`,
          fixSuggestion:
            "Add a unit code such as EA, HUR, KGM, or another reviewed unit code.",
          legalConfidence: "technical"
        })
      );
    }

    if (!hasRequiredText(line.vatCategory)) {
      findings.push(
        makeFinding({
          code: "LINE_VAT_CATEGORY_RECOMMENDED",
          severity: "warning",
          category: "VAT_ID",
          fieldPath: `${fieldPrefix}.vatCategory`,
          message: `Line ${lineLabel} has no VAT category code and should be reviewed.`,
          fixSuggestion:
            "Add a VAT category code such as S, Z, E, AE, K, G, O, or another reviewed category value.",
          legalConfidence: "technical"
        })
      );
    }

    if (!isDecimalString(line.vatRate)) {
      findings.push(
        makeFinding({
          code: "LINE_VAT_RATE_REQUIRED",
          severity: "fatal",
          category: "CALCULATION",
          fieldPath: `${fieldPrefix}.vatRate`,
          message: `Line ${lineLabel} requires a VAT rate.`,
          fixSuggestion: "Add a VAT rate decimal value such as 0, 5, 19, or 27.",
          legalConfidence: "technical"
        })
      );
    } else if (decimalOrZero(line.vatRate).lt(0)) {
      findings.push(
        makeFinding({
          code: "LINE_VAT_RATE_NON_NEGATIVE",
          severity: "fatal",
          category: "CALCULATION",
          fieldPath: `${fieldPrefix}.vatRate`,
          message: `Line ${lineLabel} VAT rate must be zero or greater.`,
          fixSuggestion: "Use a non-negative VAT rate decimal value.",
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
    invoice.totals.lineExtensionAmount !== undefined &&
    !amountsMatch(
      toComparableMoney(invoice.totals.lineExtensionAmount),
      calculations.totals.lineExtensionAmount
    )
  ) {
    findings.push(
      makeFinding({
        code: "LINE_EXTENSION_AMOUNT_MISMATCH",
        severity: "fatal",
        category: "CALCULATION",
        fieldPath: "totals.lineExtensionAmount",
        message:
          "Line extension amount does not match the sum of calculated line net amounts.",
        fixSuggestion: `Use ${calculations.totals.lineExtensionAmount} as the calculated line extension amount or review line values.`,
        legalConfidence: "technical"
      })
    );
  }

  if (
    invoice.totals.taxExclusiveAmount !== undefined &&
    !amountsMatch(
      toComparableMoney(invoice.totals.taxExclusiveAmount),
      calculations.totals.taxExclusiveAmount
    )
  ) {
    findings.push(
      makeFinding({
        code: "TAX_EXCLUSIVE_AMOUNT_MISMATCH",
        severity: "fatal",
        category: "CALCULATION",
        fieldPath: "totals.taxExclusiveAmount",
        message:
          "Tax exclusive amount does not match the calculated net total after allowances and charges.",
        fixSuggestion: `Use ${calculations.totals.taxExclusiveAmount} as the calculated tax-exclusive amount or review allowances and charges.`,
        legalConfidence: "technical"
      })
    );
  }

  if (
    (invoice.totals.taxTotalAmount ?? invoice.totals.taxAmount) !== undefined &&
    !amountsMatch(
      toComparableMoney(invoice.totals.taxTotalAmount ?? invoice.totals.taxAmount),
      calculations.totals.taxAmount
    )
  ) {
    findings.push(
      makeFinding({
        code: "TAX_AMOUNT_MISMATCH",
        severity: "fatal",
        category: "CALCULATION",
        fieldPath: "totals.taxTotalAmount",
        message: "Tax amount does not match the sum of calculated line VAT amounts.",
        fixSuggestion: `Use ${calculations.totals.taxAmount} as the calculated tax amount or review line VAT rates.`,
        legalConfidence: "technical"
      })
    );
  }

  if (
    invoice.totals.taxInclusiveAmount !== undefined &&
    !amountsMatch(
      toComparableMoney(invoice.totals.taxInclusiveAmount),
      calculations.totals.taxInclusiveAmount
    )
  ) {
    findings.push(
      makeFinding({
        code: "TAX_INCLUSIVE_AMOUNT_MISMATCH",
        severity: "fatal",
        category: "CALCULATION",
        fieldPath: "totals.taxInclusiveAmount",
        message:
          "Tax inclusive amount does not match calculated tax-exclusive amount plus tax amount.",
        fixSuggestion: `Use ${calculations.totals.taxInclusiveAmount} as the calculated tax-inclusive amount or review totals.`,
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
        message: "Payable total does not match the calculated payable amount.",
        fixSuggestion: `Use ${calculations.totals.payableAmount} as the payable amount or review totals, prepaid amount, and rounding.`,
        legalConfidence: "technical"
      })
    );
  }

  invoice.taxBreakdown.forEach((subtotal, index) => {
    const subtotalLabel =
      subtotal.taxCategory || subtotal.vatCategory || subtotal.vatRate
        ? `${subtotal.taxCategory || subtotal.vatCategory || "UNSPECIFIED"} ${
            subtotal.vatRate || "0"
          }%`
        : String(index + 1);
    const calculatedSubtotal = findCalculatedTaxSubtotal(
      calculations.taxBreakdown,
      subtotal
    );
    const fieldPrefix = `taxBreakdown.${index}`;

    if (!calculatedSubtotal) {
      findings.push(
        makeFinding({
          code: "TAX_SUBTOTAL_UNMATCHED",
          severity: "warning",
          category: "CALCULATION",
          fieldPath: fieldPrefix,
          message: `Tax subtotal ${subtotalLabel} does not match any calculated line VAT category and rate group.`,
          fixSuggestion:
            "Review the subtotal VAT category and VAT rate against the invoice lines.",
          legalConfidence: "technical"
        })
      );
      return;
    }

    if (
      subtotal.taxableAmount !== undefined &&
      !amountsMatch(
        toComparableMoney(subtotal.taxableAmount),
        calculatedSubtotal.taxableAmount
      )
    ) {
      findings.push(
        makeFinding({
          code: "TAX_SUBTOTAL_TAXABLE_AMOUNT_MISMATCH",
          severity: "fatal",
          category: "CALCULATION",
          fieldPath: `${fieldPrefix}.taxableAmount`,
          message: `Tax subtotal ${subtotalLabel} taxable amount does not match calculated line totals.`,
          fixSuggestion: `Use ${calculatedSubtotal.taxableAmount} as the calculated taxable amount for this VAT group or review line values.`,
          legalConfidence: "technical"
        })
      );
    }

    if (
      subtotal.taxAmount !== undefined &&
      !amountsMatch(
        toComparableMoney(subtotal.taxAmount),
        calculatedSubtotal.taxAmount
      )
    ) {
      findings.push(
        makeFinding({
          code: "TAX_SUBTOTAL_TAX_AMOUNT_MISMATCH",
          severity: "fatal",
          category: "CALCULATION",
          fieldPath: `${fieldPrefix}.taxAmount`,
          message: `Tax subtotal ${subtotalLabel} tax amount does not match calculated line tax totals.`,
          fixSuggestion: `Use ${calculatedSubtotal.taxAmount} as the calculated tax amount for this VAT group or review line VAT rates.`,
          legalConfidence: "technical"
        })
      );
    }
  });

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
