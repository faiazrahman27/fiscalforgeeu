import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  buildSchematronExecutionDisabledFinding,
  buildSchematronFutureRuleFinding,
  normalizeSchematronLayer,
  sanitizeSchematronText,
  type SchematronContractFinding,
  type SchematronFindingCode
} from "./schematron-finding-contract.js";

export const SCHEMATRON_LOCAL_EXECUTION_PROTOTYPE_VERSION =
  "schematron_local_execution_prototype_v1";

export type SchematronLocalPrototypeLayer =
  | "peppol_bis_billing"
  | "en16931_tc434"
  | "unknown";

export type SchematronLocalPrototypeExecutionMode =
  | "disabled"
  | "internal_test_only";

export type SchematronLocalPrototypeStatus =
  | "disabled"
  | "executed"
  | "failed"
  | "unsupported"
  | "unsafe_input";

export type SchematronLocalPrototypeRule = {
  ruleId: string;
  businessRuleId?: string;
  layer?: SchematronLocalPrototypeLayer;
  context: string;
  test: string;
  message: string;
  severity?: "warning" | "fatal";
  field?: string;
};

export type SchematronLocalPrototypeInput = {
  xml: string;
  rules: SchematronLocalPrototypeRule[];
  mode?: SchematronLocalPrototypeExecutionMode;
  layer?: SchematronLocalPrototypeLayer;
  maxXmlBytes?: number;
  maxRules?: number;
  timeoutMs?: number;
};

export type SchematronLocalPrototypeResult = {
  prototypeVersion: typeof SCHEMATRON_LOCAL_EXECUTION_PROTOTYPE_VERSION;
  mode: SchematronLocalPrototypeExecutionMode;
  status: SchematronLocalPrototypeStatus;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: false;
  selectedLayer: SchematronLocalPrototypeLayer;
  ruleCount: number;
  executedRuleCount: number;
  failedRuleCount: number;
  warningCount: number;
  fatalCount: number;
  reason: string;
  findings: SchematronContractFinding[];
  safeSummary: {
    diagnosticKind: "schematron_local_execution_prototype";
    prototypeVersion: string;
    mode: SchematronLocalPrototypeExecutionMode;
    status: SchematronLocalPrototypeStatus;
    validationExecutionEnabled: boolean;
    validationExecuted: boolean;
    markedValid: false;
    selectedLayer: SchematronLocalPrototypeLayer;
    ruleCount: number;
    executedRuleCount: number;
    failedRuleCount: number;
    warningCount: number;
    fatalCount: number;
    reason: string;
  };
};

const DEFAULT_MAX_XML_BYTES = 256 * 1024;
const DEFAULT_MAX_RULES = 50;
const DEFAULT_TIMEOUT_MS = 1000;
const MAX_CONTEXT_NODES_PER_RULE = 200;

const prototypeXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  alwaysCreateTextNode: true
});

class UnsupportedPrototypeExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedPrototypeExpressionError";
  }
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number
) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function buildResult(input: {
  mode: SchematronLocalPrototypeExecutionMode;
  status: SchematronLocalPrototypeStatus;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  selectedLayer: SchematronLocalPrototypeLayer;
  ruleCount: number;
  executedRuleCount: number;
  failedRuleCount: number;
  warningCount: number;
  fatalCount: number;
  reason: string;
  findings: SchematronContractFinding[];
}): SchematronLocalPrototypeResult {
  const base = {
    prototypeVersion: SCHEMATRON_LOCAL_EXECUTION_PROTOTYPE_VERSION,
    mode: input.mode,
    status: input.status,
    validationExecutionEnabled: input.validationExecutionEnabled,
    validationExecuted: input.validationExecuted,
    markedValid: false,
    selectedLayer: input.selectedLayer,
    ruleCount: input.ruleCount,
    executedRuleCount: input.executedRuleCount,
    failedRuleCount: input.failedRuleCount,
    warningCount: input.warningCount,
    fatalCount: input.fatalCount,
    reason: input.reason
  } satisfies Omit<SchematronLocalPrototypeResult, "findings" | "safeSummary">;

  return {
    ...base,
    findings: input.findings,
    safeSummary: {
      diagnosticKind: "schematron_local_execution_prototype",
      ...base
    }
  };
}

function buildPrototypeErrorFinding(input: {
  selectedLayer: SchematronLocalPrototypeLayer;
  reason: string;
}): SchematronContractFinding {
  return buildSchematronFutureRuleFinding({
    layer: input.selectedLayer,
    code: "SCHEMATRON_EXECUTION_ERROR",
    severity: "warning",
    status: "error",
    field: "xml.schematron",
    message:
      "The internal Schematron local execution prototype could not safely run the requested rule set.",
    sourceLabels: [
      "Schematron local execution prototype",
      "SCHEMATRON_EXECUTION_ERROR"
    ],
    technicalCode: "SCHEMATRON_EXECUTION_ERROR",
    technicalMessage: input.reason
  });
}

function inspectPrototypeXmlSafety(input: {
  xml: string;
  maxXmlBytes: number;
}) {
  const byteLength = getUtf8ByteLength(input.xml);

  if (byteLength > input.maxXmlBytes) {
    return {
      safe: false,
      reason: "schematron_local_execution_prototype_xml_too_large"
    };
  }

  if (/<!DOCTYPE/i.test(input.xml)) {
    return {
      safe: false,
      reason: "schematron_local_execution_prototype_doctype_blocked"
    };
  }

  if (/<!ENTITY/i.test(input.xml)) {
    return {
      safe: false,
      reason: "schematron_local_execution_prototype_entity_blocked"
    };
  }

  if (/\bSYSTEM\b/i.test(input.xml) || /\bPUBLIC\b/i.test(input.xml)) {
    return {
      safe: false,
      reason: "schematron_local_execution_prototype_external_identifier_blocked"
    };
  }

  if (/<\?xml-stylesheet/i.test(input.xml)) {
    return {
      safe: false,
      reason: "schematron_local_execution_prototype_stylesheet_blocked"
    };
  }

  return {
    safe: true,
    reason: ""
  };
}

export function normalizeSchematronLocalPrototypeLayer(
  value: unknown
): SchematronLocalPrototypeLayer {
  return normalizeSchematronLayer(value);
}

export function sanitizeSchematronPrototypeRule(
  rule: SchematronLocalPrototypeRule
): SchematronLocalPrototypeRule {
  const sanitized: SchematronLocalPrototypeRule = {
    ruleId: sanitizeSchematronText(rule.ruleId, 120),
    context: sanitizeSchematronText(rule.context, 300),
    test: sanitizeSchematronText(rule.test, 500),
    message: sanitizeSchematronText(rule.message, 700),
    layer: normalizeSchematronLocalPrototypeLayer(rule.layer),
    severity: rule.severity === "warning" ? "warning" : "fatal"
  };
  const businessRuleId = sanitizeSchematronText(rule.businessRuleId, 120);
  const field = sanitizeSchematronText(rule.field, 160);

  if (businessRuleId) {
    sanitized.businessRuleId = businessRuleId;
  }

  if (field) {
    sanitized.field = field;
  }

  return sanitized;
}

function normalizePathSegment(segment: string) {
  const cleaned = segment.trim();

  return cleaned.includes(":")
    ? cleaned.split(":").pop()?.trim() ?? cleaned
    : cleaned;
}

function splitPrototypePath(path: string) {
  return path
    .trim()
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => normalizePathSegment(segment))
    .filter((segment) => segment.length > 0);
}

function isSupportedPathExpression(path: string) {
  const trimmed = path.trim();

  if (trimmed === "." || trimmed === "") {
    return true;
  }

  if (trimmed.startsWith("//")) {
    const descendantName = normalizePathSegment(trimmed.slice(2));

    return /^[A-Za-z_][\w.-]*$/.test(descendantName);
  }

  return splitPrototypePath(trimmed).every((segment) =>
    /^[A-Za-z_][\w.-]*$/.test(segment)
  );
}

function getFirstDocumentEntry(parsedXml: unknown) {
  if (!isPlainObject(parsedXml)) {
    return null;
  }

  const entry = Object.entries(parsedXml).find(([key]) => {
    return !key.startsWith("?") && !key.startsWith("@_");
  });

  if (!entry) {
    return null;
  }

  return {
    name: normalizePathSegment(entry[0]),
    node: Array.isArray(entry[1]) ? entry[1][0] : entry[1]
  };
}

function getDirectChildren(node: unknown, tagName: string) {
  if (!isPlainObject(node)) {
    return [];
  }

  const normalizedTagName = normalizePathSegment(tagName);
  const children: unknown[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("@_") || key === "#text") {
      continue;
    }

    if (normalizePathSegment(key) === normalizedTagName) {
      children.push(...asArray(value));
    }
  }

  return children;
}

function collectDescendantNodes(
  node: unknown,
  tagName: string,
  results: unknown[] = []
) {
  if (results.length >= MAX_CONTEXT_NODES_PER_RULE) {
    return results;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectDescendantNodes(item, tagName, results);

      if (results.length >= MAX_CONTEXT_NODES_PER_RULE) {
        break;
      }
    }

    return results;
  }

  if (!isPlainObject(node)) {
    return results;
  }

  const normalizedTagName = normalizePathSegment(tagName);

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("@_") || key === "#text") {
      continue;
    }

    if (normalizePathSegment(key) === normalizedTagName) {
      for (const child of asArray(value)) {
        if (results.length >= MAX_CONTEXT_NODES_PER_RULE) {
          break;
        }

        results.push(child);
      }
    }

    collectDescendantNodes(value, tagName, results);

    if (results.length >= MAX_CONTEXT_NODES_PER_RULE) {
      break;
    }
  }

  return results;
}

function selectNodes(input: {
  parsedXml: unknown;
  contextNode?: unknown;
  path: string;
}) {
  const path = input.path.trim();

  if (!isSupportedPathExpression(path)) {
    throw new UnsupportedPrototypeExpressionError(
      "schematron_local_execution_prototype_unsupported_path"
    );
  }

  if (path === "." || path === "") {
    return input.contextNode === undefined ? [] : [input.contextNode];
  }

  const rootEntry = getFirstDocumentEntry(input.parsedXml);

  if (!rootEntry) {
    return [];
  }

  if (path.startsWith("//")) {
    return collectDescendantNodes(rootEntry.node, path.slice(2));
  }

  const segments = splitPrototypePath(path);
  let nodes: unknown[] =
    input.contextNode === undefined ? [rootEntry.node] : [input.contextNode];
  const firstSegment = segments[0];
  const remainingSegments =
    input.contextNode === undefined && firstSegment === rootEntry.name
      ? segments.slice(1)
      : segments;

  for (const segment of remainingSegments) {
    nodes = nodes.flatMap((node) => getDirectChildren(node, segment));

    if (nodes.length === 0) {
      break;
    }
  }

  return nodes.slice(0, MAX_CONTEXT_NODES_PER_RULE);
}

function nodeToText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => nodeToText(item)).filter(Boolean).join(" ");
  }

  if (!isPlainObject(value)) {
    return "";
  }

  const ownText = value["#text"];

  if (typeof ownText === "string" && ownText.trim()) {
    return ownText.trim();
  }

  if (typeof ownText === "number" || typeof ownText === "boolean") {
    return String(ownText);
  }

  return Object.entries(value)
    .filter(([key]) => !key.startsWith("@_") && key !== "#text")
    .map(([, child]) => nodeToText(child))
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getPathStringValue(input: {
  parsedXml: unknown;
  contextNode: unknown;
  path: string;
}) {
  const nodes = selectNodes({
    parsedXml: input.parsedXml,
    contextNode: input.contextNode,
    path: input.path
  });

  return nodeToText(nodes[0]).trim();
}

function getPathCount(input: {
  parsedXml: unknown;
  contextNode: unknown;
  path: string;
}) {
  return selectNodes({
    parsedXml: input.parsedXml,
    contextNode: input.contextNode,
    path: input.path
  }).length;
}

function compareNumbers(input: {
  actual: number;
  operator: string;
  expected: number;
}) {
  switch (input.operator) {
    case "=":
      return input.actual === input.expected;
    case "!=":
      return input.actual !== input.expected;
    case ">":
      return input.actual > input.expected;
    case ">=":
      return input.actual >= input.expected;
    case "<":
      return input.actual < input.expected;
    case "<=":
      return input.actual <= input.expected;
    default:
      throw new UnsupportedPrototypeExpressionError(
        "schematron_local_execution_prototype_unsupported_numeric_operator"
      );
  }
}

function compareStrings(input: {
  actual: string;
  operator: string;
  expected: string;
}) {
  if (input.operator === "=") {
    return input.actual === input.expected;
  }

  if (input.operator === "!=") {
    return input.actual !== input.expected;
  }

  throw new UnsupportedPrototypeExpressionError(
    "schematron_local_execution_prototype_unsupported_string_operator"
  );
}

function stripNormalizeSpaceExpression(expression: string) {
  const match = expression.match(/^normalize-space\(([^)]+)\)$/);

  return match?.[1]?.trim() ?? null;
}

function evaluatePrototypeTest(input: {
  parsedXml: unknown;
  contextNode: unknown;
  test: string;
}): boolean {
  const test = input.test.trim();

  if (test === "true()") {
    return true;
  }

  if (test === "false()") {
    return false;
  }

  const notMatch = test.match(/^not\(([\s\S]+)\)$/);

  if (notMatch?.[1]) {
    return !evaluatePrototypeTest({
      ...input,
      test: notMatch[1]
    });
  }

  const existsMatch = test.match(/^exists\(([^)]+)\)$/);

  if (existsMatch?.[1]) {
    return (
      getPathCount({
        parsedXml: input.parsedXml,
        contextNode: input.contextNode,
        path: existsMatch[1]
      }) > 0
    );
  }

  const countMatch = test.match(
    /^count\(([^)]+)\)\s*(=|!=|>=|<=|>|<)\s*(\d+)$/
  );

  if (countMatch?.[1] && countMatch[2] && countMatch[3]) {
    return compareNumbers({
      actual: getPathCount({
        parsedXml: input.parsedXml,
        contextNode: input.contextNode,
        path: countMatch[1]
      }),
      operator: countMatch[2],
      expected: Number(countMatch[3])
    });
  }

  const stringMatch = test.match(
    /^(.+?)\s*(=|!=)\s*(['"])([\s\S]*?)\3$/
  );

  if (stringMatch?.[1] && stringMatch[2]) {
    const normalizedPath =
      stripNormalizeSpaceExpression(stringMatch[1].trim()) ??
      stringMatch[1].trim();

    return compareStrings({
      actual: getPathStringValue({
        parsedXml: input.parsedXml,
        contextNode: input.contextNode,
        path: normalizedPath
      }),
      operator: stringMatch[2],
      expected: stringMatch[4] ?? ""
    });
  }

  const numericMatch = test.match(
    /^(.+?)\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/
  );

  if (numericMatch?.[1] && numericMatch[2] && numericMatch[3]) {
    const actual = Number(
      getPathStringValue({
        parsedXml: input.parsedXml,
        contextNode: input.contextNode,
        path: numericMatch[1].trim()
      })
    );

    return (
      Number.isFinite(actual) &&
      compareNumbers({
        actual,
        operator: numericMatch[2],
        expected: Number(numericMatch[3])
      })
    );
  }

  if (isSupportedPathExpression(test)) {
    return (
      getPathStringValue({
        parsedXml: input.parsedXml,
        contextNode: input.contextNode,
        path: test
      }).length > 0
    );
  }

  throw new UnsupportedPrototypeExpressionError(
    "schematron_local_execution_prototype_unsupported_test_expression"
  );
}

function findingCodeForLayer(
  layer: SchematronLocalPrototypeLayer
): SchematronFindingCode {
  if (layer === "peppol_bis_billing") {
    return "PEPPOL_SCHEMATRON_RULE_FAILED";
  }

  if (layer === "en16931_tc434") {
    return "EN16931_SCHEMATRON_RULE_FAILED";
  }

  return "SCHEMATRON_ASSERTION_FAILED";
}

function buildAssertionFinding(input: {
  rule: SchematronLocalPrototypeRule;
  selectedLayer: SchematronLocalPrototypeLayer;
}): SchematronContractFinding {
  const ruleLayer = normalizeSchematronLocalPrototypeLayer(
    input.rule.layer ?? input.selectedLayer
  );
  const severity = input.rule.severity === "warning" ? "warning" : "fatal";

  return buildSchematronFutureRuleFinding({
    layer: ruleLayer,
    code: findingCodeForLayer(ruleLayer),
    ruleId: input.rule.ruleId,
    businessRuleId: input.rule.businessRuleId,
    severity,
    status: severity === "warning" ? "warning" : "failed",
    field: input.rule.field ?? "xml.schematron",
    message: input.rule.message,
    ruleLocation: input.rule.context,
    testExpression: input.rule.test,
    assertionText: input.rule.message,
    sourceLabels: [
      "Schematron local execution prototype",
      input.rule.ruleId,
      ...(input.rule.businessRuleId ? [input.rule.businessRuleId] : [])
    ],
    technicalCode: findingCodeForLayer(ruleLayer),
    technicalMessage: "schematron_local_prototype_assertion_failed"
  });
}

function checkTimeout(input: { startedAt: number; timeoutMs: number }) {
  if (Date.now() - input.startedAt > input.timeoutMs) {
    throw new Error("schematron_local_execution_prototype_timeout");
  }
}

export async function runSchematronLocalExecutionPrototype(
  input: SchematronLocalPrototypeInput
): Promise<SchematronLocalPrototypeResult> {
  const mode =
    input.mode === "internal_test_only" ? input.mode : "disabled";
  const selectedLayer = normalizeSchematronLocalPrototypeLayer(input.layer);
  const rules = Array.isArray(input.rules) ? input.rules : [];
  const ruleCount = rules.length;

  if (mode === "disabled") {
    return buildResult({
      mode,
      status: "disabled",
      validationExecutionEnabled: false,
      validationExecuted: false,
      selectedLayer,
      ruleCount,
      executedRuleCount: 0,
      failedRuleCount: 0,
      warningCount: 0,
      fatalCount: 0,
      reason: "schematron_local_execution_prototype_disabled",
      findings: [buildSchematronExecutionDisabledFinding()]
    });
  }

  const maxXmlBytes = normalizePositiveInteger(
    input.maxXmlBytes,
    DEFAULT_MAX_XML_BYTES
  );
  const maxRules = normalizePositiveInteger(input.maxRules, DEFAULT_MAX_RULES);
  const timeoutMs = normalizePositiveInteger(input.timeoutMs, DEFAULT_TIMEOUT_MS);

  if (ruleCount > maxRules) {
    const reason = "schematron_local_execution_prototype_rule_limit_exceeded";

    return buildResult({
      mode,
      status: "unsupported",
      validationExecutionEnabled: true,
      validationExecuted: false,
      selectedLayer,
      ruleCount,
      executedRuleCount: 0,
      failedRuleCount: 0,
      warningCount: 0,
      fatalCount: 0,
      reason,
      findings: [
        buildPrototypeErrorFinding({
          selectedLayer,
          reason
        })
      ]
    });
  }

  const safety = inspectPrototypeXmlSafety({
    xml: input.xml,
    maxXmlBytes
  });

  if (!safety.safe) {
    return buildResult({
      mode,
      status: "unsafe_input",
      validationExecutionEnabled: true,
      validationExecuted: false,
      selectedLayer,
      ruleCount,
      executedRuleCount: 0,
      failedRuleCount: 0,
      warningCount: 0,
      fatalCount: 0,
      reason: safety.reason,
      findings: [
        buildPrototypeErrorFinding({
          selectedLayer,
          reason: safety.reason
        })
      ]
    });
  }

  if (XMLValidator.validate(input.xml) !== true) {
    const reason = "schematron_local_execution_prototype_xml_parse_failed";

    return buildResult({
      mode,
      status: "unsafe_input",
      validationExecutionEnabled: true,
      validationExecuted: false,
      selectedLayer,
      ruleCount,
      executedRuleCount: 0,
      failedRuleCount: 0,
      warningCount: 0,
      fatalCount: 0,
      reason,
      findings: [
        buildPrototypeErrorFinding({
          selectedLayer,
          reason
        })
      ]
    });
  }

  const startedAt = Date.now();
  let parsedXml: unknown;

  try {
    parsedXml = prototypeXmlParser.parse(input.xml) as unknown;
  } catch {
    const reason = "schematron_local_execution_prototype_xml_parse_failed";

    return buildResult({
      mode,
      status: "unsafe_input",
      validationExecutionEnabled: true,
      validationExecuted: false,
      selectedLayer,
      ruleCount,
      executedRuleCount: 0,
      failedRuleCount: 0,
      warningCount: 0,
      fatalCount: 0,
      reason,
      findings: [
        buildPrototypeErrorFinding({
          selectedLayer,
          reason
        })
      ]
    });
  }

  const findings: SchematronContractFinding[] = [];
  let executedRuleCount = 0;

  try {
    for (const rawRule of rules) {
      checkTimeout({ startedAt, timeoutMs });

      const rule = sanitizeSchematronPrototypeRule(rawRule);
      const contextNodes = selectNodes({
        parsedXml,
        path: rule.context
      });

      executedRuleCount += 1;

      for (const contextNode of contextNodes) {
        checkTimeout({ startedAt, timeoutMs });

        const passed = evaluatePrototypeTest({
          parsedXml,
          contextNode,
          test: rule.test
        });

        if (!passed) {
          findings.push(
            buildAssertionFinding({
              rule,
              selectedLayer
            })
          );
        }
      }
    }
  } catch (error) {
    const reason =
      error instanceof UnsupportedPrototypeExpressionError
        ? error.message
        : error instanceof Error &&
            error.message === "schematron_local_execution_prototype_timeout"
          ? error.message
          : "schematron_local_execution_prototype_execution_failed";

    return buildResult({
      mode,
      status:
        error instanceof UnsupportedPrototypeExpressionError
          ? "unsupported"
          : "failed",
      validationExecutionEnabled: true,
      validationExecuted: false,
      selectedLayer,
      ruleCount,
      executedRuleCount,
      failedRuleCount: 0,
      warningCount: 0,
      fatalCount: 0,
      reason,
      findings: [
        buildPrototypeErrorFinding({
          selectedLayer,
          reason
        })
      ]
    });
  }

  const warningCount = findings.filter(
    (finding) => finding.severity === "warning"
  ).length;
  const fatalCount = findings.filter(
    (finding) => finding.severity === "fatal"
  ).length;
  const failedRuleCount = findings.length;

  return buildResult({
    mode,
    status: failedRuleCount > 0 ? "failed" : "executed",
    validationExecutionEnabled: true,
    validationExecuted: true,
    selectedLayer,
    ruleCount,
    executedRuleCount,
    failedRuleCount,
    warningCount,
    fatalCount,
    reason:
      failedRuleCount > 0
        ? "schematron_local_execution_prototype_assertions_failed"
        : "schematron_local_execution_prototype_executed",
    findings
  });
}
