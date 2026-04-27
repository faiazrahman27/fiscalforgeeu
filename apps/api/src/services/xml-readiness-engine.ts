import { XMLParser, XMLValidator } from "fast-xml-parser";

export type XmlFindingSeverity = "info" | "warning" | "fatal";

export type XmlProfileStatus =
  | "ubl_surface_check"
  | "peppol_bis_signal"
  | "en16931_signal"
  | "unknown_profile";

export type XmlReadinessFinding = {
  code: string;
  severity: XmlFindingSeverity;
  field: string;
  message: string;
  confidence: "technical" | "readiness_simulation" | "review_required";
};

export type XmlProfileSignal = {
  customizationId: string;
  profileId: string;
  profileHints: string[];
  ublNamespaceDetected: boolean;
  ublDocumentDetected: boolean;
  peppolSignalDetected: boolean;
  en16931SignalDetected: boolean;
  endpointCount: number;
  sellerEndpointId: string;
  sellerEndpointScheme: string;
  buyerEndpointId: string;
  buyerEndpointScheme: string;
  sellerCountry: string;
  buyerCountry: string;
  countryPair: string;
  crossBorderSignal: boolean;
  taxCategoryCodes: string[];
  vatPercentValues: string[];
  paymentMeansDetected: boolean;
  paymentTermsDetected: boolean;
  allowanceChargeDetected: boolean;
};

export type XmlExtractedData = {
  sellerName: string;
  buyerName: string;
  lineCount: number;
  invoiceLineCount: number;
  creditNoteLineCount: number;
  currency: string;
  monetaryTotals: {
    lineExtensionAmount: string;
    taxExclusiveAmount: string;
    taxAmount: string;
    taxInclusiveAmount: string;
    payableAmount: string;
  };
  taxSignal: {
    taxTotalDetected: boolean;
    taxSubtotalDetected: boolean;
    taxCategoryDetected: boolean;
    taxRateCount: number;
  };
  profileSignal: XmlProfileSignal;
};

export type XmlReadinessReport = {
  technicalStatus: "passed" | "failed";
  readinessStatus: "ready_for_review" | "needs_attention" | "unsupported";
  documentStatus: "recognized" | "unsupported";
  calculationStatus: "not_checked" | "surface_checked" | "inconsistent";
  profileStatus: XmlProfileStatus;
  extractedData: XmlExtractedData;
  findings: XmlReadinessFinding[];
};

export type XmlReadinessInspection = {
  rootElement: string;
  detectedDocument: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
  report: XmlReadinessReport;
};

export type XmlUploadSummaryShape = {
  technicalStatus: "passed" | "failed";
  readinessStatus: "ready_for_review" | "needs_attention" | "unsupported";
  findingsCount: number;
  sellerName: string;
  buyerName: string;
  lineCount: number;
  payableAmount: string;
  taxAmount: string;
  currency: string;
};

type XmlParserContext = {
  xml: string;
  parsedXml: unknown;
  rootElement: string;
  isWellFormed: boolean;
  parserErrorMessage: string;
};

const parser = new XMLParser({
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

function detectRootElement(xml: string) {
  const match = xml.match(/<([A-Za-z_][\w:.-]*)(\s|>)/);
  const rawRoot = match?.[1] ?? "unknown";

  return rawRoot.includes(":") ? rawRoot.split(":").pop() ?? rawRoot : rawRoot;
}

function detectDocumentType(rootElement: string) {
  const normalized = rootElement.toLowerCase();

  if (normalized.includes("creditnote")) {
    return "credit_note";
  }

  if (normalized.includes("invoice")) {
    return "invoice";
  }

  return "unknown";
}

function getValidationErrorMessage(result: unknown) {
  if (result === true) {
    return "";
  }

  if (isPlainObject(result) && isPlainObject(result.err)) {
    const message = result.err.msg;

    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim().slice(0, 240);
    }
  }

  return "XML parser reported a well-formedness error.";
}

function buildXmlParserContext(xml: string): XmlParserContext {
  const validationResult = XMLValidator.validate(xml);
  const isWellFormed = validationResult === true;
  const rootElement = detectRootElement(xml);

  if (!isWellFormed) {
    return {
      xml,
      parsedXml: {},
      rootElement,
      isWellFormed: false,
      parserErrorMessage: getValidationErrorMessage(validationResult)
    };
  }

  try {
    return {
      xml,
      parsedXml: parser.parse(xml) as unknown,
      rootElement,
      isWellFormed: true,
      parserErrorMessage: ""
    };
  } catch (error) {
    return {
      xml,
      parsedXml: {},
      rootElement,
      isWellFormed: false,
      parserErrorMessage:
        error instanceof Error
          ? error.message.slice(0, 240)
          : "XML parser failed to parse the uploaded XML."
    };
  }
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

function getFirstChildText(parent: unknown, tagName: string, maxLength = 240) {
  const text = nodeToText(getFirstChildNode(parent, tagName));

  return text ? text.slice(0, maxLength) : "not_detected";
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

function getRootNode(context: XmlParserContext) {
  if (!isPlainObject(context.parsedXml)) {
    return undefined;
  }

  const directRoot = context.parsedXml[context.rootElement];

  if (directRoot !== undefined) {
    return Array.isArray(directRoot) ? directRoot[0] : directRoot;
  }

  const firstDocumentEntry = Object.entries(context.parsedXml).find(([key]) => {
    return !key.startsWith("?") && !key.startsWith("@_");
  });

  const value = firstDocumentEntry?.[1];

  return Array.isArray(value) ? value[0] : value;
}

function hasTag(context: XmlParserContext, tagName: string) {
  return collectDescendantNodes(context.parsedXml, tagName, 1).length > 0;
}

function countTags(context: XmlParserContext, tagName: string) {
  return collectDescendantNodes(context.parsedXml, tagName, 500).length;
}

function extractFirstTagValue(
  context: XmlParserContext,
  tagName: string,
  maxLength = 240
) {
  const firstNode = collectDescendantNodes(context.parsedXml, tagName, 1)[0];
  const text = nodeToText(firstNode);

  return text ? text.slice(0, maxLength) : "not_detected";
}

function extractDocumentField(context: XmlParserContext, tagName: string) {
  const rootNode = getRootNode(context);
  const directValue = getFirstChildText(rootNode, tagName);

  if (directValue !== "not_detected") {
    return directValue;
  }

  return extractFirstTagValue(context, tagName);
}

function extractAllTagValues(
  context: XmlParserContext,
  tagName: string,
  maxResults = 30
) {
  return collectDescendantNodes(context.parsedXml, tagName, maxResults)
    .map((node) => nodeToText(node).slice(0, 180))
    .filter(Boolean);
}

function getAttributeValue(node: unknown, attributeName: string) {
  if (!isPlainObject(node)) {
    return "not_detected";
  }

  const directValue = node[`@_${attributeName}`] ?? node[attributeName];

  if (typeof directValue === "string" && directValue.trim().length > 0) {
    return directValue.trim().slice(0, 180);
  }

  if (typeof directValue === "number" || typeof directValue === "boolean") {
    return String(directValue);
  }

  return "not_detected";
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter((value) => value && value !== "not_detected"))];
}

function extractFirstDescendantText(parent: unknown, tagName: string) {
  const firstNode = collectDescendantNodes(parent, tagName, 1)[0];
  const text = nodeToText(firstNode);

  return text ? text.slice(0, 240) : "not_detected";
}

function extractPartyNode(context: XmlParserContext, partyBlockTag: string) {
  return collectDescendantNodes(context.parsedXml, partyBlockTag, 1)[0];
}

function extractPartyName(context: XmlParserContext, partyBlockTag: string) {
  const partyBlock = extractPartyNode(context, partyBlockTag);

  if (!partyBlock) {
    return "not_detected";
  }

  const partyNameBlock = collectDescendantNodes(partyBlock, "PartyName", 1)[0];

  if (partyNameBlock) {
    const nameFromPartyName = extractFirstDescendantText(partyNameBlock, "Name");

    if (nameFromPartyName !== "not_detected") {
      return nameFromPartyName;
    }
  }

  const partyLegalEntityBlock = collectDescendantNodes(
    partyBlock,
    "PartyLegalEntity",
    1
  )[0];

  if (partyLegalEntityBlock) {
    const registrationName = extractFirstDescendantText(
      partyLegalEntityBlock,
      "RegistrationName"
    );

    if (registrationName !== "not_detected") {
      return registrationName;
    }
  }

  return extractFirstDescendantText(partyBlock, "Name");
}

function extractPartyEndpointId(
  context: XmlParserContext,
  partyBlockTag: string
) {
  const partyBlock = extractPartyNode(context, partyBlockTag);

  if (!partyBlock) {
    return "not_detected";
  }

  return extractFirstDescendantText(partyBlock, "EndpointID");
}

function extractPartyEndpointScheme(
  context: XmlParserContext,
  partyBlockTag: string
) {
  const partyBlock = extractPartyNode(context, partyBlockTag);

  if (!partyBlock) {
    return "not_detected";
  }

  const endpointNode = collectDescendantNodes(partyBlock, "EndpointID", 1)[0];

  return getAttributeValue(endpointNode, "schemeID");
}

function extractPartyCountryCode(
  context: XmlParserContext,
  partyBlockTag: string
) {
  const partyBlock = extractPartyNode(context, partyBlockTag);

  if (!partyBlock) {
    return "not_detected";
  }

  const countryBlock = collectDescendantNodes(partyBlock, "Country", 1)[0];

  if (!countryBlock) {
    return "not_detected";
  }

  return extractFirstDescendantText(countryBlock, "IdentificationCode");
}

function extractTaxCategoryCodes(context: XmlParserContext) {
  const taxCategoryBlocks = collectDescendantNodes(
    context.parsedXml,
    "TaxCategory",
    40
  );

  return uniqueValues(
    taxCategoryBlocks.map((block) => getFirstChildText(block, "ID", 180))
  );
}

function extractVatPercentValues(context: XmlParserContext) {
  return uniqueValues(extractAllTagValues(context, "Percent", 40));
}

function extractMonetaryTotal(context: XmlParserContext, tagName: string) {
  const legalTotalBlock = collectDescendantNodes(
    context.parsedXml,
    "LegalMonetaryTotal",
    1
  )[0];

  if (legalTotalBlock) {
    const valueInsideLegalTotal = getFirstChildText(legalTotalBlock, tagName);

    if (valueInsideLegalTotal !== "not_detected") {
      return valueInsideLegalTotal;
    }
  }

  return extractFirstTagValue(context, tagName);
}

function extractTaxAmount(context: XmlParserContext) {
  const taxTotalBlock = collectDescendantNodes(context.parsedXml, "TaxTotal", 1)[0];

  if (!taxTotalBlock) {
    return "not_detected";
  }

  return getFirstChildText(taxTotalBlock, "TaxAmount");
}

function parseMoney(value: string) {
  if (value === "not_detected") {
    return null;
  }

  const normalized = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalized || normalized === "." || normalized === "-" || normalized === "-.") {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function valuesApproximatelyEqual(first: number, second: number) {
  return Math.abs(first - second) <= 0.02;
}

function hasUblNamespaceSignal(context: XmlParserContext) {
  return (
    /urn:oasis:names:specification:ubl:schema:xsd:(Invoice|CreditNote)-2/i.test(
      context.xml
    ) ||
    /urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2/i.test(
      context.xml
    ) ||
    /urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2/i.test(
      context.xml
    )
  );
}

function pushMissingTagFinding(
  findings: XmlReadinessFinding[],
  context: XmlParserContext,
  tagName: string,
  field: string,
  label: string,
  severity: XmlFindingSeverity = "warning"
) {
  if (hasTag(context, tagName)) {
    return;
  }

  findings.push({
    code: `${tagName.toUpperCase()}_MISSING`,
    severity,
    field,
    message: `${label} was not detected in the uploaded XML.`,
    confidence: "readiness_simulation"
  });
}

function pushExtractedInfoFinding(
  findings: XmlReadinessFinding[],
  code: string,
  field: string,
  message: string
) {
  findings.push({
    code,
    severity: "info",
    field,
    message,
    confidence: "technical"
  });
}

function buildProfileSignal(
  context: XmlParserContext,
  detectedDocument: string
): XmlProfileSignal {
  const customizationId = extractDocumentField(context, "CustomizationID");
  const profileId = extractDocumentField(context, "ProfileID");
  const normalizedProfileText = `${customizationId} ${profileId}`.toLowerCase();

  const ublNamespaceDetected = hasUblNamespaceSignal(context);
  const ublDocumentDetected =
    detectedDocument !== "unknown" &&
    (ublNamespaceDetected ||
      hasTag(context, "AccountingSupplierParty") ||
      hasTag(context, "AccountingCustomerParty"));

  const peppolSignalDetected =
    normalizedProfileText.includes("peppol") ||
    normalizedProfileText.includes("bis") ||
    normalizedProfileText.includes("urn:fdc:peppol.eu");

  const en16931SignalDetected =
    normalizedProfileText.includes("en16931") ||
    normalizedProfileText.includes("en 16931") ||
    normalizedProfileText.includes("urn:cen.eu:en16931") ||
    normalizedProfileText.includes("cius");

  const sellerCountry = extractPartyCountryCode(
    context,
    "AccountingSupplierParty"
  );
  const buyerCountry = extractPartyCountryCode(context, "AccountingCustomerParty");

  const countryPair =
    sellerCountry !== "not_detected" || buyerCountry !== "not_detected"
      ? `${sellerCountry} -> ${buyerCountry}`
      : "not_detected";

  const crossBorderSignal =
    sellerCountry !== "not_detected" &&
    buyerCountry !== "not_detected" &&
    sellerCountry.toUpperCase() !== buyerCountry.toUpperCase();

  const profileHints: string[] = [];

  if (ublDocumentDetected) {
    profileHints.push("UBL document parser signal");
  }

  if (peppolSignalDetected) {
    profileHints.push("Peppol BIS profile signal");
  }

  if (en16931SignalDetected) {
    profileHints.push("EN 16931 profile signal");
  }

  if (crossBorderSignal) {
    profileHints.push("Cross-border party signal");
  }

  return {
    customizationId,
    profileId,
    profileHints,
    ublNamespaceDetected,
    ublDocumentDetected,
    peppolSignalDetected,
    en16931SignalDetected,
    endpointCount: countTags(context, "EndpointID"),
    sellerEndpointId: extractPartyEndpointId(context, "AccountingSupplierParty"),
    sellerEndpointScheme: extractPartyEndpointScheme(
      context,
      "AccountingSupplierParty"
    ),
    buyerEndpointId: extractPartyEndpointId(context, "AccountingCustomerParty"),
    buyerEndpointScheme: extractPartyEndpointScheme(
      context,
      "AccountingCustomerParty"
    ),
    sellerCountry,
    buyerCountry,
    countryPair,
    crossBorderSignal,
    taxCategoryCodes: extractTaxCategoryCodes(context),
    vatPercentValues: extractVatPercentValues(context),
    paymentMeansDetected: hasTag(context, "PaymentMeans"),
    paymentTermsDetected: hasTag(context, "PaymentTerms"),
    allowanceChargeDetected: hasTag(context, "AllowanceCharge")
  };
}

function determineProfileStatus(
  detectedDocument: string,
  profileSignal: XmlProfileSignal
): XmlProfileStatus {
  if (detectedDocument === "unknown") {
    return "unknown_profile";
  }

  if (profileSignal.peppolSignalDetected) {
    return "peppol_bis_signal";
  }

  if (profileSignal.en16931SignalDetected) {
    return "en16931_signal";
  }

  if (profileSignal.ublDocumentDetected) {
    return "ubl_surface_check";
  }

  return "unknown_profile";
}

function addProfileSignalFindings(
  findings: XmlReadinessFinding[],
  profileSignal: XmlProfileSignal,
  detectedDocument: string
) {
  if (detectedDocument === "unknown") {
    return;
  }

  if (profileSignal.ublNamespaceDetected) {
    pushExtractedInfoFinding(
      findings,
      "UBL_NAMESPACE_SIGNAL_DETECTED",
      "xml.namespace",
      "Detected UBL namespace signal in the uploaded XML."
    );
  }

  if (profileSignal.customizationId !== "not_detected") {
    pushExtractedInfoFinding(
      findings,
      "CUSTOMIZATION_ID_DETECTED",
      "CustomizationID",
      `Detected CustomizationID: ${profileSignal.customizationId}.`
    );
  } else {
    findings.push({
      code: "CUSTOMIZATION_ID_MISSING",
      severity: "warning",
      field: "CustomizationID",
      message:
        "CustomizationID was not detected. This limits EN 16931, Peppol BIS, and country-profile simulation confidence.",
      confidence: "readiness_simulation"
    });
  }

  if (profileSignal.profileId !== "not_detected") {
    pushExtractedInfoFinding(
      findings,
      "PROFILE_ID_DETECTED",
      "ProfileID",
      `Detected ProfileID: ${profileSignal.profileId}.`
    );
  } else {
    findings.push({
      code: "PROFILE_ID_MISSING",
      severity: "warning",
      field: "ProfileID",
      message:
        "ProfileID was not detected. This limits business-process profile simulation confidence.",
      confidence: "readiness_simulation"
    });
  }

  if (profileSignal.peppolSignalDetected) {
    findings.push({
      code: "PEPPOL_BIS_SIGNAL_DETECTED",
      severity: "info",
      field: "CustomizationID/ProfileID",
      message:
        "Detected a Peppol BIS-style profile signal. This is a technical simulation only, not Peppol authority validation.",
      confidence: "readiness_simulation"
    });
  }

  if (profileSignal.en16931SignalDetected) {
    findings.push({
      code: "EN16931_SIGNAL_DETECTED",
      severity: "info",
      field: "CustomizationID/ProfileID",
      message:
        "Detected an EN 16931-style profile signal. This is a readiness signal only, not official EN 16931 certification.",
      confidence: "readiness_simulation"
    });
  }

  if (
    profileSignal.customizationId !== "not_detected" &&
    !profileSignal.peppolSignalDetected &&
    !profileSignal.en16931SignalDetected
  ) {
    findings.push({
      code: "PROFILE_SIGNAL_LIMITED",
      severity: "warning",
      field: "CustomizationID/ProfileID",
      message:
        "A customization/profile value was detected, but Invoice Lantern could not confidently classify it as Peppol BIS or EN 16931 from parser-level signals.",
      confidence: "review_required"
    });
  }

  if (profileSignal.endpointCount > 0) {
    pushExtractedInfoFinding(
      findings,
      "ELECTRONIC_ENDPOINT_SIGNAL_DETECTED",
      "EndpointID",
      `Detected ${profileSignal.endpointCount} electronic endpoint ID value(s).`
    );
  } else {
    findings.push({
      code: "ELECTRONIC_ENDPOINT_MISSING",
      severity: "warning",
      field: "EndpointID",
      message:
        "No EndpointID was detected. Electronic delivery simulations usually require seller and buyer electronic addressing.",
      confidence: "readiness_simulation"
    });
  }

  if (
    profileSignal.sellerCountry !== "not_detected" ||
    profileSignal.buyerCountry !== "not_detected"
  ) {
    pushExtractedInfoFinding(
      findings,
      "COUNTRY_SIGNAL_DETECTED",
      "AccountingSupplierParty/AccountingCustomerParty.Country",
      `Detected country signal: ${profileSignal.countryPair}.`
    );
  }

  if (profileSignal.crossBorderSignal) {
    findings.push({
      code: "CROSS_BORDER_REVIEW_REQUIRED",
      severity: "warning",
      field: "AccountingSupplierParty/AccountingCustomerParty.Country",
      message:
        "Seller and buyer country signals differ. Cross-border VAT, routing, and reporting treatment requires review.",
      confidence: "review_required"
    });
  }

  if (profileSignal.taxCategoryCodes.length > 0) {
    pushExtractedInfoFinding(
      findings,
      "TAX_CATEGORY_CODES_DETECTED",
      "TaxCategory.ID",
      `Detected tax category code(s): ${profileSignal.taxCategoryCodes.join(", ")}.`
    );
  }

  if (profileSignal.vatPercentValues.length > 0) {
    pushExtractedInfoFinding(
      findings,
      "VAT_PERCENT_VALUES_DETECTED",
      "TaxCategory.Percent",
      `Detected VAT percent value(s): ${profileSignal.vatPercentValues.join(", ")}.`
    );
  }

  if (profileSignal.paymentMeansDetected) {
    pushExtractedInfoFinding(
      findings,
      "PAYMENT_MEANS_DETECTED",
      "PaymentMeans",
      "Detected PaymentMeans block."
    );
  } else {
    findings.push({
      code: "PAYMENT_MEANS_MISSING",
      severity: "warning",
      field: "PaymentMeans",
      message:
        "PaymentMeans was not detected. This can be valid in some flows, but payment data may be incomplete for readiness review.",
      confidence: "readiness_simulation"
    });
  }

  if (profileSignal.paymentTermsDetected) {
    pushExtractedInfoFinding(
      findings,
      "PAYMENT_TERMS_DETECTED",
      "PaymentTerms",
      "Detected PaymentTerms block."
    );
  }

  if (profileSignal.allowanceChargeDetected) {
    findings.push({
      code: "ALLOWANCE_OR_CHARGE_DETECTED",
      severity: "info",
      field: "AllowanceCharge",
      message:
        "Detected AllowanceCharge block. Totals may include allowances or charges beyond simple line-plus-tax arithmetic.",
      confidence: "readiness_simulation"
    });
  }
}

function buildExtractedData(
  context: XmlParserContext,
  currency: string,
  detectedDocument: string
): XmlExtractedData {
  const invoiceLineCount = countTags(context, "InvoiceLine");
  const creditNoteLineCount = countTags(context, "CreditNoteLine");
  const lineCount = invoiceLineCount + creditNoteLineCount;

  return {
    sellerName: extractPartyName(context, "AccountingSupplierParty"),
    buyerName: extractPartyName(context, "AccountingCustomerParty"),
    lineCount,
    invoiceLineCount,
    creditNoteLineCount,
    currency,
    monetaryTotals: {
      lineExtensionAmount: extractMonetaryTotal(context, "LineExtensionAmount"),
      taxExclusiveAmount: extractMonetaryTotal(context, "TaxExclusiveAmount"),
      taxAmount: extractTaxAmount(context),
      taxInclusiveAmount: extractMonetaryTotal(context, "TaxInclusiveAmount"),
      payableAmount: extractMonetaryTotal(context, "PayableAmount")
    },
    taxSignal: {
      taxTotalDetected: hasTag(context, "TaxTotal"),
      taxSubtotalDetected: hasTag(context, "TaxSubtotal"),
      taxCategoryDetected: hasTag(context, "TaxCategory"),
      taxRateCount: countTags(context, "Percent")
    },
    profileSignal: buildProfileSignal(context, detectedDocument)
  };
}

function addExtractedDataFindings(
  findings: XmlReadinessFinding[],
  extractedData: XmlExtractedData
) {
  if (extractedData.sellerName !== "not_detected") {
    pushExtractedInfoFinding(
      findings,
      "SELLER_NAME_DETECTED",
      "AccountingSupplierParty",
      `Detected seller name: ${extractedData.sellerName}.`
    );
  }

  if (extractedData.buyerName !== "not_detected") {
    pushExtractedInfoFinding(
      findings,
      "BUYER_NAME_DETECTED",
      "AccountingCustomerParty",
      `Detected buyer name: ${extractedData.buyerName}.`
    );
  }

  if (extractedData.lineCount > 0) {
    pushExtractedInfoFinding(
      findings,
      "DOCUMENT_LINES_DETECTED",
      "InvoiceLine",
      `Detected ${extractedData.lineCount} invoice/credit note line block(s).`
    );
  }

  const payableAmount = extractedData.monetaryTotals.payableAmount;

  if (payableAmount !== "not_detected") {
    pushExtractedInfoFinding(
      findings,
      "PAYABLE_AMOUNT_DETECTED",
      "LegalMonetaryTotal.PayableAmount",
      `Detected payable amount: ${payableAmount}.`
    );
  }
}

function addCalculationFindings(
  findings: XmlReadinessFinding[],
  extractedData: XmlExtractedData
) {
  const taxExclusiveAmount = parseMoney(
    extractedData.monetaryTotals.taxExclusiveAmount
  );
  const taxAmount = parseMoney(extractedData.monetaryTotals.taxAmount);
  const taxInclusiveAmount = parseMoney(
    extractedData.monetaryTotals.taxInclusiveAmount
  );
  const payableAmount = parseMoney(extractedData.monetaryTotals.payableAmount);

  if (
    taxExclusiveAmount === null ||
    taxAmount === null ||
    taxInclusiveAmount === null
  ) {
    findings.push({
      code: "TOTAL_CONSISTENCY_NOT_CHECKED",
      severity: "info",
      field: "LegalMonetaryTotal",
      message:
        "Tax-exclusive amount, tax amount, or tax-inclusive amount was not fully detected, so arithmetic consistency was not checked.",
      confidence: "readiness_simulation"
    });

    return;
  }

  const expectedTaxInclusiveAmount = taxExclusiveAmount + taxAmount;

  if (!valuesApproximatelyEqual(expectedTaxInclusiveAmount, taxInclusiveAmount)) {
    findings.push({
      code: "TAX_INCLUSIVE_TOTAL_MISMATCH",
      severity: "warning",
      field: "LegalMonetaryTotal.TaxInclusiveAmount",
      message:
        "Tax-inclusive amount does not match tax-exclusive amount plus tax amount in this parser-backed check.",
      confidence: "readiness_simulation"
    });

    return;
  }

  findings.push({
    code: "TAX_INCLUSIVE_TOTAL_CONSISTENT",
    severity: "info",
    field: "LegalMonetaryTotal.TaxInclusiveAmount",
    message:
      "Tax-inclusive amount matches tax-exclusive amount plus tax amount in this parser-backed check.",
    confidence: "readiness_simulation"
  });

  if (
    payableAmount !== null &&
    !valuesApproximatelyEqual(payableAmount, taxInclusiveAmount)
  ) {
    findings.push({
      code: "PAYABLE_AMOUNT_REVIEW_REQUIRED",
      severity: "warning",
      field: "LegalMonetaryTotal.PayableAmount",
      message:
        "Payable amount differs from tax-inclusive amount. This can be valid with allowances, charges, prepaid amounts, or rounding, but requires review.",
      confidence: "review_required"
    });
  }
}

function buildReadinessReport({
  context,
  detectedDocument,
  rootElement,
  invoiceId,
  issueDate,
  currency
}: {
  context: XmlParserContext;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
}): XmlReadinessReport {
  const findings: XmlReadinessFinding[] = [];
  const extractedData = buildExtractedData(context, currency, detectedDocument);

  if (!context.isWellFormed) {
    findings.push({
      code: "XML_WELL_FORMEDNESS_FAILED",
      severity: "fatal",
      field: "xml",
      message: context.parserErrorMessage,
      confidence: "technical"
    });
  } else {
    findings.push({
      code: "XML_WELL_FORMEDNESS_PASSED",
      severity: "info",
      field: "xml",
      message: "The uploaded XML passed parser-level well-formedness validation.",
      confidence: "technical"
    });
  }

  if (rootElement === "unknown" || detectedDocument === "unknown") {
    findings.push({
      code: "UNSUPPORTED_DOCUMENT_ROOT",
      severity: "fatal",
      field: "rootElement",
      message:
        "The root element is not recognized as an Invoice or CreditNote document.",
      confidence: "technical"
    });
  }

  if (detectedDocument !== "unknown") {
    findings.push({
      code: "DOCUMENT_ROOT_RECOGNIZED",
      severity: "info",
      field: "rootElement",
      message: `Detected a ${detectedDocument} XML document from root element ${rootElement}.`,
      confidence: "technical"
    });
  }

  addProfileSignalFindings(
    findings,
    extractedData.profileSignal,
    detectedDocument
  );

  if (invoiceId === "not_detected") {
    findings.push({
      code: "DOCUMENT_ID_MISSING",
      severity: "fatal",
      field: "ID",
      message: "Document ID was not detected.",
      confidence: "readiness_simulation"
    });
  }

  if (issueDate === "not_detected") {
    findings.push({
      code: "ISSUE_DATE_MISSING",
      severity: "warning",
      field: "IssueDate",
      message: "Issue date was not detected.",
      confidence: "readiness_simulation"
    });
  }

  if (currency === "not_detected") {
    findings.push({
      code: "DOCUMENT_CURRENCY_MISSING",
      severity: "warning",
      field: "DocumentCurrencyCode",
      message: "Document currency code was not detected.",
      confidence: "readiness_simulation"
    });
  }

  pushMissingTagFinding(
    findings,
    context,
    "AccountingSupplierParty",
    "AccountingSupplierParty",
    "Seller/supplier party block",
    "warning"
  );

  pushMissingTagFinding(
    findings,
    context,
    "AccountingCustomerParty",
    "AccountingCustomerParty",
    "Buyer/customer party block",
    "warning"
  );

  pushMissingTagFinding(
    findings,
    context,
    "TaxTotal",
    "TaxTotal",
    "Tax total block",
    "warning"
  );

  pushMissingTagFinding(
    findings,
    context,
    "LegalMonetaryTotal",
    "LegalMonetaryTotal",
    "Legal monetary total block",
    "warning"
  );

  if (extractedData.lineCount === 0) {
    findings.push({
      code: "DOCUMENT_LINE_MISSING",
      severity: "warning",
      field: "InvoiceLine",
      message: "No InvoiceLine or CreditNoteLine block was detected.",
      confidence: "readiness_simulation"
    });
  }

  if (hasTag(context, "LegalMonetaryTotal")) {
    pushMissingTagFinding(
      findings,
      context,
      "LineExtensionAmount",
      "LegalMonetaryTotal.LineExtensionAmount",
      "Line extension amount",
      "warning"
    );

    pushMissingTagFinding(
      findings,
      context,
      "TaxExclusiveAmount",
      "LegalMonetaryTotal.TaxExclusiveAmount",
      "Tax exclusive amount",
      "warning"
    );

    pushMissingTagFinding(
      findings,
      context,
      "TaxInclusiveAmount",
      "LegalMonetaryTotal.TaxInclusiveAmount",
      "Tax inclusive amount",
      "warning"
    );

    pushMissingTagFinding(
      findings,
      context,
      "PayableAmount",
      "LegalMonetaryTotal.PayableAmount",
      "Payable amount",
      "warning"
    );
  }

  if (!extractedData.taxSignal.taxTotalDetected) {
    findings.push({
      code: "TAX_SIGNAL_MISSING",
      severity: "warning",
      field: "TaxTotal",
      message: "Tax total information was not detected.",
      confidence: "readiness_simulation"
    });
  }

  if (
    extractedData.taxSignal.taxTotalDetected &&
    !extractedData.taxSignal.taxCategoryDetected
  ) {
    findings.push({
      code: "TAX_CATEGORY_REVIEW_REQUIRED",
      severity: "warning",
      field: "TaxCategory",
      message:
        "Tax total was detected, but tax category information was not clearly detected.",
      confidence: "review_required"
    });
  }

  addExtractedDataFindings(findings, extractedData);
  addCalculationFindings(findings, extractedData);

  const hasFatal = findings.some((finding) => finding.severity === "fatal");
  const hasWarning = findings.some((finding) => finding.severity === "warning");

  const calculationStatus =
    hasTag(context, "LegalMonetaryTotal") &&
    findings.some((finding) => finding.code === "TAX_INCLUSIVE_TOTAL_MISMATCH")
      ? "inconsistent"
      : hasTag(context, "LegalMonetaryTotal")
        ? "surface_checked"
        : "not_checked";

  const profileStatus = determineProfileStatus(
    detectedDocument,
    extractedData.profileSignal
  );

  return {
    technicalStatus: hasFatal ? "failed" : "passed",
    readinessStatus:
      detectedDocument === "unknown"
        ? "unsupported"
        : hasFatal || hasWarning
          ? "needs_attention"
          : "ready_for_review",
    documentStatus: detectedDocument === "unknown" ? "unsupported" : "recognized",
    calculationStatus,
    profileStatus,
    extractedData,
    findings
  };
}

export function inspectXmlReadiness(xml: string): XmlReadinessInspection {
  const context = buildXmlParserContext(xml);
  const rootElement = context.rootElement;
  const detectedDocument = detectDocumentType(rootElement);
  const invoiceId = extractDocumentField(context, "ID");
  const issueDate = extractDocumentField(context, "IssueDate");
  const currency = extractDocumentField(context, "DocumentCurrencyCode");

  const report = buildReadinessReport({
    context,
    detectedDocument,
    rootElement,
    invoiceId,
    issueDate,
    currency
  });

  return {
    rootElement,
    detectedDocument,
    invoiceId,
    issueDate,
    currency,
    report
  };
}

export function buildXmlUploadSummary(
  readinessReport: XmlReadinessReport
): XmlUploadSummaryShape {
  return {
    technicalStatus: readinessReport.technicalStatus,
    readinessStatus: readinessReport.readinessStatus,
    findingsCount: readinessReport.findings.length,
    sellerName: readinessReport.extractedData.sellerName,
    buyerName: readinessReport.extractedData.buyerName,
    lineCount: readinessReport.extractedData.lineCount,
    payableAmount: readinessReport.extractedData.monetaryTotals.payableAmount,
    taxAmount: readinessReport.extractedData.monetaryTotals.taxAmount,
    currency: readinessReport.extractedData.currency
  };
}
