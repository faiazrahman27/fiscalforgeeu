import { readFile } from "node:fs/promises";
import { XMLValidator } from "fast-xml-parser";
import { DOMParser, type Element as SlimdomElement, type Node as SlimdomNode } from "slimdom";
import {
  buildSchematronArtifactNotConfiguredFinding,
  buildSchematronArtifactUnreadableFinding,
  buildSchematronFutureRuleFinding,
  sanitizeSchematronText,
  type SchematronCheckType,
  type SchematronContractFinding,
  type SchematronFindingSeverity,
  type SchematronLayer
} from "./schematron-finding-contract.js";
import {
  SCHEMATRON_XPATH_ENGINE_ID,
  runSchematronXPathEngine,
  type SchematronXPathAssertionInput
} from "./schematron-xpath-engine.js";
import type { SchematronEngineCandidateInfo } from "./schematron-engine-candidate.js";
import type { SchematronExecutionPolicy } from "./schematron-execution-policy.js";
import {
  inspectSchematronArtifacts,
  type SchematronArtifactConfigInput,
  type SchematronArtifactFileInfo,
  type SchematronArtifactInspection,
  type SchematronSafeArtifactDiagnostics
} from "./xsd-artifact-registry.js";

export const SCHEMATRON_ARTIFACT_EXECUTOR_VERSION =
  "schematron_artifact_executor_v1";

export type SchematronArtifactExecutionStatus =
  | "disabled"
  | "preflight_only"
  | "blocked_by_policy"
  | "not_configured"
  | "artifact_unreadable"
  | "engine_unavailable"
  | "executed"
  | "failed"
  | "unsupported"
  | "unsafe_input"
  | "error";

export type ParsedSchematronArtifactSummary = {
  assertionCount: number;
  reportCount: number;
  ruleCount: number;
  patternCount: number;
  namespacePrefixCount: number;
};

export type SchematronArtifactExecutorSummary = {
  diagnosticKind: "schematron_artifact_executor";
  executorVersion: typeof SCHEMATRON_ARTIFACT_EXECUTOR_VERSION;
  status: SchematronArtifactExecutionStatus;
  layer: SchematronLayer;
  checkType: SchematronCheckType;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: boolean;
  findingCount: number;
  fatalCount: number;
  warningCount: number;
  infoCount: number;
  reason: string;
  artifactVersion: string | null;
  artifactLabel: string | null;
  artifactBasename: string | null;
  artifactRelativePathUnderRoot?: string;
  engineId: typeof SCHEMATRON_XPATH_ENGINE_ID;
  parsedArtifact?: ParsedSchematronArtifactSummary;
  xpathEngine?: unknown;
  policy?: unknown;
  artifactDiagnostics?: SchematronSafeArtifactDiagnostics;
  disclaimer: string;
};

export type SchematronArtifactExecutorResult = {
  executorVersion: typeof SCHEMATRON_ARTIFACT_EXECUTOR_VERSION;
  status: SchematronArtifactExecutionStatus;
  layer: SchematronLayer;
  checkType: SchematronCheckType;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: boolean;
  reason: string;
  findings: SchematronContractFinding[];
  safeSummary: SchematronArtifactExecutorSummary;
};

type ParsedSchematronArtifact =
  | {
      ok: true;
      assertions: SchematronXPathAssertionInput[];
      namespaceMappings: Record<string, string>;
      summary: ParsedSchematronArtifactSummary;
    }
  | {
      ok: false;
      reason: string;
      finding: SchematronContractFinding;
    };

type XmlSafetyResult =
  | {
      safe: true;
      reason: "";
    }
  | {
      safe: false;
      reason: string;
    };

const SCHEMATRON_NAMESPACE = "http://purl.oclc.org/dsdl/schematron";
const DEFAULT_MAX_XML_BYTES = 256 * 1024;
const DEFAULT_MAX_RESULTS = 500;
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const ELEMENT_NODE = 1;
const SUPPORTED_QUERY_BINDINGS = new Set([
  "",
  "xpath",
  "xpath2",
  "xpath3",
  "xpath31",
  "xslt2"
]);
const UNSUPPORTED_SCHEMATRON_ELEMENTS = new Set([
  "active",
  "extends",
  "include",
  "let",
  "phase",
  "param"
]);
const ALLOWED_SCHEMATRON_ELEMENTS = new Set([
  "assert",
  "diagnostic",
  "diagnostics",
  "ns",
  "p",
  "pattern",
  "report",
  "rule",
  "schema",
  "title"
]);
const SAFE_PREFIX_PATTERN = /^[A-Za-z_][\w.-]*$/;
const BUSINESS_RULE_ID_PATTERN =
  /\b(?:BR-[A-Z0-9]+(?:-[A-Z0-9]+)*|PEPPOL-[A-Z0-9]+(?:-[A-Z0-9]+)*|BT-\d+(?:-\d+)?)\b/i;
const DISCLAIMER =
  "Guarded local Schematron execution is an independent technical check against configured reviewed local artifacts. It is not official validation, not certified, not legal/tax/accounting advice, not official filing, and not authority acceptance. Professional review is required.";

function checkTypeForLayer(layer: SchematronLayer): SchematronCheckType {
  if (layer === "en16931_tc434") {
    return "schematron_en16931";
  }

  return "schematron_peppol";
}

function artifactForLayer(
  inspection: SchematronArtifactInspection,
  layer: SchematronLayer
): SchematronArtifactFileInfo {
  return layer === "en16931_tc434"
    ? inspection.en16931Artifact
    : inspection.peppolBisArtifact;
}

function safeArtifactForLayer(
  diagnostics: SchematronSafeArtifactDiagnostics | undefined,
  layer: SchematronLayer
) {
  return layer === "en16931_tc434"
    ? diagnostics?.en16931Artifact
    : diagnostics?.peppolBisArtifact;
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

function withCheckType(
  finding: SchematronContractFinding,
  checkType: SchematronCheckType
): SchematronContractFinding {
  return {
    ...finding,
    checkType
  };
}

function buildResult(input: {
  status: SchematronArtifactExecutionStatus;
  layer: SchematronLayer;
  checkType: SchematronCheckType;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: boolean;
  reason: string;
  findings: SchematronContractFinding[];
  artifactDiagnostics?: SchematronSafeArtifactDiagnostics;
  parsedArtifact?: ParsedSchematronArtifactSummary;
  xpathEngine?: unknown;
  policy?: unknown;
}): SchematronArtifactExecutorResult {
  const counts = countFindings(input.findings);
  const artifact = safeArtifactForLayer(input.artifactDiagnostics, input.layer);
  const reason =
    sanitizeSchematronText(input.reason, 160) ||
    "schematron_artifact_execution_failed";
  const base = {
    diagnosticKind: "schematron_artifact_executor",
    executorVersion: SCHEMATRON_ARTIFACT_EXECUTOR_VERSION,
    status: input.status,
    layer: input.layer,
    checkType: input.checkType,
    validationExecutionEnabled: input.validationExecutionEnabled,
    validationExecuted: input.validationExecuted,
    markedValid: input.markedValid,
    ...counts,
    reason,
    artifactVersion: input.artifactDiagnostics?.artifactVersion ?? null,
    artifactLabel: artifact?.label ?? null,
    artifactBasename: artifact?.basename ?? null,
    ...(artifact?.relativePathUnderRoot
      ? { artifactRelativePathUnderRoot: artifact.relativePathUnderRoot }
      : {}),
    engineId: SCHEMATRON_XPATH_ENGINE_ID,
    ...(input.parsedArtifact ? { parsedArtifact: input.parsedArtifact } : {}),
    ...(input.xpathEngine ? { xpathEngine: input.xpathEngine } : {}),
    ...(input.policy ? { policy: input.policy } : {}),
    ...(input.artifactDiagnostics
      ? { artifactDiagnostics: input.artifactDiagnostics }
      : {}),
    disclaimer: DISCLAIMER
  } satisfies SchematronArtifactExecutorSummary;

  return {
    executorVersion: SCHEMATRON_ARTIFACT_EXECUTOR_VERSION,
    status: input.status,
    layer: input.layer,
    checkType: input.checkType,
    validationExecutionEnabled: input.validationExecutionEnabled,
    validationExecuted: input.validationExecuted,
    markedValid: input.markedValid,
    reason,
    findings: input.findings.map((finding) => withCheckType(finding, input.checkType)),
    safeSummary: base
  };
}

function buildExecutionFinding(input: {
  layer: SchematronLayer;
  checkType: SchematronCheckType;
  reason: string;
  message: string;
  status?: "error" | "unsupported" | "unsafe_input" | "disabled";
  severity?: SchematronFindingSeverity;
}): SchematronContractFinding {
  return buildSchematronFutureRuleFinding({
    layer: input.layer,
    checkType: input.checkType,
    code: "SCHEMATRON_EXECUTION_ERROR",
    severity: input.severity ?? "warning",
    status: input.status ?? "error",
    field: "xml.schematron",
    message: input.message,
    sourceLabels: [
      "Schematron artifact executor",
      SCHEMATRON_ARTIFACT_EXECUTOR_VERSION,
      input.reason
    ],
    technicalCode: "SCHEMATRON_EXECUTION_ERROR",
    technicalMessage: input.reason
  });
}

function inspectXmlSafety(xml: string, maxXmlBytes: number): XmlSafetyResult {
  const byteLength = new TextEncoder().encode(xml).byteLength;

  if (byteLength > maxXmlBytes) {
    return {
      safe: false,
      reason: "schematron_artifact_executor_xml_too_large"
    };
  }

  if (/<!DOCTYPE/i.test(xml)) {
    return {
      safe: false,
      reason: "schematron_artifact_executor_doctype_blocked"
    };
  }

  if (/<!ENTITY/i.test(xml)) {
    return {
      safe: false,
      reason: "schematron_artifact_executor_entity_blocked"
    };
  }

  if (/\bSYSTEM\b/i.test(xml) || /\bPUBLIC\b/i.test(xml)) {
    return {
      safe: false,
      reason: "schematron_artifact_executor_external_identifier_blocked"
    };
  }

  if (/<\?xml-stylesheet/i.test(xml)) {
    return {
      safe: false,
      reason: "schematron_artifact_executor_stylesheet_blocked"
    };
  }

  return {
    safe: true,
    reason: ""
  };
}

function isElementNode(node: SlimdomNode): node is SlimdomElement {
  return node.nodeType === ELEMENT_NODE;
}

function childElements(node: SlimdomNode): SlimdomElement[] {
  const children: SlimdomElement[] = [];

  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes[index];

    if (child && isElementNode(child)) {
      children.push(child);
    }
  }

  return children;
}

function descendants(node: SlimdomNode): SlimdomElement[] {
  const results: SlimdomElement[] = [];

  for (const child of childElements(node)) {
    results.push(child);
    results.push(...descendants(child));
  }

  return results;
}

function elementLocalName(element: SlimdomElement) {
  return (element.localName || element.nodeName).split(":").pop() ?? "";
}

function elementNamespace(element: SlimdomElement) {
  return element.namespaceURI ?? "";
}

function findFirstUnsupportedElement(root: SlimdomElement) {
  const elements = [root, ...descendants(root)];

  for (const element of elements) {
    const localName = elementLocalName(element);
    const namespaceUri = elementNamespace(element);

    if (namespaceUri !== SCHEMATRON_NAMESPACE) {
      return {
        reason: "schematron_artifact_foreign_element_unsupported",
        detail: localName
      };
    }

    if (
      UNSUPPORTED_SCHEMATRON_ELEMENTS.has(localName) ||
      !ALLOWED_SCHEMATRON_ELEMENTS.has(localName)
    ) {
      return {
        reason: `schematron_artifact_${localName}_unsupported`,
        detail: localName
      };
    }

    if (
      (localName === "pattern" || localName === "rule") &&
      (element.getAttribute("abstract") === "true" ||
        element.hasAttribute("is-a"))
    ) {
      return {
        reason: "schematron_artifact_abstract_pattern_or_rule_unsupported",
        detail: localName
      };
    }
  }

  return null;
}

function getElementsByLocalName(root: SlimdomElement, localName: string) {
  return [root, ...descendants(root)].filter(
    (element) =>
      elementNamespace(element) === SCHEMATRON_NAMESPACE &&
      elementLocalName(element) === localName
  );
}

function readSimpleElementText(input: {
  element: SlimdomElement;
  reasonPrefix: string;
}):
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (childElements(input.element).length > 0) {
    return {
      ok: false,
      reason: `${input.reasonPrefix}_dynamic_text_unsupported`
    };
  }

  return {
    ok: true,
    text: sanitizeSchematronText(input.element.textContent ?? "", 700)
  };
}

function collectNamespaces(root: SlimdomElement) {
  const namespaceMappings: Record<string, string> = {};

  for (const nsElement of getElementsByLocalName(root, "ns")) {
    const prefix = nsElement.getAttribute("prefix")?.trim() ?? "";
    const uri = nsElement.getAttribute("uri")?.trim() ?? "";

    if (!SAFE_PREFIX_PATTERN.test(prefix) || !uri) {
      return {
        ok: false as const,
        reason: "schematron_artifact_namespace_mapping_unsupported"
      };
    }

    namespaceMappings[prefix] = uri;
  }

  return {
    ok: true as const,
    namespaceMappings
  };
}

function collectDiagnostics(root: SlimdomElement) {
  const diagnostics = new Map<string, string>();

  for (const diagnosticElement of getElementsByLocalName(root, "diagnostic")) {
    const id = diagnosticElement.getAttribute("id")?.trim() ?? "";
    const text = readSimpleElementText({
      element: diagnosticElement,
      reasonPrefix: "schematron_artifact_diagnostic"
    });

    if (!text.ok) {
      return text;
    }

    if (id) {
      diagnostics.set(id, text.text);
    }
  }

  return {
    ok: true as const,
    diagnostics
  };
}

function diagnosticReferenceFor(
  element: SlimdomElement,
  diagnostics: Map<string, string>
) {
  const refs = (element.getAttribute("diagnostics") ?? "")
    .split(/\s+/)
    .map((ref) => ref.trim())
    .filter(Boolean);
  const values = refs
    .map((ref) => diagnostics.get(ref) ?? ref)
    .map((value) => sanitizeSchematronText(value, 240))
    .filter(Boolean);

  return values.length > 0 ? [...new Set(values)].join(" | ") : undefined;
}

function inferBusinessRuleId(...values: Array<string | undefined>) {
  for (const value of values) {
    const match = value?.match(BUSINESS_RULE_ID_PATTERN);

    if (match?.[0]) {
      return sanitizeSchematronText(match[0].toUpperCase(), 120);
    }
  }

  return undefined;
}

function parseSchematronArtifact(input: {
  artifactXml: string;
  layer: SchematronLayer;
  checkType: SchematronCheckType;
}): ParsedSchematronArtifact {
  if (XMLValidator.validate(input.artifactXml) !== true) {
    return {
      ok: false,
      reason: "schematron_artifact_xml_parse_failed",
      finding: buildExecutionFinding({
        layer: input.layer,
        checkType: input.checkType,
        reason: "schematron_artifact_xml_parse_failed",
        status: "unsupported",
        message:
          "The configured local Schematron artifact could not be parsed as supported XML."
      })
    };
  }

  const documentNode = new DOMParser().parseFromString(
    input.artifactXml,
    "application/xml"
  );
  const root = documentNode.documentElement;

  if (!root || elementLocalName(root) !== "schema") {
    return {
      ok: false,
      reason: "schematron_artifact_root_schema_required",
      finding: buildExecutionFinding({
        layer: input.layer,
        checkType: input.checkType,
        reason: "schematron_artifact_root_schema_required",
        status: "unsupported",
        message:
          "The configured local Schematron artifact does not use a supported sch:schema root."
      })
    };
  }

  if (elementNamespace(root) !== SCHEMATRON_NAMESPACE) {
    return {
      ok: false,
      reason: "schematron_artifact_namespace_unsupported",
      finding: buildExecutionFinding({
        layer: input.layer,
        checkType: input.checkType,
        reason: "schematron_artifact_namespace_unsupported",
        status: "unsupported",
        message:
          "The configured local Schematron artifact does not use the supported ISO Schematron namespace."
      })
    };
  }

  const queryBinding =
    root.getAttribute("queryBinding")?.trim().toLowerCase() ?? "";

  if (!SUPPORTED_QUERY_BINDINGS.has(queryBinding)) {
    return {
      ok: false,
      reason: "schematron_artifact_query_binding_unsupported",
      finding: buildExecutionFinding({
        layer: input.layer,
        checkType: input.checkType,
        reason: "schematron_artifact_query_binding_unsupported",
        status: "unsupported",
        message:
          "The configured local Schematron artifact uses an unsupported query binding for this guarded XPath engine."
      })
    };
  }

  const unsupportedElement = findFirstUnsupportedElement(root);

  if (unsupportedElement) {
    return {
      ok: false,
      reason: unsupportedElement.reason,
      finding: buildExecutionFinding({
        layer: input.layer,
        checkType: input.checkType,
        reason: unsupportedElement.reason,
        status: "unsupported",
        message:
          "The configured local Schematron artifact uses a construct that this guarded execution layer does not support."
      })
    };
  }

  const namespaces = collectNamespaces(root);

  if (!namespaces.ok) {
    return {
      ok: false,
      reason: namespaces.reason,
      finding: buildExecutionFinding({
        layer: input.layer,
        checkType: input.checkType,
        reason: namespaces.reason,
        status: "unsupported",
        message:
          "The configured local Schematron artifact contains an unsupported namespace mapping."
      })
    };
  }

  const diagnostics = collectDiagnostics(root);

  if (!diagnostics.ok) {
    return {
      ok: false,
      reason: diagnostics.reason,
      finding: buildExecutionFinding({
        layer: input.layer,
        checkType: input.checkType,
        reason: diagnostics.reason,
        status: "unsupported",
        message:
          "The configured local Schematron artifact uses diagnostic text that is not supported by this guarded execution layer."
      })
    };
  }

  const assertions: SchematronXPathAssertionInput[] = [];
  const patterns = getElementsByLocalName(root, "pattern");
  let ruleCount = 0;
  let reportCount = 0;

  for (const pattern of patterns) {
    const rules = childElements(pattern).filter(
      (element) =>
        elementNamespace(element) === SCHEMATRON_NAMESPACE &&
        elementLocalName(element) === "rule"
    );

    for (const rule of rules) {
      ruleCount += 1;
      const context = rule.getAttribute("context")?.trim() ?? "";

      if (!context) {
        return {
          ok: false,
          reason: "schematron_artifact_rule_context_required",
          finding: buildExecutionFinding({
            layer: input.layer,
            checkType: input.checkType,
            reason: "schematron_artifact_rule_context_required",
            status: "unsupported",
            message:
              "The configured local Schematron artifact contains a rule without a context XPath."
          })
        };
      }

      const ruleId = rule.getAttribute("id")?.trim();
      const ruleAssertions = childElements(rule).filter((element) => {
        const localName = elementLocalName(element);

        return (
          elementNamespace(element) === SCHEMATRON_NAMESPACE &&
          (localName === "assert" || localName === "report")
        );
      });

      for (const assertionElement of ruleAssertions) {
        const localName = elementLocalName(assertionElement);
        const testExpression = assertionElement.getAttribute("test")?.trim() ?? "";
        const text = readSimpleElementText({
          element: assertionElement,
          reasonPrefix: "schematron_artifact_assertion"
        });

        if (!testExpression) {
          return {
            ok: false,
            reason: "schematron_artifact_assertion_test_required",
            finding: buildExecutionFinding({
              layer: input.layer,
              checkType: input.checkType,
              reason: "schematron_artifact_assertion_test_required",
              status: "unsupported",
              message:
                "The configured local Schematron artifact contains an assert/report without a test XPath."
            })
          };
        }

        if (!text.ok) {
          return {
            ok: false,
            reason: text.reason,
            finding: buildExecutionFinding({
              layer: input.layer,
              checkType: input.checkType,
              reason: text.reason,
              status: "unsupported",
              message:
                "The configured local Schematron artifact uses assertion text that is not supported by this guarded execution layer."
            })
          };
        }

        if (localName === "report") {
          reportCount += 1;
        }

        const id =
          assertionElement.getAttribute("id")?.trim() ??
          ruleId ??
          `${input.layer}_${ruleCount}_${assertions.length + 1}`;
        const businessRuleId = inferBusinessRuleId(id, text.text);
        const diagnosticReference = diagnosticReferenceFor(
          assertionElement,
          diagnostics.diagnostics
        );
        const flag = assertionElement.getAttribute("flag")?.trim();
        const role = assertionElement.getAttribute("role")?.trim();

        assertions.push({
          kind: localName === "report" ? "report" : "assert",
          ruleId: id,
          ...(businessRuleId ? { businessRuleId } : {}),
          schematronLayer: input.layer,
          contextXPath: context,
          testExpression,
          assertionText:
            text.text ||
            (localName === "report"
              ? "A Schematron report item was emitted."
              : "A Schematron assertion failed."),
          severity:
            (flag ?? "").toLowerCase() === "info"
              ? "info"
              : (flag ?? "").toLowerCase() === "warning"
                ? "warning"
                : "fatal",
          ...(flag ? { flag } : {}),
          ...(role ? { role } : {}),
          ...(diagnosticReference ? { diagnosticReference } : {}),
          sourceLabels: [
            "Schematron artifact executor",
            SCHEMATRON_ARTIFACT_EXECUTOR_VERSION,
            input.layer
          ]
        });
      }
    }
  }

  if (assertions.length === 0) {
    return {
      ok: false,
      reason: "schematron_artifact_no_supported_assertions",
      finding: buildExecutionFinding({
        layer: input.layer,
        checkType: input.checkType,
        reason: "schematron_artifact_no_supported_assertions",
        status: "unsupported",
        message:
          "The configured local Schematron artifact contains no supported assert/report rules for this execution layer."
      })
    };
  }

  return {
    ok: true,
    assertions,
    namespaceMappings: namespaces.namespaceMappings,
    summary: {
      assertionCount: assertions.length - reportCount,
      reportCount,
      ruleCount,
      patternCount: patterns.length,
      namespacePrefixCount: Object.keys(namespaces.namespaceMappings).length
    }
  };
}

function isEngineAvailableForArtifactExecution(
  engineCandidate: SchematronEngineCandidateInfo
) {
  return (
    engineCandidate.engineId === SCHEMATRON_XPATH_ENGINE_ID &&
    engineCandidate.availabilityStatus === "available" &&
    engineCandidate.executionSupported === true &&
    engineCandidate.capabilities.includes("xpath_assertion_execution")
  );
}

function artifactNotConfiguredResult(input: {
  layer: SchematronLayer;
  checkType: SchematronCheckType;
  reason: string;
  artifactDiagnostics?: SchematronSafeArtifactDiagnostics;
  policy?: unknown;
}) {
  return buildResult({
    status: "not_configured",
    layer: input.layer,
    checkType: input.checkType,
    validationExecutionEnabled: false,
    validationExecuted: false,
    markedValid: false,
    reason: input.reason,
    findings: [
      withCheckType(
        buildSchematronArtifactNotConfiguredFinding({
          layer: input.layer
        }),
        input.checkType
      )
    ],
    ...(input.artifactDiagnostics
      ? { artifactDiagnostics: input.artifactDiagnostics }
      : {}),
    ...(input.policy ? { policy: input.policy } : {})
  });
}

function artifactUnreadableResult(input: {
  layer: SchematronLayer;
  checkType: SchematronCheckType;
  reason: string;
  artifactDiagnostics?: SchematronSafeArtifactDiagnostics;
  policy?: unknown;
}) {
  return buildResult({
    status: "artifact_unreadable",
    layer: input.layer,
    checkType: input.checkType,
    validationExecutionEnabled: false,
    validationExecuted: false,
    markedValid: false,
    reason: input.reason,
    findings: [
      withCheckType(
        buildSchematronArtifactUnreadableFinding({
          layer: input.layer,
          reason: input.reason
        }),
        input.checkType
      )
    ],
    ...(input.artifactDiagnostics
      ? { artifactDiagnostics: input.artifactDiagnostics }
      : {}),
    ...(input.policy ? { policy: input.policy } : {})
  });
}

export async function runSchematronArtifactExecutor(input: {
  xml: string;
  layer: Exclude<SchematronLayer, "unknown">;
  artifactConfig?: SchematronArtifactConfigInput;
  artifactDiagnostics?: SchematronSafeArtifactDiagnostics;
  policy: SchematronExecutionPolicy;
  engineCandidate: SchematronEngineCandidateInfo;
  maxXmlBytes?: number;
  maxResults?: number;
}): Promise<SchematronArtifactExecutorResult> {
  const layer = input.layer;
  const checkType = checkTypeForLayer(layer);
  const policySummary = input.policy.safeSummary;

  if (input.policy.mode === "disabled") {
    return buildResult({
      status: "disabled",
      layer,
      checkType,
      validationExecutionEnabled: false,
      validationExecuted: false,
      markedValid: false,
      reason: "schematron_artifact_execution_disabled_by_policy",
      findings: [
        buildExecutionFinding({
          layer,
          checkType,
          reason: "schematron_artifact_execution_disabled_by_policy",
          status: "disabled",
          message:
            "Guarded local Schematron execution is disabled by policy. No Schematron validation ran."
        })
      ],
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  if (input.policy.mode !== "execute" || !input.policy.executionPermitted) {
    return buildResult({
      status:
        input.policy.mode === "preflight_only"
          ? "preflight_only"
          : "blocked_by_policy",
      layer,
      checkType,
      validationExecutionEnabled: false,
      validationExecuted: false,
      markedValid: false,
      reason: input.policy.reason,
      findings: [
        buildExecutionFinding({
          layer,
          checkType,
          reason: input.policy.reason,
          status: "unsupported",
          message:
            "Guarded local Schematron execution was not explicitly permitted by policy. No Schematron validation ran."
        })
      ],
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  if (!isEngineAvailableForArtifactExecution(input.engineCandidate)) {
    const reason = "schematron_artifact_xpath_engine_unavailable";

    return buildResult({
      status: "engine_unavailable",
      layer,
      checkType,
      validationExecutionEnabled: false,
      validationExecuted: false,
      markedValid: false,
      reason,
      findings: [
        buildExecutionFinding({
          layer,
          checkType,
          reason,
          message:
            "Guarded local Schematron execution requires the configured xpath_engine. No Schematron validation ran."
        })
      ],
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  const maxXmlBytes = input.maxXmlBytes ?? DEFAULT_MAX_XML_BYTES;
  const xmlSafety = inspectXmlSafety(input.xml, maxXmlBytes);

  if (!xmlSafety.safe) {
    return buildResult({
      status: "unsafe_input",
      layer,
      checkType,
      validationExecutionEnabled: true,
      validationExecuted: false,
      markedValid: false,
      reason: xmlSafety.reason,
      findings: [
        buildExecutionFinding({
          layer,
          checkType,
          reason: xmlSafety.reason,
          status: "unsafe_input",
          message:
            "The XML input was rejected by the guarded Schematron execution safety gate before execution."
        })
      ],
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  let inspection: SchematronArtifactInspection;

  try {
    inspection = await inspectSchematronArtifacts(input.artifactConfig);
  } catch {
    const reason = "schematron_artifact_inspection_failed";

    return buildResult({
      status: "error",
      layer,
      checkType,
      validationExecutionEnabled: false,
      validationExecuted: false,
      markedValid: false,
      reason,
      findings: [
        buildExecutionFinding({
          layer,
          checkType,
          reason,
          message:
            "The configured local Schematron artifact could not be inspected safely. No Schematron validation ran."
        })
      ],
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  if (!inspection.resolvedConfig.rootPath) {
    return artifactNotConfiguredResult({
      layer,
      checkType,
      reason: "schematron_artifact_root_not_configured",
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  const artifact = artifactForLayer(inspection, layer);

  if (!artifact.configured) {
    return artifactNotConfiguredResult({
      layer,
      checkType,
      reason: "schematron_artifact_path_not_configured",
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  if (!artifact.usable || !artifact.path) {
    return artifactUnreadableResult({
      layer,
      checkType,
      reason: artifact.reason ?? "schematron_artifact_not_usable",
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  let artifactXml: string;

  try {
    artifactXml = await readFile(artifact.path, "utf8");
  } catch {
    return artifactUnreadableResult({
      layer,
      checkType,
      reason: "schematron_artifact_read_failed",
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  if (new TextEncoder().encode(artifactXml).byteLength > MAX_ARTIFACT_BYTES) {
    return artifactUnreadableResult({
      layer,
      checkType,
      reason: "schematron_artifact_too_large",
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  const parsedArtifact = parseSchematronArtifact({
    artifactXml,
    layer,
    checkType
  });

  if (!parsedArtifact.ok) {
    return buildResult({
      status: "unsupported",
      layer,
      checkType,
      validationExecutionEnabled: true,
      validationExecuted: false,
      markedValid: false,
      reason: parsedArtifact.reason,
      findings: [parsedArtifact.finding],
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  const xpathResult = await runSchematronXPathEngine({
    xml: input.xml,
    assertions: parsedArtifact.assertions,
    mode: "execute",
    allowXPathExecution: true,
    checkType,
    namespaceMappings: parsedArtifact.namespaceMappings,
    maxXmlBytes,
    maxResults: input.maxResults ?? DEFAULT_MAX_RESULTS
  });

  if (xpathResult.status === "unsupported") {
    return buildResult({
      status: "unsupported",
      layer,
      checkType,
      validationExecutionEnabled: xpathResult.validationExecutionEnabled,
      validationExecuted: false,
      markedValid: false,
      reason: xpathResult.reason,
      findings: xpathResult.findings,
      parsedArtifact: parsedArtifact.summary,
      xpathEngine: xpathResult.safeSummary,
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  if (xpathResult.status === "unsafe_input") {
    return buildResult({
      status: "unsafe_input",
      layer,
      checkType,
      validationExecutionEnabled: xpathResult.validationExecutionEnabled,
      validationExecuted: false,
      markedValid: false,
      reason: xpathResult.reason,
      findings: xpathResult.findings,
      parsedArtifact: parsedArtifact.summary,
      xpathEngine: xpathResult.safeSummary,
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  if (xpathResult.status === "error" || xpathResult.status === "disabled") {
    return buildResult({
      status: "error",
      layer,
      checkType,
      validationExecutionEnabled: xpathResult.validationExecutionEnabled,
      validationExecuted: false,
      markedValid: false,
      reason: xpathResult.reason,
      findings: xpathResult.findings,
      parsedArtifact: parsedArtifact.summary,
      xpathEngine: xpathResult.safeSummary,
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {}),
      policy: policySummary
    });
  }

  const fatalOrFailed = xpathResult.findings.some(
    (finding) => finding.severity === "fatal" || finding.status === "failed"
  );
  const markedValid = xpathResult.validationExecuted && !fatalOrFailed;

  return buildResult({
    status: fatalOrFailed ? "failed" : "executed",
    layer,
    checkType,
    validationExecutionEnabled: true,
    validationExecuted: xpathResult.validationExecuted,
    markedValid,
    reason: fatalOrFailed
      ? "schematron_artifact_assertions_failed"
      : "schematron_artifact_execution_passed",
    findings: xpathResult.findings,
    parsedArtifact: parsedArtifact.summary,
    xpathEngine: xpathResult.safeSummary,
    ...(input.artifactDiagnostics
      ? { artifactDiagnostics: input.artifactDiagnostics }
      : {}),
    policy: policySummary
  });
}
