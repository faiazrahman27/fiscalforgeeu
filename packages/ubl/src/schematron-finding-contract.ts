export const SCHEMATRON_FINDING_CONTRACT_VERSION =
  "schematron_contract_v1";

export const SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES = [
  "SCHEMATRON_EXECUTION_NOT_ENABLED",
  "SCHEMATRON_ARTIFACT_NOT_CONFIGURED",
  "SCHEMATRON_ARTIFACT_UNREADABLE",
  "SCHEMATRON_ASSERTION_FAILED",
  "SCHEMATRON_REPORT_WARNING",
  "PEPPOL_SCHEMATRON_RULE_FAILED",
  "EN16931_SCHEMATRON_RULE_FAILED",
  "SCHEMATRON_EXECUTION_ERROR"
] as const;

export type SchematronLayer =
  | "peppol_bis_billing"
  | "en16931_tc434"
  | "unknown";

export type SchematronFindingStatus =
  | "not_configured"
  | "not_implemented"
  | "failed"
  | "warning"
  | "passed"
  | "error";

export type SchematronFindingSeverity = "info" | "warning" | "fatal";

export type SchematronFindingLegalConfidence =
  | "technical"
  | "educational_simulation";

export type SchematronFindingCode =
  (typeof SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES)[number];

export type SchematronContractFinding = {
  code: SchematronFindingCode;
  severity: SchematronFindingSeverity;
  checkType: "schematron_peppol_placeholder";
  field: string;
  message: string;
  status: SchematronFindingStatus;
  legalConfidence: SchematronFindingLegalConfidence;
  fixSuggestion?: string;
  sourceLabels?: string[];
  schematronLayer?: SchematronLayer;
  ruleId?: string;
  businessRuleId?: string;
  ruleLocation?: string;
  testExpression?: string;
  assertionText?: string;
  diagnosticReference?: string;
  technicalMessage?: string;
  technicalCode?: string;
  xmlLine?: number;
};

export type BuildSchematronFutureRuleFindingInput = {
  layer: unknown;
  code?: SchematronFindingCode;
  ruleId?: unknown;
  businessRuleId?: unknown;
  severity?: SchematronFindingSeverity;
  message?: unknown;
  field?: unknown;
  status?: SchematronFindingStatus;
  legalConfidence?: SchematronFindingLegalConfidence;
  fixSuggestion?: unknown;
  sourceLabels?: unknown;
  ruleLocation?: unknown;
  testExpression?: unknown;
  assertionText?: unknown;
  diagnosticReference?: unknown;
  technicalMessage?: unknown;
  technicalCode?: unknown;
  xmlLine?: unknown;
};

const DEFAULT_TEXT_MAX_LENGTH = 700;
const XML_ESCAPED_ELEMENT_WITH_CONTENT_PATTERN =
  /&lt;([A-Za-z_][\w:.-]*)(?:\s[^&]*)?&gt;[\s\S]*?&lt;\/\1&gt;/gi;
const XML_ELEMENT_WITH_CONTENT_PATTERN =
  /<([A-Za-z_][\w:.-]*)(?:\s[^<>]*)?>[\s\S]*?<\/\1>/g;
const XML_ESCAPED_TAG_PATTERN = /&lt;\/?[A-Za-z_][\w:.-]*(?:\s[^&]*)?\/?&gt;/gi;
const XML_TAG_PATTERN = /<\/?[A-Za-z_][\w:.-]*(?:\s[^<>]*)?\/?>/g;
const WINDOWS_ABSOLUTE_PATH_PATTERN =
  /\b[A-Za-z]:[\\/][^\s"'<>|]+(?:[\\/][^\s"'<>|]+)*/g;
const FILE_URL_PATTERN = /\bfile:\/\/\/?[^\s"'<>]+/gi;
const UNIX_ABSOLUTE_PATH_PATTERN =
  /(?<![\w:])\/(?:home|tmp|Users)\/[^\s"'<>]+/g;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/g;

function valueToString(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return "";
}

export function sanitizeSchematronText(
  value: unknown,
  maxLength = DEFAULT_TEXT_MAX_LENGTH
): string {
  const boundedMaxLength = Math.max(0, Math.min(maxLength, 2000));

  if (boundedMaxLength === 0) {
    return "";
  }

  return valueToString(value)
    .replace(CONTROL_CHARACTER_PATTERN, " ")
    .replace(XML_ESCAPED_ELEMENT_WITH_CONTENT_PATTERN, "[xml-fragment]")
    .replace(XML_ELEMENT_WITH_CONTENT_PATTERN, "[xml-fragment]")
    .replace(XML_ESCAPED_TAG_PATTERN, "[xml-fragment]")
    .replace(XML_TAG_PATTERN, "[xml-fragment]")
    .replace(FILE_URL_PATTERN, "[local-file-reference]")
    .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, "[local-path]")
    .replace(UNIX_ABSOLUTE_PATH_PATTERN, "[local-path]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, boundedMaxLength);
}

export function normalizeSchematronLayer(value: unknown): SchematronLayer {
  return value === "peppol_bis_billing" || value === "en16931_tc434"
    ? value
    : "unknown";
}

function optionalSanitizedText(value: unknown, maxLength?: number) {
  const sanitized = sanitizeSchematronText(value, maxLength);

  return sanitized.length > 0 ? sanitized : undefined;
}

function optionalXmlLine(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function sanitizeSourceLabels(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const labels = value
    .map((label) => sanitizeSchematronText(label, 120))
    .filter((label) => label.length > 0);

  return labels.length > 0 ? [...new Set(labels)] : undefined;
}

function defaultRuleFindingCode(input: {
  layer: SchematronLayer;
  severity: SchematronFindingSeverity;
  status: SchematronFindingStatus;
}): SchematronFindingCode {
  if (input.status === "error") {
    return "SCHEMATRON_EXECUTION_ERROR";
  }

  if (input.status === "warning" || input.severity === "warning") {
    return "SCHEMATRON_REPORT_WARNING";
  }

  if (input.layer === "peppol_bis_billing") {
    return "PEPPOL_SCHEMATRON_RULE_FAILED";
  }

  if (input.layer === "en16931_tc434") {
    return "EN16931_SCHEMATRON_RULE_FAILED";
  }

  return "SCHEMATRON_ASSERTION_FAILED";
}

export function buildSchematronExecutionDisabledFinding(
  input: {
    configured?: boolean;
    usable?: boolean;
  } = {}
): SchematronContractFinding {
  const sourceLabels = [
    "Schematron finding contract",
    "SCHEMATRON_EXECUTION_NOT_ENABLED",
    ...(input.configured === false
      ? ["Schematron artefact metadata not configured"]
      : []),
    ...(input.usable === false ? ["Schematron artefact metadata not usable"] : [])
  ];

  return {
    code: "SCHEMATRON_EXECUTION_NOT_ENABLED",
    severity: "warning",
    checkType: "schematron_peppol_placeholder",
    field: "xml",
    message:
      "Schematron execution is disabled for this XML validation job. This placeholder reports metadata only and does not run Peppol BIS Billing or EN 16931 rules.",
    status: "not_implemented",
    legalConfidence: "educational_simulation",
    fixSuggestion:
      "Use these metadata-only diagnostics to prepare reviewed local artefacts; enable a future Schematron execution worker before relying on business-rule checks.",
    sourceLabels,
    schematronLayer: "peppol_bis_billing",
    technicalCode: "SCHEMATRON_EXECUTION_NOT_ENABLED"
  };
}

export function buildSchematronArtifactNotConfiguredFinding(
  input: {
    layer?: SchematronLayer;
  } = {}
): SchematronContractFinding {
  const layer = normalizeSchematronLayer(input.layer);

  return {
    code: "SCHEMATRON_ARTIFACT_NOT_CONFIGURED",
    severity: "warning",
    checkType: "schematron_peppol_placeholder",
    field: "xml.schematron",
    message:
      "Local Schematron artefact metadata is not configured for this layer. No Schematron rule execution ran.",
    status: "not_configured",
    legalConfidence: "technical",
    fixSuggestion:
      "Configure reviewed local Schematron artefact paths before enabling a future Schematron execution worker.",
    sourceLabels: [
      "Schematron finding contract",
      "SCHEMATRON_ARTIFACT_NOT_CONFIGURED"
    ],
    schematronLayer: layer,
    technicalCode: "SCHEMATRON_ARTIFACT_NOT_CONFIGURED"
  };
}

export function buildSchematronArtifactUnreadableFinding(input: {
  layer: SchematronLayer;
  reason?: string;
}): SchematronContractFinding {
  const technicalMessage = optionalSanitizedText(input.reason, 240);

  return {
    code: "SCHEMATRON_ARTIFACT_UNREADABLE",
    severity: "warning",
    checkType: "schematron_peppol_placeholder",
    field: "xml.schematron",
    message:
      "A configured local Schematron artefact could not be read safely. No Schematron rule execution ran.",
    status: "error",
    legalConfidence: "technical",
    fixSuggestion:
      "Review the configured local Schematron artefact path and file permissions before enabling a future execution worker.",
    sourceLabels: [
      "Schematron finding contract",
      "SCHEMATRON_ARTIFACT_UNREADABLE"
    ],
    schematronLayer: normalizeSchematronLayer(input.layer),
    technicalCode: "SCHEMATRON_ARTIFACT_UNREADABLE",
    ...(technicalMessage ? { technicalMessage } : {})
  };
}

export function buildSchematronFutureRuleFinding(
  input: BuildSchematronFutureRuleFindingInput
): SchematronContractFinding {
  const layer = normalizeSchematronLayer(input.layer);
  const severity = input.severity ?? "fatal";
  const status = input.status ?? (severity === "warning" ? "warning" : "failed");
  const code =
    input.code ??
    defaultRuleFindingCode({
      layer,
      severity,
      status
    });
  const field = optionalSanitizedText(input.field, 160) ?? "xml";
  const message =
    optionalSanitizedText(input.message) ??
    "A future Schematron rule finding was mapped for this XML document.";
  const finding: SchematronContractFinding = {
    code,
    severity,
    checkType: "schematron_peppol_placeholder",
    field,
    message,
    status,
    legalConfidence: input.legalConfidence ?? "technical",
    schematronLayer: layer,
    technicalCode: code
  };
  const fixSuggestion = optionalSanitizedText(input.fixSuggestion);
  const sourceLabels = sanitizeSourceLabels(input.sourceLabels);
  const ruleId = optionalSanitizedText(input.ruleId, 120);
  const businessRuleId = optionalSanitizedText(input.businessRuleId, 120);
  const ruleLocation = optionalSanitizedText(input.ruleLocation, 300);
  const testExpression = optionalSanitizedText(input.testExpression, 500);
  const assertionText = optionalSanitizedText(input.assertionText, 500);
  const diagnosticReference = optionalSanitizedText(
    input.diagnosticReference,
    240
  );
  const technicalMessage = optionalSanitizedText(input.technicalMessage);
  const technicalCode = optionalSanitizedText(input.technicalCode, 160);
  const xmlLine = optionalXmlLine(input.xmlLine);

  if (fixSuggestion) {
    finding.fixSuggestion = fixSuggestion;
  }

  if (sourceLabels) {
    finding.sourceLabels = sourceLabels;
  }

  if (ruleId) {
    finding.ruleId = ruleId;
  }

  if (businessRuleId) {
    finding.businessRuleId = businessRuleId;
  }

  if (ruleLocation) {
    finding.ruleLocation = ruleLocation;
  }

  if (testExpression) {
    finding.testExpression = testExpression;
  }

  if (assertionText) {
    finding.assertionText = assertionText;
  }

  if (diagnosticReference) {
    finding.diagnosticReference = diagnosticReference;
  }

  if (technicalMessage) {
    finding.technicalMessage = technicalMessage;
  }

  if (technicalCode) {
    finding.technicalCode = technicalCode;
  }

  if (xmlLine) {
    finding.xmlLine = xmlLine;
  }

  return finding;
}
