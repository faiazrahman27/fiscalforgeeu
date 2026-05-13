import fontoxpathRuntime from "fontoxpath";
import type * as FontoXPath from "fontoxpath";
import { XMLValidator } from "fast-xml-parser";
import { DOMParser, type Node as SlimdomNode } from "slimdom";
import {
  buildSchematronFutureRuleFinding,
  normalizeSchematronLayer,
  sanitizeSchematronText,
  type SchematronCheckType,
  type SchematronContractFinding,
  type SchematronFindingSeverity,
  type SchematronLayer
} from "./schematron-finding-contract.js";
import {
  mapSchematronSvrlResultsToFindings,
  type SchematronSvrlInputResult,
  type SchematronSvrlResultKind
} from "./schematron-result-mapper.js";

export const SCHEMATRON_XPATH_ENGINE_VERSION =
  "schematron_xpath_engine_v1";
export const SCHEMATRON_XPATH_ENGINE_ID = "xpath_engine";

export type SchematronXPathEngineMode =
  | "disabled"
  | "internal_test_only"
  | "execute";

export type SchematronXPathEngineStatus =
  | "disabled"
  | "executed"
  | "failed"
  | "unsupported"
  | "unsafe_input"
  | "error";

export type SchematronXPathAssertionInput = {
  kind?: "assert" | "report";
  ruleId: string;
  businessRuleId?: string;
  schematronLayer?: SchematronLayer;
  contextXPath?: string;
  context?: string;
  testExpression: string;
  assertionText: string;
  severity?: SchematronFindingSeverity;
  flag?: string;
  role?: string;
  diagnosticReference?: string;
  sourceLabels?: readonly string[];
};

export type SchematronXPathEngineInput = {
  xml: string;
  assertions: SchematronXPathAssertionInput[];
  mode?: SchematronXPathEngineMode;
  allowInternalXPathExecution?: boolean;
  allowXPathExecution?: boolean;
  checkType?: SchematronCheckType;
  namespaceMappings?: Record<string, string>;
  maxXmlBytes?: number;
  maxAssertions?: number;
  maxContextNodesPerAssertion?: number;
  maxResults?: number;
};

export type SchematronXPathEngineSafetyMetadata = {
  rawXmlReturned: false;
  schematronFileContentsReturned: false;
  fullAbsoluteLocalPathsReturned: false;
  remoteFetching: false;
  localFileLoading: false;
  externalDocumentLoading: false;
  extensionFunctions: false;
  certificationOrAuthorityAcceptanceClaimed: false;
  legalTaxAccountingComplianceClaimed: false;
  normalPublicApiExecutionEnabled: false;
  normalWorkerExecutionEnabled: false;
};

export type SchematronXPathEngineSummary = {
  diagnosticKind: "schematron_xpath_engine";
  engineVersion: typeof SCHEMATRON_XPATH_ENGINE_VERSION;
  engineId: typeof SCHEMATRON_XPATH_ENGINE_ID;
  status: SchematronXPathEngineStatus;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: false;
  assertionCount: number;
  executedAssertionCount: number;
  evaluatedContextNodeCount: number;
  findingCount: number;
  fatalCount: number;
  warningCount: number;
  infoCount: number;
  reason: string;
  safetyMetadata: SchematronXPathEngineSafetyMetadata;
  disclaimer: string;
};

export type SchematronXPathEngineResult = {
  engineVersion: typeof SCHEMATRON_XPATH_ENGINE_VERSION;
  engineId: typeof SCHEMATRON_XPATH_ENGINE_ID;
  status: SchematronXPathEngineStatus;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: false;
  assertionCount: number;
  executedAssertionCount: number;
  evaluatedContextNodeCount: number;
  findingCount: number;
  fatalCount: number;
  warningCount: number;
  infoCount: number;
  reason: string;
  findings: SchematronContractFinding[];
  safetyMetadata: SchematronXPathEngineSafetyMetadata;
  disclaimer: string;
  safeSummary: SchematronXPathEngineSummary;
};

type NormalizedAssertion = {
  ruleId: string;
  businessRuleId?: string;
  schematronLayer: SchematronLayer;
  kind: "assert" | "report";
  contextXPath: string;
  testExpression: string;
  assertionText: string;
  severity: SchematronFindingSeverity;
  flag?: string;
  role?: string;
  diagnosticReference?: string;
  sourceLabels?: string[];
};

type AssertionNormalizationResult =
  | {
      ok: true;
      assertions: NormalizedAssertion[];
    }
  | {
      ok: false;
      reason: string;
      finding: SchematronContractFinding;
    };

const fontoxpath = fontoxpathRuntime as typeof FontoXPath;

const DEFAULT_MAX_XML_BYTES = 256 * 1024;
const DEFAULT_MAX_ASSERTIONS = 100;
const DEFAULT_MAX_CONTEXT_NODES = 250;
const DEFAULT_MAX_RESULTS = 500;
const MAX_ASSERTION_LIMIT = 500;
const MAX_CONTEXT_NODE_LIMIT = 1000;
const MAX_RESULT_LIMIT = 5000;

const XPATH_FUNCTION_NAMESPACE = "http://www.w3.org/2005/xpath-functions";
const UBL_INVOICE_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
const UBL_CREDIT_NOTE_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2";
const UBL_CAC_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
const UBL_CBC_NAMESPACE =
  "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

const NAMESPACE_BY_PREFIX: Record<string, string> = {
  cac: UBL_CAC_NAMESPACE,
  cbc: UBL_CBC_NAMESPACE,
  cn: UBL_CREDIT_NOTE_NAMESPACE,
  fn: XPATH_FUNCTION_NAMESPACE,
  inv: UBL_INVOICE_NAMESPACE,
  ubl: UBL_INVOICE_NAMESPACE
};

const FORBIDDEN_ASSURANCE_CLAIM_PATTERN =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/gi;
const SCHEMATRON_FILE_CONTENT_SENTINEL_PATTERN =
  /\bSCHEMATRON[-_\s]?FILE[-_\s]?CONTENT[-_\s]?[A-Za-z0-9_.-]*/gi;
const URL_OR_LOCAL_PATH_PATTERN =
  /\b(?:https?|file):\/\/|(?<![\w:])[A-Za-z]:[\\/]|(?<![\w:])\/(?:home|tmp|Users|etc|var|private)\/[^\s"'<>]*/i;
const XML_LITERAL_PATTERN =
  /<([A-Za-z_][\w:.-]*)(?:\s[^<>]*)?>[\s\S]*?<\/\1>|<\/?[A-Za-z_][\w:.-]*(?:\s[^<>]*)?\/?>/;
const EXTERNAL_DOCUMENT_FUNCTION_PATTERN =
  /(?:^|[^\w.-])(?:fn:)?(?:doc|doc-available|collection|uri-collection|unparsed-text|unparsed-text-lines|unparsed-text-available|json-doc|environment-variable|available-environment-variables)\s*\(/i;
const DYNAMIC_OR_MODULE_PATTERN =
  /\b(?:import|module|declare|external|transform)\b|=>|\bfunction\s*\(|\bxsl:evaluate\s*\(/i;
const BRACED_URI_PATTERN = /Q\{[^}]*\}/i;
const PREFIXED_FUNCTION_PATTERN =
  /\b(?!fn:)(?!xs:)[A-Za-z_][\w.-]*:[A-Za-z_][\w.-]*\s*\(/;

const SAFETY_METADATA: SchematronXPathEngineSafetyMetadata = {
  rawXmlReturned: false,
  schematronFileContentsReturned: false,
  fullAbsoluteLocalPathsReturned: false,
  remoteFetching: false,
  localFileLoading: false,
  externalDocumentLoading: false,
  extensionFunctions: false,
  certificationOrAuthorityAcceptanceClaimed: false,
  legalTaxAccountingComplianceClaimed: false,
  normalPublicApiExecutionEnabled: false,
  normalWorkerExecutionEnabled: false
};

const DISCLAIMER =
  "Guarded internal/test-only XPath assertion foundation for independent technical validation and educational simulation. It is not official validation, not Peppol certification, not an EN 16931 compliance guarantee, not legal/tax/accounting advice, and not authority acceptance.";

function sanitizeXPathEngineText(value: unknown, maxLength = 700) {
  return sanitizeSchematronText(value, maxLength)
    .replace(SCHEMATRON_FILE_CONTENT_SENTINEL_PATTERN, "[schematron-file-content]")
    .replace(FORBIDDEN_ASSURANCE_CLAIM_PATTERN, "[assurance-claim]")
    .replace(/\s+/g, " ")
    .trim();
}

function optionalSanitizedText(value: unknown, maxLength?: number) {
  const sanitized = sanitizeXPathEngineText(value, maxLength);

  return sanitized.length > 0 ? sanitized : undefined;
}

function normalizePositiveInteger(input: {
  value: number | undefined;
  fallback: number;
  max: number;
}) {
  if (
    typeof input.value !== "number" ||
    !Number.isInteger(input.value) ||
    input.value <= 0
  ) {
    return input.fallback;
  }

  return Math.min(input.value, input.max);
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function countFindings(findings: readonly SchematronContractFinding[]) {
  return findings.reduce(
    (counts, finding) => {
      counts.findingCount += 1;

      if (finding.severity === "fatal") {
        counts.fatalCount += 1;
      } else if (finding.severity === "info") {
        counts.infoCount += 1;
      } else {
        counts.warningCount += 1;
      }

      return counts;
    },
    {
      findingCount: 0,
      fatalCount: 0,
      warningCount: 0,
      infoCount: 0
    }
  );
}

function buildResult(input: {
  status: SchematronXPathEngineStatus;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  assertionCount: number;
  executedAssertionCount: number;
  evaluatedContextNodeCount: number;
  reason: string;
  findings: SchematronContractFinding[];
}): SchematronXPathEngineResult {
  const counts = countFindings(input.findings);
  const reason =
    sanitizeXPathEngineText(input.reason, 160) ||
    "schematron_xpath_engine_failed";
  const base = {
    engineVersion: SCHEMATRON_XPATH_ENGINE_VERSION,
    engineId: SCHEMATRON_XPATH_ENGINE_ID,
    status: input.status,
    validationExecutionEnabled: input.validationExecutionEnabled,
    validationExecuted: input.validationExecuted,
    markedValid: false,
    assertionCount: input.assertionCount,
    executedAssertionCount: input.executedAssertionCount,
    evaluatedContextNodeCount: input.evaluatedContextNodeCount,
    ...counts,
    reason,
    safetyMetadata: SAFETY_METADATA,
    disclaimer: DISCLAIMER
  } satisfies Omit<SchematronXPathEngineSummary, "diagnosticKind">;

  return {
    engineVersion: base.engineVersion,
    engineId: base.engineId,
    status: base.status,
    validationExecutionEnabled: base.validationExecutionEnabled,
    validationExecuted: base.validationExecuted,
    markedValid: false,
    assertionCount: base.assertionCount,
    executedAssertionCount: base.executedAssertionCount,
    evaluatedContextNodeCount: base.evaluatedContextNodeCount,
    findingCount: base.findingCount,
    fatalCount: base.fatalCount,
    warningCount: base.warningCount,
    infoCount: base.infoCount,
    reason: base.reason,
    findings: input.findings,
    safetyMetadata: base.safetyMetadata,
    disclaimer: base.disclaimer,
    safeSummary: {
      diagnosticKind: "schematron_xpath_engine",
      ...base
    }
  };
}

function buildExecutionErrorFinding(input: {
  layer?: SchematronLayer;
  reason: string;
}): SchematronContractFinding {
  return buildSchematronFutureRuleFinding({
    layer: input.layer ?? "unknown",
    code: "SCHEMATRON_EXECUTION_ERROR",
    severity: "warning",
    status: "error",
    field: "xml.schematron.xpath",
    message:
      "The guarded XPath-backed Schematron assertion engine rejected the request before execution.",
    sourceLabels: [
      "Schematron XPath engine",
      SCHEMATRON_XPATH_ENGINE_VERSION,
      "SCHEMATRON_EXECUTION_ERROR"
    ],
    technicalCode: "SCHEMATRON_EXECUTION_ERROR",
    technicalMessage: input.reason
  });
}

function inspectXPathExpressionSafety(value: string) {
  if (URL_OR_LOCAL_PATH_PATTERN.test(value)) {
    return "schematron_xpath_expression_external_reference_blocked";
  }

  if (XML_LITERAL_PATTERN.test(value)) {
    return "schematron_xpath_expression_xml_literal_blocked";
  }

  if (EXTERNAL_DOCUMENT_FUNCTION_PATTERN.test(value)) {
    return "schematron_xpath_expression_external_document_function_blocked";
  }

  if (DYNAMIC_OR_MODULE_PATTERN.test(value)) {
    return "schematron_xpath_expression_dynamic_behavior_blocked";
  }

  if (BRACED_URI_PATTERN.test(value)) {
    return "schematron_xpath_expression_braced_uri_blocked";
  }

  if (PREFIXED_FUNCTION_PATTERN.test(value)) {
    return "schematron_xpath_expression_extension_function_blocked";
  }

  return null;
}

function normalizeAssertion(
  assertion: SchematronXPathAssertionInput
): AssertionNormalizationResult {
  const rawContext = assertion.contextXPath ?? assertion.context ?? "/*";
  const rawTestExpression = assertion.testExpression;
  const unsafeContextReason = inspectXPathExpressionSafety(rawContext);
  const unsafeTestReason = inspectXPathExpressionSafety(rawTestExpression);
  const layer = normalizeSchematronLayer(assertion.schematronLayer);

  if (unsafeContextReason || unsafeTestReason) {
    const reason =
      unsafeContextReason ??
      unsafeTestReason ??
      "schematron_xpath_assertion_unsafe_expression";

    return {
      ok: false,
      reason,
      finding: buildExecutionErrorFinding({
        layer,
        reason
      })
    };
  }

  const contextXPath = sanitizeXPathEngineText(rawContext, 500);
  const testExpression = sanitizeXPathEngineText(rawTestExpression, 700);

  if (!testExpression) {
    const reason = "schematron_xpath_assertion_empty_test_expression";

    return {
      ok: false,
      reason,
      finding: buildExecutionErrorFinding({
        layer,
        reason
      })
    };
  }

  if (!contextXPath) {
    const reason = "schematron_xpath_assertion_empty_context_expression";

    return {
      ok: false,
      reason,
      finding: buildExecutionErrorFinding({
        layer,
        reason
      })
    };
  }

  const ruleId =
    optionalSanitizedText(assertion.ruleId, 120) ??
    "schematron_xpath_assertion";
  const assertionText =
    optionalSanitizedText(assertion.assertionText, 700) ??
    "A guarded XPath assertion failed.";
  const businessRuleId = optionalSanitizedText(
    assertion.businessRuleId,
    120
  );
  const flag = optionalSanitizedText(assertion.flag ?? assertion.severity, 80);
  const role = optionalSanitizedText(assertion.role, 160);
  const diagnosticReference = optionalSanitizedText(
    assertion.diagnosticReference,
    240
  );
  const sourceLabels = Array.isArray(assertion.sourceLabels)
    ? [
        ...new Set(
          assertion.sourceLabels
            .map((label) => optionalSanitizedText(label, 120))
            .filter((label): label is string => Boolean(label))
        )
      ]
    : [];

  return {
    ok: true,
    assertions: [
      {
        ruleId,
        schematronLayer: layer,
        kind: assertion.kind === "report" ? "report" : "assert",
        contextXPath,
        testExpression,
        assertionText,
        severity: assertion.severity ?? "fatal",
        ...(flag ? { flag } : {}),
        ...(role ? { role } : {}),
        ...(businessRuleId ? { businessRuleId } : {}),
        ...(diagnosticReference ? { diagnosticReference } : {}),
        ...(sourceLabels.length > 0 ? { sourceLabels } : {})
      }
    ]
  };
}

function normalizeAssertions(input: {
  assertions: SchematronXPathAssertionInput[];
  maxAssertions: number;
}): AssertionNormalizationResult {
  if (input.assertions.length > input.maxAssertions) {
    const reason = "schematron_xpath_assertion_limit_exceeded";

    return {
      ok: false,
      reason,
      finding: buildExecutionErrorFinding({
        reason
      })
    };
  }

  const normalized: NormalizedAssertion[] = [];

  for (const assertion of input.assertions) {
    const result = normalizeAssertion(assertion);

    if (!result.ok) {
      return result;
    }

    normalized.push(...result.assertions);
  }

  return {
    ok: true,
    assertions: normalized
  };
}

function inspectXmlSafety(input: { xml: string; maxXmlBytes: number }) {
  const byteLength = getUtf8ByteLength(input.xml);

  if (byteLength > input.maxXmlBytes) {
    return {
      safe: false,
      reason: "schematron_xpath_engine_xml_too_large"
    };
  }

  if (/<!DOCTYPE/i.test(input.xml)) {
    return {
      safe: false,
      reason: "schematron_xpath_engine_doctype_blocked"
    };
  }

  if (/<!ENTITY/i.test(input.xml)) {
    return {
      safe: false,
      reason: "schematron_xpath_engine_entity_blocked"
    };
  }

  if (/\bSYSTEM\b/i.test(input.xml) || /\bPUBLIC\b/i.test(input.xml)) {
    return {
      safe: false,
      reason: "schematron_xpath_engine_external_identifier_blocked"
    };
  }

  if (/<\?xml-stylesheet/i.test(input.xml)) {
    return {
      safe: false,
      reason: "schematron_xpath_engine_stylesheet_blocked"
    };
  }

  return {
    safe: true,
    reason: ""
  };
}

function namespaceResolverFor(
  namespaceMappings: Record<string, string> | undefined
) {
  const mergedNamespaces = {
    ...NAMESPACE_BY_PREFIX,
    ...(namespaceMappings ?? {})
  };

  return (prefix: string | null) => {
    if (!prefix) {
      return null;
    }

    return mergedNamespaces[prefix] ?? null;
  };
}

function evaluateContextNodes(input: {
  assertion: NormalizedAssertion;
  documentNode: SlimdomNode;
  maxContextNodesPerAssertion: number;
  namespaceMappings?: Record<string, string>;
}) {
  const nodes = fontoxpath.evaluateXPathToNodes<SlimdomNode>(
    input.assertion.contextXPath,
    input.documentNode,
    null,
    null,
    {
      defaultFunctionNamespaceURI: XPATH_FUNCTION_NAMESPACE,
      language: fontoxpath.evaluateXPath.XPATH_3_1_LANGUAGE,
      moduleImports: {},
      namespaceResolver: namespaceResolverFor(input.namespaceMappings)
    }
  );

  return nodes.slice(0, input.maxContextNodesPerAssertion);
}

function evaluateAssertion(input: {
  assertion: NormalizedAssertion;
  contextNode: SlimdomNode;
  namespaceMappings?: Record<string, string>;
}) {
  return fontoxpath.evaluateXPathToBoolean(
    input.assertion.testExpression,
    input.contextNode,
    null,
    null,
    {
      defaultFunctionNamespaceURI: XPATH_FUNCTION_NAMESPACE,
      language: fontoxpath.evaluateXPath.XPATH_3_1_LANGUAGE,
      moduleImports: {},
      namespaceResolver: namespaceResolverFor(input.namespaceMappings)
    }
  );
}

function parseXmlDocument(xml: string): SlimdomNode | null {
  if (XMLValidator.validate(xml) !== true) {
    return null;
  }

  const documentNode = new DOMParser().parseFromString(xml, "application/xml");

  return documentNode.documentElement ? documentNode : null;
}

function svrlKindForAssertion(
  assertion: NormalizedAssertion
): SchematronSvrlResultKind {
  return assertion.kind === "report" ? "successful_report" : "failed_assert";
}

function svrlResultForAssertion(
  assertion: NormalizedAssertion
): SchematronSvrlInputResult {
  return {
    kind: svrlKindForAssertion(assertion),
    id: assertion.ruleId,
    flag: assertion.flag ?? assertion.severity,
    location: assertion.contextXPath,
    test: assertion.testExpression,
    text: assertion.assertionText,
    layer: assertion.schematronLayer,
    ...(assertion.role ? { role: assertion.role } : {}),
    ...(assertion.businessRuleId
      ? { businessRuleId: assertion.businessRuleId }
      : {}),
    ...(assertion.diagnosticReference
      ? { diagnosticReference: assertion.diagnosticReference }
      : {}),
    ...(assertion.sourceLabels ? { sourceLabels: assertion.sourceLabels } : {})
  };
}

export function normalizeSchematronXPathEngineMode(
  value: unknown
): SchematronXPathEngineMode {
  if (value === "internal_test_only" || value === "execute") {
    return value;
  }

  return "disabled";
}

export async function runSchematronXPathEngine(
  input: SchematronXPathEngineInput
): Promise<SchematronXPathEngineResult> {
  const mode = normalizeSchematronXPathEngineMode(input.mode);
  const assertionCount = Array.isArray(input.assertions)
    ? input.assertions.length
    : 0;

  const executionAllowed =
    (mode === "internal_test_only" &&
      input.allowInternalXPathExecution === true) ||
    (mode === "execute" && input.allowXPathExecution === true);

  if (!executionAllowed) {
    return buildResult({
      status: "disabled",
      validationExecutionEnabled: false,
      validationExecuted: false,
      assertionCount,
      executedAssertionCount: 0,
      evaluatedContextNodeCount: 0,
      reason:
        mode === "internal_test_only" || mode === "execute"
          ? "schematron_xpath_engine_internal_execution_not_allowed"
          : "schematron_xpath_engine_disabled",
      findings: []
    });
  }

  const maxAssertions = normalizePositiveInteger({
    value: input.maxAssertions,
    fallback: DEFAULT_MAX_ASSERTIONS,
    max: MAX_ASSERTION_LIMIT
  });
  const normalizedAssertions = normalizeAssertions({
    assertions: input.assertions,
    maxAssertions
  });

  if (!normalizedAssertions.ok) {
    return buildResult({
      status: "unsupported",
      validationExecutionEnabled: true,
      validationExecuted: false,
      assertionCount,
      executedAssertionCount: 0,
      evaluatedContextNodeCount: 0,
      reason: normalizedAssertions.reason,
      findings: [normalizedAssertions.finding]
    });
  }

  const maxXmlBytes = normalizePositiveInteger({
    value: input.maxXmlBytes,
    fallback: DEFAULT_MAX_XML_BYTES,
    max: DEFAULT_MAX_XML_BYTES
  });
  const safety = inspectXmlSafety({
    xml: input.xml,
    maxXmlBytes
  });

  if (!safety.safe) {
    return buildResult({
      status: "unsafe_input",
      validationExecutionEnabled: true,
      validationExecuted: false,
      assertionCount,
      executedAssertionCount: 0,
      evaluatedContextNodeCount: 0,
      reason: safety.reason,
      findings: [
        buildExecutionErrorFinding({
          reason: safety.reason
        })
      ]
    });
  }

  const documentNode = parseXmlDocument(input.xml);

  if (!documentNode) {
    const reason = "schematron_xpath_engine_xml_parse_failed";

    return buildResult({
      status: "unsafe_input",
      validationExecutionEnabled: true,
      validationExecuted: false,
      assertionCount,
      executedAssertionCount: 0,
      evaluatedContextNodeCount: 0,
      reason,
      findings: [
        buildExecutionErrorFinding({
          reason
        })
      ]
    });
  }

  const maxContextNodesPerAssertion = normalizePositiveInteger({
    value: input.maxContextNodesPerAssertion,
    fallback: DEFAULT_MAX_CONTEXT_NODES,
    max: MAX_CONTEXT_NODE_LIMIT
  });
  const maxResults = normalizePositiveInteger({
    value: input.maxResults,
    fallback: DEFAULT_MAX_RESULTS,
    max: MAX_RESULT_LIMIT
  });
  const svrlResults: SchematronSvrlInputResult[] = [];
  let executedAssertionCount = 0;
  let evaluatedContextNodeCount = 0;

  try {
    for (const assertion of normalizedAssertions.assertions) {
      const contextNodes = evaluateContextNodes({
        assertion,
        documentNode,
        maxContextNodesPerAssertion,
        ...(input.namespaceMappings
          ? { namespaceMappings: input.namespaceMappings }
          : {})
      });

      executedAssertionCount += 1;
      evaluatedContextNodeCount += contextNodes.length;

      for (const contextNode of contextNodes) {
        const passed = evaluateAssertion({
          assertion,
          contextNode,
          ...(input.namespaceMappings
            ? { namespaceMappings: input.namespaceMappings }
            : {})
        });

        if (
          (assertion.kind === "assert" && !passed) ||
          (assertion.kind === "report" && passed)
        ) {
          if (svrlResults.length < maxResults) {
            svrlResults.push(svrlResultForAssertion(assertion));
          }
        }
      }
    }
  } catch {
    const reason = "schematron_xpath_engine_execution_failed";

    return buildResult({
      status: "error",
      validationExecutionEnabled: true,
      validationExecuted: false,
      assertionCount,
      executedAssertionCount,
      evaluatedContextNodeCount,
      reason,
      findings: [
        buildExecutionErrorFinding({
          reason
        })
      ]
    });
  }

  const mapped = mapSchematronSvrlResultsToFindings({
    layer: "unknown",
    results: svrlResults,
    maxResults,
    ...(input.checkType ? { checkType: input.checkType } : {})
  });
  const findings = mapped.findings;
  const hasFailedAssertions = findings.some(
    (finding) => finding.status === "failed" || finding.severity === "fatal"
  );

  return buildResult({
    status: hasFailedAssertions ? "failed" : "executed",
    validationExecutionEnabled: true,
    validationExecuted: true,
    assertionCount,
    executedAssertionCount,
    evaluatedContextNodeCount,
    reason:
      hasFailedAssertions
        ? "schematron_xpath_engine_assertions_failed"
        : "schematron_xpath_engine_executed",
    findings
  });
}
