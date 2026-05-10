import {
  buildSchematronArtifactNotConfiguredFinding,
  buildSchematronArtifactUnreadableFinding,
  buildSchematronExecutionDisabledFinding,
  buildSchematronFutureRuleFinding,
  sanitizeSchematronText,
  type SchematronContractFinding
} from "./schematron-finding-contract.js";
import {
  runSchematronLocalExecutionPrototype,
  type SchematronLocalPrototypeRule,
  type SchematronLocalPrototypeStatus
} from "./schematron-local-execution-prototype.js";
import {
  mapSchematronSvrlResultsToFindings,
  type SchematronSvrlInputResult
} from "./schematron-result-mapper.js";
import {
  buildSchematronExecutionPolicy,
  type SchematronExecutionPolicy
} from "./schematron-execution-policy.js";
import {
  inspectSchematronEngineCandidate,
  type SchematronEngineCandidateInfo
} from "./schematron-engine-candidate.js";
import {
  buildInternalAssertionFixtureSummary,
  convertInternalFixtureToXPathAssertion,
  selectInternalSchematronAssertionFixtures,
  type SchematronInternalAssertionFixtureSummary
} from "./schematron-internal-assertion-fixtures.js";
import {
  SCHEMATRON_XPATH_ENGINE_ID,
  runSchematronXPathEngine
} from "./schematron-xpath-engine.js";
import type { SchematronSafeArtifactDiagnostics } from "./xsd-artifact-registry.js";

export const EN16931_EXECUTION_PATH_VERSION = "en16931_execution_path_v1";

export type En16931ExecutionMode =
  | "disabled"
  | "preflight_only"
  | "internal_test_only";

export type En16931ExecutionStatus =
  | "disabled"
  | "blocked_by_policy"
  | "not_configured"
  | "artifact_unreadable"
  | "engine_unavailable"
  | "ready_for_future_execution"
  | "executed"
  | "failed"
  | "unsafe_input"
  | "unsupported";

export type En16931ExecutionInput = {
  xml: string;
  mode?: En16931ExecutionMode;
  policy?: SchematronExecutionPolicy;
  engineCandidate?: SchematronEngineCandidateInfo;
  artifactDiagnostics?: SchematronSafeArtifactDiagnostics;
  prototypeRules?: SchematronLocalPrototypeRule[];
  svrlResults?: SchematronSvrlInputResult[];
  allowInternalXPathExecution?: boolean;
  internalAssertionFixtureIds?: readonly string[];
  maxInternalAssertionFixtures?: number;
  maxXmlBytes?: number;
  maxRules?: number;
};

export type En16931ExecutionSummary = {
  diagnosticKind: "en16931_execution_path";
  executionPathVersion: typeof EN16931_EXECUTION_PATH_VERSION;
  mode: En16931ExecutionMode;
  status: En16931ExecutionStatus;
  schematronLayer: "en16931_tc434";
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: false;
  findingCount: number;
  fatalCount: number;
  warningCount: number;
  infoCount: number;
  reason: string;
  internalAssertionFixtureSummary?: SchematronInternalAssertionFixtureSummary;
};

export type En16931ExecutionResult = {
  executionPathVersion: typeof EN16931_EXECUTION_PATH_VERSION;
  mode: En16931ExecutionMode;
  status: En16931ExecutionStatus;
  schematronLayer: "en16931_tc434";
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: false;
  reason: string;
  findings: SchematronContractFinding[];
  internalAssertionFixtureSummary?: SchematronInternalAssertionFixtureSummary;
  safeSummary: En16931ExecutionSummary;
};

const DEFAULT_MAX_XML_BYTES = 256 * 1024;
const DEFAULT_MAX_RESULTS = 500;

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number
) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
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
  mode: En16931ExecutionMode;
  status: En16931ExecutionStatus;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  reason: string;
  findings: SchematronContractFinding[];
  internalAssertionFixtureSummary?: SchematronInternalAssertionFixtureSummary;
}): En16931ExecutionResult {
  const counts = countFindings(input.findings);
  const base = {
    executionPathVersion: EN16931_EXECUTION_PATH_VERSION,
    mode: input.mode,
    status: input.status,
    schematronLayer: "en16931_tc434",
    validationExecutionEnabled: input.validationExecutionEnabled,
    validationExecuted: input.validationExecuted,
    markedValid: false,
    reason: sanitizeReason(input.reason),
    ...counts
  } satisfies Omit<
    En16931ExecutionSummary,
    "diagnosticKind" | "internalAssertionFixtureSummary"
  >;
  const internalAssertionFixtureSummary =
    input.internalAssertionFixtureSummary;

  return {
    executionPathVersion: EN16931_EXECUTION_PATH_VERSION,
    mode: base.mode,
    status: base.status,
    schematronLayer: base.schematronLayer,
    validationExecutionEnabled: base.validationExecutionEnabled,
    validationExecuted: base.validationExecuted,
    markedValid: false,
    reason: base.reason,
    findings: input.findings,
    ...(internalAssertionFixtureSummary
      ? { internalAssertionFixtureSummary }
      : {}),
    safeSummary: {
      diagnosticKind: "en16931_execution_path",
      ...base,
      ...(internalAssertionFixtureSummary
        ? { internalAssertionFixtureSummary }
        : {})
    }
  };
}

function sanitizeReason(reason: unknown) {
  const sanitized = sanitizeSchematronText(reason, 160);

  return sanitized || "en16931_execution_failed";
}

function buildEn16931ExecutionDisabledFinding(
  input: {
    configured?: boolean;
    usable?: boolean;
  } = {}
): SchematronContractFinding {
  const finding = buildSchematronExecutionDisabledFinding(input);

  return {
    ...finding,
    schematronLayer: "en16931_tc434",
    sourceLabels: [
      ...(finding.sourceLabels ?? []),
      "EN 16931 execution path",
      EN16931_EXECUTION_PATH_VERSION
    ]
  };
}

function buildExecutionErrorFinding(input: {
  reason: string;
  message: string;
  status?: "error" | "failed";
}): SchematronContractFinding {
  return buildSchematronFutureRuleFinding({
    layer: "en16931_tc434",
    code: "SCHEMATRON_EXECUTION_ERROR",
    severity: "warning",
    status: input.status ?? "error",
    field: "xml.schematron",
    message: input.message,
    sourceLabels: [
      "EN 16931 execution path",
      EN16931_EXECUTION_PATH_VERSION,
      "SCHEMATRON_EXECUTION_ERROR"
    ],
    technicalCode: "SCHEMATRON_EXECUTION_ERROR",
    technicalMessage: input.reason
  });
}

function inspectEn16931ExecutionXmlSafety(input: {
  xml: string;
  maxXmlBytes: number;
}) {
  const byteLength = getUtf8ByteLength(input.xml);

  if (byteLength > input.maxXmlBytes) {
    return {
      safe: false,
      reason: "en16931_execution_xml_too_large"
    };
  }

  if (/<!DOCTYPE/i.test(input.xml)) {
    return {
      safe: false,
      reason: "en16931_execution_doctype_blocked"
    };
  }

  if (/<!ENTITY/i.test(input.xml)) {
    return {
      safe: false,
      reason: "en16931_execution_entity_blocked"
    };
  }

  if (/\bSYSTEM\b/i.test(input.xml) || /\bPUBLIC\b/i.test(input.xml)) {
    return {
      safe: false,
      reason: "en16931_execution_external_identifier_blocked"
    };
  }

  if (/<\?xml-stylesheet/i.test(input.xml)) {
    return {
      safe: false,
      reason: "en16931_execution_stylesheet_blocked"
    };
  }

  return {
    safe: true,
    reason: ""
  };
}

function buildDefaultArtifactDiagnostics(): SchematronSafeArtifactDiagnostics {
  const notConfiguredArtifact = {
    configured: false,
    status: "not_configured",
    readable: false,
    usable: false,
    sha256: null,
    label: null,
    basename: null,
    reason: "local_schematron_artifact_path_not_configured"
  } as const;

  return {
    diagnosticKind: "schematron_artifacts",
    configured: false,
    usable: false,
    readyArtifactCount: 0,
    requiredArtifactCount: 2,
    allRequiredArtifactsReadable: false,
    validatorName: "schematron-placeholder",
    validatorAvailable: false,
    validationExecutionEnabled: false,
    artifactVersion: null,
    checkedAt: new Date().toISOString(),
    peppolBisArtifact: {
      artifactKind: "peppol_bis_billing",
      ...notConfiguredArtifact
    },
    en16931Artifact: {
      artifactKind: "en16931_tc434",
      ...notConfiguredArtifact
    },
    disclaimer:
      "Technical Schematron artefact diagnostics only. No Schematron validation execution is enabled."
  };
}

function isEngineAvailableForInternalExecution(
  engineCandidate: SchematronEngineCandidateInfo
) {
  return (
    engineCandidate.availabilityStatus === "available" &&
    engineCandidate.executionSupported === true &&
    engineCandidate.capabilities.includes("test_only")
  );
}

function isXPathEngineAvailableForInternalFixtureExecution(
  engineCandidate: SchematronEngineCandidateInfo
) {
  return (
    engineCandidate.engineId === SCHEMATRON_XPATH_ENGINE_ID &&
    engineCandidate.availabilityStatus === "available" &&
    engineCandidate.executionSupported === true &&
    engineCandidate.capabilities.includes("test_only") &&
    engineCandidate.capabilities.includes("xpath_assertion_execution")
  );
}

function getFailedStatus(findings: readonly SchematronContractFinding[]) {
  return findings.some(
    (finding) => finding.status === "failed" || finding.severity === "fatal"
  );
}

function mapPrototypeStatus(
  status: SchematronLocalPrototypeStatus
): En16931ExecutionStatus {
  if (status === "executed") {
    return "executed";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "unsafe_input") {
    return "unsafe_input";
  }

  if (status === "unsupported") {
    return "unsupported";
  }

  return "disabled";
}

function mapXPathStatusToEn16931Status(
  status: Awaited<ReturnType<typeof runSchematronXPathEngine>>["status"]
): En16931ExecutionStatus {
  if (status === "executed") {
    return "executed";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "unsafe_input") {
    return "unsafe_input";
  }

  if (status === "unsupported") {
    return "unsupported";
  }

  if (status === "disabled") {
    return "disabled";
  }

  return "failed";
}

export function normalizeEn16931ExecutionMode(
  value: unknown
): En16931ExecutionMode {
  if (value === "preflight_only" || value === "internal_test_only") {
    return value;
  }

  return "disabled";
}

async function resolvePolicyAndEngine(input: {
  policy?: SchematronExecutionPolicy;
  engineCandidate?: SchematronEngineCandidateInfo;
}) {
  const policy = input.policy ?? buildSchematronExecutionPolicy();
  const engineCandidate =
    input.engineCandidate ??
    (await inspectSchematronEngineCandidate({
      engineId: policy.engineId
    }));

  return {
    policy,
    engineCandidate
  };
}

async function runPreflightOnly(input: {
  mode: En16931ExecutionMode;
  policy?: SchematronExecutionPolicy;
  engineCandidate?: SchematronEngineCandidateInfo;
  artifactDiagnostics?: SchematronSafeArtifactDiagnostics;
}) {
  const diagnostics =
    input.artifactDiagnostics ?? buildDefaultArtifactDiagnostics();
  const en16931Artifact = diagnostics.en16931Artifact;
  const { policy, engineCandidate } = await resolvePolicyAndEngine({
    ...(input.policy ? { policy: input.policy } : {}),
    ...(input.engineCandidate ? { engineCandidate: input.engineCandidate } : {})
  });

  if (policy.mode === "blocked_requested_execution") {
    const reason = "en16931_execution_blocked_by_policy";

    return buildResult({
      mode: input.mode,
      status: "blocked_by_policy",
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason,
      findings: [
        buildExecutionErrorFinding({
          reason,
          message:
            "EN 16931 / TC434 Schematron execution was requested but blocked by policy. No Schematron validation ran."
        })
      ]
    });
  }

  if (!en16931Artifact.configured) {
    return buildResult({
      mode: input.mode,
      status: "not_configured",
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason: "en16931_artifacts_not_configured",
      findings: [
        buildSchematronArtifactNotConfiguredFinding({
          layer: "en16931_tc434"
        })
      ]
    });
  }

  if (!en16931Artifact.usable) {
    return buildResult({
      mode: input.mode,
      status: "artifact_unreadable",
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason: "en16931_artifacts_not_usable",
      findings: [
        buildSchematronArtifactUnreadableFinding({
          layer: "en16931_tc434",
          reason: "en16931_artifacts_not_usable"
        })
      ]
    });
  }

  if (!isEngineAvailableForInternalExecution(engineCandidate)) {
    const reason = "en16931_engine_unavailable";

    return buildResult({
      mode: input.mode,
      status: "engine_unavailable",
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason,
      findings: [
        buildExecutionErrorFinding({
          reason,
          message:
            "An EN 16931 / TC434 Schematron execution engine is not available for this guarded package-level path. No Schematron validation ran."
        })
      ]
    });
  }

  return buildResult({
    mode: input.mode,
    status: "ready_for_future_execution",
    validationExecutionEnabled: false,
    validationExecuted: false,
    reason: "en16931_ready_but_execution_not_enabled",
    findings: [
      buildEn16931ExecutionDisabledFinding({
        configured: en16931Artifact.configured,
        usable: en16931Artifact.usable
      })
    ]
  });
}

function wantsInternalAssertionFixtureExecution(input: En16931ExecutionInput) {
  return (
    input.allowInternalXPathExecution === true ||
    input.internalAssertionFixtureIds !== undefined ||
    input.maxInternalAssertionFixtures !== undefined
  );
}

async function runInternalAssertionFixtures(input: En16931ExecutionInput) {
  const mode: En16931ExecutionMode = "internal_test_only";
  const internalAssertionFixtureSummary = buildInternalAssertionFixtureSummary({
    layer: "en16931_tc434",
    ...(input.internalAssertionFixtureIds
      ? { fixtureIds: input.internalAssertionFixtureIds }
      : {}),
    ...(input.maxInternalAssertionFixtures !== undefined
      ? { maxFixtures: input.maxInternalAssertionFixtures }
      : {})
  });

  if (input.allowInternalXPathExecution !== true) {
    const reason = "en16931_internal_xpath_execution_not_allowed";

    return buildResult({
      mode,
      status: "unsupported",
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason,
      findings: [
        buildExecutionErrorFinding({
          reason,
          message:
            "The EN 16931-style internal assertion fixture path requires an explicit package-level XPath execution guard."
        })
      ],
      internalAssertionFixtureSummary
    });
  }

  const { policy, engineCandidate } = await resolvePolicyAndEngine({
    ...(input.policy ? { policy: input.policy } : {}),
    ...(input.engineCandidate ? { engineCandidate: input.engineCandidate } : {})
  });

  if (policy.mode === "blocked_requested_execution") {
    const reason = "en16931_internal_xpath_blocked_by_policy";

    return buildResult({
      mode,
      status: "blocked_by_policy",
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason,
      findings: [
        buildExecutionErrorFinding({
          reason,
          message:
            "The EN 16931-style internal assertion fixture path was blocked by execution policy."
        })
      ],
      internalAssertionFixtureSummary
    });
  }

  if (
    policy.engineId !== SCHEMATRON_XPATH_ENGINE_ID ||
    !isXPathEngineAvailableForInternalFixtureExecution(engineCandidate)
  ) {
    const reason = "en16931_internal_xpath_engine_unavailable";

    return buildResult({
      mode,
      status: "engine_unavailable",
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason,
      findings: [
        buildExecutionErrorFinding({
          reason,
          message:
            "The EN 16931-style internal assertion fixture path requires the guarded xpath_engine candidate."
        })
      ],
      internalAssertionFixtureSummary
    });
  }

  const assertions = selectInternalSchematronAssertionFixtures({
    layer: "en16931_tc434",
    ...(input.internalAssertionFixtureIds
      ? { fixtureIds: input.internalAssertionFixtureIds }
      : {}),
    ...(input.maxInternalAssertionFixtures !== undefined
      ? { maxFixtures: input.maxInternalAssertionFixtures }
      : {})
  }).map((fixture) => convertInternalFixtureToXPathAssertion(fixture));
  const xpathResult = await runSchematronXPathEngine({
    xml: input.xml,
    assertions,
    mode: "internal_test_only",
    allowInternalXPathExecution: true,
    maxAssertions: internalAssertionFixtureSummary.maxFixtureCount,
    ...(input.maxXmlBytes !== undefined ? { maxXmlBytes: input.maxXmlBytes } : {})
  });

  return buildResult({
    mode,
    status: mapXPathStatusToEn16931Status(xpathResult.status),
    validationExecutionEnabled: xpathResult.validationExecutionEnabled,
    validationExecuted: xpathResult.validationExecuted,
    reason: xpathResult.reason,
    findings: xpathResult.findings,
    internalAssertionFixtureSummary
  });
}

function buildUnsafeInputResult(input: {
  mode: En16931ExecutionMode;
  reason: string;
}) {
  return buildResult({
    mode: input.mode,
    status: "unsafe_input",
    validationExecutionEnabled: false,
    validationExecuted: false,
    reason: input.reason,
    findings: [
      buildExecutionErrorFinding({
        reason: input.reason,
        message:
          "The guarded EN 16931 / TC434 execution path rejected the XML before execution."
      })
    ]
  });
}

async function runInternalTestOnly(input: En16931ExecutionInput) {
  const mode: En16931ExecutionMode = "internal_test_only";
  const maxXmlBytes = normalizePositiveInteger(
    input.maxXmlBytes,
    DEFAULT_MAX_XML_BYTES
  );
  const safety = inspectEn16931ExecutionXmlSafety({
    xml: input.xml,
    maxXmlBytes
  });

  if (!safety.safe) {
    return buildUnsafeInputResult({
      mode,
      reason: safety.reason
    });
  }

  try {
    if (wantsInternalAssertionFixtureExecution(input)) {
      return runInternalAssertionFixtures(input);
    }

    if (Array.isArray(input.svrlResults)) {
      const mapped = mapSchematronSvrlResultsToFindings({
        layer: "en16931_tc434",
        results: input.svrlResults,
        maxResults: normalizePositiveInteger(input.maxRules, DEFAULT_MAX_RESULTS)
      });
      const hasFailures = getFailedStatus(mapped.findings);

      return buildResult({
        mode,
        status: hasFailures ? "failed" : "executed",
        validationExecutionEnabled: true,
        validationExecuted: true,
        reason: hasFailures
          ? "en16931_internal_test_findings_mapped"
          : "en16931_internal_test_results_mapped",
        findings: mapped.findings
      });
    }

    const rules = Array.isArray(input.prototypeRules)
      ? input.prototypeRules
      : [];
    const prototype = await runSchematronLocalExecutionPrototype({
      xml: input.xml,
      rules,
      mode: "internal_test_only",
      layer: "en16931_tc434",
      ...(input.maxXmlBytes !== undefined
        ? { maxXmlBytes: input.maxXmlBytes }
        : {}),
      ...(input.maxRules !== undefined ? { maxRules: input.maxRules } : {})
    });

    return buildResult({
      mode,
      status: mapPrototypeStatus(prototype.status),
      validationExecutionEnabled: prototype.validationExecutionEnabled,
      validationExecuted: prototype.validationExecuted,
      reason: prototype.reason,
      findings: prototype.findings
    });
  } catch {
    const reason = "en16931_internal_test_execution_failed";

    return buildResult({
      mode,
      status: "failed",
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason,
      findings: [
        buildExecutionErrorFinding({
          reason,
          message:
            "The guarded EN 16931 / TC434 internal test-only execution path failed safely."
        })
      ]
    });
  }
}

export async function runEn16931ExecutionPath(
  input: En16931ExecutionInput
): Promise<En16931ExecutionResult> {
  const mode = normalizeEn16931ExecutionMode(input.mode);

  if (mode === "disabled") {
    return buildResult({
      mode,
      status: "disabled",
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason: "en16931_execution_disabled",
      findings: [buildEn16931ExecutionDisabledFinding()]
    });
  }

  if (mode === "preflight_only") {
    return runPreflightOnly({
      mode,
      ...(input.policy ? { policy: input.policy } : {}),
      ...(input.engineCandidate ? { engineCandidate: input.engineCandidate } : {}),
      ...(input.artifactDiagnostics
        ? { artifactDiagnostics: input.artifactDiagnostics }
        : {})
    });
  }

  return runInternalTestOnly(input);
}
