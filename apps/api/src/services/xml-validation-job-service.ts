import { createHash } from "node:crypto";
import {
  SCHEMATRON_EXECUTION_ADAPTER_VERSION,
  SCHEMATRON_FINDING_CONTRACT_VERSION,
  SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES,
  buildSchematronExecutionPolicy,
  buildSchematronExecutionPreflight,
  buildSchematronExecutionDisabledFinding,
  buildSafeSchematronArtifactDiagnostics,
  inspectSchematronEngineCandidate,
  runSchematronExecutionOrchestrator,
  validateUblXsd,
  type SchematronExecutionMode,
  type SchematronEngineCandidateInfo,
  type SchematronExecutionPolicy,
  type SchematronExecutionPolicyInput,
  type SchematronExecutionPreflightResult,
  type SchematronLayer,
  type SchematronArtifactConfigInput,
  type SchematronCheckType,
  type SchematronContractFinding,
  type SchematronExecutionOrchestratorResult,
  type SchematronExecutionOrchestratorStatus,
  type SchematronSafeArtifactDiagnostics,
  type UblXsdArtifactConfigInput,
  type UblXsdArtifactInfo,
  type UblXsdValidationFinding,
  type XmlSafetyInspection
} from "@invoice-lantern/ubl";
import { env } from "../config/env.js";

export const XML_VALIDATION_JOB_DISCLAIMER =
  "This XML validation job is a technical sandbox worker-readiness and configured-check result. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance.";

export const XML_VALIDATION_JOB_WORKER_NAME = "invoice-lantern-xml-worker";
export const XML_VALIDATION_JOB_WORKER_VERSION = "0.2.0";

export const XML_VALIDATION_JOB_QUEUE_VERSION = "2026.05.1";
export const XML_VALIDATION_JOB_QUEUE_LEASE_SECONDS = 120;
export const XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS = 300;
export const XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS = 3;

export const XML_VALIDATION_JOB_CHECKS = [
  "worker_readiness",
  "xsd_ubl",
  "schematron_peppol",
  "schematron_en16931",
  "schematron_peppol_placeholder"
] as const;

export type XmlValidationJobCheck = (typeof XML_VALIDATION_JOB_CHECKS)[number];

export type XmlValidationJobCheckStatus =
  | "passed"
  | "failed"
  | "warning"
  | "completed"
  | "not_configured"
  | "not_implemented"
  | "unsupported"
  | "unsafe_input"
  | "artifact_unreadable"
  | "engine_unavailable"
  | "disabled"
  | "preflight_only"
  | "error";

export type XmlValidationJobQueueMode = "inline" | "async_worker";

export type XmlValidationJobQueueLifecycleStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type XmlValidationJobFinding = {
  code: string;
  severity: "info" | "warning" | "fatal";
  checkType: XmlValidationJobCheck;
  field: string;
  message: string;
  status: XmlValidationJobCheckStatus;
  legalConfidence: "technical" | "educational_simulation";
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

export type XmlValidationJobCheckResult = {
  checkType: XmlValidationJobCheck;
  status: XmlValidationJobCheckStatus;
  artifactInfo?: UblXsdArtifactInfo;
  findings: XmlValidationJobFinding[];
  summary?: Record<string, unknown>;
};

export type XmlValidationJobQueueLifecycle = {
  queueVersion: string;
  mode: XmlValidationJobQueueMode;
  status: XmlValidationJobQueueLifecycleStatus;
  attempt: number;
  maxAttempts: number;
  leaseSeconds: number;
  timeoutSeconds: number;
  retryable: boolean;
  queuedAt: string;
  nextAttemptAt?: string;
  claimedBy?: string;
  claimedAt?: string;
  leaseExpiresAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  failureCode?: string;
  failureMessage?: string;
};

export type XmlValidationJobCompletion = {
  completedChecks: XmlValidationJobCheck[];
  failedChecks: XmlValidationJobCheck[];
  workerName: string;
  workerVersion: string;
  resultSummary: Record<string, unknown>;
  findings: XmlValidationJobFinding[];
  disclaimer: string;
};

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function toIsoDateTime(value: Date | string | undefined) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return new Date().toISOString();
}

function addSecondsToIsoDateTime(value: string, seconds: number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  date.setSeconds(date.getSeconds() + seconds);

  return date.toISOString();
}

export function buildQueuedXmlValidationJobLifecycle(
  input: {
    now?: Date | string;
    attempt?: number;
    maxAttempts?: number;
    leaseSeconds?: number;
    timeoutSeconds?: number;
  } = {}
): XmlValidationJobQueueLifecycle {
  const queuedAt = toIsoDateTime(input.now);
  const leaseSeconds = normalizePositiveInteger(
    input.leaseSeconds,
    XML_VALIDATION_JOB_QUEUE_LEASE_SECONDS
  );
  const timeoutSeconds = normalizePositiveInteger(
    input.timeoutSeconds,
    XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS
  );
  const maxAttempts = normalizePositiveInteger(
    input.maxAttempts,
    XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS
  );
  const attempt = normalizePositiveInteger(input.attempt, 1);

  return {
    queueVersion: XML_VALIDATION_JOB_QUEUE_VERSION,
    mode: "async_worker",
    status: "queued",
    attempt,
    maxAttempts,
    leaseSeconds,
    timeoutSeconds,
    retryable: attempt < maxAttempts,
    queuedAt,
    nextAttemptAt: queuedAt
  };
}

export function buildRunningXmlValidationJobLifecycle(input: {
  queuedAt?: Date | string;
  now?: Date | string;
  attempt?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
  timeoutSeconds?: number;
  claimedBy?: string;
}): XmlValidationJobQueueLifecycle {
  const startedAt = toIsoDateTime(input.now);
  const queuedAt = toIsoDateTime(input.queuedAt ?? startedAt);
  const leaseSeconds = normalizePositiveInteger(
    input.leaseSeconds,
    XML_VALIDATION_JOB_QUEUE_LEASE_SECONDS
  );
  const timeoutSeconds = normalizePositiveInteger(
    input.timeoutSeconds,
    XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS
  );
  const maxAttempts = normalizePositiveInteger(
    input.maxAttempts,
    XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS
  );
  const attempt = normalizePositiveInteger(input.attempt, 1);

  return {
    queueVersion: XML_VALIDATION_JOB_QUEUE_VERSION,
    mode: "async_worker",
    status: "running",
    attempt,
    maxAttempts,
    leaseSeconds,
    timeoutSeconds,
    retryable: attempt < maxAttempts,
    queuedAt,
    claimedAt: startedAt,
    leaseExpiresAt: addSecondsToIsoDateTime(startedAt, leaseSeconds),
    startedAt,
    ...(input.claimedBy ? { claimedBy: input.claimedBy } : {})
  };
}

export function buildCompletedXmlValidationJobLifecycle(input: {
  mode?: XmlValidationJobQueueMode;
  queuedAt?: Date | string;
  startedAt?: Date | string;
  completedAt?: Date | string;
  attempt?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
  timeoutSeconds?: number;
  claimedBy?: string;
}): XmlValidationJobQueueLifecycle {
  const completedAt = toIsoDateTime(input.completedAt);
  const queuedAt = toIsoDateTime(input.queuedAt ?? completedAt);
  const startedAt = toIsoDateTime(input.startedAt ?? completedAt);
  const leaseSeconds = normalizePositiveInteger(
    input.leaseSeconds,
    XML_VALIDATION_JOB_QUEUE_LEASE_SECONDS
  );
  const timeoutSeconds = normalizePositiveInteger(
    input.timeoutSeconds,
    XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS
  );
  const maxAttempts = normalizePositiveInteger(
    input.maxAttempts,
    XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS
  );
  const attempt = normalizePositiveInteger(input.attempt, 1);

  return {
    queueVersion: XML_VALIDATION_JOB_QUEUE_VERSION,
    mode: input.mode ?? "async_worker",
    status: "completed",
    attempt,
    maxAttempts,
    leaseSeconds,
    timeoutSeconds,
    retryable: false,
    queuedAt,
    startedAt,
    completedAt,
    ...(input.claimedBy ? { claimedBy: input.claimedBy } : {})
  };
}

export function buildFailedXmlValidationJobLifecycle(input: {
  mode?: XmlValidationJobQueueMode;
  queuedAt?: Date | string;
  startedAt?: Date | string;
  failedAt?: Date | string;
  attempt?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
  timeoutSeconds?: number;
  claimedBy?: string;
  failureCode: string;
  failureMessage: string;
  retryable?: boolean;
}): XmlValidationJobQueueLifecycle {
  const failedAt = toIsoDateTime(input.failedAt);
  const queuedAt = toIsoDateTime(input.queuedAt ?? failedAt);
  const startedAt = toIsoDateTime(input.startedAt ?? failedAt);
  const leaseSeconds = normalizePositiveInteger(
    input.leaseSeconds,
    XML_VALIDATION_JOB_QUEUE_LEASE_SECONDS
  );
  const timeoutSeconds = normalizePositiveInteger(
    input.timeoutSeconds,
    XML_VALIDATION_JOB_QUEUE_TIMEOUT_SECONDS
  );
  const maxAttempts = normalizePositiveInteger(
    input.maxAttempts,
    XML_VALIDATION_JOB_QUEUE_MAX_ATTEMPTS
  );
  const attempt = normalizePositiveInteger(input.attempt, 1);
  const retryable = input.retryable ?? attempt < maxAttempts;

  return {
    queueVersion: XML_VALIDATION_JOB_QUEUE_VERSION,
    mode: input.mode ?? "async_worker",
    status: "failed",
    attempt,
    maxAttempts,
    leaseSeconds,
    timeoutSeconds,
    retryable,
    queuedAt,
    startedAt,
    failedAt,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
    ...(retryable ? { nextAttemptAt: addSecondsToIsoDateTime(failedAt, 60) } : {}),
    ...(input.claimedBy ? { claimedBy: input.claimedBy } : {})
  };
}

export function isXmlValidationJobCheck(
  value: string
): value is XmlValidationJobCheck {
  return XML_VALIDATION_JOB_CHECKS.includes(value as XmlValidationJobCheck);
}

export function normalizeRequestedXmlValidationChecks(
  checks: readonly string[] | undefined
) {
  const normalizedChecks: XmlValidationJobCheck[] = [];
  const requestedChecks =
    checks && checks.length > 0 ? checks : ["worker_readiness"];

  for (const check of requestedChecks) {
    const normalizedCheck = check.trim();

    if (
      isXmlValidationJobCheck(normalizedCheck) &&
      !normalizedChecks.includes(normalizedCheck)
    ) {
      normalizedChecks.push(normalizedCheck);
    }
  }

  return normalizedChecks.length > 0
    ? normalizedChecks
    : (["worker_readiness"] satisfies XmlValidationJobCheck[]);
}

export function calculateXmlSha256(xml: string) {
  return createHash("sha256").update(xml, "utf8").digest("hex");
}

export function getUtf8ByteLength(xml: string) {
  return Buffer.byteLength(xml, "utf8");
}

export function detectXmlRootElement(xml: string) {
  const match = xml.match(/<\s*([A-Za-z_][\w:.-]*)(?:\s|>|\/>)/);
  const rawRoot = match?.[1] ?? "unknown";

  return rawRoot.includes(":") ? rawRoot.split(":").pop() ?? rawRoot : rawRoot;
}

export function detectXmlDocumentType(rootElement: string) {
  const normalized = rootElement.toLowerCase();

  if (normalized.includes("creditnote")) {
    return "credit_note";
  }

  if (normalized.includes("invoice")) {
    return "invoice";
  }

  return "unknown";
}

function buildWorkerReadinessFinding(): XmlValidationJobFinding {
  return {
    code: "XML_VALIDATION_WORKER_READY",
    severity: "info",
    checkType: "worker_readiness",
    field: "xml",
    message:
      "The validation worker foundation accepted this XML for technical sandbox processing.",
    status: "completed",
    legalConfidence: "technical"
  };
}

function buildSchematronPlaceholderFinding(
  diagnostics: SchematronSafeArtifactDiagnostics
): XmlValidationJobFinding {
  const finding = buildSchematronExecutionDisabledFinding({
    configured: diagnostics.configured,
    usable: diagnostics.usable
  });

  return {
    ...finding,
    code: "PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED",
    technicalCode: finding.code,
    sourceLabels: [
      ...(finding.sourceLabels ?? []),
      "Schematron artefact registry diagnostics"
    ]
  };
}

function buildQueueFailureFinding(input: {
  errorCode: string;
  errorMessage: string;
}): XmlValidationJobFinding {
  return {
    code: input.errorCode,
    severity: "warning",
    checkType: "worker_readiness",
    field: "xml",
    message: input.errorMessage,
    status: "error",
    legalConfidence: "technical",
    fixSuggestion:
      "Retry the XML validation job or review the worker queue configuration if this error persists.",
    sourceLabels: ["Invoice Lantern XML validation queue"]
  };
}

function buildWorkerReadinessResult(): XmlValidationJobCheckResult {
  const finding = buildWorkerReadinessFinding();

  return {
    checkType: "worker_readiness",
    status: "completed",
    findings: [finding],
    summary: {
      workerReady: true,
      validationExecuted: true
    }
  };
}

function buildSchematronPlaceholderSummary(
  diagnostics: SchematronSafeArtifactDiagnostics,
  preflight: SchematronExecutionPreflightResult,
  policy: SchematronExecutionPolicy,
  engineCandidate: SchematronEngineCandidateInfo
) {
  return {
    adapterVersion: SCHEMATRON_EXECUTION_ADAPTER_VERSION,
    executionPreflight: preflight.safeSummary,
    executionPolicy: policy.safeSummary,
    engineCandidate: engineCandidate.safeSummary,
    preflightStatus: preflight.status,
    preflightReason: preflight.reason,
    policyVersion: policy.policyVersion,
    policyMode: policy.mode,
    policyReason: policy.reason,
    engineId: policy.engineId,
    engineCandidateVersion: engineCandidate.engineCandidateVersion,
    engineAvailabilityStatus: engineCandidate.availabilityStatus,
    engineExecutionSupported: engineCandidate.executionSupported,
    executionPermitted: false,
    findingContractVersion: SCHEMATRON_FINDING_CONTRACT_VERSION,
    supportedFutureFindingCodes: [...SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES],
    implemented: false,
    validationExecutionEnabled: false,
    validationExecuted: false,
    markedValid: false,
    reason: "schematron_validation_not_implemented",
    configured: diagnostics.configured,
    usable: diagnostics.usable,
    readyArtifactCount: diagnostics.readyArtifactCount,
    requiredArtifactCount: diagnostics.requiredArtifactCount,
    allRequiredArtifactsReadable: diagnostics.allRequiredArtifactsReadable,
    artifactVersion: diagnostics.artifactVersion,
    validatorName: diagnostics.validatorName,
    validatorAvailable: diagnostics.validatorAvailable,
    checkedAt: diagnostics.checkedAt,
    artifactDiagnostics: diagnostics
  };
}

function getAdapterModeForPolicy(
  policy: SchematronExecutionPolicy
): SchematronExecutionMode {
  if (policy.mode === "disabled") {
    return "disabled";
  }

  if (policy.mode === "blocked_requested_execution") {
    return "enabled";
  }

  return "preflight_only";
}

async function buildSchematronPlaceholderResult(input: {
  xml: string;
  artifactConfig?: SchematronArtifactConfigInput;
  schematronExecutionPolicyInput?: SchematronExecutionPolicyInput;
}): Promise<XmlValidationJobCheckResult> {
  const policy = buildSchematronExecutionPolicy({
    ...getDefaultSchematronExecutionPolicyInput(),
    ...(input.schematronExecutionPolicyInput ?? {})
  });
  const diagnostics = await buildSafeSchematronArtifactDiagnostics(
    input.artifactConfig ?? getDefaultSchematronArtifactConfig()
  );
  const preflight = buildSchematronExecutionPreflight({
    xml: input.xml,
    requestedLayer: "peppol_bis_billing",
    artifactDiagnostics: diagnostics,
    mode: getAdapterModeForPolicy(policy)
  });
  const engineCandidate = await inspectSchematronEngineCandidate({
    engineId: policy.engineId
  });
  const finding = buildSchematronPlaceholderFinding(diagnostics);

  return {
    checkType: "schematron_peppol_placeholder",
    status: "not_implemented",
    findings: [finding],
    summary: buildSchematronPlaceholderSummary(
      diagnostics,
      preflight,
      policy,
      engineCandidate
    )
  };
}

function schematronModeForPolicy(policy: SchematronExecutionPolicy) {
  if (policy.mode === "execute" && policy.executionPermitted) {
    return "execute" as const;
  }

  if (policy.mode === "disabled") {
    return "disabled" as const;
  }

  return "preflight_only" as const;
}

function layerForSchematronCheck(
  check: Extract<XmlValidationJobCheck, "schematron_peppol" | "schematron_en16931">
) {
  return check === "schematron_en16931"
    ? "en16931_tc434"
    : "peppol_bis_billing";
}

function checkTypeForSchematronCheck(
  check: Extract<XmlValidationJobCheck, "schematron_peppol" | "schematron_en16931">
): SchematronCheckType {
  return check;
}

function mapSchematronOrchestratorStatus(
  status: SchematronExecutionOrchestratorStatus,
  markedValid: boolean,
  policyMode: SchematronExecutionPolicy["mode"]
): XmlValidationJobCheckStatus {
  if (policyMode === "preflight_only" && status !== "not_configured") {
    return "preflight_only";
  }

  if (status === "executed") {
    return markedValid ? "passed" : "warning";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "not_configured") {
    return "not_configured";
  }

  if (status === "unsupported") {
    return "unsupported";
  }

  if (status === "unsafe_input") {
    return "unsafe_input";
  }

  if (status === "artifact_unreadable") {
    return "artifact_unreadable";
  }

  if (status === "engine_unavailable") {
    return "engine_unavailable";
  }

  if (status === "disabled") {
    return "disabled";
  }

  return "error";
}

function buildSchematronFinding(
  finding: SchematronContractFinding,
  checkType: SchematronCheckType
): XmlValidationJobFinding {
  return {
    ...finding,
    checkType
  };
}

function buildSchematronExecutionSummary(input: {
  checkType: SchematronCheckType;
  diagnostics: SchematronSafeArtifactDiagnostics;
  policy: SchematronExecutionPolicy;
  engineCandidate: SchematronEngineCandidateInfo;
  orchestration: SchematronExecutionOrchestratorResult;
}) {
  return {
    implemented: true,
    checkType: input.checkType,
    executionPolicy: input.policy.safeSummary,
    engineCandidate: input.engineCandidate.safeSummary,
    schematronOrchestration: input.orchestration.safeSummary,
    policyVersion: input.policy.policyVersion,
    policyMode: input.policy.mode,
    policyReason: input.policy.reason,
    engineId: input.policy.engineId,
    engineCandidateVersion: input.engineCandidate.engineCandidateVersion,
    engineAvailabilityStatus: input.engineCandidate.availabilityStatus,
    engineExecutionSupported: input.engineCandidate.executionSupported,
    executionPermitted: input.policy.executionPermitted,
    validationExecutionEnabled: input.orchestration.validationExecutionEnabled,
    validationExecuted: input.orchestration.validationExecuted,
    markedValid: input.orchestration.markedValid,
    status: mapSchematronOrchestratorStatus(
      input.orchestration.status,
      input.orchestration.markedValid,
      input.policy.mode
    ),
    orchestrationStatus: input.orchestration.status,
    orchestrationReason: input.orchestration.reason,
    findingContractVersion: SCHEMATRON_FINDING_CONTRACT_VERSION,
    supportedFutureFindingCodes: [...SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES],
    configured: input.diagnostics.configured,
    usable: input.diagnostics.usable,
    readyArtifactCount: input.diagnostics.readyArtifactCount,
    requiredArtifactCount: input.diagnostics.requiredArtifactCount,
    allRequiredArtifactsReadable: input.diagnostics.allRequiredArtifactsReadable,
    artifactVersion: input.diagnostics.artifactVersion,
    validatorName: input.diagnostics.validatorName,
    validatorAvailable: input.diagnostics.validatorAvailable,
    checkedAt: input.diagnostics.checkedAt,
    artifactDiagnostics: input.diagnostics,
    disclaimer:
      "Guarded local Schematron execution is a technical check only. It is not official validation, does not certify Peppol or EN 16931 status, and is not legal, tax, accounting, filing, or authority acceptance advice."
  };
}

async function buildSchematronExecutionResult(input: {
  xml: string;
  check: Extract<XmlValidationJobCheck, "schematron_peppol" | "schematron_en16931">;
  artifactConfig?: SchematronArtifactConfigInput;
  schematronExecutionPolicyInput?: SchematronExecutionPolicyInput;
}): Promise<XmlValidationJobCheckResult> {
  const checkType = checkTypeForSchematronCheck(input.check);
  const policy = buildSchematronExecutionPolicy({
    ...getDefaultSchematronExecutionPolicyInput(),
    ...(input.schematronExecutionPolicyInput ?? {})
  });
  const diagnostics = await buildSafeSchematronArtifactDiagnostics(
    input.artifactConfig ?? getDefaultSchematronArtifactConfig()
  );
  const engineCandidate = await inspectSchematronEngineCandidate({
    engineId: policy.engineId
  });
  const orchestration = await runSchematronExecutionOrchestrator({
    xml: input.xml,
    mode: schematronModeForPolicy(policy),
    layers: layerForSchematronCheck(input.check),
    policy,
    engineCandidate,
    artifactDiagnostics: diagnostics,
    artifactConfig: input.artifactConfig ?? getDefaultSchematronArtifactConfig()
  });
  const status = mapSchematronOrchestratorStatus(
    orchestration.status,
    orchestration.markedValid,
    policy.mode
  );

  return {
    checkType: input.check,
    status,
    findings: orchestration.findings.map((finding) =>
      buildSchematronFinding(finding, checkType)
    ),
    summary: buildSchematronExecutionSummary({
      checkType,
      diagnostics,
      policy,
      engineCandidate,
      orchestration
    })
  };
}

function summarizeCheckStatuses(
  checkResults: readonly XmlValidationJobCheckResult[]
) {
  return checkResults.reduce<Record<string, string>>((summary, result) => {
    summary[result.checkType] = result.status;
    return summary;
  }, {});
}

function getDefaultUblXsdArtifactConfig(): UblXsdArtifactConfigInput {
  return {
    rootDir: env.UBL_XSD_ROOT_DIR,
    invoiceXsdPath: env.UBL_INVOICE_XSD_PATH,
    creditNoteXsdPath: env.UBL_CREDIT_NOTE_XSD_PATH,
    artifactVersion: env.UBL_XSD_ARTIFACT_VERSION
  };
}

function getDefaultSchematronArtifactConfig(): SchematronArtifactConfigInput {
  return {
    rootDir: env.PEPPOL_SCHEMATRON_ROOT_DIR,
    peppolBisSchematronPath: env.PEPPOL_BIS_SCHEMATRON_PATH,
    en16931SchematronPath: env.EN16931_SCHEMATRON_PATH,
    artifactVersion: env.SCHEMATRON_ARTIFACT_VERSION
  };
}

function getDefaultSchematronExecutionPolicyInput(): SchematronExecutionPolicyInput {
  return {
    requestedMode: env.SCHEMATRON_EXECUTION_MODE,
    requestedEngine: env.SCHEMATRON_ENGINE,
    allowExperimentalExecution: env.SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION
  };
}

function buildUblXsdFinding(
  finding: UblXsdValidationFinding
): XmlValidationJobFinding {
  return {
    code: finding.code,
    severity: finding.severity,
    checkType: "xsd_ubl",
    field: finding.field,
    message: finding.message,
    status: finding.status,
    legalConfidence: "technical",
    ...(finding.fixSuggestion
      ? { fixSuggestion: finding.fixSuggestion }
      : {}),
    ...(finding.sourceLabels ? { sourceLabels: finding.sourceLabels } : {}),
    ...(finding.technicalMessage
      ? { technicalMessage: finding.technicalMessage }
      : {}),
    ...(finding.technicalCode ? { technicalCode: finding.technicalCode } : {}),
    ...(finding.xmlLine ? { xmlLine: finding.xmlLine } : {})
  };
}

async function buildUblXsdResult(input: {
  xml: string;
  rootElement: string;
  documentType: string;
  artifactConfig?: UblXsdArtifactConfigInput;
}): Promise<XmlValidationJobCheckResult> {
  const result = await validateUblXsd({
    xml: input.xml,
    rootElement: input.rootElement,
    documentType: input.documentType,
    artifactConfig: input.artifactConfig ?? getDefaultUblXsdArtifactConfig()
  });

  return {
    checkType: "xsd_ubl",
    status: result.status,
    artifactInfo: result.artifactInfo,
    findings: result.findings.map((finding) => buildUblXsdFinding(finding)),
    summary: {
      ...result.summary,
      artifactInfo: result.artifactInfo
    }
  };
}

function isCompletedCheckResult(result: XmlValidationJobCheckResult) {
  return result.status === "passed" || result.status === "completed";
}

function getXsdUblResult(checkResults: readonly XmlValidationJobCheckResult[]) {
  return checkResults.find((result) => result.checkType === "xsd_ubl");
}

function getSchematronPeppolResult(
  checkResults: readonly XmlValidationJobCheckResult[]
) {
  return (
    checkResults.find((result) => result.checkType === "schematron_peppol") ??
    checkResults.find(
      (result) => result.checkType === "schematron_peppol_placeholder"
    )
  );
}

function getSchematronEn16931Result(
  checkResults: readonly XmlValidationJobCheckResult[]
) {
  return checkResults.find((result) => result.checkType === "schematron_en16931");
}

function isSchematronValidationExecuted(
  summaries: Array<Record<string, unknown> | undefined>
) {
  return summaries.some((summary) =>
    getBooleanSummaryValue(summary, "validationExecuted")
  );
}

function getBooleanSummaryValue(
  summary: Record<string, unknown> | undefined,
  key: string
) {
  return summary?.[key] === true;
}

function getStringSummaryValue(
  summary: Record<string, unknown> | undefined,
  key: string
) {
  const value = summary?.[key];

  return typeof value === "string" ? value : undefined;
}

export function buildXmlValidationJobQueueFailureCompletion(input: {
  xmlSha256: string;
  xmlSizeBytes: number;
  requestedChecks: readonly XmlValidationJobCheck[];
  safety?: XmlSafetyInspection;
  rootElement: string;
  documentType: string;
  errorCode: string;
  errorMessage: string;
  retryable?: boolean;
  attempt?: number;
  maxAttempts?: number;
  queuedAt?: Date | string;
  startedAt?: Date | string;
  failedAt?: Date | string;
  claimedBy?: string;
}): XmlValidationJobCompletion {
  const queueLifecycle = buildFailedXmlValidationJobLifecycle({
    mode: "async_worker",
    failureCode: input.errorCode,
    failureMessage: input.errorMessage,
    ...(typeof input.retryable === "boolean" ? { retryable: input.retryable } : {}),
    ...(input.attempt !== undefined ? { attempt: input.attempt } : {}),
    ...(input.maxAttempts !== undefined ? { maxAttempts: input.maxAttempts } : {}),
    ...(input.queuedAt !== undefined ? { queuedAt: input.queuedAt } : {}),
    ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
    ...(input.failedAt !== undefined ? { failedAt: input.failedAt } : {}),
    ...(input.claimedBy !== undefined ? { claimedBy: input.claimedBy } : {})
  });
  const failedChecks = [...input.requestedChecks];
  const finding = buildQueueFailureFinding({
    errorCode: input.errorCode,
    errorMessage: input.errorMessage
  });

  return {
    completedChecks: [],
    failedChecks,
    workerName: XML_VALIDATION_JOB_WORKER_NAME,
    workerVersion: XML_VALIDATION_JOB_WORKER_VERSION,
    resultSummary: {
      workerReady: false,
      xmlSha256: input.xmlSha256,
      xmlSizeBytes: input.xmlSizeBytes,
      rootElement: input.rootElement,
      documentType: input.documentType,
      safetyPolicyPassed: input.safety?.safe ?? false,
      requestedChecks: input.requestedChecks,
      completedChecks: [],
      failedChecks,
      inactiveChecks: failedChecks,
      checkResults: [
        {
          checkType: "worker_readiness",
          status: "error",
          findings: [finding],
          summary: {
            validationExecuted: false,
            errorCode: input.errorCode,
            retryable: queueLifecycle.retryable
          }
        }
      ],
      checkStatuses: {
        worker_readiness: "error"
      },
      queue: queueLifecycle,
      activeValidation: {
        xsd: false,
        schematron: false,
        peppolArtifacts: false,
        en16931Certification: false
      },
      xsdUbl: {
        requested: input.requestedChecks.includes("xsd_ubl"),
        configured: false,
        validationExecuted: false,
        markedValid: false
      },
      schematronPeppol: {
        requested:
          input.requestedChecks.includes("schematron_peppol") ||
          input.requestedChecks.includes("schematron_peppol_placeholder"),
        implemented: false,
        validationExecutionEnabled: false,
        validationExecuted: false,
        markedValid: false
      },
      schematronEn16931: {
        requested: input.requestedChecks.includes("schematron_en16931"),
        implemented: false,
        validationExecutionEnabled: false,
        validationExecuted: false,
        markedValid: false
      }
    },
    findings: [finding],
    disclaimer: XML_VALIDATION_JOB_DISCLAIMER
  };
}

export async function buildXmlValidationJobCompletion(input: {
  xml: string;
  xmlSha256: string;
  xmlSizeBytes: number;
  requestedChecks: readonly XmlValidationJobCheck[];
  safety: XmlSafetyInspection;
  rootElement: string;
  documentType: string;
  xsdArtifactConfig?: UblXsdArtifactConfigInput;
  schematronArtifactConfig?: SchematronArtifactConfigInput;
  schematronExecutionPolicyInput?: SchematronExecutionPolicyInput;
  queueMode?: XmlValidationJobQueueMode;
  queueAttempt?: number;
  queueQueuedAt?: Date | string;
  queueStartedAt?: Date | string;
  queueClaimedBy?: string;
}): Promise<XmlValidationJobCompletion> {
  const completedChecks: XmlValidationJobCheck[] = [];
  const failedChecks: XmlValidationJobCheck[] = [];
  const findings: XmlValidationJobFinding[] = [];
  const checkResults: XmlValidationJobCheckResult[] = [];

  for (const check of input.requestedChecks) {
    if (check === "worker_readiness") {
      const result = buildWorkerReadinessResult();
      completedChecks.push(check);
      checkResults.push(result);
      findings.push(...result.findings);
      continue;
    }

    if (check === "xsd_ubl") {
      const result = await buildUblXsdResult({
        xml: input.xml,
        rootElement: input.rootElement,
        documentType: input.documentType,
        ...(input.xsdArtifactConfig
          ? { artifactConfig: input.xsdArtifactConfig }
          : {})
      });

      if (
        isCompletedCheckResult(result) ||
        result.status === "not_configured"
      ) {
        completedChecks.push(check);
      } else {
        failedChecks.push(check);
      }

      checkResults.push(result);
      findings.push(...result.findings);
      continue;
    }

    if (check === "schematron_peppol_placeholder") {
      const result = await buildSchematronPlaceholderResult({
        xml: input.xml,
        ...(input.schematronArtifactConfig
          ? { artifactConfig: input.schematronArtifactConfig }
          : {}),
        ...(input.schematronExecutionPolicyInput
          ? {
              schematronExecutionPolicyInput:
                input.schematronExecutionPolicyInput
            }
          : {})
      });
      failedChecks.push(check);
      checkResults.push(result);
      findings.push(...result.findings);
      continue;
    }

    if (check === "schematron_peppol" || check === "schematron_en16931") {
      const result = await buildSchematronExecutionResult({
        xml: input.xml,
        check,
        ...(input.schematronArtifactConfig
          ? { artifactConfig: input.schematronArtifactConfig }
          : {}),
        ...(input.schematronExecutionPolicyInput
          ? {
              schematronExecutionPolicyInput:
                input.schematronExecutionPolicyInput
            }
          : {})
      });

      if (isCompletedCheckResult(result) || result.status === "not_configured") {
        completedChecks.push(check);
      } else {
        failedChecks.push(check);
      }

      checkResults.push(result);
      findings.push(...result.findings);
    }
  }

  const xsdUblResult = getXsdUblResult(checkResults);
  const xsdUblSummary = xsdUblResult?.summary;
  const schematronPeppolResult = getSchematronPeppolResult(checkResults);
  const schematronPeppolSummary = schematronPeppolResult?.summary;
  const schematronEn16931Result = getSchematronEn16931Result(checkResults);
  const schematronEn16931Summary = schematronEn16931Result?.summary;
  const queueLifecycle = buildCompletedXmlValidationJobLifecycle({
    mode: input.queueMode ?? "inline",
    ...(input.queueAttempt !== undefined ? { attempt: input.queueAttempt } : {}),
    ...(input.queueQueuedAt !== undefined ? { queuedAt: input.queueQueuedAt } : {}),
    ...(input.queueStartedAt !== undefined
      ? { startedAt: input.queueStartedAt }
      : {}),
    ...(input.queueClaimedBy !== undefined
      ? { claimedBy: input.queueClaimedBy }
      : {})
  });

  return {
    completedChecks,
    failedChecks,
    workerName: XML_VALIDATION_JOB_WORKER_NAME,
    workerVersion: XML_VALIDATION_JOB_WORKER_VERSION,
    resultSummary: {
      workerReady: completedChecks.includes("worker_readiness"),
      xmlSha256: input.xmlSha256,
      xmlSizeBytes: input.xmlSizeBytes,
      rootElement: input.rootElement,
      documentType: input.documentType,
      safetyPolicyPassed: input.safety.safe,
      requestedChecks: input.requestedChecks,
      completedChecks,
      failedChecks,
      inactiveChecks: failedChecks,
      queue: queueLifecycle,
      checkResults,
      checkStatuses: summarizeCheckStatuses(checkResults),
      activeValidation: {
        xsd: getBooleanSummaryValue(xsdUblSummary, "validationExecuted"),
        schematron: isSchematronValidationExecuted([
          schematronPeppolSummary,
          schematronEn16931Summary
        ]),
        peppolArtifacts: getBooleanSummaryValue(
          schematronPeppolSummary,
          "configured"
        ),
        en16931Certification: false
      },
      xsdUbl: {
        requested: input.requestedChecks.includes("xsd_ubl"),
        configured: getBooleanSummaryValue(xsdUblSummary, "configured"),
        validationExecuted: getBooleanSummaryValue(
          xsdUblSummary,
          "validationExecuted"
        ),
        markedValid: getBooleanSummaryValue(xsdUblSummary, "markedValid"),
        ...(getStringSummaryValue(xsdUblSummary, "disclaimer")
          ? { disclaimer: getStringSummaryValue(xsdUblSummary, "disclaimer") }
          : {}),
        ...(xsdUblResult ? { status: xsdUblResult.status } : {}),
        ...(xsdUblResult?.artifactInfo
          ? { artifactInfo: xsdUblResult.artifactInfo }
          : {})
      },
      schematronPeppol: {
        requested:
          input.requestedChecks.includes("schematron_peppol") ||
          input.requestedChecks.includes("schematron_peppol_placeholder"),
        implemented: getBooleanSummaryValue(
          schematronPeppolSummary,
          "implemented"
        ),
        adapterVersion:
          schematronPeppolSummary?.adapterVersion ?? undefined,
        executionPreflight:
          schematronPeppolSummary?.executionPreflight ?? undefined,
        executionPolicy:
          schematronPeppolSummary?.executionPolicy ?? undefined,
        engineCandidate:
          schematronPeppolSummary?.engineCandidate ?? undefined,
        preflightStatus:
          schematronPeppolSummary?.preflightStatus ?? undefined,
        preflightReason:
          schematronPeppolSummary?.preflightReason ?? undefined,
        policyVersion:
          schematronPeppolSummary?.policyVersion ?? undefined,
        policyMode:
          schematronPeppolSummary?.policyMode ?? undefined,
        policyReason:
          schematronPeppolSummary?.policyReason ?? undefined,
        engineId:
          schematronPeppolSummary?.engineId ?? undefined,
        engineCandidateVersion:
          schematronPeppolSummary?.engineCandidateVersion ?? undefined,
        engineAvailabilityStatus:
          schematronPeppolSummary?.engineAvailabilityStatus ?? undefined,
        engineExecutionSupported:
          schematronPeppolSummary?.engineExecutionSupported ?? undefined,
        executionPermitted: getBooleanSummaryValue(
          schematronPeppolSummary,
          "executionPermitted"
        ),
        validationExecutionEnabled: getBooleanSummaryValue(
          schematronPeppolSummary,
          "validationExecutionEnabled"
        ),
        validationExecuted: getBooleanSummaryValue(
          schematronPeppolSummary,
          "validationExecuted"
        ),
        markedValid: getBooleanSummaryValue(
          schematronPeppolSummary,
          "markedValid"
        ),
        findingContractVersion:
          schematronPeppolSummary?.findingContractVersion ?? undefined,
        supportedFutureFindingCodes:
          schematronPeppolSummary?.supportedFutureFindingCodes ?? undefined,
        configured: getBooleanSummaryValue(
          schematronPeppolSummary,
          "configured"
        ),
        usable: getBooleanSummaryValue(schematronPeppolSummary, "usable"),
        readyArtifactCount:
          schematronPeppolSummary?.readyArtifactCount ?? undefined,
        requiredArtifactCount:
          schematronPeppolSummary?.requiredArtifactCount ?? undefined,
        artifactVersion:
          schematronPeppolSummary?.artifactVersion ?? undefined,
        ...(schematronPeppolResult
          ? { status: schematronPeppolResult.status }
          : {}),
        ...(schematronPeppolSummary?.artifactDiagnostics
          ? {
              artifactDiagnostics:
                schematronPeppolSummary.artifactDiagnostics
            }
          : {})
      },
      schematronEn16931: {
        requested: input.requestedChecks.includes("schematron_en16931"),
        implemented: getBooleanSummaryValue(
          schematronEn16931Summary,
          "implemented"
        ),
        executionPolicy:
          schematronEn16931Summary?.executionPolicy ?? undefined,
        engineCandidate:
          schematronEn16931Summary?.engineCandidate ?? undefined,
        policyVersion:
          schematronEn16931Summary?.policyVersion ?? undefined,
        policyMode:
          schematronEn16931Summary?.policyMode ?? undefined,
        policyReason:
          schematronEn16931Summary?.policyReason ?? undefined,
        engineId:
          schematronEn16931Summary?.engineId ?? undefined,
        engineCandidateVersion:
          schematronEn16931Summary?.engineCandidateVersion ?? undefined,
        engineAvailabilityStatus:
          schematronEn16931Summary?.engineAvailabilityStatus ?? undefined,
        engineExecutionSupported:
          schematronEn16931Summary?.engineExecutionSupported ?? undefined,
        executionPermitted: getBooleanSummaryValue(
          schematronEn16931Summary,
          "executionPermitted"
        ),
        validationExecutionEnabled: getBooleanSummaryValue(
          schematronEn16931Summary,
          "validationExecutionEnabled"
        ),
        validationExecuted: getBooleanSummaryValue(
          schematronEn16931Summary,
          "validationExecuted"
        ),
        markedValid: getBooleanSummaryValue(
          schematronEn16931Summary,
          "markedValid"
        ),
        findingContractVersion:
          schematronEn16931Summary?.findingContractVersion ?? undefined,
        supportedFutureFindingCodes:
          schematronEn16931Summary?.supportedFutureFindingCodes ?? undefined,
        configured: getBooleanSummaryValue(
          schematronEn16931Summary,
          "configured"
        ),
        usable: getBooleanSummaryValue(schematronEn16931Summary, "usable"),
        readyArtifactCount:
          schematronEn16931Summary?.readyArtifactCount ?? undefined,
        requiredArtifactCount:
          schematronEn16931Summary?.requiredArtifactCount ?? undefined,
        artifactVersion:
          schematronEn16931Summary?.artifactVersion ?? undefined,
        ...(schematronEn16931Result
          ? { status: schematronEn16931Result.status }
          : {}),
        ...(schematronEn16931Summary?.artifactDiagnostics
          ? {
              artifactDiagnostics:
                schematronEn16931Summary.artifactDiagnostics
            }
          : {})
      }
    },
    findings,
    disclaimer: XML_VALIDATION_JOB_DISCLAIMER
  };
}
