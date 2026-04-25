"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Database,
  FileCode2,
  FileInput,
  FileSearch,
  ShieldAlert,
  Upload,
  X
} from "lucide-react";

type UploadStatus = "accepted" | "rejected";

type XmlUploadRecord = {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  status: UploadStatus;
  note: string;
};

type XmlAnalysis = {
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  supplierName: string;
  customerName: string;
  status: UploadStatus;
  note: string;
  preview: string;
};

const XML_UPLOAD_STORAGE_KEY = "fiscalforge.eu.workspace.xmlUploads";
const MAX_XML_FILE_SIZE_BYTES = 1024 * 1024 * 2;

const defaultUploadHistory: XmlUploadRecord[] = [
  {
    id: "xml_001",
    fileName: "sample-peppol-invoice.xml",
    fileSize: "42.6 KB",
    uploadedAt: "2026-04-24 17:20",
    detectedDocument: "Invoice",
    rootElement: "Invoice",
    invoiceId: "FF-2026-001",
    status: "accepted",
    note: "Local preview only. No official validation performed."
  },
  {
    id: "xml_002",
    fileName: "supplier-credit-note.xml",
    fileSize: "31.2 KB",
    uploadedAt: "2026-04-23 13:08",
    detectedDocument: "Credit note",
    rootElement: "CreditNote",
    invoiceId: "CN-2026-002",
    status: "accepted",
    note: "Detected XML structure. Backend parser not connected yet."
  }
];

function formatDateTime(date: Date) {
  return date
    .toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
    .replace("T", " ");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function readStoredUploads() {
  if (typeof window === "undefined") {
    return defaultUploadHistory;
  }

  const storedValue = window.localStorage.getItem(XML_UPLOAD_STORAGE_KEY);

  if (!storedValue) {
    return defaultUploadHistory;
  }

  try {
    const parsed = JSON.parse(storedValue);

    if (!Array.isArray(parsed)) {
      return defaultUploadHistory;
    }

    return parsed as XmlUploadRecord[];
  } catch {
    return defaultUploadHistory;
  }
}

function getFirstTextValue(document: Document, tagName: string) {
  const direct = document.getElementsByTagName(tagName)[0];

  if (direct?.textContent?.trim()) {
    return direct.textContent.trim();
  }

  const namespaced = Array.from(document.getElementsByTagName("*")).find(
    (element) => element.localName === tagName
  );

  return namespaced?.textContent?.trim() || "Not detected";
}

function detectDocumentType(rootElement: string) {
  const normalizedRoot = rootElement.toLowerCase();

  if (normalizedRoot.includes("creditnote")) {
    return "Credit note";
  }

  if (normalizedRoot.includes("invoice")) {
    return "Invoice";
  }

  return "Unknown XML document";
}

function analyzeXmlFile(file: File, xmlText: string): XmlAnalysis {
  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(xmlText, "application/xml");
  const parserError = parsedDocument.getElementsByTagName("parsererror")[0];

  if (parserError) {
    return {
      fileName: file.name,
      fileSize: formatBytes(file.size),
      uploadedAt: formatDateTime(new Date()),
      detectedDocument: "Invalid XML",
      rootElement: "Parser error",
      invoiceId: "Not detected",
      issueDate: "Not detected",
      supplierName: "Not detected",
      customerName: "Not detected",
      status: "rejected",
      note: "The uploaded file could not be parsed as XML.",
      preview: xmlText.slice(0, 1400)
    };
  }

  const rootElement = parsedDocument.documentElement?.localName || "Unknown";
  const detectedDocument = detectDocumentType(rootElement);
  const invoiceId = getFirstTextValue(parsedDocument, "ID");
  const issueDate = getFirstTextValue(parsedDocument, "IssueDate");
  const supplierName =
    getFirstTextValue(parsedDocument, "RegistrationName") ||
    getFirstTextValue(parsedDocument, "Name");
  const customerName = getFirstTextValue(parsedDocument, "CustomerAssignedAccountID");

  return {
    fileName: file.name,
    fileSize: formatBytes(file.size),
    uploadedAt: formatDateTime(new Date()),
    detectedDocument,
    rootElement,
    invoiceId,
    issueDate,
    supplierName,
    customerName,
    status: detectedDocument === "Unknown XML document" ? "rejected" : "accepted",
    note:
      detectedDocument === "Unknown XML document"
        ? "The file is valid XML, but it does not look like a supported invoice document yet."
        : "XML structure detected. This is still a browser-side preview, not official validation.",
    preview: xmlText.slice(0, 1400)
  };
}

export default function WorkspaceXmlUploadPage() {
  const [uploadHistory, setUploadHistory] =
    useState<XmlUploadRecord[]>(defaultUploadHistory);
  const [analysis, setAnalysis] = useState<XmlAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  const acceptedUploads = useMemo(() => {
    return uploadHistory.filter((upload) => upload.status === "accepted").length;
  }, [uploadHistory]);

  const rejectedUploads = useMemo(() => {
    return uploadHistory.filter((upload) => upload.status === "rejected").length;
  }, [uploadHistory]);

  useEffect(() => {
    setUploadHistory(readStoredUploads());
    setHasLoadedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    window.localStorage.setItem(
      XML_UPLOAD_STORAGE_KEY,
      JSON.stringify(uploadHistory)
    );
  }, [uploadHistory, hasLoadedStorage]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setErrorMessage("");
    setAnalysis(null);

    if (!file) {
      return;
    }

    const isXmlByName = file.name.toLowerCase().endsWith(".xml");
    const isXmlByType =
      file.type === "text/xml" ||
      file.type === "application/xml" ||
      file.type === "";

    if (!isXmlByName || !isXmlByType) {
      setErrorMessage("Upload rejected. Please select a valid .xml file.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_XML_FILE_SIZE_BYTES) {
      setErrorMessage("Upload rejected. XML file size must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    const xmlText = await file.text();
    const nextAnalysis = analyzeXmlFile(file, xmlText);

    setAnalysis(nextAnalysis);

    const nextRecord: XmlUploadRecord = {
      id: `xml_${Date.now()}`,
      fileName: nextAnalysis.fileName,
      fileSize: nextAnalysis.fileSize,
      uploadedAt: nextAnalysis.uploadedAt,
      detectedDocument: nextAnalysis.detectedDocument,
      rootElement: nextAnalysis.rootElement,
      invoiceId: nextAnalysis.invoiceId,
      status: nextAnalysis.status,
      note: nextAnalysis.note
    };

    setUploadHistory((current) => [nextRecord, ...current].slice(0, 8));
    event.target.value = "";
  }

  function clearAnalysis() {
    setAnalysis(null);
    setErrorMessage("");
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">XML Upload</p>
        <h2>Inspect invoice XML before backend validation.</h2>
        <p>
          Upload a local XML file to preview document structure, detected root element,
          invoice ID, file size, and parsing readiness. This page does not send files to
          a server yet.
        </p>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Recent uploads</p>
          <strong>{uploadHistory.length}</strong>
          <span>Stored locally in this browser for interface testing.</span>
        </div>

        <div className="workspace-stat">
          <p>Accepted</p>
          <strong>{acceptedUploads}</strong>
          <span>Files that looked parseable as invoice-like XML.</span>
        </div>

        <div className="workspace-stat">
          <p>Rejected</p>
          <strong>{rejectedUploads}</strong>
          <span>Invalid XML or unsupported document structure.</span>
        </div>

        <div className="workspace-stat">
          <p>Max size</p>
          <strong>2MB</strong>
          <span>Local browser-side limit before the real API exists.</span>
        </div>
      </section>

      <section className="developer-console">
        <div className="developer-console-head">
          <div>
            <p>Local XML file</p>
            <h3>Upload invoice XML</h3>
          </div>

          <label className="text-link-button">
            <Upload size={16} />
            Select XML
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>
        </div>

        <pre>{`Accepted input:
- .xml files only
- maximum 2 MB
- parsed locally in the browser
- not uploaded to any server yet

Future backend flow:
1. upload XML
2. validate schema
3. parse canonical invoice fields
4. run standards/country simulations
5. produce validation report`}</pre>

        {errorMessage ? (
          <div className="alert-item">
            <span />
            <p>{errorMessage}</p>
          </div>
        ) : null}
      </section>

      {analysis ? (
        <section className="workspace-table-shell">
          <div className="workspace-table-head">
            <div>
              <p>Detected XML metadata</p>
              <h3>{analysis.fileName}</h3>
            </div>

            <button type="button" onClick={clearAnalysis}>
              <X size={16} />
              Clear preview
            </button>
          </div>

          <div className="workspace-table">
            <div className="workspace-table-row">
              <div>
                <strong>Detected document</strong>
                <span>{analysis.detectedDocument}</span>
              </div>

              <div>
                <FileCode2 size={15} />
                <span>{analysis.rootElement}</span>
              </div>

              <div>
                <span>{analysis.uploadedAt}</span>
              </div>

              <strong>{analysis.status}</strong>

              {analysis.status === "accepted" ? (
                <BadgeCheck size={17} />
              ) : (
                <AlertTriangle size={17} />
              )}
            </div>

            <div className="workspace-table-row">
              <div>
                <strong>Invoice ID</strong>
                <span>{analysis.invoiceId}</span>
              </div>

              <div>
                <span>{analysis.issueDate}</span>
              </div>

              <div>
                <span>{analysis.fileSize}</span>
              </div>

              <strong>local</strong>

              <Database size={17} />
            </div>

            <div className="workspace-table-row">
              <div>
                <strong>Supplier</strong>
                <span>{analysis.supplierName}</span>
              </div>

              <div>
                <span>Customer</span>
              </div>

              <div>
                <span>{analysis.customerName}</span>
              </div>

              <strong>preview</strong>

              <FileSearch size={17} />
            </div>
          </div>
        </section>
      ) : null}

      {analysis ? (
        <section className="developer-console">
          <div className="developer-console-head">
            <div>
              <p>XML preview</p>
              <h3>First 1,400 characters</h3>
            </div>

            <div className="confidence-label">
              <FileSearch size={17} />
              browser-side parse
            </div>
          </div>

          <pre>{analysis.preview}</pre>
        </section>
      ) : null}

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Recent XML uploads</p>
            <h3>Local upload history</h3>
          </div>

          <div className="confidence-label">
            <FileInput size={17} />
            local records
          </div>
        </div>

        <div className="workspace-table">
          {uploadHistory.map((upload) => (
            <div className="workspace-table-row" key={upload.id}>
              <div>
                <strong>{upload.fileName}</strong>
                <span>{upload.note}</span>
              </div>

              <div>
                <span className="status-pill">{upload.status}</span>
              </div>

              <div>
                <span>{upload.detectedDocument}</span>
              </div>

              <strong>{upload.fileSize}</strong>

              <FileCode2 size={17} />
            </div>
          ))}
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />

          <div>
            <p>Safety notice</p>
            <h3>No server upload yet.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              Files are parsed locally in the browser for UI testing. This does not
              represent official XML, Peppol, EN 16931, ViDA, legal, tax, or authority
              validation.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              The future API must enforce file-size limits, MIME checks, XML parser
              hardening, schema validation, audit logging, rate limits, and object
              authorization.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              Do not upload sensitive real invoices until authentication, backend
              storage rules, retention controls, and privacy notices are implemented.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
