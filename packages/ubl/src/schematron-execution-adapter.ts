import {
  buildSchematronArtifactNotConfiguredFinding,
  buildSchematronArtifactUnreadableFinding,
  buildSchematronExecutionDisabledFinding,
  buildSchematronFutureRuleFinding,
  normalizeSchematronLayer,
  type SchematronContractFinding,
  type SchematronLayer
} from "./schematron-finding-contract.js";
import type { SchematronSafeArtifactDiagnostics } from "./xsd-artifact-registry.js";

export const SCHEMATRON_EXECUTION_ADAPTER_VERSION =
  "schematron_adapter_preflight_v1";

export type SchematronExecutionMode =
  | "disabled"
  | "preflight_only"
  | "enabled";

export type SchematronExecutionLayer = SchematronLayer;

export type SchematronPreflightStatus =
  | "disabled"
  | "not_configured"
  | "artifact_unreadable"
  | "ready_for_future_execution"
  | "unsupported"
  | "error";

export type SchematronExecutionAdapterInput = {
  xml: string;
  requestedLayer?: SchematronLayer;
  artifactDiagnostics: SchematronSafeArtifactDiagnostics;
  mode?: SchematronExecutionMode;
};

export type SchematronExecutionPreflightSummary = {
  diagnosticKind: "schematron_execution_preflight";
  adapterVersion: string;
  mode: SchematronExecutionMode;
  status: SchematronPreflightStatus;
  selectedLayer: SchematronLayer;
  validationExecutionEnabled: boolean;
  validationExecuted: false;
  markedValid: false;
  configured: boolean;
  usable: boolean;
  readyArtifactCount: number;
  requiredArtifactCount: number;
  reason: string;
};

export type SchematronExecutionPreflightResult = {
  adapterVersion: typeof SCHEMATRON_EXECUTION_ADAPTER_VERSION;
  mode: SchematronExecutionMode;
  status: SchematronPreflightStatus;
  validationExecutionEnabled: boolean;
  validationExecuted: false;
  markedValid: false;
  selectedLayer: SchematronLayer;
  configured: boolean;
  usable: boolean;
  readyArtifactCount: number;
  requiredArtifactCount: number;
  reason: string;
  findings: SchematronContractFinding[];
  safeSummary: SchematronExecutionPreflightSummary;
};

function normalizeExecutionMode(
  mode: SchematronExecutionMode | undefined
): SchematronExecutionMode {
  return mode ?? "disabled";
}

function buildEnabledUnsupportedFinding(input: {
  selectedLayer: SchematronLayer;
}): SchematronContractFinding {
  return buildSchematronFutureRuleFinding({
    layer: input.selectedLayer,
    code: "SCHEMATRON_EXECUTION_ERROR",
    severity: "warning",
    status: "error",
    field: "xml.schematron",
    message:
      "Schematron execution was requested, but no execution engine is implemented. No Schematron validation ran.",
    fixSuggestion:
      "Keep Schematron execution disabled until a reviewed execution worker is implemented and explicitly enabled.",
    sourceLabels: [
      "Schematron execution adapter",
      "SCHEMATRON_EXECUTION_ERROR"
    ],
    technicalCode: "SCHEMATRON_EXECUTION_ERROR",
    technicalMessage: "schematron_execution_engine_not_implemented"
  });
}

function buildResult(input: {
  mode: SchematronExecutionMode;
  status: SchematronPreflightStatus;
  selectedLayer: SchematronLayer;
  diagnostics: SchematronSafeArtifactDiagnostics;
  reason: string;
  findings: SchematronContractFinding[];
}): SchematronExecutionPreflightResult {
  const base = {
    adapterVersion: SCHEMATRON_EXECUTION_ADAPTER_VERSION,
    mode: input.mode,
    status: input.status,
    selectedLayer: input.selectedLayer,
    validationExecutionEnabled: false,
    validationExecuted: false,
    markedValid: false,
    configured: input.diagnostics.configured,
    usable: input.diagnostics.usable,
    readyArtifactCount: input.diagnostics.readyArtifactCount,
    requiredArtifactCount: input.diagnostics.requiredArtifactCount,
    reason: input.reason
  } satisfies Omit<SchematronExecutionPreflightResult, "findings" | "safeSummary">;

  return {
    ...base,
    findings: input.findings,
    safeSummary: {
      diagnosticKind: "schematron_execution_preflight",
      ...base
    }
  };
}

export function buildSchematronExecutionPreflight(
  input: SchematronExecutionAdapterInput
): SchematronExecutionPreflightResult {
  const mode = normalizeExecutionMode(input.mode);
  const selectedLayer = normalizeSchematronLayer(input.requestedLayer);
  const diagnostics = input.artifactDiagnostics;

  if (mode === "disabled") {
    return buildResult({
      mode,
      status: "disabled",
      selectedLayer,
      diagnostics,
      reason: "schematron_execution_disabled",
      findings: [
        buildSchematronExecutionDisabledFinding({
          configured: diagnostics.configured,
          usable: diagnostics.usable
        })
      ]
    });
  }

  if (mode === "enabled") {
    return buildResult({
      mode,
      status: "unsupported",
      selectedLayer,
      diagnostics,
      reason: "schematron_execution_engine_not_implemented",
      findings: [buildEnabledUnsupportedFinding({ selectedLayer })]
    });
  }

  if (!diagnostics.configured) {
    return buildResult({
      mode,
      status: "not_configured",
      selectedLayer,
      diagnostics,
      reason: "schematron_artifacts_not_configured",
      findings: [
        buildSchematronArtifactNotConfiguredFinding({
          layer: selectedLayer
        })
      ]
    });
  }

  if (!diagnostics.usable) {
    return buildResult({
      mode,
      status: "artifact_unreadable",
      selectedLayer,
      diagnostics,
      reason: "schematron_artifacts_not_usable",
      findings: [
        buildSchematronArtifactUnreadableFinding({
          layer: selectedLayer,
          reason: "schematron_artifacts_not_usable"
        })
      ]
    });
  }

  return buildResult({
    mode,
    status: "ready_for_future_execution",
    selectedLayer,
    diagnostics,
    reason: "schematron_artifacts_ready_but_execution_not_enabled",
    findings: [
      buildSchematronExecutionDisabledFinding({
        configured: diagnostics.configured,
        usable: diagnostics.usable
      })
    ]
  });
}
