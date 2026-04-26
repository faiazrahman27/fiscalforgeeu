"use client";

import type { ChangeEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Database,
  FileCode2,
  FileInput,
  FileSearch,
  ShieldAlert,
  Trash2,
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
  id: string;
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

type ApiXmlUploadRecord = {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate?: string;
  currency?: string;
  apiStatus?: string;
  status: string;
  note: string;
  disclaimer?: string;
};

type ApiXmlUploadListResponse = {
  records?: ApiXmlUploadRecord[];
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
  record?: ApiXmlUploadRecord;
};

const MAX_XML_FILE_SIZE_BYTES = 1024 * 1024 * 2;

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

function formatDateTimeFromString(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return formatDateTime(parsedDate);
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

function isUploadStatus(value: unknown): value is UploadStatus {
  return value === "accepted" || value === "rejected";
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback: string
) {
  const value = record[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function buildFallbackUploadId(record: Record<string, unknown>) {
  const fileName = readStringField(record, "fileName", "unknown.xml");
  const uploadedAt = readStringField(record, "uploadedAt", "unknown-time");

  return `${fileName}-${uploadedAt}`.replaceAll(/\s+/g, "-").toLowerCase();
}

function normalizeUploadRecord(value: unknown): XmlUploadRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const uploadedAt = readStringField(
    record,
    "uploadedAt",
    new Date().toISOString()
  );

  return {
    id: readStringField(record, "id", buildFallbackUploadId(record)),
    fileName: readStringField(record, "fileName", "unknown.xml"),
    fileSize: readStringField(record, "fileSize", "0 B"),
    uploadedAt: formatDateTimeFromString(uploadedAt),
    detectedDocument: readStringField(record, "detectedDocument", "unknown"),
    rootElement: readStringField(record, "rootElement", "unknown"),
    invoiceId: readStringField(record, "invoiceId", "not_detected"),
    status: isUploadStatus(record.status) ? record.status : "rejected",
    note: readStringField(record, "note", "Stored API XML upload record.")
  };
}

function normalizeUploadStatus(apiStatus: string): UploadStatus {
  return apiStatus === "parsed" ? "accepted" : "rejected";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readResponseBody(response: Response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function getApiErrorMessage(data: unknown, fallback = "The XML request failed.") {
  if (typeof data === "string" && data.trim().length > 0) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim().length > 0
    ? message
    : fallback;
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "_").slice(0, 180);
}

export default function WorkspaceXmlUploadPage() {
  const [uploadHistory, setUploadHistory] = useState<XmlUploadRecord[]>([]);
  const [analysis, setAnalysis] = useState<XmlAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadLoadMessage, setUploadLoadMessage] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [deletingUploadId, setDeletingUploadId] = useState("");

  const acceptedUploads = useMemo(() => {
    return uploadHistory.filter((upload) => upload.status === "accepted").length;
  }, [uploadHistory]);

  const rejectedUploads = useMemo(() => {
    return uploadHistory.filter((upload) => upload.status === "rejected").length;
  }, [uploadHistory]);

  useEffect(() => {
    let isMounted = true;

    async function loadUploadHistory() {
      setIsLoadingUploads(true);
      setUploadLoadMessage("");

      try {
        const response = await fetch("/api/local/xml/uploads", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setUploadHistory([]);
            setUploadLoadMessage(
              getApiErrorMessage(
                responseData,
                "Could not load XML upload history."
              )
            );
          }

          return;
        }

        const apiData = responseData as ApiXmlUploadListResponse;
        const records = Array.isArray(apiData?.records) ? apiData.records : [];

        const normalizedRecords = records
          .map((item) => normalizeUploadRecord(item))
          .filter((item): item is XmlUploadRecord => item !== null);

        if (isMounted) {
          setUploadHistory(normalizedRecords);
        }
      } catch {
        if (isMounted) {
          setUploadHistory([]);
          setUploadLoadMessage(
            "Could not load XML upload history. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingUploads(false);
        }
      }
    }

    loadUploadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  async function inspectXmlWithApi(file: File, xmlText: string) {
    const response = await fetch("/api/local/xml/inspect", {
      method: "POST",
      headers: {
        "content-type": "application/xml",
        "x-file-name": sanitizeHeaderValue(file.name),
        "x-file-size": String(file.size)
      },
      body: xmlText
    });

    const responseData = await readResponseBody(response);

    if (!response.ok) {
      throw new Error(
        getApiErrorMessage(responseData, "The XML inspection request failed.")
      );
    }

    const apiData = responseData as ApiXmlInspectResponse;
    const uploadedAt = formatDateTime(new Date());
    const status = normalizeUploadStatus(apiData.status);

    const nextAnalysis: XmlAnalysis = {
      id: apiData.record?.id ?? apiData.uploadInspectionId,
      fileName: apiData.record?.fileName ?? file.name,
      fileSize: apiData.record?.fileSize ?? formatBytes(file.size),
      uploadedAt: apiData.record?.uploadedAt
        ? formatDateTimeFromString(apiData.record.uploadedAt)
        : uploadedAt,
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

    const normalizedApiRecord = normalizeUploadRecord(apiData.record);

    const nextRecord: XmlUploadRecord =
      normalizedApiRecord ?? {
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
    setUploadHistory((current) => {
      const nextRecords = [
        nextRecord,
        ...current.filter((upload) => upload.id !== nextRecord.id)
      ];

      return nextRecords.slice(0, 250);
    });
    setUploadLoadMessage("");
  }

  async function deleteUploadRecord(
    event: MouseEvent<HTMLButtonElement>,
    upload: XmlUploadRecord
  ) {
    event.preventDefault();
    event.stopPropagation();

    setDeletingUploadId(upload.id);
    setUploadLoadMessage("");

    try {
      const response = await fetch(
        `/api/local/xml/uploads/${encodeURIComponent(upload.id)}`,
        {
          method: "DELETE",
          cache: "no-store"
        }
      );

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setUploadLoadMessage(
          getApiErrorMessage(responseData, "Could not delete XML upload record.")
        );
        return;
      }

      setUploadHistory((current) =>
        current.filter((item) => item.id !== upload.id)
      );

      if (analysis?.id === upload.id) {
        setAnalysis(null);
      }
    } catch {
      setUploadLoadMessage(
        "Could not delete XML upload record. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setDeletingUploadId("");
    }
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
          <span>Records loaded from the API-owned XML upload history.</span>
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
3. Next.js route handler forwards XML and file metadata to apps/api
4. apps/api inspects root element and common invoice fields
5. apps/api stores the inspection record through the repository/storage boundary
6. workspace displays the API response and API-owned upload history

Backend endpoints:
POST   /api/v1/xml/inspect
GET    /api/v1/xml/uploads
DELETE /api/v1/xml/uploads/:id

Proxy endpoints:
POST   /api/local/xml/inspect
GET    /api/local/xml/uploads
DELETE /api/local/xml/uploads/:id`}</pre>

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
                <span>Next.js proxy -&gt; Invoice Lantern API</span>
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
            <h3>API-owned upload history</h3>
          </div>

          <div className="confidence-label">
            <FileInput size={17} />
            API history
          </div>
        </div>

        {uploadLoadMessage ? (
          <div className="alert-item">
            <span />
            <p>{uploadLoadMessage}</p>
          </div>
        ) : null}

        <div className="workspace-table">
          {isLoadingUploads ? (
            <div className="workspace-table-row">
              <div>
                <strong>Loading XML upload history</strong>
                <span>Reading records from the local API proxy.</span>
              </div>

              <div>
                <span className="status-pill">loading</span>
              </div>

              <div>
                <span>pending</span>
              </div>

              <strong>API</strong>

              <FileCode2 size={17} />
            </div>
          ) : uploadHistory.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No XML uploads yet</strong>
                <span>Upload an XML file to create an API-owned inspection record.</span>
              </div>

              <div>
                <span className="status-pill">empty</span>
              </div>

              <div>
                <span>waiting</span>
              </div>

              <strong>0 B</strong>

              <FileCode2 size={17} />
            </div>
          ) : (
            uploadHistory.map((upload) => (
              <div className="workspace-table-row" key={upload.id}>
                <div>
                  <strong>{upload.fileName}</strong>
                  <span>{upload.note}</span>

                  <button
                    type="button"
                    className="text-link-button"
                    onClick={(event) => deleteUploadRecord(event, upload)}
                    disabled={deletingUploadId === upload.id}
                    style={{
                      marginTop: "10px",
                      width: "fit-content",
                      padding: "8px 12px",
                      cursor:
                        deletingUploadId === upload.id ? "not-allowed" : "pointer"
                    }}
                  >
                    <Trash2 size={16} />
                    {deletingUploadId === upload.id
                      ? "Deleting..."
                      : "Delete upload"}
                  </button>
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
            ))
          )}
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
