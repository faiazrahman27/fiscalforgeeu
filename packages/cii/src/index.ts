import { XMLParser, XMLValidator } from "fast-xml-parser";
import { create } from "xmlbuilder2";
import {
  buildCoreValidationFindings,
  calculateInvoiceTotals,
  canonicalInvoiceSchema,
  type CanonicalInvoice,
  type LegalConfidence,
  type ValidationFinding,
  type ValidationFindingSeverity
} from "@invoice-lantern/invoice-core";

export const CII_CROSS_INDUSTRY_INVOICE_NAMESPACE =
  "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100";
export const CII_RAM_NAMESPACE =
  "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100";
export const CII_UDT_NAMESPACE =
  "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100";
export const CII_QDT_NAMESPACE =
  "urn:un:unece:uncefact:data:standard:QualifiedDataType:100";
export const CII_XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";
export const CII_EXPORT_CUSTOMIZATION_ID =
  "urn:invoice-lantern:technical-cii-export:1";
export const CII_EXPORT_PROFILE_ID =
  "Invoice Lantern technical UN/CEFACT CII-style export";
export const CII_RULE_SET_CODE = "INVOICE_LANTERN_CII_TECHNICAL";
export const CII_RULE_VERSION = "2026.05.1";
export const CII_SOURCE_LABEL =
  "Invoice Lantern technical UN/CEFACT CII-style XML mapping";
export const CII_TECHNICAL_DISCLAIMER =
  "Invoice Lantern CII support is independent technical UN/CEFACT CII-style XML export/import and canonical invoice mapping support for sandbox readiness review. It is not official CII certification, EN 16931 certification, Peppol certification, legal advice, tax advice, accounting advice, official filing, authority acceptance, or a compliance guarantee.";

const DEFAULT_MAX_XML_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_XML_DEPTH = 150;
const UNSUPPORTED_FIELD_SAMPLE_LIMIT = 5;

type XmlBuilder = {
  ele: (
    name: string,
    attributes?: Record<string, string> | undefined
  ) => XmlBuilder;
  txt: (content: string) => XmlBuilder;
  up: () => XmlBuilder;
  end: (options?: { prettyPrint?: boolean }) => string;
};

export type CiiDocumentType = "invoice" | "credit_note" | "unknown";

export type XmlSafetyIssueCode =
  | "XML_BODY_TOO_LARGE"
  | "XML_DOCTYPE_BLOCKED"
  | "XML_ENTITY_BLOCKED"
  | "XML_EXTERNAL_IDENTIFIER_BLOCKED"
  | "XML_STYLESHEET_BLOCKED"
  | "XML_EXTERNAL_SCHEMA_BLOCKED"
  | "XML_NESTING_TOO_DEEP";

export type XmlSafetyInspection = {
  safe: boolean;
  message: string;
  byteLength: number;
  code?: XmlSafetyIssueCode;
  maxBytes?: number;
  maxDepth?: number;
};

export type CiiParseOptions = {
  maxBytes?: number;
  maxDepth?: number;
};

export type CiiParseResult = {
  ok: boolean;
  invoice?: CanonicalInvoice;
  findings: ValidationFinding[];
  detected: {
    documentType?: CiiDocumentType;
    rootName?: string;
    profileId?: string;
    customizationId?: string;
    invoiceNumber?: string;
    issueDate?: string;
    dueDate?: string;
    currency?: string;
    sellerName?: string;
    sellerCountry?: string;
    buyerName?: string;
    buyerCountry?: string;
    lineCount?: number;
    unsupportedFieldCount?: number;
  };
  disclaimer: string;
};

type CiiPartyInput = {
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

type UnsupportedCiiFieldMetadata = {
  field: string;
  count: number;
  sampleIds?: string[];
  note: string;
};

const ciiParser = new XMLParser({
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
  const tagMatches = xml.matchAll(/<\s*(\/?)([A-Za-z_][\w:.-]*)(?=\s|>|\/>)/g);
  let depth = 0;
  let maxDepth = 0;

  for (const match of tagMatches) {
    const fullMatch = match[0];
    const isClosing = match[1] === "/";
    const isProcessingInstruction = fullMatch.startsWith("<?");
    const isSelfClosing = /\/>\s*$/.test(fullMatch);

    if (isProcessingInstruction) {
      continue;
    }

    if (isClosing) {
      depth = Math.max(0, depth - 1);
      continue;
    }

    depth += 1;
    maxDepth = Math.max(maxDepth, depth);

    if (isSelfClosing) {
      depth = Math.max(0, depth - 1);
    }
  }

  return maxDepth;
}

export function inspectCiiXmlSafety(
  xml: string,
  options: CiiParseOptions = {}
): XmlSafetyInspection {
  const byteLength = getUtf8ByteLength(xml);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_XML_BYTES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_XML_DEPTH;

  if (byteLength > maxBytes) {
    return {
      safe: false,
      code: "XML_BODY_TOO_LARGE",
      message:
        "XML body is too large for this technical CII parsing endpoint.",
      byteLength,
      maxBytes
    };
  }

  if (/<!DOCTYPE/i.test(xml) || /<!\s*DTD/i.test(xml)) {
    return {
      safe: false,
      code: "XML_DOCTYPE_BLOCKED",
      message:
        "XML contains a DOCTYPE or DTD declaration. DTDs are blocked to reduce XXE risk.",
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

  if (
    /\b(?:schemaLocation|noNamespaceSchemaLocation)\s*=\s*["'][^"']*(?:https?:|file:)/i.test(
      xml
    ) ||
    /\b(?:https?|file):\/\/[^\s"']+\.(?:dtd|xsd|ent|mod)\b/i.test(xml)
  ) {
    return {
      safe: false,
      code: "XML_EXTERNAL_SCHEMA_BLOCKED",
      message:
        "XML references an external schema or entity URL. Remote schema and entity fetching is blocked.",
      byteLength
    };
  }

  if (getApproximateXmlDepth(xml) > maxDepth) {
    return {
      safe: false,
      code: "XML_NESTING_TOO_DEEP",
      message:
        "XML nesting is too deep for this technical CII parsing endpoint.",
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

export const inspectXmlSafety = inspectCiiXmlSafety;

function makeCiiFinding(input: {
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
    category: input.category ?? "CII",
    fieldPath: input.fieldPath,
    message: input.message,
    legalConfidence: input.legalConfidence ?? "technical",
    ruleSetCode: CII_RULE_SET_CODE,
    ruleVersion: CII_RULE_VERSION,
    sourceLabels: [CII_SOURCE_LABEL]
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

function detectTypeCode(xml: string) {
  const exchangedDocumentMatch = xml.match(
    /<[^>]*:?ExchangedDocument\b[\s\S]*?<\/[^>]*:?ExchangedDocument>/i
  )?.[0];
  const typeCodeMatch = exchangedDocumentMatch?.match(
    /<[^>]*:?TypeCode\b[^>]*>\s*([^<]+?)\s*<\/[^>]*:?TypeCode>/i
  );

  return typeCodeMatch?.[1]?.trim() ?? "";
}

export function detectCiiDocumentType(xml: string): CiiDocumentType {
  const safety = inspectCiiXmlSafety(xml);

  if (!safety.safe) {
    return "unknown";
  }

  if (detectRootName(xml) !== "CrossIndustryInvoice") {
    return "unknown";
  }

  const typeCode = detectTypeCode(xml);

  if (typeCode === "381") {
    return "credit_note";
  }

  if (typeCode === "380" || typeCode === "388" || typeCode === "") {
    return "invoice";
  }

  return "unknown";
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

function getFirstChildText(parent: unknown, tagName: string) {
  return nodeToText(getFirstChildNode(parent, tagName));
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
      results.push(...asArray(value));

      if (results.length >= maxResults) {
        return results.slice(0, maxResults);
      }
    }

    if (!key.startsWith("@_") && key !== "#text") {
      collectDescendantNodes(value, tagName, maxResults, results);
    }
  }

  return results.slice(0, maxResults);
}

function getFirstDescendantText(node: unknown, tagName: string) {
  return nodeToText(collectDescendantNodes(node, tagName, 1)[0]);
}

function getAttribute(node: unknown, attributeName: string) {
  if (!isPlainObject(node)) {
    return "";
  }

  const value = node[`@_${attributeName}`];

  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeCode(value: string, maxLength: number) {
  return normalizeText(value, maxLength).toUpperCase();
}

function addOptionalText(
  target: Record<string, unknown>,
  key: string,
  value: string
) {
  const normalized = value.trim();

  if (normalized.length > 0) {
    target[key] = normalized;
  }
}

function appendTextElement(
  parent: XmlBuilder,
  name: string,
  value: string | undefined,
  attributes?: Record<string, string>
) {
  const text = value?.trim() ?? "";

  if (!text) {
    return;
  }

  const child = parent.ele(name, attributes);
  child.txt(text).up();
}

function appendAmountElement(
  parent: XmlBuilder,
  name: string,
  value: string | undefined,
  currency?: string
) {
  appendTextElement(
    parent,
    name,
    value,
    currency ? { currencyID: currency } : undefined
  );
}

function formatDate102(value: string) {
  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return "";
  }

  return trimmed.replaceAll("-", "");
}

function parseCiiDate(value: string) {
  const trimmed = value.trim();

  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return "";
}

function getCiiDate(node: unknown) {
  const dateTimeString = getFirstDescendantText(node, "DateTimeString");

  return parseCiiDate(dateTimeString);
}

function normalizeParty(party: CanonicalInvoice["seller"]): CiiPartyInput {
  return {
    name: party.name,
    legalName: party.legalName,
    country: party.country,
    vatId: party.vatId,
    taxRegistrationNumber: party.taxRegistrationNumber,
    city: party.city,
    postalCode: party.postalCode,
    street: party.street,
    additionalStreet: party.additionalStreet,
    region: party.region,
    electronicAddress: party.electronicAddress,
    electronicAddressScheme: party.electronicAddressScheme,
    email: party.email,
    phone: party.phone
  };
}

function appendCiiDate(parent: XmlBuilder, name: string, value: string | undefined) {
  const formatted = value ? formatDate102(value) : "";

  if (!formatted) {
    return;
  }

  const dateNode = parent.ele(name);
  appendTextElement(dateNode, "udt:DateTimeString", formatted, {
    format: "102"
  });
  dateNode.up();
}

function appendCiiParty(parent: XmlBuilder, name: string, party: CiiPartyInput) {
  const partyNode = parent.ele(name);
  appendTextElement(partyNode, "ram:Name", party.name);

  if (party.legalName || party.taxRegistrationNumber) {
    const legalNode = partyNode.ele("ram:SpecifiedLegalOrganization");
    appendTextElement(legalNode, "ram:ID", party.taxRegistrationNumber);
    appendTextElement(legalNode, "ram:TradingBusinessName", party.legalName);
    legalNode.up();
  }

  if (party.phone || party.email) {
    const contactNode = partyNode.ele("ram:DefinedTradeContact");

    if (party.phone) {
      const phoneNode = contactNode.ele("ram:TelephoneUniversalCommunication");
      appendTextElement(phoneNode, "ram:CompleteNumber", party.phone);
      phoneNode.up();
    }

    if (party.email) {
      const emailNode = contactNode.ele("ram:EmailURIUniversalCommunication");
      appendTextElement(emailNode, "ram:URIID", party.email);
      emailNode.up();
    }

    contactNode.up();
  }

  if (party.electronicAddress) {
    const communicationNode = partyNode.ele("ram:URIUniversalCommunication");
    appendTextElement(
      communicationNode,
      "ram:URIID",
      party.electronicAddress,
      party.electronicAddressScheme
        ? { schemeID: party.electronicAddressScheme }
        : undefined
    );
    communicationNode.up();
  }

  const addressNode = partyNode.ele("ram:PostalTradeAddress");
  appendTextElement(addressNode, "ram:PostcodeCode", party.postalCode);
  appendTextElement(addressNode, "ram:LineOne", party.street);
  appendTextElement(addressNode, "ram:LineTwo", party.additionalStreet);
  appendTextElement(addressNode, "ram:CityName", party.city);
  appendTextElement(addressNode, "ram:CountrySubDivisionName", party.region);
  appendTextElement(addressNode, "ram:CountryID", party.country);
  addressNode.up();

  if (party.vatId) {
    const taxRegistrationNode = partyNode.ele("ram:SpecifiedTaxRegistration");
    appendTextElement(taxRegistrationNode, "ram:ID", party.vatId, {
      schemeID: "VA"
    });
    taxRegistrationNode.up();
  }

  partyNode.up();
}

function appendCiiLine(
  parent: XmlBuilder,
  line: ReturnType<typeof calculateInvoiceTotals>["lines"][number],
  originalLine: CanonicalInvoice["lines"][number],
  currency: string
) {
  const lineItem = parent.ele("ram:IncludedSupplyChainTradeLineItem");
  const lineDocument = lineItem.ele("ram:AssociatedDocumentLineDocument");
  appendTextElement(lineDocument, "ram:LineID", line.id || String(line.index + 1));
  lineDocument.up();

  const product = lineItem.ele("ram:SpecifiedTradeProduct");
  appendTextElement(product, "ram:Name", originalLine.itemName || line.description);
  appendTextElement(product, "ram:Description", line.description);
  product.up();

  const agreement = lineItem.ele("ram:SpecifiedLineTradeAgreement");
  const grossPrice = agreement.ele("ram:GrossPriceProductTradePrice");
  appendAmountElement(grossPrice, "ram:ChargeAmount", line.unitPrice, currency);
  grossPrice.up();
  const netPrice = agreement.ele("ram:NetPriceProductTradePrice");
  appendAmountElement(netPrice, "ram:ChargeAmount", line.unitPrice, currency);
  netPrice.up();
  agreement.up();

  const delivery = lineItem.ele("ram:SpecifiedLineTradeDelivery");
  appendTextElement(delivery, "ram:BilledQuantity", line.quantity, {
    unitCode: line.unitCode || "EA"
  });
  delivery.up();

  const settlement = lineItem.ele("ram:SpecifiedLineTradeSettlement");
  const tax = settlement.ele("ram:ApplicableTradeTax");
  appendAmountElement(tax, "ram:CalculatedAmount", line.taxAmount, currency);
  appendTextElement(tax, "ram:TypeCode", "VAT");
  appendTextElement(tax, "ram:CategoryCode", line.vatCategory || "S");
  appendTextElement(tax, "ram:RateApplicablePercent", line.vatRate);
  tax.up();

  const lineSummation = settlement.ele(
    "ram:SpecifiedTradeSettlementLineMonetarySummation"
  );
  appendAmountElement(lineSummation, "ram:LineTotalAmount", line.netAmount, currency);
  lineSummation.up();
  settlement.up();
  lineItem.up();
}

function appendPaymentTerms(
  parent: XmlBuilder,
  invoice: CanonicalInvoice,
  currency: string
) {
  const calculation = calculateInvoiceTotals(invoice);

  const settlement = parent.ele("ram:ApplicableHeaderTradeSettlement");
  appendTextElement(
    settlement,
    "ram:PaymentReference",
    invoice.payment?.paymentReference ?? ""
  );
  appendTextElement(settlement, "ram:InvoiceCurrencyCode", currency);

  for (const subtotal of calculation.taxBreakdown) {
    const tax = settlement.ele("ram:ApplicableTradeTax");
    appendAmountElement(tax, "ram:CalculatedAmount", subtotal.taxAmount, currency);
    appendTextElement(tax, "ram:TypeCode", subtotal.taxScheme || "VAT");
    appendAmountElement(tax, "ram:BasisAmount", subtotal.taxableAmount, currency);
    appendTextElement(tax, "ram:CategoryCode", subtotal.taxCategory || "S");
    appendTextElement(tax, "ram:RateApplicablePercent", subtotal.vatRate);
    appendTextElement(tax, "ram:ExemptionReason", subtotal.exemptionReason);
    appendTextElement(tax, "ram:ExemptionReasonCode", subtotal.exemptionReasonCode);
    tax.up();
  }

  const terms = invoice.payment?.terms || invoice.document.dueDate;

  if (terms || invoice.document.dueDate || invoice.payment?.dueDate) {
    const paymentTerms = settlement.ele("ram:SpecifiedTradePaymentTerms");
    appendTextElement(paymentTerms, "ram:Description", terms);
    appendCiiDate(
      paymentTerms,
      "ram:DueDateDateTime",
      invoice.payment?.dueDate || invoice.document.dueDate
    );
    paymentTerms.up();
  }

  const monetary = settlement.ele(
    "ram:SpecifiedTradeSettlementHeaderMonetarySummation"
  );
  appendAmountElement(
    monetary,
    "ram:LineTotalAmount",
    calculation.totals.lineExtensionAmount,
    currency
  );
  appendAmountElement(
    monetary,
    "ram:ChargeTotalAmount",
    calculation.totals.chargeTotalAmount,
    currency
  );
  appendAmountElement(
    monetary,
    "ram:AllowanceTotalAmount",
    calculation.totals.allowanceTotalAmount,
    currency
  );
  appendAmountElement(
    monetary,
    "ram:TaxBasisTotalAmount",
    calculation.totals.taxExclusiveAmount,
    currency
  );
  appendAmountElement(
    monetary,
    "ram:TaxTotalAmount",
    calculation.totals.taxAmount,
    currency
  );
  appendAmountElement(
    monetary,
    "ram:GrandTotalAmount",
    calculation.totals.taxInclusiveAmount,
    currency
  );
  appendAmountElement(
    monetary,
    "ram:TotalPrepaidAmount",
    calculation.totals.prepaidAmount,
    currency
  );
  appendAmountElement(
    monetary,
    "ram:DuePayableAmount",
    calculation.totals.payableAmount,
    currency
  );
  monetary.up();
  settlement.up();
}

export function buildCiiExportFindings(invoice: CanonicalInvoice) {
  const findings: ValidationFinding[] = [
    makeCiiFinding({
      code: "CII_TECHNICAL_MAPPING_LIMITED",
      severity: "warning",
      fieldPath: "invoice",
      message:
        "CII export is a technical UN/CEFACT CII-style sandbox mapping through Invoice Lantern's canonical invoice model, not official CII, EN 16931, Peppol, legal, tax, accounting, filing, or authority validation.",
      fixSuggestion:
        "Use the generated XML for technical readiness review and obtain professional review before production or authority-facing use.",
      legalConfidence: "professional_review_required"
    })
  ];

  if (invoice.allowances.length > 0 || invoice.charges.length > 0) {
    findings.push(
      makeCiiFinding({
        code: "CII_DOCUMENT_ADJUSTMENTS_LIMITED",
        severity: "warning",
        fieldPath: "allowances",
        message:
          "Document-level allowances and charges affect calculated totals but are not fully expanded into every possible CII adjustment structure in this technical export step.",
        fixSuggestion:
          "Review allowances and charges in the generated XML before relying on downstream technical workflows.",
        legalConfidence: "professional_review_required"
      })
    );
  }

  if (invoice.delivery) {
    findings.push(
      makeCiiFinding({
        code: "CII_DELIVERY_MAPPING_LIMITED",
        severity: "info",
        fieldPath: "delivery",
        message:
          "Delivery details are only partially represented in this technical CII-style mapping.",
        fixSuggestion:
          "Review delivery fields before treating the XML as complete for an external workflow.",
        legalConfidence: "professional_review_required"
      })
    );
  }

  return findings;
}

export function canonicalToCiiInvoiceXml(invoice: CanonicalInvoice): string {
  const canonicalInvoice = canonicalInvoiceSchema.parse(invoice);
  const calculation = calculateInvoiceTotals(canonicalInvoice);
  const currency = canonicalInvoice.document.currency;
  const documentType = canonicalInvoice.document.type;

  const root = create({
    version: "1.0",
    encoding: "UTF-8"
  }).ele("rsm:CrossIndustryInvoice", {
    "xmlns:rsm": CII_CROSS_INDUSTRY_INVOICE_NAMESPACE,
    "xmlns:ram": CII_RAM_NAMESPACE,
    "xmlns:udt": CII_UDT_NAMESPACE,
    "xmlns:qdt": CII_QDT_NAMESPACE,
    "xmlns:xsi": CII_XSI_NAMESPACE
  });

  const context = root.ele("rsm:ExchangedDocumentContext");
  const guideline = context.ele("ram:GuidelineSpecifiedDocumentContextParameter");
  appendTextElement(guideline, "ram:ID", CII_EXPORT_CUSTOMIZATION_ID);
  guideline.up();
  context.up();

  const exchangedDocument = root.ele("rsm:ExchangedDocument");
  appendTextElement(exchangedDocument, "ram:ID", canonicalInvoice.document.number);
  appendTextElement(
    exchangedDocument,
    "ram:TypeCode",
    documentType === "credit_note" ? "381" : "380"
  );
  appendCiiDate(
    exchangedDocument,
    "ram:IssueDateTime",
    canonicalInvoice.document.issueDate
  );
  exchangedDocument.up();

  const transaction = root.ele("rsm:SupplyChainTradeTransaction");

  for (const [index, line] of calculation.lines.entries()) {
    const originalLine = canonicalInvoice.lines[index];

    if (!originalLine) {
      continue;
    }

    appendCiiLine(transaction, line, originalLine, currency);
  }

  const agreement = transaction.ele("ram:ApplicableHeaderTradeAgreement");
  appendTextElement(
    agreement,
    "ram:BuyerReference",
    canonicalInvoice.document.buyerReference
  );
  appendCiiParty(agreement, "ram:SellerTradeParty", normalizeParty(canonicalInvoice.seller));
  appendCiiParty(agreement, "ram:BuyerTradeParty", normalizeParty(canonicalInvoice.buyer));
  agreement.up();

  if (canonicalInvoice.delivery?.deliveryDate || canonicalInvoice.delivery?.country) {
    const delivery = transaction.ele("ram:ApplicableHeaderTradeDelivery");
    appendCiiDate(
      delivery,
      "ram:ActualDeliverySupplyChainEvent",
      canonicalInvoice.delivery.deliveryDate
    );
    delivery.up();
  }

  appendPaymentTerms(transaction, canonicalInvoice, currency);

  transaction.up();

  return root.end({
    prettyPrint: true
  });
}

function extractParty(partyNode: unknown): CiiPartyInput {
  const addressNode = getFirstChildNode(partyNode, "PostalTradeAddress");
  const uriNode = getFirstChildNode(
    getFirstChildNode(partyNode, "URIUniversalCommunication"),
    "URIID"
  );
  const taxRegistrationNodes = getChildNodes(partyNode, "SpecifiedTaxRegistration");
  const vatRegistrationNode =
    taxRegistrationNodes.find((node) => {
      const idNode = getFirstChildNode(node, "ID");

      return getAttribute(idNode, "schemeID").toUpperCase() === "VA";
    }) ?? taxRegistrationNodes[0];
  const legalNode = getFirstChildNode(partyNode, "SpecifiedLegalOrganization");
  const contactNode = getFirstChildNode(partyNode, "DefinedTradeContact");

  return {
    name: normalizeText(getFirstChildText(partyNode, "Name"), 160),
    legalName: normalizeText(
      getFirstChildText(legalNode, "TradingBusinessName"),
      240
    ),
    country: normalizeCode(getFirstChildText(addressNode, "CountryID"), 2),
    vatId: normalizeCode(getFirstChildText(vatRegistrationNode, "ID"), 32),
    taxRegistrationNumber: normalizeText(getFirstChildText(legalNode, "ID"), 120),
    city: normalizeText(getFirstChildText(addressNode, "CityName"), 120),
    postalCode: normalizeText(getFirstChildText(addressNode, "PostcodeCode"), 32),
    street: normalizeText(getFirstChildText(addressNode, "LineOne"), 180),
    additionalStreet: normalizeText(getFirstChildText(addressNode, "LineTwo"), 180),
    region: normalizeText(
      getFirstChildText(addressNode, "CountrySubDivisionName"),
      120
    ),
    electronicAddress: normalizeText(nodeToText(uriNode), 160),
    electronicAddressScheme: normalizeText(getAttribute(uriNode, "schemeID"), 40),
    email: normalizeText(
      getFirstDescendantText(contactNode, "URIID"),
      320
    ),
    phone: normalizeText(
      getFirstDescendantText(contactNode, "CompleteNumber"),
      80
    )
  };
}

function partyToCanonical(party: CiiPartyInput) {
  return {
    name: party.name,
    legalName: party.legalName,
    country: party.country,
    vatId: party.vatId,
    taxRegistrationNumber: party.taxRegistrationNumber,
    electronicAddress: party.electronicAddress,
    electronicAddressScheme: party.electronicAddressScheme,
    email: party.email,
    phone: party.phone,
    address: {
      street: party.street,
      additionalStreet: party.additionalStreet,
      city: party.city,
      postalCode: party.postalCode,
      region: party.region,
      country: party.country
    },
    city: party.city,
    postalCode: party.postalCode,
    street: party.street,
    additionalStreet: party.additionalStreet,
    region: party.region
  };
}

function extractCiiLine(lineNode: unknown, index: number) {
  const documentNode = getFirstChildNode(lineNode, "AssociatedDocumentLineDocument");
  const productNode = getFirstChildNode(lineNode, "SpecifiedTradeProduct");
  const agreementNode = getFirstChildNode(lineNode, "SpecifiedLineTradeAgreement");
  const deliveryNode = getFirstChildNode(lineNode, "SpecifiedLineTradeDelivery");
  const settlementNode = getFirstChildNode(lineNode, "SpecifiedLineTradeSettlement");
  const netPriceNode =
    getFirstChildNode(agreementNode, "NetPriceProductTradePrice") ??
    getFirstChildNode(agreementNode, "GrossPriceProductTradePrice");
  const quantityNode = getFirstChildNode(deliveryNode, "BilledQuantity");
  const taxNode = getFirstChildNode(settlementNode, "ApplicableTradeTax");
  const summationNode = getFirstChildNode(
    settlementNode,
    "SpecifiedTradeSettlementLineMonetarySummation"
  );
  const lineId = normalizeText(getFirstChildText(documentNode, "LineID"), 80);
  const description =
    normalizeText(getFirstChildText(productNode, "Description"), 1000) ||
    normalizeText(getFirstChildText(productNode, "Name"), 1000);

  return {
    id: lineId || String(index + 1),
    description,
    itemName: normalizeText(getFirstChildText(productNode, "Name"), 240),
    quantity: normalizeText(nodeToText(quantityNode), 80) || "0",
    unitCode: normalizeCode(getAttribute(quantityNode, "unitCode") || "EA", 24),
    unitPrice: normalizeText(getFirstChildText(netPriceNode, "ChargeAmount"), 80) || "0",
    netAmount:
      normalizeText(getFirstChildText(summationNode, "LineTotalAmount"), 80) ||
      undefined,
    taxAmount:
      normalizeText(getFirstChildText(taxNode, "CalculatedAmount"), 80) ||
      undefined,
    vatCategory: normalizeCode(getFirstChildText(taxNode, "CategoryCode"), 40),
    vatRate: normalizeText(getFirstChildText(taxNode, "RateApplicablePercent"), 80) || "0"
  };
}

function extractTaxBreakdown(settlementNode: unknown) {
  return getChildNodes(settlementNode, "ApplicableTradeTax").map((taxNode) => ({
    taxCategory: normalizeCode(getFirstChildText(taxNode, "CategoryCode"), 40),
    taxScheme: normalizeCode(getFirstChildText(taxNode, "TypeCode") || "VAT", 40),
    vatCategory: normalizeCode(getFirstChildText(taxNode, "CategoryCode"), 40),
    vatRate:
      normalizeText(getFirstChildText(taxNode, "RateApplicablePercent"), 80) ||
      "0",
    taxableAmount: normalizeText(getFirstChildText(taxNode, "BasisAmount"), 80),
    taxAmount: normalizeText(getFirstChildText(taxNode, "CalculatedAmount"), 80),
    exemptionReason: normalizeText(getFirstChildText(taxNode, "ExemptionReason"), 500),
    exemptionReasonCode: normalizeText(
      getFirstChildText(taxNode, "ExemptionReasonCode"),
      80
    )
  }));
}

function extractTotals(settlementNode: unknown) {
  const monetaryNode = getFirstChildNode(
    settlementNode,
    "SpecifiedTradeSettlementHeaderMonetarySummation"
  );

  return {
    lineExtensionAmount: normalizeText(
      getFirstChildText(monetaryNode, "LineTotalAmount"),
      80
    ),
    allowanceTotalAmount: normalizeText(
      getFirstChildText(monetaryNode, "AllowanceTotalAmount"),
      80
    ),
    chargeTotalAmount: normalizeText(
      getFirstChildText(monetaryNode, "ChargeTotalAmount"),
      80
    ),
    taxExclusiveAmount: normalizeText(
      getFirstChildText(monetaryNode, "TaxBasisTotalAmount"),
      80
    ),
    taxAmount: normalizeText(getFirstChildText(monetaryNode, "TaxTotalAmount"), 80),
    taxTotalAmount: normalizeText(
      getFirstChildText(monetaryNode, "TaxTotalAmount"),
      80
    ),
    taxInclusiveAmount: normalizeText(
      getFirstChildText(monetaryNode, "GrandTotalAmount"),
      80
    ),
    prepaidAmount: normalizeText(
      getFirstChildText(monetaryNode, "TotalPrepaidAmount"),
      80
    ),
    payableAmount: normalizeText(
      getFirstChildText(monetaryNode, "DuePayableAmount"),
      80
    )
  };
}

function getSafeSampleIds(nodes: unknown[]) {
  return nodes
    .map((node) => normalizeText(getFirstDescendantText(node, "ID"), 80))
    .filter(Boolean)
    .slice(0, UNSUPPORTED_FIELD_SAMPLE_LIMIT);
}

function summarizeUnsupportedField(input: {
  field: string;
  nodes: unknown[];
  note: string;
}): UnsupportedCiiFieldMetadata | null {
  if (input.nodes.length === 0) {
    return null;
  }

  const sampleIds = getSafeSampleIds(input.nodes);
  const summary: UnsupportedCiiFieldMetadata = {
    field: input.field,
    count: input.nodes.length,
    note: input.note
  };

  if (sampleIds.length > 0) {
    summary.sampleIds = sampleIds;
  }

  return summary;
}

function collectUnsupportedCiiFields(rootNode: unknown) {
  const unsupportedFields = [
    summarizeUnsupportedField({
      field: "AdditionalReferencedDocument",
      nodes: collectDescendantNodes(rootNode, "AdditionalReferencedDocument", 20),
      note:
        "Additional referenced documents are detected and preserved as safe parser metadata only in this step."
    }),
    summarizeUnsupportedField({
      field: "SpecifiedLogisticsServiceCharge",
      nodes: collectDescendantNodes(rootNode, "SpecifiedLogisticsServiceCharge", 20),
      note:
        "Logistics service charges are not normalized into a dedicated canonical charge model by this CII parser step."
    }),
    summarizeUnsupportedField({
      field: "SellerOrderReferencedDocument",
      nodes: collectDescendantNodes(rootNode, "SellerOrderReferencedDocument", 20),
      note:
        "Order references are only partially mapped through the canonical invoice document references."
    }),
    summarizeUnsupportedField({
      field: "ApplicableTradeDeliveryTerms",
      nodes: collectDescendantNodes(rootNode, "ApplicableTradeDeliveryTerms", 20),
      note:
        "Trade delivery terms are detected but not represented as fully supported canonical fields."
    })
  ].filter((item): item is UnsupportedCiiFieldMetadata => item !== null);

  const findings = unsupportedFields.map((field) =>
    makeCiiFinding({
      code: "CII_UNSUPPORTED_FIELD_DETECTED",
      severity: "warning",
      fieldPath: `metadata.ciiUnsupportedFields.${field.field}`,
      message: `${field.field} was detected in the CII XML and preserved as safe metadata instead of being represented as a fully supported canonical field.`,
      fixSuggestion:
        "Review this field before relying on the canonical preview for downstream technical workflows.",
      legalConfidence: "professional_review_required"
    })
  );

  return {
    unsupportedFields,
    findings
  };
}

function buildDetected(input: {
  documentType: CiiDocumentType;
  rootName: string;
  profileId?: string;
  customizationId?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  seller?: CiiPartyInput;
  buyer?: CiiPartyInput;
  lineCount?: number;
  unsupportedFieldCount?: number;
}): CiiParseResult["detected"] {
  const detected: Record<string, unknown> = {
    documentType: input.documentType,
    rootName: input.rootName
  };

  addOptionalText(detected, "profileId", input.profileId ?? "");
  addOptionalText(detected, "customizationId", input.customizationId ?? "");
  addOptionalText(detected, "invoiceNumber", input.invoiceNumber ?? "");
  addOptionalText(detected, "issueDate", input.issueDate ?? "");
  addOptionalText(detected, "dueDate", input.dueDate ?? "");
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

  return detected as CiiParseResult["detected"];
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

export function ciiInvoiceXmlToCanonicalInvoice(
  xml: string,
  options: CiiParseOptions = {}
): CiiParseResult {
  const rootName = detectRootName(xml);
  const documentType = detectCiiDocumentType(xml);
  const safety = inspectCiiXmlSafety(xml, options);
  const baseDetected = buildDetected({
    documentType,
    rootName
  });

  if (!safety.safe) {
    return {
      ok: false,
      detected: baseDetected,
      findings: [
        makeCiiFinding({
          code: safety.code ?? "XML_UNSAFE",
          severity: "blocked",
          fieldPath: "xml",
          message: safety.message,
          fixSuggestion:
            "Remove blocked XML constructs and retry with a safe CII XML document."
        })
      ],
      disclaimer: CII_TECHNICAL_DISCLAIMER
    };
  }

  if (rootName !== "CrossIndustryInvoice") {
    return {
      ok: false,
      detected: baseDetected,
      findings: [
        makeCiiFinding({
          code: "CII_UNKNOWN_DOCUMENT_ROOT",
          severity: "blocked",
          fieldPath: "xml.root",
          message:
            "The XML root is not rsm:CrossIndustryInvoice and cannot be parsed as technical CII XML.",
          fixSuggestion:
            "Provide a UN/CEFACT CII-style CrossIndustryInvoice XML document."
        })
      ],
      disclaimer: CII_TECHNICAL_DISCLAIMER
    };
  }

  const wellFormed = XMLValidator.validate(xml);

  if (wellFormed !== true) {
    return {
      ok: false,
      detected: baseDetected,
      findings: [
        makeCiiFinding({
          code: "CII_XML_NOT_WELL_FORMED",
          severity: "blocked",
          fieldPath: "xml",
          message: getXmlValidationErrorMessage(wellFormed),
          fixSuggestion: "Fix the XML syntax before parsing."
        })
      ],
      disclaimer: CII_TECHNICAL_DISCLAIMER
    };
  }

  const parsed = ciiParser.parse(xml) as Record<string, unknown>;
  const rootNode =
    parsed.CrossIndustryInvoice ??
    getFirstChildNode(parsed, "CrossIndustryInvoice") ??
    parsed;
  const documentContextNode = getFirstChildNode(
    rootNode,
    "ExchangedDocumentContext"
  );
  const guidelineNode = getFirstChildNode(
    documentContextNode,
    "GuidelineSpecifiedDocumentContextParameter"
  );
  const exchangedDocumentNode = getFirstChildNode(rootNode, "ExchangedDocument");
  const transactionNode = getFirstChildNode(
    rootNode,
    "SupplyChainTradeTransaction"
  );
  const agreementNode = getFirstChildNode(
    transactionNode,
    "ApplicableHeaderTradeAgreement"
  );
  const settlementNode = getFirstChildNode(
    transactionNode,
    "ApplicableHeaderTradeSettlement"
  );
  const paymentTermsNode = getFirstChildNode(
    settlementNode,
    "SpecifiedTradePaymentTerms"
  );
  const seller = extractParty(getFirstChildNode(agreementNode, "SellerTradeParty"));
  const buyer = extractParty(getFirstChildNode(agreementNode, "BuyerTradeParty"));
  const lineNodes = getChildNodes(
    transactionNode,
    "IncludedSupplyChainTradeLineItem"
  );
  const lines = lineNodes.map((lineNode, index) =>
    extractCiiLine(lineNode, index)
  );
  const unsupported = collectUnsupportedCiiFields(rootNode);
  const invoiceNumber = normalizeText(
    getFirstChildText(exchangedDocumentNode, "ID"),
    80
  );
  const issueDate = getCiiDate(getFirstChildNode(exchangedDocumentNode, "IssueDateTime"));
  const dueDate = getCiiDate(getFirstChildNode(paymentTermsNode, "DueDateDateTime"));
  const currency = normalizeCode(
    getFirstChildText(settlementNode, "InvoiceCurrencyCode"),
    3
  );
  const customizationId = normalizeText(getFirstChildText(guidelineNode, "ID"), 240);
  const profileId = CII_EXPORT_PROFILE_ID;
  const taxBreakdown = extractTaxBreakdown(settlementNode);
  const totals = extractTotals(settlementNode);
  const detected = buildDetected({
    documentType,
    rootName,
    profileId,
    customizationId,
    invoiceNumber,
    issueDate,
    dueDate,
    currency,
    seller,
    buyer,
    lineCount: lines.length,
    unsupportedFieldCount: unsupported.unsupportedFields.length
  });
  const invoiceInput = {
    profile: "EN16931",
    document: {
      type: documentType === "credit_note" ? "credit_note" : "invoice",
      number: invoiceNumber,
      issueDate,
      dueDate,
      currency,
      profile: "EN16931"
    },
    seller: partyToCanonical(seller),
    buyer: partyToCanonical(buyer),
    payment: {
      terms: normalizeText(getFirstChildText(paymentTermsNode, "Description"), 2000),
      dueDate
    },
    lines,
    taxBreakdown,
    taxSubtotals: taxBreakdown,
    totals,
    metadata: {
      source: "cii_import",
      ciiDocumentType: documentType,
      ciiCustomizationId: customizationId,
      ciiProfileId: profileId,
      ciiUnsupportedFields: unsupported.unsupportedFields
    },
    legal: {
      legalConfidence: "technical",
      disclaimer: CII_TECHNICAL_DISCLAIMER
    }
  };
  const parsedCanonical = canonicalInvoiceSchema.safeParse(invoiceInput);
  const findings = mergeFindings([
    makeCiiFinding({
      code: "CII_TECHNICAL_MAPPING_LIMITED",
      severity: "warning",
      fieldPath: "invoice",
      message:
        "CII parsing maps supported technical XML fields into Invoice Lantern's canonical invoice model. Parse success is not official CII validation, EN 16931 certification, Peppol certification, legal advice, tax advice, accounting advice, filing, or authority acceptance.",
      fixSuggestion:
        "Review parser findings and obtain professional review before relying on imported data.",
      legalConfidence: "professional_review_required"
    }),
    ...unsupported.findings,
    ...(parsedCanonical.success
      ? buildCoreValidationFindings(parsedCanonical.data)
      : parsedCanonical.error.issues.map((issue) =>
          makeCiiFinding({
            code: "CII_CANONICAL_SCHEMA_INVALID",
            severity: "blocked",
            fieldPath: issue.path.join(".") || "invoice",
            message: issue.message,
            fixSuggestion:
              "Review the source CII XML and add the missing canonical invoice field before import."
          })
        ))
  ]);

  if (!parsedCanonical.success) {
    return {
      ok: false,
      detected,
      findings,
      disclaimer: CII_TECHNICAL_DISCLAIMER
    };
  }

  return {
    ok: true,
    invoice: parsedCanonical.data,
    detected,
    findings,
    disclaimer: CII_TECHNICAL_DISCLAIMER
  };
}

export const canonicalToCiiXml = canonicalToCiiInvoiceXml;
