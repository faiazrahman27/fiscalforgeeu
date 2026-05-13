import {
  buildSchematronExecutionPolicy,
  buildSafeSchematronArtifactDiagnostics,
  inspectSchematronEngineCandidate,
  inspectXmlSafety,
  readSchematronArtifactConfigFromEnv,
  runSchematronExecutionOrchestrator,
  type SchematronContractFinding,
  type SchematronExecutionOrchestratorStatus,
  type SchematronExecutionPolicyInput,
  type SchematronLocalPrototypeRule,
  type SchematronSvrlInputResult
} from "@invoice-lantern/ubl";

export const XML_WORKER_SCHEMATRON_ORCHESTRATOR_VERSION =
  "xml_worker_schematron_orchestrator_v1";

export type XmlWorkerSchematronMode =
  | "disabled"
  | "preflight_only"
  | "execute"
  | "internal_test_only";

export type XmlWorkerSchematronStatus =
  | "disabled"
  | "not_requested"
  | "not_configured"
  | "artifact_unreadable"
  | "engine_unavailable"
  | "ready_for_future_execution"
  | "executed"
  | "failed"
  | "partial"
  | "unsafe_input"
  | "unsupported"
  | "error";

export type XmlWorkerSchematronInput = {
  xml: string;
  requestedChecks: string[];
  mode?: XmlWorkerSchematronMode;
  allowInternalTestExecution?: boolean;
  peppolPrototypeRules?: SchematronLocalPrototypeRule[];
  en16931PrototypeRules?: SchematronLocalPrototypeRule[];
  peppolSvrlResults?: SchematronSvrlInputResult[];
  en16931SvrlResults?: SchematronSvrlInputResult[];
};

export type XmlWorkerSchematronSummary = {
  diagnosticKind: "xml_worker_schematron_orchestration";
  workerSchematronOrchestratorVersion: typeof XML_WORKER_SCHEMATRON_ORCHESTRATOR_VERSION;
  status: XmlWorkerSchematronStatus;
  mode: XmlWorkerSchematronMode;
  requested: boolean;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: boolean;
  findingCount: number;
  fatalCount: number;
  warningCount: number;
  infoCount: number;
  reason: string;
  orchestrator?: unknown;
};

export type XmlWorkerSchematronResult = {
  workerSchematronOrchestratorVersion: typeof XML_WORKER_SCHEMATRON_ORCHESTRATOR_VERSION;
  status: XmlWorkerSchematronStatus;
  mode: XmlWorkerSchematronMode;
  requested: boolean;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: boolean;
  reason: string;
  findings: SchematronContractFinding[];
  safeSummary: XmlWorkerSchematronSummary;
};

function getBooleanLikeEnv(value: string | undefined) {
  return ["true", "1", "yes"].includes(value?.trim().toLowerCase() ?? "");
}

function readSchematronExecutionPolicyInputFromEnv(): SchematronExecutionPolicyInput {
  return {
    ...(process.env.SCHEMATRON_EXECUTION_MODE !== undefined
      ? { requestedMode: process.env.SCHEMATRON_EXECUTION_MODE }
      : {}),
    ...(process.env.SCHEMATRON_ENGINE !== undefined
      ? { requestedEngine: process.env.SCHEMATRON_ENGINE }
      : {}),
    allowExperimentalExecution: getBooleanLikeEnv(
      process.env.SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION
    )
  };
}

function hasSchematronRequest(requestedChecks: readonly string[]) {
  return requestedChecks.some((check) =>
    [
      "schematron_peppol_placeholder",
      "schematron_peppol",
      "schematron_en16931"
    ].includes(check)
  );
}

function hasRealSchematronRequest(requestedChecks: readonly string[]) {
  return requestedChecks.some((check) =>
    ["schematron_peppol", "schematron_en16931"].includes(check)
  );
}

function layerSelectionForRequest(requestedChecks: readonly string[]) {
  const wantsPeppol =
    requestedChecks.includes("schematron_peppol") ||
    requestedChecks.includes("schematron_peppol_placeholder");
  const wantsEn16931 = requestedChecks.includes("schematron_en16931");

  if (wantsPeppol && wantsEn16931) {
    return "both" as const;
  }

  if (wantsEn16931) {
    return "en16931_tc434" as const;
  }

  return "peppol_bis_billing" as const;
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

function mapOrchestratorStatus(
  status: SchematronExecutionOrchestratorStatus
): XmlWorkerSchematronStatus {
  if (status === "blocked_by_policy") {
    return "unsupported";
  }

  return status;
}

function buildResult(input: {
  status: XmlWorkerSchematronStatus;
  mode: XmlWorkerSchematronMode;
  requested: boolean;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid?: boolean;
  reason: string;
  findings?: SchematronContractFinding[];
  orchestrator?: unknown;
}): XmlWorkerSchematronResult {
  const findings = input.findings ?? [];
  const counts = countFindings(findings);
  const safeSummary = {
    diagnosticKind: "xml_worker_schematron_orchestration",
    workerSchematronOrchestratorVersion:
      XML_WORKER_SCHEMATRON_ORCHESTRATOR_VERSION,
    status: input.status,
    mode: input.mode,
    requested: input.requested,
    validationExecutionEnabled: input.validationExecutionEnabled,
    validationExecuted: input.validationExecuted,
    markedValid: input.markedValid ?? false,
    ...counts,
    reason: input.reason,
    ...(input.orchestrator ? { orchestrator: input.orchestrator } : {})
  } satisfies XmlWorkerSchematronSummary;

  return {
    workerSchematronOrchestratorVersion:
      XML_WORKER_SCHEMATRON_ORCHESTRATOR_VERSION,
    status: input.status,
    mode: input.mode,
    requested: input.requested,
    validationExecutionEnabled: input.validationExecutionEnabled,
    validationExecuted: input.validationExecuted,
    markedValid: input.markedValid ?? false,
    reason: input.reason,
    findings,
    safeSummary
  };
}

export function normalizeXmlWorkerSchematronMode(
  value: unknown
): XmlWorkerSchematronMode {
  if (
    value === "preflight_only" ||
    value === "internal_test_only" ||
    value === "execute"
  ) {
    return value;
  }

  return "disabled";
}

export async function runXmlWorkerSchematronOrchestration(
  input: XmlWorkerSchematronInput
): Promise<XmlWorkerSchematronResult> {
  const mode = normalizeXmlWorkerSchematronMode(input.mode);
  const requested = hasSchematronRequest(input.requestedChecks);

  if (!requested) {
    return buildResult({
      status: "not_requested",
      mode,
      requested: false,
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason: "xml_worker_schematron_not_requested"
    });
  }

  if (mode === "internal_test_only" && !input.allowInternalTestExecution) {
    return buildResult({
      status: "unsupported",
      mode,
      requested: true,
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason: "xml_worker_schematron_internal_execution_not_allowed"
    });
  }

  if (mode === "disabled") {
    return buildResult({
      status: "disabled",
      mode,
      requested: true,
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason: "xml_worker_schematron_orchestration_disabled"
    });
  }

  const safety = inspectXmlSafety(input.xml);

  if (!safety.safe) {
    return buildResult({
      status: "unsafe_input",
      mode,
      requested: true,
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason: safety.code ?? "xml_worker_schematron_unsafe_input"
    });
  }

  try {
    const policy = buildSchematronExecutionPolicy(
      readSchematronExecutionPolicyInputFromEnv()
    );
    const orchestratorMode =
      mode === "execute" && !hasRealSchematronRequest(input.requestedChecks)
        ? "preflight_only"
        : mode;
    const [artifactDiagnostics, engineCandidate] = await Promise.all([
      buildSafeSchematronArtifactDiagnostics(
        readSchematronArtifactConfigFromEnv()
      ),
      inspectSchematronEngineCandidate({
        engineId: policy.engineId
      })
    ]);
    const orchestrator = await runSchematronExecutionOrchestrator({
      xml: input.xml,
      mode: orchestratorMode,
      layers: layerSelectionForRequest(input.requestedChecks),
      policy,
      engineCandidate,
      artifactDiagnostics,
      artifactConfig: readSchematronArtifactConfigFromEnv(),
      ...(input.peppolPrototypeRules
        ? { peppolPrototypeRules: input.peppolPrototypeRules }
        : {}),
      ...(input.en16931PrototypeRules
        ? { en16931PrototypeRules: input.en16931PrototypeRules }
        : {}),
      ...(input.peppolSvrlResults
        ? { peppolSvrlResults: input.peppolSvrlResults }
        : {}),
      ...(input.en16931SvrlResults
        ? { en16931SvrlResults: input.en16931SvrlResults }
        : {})
    });

    return buildResult({
      status: mapOrchestratorStatus(orchestrator.status),
      mode,
      requested: true,
      validationExecutionEnabled: orchestrator.validationExecutionEnabled,
      validationExecuted: orchestrator.validationExecuted,
      markedValid: orchestrator.markedValid,
      reason: orchestrator.reason,
      findings: orchestrator.findings,
      orchestrator: orchestrator.safeSummary
    });
  } catch {
    return buildResult({
      status: "failed",
      mode,
      requested: true,
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason: "xml_worker_schematron_orchestration_failed"
    });
  }
}
