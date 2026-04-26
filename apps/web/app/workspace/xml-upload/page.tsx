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
  currency: string;
  apiStatus: string;
  status: UploadStatus;
  note: string;
  preview: string;
};

type ApiXmlInspectResponse = {
  uploadInspectionId: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
  status: string;
  disclaimer: string;
};

const XML_UPLOAD_STORAGE_KEY = "Invoice Lantern.eu.workspace.xmlUploads";
const MAX_XML_FILE_SIZE_BYTES = 1024 * 1024 * 2;

const defaultUploadHistory: XmlUploadRecord[] = [
  {
    id: "xml_001",
    fileName: "sample-peppol-invoice.xml",
    fileSize: "42.6 KB",
    uploadedAt: "2026-04-24 17:20",
    detectedDocument: "invoice",
    rootElement: "Invoice",
    invoiceId: "FF-2026-001",
    status: "accepted",
    note: "Backend inspection structure preview."
  },
  {
    id: "xml_002",
    fileName: "supplier-credit-note.xml",
    fileSize: "31.2 KB",
    uploadedAt: "2026-04-23 13:08",
    detectedDocument: "credit_note",
    rootElement: "CreditNote",
    invoiceId: "CN-2026-002",
    status: "accepted",
    note: "Detected XML structure. Official validation not performed."
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

function normalizeUploadStatus(apiStatus: string): UploadStatus {
  return apiStatus === "parsed" ? "accepted" : "rejected";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getApiErrorMessage(data: unknown) {
  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return "The XML inspection request failed.";
  }

  const message = data.error.message;

  return typeof message === "string"
    ? message
    : "The XML inspection request failed.";
}

export default function WorkspaceXmlUploadPage() {
  const [uploadHistory, setUploadHistory] =
    useState<XmlUploadRecord[]>(defaultUploadHistory);
  const [analysis, setAnalysis] = useState<XmlAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
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

  async function inspectXmlWithApi(file: File, xmlText: string) {
    const response = await fetch("/api/local/xml/inspect", {
      method: "POST",
      headers: {
        "content-type": "application/xml"
      },
      body: xmlText
    });

    const responseData: unknown = await response.json();

    if (!response.ok) {
      throw new Error(getApiErrorMessage(responseData));
    }

    const apiData = responseData as ApiXmlInspectResponse;
    const uploadedAt = formatDateTime(new Date());
    const status = normalizeUploadStatus(apiData.status);

    const nextAnalysis: XmlAnalysis = {
      fileName: file.name,
      fileSize: formatBytes(file.size),
      uploadedAt,
      detectedDocument: apiData.detectedDocument,
      rootElement: apiData.rootElement,
      invoiceId: apiData.invoiceId,
      issueDate: apiData.issueDate,
      currency: apiData.currency,
      apiStatus: apiData.status,
      status,
      note: apiData.disclaimer,
      preview: xmlText.slice(0, 1400)
    };

    const nextRecord: XmlUploadRecord = {
      id: apiData.uploadInspectionId,
      fileName: nextAnalysis.fileName,
      fileSize: nextAnalysis.fileSize,
      uploadedAt: nextAnalysis.uploadedAt,
      detectedDocument: nextAnalysis.detectedDocument,
      rootElement: nextAnalysis.rootElement,
      invoiceId: nextAnalysis.invoiceId,
      status: nextAnalysis.status,
      note:
        status === "accepted"
          ? "Inspected through local API proxy."
          : "API returned review-required or unsupported XML status."
    };

    setAnalysis(nextAnalysis);
    setUploadHistory((current) => [nextRecord, ...current].slice(0, 8));
  }

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

    setIsInspecting(true);

    try {
      const xmlText = await file.text();
      await inspectXmlWithApi(file, xmlText);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not inspect XML. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsInspecting(false);
      event.target.value = "";
    }
  }

  function clearAnalysis() {
    setAnalysis(null);
    setErrorMessage("");
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">XML Upload</p>
        <h2>Inspect invoice XML through the local API.</h2>
        <p>
          Upload a local XML file to preview document structure, root element,
          invoice ID, issue date, currency, and parsing readiness. The browser sends
          the XML through the Next.js proxy into the dedicated Invoice Lantern API.
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
          <span>Files that the API inspection classified as parseable.</span>
        </div>

        <div className="workspace-stat">
          <p>Rejected</p>
          <strong>{rejectedUploads}</strong>
          <span>Invalid, unsupported, or review-required XML entries.</span>
        </div>

        <div className="workspace-stat">
          <p>Max size</p>
          <strong>2MB</strong>
          <span>Frontend limit before production upload storage exists.</span>
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
            {isInspecting ? "Inspecting..." : "Select XML"}
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={handleFileChange}
              style={{ display: "none" }}
              disabled={isInspecting}
            />
          </label>
        </div>

        <pre>{`Current flow:
1. select .xml file
2. browser checks file extension and size
3. Next.js route handler forwards XML to apps/api
4. apps/api inspects root element and common invoice fields
5. workspace displays the API response

Backend endpoint:
POST /api/v1/xml/inspect

Proxy endpoint:
POST /api/local/xml/inspect`}</pre>

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
              <p>API XML metadata</p>
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

              <strong>{analysis.apiStatus}</strong>

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

              <strong>{analysis.currency}</strong>

              <Database size={17} />
            </div>

            <div className="workspace-table-row">
              <div>
                <strong>Inspection source</strong>
                <span>Next.js proxy â†’ Invoice Lantern API</span>
              </div>

              <div>
                <span>Mode</span>
              </div>

              <div>
                <span>local development</span>
              </div>

              <strong>API</strong>

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
              API inspected
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
            <h3>Inspection only, not official validation.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              The API inspection endpoint detects basic XML structure only. It does not
              perform official XML, Peppol, EN 16931, ViDA, legal, tax, or authority
              validation.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              A production upload pipeline must include authentication, object
              authorization, hardened XML parsing, schema validation, malware-safe file
              handling, audit logging, and retention controls.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              Do not upload sensitive real invoices until storage, privacy controls,
              authentication, and retention policies are implemented.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

