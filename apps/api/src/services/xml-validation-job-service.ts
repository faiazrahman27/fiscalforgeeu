import { createHash } from "node:crypto";
import type { XmlSafetyInspection } from "@invoice-lantern/ubl";

export const XML_VALIDATION_JOB_DISCLAIMER =
  "This XML validation job is a technical sandbox worker-readiness result. Real XSD, Schematron, Peppol, and EN 16931 validation are not enabled yet.";

export const XML_VALIDATION_JOB_WORKER_NAME = "invoice-lantern-xml-worker-stub";
export const XML_VALIDATION_JOB_WORKER_VERSION = "0.1.0";

export const XML_VALIDATION_JOB_CHECKS = [
  "worker_readiness",
  "xsd_ubl_placeholder",
  "schematron_peppol_placeholder"
] as const;

export type XmlValidationJobCheck = (typeof XML_VALIDATION_JOB_CHECKS)[number];

export type XmlValidationJobFinding = {
  code: string;
  severity: "info" | "warning" | "fatal";
  checkType: XmlValidationJobCheck;
  field: string;
  message: string;
  status: "completed" | "not_implemented";
  legalConfidence: "technical" | "educational_simulation";
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
      "The validation worker foundation accepted this XML for technical sandbox processing. Real XSD/Schematron validation is not enabled yet.",
    status: "completed",
    legalConfidence: "technical"
  };
}

function buildPlaceholderFinding(
  checkType: Exclude<XmlValidationJobCheck, "worker_readiness">
): XmlValidationJobFinding {
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
        ? "UBL XSD validation is planned but not active in this worker foundation step."
        : "Peppol Schematron validation is planned but not active in this worker foundation step.",
    status: "not_implemented",
    legalConfidence: "educational_simulation"
  };
}

export function buildXmlValidationJobCompletion(input: {
  xmlSha256: string;
  xmlSizeBytes: number;
  requestedChecks: readonly XmlValidationJobCheck[];
  safety: XmlSafetyInspection;
  rootElement: string;
  documentType: string;
}): XmlValidationJobCompletion {
  const completedChecks: XmlValidationJobCheck[] = [];
  const failedChecks: XmlValidationJobCheck[] = [];
  const findings: XmlValidationJobFinding[] = [];

  if (input.requestedChecks.includes("worker_readiness")) {
    completedChecks.push("worker_readiness");
    findings.push(buildWorkerReadinessFinding());
  }

  for (const check of input.requestedChecks) {
    if (check === "worker_readiness") {
      continue;
    }

    failedChecks.push(check);
    findings.push(buildPlaceholderFinding(check));
  }

  return {
    completedChecks,
    failedChecks,
    workerName: XML_VALIDATION_JOB_WORKER_NAME,
    workerVersion: XML_VALIDATION_JOB_WORKER_VERSION,
    resultSummary: {
      checkType: "worker_readiness",
      workerReady: true,
      xmlSha256: input.xmlSha256,
      xmlSizeBytes: input.xmlSizeBytes,
      rootElement: input.rootElement,
      documentType: input.documentType,
      safetyPolicyPassed: input.safety.safe,
      requestedChecks: input.requestedChecks,
      completedChecks,
      failedChecks,
      inactiveChecks: failedChecks,
      activeValidation: {
        xsd: false,
        schematron: false,
        peppolArtifacts: false,
        en16931Certification: false
      }
    },
    findings,
    disclaimer: XML_VALIDATION_JOB_DISCLAIMER
  };
}
