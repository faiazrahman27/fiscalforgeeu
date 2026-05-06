import { inspectXmlSafety } from "@invoice-lantern/ubl";
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

function buildUblXsdNotConfiguredFinding(): XmlWorkerFinding {
  return {
    code: "UBL_XSD_NOT_CONFIGURED",
    severity: "warning",
    checkType: "xsd_ubl",
    field: "xml",
    message:
      "UBL XSD validation was requested, but local UBL XSD artefacts are not configured in this environment. The XML has not been marked as XSD-valid.",
    status: "not_configured",
    legalConfidence: "technical",
    fixSuggestion:
      "Configure local UBL 2.1 XSD artefact paths in the XML worker environment before relying on technical UBL XSD validation.",
    sourceLabels: ["Local UBL XSD artefacts required"]
  };
}

function buildSchematronPlaceholderFinding(): XmlWorkerFinding {
  return {
    code: "PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED",
    severity: "warning",
    checkType: "schematron_peppol_placeholder",
    field: "xml",
    message:
      "Peppol Schematron validation is planned but not active in this worker foundation.",
    status: "not_implemented",
    legalConfidence: "educational_simulation",
    fixSuggestion:
      "Enable a future Schematron validation worker with local reviewed artefacts before using Peppol-style business-rule checks.",
    sourceLabels: ["Planned validation layer"]
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

function buildUblXsdNotConfiguredResult(): XmlWorkerCheckResult {
  const finding = buildUblXsdNotConfiguredFinding();

  return {
    checkType: "xsd_ubl",
    status: "not_configured",
    artifactInfo: {
      configured: false,
      validatorName: "Invoice Lantern XML worker UBL XSD adapter"
    },
    findings: [finding],
    summary: {
      configured: false,
      validationExecuted: false,
      markedValid: false,
      reason: "local_ubl_xsd_artifacts_not_configured"
    }
  };
}

function buildSchematronPlaceholderResult(): XmlWorkerCheckResult {
  const finding = buildSchematronPlaceholderFinding();

  return {
    checkType: "schematron_peppol_placeholder",
    status: "not_implemented",
    findings: [finding],
    summary: {
      implemented: false,
      validationExecuted: false,
      markedValid: false,
      reason: "schematron_peppol_not_implemented"
    }
  };
}

function summarizeCheckStatuses(checkResults: readonly XmlWorkerCheckResult[]) {
  return checkResults.reduce<Record<string, string>>((summary, result) => {
    summary[result.checkType] = result.status;
    return summary;
  }, {});
}

export function runStubXmlValidator(
  request: XmlWorkerRequest
): XmlWorkerResult {
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
      const result = buildUblXsdNotConfiguredResult();
      completedChecks.push(check);
      checkResults.push(result);
      findings.push(...result.findings);
      continue;
    }

    if (check === "schematron_peppol_placeholder") {
      const result = buildSchematronPlaceholderResult();
      failedChecks.push(check);
      checkResults.push(result);
      findings.push(...result.findings);
    }
  }

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
        xsd: false,
        schematron: false,
        peppolArtifacts: false,
        en16931Certification: false
      },
      xsdUbl: {
        requested: requestedChecks.includes("xsd_ubl"),
        configured: false,
        validationExecuted: false,
        markedValid: false
      },
      schematronPeppol: {
        requested: requestedChecks.includes("schematron_peppol_placeholder"),
        implemented: false,
        validationExecuted: false,
        markedValid: false
      }
    },
    disclaimer: XML_WORKER_STUB_DISCLAIMER
  };
}
