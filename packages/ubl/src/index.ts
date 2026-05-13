import { create } from "xmlbuilder2";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  buildCoreValidationFindings,
  calculateInvoiceTotals,
  canonicalInvoiceSchema,
  type CalculatedInvoiceLine,
  type CalculatedTaxBreakdown,
  type CalculatedTaxSubtotal,
  type CanonicalInvoice,
  type LegalConfidence,
  type ValidationFinding,
  type ValidationFindingSeverity
} from "@invoice-lantern/invoice-core";

export * from "./xsd-validation-adapter.js";
export * from "./xsd-artifact-registry.js";
export * from "./xsd-error-mapper.js";
export * from "./schematron-finding-contract.js";
export * from "./schematron-execution-adapter.js";
export * from "./schematron-execution-policy.js";
export * from "./schematron-engine-candidate.js";
export * from "./schematron-artifact-source-register.js";
export * from "./schematron-artifact-manifest.js";
export * from "./schematron-artifact-review-intake.js";
export * from "./schematron-artifact-manifest-update-plan.js";
export * from "./schematron-local-execution-prototype.js";
export * from "./schematron-result-mapper.js";
export * from "./schematron-xpath-engine.js";
export * from "./schematron-artifact-executor.js";
export * from "./schematron-internal-assertion-fixtures.js";
export * from "./schematron-peppol-bis-execution.js";
export * from "./schematron-en16931-execution.js";
export * from "./schematron-execution-orchestrator.js";

const UBL_INVOICE_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
const UBL_CREDIT_NOTE_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2";
const UBL_CAC_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
const UBL_CBC_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
const UBL_XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";
const UBL_EXPORT_CUSTOMIZATION_ID =
  "urn:invoice-lantern:technical-ubl-2.1-export:1";
const UBL_EXPORT_PROFILE_ID =
  "Invoice Lantern technical UBL 2.1 export";
const DEFAULT_MAX_XML_DEPTH = 150;
const UNSUPPORTED_FIELD_SAMPLE_LIMIT = 5;

type UblDocumentType = "invoice" | "credit_note" | "unknown";

type XmlBuilder = {
  ele: (
    name: string,
    attributes?: Record<string, string> | undefined
  ) => XmlBuilder;
  txt: (content: string) => XmlBuilder;
  up: () => XmlBuilder;
  com: (content: string) => XmlBuilder;
  end: (options?: { prettyPrint?: boolean }) => string;
};

export type UblParseResult = {
  ok: boolean;
  invoice?: CanonicalInvoice;
  findings: ValidationFinding[];
  detected: {
    documentType?: UblDocumentType;
    rootName?: string;
    profileId?: string;
    customizationId?: string;
    invoiceNumber?: string;
    issueDate?: string;
    dueDate?: string;
    taxPointDate?: string;
    currency?: string;
    sellerName?: string;
    sellerCountry?: string;
    buyerName?: string;
    buyerCountry?: string;
    lineCount?: number;
    unsupportedFieldCount?: number;
  };
};

export type XmlSafetyIssueCode =
  | "XML_BODY_TOO_LARGE"
  | "XML_DOCTYPE_BLOCKED"
  | "XML_ENTITY_BLOCKED"
  | "XML_EXTERNAL_IDENTIFIER_BLOCKED"
  | "XML_STYLESHEET_BLOCKED"
  | "XML_NESTING_TOO_DEEP";

export type XmlSafetyInspection = {
  safe: boolean;
  message: string;
  byteLength: number;
  code?: XmlSafetyIssueCode;
  maxBytes?: number;
  maxDepth?: number;
};

type UblParseOptions = {
  maxBytes?: number;
  maxDepth?: number;
};

type UblLineInput = {
  id: string;
  description: string;
  itemName?: string;
  quantity: string;
  unitCode: string;
  unitPrice: string;
  vatCategory: string;
  vatRate: string;
  accountingCost?: string;
  orderLineReference?: string;
  discountAmount?: string;
  chargeAmount?: string;
  netAmount?: string;
  taxAmount?: string;
};

type UblPartyInput = {
  name: string;
  legalName: string;
  country: string;
  vatId: string;
  taxRegistrationNumber: string;
  city: string;
  postalCode: string;
  street: string;
  additionalStreet: string;
  region: string;
  electronicAddress: string;
  electronicAddressScheme: string;
  email: string;
  phone: string;
};

type UblAdjustmentInput = {
  id?: string;
  scope: "document" | "line";
  lineId?: string;
  reason: string;
  reasonCode: string;
  amount: string;
  baseAmount?: string;
  percentage?: string;
  taxCategory: string;
  vatRate?: string;
};

type UnsupportedUblFieldMetadata = {
  field: string;
  count: number;
  sampleIds?: string[];
  note: string;
};

type UblAdjustmentForXml = {
  id?: string | undefined;
  scope?: "document" | "line" | undefined;
  lineId?: string | undefined;
  reason?: string | undefined;
  reasonCode?: string | undefined;
  amount: string;
  baseAmount?: string | undefined;
  percentage?: string | undefined;
  taxCategory?: string | undefined;
  vatRate?: string | undefined;
};

const ublParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  alwaysCreateTextNode: true
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function getApproximateXmlDepth(xml: string) {
  const tagPattern = /<\s*(\/?)([A-Za-z_][\w:.-]*)(?:\s[^<>]*)?>/g;
  let depth = 0;
  let maxDepth = 0;

  for (const match of xml.matchAll(tagPattern)) {
    const fullTag = match[0] ?? "";
    const isClosingTag = match[1] === "/";
    const isSelfClosingTag = /\/\s*>$/.test(fullTag);

    if (fullTag.startsWith("<?") || fullTag.startsWith("<!")) {
      continue;
    }

    if (isClosingTag) {
      depth = Math.max(depth - 1, 0);
      continue;
    }

    depth += 1;
    maxDepth = Math.max(maxDepth, depth);

    if (isSelfClosingTag) {
      depth = Math.max(depth - 1, 0);
    }
  }

  return maxDepth;
}

export function inspectXmlSafety(
  xml: string,
  options: UblParseOptions = {}
): XmlSafetyInspection {
  const byteLength = getUtf8ByteLength(xml);
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_XML_DEPTH;

  if (options.maxBytes !== undefined && byteLength > options.maxBytes) {
    return {
      safe: false,
      code: "XML_BODY_TOO_LARGE",
      message: "XML body is too large for this parsing endpoint.",
      byteLength,
      maxBytes: options.maxBytes
    };
  }

  if (/<!DOCTYPE/i.test(xml)) {
    return {
      safe: false,
      code: "XML_DOCTYPE_BLOCKED",
      message:
        "XML contains a DOCTYPE declaration. DOCTYPE is blocked to reduce DTD and XXE risk.",
      byteLength
    };
  }

  if (/<!ENTITY/i.test(xml)) {
    return {
      safe: false,
      code: "XML_ENTITY_BLOCKED",
      message:
        "XML contains an ENTITY declaration. XML entities are blocked to reduce XXE and expansion risk.",
      byteLength
    };
  }

  if (/\bSYSTEM\b/i.test(xml) || /\bPUBLIC\b/i.test(xml)) {
    return {
      safe: false,
      code: "XML_EXTERNAL_IDENTIFIER_BLOCKED",
      message:
        "XML contains SYSTEM or PUBLIC external identifier text. External identifiers are blocked for upload safety.",
      byteLength
    };
  }

  if (/<\?xml-stylesheet/i.test(xml)) {
    return {
      safe: false,
      code: "XML_STYLESHEET_BLOCKED",
      message:
        "XML stylesheet processing instructions are blocked for upload safety.",
      byteLength
    };
  }

  if (getApproximateXmlDepth(xml) > maxDepth) {
    return {
      safe: false,
      code: "XML_NESTING_TOO_DEEP",
      message:
        "XML nesting is too deep for this parsing endpoint. Excessive nesting is blocked for upload safety.",
      byteLength,
      maxDepth
    };
  }

  return {
    safe: true,
    message: "",
    byteLength
  };
}

export function assertSafeXmlForParsing(
  xml: string,
  options: UblParseOptions = {}
) {
  const inspection = inspectXmlSafety(xml, options);

  if (!inspection.safe) {
    throw new Error(inspection.message);
  }
}

function makeUblFinding(input: {
  code: string;
  severity: ValidationFindingSeverity;
  fieldPath: string;
  message: string;
  fixSuggestion?: string;
  legalConfidence?: LegalConfidence;
  category?: string;
}): ValidationFinding {
  const finding: ValidationFinding = {
    code: input.code,
    severity: input.severity,
    category: input.category ?? "UBL",
    fieldPath: input.fieldPath,
    message: input.message,
    legalConfidence: input.legalConfidence ?? "technical"
  };

  if (input.fixSuggestion) {
    finding.fixSuggestion = input.fixSuggestion;
  }

  return finding;
}

function detectRootName(xml: string) {
  const rootMatch = xml.match(/<\s*([A-Za-z_][\w:.-]*)(?:\s|>|\/>)/);
  const rawRootName = rootMatch?.[1]?.trim() ?? "unknown";

  return rawRootName.includes(":")
    ? rawRootName.split(":").pop() ?? rawRootName
    : rawRootName;
}

function detectDocumentTypeFromRoot(rootName: string) {
  const normalized = rootName.toLowerCase();

  if (normalized === "invoice" || normalized.endsWith(":invoice")) {
    return "invoice" as const;
  }

  if (normalized === "creditnote" || normalized.endsWith(":creditnote")) {
    return "credit_note" as const;
  }

  return "unknown" as const;
}

function nodeToText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = nodeToText(item);

      if (text) {
        return text;
      }
    }

    return "";
  }

  if (isPlainObject(value)) {
    const textNode = value["#text"];

    if (typeof textNode === "string" && textNode.trim().length > 0) {
      return textNode.trim();
    }

    if (typeof textNode === "number" || typeof textNode === "boolean") {
      return String(textNode);
    }
  }

  return "";
}

function getFirstChildNode(parent: unknown, tagName: string) {
  if (!isPlainObject(parent)) {
    return undefined;
  }

  return asArray(parent[tagName])[0];
}

function getChildNodes(parent: unknown, tagName: string) {
  if (!isPlainObject(parent)) {
    return [];
  }

  return asArray(parent[tagName]);
}

function getFirstChildText(parent: unknown, tagName: string, _maxLength = 240) {
  const text = nodeToText(getFirstChildNode(parent, tagName));

  return text || "";
}

function collectDescendantNodes(
  node: unknown,
  tagName: string,
  maxResults = 200,
  results: unknown[] = []
): unknown[] {
  if (results.length >= maxResults) {
    return results;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectDescendantNodes(item, tagName, maxResults, results);

      if (results.length >= maxResults) {
        break;
      }
    }

    return results;
  }

  if (!isPlainObject(node)) {
    return results;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === tagName) {
      for (const item of asArray(value)) {
        if (results.length >= maxResults) {
          break;
        }

        results.push(item);
      }
    }

    if (!key.startsWith("@_") && key !== "#text") {
      collectDescendantNodes(value, tagName, maxResults, results);
    }

    if (results.length >= maxResults) {
      break;
    }
  }

  return results;
}

function getFirstDescendantText(parent: unknown, tagName: string) {
  const firstNode = collectDescendantNodes(parent, tagName, 1)[0];
  const text = nodeToText(firstNode);

  return text || "";
}

function getAttributeValue(node: unknown, attributeName: string) {
  if (!isPlainObject(node)) {
    return "";
  }

  const value = node[`@_${attributeName}`] ?? node[attributeName];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function getRootNode(parsedXml: unknown, rootName: string) {
  if (!isPlainObject(parsedXml)) {
    return undefined;
  }

  const directRoot = parsedXml[rootName];

  if (directRoot !== undefined) {
    return Array.isArray(directRoot) ? directRoot[0] : directRoot;
  }

  const firstDocumentEntry = Object.entries(parsedXml).find(([key]) => {
    return !key.startsWith("?") && !key.startsWith("@_");
  });

  const value = firstDocumentEntry?.[1];

  return Array.isArray(value) ? value[0] : value;
}

function normalizeText(value: string, maxLength = 240) {
  return value.trim().slice(0, maxLength);
}

function normalizeCode(value: string, maxLength = 40) {
  return normalizeText(value, maxLength).toUpperCase();
}

function normalizeDecimal(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");

  if (!normalized) {
    return "";
  }

  return /^-?(?:\d+|\d*\.\d+|\d+\.\d*)$/.test(normalized) ? normalized : "";
}

function decimalFromNode(node: unknown) {
  return normalizeDecimal(nodeToText(node));
}

function addOptionalText(
  target: Record<string, unknown>,
  key: string,
  value: string
) {
  const text = normalizeText(value);

  if (text) {
    target[key] = text;
  }
}

function addOptionalDecimal(
  target: Record<string, unknown>,
  key: string,
  value: string
) {
  const decimal = normalizeDecimal(value);

  if (decimal) {
    target[key] = decimal;
  }
}

function parseDecimalForSum(value: string, scale: number) {
  const decimal = normalizeDecimal(value);

  if (!decimal) {
    return 0n;
  }

  const negative = decimal.startsWith("-");
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [integerPart = "0", fractionalPart = ""] = unsigned.split(".");
  const paddedFraction = fractionalPart.padEnd(scale, "0").slice(0, scale);
  const combined = `${integerPart || "0"}${paddedFraction}`.replace(
    /^0+(?=\d)/,
    ""
  );
  const amount = BigInt(combined || "0");

  return negative ? -amount : amount;
}

function formatScaledDecimal(value: bigint, scale: number) {
  const negative = value < 0n;
  const unsignedText = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const integerPart = unsignedText.slice(0, -scale) || "0";
  const fractionalPart = unsignedText.slice(-scale);

  return `${negative ? "-" : ""}${integerPart}.${fractionalPart}`;
}

function sumDecimalStrings(values: string[], minimumScale = 2) {
  const decimals = values.map((value) => normalizeDecimal(value)).filter(Boolean);

  if (decimals.length === 0) {
    return "";
  }

  const scale = Math.max(
    minimumScale,
    ...decimals.map((value) => value.split(".")[1]?.length ?? 0)
  );
  const total = decimals.reduce(
    (sum, value) => sum + parseDecimalForSum(value, scale),
    0n
  );

  return formatScaledDecimal(total, scale);
}

function isNonZeroDecimal(value: string | undefined) {
  const decimal = normalizeDecimal(value ?? "");

  if (!decimal) {
    return false;
  }

  return parseDecimalForSum(decimal, Math.max(decimal.split(".")[1]?.length ?? 0, 2)) !== 0n;
}

function extractPartyName(partyNode: unknown) {
  const partyNameBlock = collectDescendantNodes(partyNode, "PartyName", 1)[0];

  if (partyNameBlock) {
    const name = getFirstDescendantText(partyNameBlock, "Name");

    if (name) {
      return normalizeText(name, 160);
    }
  }

  const legalEntityBlock = collectDescendantNodes(
    partyNode,
    "PartyLegalEntity",
    1
  )[0];

  if (legalEntityBlock) {
    const registrationName = getFirstDescendantText(
      legalEntityBlock,
      "RegistrationName"
    );

    if (registrationName) {
      return normalizeText(registrationName, 160);
    }
  }

  return normalizeText(getFirstDescendantText(partyNode, "Name"), 160);
}

function extractPartyLegalName(partyNode: unknown) {
  const legalEntityBlock = collectDescendantNodes(
    partyNode,
    "PartyLegalEntity",
    1
  )[0];
  const registrationName = getFirstDescendantText(
    legalEntityBlock,
    "RegistrationName"
  );

  return normalizeText(registrationName, 240);
}

function looksLikeVatIdentifier(value: string) {
  return /^[A-Z]{2}[A-Z0-9.+*-]{2,}$/i.test(value.trim());
}

function extractPartyVatId(partyNode: unknown) {
  const partyTaxSchemeBlocks = collectDescendantNodes(
    partyNode,
    "PartyTaxScheme",
    8
  );
  let firstCompanyId = "";

  for (const taxSchemeBlock of partyTaxSchemeBlocks) {
    const companyId = normalizeText(
      getFirstChildText(taxSchemeBlock, "CompanyID", 80),
      32
    ).toUpperCase();

    if (!companyId) {
      continue;
    }

    if (!firstCompanyId) {
      firstCompanyId = companyId;
    }

    const taxSchemeNode = collectDescendantNodes(taxSchemeBlock, "TaxScheme", 1)[0];
    const taxSchemeId = normalizeCode(
      getFirstChildText(taxSchemeNode, "ID", 40),
      40
    );

    if (taxSchemeId === "VAT") {
      return companyId;
    }
  }

  if (firstCompanyId) {
    return firstCompanyId;
  }

  const partyIdentificationBlocks = collectDescendantNodes(
    partyNode,
    "PartyIdentification",
    8
  );

  for (const identificationBlock of partyIdentificationBlocks) {
    const idNode = getFirstChildNode(identificationBlock, "ID");
    const schemeId = normalizeCode(getAttributeValue(idNode, "schemeID"), 40);
    const value = normalizeText(nodeToText(idNode), 32).toUpperCase();

    if (
      value &&
      (schemeId === "VAT" || schemeId === "VA" || looksLikeVatIdentifier(value))
    ) {
      return value;
    }
  }

  return "";
}

function extractPartyTaxRegistrationNumber(partyNode: unknown, vatId: string) {
  const legalEntityBlock = collectDescendantNodes(
    partyNode,
    "PartyLegalEntity",
    1
  )[0];
  const legalCompanyId = normalizeText(
    getFirstChildText(legalEntityBlock, "CompanyID", 120),
    120
  );

  if (legalCompanyId && legalCompanyId.toUpperCase() !== vatId.toUpperCase()) {
    return legalCompanyId;
  }

  const partyIdentificationBlocks = collectDescendantNodes(
    partyNode,
    "PartyIdentification",
    8
  );

  for (const identificationBlock of partyIdentificationBlocks) {
    const idNode = getFirstChildNode(identificationBlock, "ID");
    const schemeId = normalizeCode(getAttributeValue(idNode, "schemeID"), 40);
    const value = normalizeText(nodeToText(idNode), 120);

    if (value && schemeId === "TAX" && value.toUpperCase() !== vatId.toUpperCase()) {
      return value;
    }
  }

  return "";
}

function extractContactText(partyNode: unknown, tagName: "ElectronicMail" | "Telephone") {
  const contactNode = collectDescendantNodes(partyNode, "Contact", 1)[0];

  return normalizeText(getFirstChildText(contactNode, tagName), 320);
}

function extractParty(rootNode: unknown, partyBlockName: string): UblPartyInput {
  const partyBlock = collectDescendantNodes(rootNode, partyBlockName, 1)[0];
  const partyNode = getFirstChildNode(partyBlock, "Party") ?? partyBlock;
  const postalAddressNode = collectDescendantNodes(
    partyNode,
    "PostalAddress",
    1
  )[0];
  const endpointNode = getFirstChildNode(partyNode, "EndpointID");
  const countryNode = collectDescendantNodes(postalAddressNode, "Country", 1)[0];
  const vatId = extractPartyVatId(partyNode);

  return {
    name: extractPartyName(partyNode),
    legalName: extractPartyLegalName(partyNode),
    country: normalizeCode(
      getFirstDescendantText(countryNode, "IdentificationCode"),
      2
    ),
    vatId,
    taxRegistrationNumber: extractPartyTaxRegistrationNumber(partyNode, vatId),
    city: normalizeText(getFirstChildText(postalAddressNode, "CityName"), 120),
    postalCode: normalizeText(
      getFirstChildText(postalAddressNode, "PostalZone"),
      32
    ),
    street: normalizeText(
      getFirstChildText(postalAddressNode, "StreetName") ||
        getFirstChildText(postalAddressNode, "AddressLine"),
      180
    ),
    additionalStreet: normalizeText(
      getFirstChildText(postalAddressNode, "AdditionalStreetName"),
      180
    ),
    region: normalizeText(
      getFirstChildText(postalAddressNode, "CountrySubentity"),
      120
    ),
    electronicAddress: normalizeText(nodeToText(endpointNode), 160),
    electronicAddressScheme: normalizeCode(
      getAttributeValue(endpointNode, "schemeID"),
      40
    ),
    email: extractContactText(partyNode, "ElectronicMail"),
    phone: extractContactText(partyNode, "Telephone")
  };
}

function extractLineDescription(itemNode: unknown) {
  return normalizeText(
    getFirstChildText(itemNode, "Description", 280) ||
      getFirstChildText(itemNode, "Name", 280),
    280
  );
}

function extractLineTaxCategory(itemNode: unknown) {
  return (
    collectDescendantNodes(itemNode, "ClassifiedTaxCategory", 1)[0] ??
    collectDescendantNodes(itemNode, "TaxCategory", 1)[0]
  );
}

function parseChargeIndicator(value: string) {
  const normalized = value.trim().toLowerCase();

  return normalized === "true" || normalized === "1";
}

function extractAllowanceCharge(
  allowanceChargeNode: unknown,
  input: {
    scope: "document" | "line";
    lineId?: string;
  }
): UblAdjustmentInput | null {
  const amount = decimalFromNode(getFirstChildNode(allowanceChargeNode, "Amount"));

  if (!amount) {
    return null;
  }

  const taxCategoryNode =
    getFirstChildNode(allowanceChargeNode, "TaxCategory") ??
    collectDescendantNodes(allowanceChargeNode, "TaxCategory", 1)[0];
  const adjustment: UblAdjustmentInput = {
    scope: input.scope,
    reason: normalizeText(
      getFirstChildText(allowanceChargeNode, "AllowanceChargeReason"),
      500
    ),
    reasonCode: normalizeText(
      getFirstChildText(allowanceChargeNode, "AllowanceChargeReasonCode"),
      80
    ),
    amount,
    taxCategory: normalizeCode(getFirstChildText(taxCategoryNode, "ID"), 40)
  };
  const id = normalizeText(getFirstChildText(allowanceChargeNode, "ID"), 80);
  const baseAmount = decimalFromNode(
    getFirstChildNode(allowanceChargeNode, "BaseAmount")
  );
  const percentage = normalizeDecimal(
    getFirstChildText(allowanceChargeNode, "MultiplierFactorNumeric")
  );
  const vatRate = normalizeDecimal(getFirstChildText(taxCategoryNode, "Percent"));

  if (input.lineId) {
    adjustment.lineId = input.lineId;
  }

  if (id) {
    adjustment.id = id;
  }

  if (baseAmount) {
    adjustment.baseAmount = baseAmount;
  }

  if (percentage) {
    adjustment.percentage = percentage;
  }

  if (vatRate) {
    adjustment.vatRate = vatRate;
  }

  return adjustment;
}

function extractAllowanceCharges(
  parentNode: unknown,
  input: {
    scope: "document" | "line";
    lineId?: string;
  }
) {
  const allowances: UblAdjustmentInput[] = [];
  const charges: UblAdjustmentInput[] = [];

  for (const allowanceChargeNode of getChildNodes(parentNode, "AllowanceCharge")) {
    const adjustment = extractAllowanceCharge(allowanceChargeNode, input);

    if (!adjustment) {
      continue;
    }

    if (
      parseChargeIndicator(
        getFirstChildText(allowanceChargeNode, "ChargeIndicator")
      )
    ) {
      charges.push(adjustment);
      continue;
    }

    allowances.push(adjustment);
  }

  return {
    allowances,
    charges
  };
}

function extractInvoiceLine(
  lineNode: unknown,
  documentType: Exclude<UblDocumentType, "unknown">
) {
  const quantityNode = getFirstChildNode(
    lineNode,
    documentType === "credit_note" ? "CreditedQuantity" : "InvoicedQuantity"
  );
  const itemNode = getFirstChildNode(lineNode, "Item");
  const priceNode = getFirstChildNode(lineNode, "Price");
  const priceAmountNode = getFirstChildNode(priceNode, "PriceAmount");
  const taxCategoryNode = extractLineTaxCategory(itemNode);
  const lineId = normalizeText(getFirstChildText(lineNode, "ID", 80), 80);
  const lineAdjustments = extractAllowanceCharges(lineNode, {
    scope: "line",
    lineId
  });
  const discountAmount = sumDecimalStrings(
    lineAdjustments.allowances.map((adjustment) => adjustment.amount)
  );
  const chargeAmount = sumDecimalStrings(
    lineAdjustments.charges.map((adjustment) => adjustment.amount)
  );

  const line: UblLineInput = {
    id: lineId,
    description: extractLineDescription(itemNode),
    itemName: normalizeText(getFirstChildText(itemNode, "Name"), 240),
    quantity: decimalFromNode(quantityNode),
    unitCode: normalizeCode(getAttributeValue(quantityNode, "unitCode"), 12),
    unitPrice: decimalFromNode(priceAmountNode),
    vatCategory: normalizeCode(getFirstChildText(taxCategoryNode, "ID", 12), 12),
    vatRate: normalizeDecimal(getFirstChildText(taxCategoryNode, "Percent", 64)),
    accountingCost: normalizeText(
      getFirstChildText(lineNode, "AccountingCost"),
      120
    ),
    orderLineReference: normalizeText(
      getFirstDescendantText(
        getFirstChildNode(lineNode, "OrderLineReference"),
        "LineID"
      ),
      120
    )
  };

  if (discountAmount) {
    line.discountAmount = discountAmount;
  }

  if (chargeAmount) {
    line.chargeAmount = chargeAmount;
  }

  const netAmount = decimalFromNode(
    getFirstChildNode(lineNode, "LineExtensionAmount")
  );

  if (netAmount) {
    line.netAmount = netAmount;
  }

  const lineTaxTotalNode = getFirstChildNode(lineNode, "TaxTotal");
  const taxAmount = decimalFromNode(getFirstChildNode(lineTaxTotalNode, "TaxAmount"));

  if (taxAmount) {
    line.taxAmount = taxAmount;
  }

  return {
    line,
    allowances: lineAdjustments.allowances,
    charges: lineAdjustments.charges
  };
}

function extractInvoiceLines(
  rootNode: unknown,
  documentType: Exclude<UblDocumentType, "unknown">
) {
  const lineTagName =
    documentType === "credit_note" ? "CreditNoteLine" : "InvoiceLine";
  const extracted = collectDescendantNodes(rootNode, lineTagName, 250)
    .slice(0, 200)
    .map((lineNode) => extractInvoiceLine(lineNode, documentType));

  return {
    lines: extracted.map((item) => item.line),
    allowances: extracted.flatMap((item) => item.allowances),
    charges: extracted.flatMap((item) => item.charges)
  };
}

function extractRootTaxAmount(rootNode: unknown) {
  const directTaxTotal = getFirstChildNode(rootNode, "TaxTotal");

  return decimalFromNode(getFirstChildNode(directTaxTotal, "TaxAmount"));
}

function extractTaxSubtotals(rootNode: unknown) {
  const taxTotalNodes = asArray(
    isPlainObject(rootNode) ? rootNode.TaxTotal : undefined
  );

  return taxTotalNodes.flatMap((taxTotalNode) => {
    return asArray(
      isPlainObject(taxTotalNode) ? taxTotalNode.TaxSubtotal : undefined
    ).map((taxSubtotalNode) => {
      const taxCategoryNode =
        getFirstChildNode(taxSubtotalNode, "TaxCategory") ??
        collectDescendantNodes(taxSubtotalNode, "TaxCategory", 1)[0];

      return {
        taxableAmount: decimalFromNode(
          getFirstChildNode(taxSubtotalNode, "TaxableAmount")
        ),
        taxAmount: decimalFromNode(getFirstChildNode(taxSubtotalNode, "TaxAmount")),
        taxCategory: normalizeCode(
          getFirstChildText(taxCategoryNode, "ID", 12),
          12
        ),
        taxScheme: normalizeCode(
          getFirstDescendantText(
            getFirstChildNode(taxCategoryNode, "TaxScheme"),
            "ID"
          ) || "VAT",
          40
        ),
        vatCategory: normalizeCode(
          getFirstChildText(taxCategoryNode, "ID", 12),
          12
        ),
        vatRate: normalizeDecimal(getFirstChildText(taxCategoryNode, "Percent", 64)),
        exemptionReason: normalizeText(
          getFirstChildText(taxCategoryNode, "TaxExemptionReason"),
          500
        ),
        exemptionReasonCode: normalizeText(
          getFirstChildText(taxCategoryNode, "TaxExemptionReasonCode"),
          80
        )
      };
    });
  });
}

function extractLegalMonetaryTotals(rootNode: unknown) {
  const totals: Record<string, unknown> = {};
  const legalTotalNode = collectDescendantNodes(
    rootNode,
    "LegalMonetaryTotal",
    1
  )[0];

  addOptionalDecimal(
    totals,
    "lineExtensionAmount",
    getFirstChildText(legalTotalNode, "LineExtensionAmount", 64)
  );
  addOptionalDecimal(
    totals,
    "taxExclusiveAmount",
    getFirstChildText(legalTotalNode, "TaxExclusiveAmount", 64)
  );
  addOptionalDecimal(
    totals,
    "taxInclusiveAmount",
    getFirstChildText(legalTotalNode, "TaxInclusiveAmount", 64)
  );
  addOptionalDecimal(
    totals,
    "allowanceTotalAmount",
    getFirstChildText(legalTotalNode, "AllowanceTotalAmount", 64)
  );
  addOptionalDecimal(
    totals,
    "chargeTotalAmount",
    getFirstChildText(legalTotalNode, "ChargeTotalAmount", 64)
  );
  addOptionalDecimal(
    totals,
    "prepaidAmount",
    getFirstChildText(legalTotalNode, "PrepaidAmount", 64)
  );
  addOptionalDecimal(
    totals,
    "payableRoundingAmount",
    getFirstChildText(legalTotalNode, "PayableRoundingAmount", 64)
  );
  addOptionalDecimal(
    totals,
    "payableAmount",
    getFirstChildText(legalTotalNode, "PayableAmount", 64)
  );

  const rootTaxAmount = extractRootTaxAmount(rootNode);

  if (rootTaxAmount) {
    totals.taxAmount = rootTaxAmount;
  }

  return totals;
}

function extractDocumentReferences(rootNode: unknown) {
  return {
    buyerReference: normalizeText(getFirstChildText(rootNode, "BuyerReference"), 120),
    orderReference: normalizeText(
      getFirstChildText(getFirstChildNode(rootNode, "OrderReference"), "ID"),
      120
    ),
    contractReference: normalizeText(
      getFirstChildText(
        getFirstChildNode(rootNode, "ContractDocumentReference"),
        "ID"
      ),
      120
    ),
    projectReference: normalizeText(
      getFirstChildText(getFirstChildNode(rootNode, "ProjectReference"), "ID"),
      120
    ),
    accountingCost: normalizeText(getFirstChildText(rootNode, "AccountingCost"), 120)
  };
}

function extractAddress(addressNode: unknown) {
  const countryNode = collectDescendantNodes(addressNode, "Country", 1)[0];
  const address: Record<string, unknown> = {};

  addOptionalText(address, "street", getFirstChildText(addressNode, "StreetName"));
  addOptionalText(
    address,
    "additionalStreet",
    getFirstChildText(addressNode, "AdditionalStreetName")
  );
  addOptionalText(address, "city", getFirstChildText(addressNode, "CityName"));
  addOptionalText(address, "postalCode", getFirstChildText(addressNode, "PostalZone"));
  addOptionalText(
    address,
    "region",
    getFirstChildText(addressNode, "CountrySubentity")
  );
  addOptionalText(
    address,
    "country",
    normalizeCode(getFirstDescendantText(countryNode, "IdentificationCode"), 2)
  );

  return address;
}

function extractDelivery(rootNode: unknown) {
  const deliveryNode = getFirstChildNode(rootNode, "Delivery");

  if (!deliveryNode) {
    return undefined;
  }

  const deliveryLocationNode = getFirstChildNode(deliveryNode, "DeliveryLocation");
  const addressNode =
    getFirstChildNode(deliveryLocationNode, "Address") ??
    getFirstChildNode(deliveryNode, "DeliveryAddress");
  const address = extractAddress(addressNode);
  const delivery: Record<string, unknown> = {};

  addOptionalText(
    delivery,
    "deliveryDate",
    getFirstChildText(deliveryNode, "ActualDeliveryDate") ||
      getFirstChildText(deliveryNode, "DeliveryDate")
  );
  addOptionalText(delivery, "locationId", getFirstChildText(deliveryLocationNode, "ID"));
  addOptionalText(delivery, "country", String(address.country ?? ""));

  if (Object.keys(address).length > 0) {
    delivery.address = address;
  }

  return Object.keys(delivery).length > 0 ? delivery : undefined;
}

function extractPayment(rootNode: unknown) {
  const paymentMeansNode = getFirstChildNode(rootNode, "PaymentMeans");
  const paymentTermsNode = getFirstChildNode(rootNode, "PaymentTerms");
  const payment: Record<string, unknown> = {};

  addOptionalText(
    payment,
    "paymentMeansCode",
    getFirstChildText(paymentMeansNode, "PaymentMeansCode")
  );
  addOptionalText(
    payment,
    "paymentReference",
    getFirstChildText(paymentMeansNode, "PaymentID")
  );
  addOptionalText(
    payment,
    "dueDate",
    getFirstChildText(paymentMeansNode, "PaymentDueDate")
  );
  addOptionalText(payment, "terms", getFirstChildText(paymentTermsNode, "Note"));

  const accountNode = collectDescendantNodes(
    paymentMeansNode,
    "PayeeFinancialAccount",
    1
  )[0];
  const accountId = normalizeText(getFirstChildText(accountNode, "ID"), 120);

  if (accountId.length >= 4) {
    payment.accountLast4 = accountId.slice(-4);
  }

  return Object.keys(payment).length > 0 ? payment : undefined;
}

function getSafeSampleIds(nodes: unknown[]) {
  return nodes
    .map((node) => normalizeText(getFirstChildText(node, "ID"), 80))
    .filter(Boolean)
    .slice(0, UNSUPPORTED_FIELD_SAMPLE_LIMIT);
}

function summarizeUnsupportedField(input: {
  field: string;
  nodes: unknown[];
  note: string;
}): UnsupportedUblFieldMetadata | null {
  if (input.nodes.length === 0) {
    return null;
  }

  const sampleIds = getSafeSampleIds(input.nodes);
  const summary: UnsupportedUblFieldMetadata = {
    field: input.field,
    count: input.nodes.length,
    note: input.note
  };

  if (sampleIds.length > 0) {
    summary.sampleIds = sampleIds;
  }

  return summary;
}

function collectUnsupportedUblFields(rootNode: unknown) {
  const unsupportedFields = [
    summarizeUnsupportedField({
      field: "AdditionalDocumentReference",
      nodes: getChildNodes(rootNode, "AdditionalDocumentReference"),
      note:
        "Additional document references are detected and preserved as metadata only in this step."
    }),
    summarizeUnsupportedField({
      field: "BillingReference",
      nodes: getChildNodes(rootNode, "BillingReference"),
      note:
        "Billing references are detected and preserved as metadata only in this step."
    }),
    summarizeUnsupportedField({
      field: "DespatchDocumentReference",
      nodes: getChildNodes(rootNode, "DespatchDocumentReference"),
      note:
        "Despatch document references are detected and preserved as metadata only in this step."
    }),
    summarizeUnsupportedField({
      field: "ReceiptDocumentReference",
      nodes: getChildNodes(rootNode, "ReceiptDocumentReference"),
      note:
        "Receipt document references are detected and preserved as metadata only in this step."
    }),
    summarizeUnsupportedField({
      field: "OriginatorDocumentReference",
      nodes: getChildNodes(rootNode, "OriginatorDocumentReference"),
      note:
        "Originator document references are detected and preserved as metadata only in this step."
    }),
    summarizeUnsupportedField({
      field: "TaxRepresentativeParty",
      nodes: getChildNodes(rootNode, "TaxRepresentativeParty"),
      note:
        "Tax representative party data is detected and preserved as metadata only in this step."
    }),
    summarizeUnsupportedField({
      field: "WithholdingTaxTotal",
      nodes: getChildNodes(rootNode, "WithholdingTaxTotal"),
      note:
        "Withholding tax totals are not normalized into the canonical invoice tax model in this step."
    }),
    summarizeUnsupportedField({
      field: "AccountingCostCode",
      nodes: getChildNodes(rootNode, "AccountingCostCode"),
      note:
        "Accounting cost codes are not normalized; free-text AccountingCost is mapped when present."
    }),
    summarizeUnsupportedField({
      field: "PayeeFinancialAccount",
      nodes: collectDescendantNodes(
        getFirstChildNode(rootNode, "PaymentMeans"),
        "PayeeFinancialAccount",
        8
      ),
      note:
        "Payment account identifiers are reduced to safe canonical payment metadata where possible."
    })
  ].filter((item): item is UnsupportedUblFieldMetadata => item !== null);

  const findings = unsupportedFields.map((field) =>
    makeUblFinding({
      code: "UBL_UNSUPPORTED_FIELD_DETECTED",
      severity: "warning",
      fieldPath: `metadata.ublUnsupportedFields.${field.field}`,
      message: `${field.field} was detected in the UBL XML and preserved as safe metadata instead of being represented as a fully supported canonical field.`,
      fixSuggestion:
        "Review this field before relying on the canonical preview for downstream technical workflows."
    })
  );

  return {
    unsupportedFields,
    findings
  };
}

function buildDetected(input: {
  documentType: UblDocumentType;
  rootName: string;
  profileId?: string;
  customizationId?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  taxPointDate?: string;
  currency?: string;
  seller?: UblPartyInput;
  buyer?: UblPartyInput;
  lineCount?: number;
  unsupportedFieldCount?: number;
}): UblParseResult["detected"] {
  const detected: Record<string, unknown> = {
    documentType: input.documentType,
    rootName: input.rootName
  };

  addOptionalText(detected, "profileId", input.profileId ?? "");
  addOptionalText(detected, "customizationId", input.customizationId ?? "");
  addOptionalText(detected, "invoiceNumber", input.invoiceNumber ?? "");
  addOptionalText(detected, "issueDate", input.issueDate ?? "");
  addOptionalText(detected, "dueDate", input.dueDate ?? "");
  addOptionalText(detected, "taxPointDate", input.taxPointDate ?? "");
  addOptionalText(detected, "currency", input.currency ?? "");
  addOptionalText(detected, "sellerName", input.seller?.name ?? "");
  addOptionalText(detected, "sellerCountry", input.seller?.country ?? "");
  addOptionalText(detected, "buyerName", input.buyer?.name ?? "");
  addOptionalText(detected, "buyerCountry", input.buyer?.country ?? "");

  if (input.lineCount !== undefined) {
    detected.lineCount = input.lineCount;
  }

  if (input.unsupportedFieldCount !== undefined) {
    detected.unsupportedFieldCount = input.unsupportedFieldCount;
  }

  return detected as UblParseResult["detected"];
}

function getXmlValidationErrorMessage(result: unknown) {
  if (result === true) {
    return "";
  }

  if (isPlainObject(result) && isPlainObject(result.err)) {
    const message = result.err.msg;

    if (typeof message === "string" && message.trim()) {
      return message.trim().slice(0, 240);
    }
  }

  return "XML parser reported a well-formedness error.";
}

function mergeFindings(findings: ValidationFinding[]) {
  const seen = new Set<string>();
  const merged: ValidationFinding[] = [];

  for (const finding of findings) {
    const key = `${finding.code}::${finding.fieldPath}::${finding.message}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(finding);
  }

  return merged;
}

export function ublInvoiceXmlToCanonicalInvoice(
  xml: string,
  options: UblParseOptions = {}
): UblParseResult {
  const rootName = detectRootName(xml);
  const documentType = detectDocumentTypeFromRoot(rootName);
  const baseDetected = buildDetected({
    documentType,
    rootName
  });
  const safety = inspectXmlSafety(xml, options);

  if (!safety.safe) {
    return {
      ok: false,
      findings: [
        makeUblFinding({
          code: safety.code ?? "XML_SAFETY_REJECTED",
          severity: "blocked",
          fieldPath: "xml",
          message: safety.message,
          fixSuggestion:
            "Remove blocked XML constructs and upload plain UBL XML for technical sandbox parsing."
        })
      ],
      detected: baseDetected
    };
  }

  const validationResult = XMLValidator.validate(xml);

  if (validationResult !== true) {
    return {
      ok: false,
      findings: [
        makeUblFinding({
          code: "UBL_XML_WELL_FORMEDNESS_FAILED",
          severity: "blocked",
          fieldPath: "xml",
          message: getXmlValidationErrorMessage(validationResult),
          fixSuggestion:
            "Provide well-formed XML before technical UBL parsing can continue."
        })
      ],
      detected: baseDetected
    };
  }

  let parsedXml: unknown;

  try {
    parsedXml = ublParser.parse(xml) as unknown;
  } catch (error) {
    return {
      ok: false,
      findings: [
        makeUblFinding({
          code: "UBL_XML_PARSE_FAILED",
          severity: "blocked",
          fieldPath: "xml",
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : "The uploaded XML could not be parsed safely.",
          fixSuggestion:
            "Check the XML syntax and remove unsupported parser-level constructs."
        })
      ],
      detected: baseDetected
    };
  }

  const rootNode = getRootNode(parsedXml, rootName);
  const customizationId = normalizeText(
    getFirstChildText(rootNode, "CustomizationID"),
    240
  );
  const profileId = normalizeText(getFirstChildText(rootNode, "ProfileID"), 240);
  const invoiceNumber = normalizeText(getFirstChildText(rootNode, "ID"), 80);
  const issueDate = normalizeText(getFirstChildText(rootNode, "IssueDate"), 32);
  const dueDate = normalizeText(getFirstChildText(rootNode, "DueDate"), 32);
  const taxPointDate = normalizeText(
    getFirstChildText(rootNode, "TaxPointDate"),
    32
  );
  const currency = normalizeCode(
    getFirstChildText(rootNode, "DocumentCurrencyCode", 3),
    3
  );
  const seller = extractParty(rootNode, "AccountingSupplierParty");
  const buyer = extractParty(rootNode, "AccountingCustomerParty");

  if (documentType !== "invoice" && documentType !== "credit_note") {
    const detected = buildDetected({
      documentType,
      rootName,
      profileId,
      customizationId,
      invoiceNumber,
      issueDate,
      dueDate,
      taxPointDate,
      currency,
      seller,
      buyer
    });

    return {
      ok: false,
      findings: [
        makeUblFinding({
          code: "UBL_UNKNOWN_DOCUMENT_ROOT",
          severity: "blocked",
          fieldPath: "rootName",
          message:
            "The XML root element is not recognized as a UBL Invoice document.",
          fixSuggestion:
            "Upload a UBL Invoice XML document for canonical invoice parsing."
        })
      ],
      detected
    };
  }

  const documentReferences = extractDocumentReferences(rootNode);
  const documentAdjustments = extractAllowanceCharges(rootNode, {
    scope: "document"
  });
  const extractedLines = extractInvoiceLines(rootNode, documentType);
  const unsupported = collectUnsupportedUblFields(rootNode);
  const notes = getChildNodes(rootNode, "Note")
    .map((noteNode) => normalizeText(nodeToText(noteNode), 500))
    .filter(Boolean);
  const detected = buildDetected({
    documentType,
    rootName,
    profileId,
    customizationId,
    invoiceNumber,
    issueDate,
    dueDate,
    taxPointDate,
    currency,
    seller,
    buyer,
    lineCount: extractedLines.lines.length,
    unsupportedFieldCount: unsupported.unsupportedFields.length
  });
  const invoiceInput = {
    document: {
      type: documentType,
      number: invoiceNumber,
      currency,
      issueDate,
      dueDate,
      taxPointDate,
      profile: profileId,
      ...documentReferences
    },
    seller,
    buyer,
    delivery: extractDelivery(rootNode),
    payment: extractPayment(rootNode),
    lines: extractedLines.lines,
    allowances: [
      ...documentAdjustments.allowances,
      ...extractedLines.allowances
    ],
    charges: [...documentAdjustments.charges, ...extractedLines.charges],
    taxBreakdown: extractTaxSubtotals(rootNode),
    taxSubtotals: extractTaxSubtotals(rootNode),
    totals: extractLegalMonetaryTotals(rootNode),
    metadata: {
      ubl: {
        rootName,
        documentType,
        customizationId,
        profileId,
        parsedAs: "ubl_2.1_technical_canonical_preview",
        unsupportedFields: unsupported.unsupportedFields,
        notes
      }
    }
  };
  const parsedInvoice = canonicalInvoiceSchema.safeParse(invoiceInput);

  if (!parsedInvoice.success) {
    return {
      ok: false,
      findings: parsedInvoice.error.issues.map((issue) =>
        makeUblFinding({
          code: "UBL_CANONICAL_NORMALIZATION_FAILED",
          severity: "blocked",
          fieldPath: issue.path.join(".") || "invoice",
          message: issue.message,
          fixSuggestion:
            "Review the uploaded XML values that could not be normalized into the canonical invoice model."
        })
      ),
      detected
    };
  }

  const coreFindings = buildCoreValidationFindings(parsedInvoice.data);

  return {
    ok: true,
    invoice: parsedInvoice.data,
    findings: mergeFindings([...unsupported.findings, ...coreFindings]),
    detected
  };
}

function appendTextElement(parent: XmlBuilder, name: string, value: string) {
  if (!value.trim()) {
    return;
  }

  parent.ele(name).txt(value).up();
}

function appendAmountElement(
  parent: XmlBuilder,
  name: string,
  value: string,
  currency: string
) {
  parent.ele(name, { currencyID: currency }).txt(value).up();
}

function appendAddress(parent: XmlBuilder, blockName: string, address: {
  street?: string;
  additionalStreet?: string;
  city?: string;
  postalCode?: string;
  region?: string;
  country?: string;
}) {
  const hasAddress =
    (address.street ?? "").trim() ||
    (address.additionalStreet ?? "").trim() ||
    (address.city ?? "").trim() ||
    (address.postalCode ?? "").trim() ||
    (address.region ?? "").trim() ||
    (address.country ?? "").trim();

  if (!hasAddress) {
    return;
  }

  const addressElement = parent.ele(blockName);

  appendTextElement(addressElement, "cbc:StreetName", address.street ?? "");
  appendTextElement(
    addressElement,
    "cbc:AdditionalStreetName",
    address.additionalStreet ?? ""
  );
  appendTextElement(addressElement, "cbc:CityName", address.city ?? "");
  appendTextElement(addressElement, "cbc:PostalZone", address.postalCode ?? "");
  appendTextElement(addressElement, "cbc:CountrySubentity", address.region ?? "");

  if ((address.country ?? "").trim()) {
    addressElement
      .ele("cac:Country")
      .ele("cbc:IdentificationCode")
      .txt(address.country ?? "")
      .up()
      .up();
  }

  addressElement.up();
}

function appendParty(
  parent: XmlBuilder,
  blockName: "cac:AccountingSupplierParty" | "cac:AccountingCustomerParty",
  party: CanonicalInvoice["seller"]
) {
  const partyBlock = parent.ele(blockName);
  const partyElement = partyBlock.ele("cac:Party");

  if (party.electronicAddress.trim()) {
    const endpointAttributes = party.electronicAddressScheme.trim()
      ? {
          schemeID: party.electronicAddressScheme
        }
      : undefined;

    partyElement
      .ele("cbc:EndpointID", endpointAttributes)
      .txt(party.electronicAddress)
      .up();
  }

  if (party.vatId.trim()) {
    partyElement
      .ele("cac:PartyIdentification")
      .ele("cbc:ID", { schemeID: "VAT" })
      .txt(party.vatId)
      .up()
      .up();
  }

  if (party.taxRegistrationNumber.trim()) {
    partyElement
      .ele("cac:PartyIdentification")
      .ele("cbc:ID", { schemeID: "TAX" })
      .txt(party.taxRegistrationNumber)
      .up()
      .up();
  }

  if (party.name.trim()) {
    partyElement.ele("cac:PartyName").ele("cbc:Name").txt(party.name).up().up();
  }

  appendAddress(partyElement, "cac:PostalAddress", {
    street: party.street,
    additionalStreet: party.additionalStreet,
    city: party.city,
    postalCode: party.postalCode,
    region: party.region,
    country: party.country
  });

  if (party.vatId.trim()) {
    partyElement
      .ele("cac:PartyTaxScheme")
      .ele("cbc:CompanyID")
      .txt(party.vatId)
      .up()
      .ele("cac:TaxScheme")
      .ele("cbc:ID")
      .txt("VAT")
      .up()
      .up()
      .up();
  }

  if (party.name.trim() || party.legalName.trim() || party.taxRegistrationNumber.trim()) {
    const legalEntity = partyElement.ele("cac:PartyLegalEntity");

    appendTextElement(
      legalEntity,
      "cbc:RegistrationName",
      party.legalName || party.name
    );
    appendTextElement(legalEntity, "cbc:CompanyID", party.taxRegistrationNumber);
    legalEntity.up();
  }

  if (party.email.trim() || party.phone.trim()) {
    const contact = partyElement.ele("cac:Contact");

    appendTextElement(contact, "cbc:Telephone", party.phone);
    appendTextElement(contact, "cbc:ElectronicMail", party.email);
    contact.up();
  }

  partyElement.up();
  partyBlock.up();
}

function appendTaxCategory(
  parent: XmlBuilder,
  input: {
    vatCategory: string;
    vatRate: string;
    taxScheme?: string;
    exemptionReason?: string;
    exemptionReasonCode?: string;
  }
) {
  const taxCategory = parent.ele("cac:TaxCategory");

  appendTextElement(taxCategory, "cbc:ID", input.vatCategory);
  appendTextElement(taxCategory, "cbc:Percent", input.vatRate);
  appendTextElement(
    taxCategory,
    "cbc:TaxExemptionReasonCode",
    input.exemptionReasonCode ?? ""
  );
  appendTextElement(
    taxCategory,
    "cbc:TaxExemptionReason",
    input.exemptionReason ?? ""
  );
  taxCategory
    .ele("cac:TaxScheme")
    .ele("cbc:ID")
    .txt(input.taxScheme || "VAT")
    .up()
    .up();
  taxCategory.up();
}

function appendTaxSubtotal(
  taxTotal: XmlBuilder,
  subtotal: CalculatedTaxBreakdown | CalculatedTaxSubtotal,
  currency: string
) {
  const taxSubtotal = taxTotal.ele("cac:TaxSubtotal");
  const vatCategory =
    "taxCategory" in subtotal ? subtotal.taxCategory : subtotal.vatCategory;

  appendAmountElement(
    taxSubtotal,
    "cbc:TaxableAmount",
    subtotal.taxableAmount,
    currency
  );
  appendAmountElement(taxSubtotal, "cbc:TaxAmount", subtotal.taxAmount, currency);
  const taxCategoryInput: {
    vatCategory: string;
    vatRate: string;
    taxScheme?: string;
    exemptionReason?: string;
    exemptionReasonCode?: string;
  } = {
    vatCategory,
    vatRate: subtotal.vatRate,
    taxScheme: "taxScheme" in subtotal ? subtotal.taxScheme : "VAT"
  };

  if ("exemptionReason" in subtotal && subtotal.exemptionReason) {
    taxCategoryInput.exemptionReason = subtotal.exemptionReason;
  }

  if ("exemptionReasonCode" in subtotal && subtotal.exemptionReasonCode) {
    taxCategoryInput.exemptionReasonCode = subtotal.exemptionReasonCode;
  }

  appendTaxCategory(taxSubtotal, taxCategoryInput);
  taxSubtotal.up();
}

function appendAllowanceCharge(
  parent: XmlBuilder,
  adjustment: UblAdjustmentForXml,
  input: {
    chargeIndicator: boolean;
    currency: string;
  }
) {
  if (!adjustment.amount.trim()) {
    return;
  }

  const allowanceCharge = parent.ele("cac:AllowanceCharge");

  appendTextElement(allowanceCharge, "cbc:ID", adjustment.id ?? "");
  appendTextElement(
    allowanceCharge,
    "cbc:ChargeIndicator",
    input.chargeIndicator ? "true" : "false"
  );
  appendTextElement(
    allowanceCharge,
    "cbc:AllowanceChargeReasonCode",
    adjustment.reasonCode ?? ""
  );
  appendTextElement(
    allowanceCharge,
    "cbc:AllowanceChargeReason",
    adjustment.reason ?? ""
  );
  appendTextElement(
    allowanceCharge,
    "cbc:MultiplierFactorNumeric",
    adjustment.percentage ?? ""
  );
  appendAmountElement(
    allowanceCharge,
    "cbc:Amount",
    adjustment.amount,
    input.currency
  );

  if (adjustment.baseAmount?.trim()) {
    appendAmountElement(
      allowanceCharge,
      "cbc:BaseAmount",
      adjustment.baseAmount,
      input.currency
    );
  }

  if ((adjustment.taxCategory ?? "").trim() || adjustment.vatRate?.trim()) {
    appendTaxCategory(allowanceCharge, {
      vatCategory: adjustment.taxCategory ?? "",
      vatRate: adjustment.vatRate ?? "",
      taxScheme: "VAT"
    });
  }

  allowanceCharge.up();
}

function appendDocumentReference(
  parent: XmlBuilder,
  blockName: "cac:OrderReference" | "cac:ContractDocumentReference" | "cac:ProjectReference",
  value: string
) {
  if (!value.trim()) {
    return;
  }

  parent.ele(blockName).ele("cbc:ID").txt(value).up().up();
}

function appendDelivery(parent: XmlBuilder, delivery: CanonicalInvoice["delivery"]) {
  if (!delivery) {
    return;
  }

  const hasDelivery =
    delivery.deliveryDate.trim() ||
    delivery.locationId.trim() ||
    delivery.country.trim() ||
    Boolean(delivery.address);

  if (!hasDelivery) {
    return;
  }

  const deliveryElement = parent.ele("cac:Delivery");

  appendTextElement(
    deliveryElement,
    "cbc:ActualDeliveryDate",
    delivery.deliveryDate
  );

  if (delivery.locationId.trim() || delivery.address || delivery.country.trim()) {
    const location = deliveryElement.ele("cac:DeliveryLocation");

    appendTextElement(location, "cbc:ID", delivery.locationId);
    appendAddress(location, "cac:Address", {
      street: delivery.address?.street ?? "",
      additionalStreet: delivery.address?.additionalStreet ?? "",
      city: delivery.address?.city ?? "",
      postalCode: delivery.address?.postalCode ?? "",
      region: delivery.address?.region ?? "",
      country: delivery.address?.country ?? delivery.country
    });
    location.up();
  }

  deliveryElement.up();
}

function appendPayment(parent: XmlBuilder, payment: CanonicalInvoice["payment"]) {
  if (!payment) {
    return;
  }

  if (
    payment.paymentMeansCode.trim() ||
    payment.paymentReference.trim() ||
    payment.dueDate.trim()
  ) {
    const paymentMeans = parent.ele("cac:PaymentMeans");

    appendTextElement(
      paymentMeans,
      "cbc:PaymentMeansCode",
      payment.paymentMeansCode
    );
    appendTextElement(paymentMeans, "cbc:PaymentDueDate", payment.dueDate);
    appendTextElement(paymentMeans, "cbc:PaymentID", payment.paymentReference);
    paymentMeans.up();
  }

  if (payment.terms.trim()) {
    parent.ele("cac:PaymentTerms").ele("cbc:Note").txt(payment.terms).up().up();
  }
}

function appendInvoiceLine(
  parent: XmlBuilder,
  line: CalculatedInvoiceLine,
  originalLine: CanonicalInvoice["lines"][number],
  input: {
    currency: string;
    documentType: Exclude<UblDocumentType, "unknown">;
  }
) {
  const invoiceLine = parent.ele(
    input.documentType === "credit_note" ? "cac:CreditNoteLine" : "cac:InvoiceLine"
  );

  appendTextElement(invoiceLine, "cbc:ID", line.id);

  const quantityAttributes = line.unitCode.trim()
    ? {
        unitCode: line.unitCode
      }
    : undefined;

  invoiceLine
    .ele(
      input.documentType === "credit_note"
        ? "cbc:CreditedQuantity"
        : "cbc:InvoicedQuantity",
      quantityAttributes
    )
    .txt(line.quantity)
    .up();
  appendAmountElement(
    invoiceLine,
    "cbc:LineExtensionAmount",
    line.netAmount,
    input.currency
  );
  appendTextElement(invoiceLine, "cbc:AccountingCost", originalLine.accountingCost);

  if (originalLine.orderLineReference.trim()) {
    invoiceLine
      .ele("cac:OrderLineReference")
      .ele("cbc:LineID")
      .txt(originalLine.orderLineReference)
      .up()
      .up();
  }

  if (isNonZeroDecimal(line.discountAmount)) {
    appendAllowanceCharge(
      invoiceLine,
      {
        scope: "line",
        lineId: originalLine.id,
        reason: "Line discount",
        reasonCode: "",
        amount: line.discountAmount,
        taxCategory: line.vatCategory,
        vatRate: line.vatRate
      },
      {
        chargeIndicator: false,
        currency: input.currency
      }
    );
  }

  if (isNonZeroDecimal(line.chargeAmount)) {
    appendAllowanceCharge(
      invoiceLine,
      {
        scope: "line",
        lineId: originalLine.id,
        reason: "Line charge",
        reasonCode: "",
        amount: line.chargeAmount,
        taxCategory: line.vatCategory,
        vatRate: line.vatRate
      },
      {
        chargeIndicator: true,
        currency: input.currency
      }
    );
  }

  const item = invoiceLine.ele("cac:Item");
  appendTextElement(item, "cbc:Description", line.description);
  appendTextElement(item, "cbc:Name", originalLine.itemName);
  appendTaxCategory(item, {
    vatCategory: line.vatCategory,
    vatRate: line.vatRate,
    taxScheme: "VAT"
  });
  item.up();

  invoiceLine
    .ele("cac:Price")
    .ele("cbc:PriceAmount", { currencyID: input.currency })
    .txt(line.unitPrice)
    .up()
    .up();

  invoiceLine.up();
}

export function canonicalToUblInvoiceXml(invoice: CanonicalInvoice): string {
  const canonicalInvoice = canonicalInvoiceSchema.parse(invoice);
  const calculation = calculateInvoiceTotals(canonicalInvoice);
  const currency = canonicalInvoice.document.currency;
  const documentType = canonicalInvoice.document.type;
  const rootName = documentType === "credit_note" ? "CreditNote" : "Invoice";
  const rootNamespace =
    documentType === "credit_note"
      ? UBL_CREDIT_NOTE_NAMESPACE
      : UBL_INVOICE_NAMESPACE;

  const root = create({
    version: "1.0",
    encoding: "UTF-8"
  }).ele(rootName, {
    xmlns: rootNamespace,
    "xmlns:cac": UBL_CAC_NAMESPACE,
    "xmlns:cbc": UBL_CBC_NAMESPACE,
    "xmlns:xsi": UBL_XSI_NAMESPACE
  });

  appendTextElement(root, "cbc:CustomizationID", UBL_EXPORT_CUSTOMIZATION_ID);
  appendTextElement(root, "cbc:ProfileID", UBL_EXPORT_PROFILE_ID);
  appendTextElement(root, "cbc:ID", canonicalInvoice.document.number);
  appendTextElement(root, "cbc:IssueDate", canonicalInvoice.document.issueDate);
  appendTextElement(
    root,
    documentType === "credit_note"
      ? "cbc:CreditNoteTypeCode"
      : "cbc:InvoiceTypeCode",
    documentType === "credit_note" ? "381" : "380"
  );
  appendTextElement(root, "cbc:TaxPointDate", canonicalInvoice.document.taxPointDate);
  appendTextElement(root, "cbc:DocumentCurrencyCode", currency);
  appendTextElement(root, "cbc:BuyerReference", canonicalInvoice.document.buyerReference);
  appendTextElement(root, "cbc:AccountingCost", canonicalInvoice.document.accountingCost);
  appendTextElement(root, "cbc:DueDate", canonicalInvoice.document.dueDate);
  appendDocumentReference(
    root,
    "cac:OrderReference",
    canonicalInvoice.document.orderReference
  );
  appendDocumentReference(
    root,
    "cac:ContractDocumentReference",
    canonicalInvoice.document.contractReference
  );
  appendDocumentReference(
    root,
    "cac:ProjectReference",
    canonicalInvoice.document.projectReference
  );

  appendParty(root, "cac:AccountingSupplierParty", canonicalInvoice.seller);
  appendParty(root, "cac:AccountingCustomerParty", canonicalInvoice.buyer);
  appendDelivery(root, canonicalInvoice.delivery);
  appendPayment(root, canonicalInvoice.payment);

  for (const allowance of canonicalInvoice.allowances.filter(
    (adjustment) => adjustment.scope === "document"
  )) {
    appendAllowanceCharge(root, allowance, {
      chargeIndicator: false,
      currency
    });
  }

  for (const charge of canonicalInvoice.charges.filter(
    (adjustment) => adjustment.scope === "document"
  )) {
    appendAllowanceCharge(root, charge, {
      chargeIndicator: true,
      currency
    });
  }

  const taxTotal = root.ele("cac:TaxTotal");
  appendAmountElement(taxTotal, "cbc:TaxAmount", calculation.totals.taxAmount, currency);

  for (const subtotal of calculation.taxBreakdown) {
    appendTaxSubtotal(taxTotal, subtotal, currency);
  }

  taxTotal.up();

  const legalMonetaryTotal = root.ele("cac:LegalMonetaryTotal");
  appendAmountElement(
    legalMonetaryTotal,
    "cbc:LineExtensionAmount",
    calculation.totals.lineExtensionAmount,
    currency
  );
  appendAmountElement(
    legalMonetaryTotal,
    "cbc:TaxExclusiveAmount",
    calculation.totals.taxExclusiveAmount,
    currency
  );
  appendAmountElement(
    legalMonetaryTotal,
    "cbc:TaxInclusiveAmount",
    calculation.totals.taxInclusiveAmount,
    currency
  );
  if (calculation.totals.allowanceTotalAmount) {
    appendAmountElement(
      legalMonetaryTotal,
      "cbc:AllowanceTotalAmount",
      calculation.totals.allowanceTotalAmount,
      currency
    );
  } else {
    const allowanceTotal = sumDecimalStrings(
      canonicalInvoice.allowances
        .filter((adjustment) => adjustment.scope === "document")
        .map((adjustment) => adjustment.amount)
    );

    if (allowanceTotal) {
      appendAmountElement(
        legalMonetaryTotal,
        "cbc:AllowanceTotalAmount",
        allowanceTotal,
        currency
      );
    }
  }

  if (calculation.totals.chargeTotalAmount) {
    appendAmountElement(
      legalMonetaryTotal,
      "cbc:ChargeTotalAmount",
      calculation.totals.chargeTotalAmount,
      currency
    );
  } else {
    const chargeTotal = sumDecimalStrings(
      canonicalInvoice.charges
        .filter((adjustment) => adjustment.scope === "document")
        .map((adjustment) => adjustment.amount)
    );

    if (chargeTotal) {
      appendAmountElement(
        legalMonetaryTotal,
        "cbc:ChargeTotalAmount",
        chargeTotal,
        currency
      );
    }
  }

  if (calculation.totals.prepaidAmount) {
    appendAmountElement(
      legalMonetaryTotal,
      "cbc:PrepaidAmount",
      calculation.totals.prepaidAmount,
      currency
    );
  }

  if (calculation.totals.payableRoundingAmount) {
    appendAmountElement(
      legalMonetaryTotal,
      "cbc:PayableRoundingAmount",
      calculation.totals.payableRoundingAmount,
      currency
    );
  }

  appendAmountElement(
    legalMonetaryTotal,
    "cbc:PayableAmount",
    calculation.totals.payableAmount,
    currency
  );
  legalMonetaryTotal.up();

  for (const [index, line] of calculation.lines.entries()) {
    const originalLine = canonicalInvoice.lines[index];

    if (!originalLine) {
      continue;
    }

    appendInvoiceLine(root, line, originalLine, {
      currency,
      documentType
    });
  }

  return root.end({
    prettyPrint: true
  });
}

export const canonicalToUblXml = canonicalToUblInvoiceXml;
