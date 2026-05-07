import {
  SCHEMATRON_EXECUTION_ADAPTER_VERSION,
  SCHEMATRON_FINDING_CONTRACT_VERSION,
  SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES,
  buildSchematronExecutionPolicy,
  buildSchematronExecutionPreflight,
  buildSchematronExecutionDisabledFinding,
  buildSafeSchematronArtifactDiagnostics,
  inspectXmlSafety,
  readSchematronArtifactConfigFromEnv,
  readUblXsdArtifactConfigFromEnv,
  validateUblXsd,
  type SchematronExecutionMode,
  type SchematronExecutionPolicy,
  type SchematronExecutionPolicyInput,
  type SchematronExecutionPreflightResult,
  type SchematronSafeArtifactDiagnostics,
  type UblXsdValidationFinding
} from "@invoice-lantern/ubl";
import type {
  XmlWorkerCheck,
  XmlWorkerCheckResult,
  XmlWorkerFinding,
  XmlWorkerRequest,
  XmlWorkerResult
} from "./worker-types.js";

export const XML_WORKER_STUB_DISCLAIMER =
  "This XML validation job is a technical sandbox worker-readiness and configured-check result. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance.";

function getUtf8ByteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function detectRootElement(xml: string) {
  const match = xml.match(/<\s*([A-Za-z_][\w:.-]*)(?:\s|>|\/>)/);
  const rawRoot = match?.[1] ?? "unknown";

  return rawRoot.includes(":") ? rawRoot.split(":").pop() ?? rawRoot : rawRoot;
}

function detectDocumentType(rootElement: string) {
  const normalized = rootElement.toLowerCase();

  if (normalized.includes("creditnote")) {
    return "credit_note";
  }

  if (normalized.includes("invoice")) {
    return "invoice";
  }

  return "unknown";
}

function uniqueRequestedChecks(checks: readonly XmlWorkerCheck[]) {
  const requestedChecks: XmlWorkerCheck[] =
    checks.length > 0 ? [...checks] : ["worker_readiness"];

  return [...new Set(requestedChecks)];
}

function buildWorkerReadinessFinding(): XmlWorkerFinding {
  return {
    code: "XML_VALIDATION_WORKER_READY",
    severity: "info",
    checkType: "worker_readiness",
    field: "xml",
    message:
      "The XML validation worker foundation is available and completed the worker readiness check.",
    status: "completed",
    legalConfidence: "technical"
  };
}

function buildSchematronPlaceholderFinding(
  diagnostics: SchematronSafeArtifactDiagnostics
): XmlWorkerFinding {
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

function buildWorkerReadinessResult(): XmlWorkerCheckResult {
  const finding = buildWorkerReadinessFinding();

  return {
    checkType: "worker_readiness",
    status: "completed",
    findings: [finding],
    summary: {
      workerReady: true,
      activeValidation: true
    }
  };
}

function buildSchematronPlaceholderSummary(
  diagnostics: SchematronSafeArtifactDiagnostics,
  preflight: SchematronExecutionPreflightResult,
  policy: SchematronExecutionPolicy
) {
  return {
    adapterVersion: SCHEMATRON_EXECUTION_ADAPTER_VERSION,
    executionPreflight: preflight.safeSummary,
    executionPolicy: policy.safeSummary,
    preflightStatus: preflight.status,
    preflightReason: preflight.reason,
    policyVersion: policy.policyVersion,
    policyMode: policy.mode,
    policyReason: policy.reason,
    engineId: policy.engineId,
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
}): Promise<XmlWorkerCheckResult> {
  const policy = buildSchematronExecutionPolicy(
    readSchematronExecutionPolicyInputFromEnv()
  );
  const diagnostics = await buildSafeSchematronArtifactDiagnostics(
    readSchematronArtifactConfigFromEnv()
  );
  const preflight = buildSchematronExecutionPreflight({
    xml: input.xml,
    requestedLayer: "peppol_bis_billing",
    artifactDiagnostics: diagnostics,
    mode: getAdapterModeForPolicy(policy)
  });
  const finding = buildSchematronPlaceholderFinding(diagnostics);

  return {
    checkType: "schematron_peppol_placeholder",
    status: "not_implemented",
    findings: [finding],
    summary: buildSchematronPlaceholderSummary(diagnostics, preflight, policy)
  };
}

function summarizeCheckStatuses(checkResults: readonly XmlWorkerCheckResult[]) {
  return checkResults.reduce<Record<string, string>>((summary, result) => {
    summary[result.checkType] = result.status;
    return summary;
  }, {});
}

function buildUblXsdFinding(finding: UblXsdValidationFinding): XmlWorkerFinding {
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
}): Promise<XmlWorkerCheckResult> {
  const result = await validateUblXsd({
    xml: input.xml,
    rootElement: input.rootElement,
    documentType: input.documentType,
    artifactConfig: readUblXsdArtifactConfigFromEnv()
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

function isCompletedCheckResult(result: XmlWorkerCheckResult) {
  return result.status === "passed" || result.status === "completed";
}

function getXsdUblResult(checkResults: readonly XmlWorkerCheckResult[]) {
  return checkResults.find((result) => result.checkType === "xsd_ubl");
}

function getSchematronPeppolResult(
  checkResults: readonly XmlWorkerCheckResult[]
) {
  return checkResults.find(
    (result) => result.checkType === "schematron_peppol_placeholder"
  );
}

function getBooleanSummaryValue(
  summary: Record<string, unknown> | undefined,
  key: string
) {
  return summary?.[key] === true;
}

export async function runStubXmlValidator(
  request: XmlWorkerRequest
): Promise<XmlWorkerResult> {
  const requestedChecks = uniqueRequestedChecks(request.requestedChecks);
  const safety = inspectXmlSafety(request.xml);
  const rootElement = detectRootElement(request.xml);
  const documentType = detectDocumentType(rootElement);
  const xmlSizeBytes = getUtf8ByteLength(request.xml);
  const completedChecks: XmlWorkerCheck[] = [];
  const failedChecks: XmlWorkerCheck[] = [];
  const checkResults: XmlWorkerCheckResult[] = [];
  const findings: XmlWorkerFinding[] = [];

  for (const check of requestedChecks) {
    if (check === "worker_readiness") {
      const result = buildWorkerReadinessResult();
      completedChecks.push(check);
      checkResults.push(result);
      findings.push(...result.findings);
      continue;
    }

    if (check === "xsd_ubl") {
      const result = await buildUblXsdResult({
        xml: request.xml,
        rootElement,
        documentType
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
        xml: request.xml
      });
      failedChecks.push(check);
      checkResults.push(result);
      findings.push(...result.findings);
    }
  }

  const xsdUblResult = getXsdUblResult(checkResults);
  const xsdUblSummary = xsdUblResult?.summary;
  const schematronPeppolResult = getSchematronPeppolResult(checkResults);
  const schematronPeppolSummary = schematronPeppolResult?.summary;

  return {
    status: "completed",
    rootElement,
    documentType,
    xmlSizeBytes,
    completedChecks,
    failedChecks,
    checkResults,
    findings,
    resultSummary: {
      workerReady: completedChecks.includes("worker_readiness"),
      safetyPolicyPassed: safety.safe,
      rootElement,
      documentType,
      xmlSizeBytes,
      requestedChecks,
      completedChecks,
      failedChecks,
      checkStatuses: summarizeCheckStatuses(checkResults),
      activeValidation: {
        xsd: getBooleanSummaryValue(xsdUblSummary, "validationExecuted"),
        schematron: false,
        peppolArtifacts: false,
        en16931Certification: false
      },
      xsdUbl: {
        requested: requestedChecks.includes("xsd_ubl"),
        configured: getBooleanSummaryValue(xsdUblSummary, "configured"),
        validationExecuted: getBooleanSummaryValue(
          xsdUblSummary,
          "validationExecuted"
        ),
        markedValid: getBooleanSummaryValue(xsdUblSummary, "markedValid"),
        ...(xsdUblResult ? { status: xsdUblResult.status } : {}),
        ...(xsdUblResult?.artifactInfo
          ? { artifactInfo: xsdUblResult.artifactInfo }
          : {})
      },
      schematronPeppol: {
        requested: requestedChecks.includes("schematron_peppol_placeholder"),
        implemented: false,
        adapterVersion:
          schematronPeppolSummary?.adapterVersion ?? undefined,
        executionPreflight:
          schematronPeppolSummary?.executionPreflight ?? undefined,
        executionPolicy:
          schematronPeppolSummary?.executionPolicy ?? undefined,
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
        executionPermitted: false,
        validationExecutionEnabled: false,
        validationExecuted: false,
        markedValid: false,
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
      }
    },
    disclaimer: XML_WORKER_STUB_DISCLAIMER
  };
}
