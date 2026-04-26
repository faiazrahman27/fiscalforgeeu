export type XmlFindingSeverity = "info" | "warning" | "fatal";

export type XmlReadinessFinding = {
  code: string;
  severity: XmlFindingSeverity;
  field: string;
  message: string;
  confidence: "technical" | "readiness_simulation" | "review_required";
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
};

export type XmlReadinessReport = {
  technicalStatus: "passed" | "failed";
  readinessStatus: "ready_for_review" | "needs_attention" | "unsupported";
  documentStatus: "recognized" | "unsupported";
  calculationStatus: "not_checked" | "surface_checked" | "inconsistent";
  profileStatus: "ubl_surface_check" | "unknown_profile";
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

  return match?.[1]?.trim().slice(0, 180) || "not_detected";
}

function extractFirstBlock(xml: string, blockTag: string) {
  const escapedTag = escapeRegex(blockTag);

  const blockPattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[A-Za-z_][\\w.-]*:)?${escapedTag}>`,
    "i"
  );

  return xml.match(blockPattern)?.[0] ?? "";
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

function buildExtractedData(xml: string, currency: string): XmlExtractedData {
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
    }
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
  const extractedData = buildExtractedData(xml, currency);

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
    profileStatus:
      detectedDocument === "unknown" ? "unknown_profile" : "ubl_surface_check",
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
