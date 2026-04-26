import { randomUUID } from "node:crypto";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type XmlUploadStatus = "accepted" | "rejected";

export type XmlApiInspectionStatus = "parsed" | "review_required";

export type XmlUploadSummary = {
  technicalStatus: "passed" | "failed";
  readinessStatus: "ready_for_review" | "needs_attention" | "unsupported";
  findingsCount: number;
  sellerName: string;
  buyerName: string;
  lineCount: number;
  payableAmount: string;
  taxAmount: string;
  currency: string;
};

export type XmlUploadRecord = {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
  apiStatus: XmlApiInspectionStatus;
  status: XmlUploadStatus;
  note: string;
  disclaimer: string;
  summary?: XmlUploadSummary;
};

export type CreateXmlUploadRecordInput = {
  fileName: string;
  fileSize: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
  apiStatus: XmlApiInspectionStatus;
  disclaimer: string;
  summary: XmlUploadSummary;
};

const XML_UPLOADS_FILE = "xml-uploads.json";
const MAX_STORED_XML_UPLOADS = 250;
const storageProvider = getCollectionStorageProvider();

function sortXmlUploadsByUploadedAt(records: XmlUploadRecord[]) {
  return [...records].sort((first, second) =>
    second.uploadedAt.localeCompare(first.uploadedAt)
  );
}

function mapApiStatusToUploadStatus(
  apiStatus: XmlApiInspectionStatus
): XmlUploadStatus {
  return apiStatus === "parsed" ? "accepted" : "rejected";
}

function buildUploadNote(input: CreateXmlUploadRecordInput) {
  if (input.apiStatus !== "parsed") {
    return "XML structure requires review or uses an unsupported document root.";
  }

  if (input.summary.readinessStatus === "ready_for_review") {
    return "Readiness simulation completed without blocking findings.";
  }

  return `Readiness simulation completed with ${input.summary.findingsCount} finding(s).`;
}

export async function listXmlUploadRecords() {
  const records =
    await storageProvider.readCollection<XmlUploadRecord>(XML_UPLOADS_FILE);

  return sortXmlUploadsByUploadedAt(records);
}

export async function createXmlUploadRecord(
  input: CreateXmlUploadRecordInput
): Promise<XmlUploadRecord> {
  const record: XmlUploadRecord = {
    id: `xml_${randomUUID()}`,
    fileName: input.fileName,
    fileSize: input.fileSize,
    uploadedAt: new Date().toISOString(),
    detectedDocument: input.detectedDocument,
    rootElement: input.rootElement,
    invoiceId: input.invoiceId,
    issueDate: input.issueDate,
    currency: input.currency,
    apiStatus: input.apiStatus,
    status: mapApiStatusToUploadStatus(input.apiStatus),
    note: buildUploadNote(input),
    disclaimer: input.disclaimer,
    summary: input.summary
  };

  const currentRecords = await listXmlUploadRecords();
  const nextRecords = [record, ...currentRecords].slice(
    0,
    MAX_STORED_XML_UPLOADS
  );

  await storageProvider.writeCollection(XML_UPLOADS_FILE, nextRecords);

  return record;
}

export async function deleteXmlUploadRecordById(id: string) {
  const records = await listXmlUploadRecords();
  const nextRecords = records.filter((record) => record.id !== id);

  if (nextRecords.length === records.length) {
    return false;
  }

  await storageProvider.writeCollection(XML_UPLOADS_FILE, nextRecords);

  return true;
}
