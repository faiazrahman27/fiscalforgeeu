import { create } from "xmlbuilder2";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  buildCoreValidationFindings,
  calculateInvoiceTotals,
  canonicalInvoiceSchema,
  type CalculatedInvoiceLine,
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
export * from "./schematron-local-execution-prototype.js";
export * from "./schematron-result-mapper.js";

const UBL_INVOICE_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
const UBL_CAC_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
const UBL_CBC_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
const UBL_XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";

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
    documentType?: "invoice" | "credit_note" | "unknown";
    rootName?: string;
    profileId?: string;
    customizationId?: string;
    invoiceNumber?: string;
    issueDate?: string;
    currency?: string;
    sellerName?: string;
    sellerCountry?: string;
    buyerName?: string;
    buyerCountry?: string;
  };
};

export type XmlSafetyIssueCode =
  | "XML_BODY_TOO_LARGE"
  | "XML_DOCTYPE_BLOCKED"
  | "XML_ENTITY_BLOCKED"
  | "XML_EXTERNAL_IDENTIFIER_BLOCKED"
  | "XML_STYLESHEET_BLOCKED";

export type XmlSafetyInspection = {
  safe: boolean;
  message: string;
  byteLength: number;
  code?: XmlSafetyIssueCode;
  maxBytes?: number;
};

type UblParseOptions = {
  maxBytes?: number;
};

type UblLineInput = CanonicalInvoice["lines"][number];
type UblPartyInput = CanonicalInvoice["seller"];

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

export function inspectXmlSafety(
  xml: string,
  options: UblParseOptions = {}
): XmlSafetyInspection {
  const byteLength = getUtf8ByteLength(xml);

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

function normalizeText(value: string, _maxLength = 240) {
  return value.trim();
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

function extractParty(rootNode: unknown, partyBlockName: string): UblPartyInput {
  const partyBlock = collectDescendantNodes(rootNode, partyBlockName, 1)[0];
  const partyNode = getFirstChildNode(partyBlock, "Party") ?? partyBlock;
  const postalAddressNode = collectDescendantNodes(
    partyNode,
    "PostalAddress",
    1
  )[0];
  const countryNode = collectDescendantNodes(postalAddressNode, "Country", 1)[0];

  return {
    name: extractPartyName(partyNode),
    country: normalizeCode(
      getFirstDescendantText(countryNode, "IdentificationCode"),
      2
    ),
    vatId: extractPartyVatId(partyNode),
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
    region: normalizeText(
      getFirstChildText(postalAddressNode, "CountrySubentity"),
      120
    ),
    electronicAddress: normalizeText(
      getFirstDescendantText(partyNode, "EndpointID"),
      160
    )
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

function extractInvoiceLine(lineNode: unknown): UblLineInput {
  const quantityNode = getFirstChildNode(lineNode, "InvoicedQuantity");
  const itemNode = getFirstChildNode(lineNode, "Item");
  const priceNode = getFirstChildNode(lineNode, "Price");
  const priceAmountNode = getFirstChildNode(priceNode, "PriceAmount");
  const taxCategoryNode = extractLineTaxCategory(itemNode);

  const line: UblLineInput = {
    id: normalizeText(getFirstChildText(lineNode, "ID", 80), 80),
    description: extractLineDescription(itemNode),
    quantity: decimalFromNode(quantityNode),
    unitCode: normalizeCode(getAttributeValue(quantityNode, "unitCode"), 12),
    unitPrice: decimalFromNode(priceAmountNode),
    vatCategory: normalizeCode(getFirstChildText(taxCategoryNode, "ID", 12), 12),
    vatRate: normalizeDecimal(getFirstChildText(taxCategoryNode, "Percent", 64))
  };

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

  return line;
}

function extractInvoiceLines(rootNode: unknown) {
  return collectDescendantNodes(rootNode, "InvoiceLine", 250)
    .slice(0, 200)
    .map((lineNode) => extractInvoiceLine(lineNode));
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
        vatCategory: normalizeCode(
          getFirstChildText(taxCategoryNode, "ID", 12),
          12
        ),
        vatRate: normalizeDecimal(getFirstChildText(taxCategoryNode, "Percent", 64))
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

function buildDetected(input: {
  documentType: "invoice" | "credit_note" | "unknown";
  rootName: string;
  profileId?: string;
  customizationId?: string;
  invoiceNumber?: string;
  issueDate?: string;
  currency?: string;
  seller?: UblPartyInput;
  buyer?: UblPartyInput;
}): UblParseResult["detected"] {
  const detected: Record<string, unknown> = {
    documentType: input.documentType,
    rootName: input.rootName
  };

  addOptionalText(detected, "profileId", input.profileId ?? "");
  addOptionalText(detected, "customizationId", input.customizationId ?? "");
  addOptionalText(detected, "invoiceNumber", input.invoiceNumber ?? "");
  addOptionalText(detected, "issueDate", input.issueDate ?? "");
  addOptionalText(detected, "currency", input.currency ?? "");
  addOptionalText(detected, "sellerName", input.seller?.name ?? "");
  addOptionalText(detected, "sellerCountry", input.seller?.country ?? "");
  addOptionalText(detected, "buyerName", input.buyer?.name ?? "");
  addOptionalText(detected, "buyerCountry", input.buyer?.country ?? "");

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
  const currency = normalizeCode(
    getFirstChildText(rootNode, "DocumentCurrencyCode", 3),
    3
  );
  const seller = extractParty(rootNode, "AccountingSupplierParty");
  const buyer = extractParty(rootNode, "AccountingCustomerParty");
  const detected = buildDetected({
    documentType,
    rootName,
    profileId,
    customizationId,
    invoiceNumber,
    issueDate,
    currency,
    seller,
    buyer
  });

  if (documentType === "credit_note") {
    return {
      ok: false,
      findings: [
        makeUblFinding({
          code: "UBL_CREDIT_NOTE_PARSE_UNSUPPORTED",
          severity: "blocked",
          fieldPath: "rootName",
          message:
            "CreditNote XML was detected, but this parser currently supports UBL Invoice canonical previews only.",
          fixSuggestion:
            "Use a UBL Invoice XML document for this technical sandbox parser, or route the credit note for a later dedicated parser."
        })
      ],
      detected
    };
  }

  if (documentType !== "invoice") {
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

  const invoiceInput = {
    document: {
      type: "invoice",
      number: invoiceNumber,
      currency,
      issueDate,
      dueDate,
      profile: profileId,
      buyerReference: normalizeText(
        getFirstChildText(rootNode, "BuyerReference"),
        120
      )
    },
    seller,
    buyer,
    lines: extractInvoiceLines(rootNode),
    taxSubtotals: extractTaxSubtotals(rootNode),
    totals: extractLegalMonetaryTotals(rootNode)
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
    findings: mergeFindings(coreFindings),
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

function appendParty(
  parent: XmlBuilder,
  blockName: "cac:AccountingSupplierParty" | "cac:AccountingCustomerParty",
  party: CanonicalInvoice["seller"]
) {
  const partyBlock = parent.ele(blockName);
  const partyElement = partyBlock.ele("cac:Party");

  if (party.electronicAddress.trim()) {
    partyElement.ele("cbc:EndpointID").txt(party.electronicAddress).up();
  }

  if (party.vatId.trim()) {
    partyElement
      .ele("cac:PartyIdentification")
      .ele("cbc:ID")
      .txt(party.vatId)
      .up()
      .up();
  }

  if (party.name.trim()) {
    partyElement.ele("cac:PartyName").ele("cbc:Name").txt(party.name).up().up();
  }

  if (
    party.street.trim() ||
    party.city.trim() ||
    party.postalCode.trim() ||
    party.country.trim()
  ) {
    const address = partyElement.ele("cac:PostalAddress");

    appendTextElement(address, "cbc:StreetName", party.street);
    appendTextElement(address, "cbc:CityName", party.city);
    appendTextElement(address, "cbc:PostalZone", party.postalCode);
    appendTextElement(address, "cbc:CountrySubentity", party.region);

    if (party.country.trim()) {
      address
        .ele("cac:Country")
        .ele("cbc:IdentificationCode")
        .txt(party.country)
        .up()
        .up();
    }

    address.up();
  }

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

  if (party.name.trim()) {
    partyElement
      .ele("cac:PartyLegalEntity")
      .ele("cbc:RegistrationName")
      .txt(party.name)
      .up()
      .up();
  }

  partyElement.up();
  partyBlock.up();
}

function appendTaxCategory(
  parent: XmlBuilder,
  vatCategory: string,
  vatRate: string
) {
  const taxCategory = parent.ele("cac:TaxCategory");

  appendTextElement(taxCategory, "cbc:ID", vatCategory);
  appendTextElement(taxCategory, "cbc:Percent", vatRate);
  taxCategory.ele("cac:TaxScheme").ele("cbc:ID").txt("VAT").up().up();
  taxCategory.up();
}

function appendTaxSubtotal(
  taxTotal: XmlBuilder,
  subtotal: CalculatedTaxSubtotal,
  currency: string
) {
  const taxSubtotal = taxTotal.ele("cac:TaxSubtotal");

  appendAmountElement(
    taxSubtotal,
    "cbc:TaxableAmount",
    subtotal.taxableAmount,
    currency
  );
  appendAmountElement(taxSubtotal, "cbc:TaxAmount", subtotal.taxAmount, currency);
  appendTaxCategory(taxSubtotal, subtotal.vatCategory, subtotal.vatRate);
  taxSubtotal.up();
}

function appendInvoiceLine(
  parent: XmlBuilder,
  line: CalculatedInvoiceLine,
  currency: string
) {
  const invoiceLine = parent.ele("cac:InvoiceLine");

  appendTextElement(invoiceLine, "cbc:ID", line.id);

  const quantityAttributes = line.unitCode.trim()
    ? {
        unitCode: line.unitCode
      }
    : undefined;

  invoiceLine
    .ele("cbc:InvoicedQuantity", quantityAttributes)
    .txt(line.quantity)
    .up();
  appendAmountElement(
    invoiceLine,
    "cbc:LineExtensionAmount",
    line.netAmount,
    currency
  );

  const item = invoiceLine.ele("cac:Item");
  appendTextElement(item, "cbc:Description", line.description);
  appendTaxCategory(item, line.vatCategory, line.vatRate);
  item.up();

  invoiceLine
    .ele("cac:Price")
    .ele("cbc:PriceAmount", { currencyID: currency })
    .txt(line.unitPrice)
    .up()
    .up();

  invoiceLine.up();
}

export function canonicalToUblInvoiceXml(invoice: CanonicalInvoice): string {
  const canonicalInvoice = canonicalInvoiceSchema.parse(invoice);
  const calculation = calculateInvoiceTotals(canonicalInvoice);
  const currency = canonicalInvoice.document.currency;

  const root = create({
    version: "1.0",
    encoding: "UTF-8"
  }).ele("Invoice", {
    xmlns: UBL_INVOICE_NAMESPACE,
    "xmlns:cac": UBL_CAC_NAMESPACE,
    "xmlns:cbc": UBL_CBC_NAMESPACE,
    "xmlns:xsi": UBL_XSI_NAMESPACE
  });

  root.com(
    "Generated by Invoice Lantern for UBL export readiness. This is not official validation or certification."
  );
  appendTextElement(
    root,
    "cbc:CustomizationID",
    "urn:invoice-lantern:ubl-export-readiness:1"
  );
  appendTextElement(root, "cbc:ProfileID", "Invoice Lantern UBL export readiness");
  appendTextElement(root, "cbc:ID", canonicalInvoice.document.number);
  appendTextElement(root, "cbc:IssueDate", canonicalInvoice.document.issueDate);
  appendTextElement(root, "cbc:DueDate", canonicalInvoice.document.dueDate);
  appendTextElement(
    root,
    "cbc:InvoiceTypeCode",
    canonicalInvoice.document.type === "credit_note" ? "381" : "380"
  );
  appendTextElement(root, "cbc:DocumentCurrencyCode", currency);
  appendTextElement(root, "cbc:BuyerReference", canonicalInvoice.document.buyerReference);

  appendParty(root, "cac:AccountingSupplierParty", canonicalInvoice.seller);
  appendParty(root, "cac:AccountingCustomerParty", canonicalInvoice.buyer);

  const taxTotal = root.ele("cac:TaxTotal");
  appendAmountElement(taxTotal, "cbc:TaxAmount", calculation.totals.taxAmount, currency);

  for (const subtotal of calculation.taxSubtotals) {
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
  appendAmountElement(
    legalMonetaryTotal,
    "cbc:PayableAmount",
    calculation.totals.payableAmount,
    currency
  );
  legalMonetaryTotal.up();

  for (const line of calculation.lines) {
    appendInvoiceLine(root, line, currency);
  }

  return root.end({
    prettyPrint: true
  });
}
