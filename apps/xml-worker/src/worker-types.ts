export type XmlWorkerCheck =
  | "worker_readiness"
  | "xsd_ubl_placeholder"
  | "schematron_peppol_placeholder";

export type XmlWorkerFinding = {
  code: string;
  severity: "info" | "warning" | "fatal";
  checkType: XmlWorkerCheck;
  field: string;
  message: string;
  status: "completed" | "not_implemented";
  legalConfidence: "technical" | "educational_simulation";
};

export type XmlWorkerRequest = {
  xml: string;
  requestedChecks: XmlWorkerCheck[];
};

export type XmlWorkerResult = {
  status: "completed";
  checkType: "worker_readiness";
  rootElement: string;
  documentType: string;
  xmlSizeBytes: number;
  completedChecks: XmlWorkerCheck[];
  failedChecks: XmlWorkerCheck[];
  findings: XmlWorkerFinding[];
  resultSummary: Record<string, unknown>;
  disclaimer: string;
};
