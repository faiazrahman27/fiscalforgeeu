import { sanitizeSchematronText } from "./schematron-finding-contract.js";

export const SCHEMATRON_EXECUTION_POLICY_VERSION = "schematron_policy_v1";

export type SchematronExecutionPolicyMode =
  | "disabled"
  | "preflight_only"
  | "blocked_requested_execution";

export type SchematronEngineId =
  | "none"
  | "placeholder"
  | "future_xslt2"
  | "future_schxslt"
  | "xpath_engine"
  | "internal_test_candidate"
  | "unknown";

export type SchematronExecutionPolicyInput = {
  requestedMode?: string;
  requestedEngine?: string;
  allowExperimentalExecution?: boolean;
};

export type SchematronExecutionPolicy = {
  policyVersion: typeof SCHEMATRON_EXECUTION_POLICY_VERSION;
  mode: SchematronExecutionPolicyMode;
  engineId: SchematronEngineId;
  executionPermitted: false;
  validationExecutionEnabled: false;
  reason: string;
  requestedMode: string | null;
  requestedEngine: string | null;
  allowExperimentalExecution: boolean;
  safeSummary: {
    diagnosticKind: "schematron_execution_policy";
    policyVersion: string;
    mode: SchematronExecutionPolicyMode;
    engineId: SchematronEngineId;
    executionPermitted: false;
    validationExecutionEnabled: false;
    reason: string;
    requestedMode: string | null;
    requestedEngine: string | null;
    allowExperimentalExecution: boolean;
  };
};

const EXECUTION_LIKE_MODE_VALUES = new Set([
  "enable",
  "enabled",
  "execute",
  "execution",
  "real",
  "run",
  "production",
  "prod",
  "validate",
  "validation",
  "true",
  "1",
  "yes",
  "on"
]);

const SAFE_MODE_ECHO_VALUES = new Set([
  "disabled",
  "preflight_only",
  ...EXECUTION_LIKE_MODE_VALUES
]);

const SAFE_ENGINE_ECHO_VALUES = new Set([
  "none",
  "placeholder",
  "xslt2",
  "saxon",
  "future_xslt2",
  "schxslt",
  "future_schxslt",
  "xpath",
  "xpath_engine",
  "fontoxpath",
  "internal_test_candidate"
]);

function normalizedToken(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeEchoValue(value: unknown, allowedValues: Set<string>) {
  const token = normalizedToken(value);

  if (!token) {
    return null;
  }

  const sanitized = sanitizeSchematronText(token, 80);

  return allowedValues.has(sanitized) ? sanitized : "unknown";
}

export function normalizeSchematronExecutionPolicyMode(
  value: unknown
): SchematronExecutionPolicyMode {
  const token = normalizedToken(value);

  if (!token) {
    return "preflight_only";
  }

  if (token === "disabled") {
    return "disabled";
  }

  if (token === "preflight_only") {
    return "preflight_only";
  }

  if (EXECUTION_LIKE_MODE_VALUES.has(token)) {
    return "blocked_requested_execution";
  }

  return "preflight_only";
}

export function normalizeSchematronEngineId(
  value: unknown
): SchematronEngineId {
  const token = normalizedToken(value);

  if (!token) {
    return "placeholder";
  }

  if (token === "none") {
    return "none";
  }

  if (token === "placeholder") {
    return "placeholder";
  }

  if (token === "xslt2" || token === "saxon" || token === "future_xslt2") {
    return "future_xslt2";
  }

  if (token === "schxslt" || token === "future_schxslt") {
    return "future_schxslt";
  }

  if (token === "xpath" || token === "xpath_engine" || token === "fontoxpath") {
    return "xpath_engine";
  }

  if (token === "internal_test_candidate") {
    return "internal_test_candidate";
  }

  return "unknown";
}

function getPolicyReason(input: {
  mode: SchematronExecutionPolicyMode;
  allowExperimentalExecution: boolean;
}) {
  if (input.allowExperimentalExecution) {
    return "schematron_experimental_execution_not_available";
  }

  if (input.mode === "disabled") {
    return "schematron_execution_disabled_by_policy";
  }

  if (input.mode === "blocked_requested_execution") {
    return "schematron_execution_requested_but_blocked";
  }

  return "schematron_execution_preflight_only";
}

export function buildSchematronExecutionPolicy(
  input: SchematronExecutionPolicyInput = {}
): SchematronExecutionPolicy {
  const mode = normalizeSchematronExecutionPolicyMode(input.requestedMode);
  const engineId = normalizeSchematronEngineId(input.requestedEngine);
  const allowExperimentalExecution =
    input.allowExperimentalExecution === true;
  const base = {
    policyVersion: SCHEMATRON_EXECUTION_POLICY_VERSION,
    mode,
    engineId,
    executionPermitted: false,
    validationExecutionEnabled: false,
    reason: getPolicyReason({
      mode,
      allowExperimentalExecution
    }),
    requestedMode: safeEchoValue(input.requestedMode, SAFE_MODE_ECHO_VALUES),
    requestedEngine: safeEchoValue(
      input.requestedEngine,
      SAFE_ENGINE_ECHO_VALUES
    ),
    allowExperimentalExecution
  } satisfies Omit<SchematronExecutionPolicy, "safeSummary">;

  return {
    ...base,
    safeSummary: {
      diagnosticKind: "schematron_execution_policy",
      ...base
    }
  };
}
