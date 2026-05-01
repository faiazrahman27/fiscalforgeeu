import { inspectXmlSafety } from "@invoice-lantern/ubl";
import type {
  XmlWorkerCheck,
  XmlWorkerFinding,
  XmlWorkerRequest,
  XmlWorkerResult
} from "./worker-types.js";

export const XML_WORKER_STUB_DISCLAIMER =
  "This XML validation job is a technical sandbox worker-readiness result. Real XSD, Schematron, Peppol, and EN 16931 validation are not enabled yet.";

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
      "Real XSD/Schematron validation is not enabled yet. The worker foundation completed a technical readiness stub only.",
    status: "completed",
    legalConfidence: "technical"
  };
}

function buildPlaceholderFinding(
  checkType: Exclude<XmlWorkerCheck, "worker_readiness">
): XmlWorkerFinding {
  return {
    code:
      checkType === "xsd_ubl_placeholder"
        ? "UBL_XSD_VALIDATION_NOT_ENABLED"
        : "PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED",
    severity: "warning",
    checkType,
    field: "xml",
    message:
      checkType === "xsd_ubl_placeholder"
        ? "UBL XSD validation is planned but not active in this worker foundation."
        : "Peppol Schematron validation is planned but not active in this worker foundation.",
    status: "not_implemented",
    legalConfidence: "educational_simulation"
  };
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
  const findings: XmlWorkerFinding[] = [];

  if (requestedChecks.includes("worker_readiness")) {
    completedChecks.push("worker_readiness");
    findings.push(buildWorkerReadinessFinding());
  }

  for (const check of requestedChecks) {
    if (check === "worker_readiness") {
      continue;
    }

    failedChecks.push(check);
    findings.push(buildPlaceholderFinding(check));
  }

  return {
    status: "completed",
    checkType: "worker_readiness",
    rootElement,
    documentType,
    xmlSizeBytes,
    completedChecks,
    failedChecks,
    findings,
    resultSummary: {
      checkType: "worker_readiness",
      workerReady: true,
      safetyPolicyPassed: safety.safe,
      rootElement,
      documentType,
      xmlSizeBytes,
      requestedChecks,
      completedChecks,
      failedChecks,
      activeValidation: {
        xsd: false,
        schematron: false,
        peppolArtifacts: false,
        en16931Certification: false
      }
    },
    disclaimer: XML_WORKER_STUB_DISCLAIMER
  };
}
