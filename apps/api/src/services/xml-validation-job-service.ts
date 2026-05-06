import { createHash } from "node:crypto";
import {
  validateUblXsd,
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

export const XML_VALIDATION_JOB_CHECKS = [
  "worker_readiness",
  "xsd_ubl",
  "schematron_peppol_placeholder"
] as const;

export type XmlValidationJobCheck = (typeof XML_VALIDATION_JOB_CHECKS)[number];

export type XmlValidationJobCheckStatus =
  | "passed"
  | "failed"
  | "completed"
  | "not_configured"
  | "not_implemented"
  | "error";

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
      "The validation worker foundation accepted this XML for technical sandbox processing.",
    status: "completed",
    legalConfidence: "technical"
  };
}

function buildSchematronPlaceholderFinding(): XmlValidationJobFinding {
  return {
    code: "PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED",
    severity: "warning",
    checkType: "schematron_peppol_placeholder",
    field: "xml",
    message:
      "Peppol Schematron validation is planned but not active in this worker foundation step.",
    status: "not_implemented",
    legalConfidence: "educational_simulation",
    fixSuggestion:
      "Enable a future Schematron validation worker with local reviewed artefacts before using Peppol-style business-rule checks.",
    sourceLabels: ["Planned validation layer"]
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

function buildSchematronPlaceholderResult(): XmlValidationJobCheckResult {
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

function getXsdUblResult(
  checkResults: readonly XmlValidationJobCheckResult[]
) {
  return checkResults.find((result) => result.checkType === "xsd_ubl");
}

function getBooleanSummaryValue(
  summary: Record<string, unknown> | undefined,
  key: string
) {
  return summary?.[key] === true;
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
      const result = buildSchematronPlaceholderResult();
      failedChecks.push(check);
      checkResults.push(result);
      findings.push(...result.findings);
    }
  }

  const xsdUblResult = getXsdUblResult(checkResults);
  const xsdUblSummary = xsdUblResult?.summary;

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
      checkResults,
      checkStatuses: summarizeCheckStatuses(checkResults),
      activeValidation: {
        xsd: getBooleanSummaryValue(xsdUblSummary, "validationExecuted"),
        schematron: false,
        peppolArtifacts: false,
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
        ...(xsdUblResult ? { status: xsdUblResult.status } : {}),
        ...(xsdUblResult?.artifactInfo
          ? { artifactInfo: xsdUblResult.artifactInfo }
          : {})
      },
      schematronPeppol: {
        requested: input.requestedChecks.includes("schematron_peppol_placeholder"),
        implemented: false,
        validationExecuted: false,
        markedValid: false
      }
    },
    findings,
    disclaimer: XML_VALIDATION_JOB_DISCLAIMER
  };
}
