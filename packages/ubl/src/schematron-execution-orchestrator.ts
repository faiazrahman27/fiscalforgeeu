import {
  buildSchematronExecutionDisabledFinding,
  buildSchematronFutureRuleFinding,
  sanitizeSchematronText,
  type SchematronContractFinding,
  type SchematronLayer
} from "./schematron-finding-contract.js";
import {
  runEn16931ExecutionPath,
  type En16931ExecutionResult
} from "./schematron-en16931-execution.js";
import type { SchematronEngineCandidateInfo } from "./schematron-engine-candidate.js";
import type { SchematronExecutionPolicy } from "./schematron-execution-policy.js";
import type { SchematronLocalPrototypeRule } from "./schematron-local-execution-prototype.js";
import {
  runPeppolBisBillingExecutionPath,
  type PeppolBisExecutionResult
} from "./schematron-peppol-bis-execution.js";
import type { SchematronSvrlInputResult } from "./schematron-result-mapper.js";
import type { SchematronSafeArtifactDiagnostics } from "./xsd-artifact-registry.js";

export const SCHEMATRON_EXECUTION_ORCHESTRATOR_VERSION =
  "schematron_execution_orchestrator_v1";

export type SchematronExecutionOrchestratorMode =
  | "disabled"
  | "preflight_only"
  | "internal_test_only";

export type SchematronExecutionOrchestratorStatus =
  | "disabled"
  | "blocked_by_policy"
  | "not_configured"
  | "artifact_unreadable"
  | "engine_unavailable"
  | "ready_for_future_execution"
  | "executed"
  | "failed"
  | "partial"
  | "unsafe_input"
  | "unsupported";

export type SchematronExecutionLayerSelection =
  | "peppol_bis_billing"
  | "en16931_tc434"
  | "both";

export type SchematronExecutionOrchestratorInput = {
  xml: string;
  mode?: SchematronExecutionOrchestratorMode;
  layers?: SchematronExecutionLayerSelection;
  policy?: SchematronExecutionPolicy;
  engineCandidate?: SchematronEngineCandidateInfo;
  artifactDiagnostics?: SchematronSafeArtifactDiagnostics;
  peppolPrototypeRules?: SchematronLocalPrototypeRule[];
  en16931PrototypeRules?: SchematronLocalPrototypeRule[];
  peppolSvrlResults?: SchematronSvrlInputResult[];
  en16931SvrlResults?: SchematronSvrlInputResult[];
  maxXmlBytes?: number;
  maxRules?: number;
};

export type SchematronLayerExecutionSummary = {
  layer: "peppol_bis_billing" | "en16931_tc434";
  status: string;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: false;
  findingCount: number;
  fatalCount: number;
  warningCount: number;
  infoCount: number;
  reason: string;
};

export type SchematronExecutionOrchestratorSummary = {
  diagnosticKind: "schematron_execution_orchestrator";
  orchestratorVersion: typeof SCHEMATRON_EXECUTION_ORCHESTRATOR_VERSION;
  mode: SchematronExecutionOrchestratorMode;
  status: SchematronExecutionOrchestratorStatus;
  selectedLayers: Array<"peppol_bis_billing" | "en16931_tc434">;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: false;
  findingCount: number;
  fatalCount: number;
  warningCount: number;
  infoCount: number;
  layerSummaries: SchematronLayerExecutionSummary[];
  reason: string;
};

export type SchematronExecutionOrchestratorResult = {
  orchestratorVersion: typeof SCHEMATRON_EXECUTION_ORCHESTRATOR_VERSION;
  mode: SchematronExecutionOrchestratorMode;
  status: SchematronExecutionOrchestratorStatus;
  selectedLayers: Array<"peppol_bis_billing" | "en16931_tc434">;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  markedValid: false;
  reason: string;
  findings: SchematronContractFinding[];
  layerSummaries: SchematronLayerExecutionSummary[];
  safeSummary: SchematronExecutionOrchestratorSummary;
};

type SelectedLayer = "peppol_bis_billing" | "en16931_tc434";
type LayerExecutionResult = PeppolBisExecutionResult | En16931ExecutionResult;

const FORBIDDEN_ASSURANCE_CLAIM_PATTERN =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/gi;

function sanitizeOrchestratorText(value: unknown, maxLength = 700) {
  return sanitizeSchematronText(value, maxLength)
    .replace(FORBIDDEN_ASSURANCE_CLAIM_PATTERN, "[assurance-claim]")
    .replace(/\s+/g, " ")
    .trim();
}

function optionalSanitizedText(value: unknown, maxLength?: number) {
  const sanitized = sanitizeOrchestratorText(value, maxLength);

  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeSourceLabels(value: string[] | undefined) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const labels = value
    .map((label) => sanitizeOrchestratorText(label, 120))
    .filter((label) => label.length > 0);

  return labels.length > 0 ? [...new Set(labels)] : undefined;
}

function sanitizeFinding(
  finding: SchematronContractFinding
): SchematronContractFinding {
  const sanitized: SchematronContractFinding = {
    code: finding.code,
    severity: finding.severity,
    checkType: finding.checkType,
    field: sanitizeOrchestratorText(finding.field, 160) || "xml",
    message:
      sanitizeOrchestratorText(finding.message, 700) ||
      "A Schematron orchestration finding was mapped safely.",
    status: finding.status,
    legalConfidence: finding.legalConfidence
  };
  const sourceLabels = sanitizeSourceLabels(finding.sourceLabels);
  const fixSuggestion = optionalSanitizedText(finding.fixSuggestion, 700);
  const ruleId = optionalSanitizedText(finding.ruleId, 120);
  const businessRuleId = optionalSanitizedText(finding.businessRuleId, 120);
  const ruleLocation = optionalSanitizedText(finding.ruleLocation, 300);
  const testExpression = optionalSanitizedText(finding.testExpression, 500);
  const assertionText = optionalSanitizedText(finding.assertionText, 500);
  const diagnosticReference = optionalSanitizedText(
    finding.diagnosticReference,
    240
  );
  const technicalMessage = optionalSanitizedText(finding.technicalMessage, 700);
  const technicalCode = optionalSanitizedText(finding.technicalCode, 160);

  if (finding.schematronLayer) {
    sanitized.schematronLayer = finding.schematronLayer;
  }

  if (fixSuggestion) {
    sanitized.fixSuggestion = fixSuggestion;
  }

  if (sourceLabels) {
    sanitized.sourceLabels = sourceLabels;
  }

  if (ruleId) {
    sanitized.ruleId = ruleId;
  }

  if (businessRuleId) {
    sanitized.businessRuleId = businessRuleId;
  }

  if (ruleLocation) {
    sanitized.ruleLocation = ruleLocation;
  }

  if (testExpression) {
    sanitized.testExpression = testExpression;
  }

  if (assertionText) {
    sanitized.assertionText = assertionText;
  }

  if (diagnosticReference) {
    sanitized.diagnosticReference = diagnosticReference;
  }

  if (technicalMessage) {
    sanitized.technicalMessage = technicalMessage;
  }

  if (technicalCode) {
    sanitized.technicalCode = technicalCode;
  }

  if (finding.xmlLine !== undefined) {
    sanitized.xmlLine = finding.xmlLine;
  }

  return sanitized;
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

function getSelectedLayers(
  selection: SchematronExecutionLayerSelection
): SelectedLayer[] {
  if (selection === "peppol_bis_billing") {
    return ["peppol_bis_billing"];
  }

  if (selection === "en16931_tc434") {
    return ["en16931_tc434"];
  }

  return ["peppol_bis_billing", "en16931_tc434"];
}

function layerExecutionDisabledFinding(layer: SelectedLayer) {
  const finding = buildSchematronExecutionDisabledFinding();

  return sanitizeFinding({
    ...finding,
    schematronLayer: layer,
    sourceLabels: [
      ...(finding.sourceLabels ?? []),
      SCHEMATRON_EXECUTION_ORCHESTRATOR_VERSION,
      layer
    ]
  });
}

function layerExecutionErrorFinding(input: {
  layer: SelectedLayer;
  reason: string;
}) {
  return sanitizeFinding(
    buildSchematronFutureRuleFinding({
      layer: input.layer,
      code: "SCHEMATRON_EXECUTION_ERROR",
      severity: "warning",
      status: "error",
      field: "xml.schematron",
      message:
        "The guarded Schematron execution orchestrator could not safely run the requested layer.",
      sourceLabels: [
        "Schematron execution orchestrator",
        SCHEMATRON_EXECUTION_ORCHESTRATOR_VERSION,
        "SCHEMATRON_EXECUTION_ERROR"
      ],
      technicalCode: "SCHEMATRON_EXECUTION_ERROR",
      technicalMessage: input.reason
    })
  );
}

function layerSummary(input: {
  layer: SelectedLayer;
  status: string;
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  reason: string;
  findings: readonly SchematronContractFinding[];
}): SchematronLayerExecutionSummary {
  const counts = countFindings(input.findings);

  return {
    layer: input.layer,
    status: sanitizeOrchestratorText(input.status, 80) || "failed",
    validationExecutionEnabled: input.validationExecutionEnabled,
    validationExecuted: input.validationExecuted,
    markedValid: false,
    ...counts,
    reason: sanitizeOrchestratorText(input.reason, 160) || "schematron_failed"
  };
}

function buildResult(input: {
  mode: SchematronExecutionOrchestratorMode;
  status: SchematronExecutionOrchestratorStatus;
  selectedLayers: SelectedLayer[];
  validationExecutionEnabled: boolean;
  validationExecuted: boolean;
  reason: string;
  findings: SchematronContractFinding[];
  layerSummaries: SchematronLayerExecutionSummary[];
}): SchematronExecutionOrchestratorResult {
  const counts = countFindings(input.findings);
  const reason =
    sanitizeOrchestratorText(input.reason, 160) ||
    "schematron_execution_orchestrator_failed";
  const base = {
    orchestratorVersion: SCHEMATRON_EXECUTION_ORCHESTRATOR_VERSION,
    mode: input.mode,
    status: input.status,
    selectedLayers: input.selectedLayers,
    validationExecutionEnabled: input.validationExecutionEnabled,
    validationExecuted: input.validationExecuted,
    markedValid: false,
    reason,
    ...counts,
    layerSummaries: input.layerSummaries
  } satisfies Omit<SchematronExecutionOrchestratorSummary, "diagnosticKind">;

  return {
    orchestratorVersion: base.orchestratorVersion,
    mode: base.mode,
    status: base.status,
    selectedLayers: base.selectedLayers,
    validationExecutionEnabled: base.validationExecutionEnabled,
    validationExecuted: base.validationExecuted,
    markedValid: false,
    reason: base.reason,
    findings: input.findings,
    layerSummaries: base.layerSummaries,
    safeSummary: {
      diagnosticKind: "schematron_execution_orchestrator",
      ...base
    }
  };
}

function runLayer(input: {
  layer: SelectedLayer;
  mode: SchematronExecutionOrchestratorMode;
  orchestratorInput: SchematronExecutionOrchestratorInput;
}): Promise<LayerExecutionResult> {
  const shared = {
    xml: input.orchestratorInput.xml,
    mode: input.mode,
    ...(input.orchestratorInput.policy
      ? { policy: input.orchestratorInput.policy }
      : {}),
    ...(input.orchestratorInput.engineCandidate
      ? { engineCandidate: input.orchestratorInput.engineCandidate }
      : {}),
    ...(input.orchestratorInput.artifactDiagnostics
      ? { artifactDiagnostics: input.orchestratorInput.artifactDiagnostics }
      : {}),
    ...(input.orchestratorInput.maxXmlBytes !== undefined
      ? { maxXmlBytes: input.orchestratorInput.maxXmlBytes }
      : {}),
    ...(input.orchestratorInput.maxRules !== undefined
      ? { maxRules: input.orchestratorInput.maxRules }
      : {})
  };

  if (input.layer === "peppol_bis_billing") {
    return runPeppolBisBillingExecutionPath({
      ...shared,
      ...(Array.isArray(input.orchestratorInput.peppolPrototypeRules)
        ? { prototypeRules: input.orchestratorInput.peppolPrototypeRules }
        : {}),
      ...(Array.isArray(input.orchestratorInput.peppolSvrlResults)
        ? { svrlResults: input.orchestratorInput.peppolSvrlResults }
        : {})
    });
  }

  return runEn16931ExecutionPath({
    ...shared,
    ...(Array.isArray(input.orchestratorInput.en16931PrototypeRules)
      ? { prototypeRules: input.orchestratorInput.en16931PrototypeRules }
      : {}),
    ...(Array.isArray(input.orchestratorInput.en16931SvrlResults)
      ? { svrlResults: input.orchestratorInput.en16931SvrlResults }
      : {})
  });
}

async function collectLayerResults(input: {
  selectedLayers: SelectedLayer[];
  mode: SchematronExecutionOrchestratorMode;
  orchestratorInput: SchematronExecutionOrchestratorInput;
}) {
  return Promise.all(
    input.selectedLayers.map(async (layer) => {
      try {
        const result = await runLayer({
          layer,
          mode: input.mode,
          orchestratorInput: input.orchestratorInput
        });
        const findings = result.findings.map((finding) =>
          sanitizeFinding(finding)
        );

        return {
          layer,
          status: result.status,
          validationExecutionEnabled: result.validationExecutionEnabled,
          validationExecuted: result.validationExecuted,
          reason: result.reason,
          findings,
          summary: layerSummary({
            layer,
            status: result.status,
            validationExecutionEnabled: result.validationExecutionEnabled,
            validationExecuted: result.validationExecuted,
            reason: result.reason,
            findings
          })
        };
      } catch {
        const reason = "schematron_execution_orchestrator_layer_failed";
        const findings = [
          layerExecutionErrorFinding({
            layer,
            reason
          })
        ];

        return {
          layer,
          status: "failed",
          validationExecutionEnabled: false,
          validationExecuted: false,
          reason,
          findings,
          summary: layerSummary({
            layer,
            status: "failed",
            validationExecutionEnabled: false,
            validationExecuted: false,
            reason,
            findings
          })
        };
      }
    })
  );
}

function aggregatePreflightStatus(
  summaries: readonly SchematronLayerExecutionSummary[]
): SchematronExecutionOrchestratorStatus {
  const statuses = summaries.map((summary) => summary.status);

  if (statuses.every((status) => status === "disabled")) {
    return "disabled";
  }

  if (statuses.every((status) => status === "blocked_by_policy")) {
    return "blocked_by_policy";
  }

  if (statuses.every((status) => status === "not_configured")) {
    return "not_configured";
  }

  if (statuses.some((status) => status === "artifact_unreadable")) {
    return "artifact_unreadable";
  }

  if (statuses.some((status) => status === "engine_unavailable")) {
    return "engine_unavailable";
  }

  if (statuses.every((status) => status === "ready_for_future_execution")) {
    return "ready_for_future_execution";
  }

  if (statuses.every((status) => status === "unsupported")) {
    return "unsupported";
  }

  return "partial";
}

function aggregateInternalStatus(input: {
  summaries: readonly SchematronLayerExecutionSummary[];
  fatalCount: number;
}): SchematronExecutionOrchestratorStatus {
  const statuses = input.summaries.map((summary) => summary.status);

  if (statuses.some((status) => status === "unsafe_input")) {
    return "unsafe_input";
  }

  if (
    statuses.every((status) => status === "executed") &&
    input.fatalCount === 0
  ) {
    return "executed";
  }

  if (
    input.fatalCount > 0 ||
    statuses.some((status) => status === "failed")
  ) {
    return "failed";
  }

  if (statuses.every((status) => status === "unsupported")) {
    return "unsupported";
  }

  return "partial";
}

function reasonForStatus(input: {
  mode: SchematronExecutionOrchestratorMode;
  status: SchematronExecutionOrchestratorStatus;
}) {
  if (input.mode === "preflight_only") {
    return `schematron_execution_orchestrator_preflight_${input.status}`;
  }

  if (input.mode === "internal_test_only") {
    return `schematron_execution_orchestrator_internal_test_${input.status}`;
  }

  return "schematron_execution_orchestrator_disabled";
}

export function normalizeSchematronExecutionOrchestratorMode(
  value: unknown
): SchematronExecutionOrchestratorMode {
  if (value === "preflight_only" || value === "internal_test_only") {
    return value;
  }

  return "disabled";
}

export function normalizeSchematronExecutionLayerSelection(
  value: unknown
): SchematronExecutionLayerSelection {
  if (
    value === "peppol_bis_billing" ||
    value === "en16931_tc434" ||
    value === "both"
  ) {
    return value;
  }

  return "both";
}

export async function runSchematronExecutionOrchestrator(
  input: SchematronExecutionOrchestratorInput
): Promise<SchematronExecutionOrchestratorResult> {
  const mode = normalizeSchematronExecutionOrchestratorMode(input.mode);
  const selectedLayers = getSelectedLayers(
    normalizeSchematronExecutionLayerSelection(input.layers)
  );

  if (mode === "disabled") {
    const findings = selectedLayers.map((layer) =>
      layerExecutionDisabledFinding(layer)
    );
    const layerSummaries = selectedLayers.map((layer) =>
      layerSummary({
        layer,
        status: "disabled",
        validationExecutionEnabled: false,
        validationExecuted: false,
        reason: "schematron_execution_orchestrator_disabled",
        findings: findings.filter(
          (finding) => finding.schematronLayer === (layer as SchematronLayer)
        )
      })
    );

    return buildResult({
      mode,
      status: "disabled",
      selectedLayers,
      validationExecutionEnabled: false,
      validationExecuted: false,
      reason: "schematron_execution_orchestrator_disabled",
      findings,
      layerSummaries
    });
  }

  const layerResults = await collectLayerResults({
    selectedLayers,
    mode,
    orchestratorInput: input
  });
  const findings = layerResults.flatMap((result) => result.findings);
  const layerSummaries = layerResults.map((result) => result.summary);
  const counts = countFindings(findings);
  const status =
    mode === "preflight_only"
      ? aggregatePreflightStatus(layerSummaries)
      : aggregateInternalStatus({
          summaries: layerSummaries,
          fatalCount: counts.fatalCount
        });
  const validationExecutionEnabled =
    mode === "internal_test_only" &&
    layerSummaries.some((summary) => summary.validationExecutionEnabled);
  const validationExecuted =
    mode === "internal_test_only" &&
    layerSummaries.length > 0 &&
    layerSummaries.every((summary) => summary.validationExecuted);

  return buildResult({
    mode,
    status,
    selectedLayers,
    validationExecutionEnabled,
    validationExecuted,
    reason: reasonForStatus({ mode, status }),
    findings,
    layerSummaries
  });
}
