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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildNamespacedTagPattern(tagName: string) {
  const escapedTag = escapeRegex(tagName);

  return new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[A-Za-z_][\\w.-]*:)?${escapedTag}>`,
    "i"
  );
}

function buildNamespacedTagGlobalPattern(tagName: string) {
  const escapedTag = escapeRegex(tagName);

  return new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[A-Za-z_][\\w.-]*:)?${escapedTag}>`,
    "gi"
  );
}

function hasTag(xml: string, tagName: string) {
  return buildNamespacedTagPattern(tagName).test(xml);
}

function countTags(xml: string, tagName: string) {
  return xml.match(buildNamespacedTagGlobalPattern(tagName))?.length ?? 0;
}

function extractFirstTagValue(xml: string, tagName: string) {
  const escapedTag = escapeRegex(tagName);

  const namespacedPattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTag}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${escapedTag}>`,
    "i"
  );

  const match = xml.match(namespacedPattern);

  return match?.[1]?.trim().slice(0, 240) || "not_detected";
}

function extractAllTagValues(xml: string, tagName: string, maxResults = 30) {
  const escapedTag = escapeRegex(tagName);
  const namespacedPattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTag}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${escapedTag}>`,
    "gi"
  );

  const values: string[] = [];
  let match = namespacedPattern.exec(xml);

  while (match && values.length < maxResults) {
    const value = match[1]?.trim().slice(0, 180);

    if (value) {
      values.push(value);
    }

    match = namespacedPattern.exec(xml);
  }

  return values;
}

function extractFirstBlock(xml: string, blockTag: string) {
  const escapedTag = escapeRegex(blockTag);

  const blockPattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[A-Za-z_][\\w.-]*:)?${escapedTag}>`,
    "i"
  );

  return xml.match(blockPattern)?.[0] ?? "";
}

function extractAllBlocks(xml: string, blockTag: string, maxResults = 30) {
  const pattern = buildNamespacedTagGlobalPattern(blockTag);
  const blocks: string[] = [];
  let match = pattern.exec(xml);

  while (match && blocks.length < maxResults) {
    blocks.push(match[0]);
    match = pattern.exec(xml);
  }

  return blocks;
}

function extractFirstTagOpening(xml: string, tagName: string) {
  const escapedTag = escapeRegex(tagName);

  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTag}(?:\\s[^>]*)?>`,
    "i"
  );

  return xml.match(pattern)?.[0] ?? "";
}

function extractAttributeValueFromOpeningTag(
  openingTag: string,
  attributeName: string
) {
  const escapedAttribute = escapeRegex(attributeName);
  const pattern = new RegExp(
    `${escapedAttribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i"
  );

  const match = openingTag.match(pattern);

  return match?.[1]?.trim() || match?.[2]?.trim() || "not_detected";
}

function extractFirstTagAttribute(
  xml: string,
  tagName: string,
  attributeName: string
) {
  const openingTag = extractFirstTagOpening(xml, tagName);

  if (!openingTag) {
    return "not_detected";
  }

  return extractAttributeValueFromOpeningTag(openingTag, attributeName);
}

function extractFirstTagValueInsideBlock(
  xml: string,
  blockTag: string,
  tagName: string
) {
  const block = extractFirstBlock(xml, blockTag);

  if (!block) {
    return "not_detected";
  }

  return extractFirstTagValue(block, tagName);
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter((value) => value && value !== "not_detected"))];
}

function extractPartyName(xml: string, partyBlockTag: string) {
  const partyBlock = extractFirstBlock(xml, partyBlockTag);

  if (!partyBlock) {
    return "not_detected";
  }

  const partyNameBlock = extractFirstBlock(partyBlock, "PartyName");

  if (partyNameBlock) {
    const nameFromPartyName = extractFirstTagValue(partyNameBlock, "Name");

    if (nameFromPartyName !== "not_detected") {
      return nameFromPartyName;
    }
  }

  const partyLegalEntityBlock = extractFirstBlock(partyBlock, "PartyLegalEntity");

  if (partyLegalEntityBlock) {
    const registrationName = extractFirstTagValue(
      partyLegalEntityBlock,
      "RegistrationName"
    );

    if (registrationName !== "not_detected") {
      return registrationName;
    }
  }

  return extractFirstTagValue(partyBlock, "Name");
}

function extractPartyEndpointId(xml: string, partyBlockTag: string) {
  const partyBlock = extractFirstBlock(xml, partyBlockTag);

  if (!partyBlock) {
    return "not_detected";
  }

  return extractFirstTagValue(partyBlock, "EndpointID");
}

function extractPartyEndpointScheme(xml: string, partyBlockTag: string) {
  const partyBlock = extractFirstBlock(xml, partyBlockTag);

  if (!partyBlock) {
    return "not_detected";
  }

  return extractFirstTagAttribute(partyBlock, "EndpointID", "schemeID");
}

function extractPartyCountryCode(xml: string, partyBlockTag: string) {
  const partyBlock = extractFirstBlock(xml, partyBlockTag);

  if (!partyBlock) {
    return "not_detected";
  }

  const countryBlock = extractFirstBlock(partyBlock, "Country");

  if (!countryBlock) {
    return "not_detected";
  }

  return extractFirstTagValue(countryBlock, "IdentificationCode");
}

function extractTaxCategoryCodes(xml: string) {
  const taxCategoryBlocks = extractAllBlocks(xml, "TaxCategory", 40);

  return uniqueValues(
    taxCategoryBlocks.map((block) => extractFirstTagValue(block, "ID"))
  );
}

function extractVatPercentValues(xml: string) {
  return uniqueValues(extractAllTagValues(xml, "Percent", 40));
}

function extractMonetaryTotal(xml: string, tagName: string) {
  const valueInsideLegalTotal = extractFirstTagValueInsideBlock(
    xml,
    "LegalMonetaryTotal",
    tagName
  );

  if (valueInsideLegalTotal !== "not_detected") {
    return valueInsideLegalTotal;
  }

  return extractFirstTagValue(xml, tagName);
}

function extractTaxAmount(xml: string) {
  const taxTotalBlock = extractFirstBlock(xml, "TaxTotal");

  if (!taxTotalBlock) {
    return "not_detected";
  }

  return extractFirstTagValue(taxTotalBlock, "TaxAmount");
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

function hasParseRisk(xml: string) {
  const openingLikeTags = xml.match(/<[A-Za-z_][\w:.-]*(?:\s[^>]*)?>/g) ?? [];
  const closingLikeTags = xml.match(/<\/[A-Za-z_][\w:.-]*>/g) ?? [];

  if (openingLikeTags.length === 0) {
    return true;
  }

  return closingLikeTags.length === 0;
}

function hasUblNamespaceSignal(xml: string) {
  return (
    /urn:oasis:names:specification:ubl:schema:xsd:(Invoice|CreditNote)-2/i.test(
      xml
    ) ||
    /urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2/i.test(
      xml
    ) ||
    /urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2/i.test(
      xml
    )
  );
}

function pushMissingTagFinding(
  findings: XmlReadinessFinding[],
  xml: string,
  tagName: string,
  field: string,
  label: string,
  severity: XmlFindingSeverity = "warning"
) {
  if (hasTag(xml, tagName)) {
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
  xml: string,
  detectedDocument: string
): XmlProfileSignal {
  const customizationId = extractFirstTagValue(xml, "CustomizationID");
  const profileId = extractFirstTagValue(xml, "ProfileID");
  const normalizedProfileText = `${customizationId} ${profileId}`.toLowerCase();

  const ublNamespaceDetected = hasUblNamespaceSignal(xml);
  const ublDocumentDetected =
    detectedDocument !== "unknown" &&
    (ublNamespaceDetected ||
      hasTag(xml, "AccountingSupplierParty") ||
      hasTag(xml, "AccountingCustomerParty"));

  const peppolSignalDetected =
    normalizedProfileText.includes("peppol") ||
    normalizedProfileText.includes("bis") ||
    normalizedProfileText.includes("urn:fdc:peppol.eu");

  const en16931SignalDetected =
    normalizedProfileText.includes("en16931") ||
    normalizedProfileText.includes("en 16931") ||
    normalizedProfileText.includes("urn:cen.eu:en16931") ||
    normalizedProfileText.includes("cius");

  const sellerCountry = extractPartyCountryCode(xml, "AccountingSupplierParty");
  const buyerCountry = extractPartyCountryCode(xml, "AccountingCustomerParty");

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
    profileHints.push("UBL document surface");
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
    endpointCount: countTags(xml, "EndpointID"),
    sellerEndpointId: extractPartyEndpointId(xml, "AccountingSupplierParty"),
    sellerEndpointScheme: extractPartyEndpointScheme(
      xml,
      "AccountingSupplierParty"
    ),
    buyerEndpointId: extractPartyEndpointId(xml, "AccountingCustomerParty"),
    buyerEndpointScheme: extractPartyEndpointScheme(
      xml,
      "AccountingCustomerParty"
    ),
    sellerCountry,
    buyerCountry,
    countryPair,
    crossBorderSignal,
    taxCategoryCodes: extractTaxCategoryCodes(xml),
    vatPercentValues: extractVatPercentValues(xml),
    paymentMeansDetected: hasTag(xml, "PaymentMeans"),
    paymentTermsDetected: hasTag(xml, "PaymentTerms"),
    allowanceChargeDetected: hasTag(xml, "AllowanceCharge")
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
        "A customization/profile value was detected, but Invoice Lantern could not confidently classify it as Peppol BIS or EN 16931 from surface signals.",
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
  xml: string,
  currency: string,
  detectedDocument: string
): XmlExtractedData {
  const invoiceLineCount = countTags(xml, "InvoiceLine");
  const creditNoteLineCount = countTags(xml, "CreditNoteLine");
  const lineCount = invoiceLineCount + creditNoteLineCount;

  return {
    sellerName: extractPartyName(xml, "AccountingSupplierParty"),
    buyerName: extractPartyName(xml, "AccountingCustomerParty"),
    lineCount,
    invoiceLineCount,
    creditNoteLineCount,
    currency,
    monetaryTotals: {
      lineExtensionAmount: extractMonetaryTotal(xml, "LineExtensionAmount"),
      taxExclusiveAmount: extractMonetaryTotal(xml, "TaxExclusiveAmount"),
      taxAmount: extractTaxAmount(xml),
      taxInclusiveAmount: extractMonetaryTotal(xml, "TaxInclusiveAmount"),
      payableAmount: extractMonetaryTotal(xml, "PayableAmount")
    },
    taxSignal: {
      taxTotalDetected: hasTag(xml, "TaxTotal"),
      taxSubtotalDetected: hasTag(xml, "TaxSubtotal"),
      taxCategoryDetected: hasTag(xml, "TaxCategory"),
      taxRateCount: countTags(xml, "Percent")
    },
    profileSignal: buildProfileSignal(xml, detectedDocument)
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
        "Tax-inclusive amount does not match tax-exclusive amount plus tax amount in this surface-level check.",
      confidence: "readiness_simulation"
    });

    return;
  }

  findings.push({
    code: "TAX_INCLUSIVE_TOTAL_CONSISTENT",
    severity: "info",
    field: "LegalMonetaryTotal.TaxInclusiveAmount",
    message:
      "Tax-inclusive amount matches tax-exclusive amount plus tax amount in this surface-level check.",
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
  xml,
  detectedDocument,
  rootElement,
  invoiceId,
  issueDate,
  currency
}: {
  xml: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
}): XmlReadinessReport {
  const findings: XmlReadinessFinding[] = [];
  const extractedData = buildExtractedData(xml, currency, detectedDocument);

  if (hasParseRisk(xml)) {
    findings.push({
      code: "XML_SURFACE_PARSE_RISK",
      severity: "fatal",
      field: "xml",
      message:
        "The XML text does not look structurally complete enough for readiness inspection.",
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
    xml,
    "AccountingSupplierParty",
    "AccountingSupplierParty",
    "Seller/supplier party block",
    "warning"
  );

  pushMissingTagFinding(
    findings,
    xml,
    "AccountingCustomerParty",
    "AccountingCustomerParty",
    "Buyer/customer party block",
    "warning"
  );

  pushMissingTagFinding(
    findings,
    xml,
    "TaxTotal",
    "TaxTotal",
    "Tax total block",
    "warning"
  );

  pushMissingTagFinding(
    findings,
    xml,
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

  if (hasTag(xml, "LegalMonetaryTotal")) {
    pushMissingTagFinding(
      findings,
      xml,
      "LineExtensionAmount",
      "LegalMonetaryTotal.LineExtensionAmount",
      "Line extension amount",
      "warning"
    );

    pushMissingTagFinding(
      findings,
      xml,
      "TaxExclusiveAmount",
      "LegalMonetaryTotal.TaxExclusiveAmount",
      "Tax exclusive amount",
      "warning"
    );

    pushMissingTagFinding(
      findings,
      xml,
      "TaxInclusiveAmount",
      "LegalMonetaryTotal.TaxInclusiveAmount",
      "Tax inclusive amount",
      "warning"
    );

    pushMissingTagFinding(
      findings,
      xml,
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
    hasTag(xml, "LegalMonetaryTotal") &&
    findings.some((finding) => finding.code === "TAX_INCLUSIVE_TOTAL_MISMATCH")
      ? "inconsistent"
      : hasTag(xml, "LegalMonetaryTotal")
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
  const rootElement = detectRootElement(xml);
  const detectedDocument = detectDocumentType(rootElement);
  const invoiceId = extractFirstTagValue(xml, "ID");
  const issueDate = extractFirstTagValue(xml, "IssueDate");
  const currency = extractFirstTagValue(xml, "DocumentCurrencyCode");

  const report = buildReadinessReport({
    xml,
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
