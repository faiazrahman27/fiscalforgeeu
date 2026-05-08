import {
  buildSchematronFutureRuleFinding,
  normalizeSchematronLayer,
  sanitizeSchematronText,
  type SchematronContractFinding,
  type SchematronFindingCode,
  type SchematronFindingSeverity,
  type SchematronFindingStatus,
  type SchematronLayer
} from "./schematron-finding-contract.js";

export const SCHEMATRON_RESULT_MAPPER_VERSION =
  "schematron_result_mapper_v1";

export type SchematronSvrlFlag =
  | "fatal"
  | "error"
  | "warning"
  | "info"
  | "unknown";

export type SchematronSvrlResultKind =
  | "failed_assert"
  | "successful_report";

export type SchematronSvrlInputResult = {
  kind: SchematronSvrlResultKind;
  id?: string;
  flag?: string;
  location?: string;
  test?: string;
  text?: string;
  role?: string;
  diagnostics?: string[];
  diagnosticReference?: string;
  see?: string;
  layer?: SchematronLayer;
  businessRuleId?: string;
};

export type SchematronResultMappingInput = {
  layer?: SchematronLayer;
  results: SchematronSvrlInputResult[];
  maxResults?: number;
};

export type SchematronResultMappingSummary = {
  mapperVersion: typeof SCHEMATRON_RESULT_MAPPER_VERSION;
  diagnosticKind: "schematron_result_mapping";
  layer: SchematronLayer;
  inputResultCount: number;
  mappedFindingCount: number;
  failedAssertCount: number;
  successfulReportCount: number;
  fatalCount: number;
  warningCount: number;
  infoCount: number;
  truncated: boolean;
};

export type SchematronResultMappingResult = {
  mapperVersion: typeof SCHEMATRON_RESULT_MAPPER_VERSION;
  findings: SchematronContractFinding[];
  summary: SchematronResultMappingSummary;
};

const DEFAULT_MAX_RESULTS = 500;
const MAX_RESULT_LIMIT = 5000;
const UNSAFE_SANITIZED_MARKERS = [
  "[xml-fragment]",
  "[local-path]",
  "[local-file-reference]"
];
const FORBIDDEN_ASSURANCE_CLAIM_PATTERN =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/gi;

function sanitizeMapperText(value: unknown, maxLength?: number) {
  return sanitizeSchematronText(value, maxLength)
    .replace(FORBIDDEN_ASSURANCE_CLAIM_PATTERN, "[assurance-claim]")
    .replace(/\s+/g, " ")
    .trim();
}

function optionalMapperText(value: unknown, maxLength?: number) {
  const sanitized = sanitizeMapperText(value, maxLength);

  return sanitized.length > 0 ? sanitized : undefined;
}

function normalizeMaxResults(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_MAX_RESULTS;
  }

  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.max(0, Math.min(Math.floor(value), MAX_RESULT_LIMIT));
}

export function normalizeSchematronSvrlFlag(
  value: unknown
): SchematronSvrlFlag {
  const token = sanitizeMapperText(value, 80).toLowerCase();

  if (token === "fatal") {
    return "fatal";
  }

  if (token === "error" || token === "err") {
    return "error";
  }

  if (token === "warning" || token === "warn") {
    return "warning";
  }

  if (
    token === "info" ||
    token === "information" ||
    token === "informational"
  ) {
    return "info";
  }

  return "unknown";
}

function isInfoRole(value: unknown) {
  const token = sanitizeMapperText(value, 120).toLowerCase();

  return /(^|[\s_-])(info|information|informational|notice)($|[\s_-])/.test(
    token
  );
}

function severityForFailedAssert(
  flag: SchematronSvrlFlag
): SchematronFindingSeverity {
  if (flag === "fatal" || flag === "error") {
    return "fatal";
  }

  if (flag === "info") {
    return "info";
  }

  return "warning";
}

function severityForSuccessfulReport(input: {
  flag: SchematronSvrlFlag;
  role?: string | undefined;
}): SchematronFindingSeverity {
  if (input.flag === "info" || isInfoRole(input.role)) {
    return "info";
  }

  return "warning";
}

function findingCodeForFailedAssert(
  layer: SchematronLayer
): SchematronFindingCode {
  if (layer === "peppol_bis_billing") {
    return "PEPPOL_SCHEMATRON_RULE_FAILED";
  }

  if (layer === "en16931_tc434") {
    return "EN16931_SCHEMATRON_RULE_FAILED";
  }

  return "SCHEMATRON_ASSERTION_FAILED";
}

function statusForResult(input: {
  kind: SchematronSvrlResultKind;
}): SchematronFindingStatus {
  return input.kind === "failed_assert" ? "failed" : "warning";
}

function messageForResult(input: {
  kind: SchematronSvrlResultKind;
  text?: string | undefined;
}) {
  const sanitizedText = optionalMapperText(input.text, 700);

  if (sanitizedText) {
    return sanitizedText;
  }

  if (input.kind === "failed_assert") {
    return "A Schematron assertion failed for this XML document.";
  }

  return "A Schematron report item was mapped as a technical warning.";
}

function fieldFromLocation(location: unknown) {
  const field = sanitizeMapperText(location, 160);

  if (!field) {
    return "xml";
  }

  if (UNSAFE_SANITIZED_MARKERS.some((marker) => field.includes(marker))) {
    return "xml";
  }

  return field;
}

function diagnosticReferenceForResult(result: SchematronSvrlInputResult) {
  const parts = [
    optionalMapperText(result.diagnosticReference, 240),
    ...(Array.isArray(result.diagnostics)
      ? result.diagnostics.map((diagnostic) =>
          optionalMapperText(diagnostic, 240)
        )
      : []),
    optionalMapperText(result.see, 240)
  ].filter((part): part is string => Boolean(part));
  const uniqueParts = [...new Set(parts)];

  return uniqueParts.length > 0
    ? optionalMapperText(uniqueParts.join(" | "), 240)
    : undefined;
}

function sourceLabelsForResult(input: {
  code: SchematronFindingCode;
  ruleId?: string | undefined;
  businessRuleId?: string | undefined;
}) {
  return [
    "Schematron result mapper",
    SCHEMATRON_RESULT_MAPPER_VERSION,
    input.code,
    ...(input.ruleId ? [input.ruleId] : []),
    ...(input.businessRuleId ? [input.businessRuleId] : [])
  ].map((label) => sanitizeMapperText(label, 120));
}

function mapResultToFinding(input: {
  result: SchematronSvrlInputResult;
  defaultLayer: SchematronLayer;
}) {
  const layer = normalizeSchematronLayer(
    input.result.layer ?? input.defaultLayer
  );
  const flag = normalizeSchematronSvrlFlag(input.result.flag);
  const severity =
    input.result.kind === "failed_assert"
      ? severityForFailedAssert(flag)
      : severityForSuccessfulReport({
          flag,
          role: input.result.role
        });
  const code =
    input.result.kind === "failed_assert"
      ? findingCodeForFailedAssert(layer)
      : "SCHEMATRON_REPORT_WARNING";
  const ruleId = optionalMapperText(input.result.id, 120);
  const businessRuleId = optionalMapperText(input.result.businessRuleId, 120);

  return buildSchematronFutureRuleFinding({
    layer,
    code,
    ruleId,
    businessRuleId,
    severity,
    status: statusForResult({
      kind: input.result.kind
    }),
    legalConfidence: "technical",
    field: fieldFromLocation(input.result.location),
    message: messageForResult({
      kind: input.result.kind,
      text: input.result.text
    }),
    ruleLocation: optionalMapperText(input.result.location, 300),
    testExpression: optionalMapperText(input.result.test, 500),
    assertionText: optionalMapperText(input.result.text, 500),
    diagnosticReference: diagnosticReferenceForResult(input.result),
    sourceLabels: sourceLabelsForResult({
      code,
      ruleId,
      businessRuleId
    }),
    technicalCode: code
  });
}

export function mapSchematronSvrlResultsToFindings(
  input: SchematronResultMappingInput
): SchematronResultMappingResult {
  const layer = normalizeSchematronLayer(input.layer);
  const maxResults = normalizeMaxResults(input.maxResults);
  const inputResults = Array.isArray(input.results) ? input.results : [];
  const mappedResults = inputResults.slice(0, maxResults);
  const findings = mappedResults.map((result) =>
    mapResultToFinding({
      result,
      defaultLayer: layer
    })
  );
  const summary = findings.reduce<SchematronResultMappingSummary>(
    (current, finding) => {
      if (finding.status === "failed") {
        current.failedAssertCount += 1;
      } else {
        current.successfulReportCount += 1;
      }

      if (finding.severity === "fatal") {
        current.fatalCount += 1;
      } else if (finding.severity === "info") {
        current.infoCount += 1;
      } else {
        current.warningCount += 1;
      }

      return current;
    },
    {
      mapperVersion: SCHEMATRON_RESULT_MAPPER_VERSION,
      diagnosticKind: "schematron_result_mapping",
      layer,
      inputResultCount: inputResults.length,
      mappedFindingCount: findings.length,
      failedAssertCount: 0,
      successfulReportCount: 0,
      fatalCount: 0,
      warningCount: 0,
      infoCount: 0,
      truncated: inputResults.length > mappedResults.length
    }
  );

  return {
    mapperVersion: SCHEMATRON_RESULT_MAPPER_VERSION,
    findings,
    summary
  };
}
