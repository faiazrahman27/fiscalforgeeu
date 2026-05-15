import {
  SCHEMATRON_EXECUTION_ADAPTER_VERSION,
  SCHEMATRON_FINDING_CONTRACT_VERSION,
  SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES,
  buildSchematronExecutionPolicy,
  buildSchematronExecutionPreflight,
  buildSchematronExecutionDisabledFinding,
  buildSafeSchematronArtifactDiagnostics,
  inspectSchematronEngineCandidate,
  inspectXmlSafety,
  readSchematronArtifactConfigFromEnv,
  readUblXsdArtifactConfigFromEnv,
  validateUblXsd,
  type SchematronExecutionMode,
  type SchematronEngineCandidateInfo,
  type SchematronExecutionPolicy,
  type SchematronExecutionPolicyInput,
  type SchematronExecutionPreflightResult,
  type SchematronContractFinding,
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
import {
  runXmlWorkerSchematronOrchestration,
  type XmlWorkerSchematronResult
} from "./schematron-worker-orchestrator.js";

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
  policy: SchematronExecutionPolicy,
  engineCandidate: SchematronEngineCandidateInfo,
  orchestration: XmlWorkerSchematronResult
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
    schematronOrchestration: orchestration.safeSummary,
    workerSchematronOrchestratorVersion:
      orchestration.workerSchematronOrchestratorVersion,
    orchestrationMode: orchestration.mode,
    orchestrationStatus: orchestration.status,
    orchestrationReason: orchestration.reason,
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

function getWorkerSchematronModeForPolicy(policy: SchematronExecutionPolicy) {
  if (policy.mode === "execute" && policy.executionPermitted) {
    return "execute" as const;
  }

  if (policy.mode === "disabled") {
    return "disabled" as const;
  }

  return "preflight_only" as const;
}

function mapSchematronWorkerStatus(input: {
  status: XmlWorkerSchematronResult["status"];
  markedValid: boolean;
  policyMode: SchematronExecutionPolicy["mode"];
}): XmlWorkerCheckResult["status"] {
  if (
    input.policyMode === "preflight_only" &&
    input.status !== "not_configured"
  ) {
    return "preflight_only";
  }

  if (input.status === "executed") {
    return input.markedValid ? "passed" : "warning";
  }

  if (input.status === "failed") {
    return "failed";
  }

  if (input.status === "not_configured") {
    return "not_configured";
  }

  if (input.status === "unsupported") {
    return "unsupported";
  }

  if (input.status === "unsafe_input") {
    return "unsafe_input";
  }

  if (input.status === "artifact_unreadable") {
    return "artifact_unreadable";
  }

  if (input.status === "engine_unavailable") {
    return "engine_unavailable";
  }

  if (input.status === "disabled") {
    return "disabled";
  }

  return "error";
}

function buildSchematronWorkerFinding(
  finding: SchematronContractFinding,
  checkType: "schematron_peppol" | "schematron_en16931"
): XmlWorkerFinding {
  return {
    ...finding,
    checkType
  };
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
  const engineCandidate = await inspectSchematronEngineCandidate({
    engineId: policy.engineId
  });
  const orchestration = await runXmlWorkerSchematronOrchestration({
    xml: input.xml,
    requestedChecks: ["schematron_peppol_placeholder"],
    mode: policy.mode === "disabled" ? "disabled" : "preflight_only"
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
      engineCandidate,
      orchestration
    )
  };
}

async function buildSchematronExecutionWorkerResult(input: {
  xml: string;
  checkType: "schematron_peppol" | "schematron_en16931";
}): Promise<XmlWorkerCheckResult> {
  const policy = buildSchematronExecutionPolicy(
    readSchematronExecutionPolicyInputFromEnv()
  );
  const diagnostics = await buildSafeSchematronArtifactDiagnostics(
    readSchematronArtifactConfigFromEnv()
  );
  const engineCandidate = await inspectSchematronEngineCandidate({
    engineId: policy.engineId
  });
  const orchestration = await runXmlWorkerSchematronOrchestration({
    xml: input.xml,
    requestedChecks: [input.checkType],
    mode: getWorkerSchematronModeForPolicy(policy)
  });
  const status = mapSchematronWorkerStatus({
    status: orchestration.status,
    markedValid: orchestration.markedValid,
    policyMode: policy.mode
  });

  return {
    checkType: input.checkType,
    status,
    findings: orchestration.findings.map((finding) =>
      buildSchematronWorkerFinding(finding, input.checkType)
    ),
    summary: {
      implemented: true,
      checkType: input.checkType,
      executionPolicy: policy.safeSummary,
      engineCandidate: engineCandidate.safeSummary,
      workerSchematronOrchestratorVersion:
        orchestration.workerSchematronOrchestratorVersion,
      schematronOrchestration: orchestration.safeSummary,
      orchestrationMode: orchestration.mode,
      orchestrationStatus: orchestration.status,
      orchestrationReason: orchestration.reason,
      policyVersion: policy.policyVersion,
      policyMode: policy.mode,
      policyReason: policy.reason,
      engineId: policy.engineId,
      engineCandidateVersion: engineCandidate.engineCandidateVersion,
      engineAvailabilityStatus: engineCandidate.availabilityStatus,
      engineExecutionSupported: engineCandidate.executionSupported,
      executionPermitted: policy.executionPermitted,
      validationExecutionEnabled: orchestration.validationExecutionEnabled,
      validationExecuted: orchestration.validationExecuted,
      markedValid: orchestration.markedValid,
      status,
      configured: diagnostics.configured,
      usable: diagnostics.usable,
      readyArtifactCount: diagnostics.readyArtifactCount,
      requiredArtifactCount: diagnostics.requiredArtifactCount,
      artifactVersion: diagnostics.artifactVersion,
      artifactDiagnostics: diagnostics,
      findingContractVersion: SCHEMATRON_FINDING_CONTRACT_VERSION,
      supportedFutureFindingCodes: [...SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES]
    }
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

function buildCiiXsdResult(rootElement: string): XmlWorkerCheckResult {
  const configured = Boolean(
    process.env.CII_XSD_ROOT_DIR?.trim() ||
      process.env.CII_CROSS_INDUSTRY_INVOICE_XSD_PATH?.trim()
  );
  const rootLooksCii = rootElement.toLowerCase() === "crossindustryinvoice";

  if (!configured) {
    const finding: XmlWorkerFinding = {
      code: "CII_XSD_NOT_CONFIGURED",
      severity: "warning",
      checkType: "xsd_cii",
      field: "xml",
      message:
        "CII XSD validation was requested, but reviewed local CII XSD artefacts are not configured in this worker environment.",
      status: "not_configured",
      legalConfidence: "technical",
      fixSuggestion:
        "Configure server-side CII_XSD_ROOT_DIR and CII_CROSS_INDUSTRY_INVOICE_XSD_PATH only after reviewing local artefacts. Invoice Lantern never fetches CII schemas remotely.",
      sourceLabels: [
        "Invoice Lantern technical CII XSD configuration diagnostics"
      ]
    };

    return {
      checkType: "xsd_cii",
      status: "not_configured",
      findings: [finding],
      summary: {
        configured: false,
        usable: false,
        validationExecuted: false,
        markedValid: false,
        rootLooksCii,
        artifactVersion: process.env.CII_XSD_ARTIFACT_VERSION ?? null,
        remoteFetching: false,
        disclaimer:
          "CII XSD support is a guarded local technical check only. not_configured is not success and does not imply official validation, certification, filing, or authority acceptance."
      }
    };
  }

  const finding: XmlWorkerFinding = {
    code: "CII_XSD_LOCAL_VALIDATION_NOT_IMPLEMENTED",
    severity: "warning",
    checkType: "xsd_cii",
    field: "xml",
    message:
      "Reviewed CII XSD artefact paths are configured, but a real local CII XSD validation adapter is not implemented in this worker step.",
    status: "not_implemented",
    legalConfidence: "technical",
    fixSuggestion:
      "Add a reviewed local CII XSD execution adapter before treating xsd_cii as executable. Do not infer validity from configuration alone.",
    sourceLabels: [
      "Invoice Lantern technical CII XSD configuration diagnostics"
    ]
  };

  return {
    checkType: "xsd_cii",
    status: "not_implemented",
    findings: [finding],
    summary: {
      configured: true,
      usable: false,
      validationExecuted: false,
      markedValid: false,
      rootLooksCii,
      artifactVersion: process.env.CII_XSD_ARTIFACT_VERSION ?? null,
      remoteFetching: false,
      disclaimer:
        "CII XSD support is a guarded local technical check only and is not official CII validation, certification, filing, or authority acceptance."
    }
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

function getXsdCiiResult(checkResults: readonly XmlWorkerCheckResult[]) {
  return checkResults.find((result) => result.checkType === "xsd_cii");
}

function getSchematronPeppolResult(
  checkResults: readonly XmlWorkerCheckResult[]
) {
  return (
    checkResults.find((result) => result.checkType === "schematron_peppol") ??
    checkResults.find(
      (result) => result.checkType === "schematron_peppol_placeholder"
    )
  );
}

function getSchematronEn16931Result(
  checkResults: readonly XmlWorkerCheckResult[]
) {
  return checkResults.find((result) => result.checkType === "schematron_en16931");
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

function getImplementedSummaryValue(
  summary: Record<string, unknown> | undefined
) {
  return summary?.implemented === true;
}

function isSchematronCheckCompleted(result: XmlWorkerCheckResult) {
  return result.status === "passed" || result.status === "not_configured";
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
      continue;
    }

    if (check === "xsd_cii") {
      const result = buildCiiXsdResult(rootElement);

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

    if (check === "schematron_peppol" || check === "schematron_en16931") {
      const result = await buildSchematronExecutionWorkerResult({
        xml: request.xml,
        checkType: check
      });

      if (isSchematronCheckCompleted(result)) {
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
  const xsdCiiResult = getXsdCiiResult(checkResults);
  const xsdCiiSummary = xsdCiiResult?.summary;
  const schematronPeppolResult = getSchematronPeppolResult(checkResults);
  const schematronPeppolSummary = schematronPeppolResult?.summary;
  const schematronEn16931Result = getSchematronEn16931Result(checkResults);
  const schematronEn16931Summary = schematronEn16931Result?.summary;

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
        xsd:
          getBooleanSummaryValue(xsdUblSummary, "validationExecuted") ||
          getBooleanSummaryValue(xsdCiiSummary, "validationExecuted"),
        schematron:
          getBooleanSummaryValue(
            schematronPeppolSummary,
            "validationExecuted"
          ) ||
          getBooleanSummaryValue(
            schematronEn16931Summary,
            "validationExecuted"
          ),
        peppolArtifacts: getBooleanSummaryValue(
          schematronPeppolSummary,
          "configured"
        ),
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
        ...(getStringSummaryValue(xsdUblSummary, "disclaimer")
          ? { disclaimer: getStringSummaryValue(xsdUblSummary, "disclaimer") }
          : {}),
        ...(xsdUblResult ? { status: xsdUblResult.status } : {}),
        ...(xsdUblResult?.artifactInfo
          ? { artifactInfo: xsdUblResult.artifactInfo }
          : {})
      },
      xsdCii: {
        requested: requestedChecks.includes("xsd_cii"),
        configured: getBooleanSummaryValue(xsdCiiSummary, "configured"),
        validationExecuted: getBooleanSummaryValue(
          xsdCiiSummary,
          "validationExecuted"
        ),
        markedValid: getBooleanSummaryValue(xsdCiiSummary, "markedValid"),
        ...(getStringSummaryValue(xsdCiiSummary, "disclaimer")
          ? { disclaimer: getStringSummaryValue(xsdCiiSummary, "disclaimer") }
          : {}),
        ...(xsdCiiResult ? { status: xsdCiiResult.status } : {}),
        ...(xsdCiiSummary ? { summary: xsdCiiSummary } : {})
      },
      schematronPeppol: {
        requested:
          requestedChecks.includes("schematron_peppol") ||
          requestedChecks.includes("schematron_peppol_placeholder"),
        implemented: getImplementedSummaryValue(schematronPeppolSummary),
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
        schematronOrchestration:
          schematronPeppolSummary?.schematronOrchestration ?? undefined,
        workerSchematronOrchestratorVersion:
          schematronPeppolSummary?.workerSchematronOrchestratorVersion ??
          undefined,
        orchestrationMode:
          schematronPeppolSummary?.orchestrationMode ?? undefined,
        orchestrationStatus:
          schematronPeppolSummary?.orchestrationStatus ?? undefined,
        orchestrationReason:
          schematronPeppolSummary?.orchestrationReason ?? undefined,
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
        requested: requestedChecks.includes("schematron_en16931"),
        implemented: getImplementedSummaryValue(schematronEn16931Summary),
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
        schematronOrchestration:
          schematronEn16931Summary?.schematronOrchestration ?? undefined,
        workerSchematronOrchestratorVersion:
          schematronEn16931Summary?.workerSchematronOrchestratorVersion ??
          undefined,
        orchestrationMode:
          schematronEn16931Summary?.orchestrationMode ?? undefined,
        orchestrationStatus:
          schematronEn16931Summary?.orchestrationStatus ?? undefined,
        orchestrationReason:
          schematronEn16931Summary?.orchestrationReason ?? undefined,
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
    disclaimer: XML_WORKER_STUB_DISCLAIMER
  };
}
