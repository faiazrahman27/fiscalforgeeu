import type { SchematronLayer, UblXsdArtifactInfo } from "@invoice-lantern/ubl";

export type XmlWorkerCheck =
  | "worker_readiness"
  | "xsd_ubl"
  | "schematron_peppol_placeholder";

export type XmlWorkerCheckStatus =
  | "passed"
  | "failed"
  | "warning"
  | "completed"
  | "not_configured"
  | "not_implemented"
  | "error";

export type XmlWorkerFindingSeverity = "info" | "warning" | "fatal";

export type XmlWorkerLegalConfidence =
  | "technical"
  | "educational_simulation";

export type XmlWorkerFinding = {
  code: string;
  severity: XmlWorkerFindingSeverity;
  checkType: XmlWorkerCheck;
  field: string;
  message: string;
  status: XmlWorkerCheckStatus;
  legalConfidence: XmlWorkerLegalConfidence;
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

export type XmlWorkerRequest = {
  xml: string;
  requestedChecks: XmlWorkerCheck[];
};

export type XmlWorkerArtifactInfo = UblXsdArtifactInfo;

export type XmlWorkerCheckResult = {
  checkType: XmlWorkerCheck;
  status: XmlWorkerCheckStatus;
  durationMs?: number;
  artifactInfo?: XmlWorkerArtifactInfo;
  findings: XmlWorkerFinding[];
  summary?: Record<string, unknown>;
};

export type XmlWorkerResult = {
  status: "completed" | "failed";
  rootElement: string;
  documentType: string;
  xmlSizeBytes: number;
  completedChecks: XmlWorkerCheck[];
  failedChecks: XmlWorkerCheck[];
  checkResults: XmlWorkerCheckResult[];
  findings: XmlWorkerFinding[];
  resultSummary: Record<string, unknown>;
  disclaimer: string;
};
