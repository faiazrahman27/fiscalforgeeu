import { basename } from "node:path";

export const UBL_XSD_ERROR_MAPPING_VERSION = "2026.05.1";
export const UBL_XSD_CHECK_TYPE = "xsd_ubl" as const;
export const UBL_XSD_SOURCE_LABELS = [
  "Local UBL XSD validation",
  "xmllint-wasm",
  "Configured local UBL XSD artefacts"
] as const;

export type UblXsdMappedFindingStatus =
  | "passed"
  | "failed"
  | "not_configured"
  | "error";

export type UblXsdMappedFinding = {
  code: string;
  severity: "info" | "warning" | "fatal";
  checkType: typeof UBL_XSD_CHECK_TYPE;
  field: string;
  message: string;
  status: UblXsdMappedFindingStatus;
  legalConfidence: "technical";
  fixSuggestion?: string;
  sourceLabels?: string[];
  technicalMessage?: string;
  technicalCode?: string;
  xmlLine?: number;
};

export type RawUblXsdValidationError =
  | string
  | {
      message?: string;
      rawMessage?: string;
      loc?: null | {
        fileName?: string;
        lineNumber?: number;
      };
    };

type UblXsdFindingContext = {
  rootElement?: string;
  documentType?: string;
};

type ClassifiedXsdError = {
  code: string;
  technicalCode: string;
};

const ELEMENT_PATTERN = /\bElement\s+'([^']+)'/i;
const ATTRIBUTE_PATTERN = /\battribute\s+'([^']+)'/i;
const EXPECTED_PATTERN = /\bExpected is\s+\(([^)]+)\)/i;
const XML_NAME_PATTERN = /^(?:[A-Za-z_][\w.-]*:)?[A-Za-z_][\w.-]*$/;

const FIELD_BY_XML_LOCAL_NAME = new Map<string, string>([
  ["Invoice", "Invoice"],
  ["CreditNote", "CreditNote"],
  ["IssueDate", "document.issueDate"],
  ["DueDate", "document.dueDate"],
  ["DocumentCurrencyCode", "document.currency"],
  ["AccountingSupplierParty", "seller"],
  ["AccountingCustomerParty", "buyer"],
  ["InvoiceLine", "lines"],
  ["CreditNoteLine", "lines"],
  ["InvoicedQuantity", "lines.quantity"],
  ["CreditedQuantity", "lines.quantity"],
  ["LineExtensionAmount", "lines.netAmount"],
  ["TaxTotal", "totals.taxAmount"],
  ["LegalMonetaryTotal", "totals"]
]);

function getErrorMessage(error: RawUblXsdValidationError) {
  if (typeof error === "string") {
    return error;
  }

  return error.message || error.rawMessage || "";
}

function getXmlLine(error: RawUblXsdValidationError) {
  if (typeof error === "string") {
    return undefined;
  }

  const lineNumber = error.loc?.lineNumber;

  return typeof lineNumber === "number" &&
    Number.isInteger(lineNumber) &&
    lineNumber > 0
    ? lineNumber
    : undefined;
}

function stripNamespacePrefix(name: string) {
  const withoutNamespaceUri = name.includes("}")
    ? name.split("}").pop() ?? name
    : name;

  return withoutNamespaceUri.includes(":")
    ? withoutNamespaceUri.split(":").pop() ?? withoutNamespaceUri
    : withoutNamespaceUri;
}

function isSafeXmlName(name: string) {
  return XML_NAME_PATTERN.test(name.trim());
}

function normalizeExpectedElementName(value: string) {
  return value
    .trim()
    .replace(/^\{[^}]+}/, "")
    .replace(/[?*+]/g, "")
    .trim();
}

function extractExpectedElements(message: string) {
  const expected = message.match(EXPECTED_PATTERN)?.[1];

  if (!expected) {
    return [];
  }

  return expected
    .split(/[|,]/)
    .map((item) => normalizeExpectedElementName(item))
    .filter((item) => item.length > 0 && isSafeXmlName(item))
    .slice(0, 5);
}

function extractElementName(message: string) {
  const elementName = message.match(ELEMENT_PATTERN)?.[1]?.trim();

  return elementName && isSafeXmlName(elementName) ? elementName : "";
}

function extractAttributeName(message: string) {
  const attributeName = message.match(ATTRIBUTE_PATTERN)?.[1]?.trim();

  return attributeName && isSafeXmlName(attributeName) ? attributeName : "";
}

function sanitizePathReferences(message: string) {
  return message
    .replace(/\b[A-Za-z]:[\\/][^\s'"]+/g, (match) => basename(match))
    .replace(/(?<![\w.-])\/(?:[^\s'"]+\/)+([^\s'"]+)/g, "$1")
    .replace(/\bfile:\/\/[^\s'"]+/gi, "[local-file-reference]");
}

function redactXmlFragments(message: string) {
  return message
    .replace(/&lt;[\s\S]*?&gt;/g, "[xml-fragment]")
    .replace(/<[^>]{1,1000}>/g, "[xml-fragment]");
}

function redactPayloadLikeValues(message: string) {
  return message
    .replace(
      /(:\s*)'[^']*'(\s+(?:is|isn't|was|does|doesn't|did|didn't|not|has|contains|violates)\b)/gi,
      "$1[value]$2"
    )
    .replace(
      /\bvalue\s+'[^']*'/gi,
      "value [value]"
    )
    .replace(
      /\bThe value\s+'[^']*'/gi,
      "The value [value]"
    );
}

export function normalizeXsdTechnicalMessage(message: string) {
  return redactPayloadLikeValues(redactXmlFragments(sanitizePathReferences(message)))
    .replace(/\bdocument\.xml:\d+:\s*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, 700);
}

function classifyXsdError(message: string): ClassifiedXsdError {
  const normalized = message.toLowerCase();

  if (/attribute\s+'[^']+'\s+is required but missing/i.test(message)) {
    return {
      code: "UBL_XSD_REQUIRED_ATTRIBUTE_MISSING",
      technicalCode: "required_attribute_missing"
    };
  }

  if (/missing child element\(s\)|missing required/i.test(normalized)) {
    return {
      code: "UBL_XSD_REQUIRED_ELEMENT_MISSING",
      technicalCode: "required_element_missing"
    };
  }

  if (
    /no matching global declaration|namespace|target namespace/i.test(message)
  ) {
    return {
      code: "UBL_XSD_NAMESPACE_INVALID",
      technicalCode: "namespace_or_root_declaration_invalid"
    };
  }

  if (/this element is not expected|element .* not expected/i.test(message)) {
    return {
      code: "UBL_XSD_ELEMENT_INVALID",
      technicalCode: "element_invalid"
    };
  }

  if (/attribute\s+'[^']+'.*(not allowed|not expected|invalid)/i.test(message)) {
    return {
      code: "UBL_XSD_ATTRIBUTE_INVALID",
      technicalCode: "attribute_invalid"
    };
  }

  if (
    /not a valid value|facet|does not match|value .* is not accepted/i.test(
      message
    )
  ) {
    return {
      code: "UBL_XSD_VALUE_INVALID",
      technicalCode: "value_invalid"
    };
  }

  if (/type definition|simple type|complex type|atomic type/i.test(message)) {
    return {
      code: "UBL_XSD_TYPE_INVALID",
      technicalCode: "type_invalid"
    };
  }

  if (
    /schemaLocation|failed to load|failed to parse schema|schemas parser error|cannot resolve|could not resolve/i.test(
      message
    )
  ) {
    return {
      code: "UBL_XSD_SCHEMA_REFERENCE_ERROR",
      technicalCode: "schema_reference_error"
    };
  }

  return {
    code: "UBL_XSD_VALIDATION_FAILED",
    technicalCode: "xsd_validation_failed"
  };
}

function inferFieldFromXmlName(name: string, context?: UblXsdFindingContext) {
  const localName = stripNamespacePrefix(name);

  if (localName === "ID") {
    const rootElement = context?.rootElement?.toLowerCase() ?? "";

    if (
      name.includes(":") ||
      rootElement === "invoice" ||
      rootElement === "creditnote"
    ) {
      return "document.number";
    }

    return "xml";
  }

  return FIELD_BY_XML_LOCAL_NAME.get(localName) ?? "xml";
}

export function inferUblFieldFromXsdError(
  error: RawUblXsdValidationError,
  context: UblXsdFindingContext = {}
) {
  const message = getErrorMessage(error);
  const classified = classifyXsdError(message);

  if (
    classified.code === "UBL_XSD_NAMESPACE_INVALID" ||
    classified.code === "UBL_XSD_SCHEMA_REFERENCE_ERROR"
  ) {
    return "xml.schema";
  }

  if (classified.code === "UBL_XSD_REQUIRED_ATTRIBUTE_MISSING") {
    const elementName = extractElementName(message);

    return elementName ? inferFieldFromXmlName(elementName, context) : "xml";
  }

  if (classified.code === "UBL_XSD_REQUIRED_ELEMENT_MISSING") {
    const [expectedElement] = extractExpectedElements(message);

    if (expectedElement) {
      const expectedField = inferFieldFromXmlName(expectedElement, context);

      if (expectedField !== "xml") {
        return expectedField;
      }
    }

    const elementName = extractElementName(message);

    if (elementName) {
      return inferFieldFromXmlName(elementName, context);
    }
  }

  const elementName = extractElementName(message);

  if (elementName) {
    return inferFieldFromXmlName(elementName, context);
  }

  const attributeName = extractAttributeName(message);

  if (attributeName === "currencyID") {
    return "xml.amount.currency";
  }

  return "xml";
}

function humanizeXmlName(name: string) {
  if (!name) {
    return "";
  }

  return name;
}

function buildFindingMessage(input: {
  code: string;
  field: string;
  rawMessage: string;
  xmlLine?: number;
}) {
  const elementName = humanizeXmlName(extractElementName(input.rawMessage));
  const attributeName = humanizeXmlName(extractAttributeName(input.rawMessage));
  const [expectedElement] = extractExpectedElements(input.rawMessage);
  const lineSuffix = input.xmlLine ? ` at XML line ${input.xmlLine}` : "";

  if (input.code === "UBL_XSD_REQUIRED_ELEMENT_MISSING") {
    return expectedElement
      ? `The XML is missing the required UBL element ${expectedElement}${lineSuffix} for this local technical XSD check.`
      : `The XML is missing a required UBL element${lineSuffix} for this local technical XSD check.`;
  }

  if (input.code === "UBL_XSD_REQUIRED_ATTRIBUTE_MISSING") {
    return attributeName
      ? `The XML is missing the required UBL attribute ${attributeName}${lineSuffix} for this local technical XSD check.`
      : `The XML is missing a required UBL attribute${lineSuffix} for this local technical XSD check.`;
  }

  if (input.code === "UBL_XSD_ELEMENT_INVALID") {
    return elementName
      ? `The XML contains element ${elementName}${lineSuffix}, which is not expected at that position by the configured local UBL XSD.`
      : `The XML contains an element${lineSuffix} that is not expected at that position by the configured local UBL XSD.`;
  }

  if (input.code === "UBL_XSD_ATTRIBUTE_INVALID") {
    return attributeName
      ? `The XML contains attribute ${attributeName}${lineSuffix}, which is not allowed at that position by the configured local UBL XSD.`
      : `The XML contains an attribute${lineSuffix} that is not allowed at that position by the configured local UBL XSD.`;
  }

  if (input.code === "UBL_XSD_VALUE_INVALID") {
    return `A UBL value${lineSuffix} does not match the datatype or value constraints in the configured local UBL XSD.`;
  }

  if (input.code === "UBL_XSD_TYPE_INVALID") {
    return `A UBL element or attribute${lineSuffix} does not match the type expected by the configured local UBL XSD.`;
  }

  if (input.code === "UBL_XSD_NAMESPACE_INVALID") {
    return `The XML root or namespace declaration${lineSuffix} does not match the configured local UBL XSD.`;
  }

  if (input.code === "UBL_XSD_SCHEMA_REFERENCE_ERROR") {
    return "The configured local UBL XSD schema references could not be resolved safely by the local validator.";
  }

  return `Local UBL XSD validation reported a schema error${lineSuffix}.`;
}

function fixSuggestionForCode(code: string) {
  if (code === "UBL_XSD_REQUIRED_ELEMENT_MISSING") {
    return "Add the required UBL element in the location expected by the configured local XSD, then rerun the technical check.";
  }

  if (code === "UBL_XSD_REQUIRED_ATTRIBUTE_MISSING") {
    return "Add the required UBL attribute to the affected element, then rerun the technical check.";
  }

  if (code === "UBL_XSD_ELEMENT_INVALID") {
    return "Move, rename, or remove the unexpected XML element so the document structure matches the configured local UBL XSD.";
  }

  if (code === "UBL_XSD_ATTRIBUTE_INVALID") {
    return "Remove or rename the unexpected XML attribute, or place it only where the configured local UBL XSD allows it.";
  }

  if (code === "UBL_XSD_VALUE_INVALID" || code === "UBL_XSD_TYPE_INVALID") {
    return "Review the affected XML value against the datatype expected by the configured local UBL XSD.";
  }

  if (code === "UBL_XSD_NAMESPACE_INVALID") {
    return "Check the document root element and namespace declarations against the local UBL Invoice or CreditNote XSD selected for this sandbox check.";
  }

  if (code === "UBL_XSD_SCHEMA_REFERENCE_ERROR") {
    return "Review the configured local XSD artefact graph and rerun the check after schema references resolve locally.";
  }

  return "Review the XML structure and values against the configured local UBL XSD artefacts, then rerun the technical check.";
}

export function buildUblXsdFindingFromError(
  error: RawUblXsdValidationError,
  context: UblXsdFindingContext = {}
): UblXsdMappedFinding {
  const rawMessage = getErrorMessage(error);
  const technicalMessage = normalizeXsdTechnicalMessage(rawMessage);
  const classified = classifyXsdError(rawMessage);
  const xmlLine = getXmlLine(error);
  const field = inferUblFieldFromXsdError(error, context);
  const finding: UblXsdMappedFinding = {
    code: classified.code,
    severity: "fatal",
    checkType: UBL_XSD_CHECK_TYPE,
    field,
    message: buildFindingMessage({
      code: classified.code,
      field,
      rawMessage,
      ...(xmlLine ? { xmlLine } : {})
    }),
    status: "failed",
    legalConfidence: "technical",
    fixSuggestion: fixSuggestionForCode(classified.code),
    sourceLabels: [...UBL_XSD_SOURCE_LABELS],
    technicalCode: classified.technicalCode
  };

  if (technicalMessage) {
    finding.technicalMessage = technicalMessage;
  }

  if (xmlLine) {
    finding.xmlLine = xmlLine;
  }

  return finding;
}

export function buildUblXsdValidatorErrorFinding(input: {
  message: string;
  status?: Extract<UblXsdMappedFindingStatus, "error" | "not_configured">;
  code?: string;
  field?: string;
  fixSuggestion?: string;
}): UblXsdMappedFinding {
  const technicalMessage = normalizeXsdTechnicalMessage(input.message);
  const code = input.code ?? "UBL_XSD_VALIDATOR_ERROR";
  const finding: UblXsdMappedFinding = {
    code,
    severity: "warning",
    checkType: UBL_XSD_CHECK_TYPE,
    field: input.field ?? "xml",
    message:
      code === "UBL_XSD_NOT_CONFIGURED"
        ? input.message
        : "Local UBL XSD validation could not complete because the configured validator or schema artefacts reported a controlled technical error.",
    status: input.status ?? "error",
    legalConfidence: "technical",
    fixSuggestion:
      input.fixSuggestion ??
      "Review the configured local XSD artefacts and validator runtime before rerunning this technical check.",
    sourceLabels: [...UBL_XSD_SOURCE_LABELS],
    technicalCode:
      code === "UBL_XSD_SCHEMA_REFERENCE_ERROR"
        ? "schema_reference_error"
        : "validator_error"
  };

  if (technicalMessage && technicalMessage !== finding.message) {
    finding.technicalMessage = technicalMessage;
  }

  return finding;
}

export function mapUblXsdValidationErrors(input: {
  errors: readonly RawUblXsdValidationError[];
  context?: UblXsdFindingContext;
  maxFindings?: number;
}) {
  const maxFindings = Math.max(Math.min(input.maxFindings ?? 25, 100), 1);
  const errors = input.errors.slice(0, maxFindings);

  if (errors.length === 0) {
    return [
      {
        code: "UBL_XSD_VALIDATION_FAILED",
        severity: "fatal" as const,
        checkType: UBL_XSD_CHECK_TYPE,
        field: "xml",
        message:
          "Local UBL XSD validation executed and reported that the XML failed schema validation.",
        status: "failed" as const,
        legalConfidence: "technical" as const,
        fixSuggestion:
          "Review the XML against the configured local UBL XSD artefacts.",
        sourceLabels: [...UBL_XSD_SOURCE_LABELS],
        technicalCode: "xsd_validation_failed"
      }
    ];
  }

  return errors.map((error) =>
    buildUblXsdFindingFromError(error, input.context ?? {})
  );
}
