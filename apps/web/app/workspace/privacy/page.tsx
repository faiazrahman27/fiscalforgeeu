"use client";

import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  EyeOff,
  FileClock,
  LockKeyhole,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2
} from "lucide-react";

type RetentionMode = "manual" | "scheduled";

type WorkspaceSettings = {
  retentionMode: RetentionMode;
  invoiceDraftRetentionDays: number;
  validationRunRetentionDays: number;
  xmlReportRetentionDays: number;
  activityLogRetentionDays: number;
  allowDataExportRequests: boolean;
  allowDeletionRequests: boolean;
  updatedAt: string;
};

type PrivacyRequestType = "data_export" | "deletion" | "retention_review";

type PrivacyRequestStatus = "submitted" | "in_review" | "completed" | "rejected";

type WorkspacePrivacyRequest = {
  id: string;
  requestType: PrivacyRequestType;
  status: PrivacyRequestStatus;
  subject: string;
  details: string;
  requesterEmail: string;
  reviewNote: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
};

type PrivacyRequestReviewDraft = {
  status: PrivacyRequestStatus;
  reviewNote: string;
};

type PrivacyControlCard = {
  title: string;
  description: string;
  icon: ReactNode;
};

const defaultWorkspaceSettings: WorkspaceSettings = {
  retentionMode: "manual",
  invoiceDraftRetentionDays: 365,
  validationRunRetentionDays: 365,
  xmlReportRetentionDays: 180,
  activityLogRetentionDays: 365,
  allowDataExportRequests: true,
  allowDeletionRequests: true,
  updatedAt: ""
};

const privacyControls: PrivacyControlCard[] = [
  {
    title: "Data export requests",
    description:
      "Prepare a workspace-level control for user-requested data exports across invoice drafts, validation reports, XML reports, and activity records.",
    icon: <Download size={22} />
  },
  {
    title: "Deletion requests",
    description:
      "Prepare deletion-request handling for workspace-owned records while preserving clear audit boundaries and future retention rules.",
    icon: <Trash2 size={22} />
  },
  {
    title: "Retention policy",
    description:
      "Control how long invoice drafts, validation reports, XML readiness reports, and activity events should remain available.",
    icon: <Archive size={22} />
  },
  {
    title: "Data minimisation",
    description:
      "Keep the platform focused on structured invoice readiness data instead of storing unnecessary personal or document data.",
    icon: <EyeOff size={22} />
  }
];

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

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback: number
) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return fallback;
}

function readBooleanField(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  const value = record[key];

  return typeof value === "boolean" ? value : fallback;
}

function normalizeRetentionMode(value: string): RetentionMode {
  return value === "scheduled" ? "scheduled" : "manual";
}

function normalizePrivacyRequestType(value: string): PrivacyRequestType {
  if (value === "deletion" || value === "retention_review") {
    return value;
  }

  return "data_export";
}

function normalizePrivacyRequestStatus(value: string): PrivacyRequestStatus {
  if (value === "in_review" || value === "completed" || value === "rejected") {
    return value;
  }

  return "submitted";
}

function clampRetentionDays(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(3650, Math.round(value)));
}

function getSettingsRecordFromResponse(data: unknown) {
  if (!isPlainObject(data)) {
    return null;
  }

  if (isPlainObject(data.record)) {
    return data.record;
  }

  if (isPlainObject(data.settings)) {
    return data.settings;
  }

  return data;
}

function getRecordsFromResponse(data: unknown) {
  if (!isPlainObject(data) || !Array.isArray(data.records)) {
    return [];
  }

  return data.records;
}

function normalizeWorkspaceSettings(data: unknown): WorkspaceSettings {
  const record = getSettingsRecordFromResponse(data);

  if (!record) {
    return defaultWorkspaceSettings;
  }

  return {
    retentionMode: normalizeRetentionMode(
      readStringField(record, "retentionMode", defaultWorkspaceSettings.retentionMode)
    ),
    invoiceDraftRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "invoiceDraftRetentionDays",
        defaultWorkspaceSettings.invoiceDraftRetentionDays
      )
    ),
    validationRunRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "validationRunRetentionDays",
        defaultWorkspaceSettings.validationRunRetentionDays
      )
    ),
    xmlReportRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "xmlReportRetentionDays",
        defaultWorkspaceSettings.xmlReportRetentionDays
      )
    ),
    activityLogRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "activityLogRetentionDays",
        defaultWorkspaceSettings.activityLogRetentionDays
      )
    ),
    allowDataExportRequests: readBooleanField(
      record,
      "allowDataExportRequests",
      defaultWorkspaceSettings.allowDataExportRequests
    ),
    allowDeletionRequests: readBooleanField(
      record,
      "allowDeletionRequests",
      defaultWorkspaceSettings.allowDeletionRequests
    ),
    updatedAt: readStringField(record, "updatedAt")
  };
}

function normalizeWorkspacePrivacyRequest(
  value: unknown
): WorkspacePrivacyRequest | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const requestType = normalizePrivacyRequestType(
    readStringField(value, "requestType")
  );
  const status = normalizePrivacyRequestStatus(readStringField(value, "status"));
  const subject = readStringField(value, "subject");
  const details = readStringField(value, "details");
  const requesterEmail = readStringField(value, "requesterEmail");
  const reviewNote = readStringField(value, "reviewNote");
  const completedAt = readStringField(value, "completedAt");
  const createdAt = readStringField(value, "createdAt");
  const updatedAt = readStringField(value, "updatedAt");

  if (!id || !subject || !createdAt) {
    return null;
  }

  return {
    id,
    requestType,
    status,
    subject,
    details,
    requesterEmail,
    reviewNote,
    completedAt,
    createdAt,
    updatedAt
  };
}

function buildSettingsPayload(settings: WorkspaceSettings) {
  return {
    retentionMode: settings.retentionMode,
    invoiceDraftRetentionDays: clampRetentionDays(settings.invoiceDraftRetentionDays),
    validationRunRetentionDays: clampRetentionDays(
      settings.validationRunRetentionDays
    ),
    xmlReportRetentionDays: clampRetentionDays(settings.xmlReportRetentionDays),
    activityLogRetentionDays: clampRetentionDays(settings.activityLogRetentionDays),
    allowDataExportRequests: settings.allowDataExportRequests,
    allowDeletionRequests: settings.allowDeletionRequests
  };
}

function buildReviewDrafts(records: WorkspacePrivacyRequest[]) {
  return records.reduce<Record<string, PrivacyRequestReviewDraft>>(
    (drafts, record) => {
      drafts[record.id] = {
        status: record.status,
        reviewNote: record.reviewNote
      };

      return drafts;
    },
    {}
  );
}

function formatUpdatedAt(value: string) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatRetentionMode(value: RetentionMode) {
  return value === "scheduled" ? "Scheduled cleanup" : "Manual review";
}

function formatPrivacyRequestType(value: PrivacyRequestType) {
  if (value === "deletion") {
    return "Deletion request";
  }

  if (value === "retention_review") {
    return "Retention review";
  }

  return "Data export";
}

function formatPrivacyRequestStatus(value: PrivacyRequestStatus) {
  if (value === "in_review") {
    return "In review";
  }

  if (value === "completed") {
    return "Completed";
  }

  if (value === "rejected") {
    return "Rejected";
  }

  return "Submitted";
}

export default function WorkspacePrivacyPage() {
  const [settings, setSettings] = useState<WorkspaceSettings>(
    defaultWorkspaceSettings
  );
  const [privacyRequests, setPrivacyRequests] = useState<
    WorkspacePrivacyRequest[]
  >([]);
  const [requestReviewDrafts, setRequestReviewDrafts] = useState<
    Record<string, PrivacyRequestReviewDraft>
  >({});

  const [requestType, setRequestType] =
    useState<PrivacyRequestType>("data_export");
  const [requestSubject, setRequestSubject] = useState("");
  const [requestDetails, setRequestDetails] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [updatingRequestId, setUpdatingRequestId] = useState("");

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [requestStatusMessage, setRequestStatusMessage] = useState("");
  const [requestErrorMessage, setRequestErrorMessage] = useState("");

  async function loadSettings() {
    setIsLoading(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/settings", {
        method: "GET",
        cache: "no-store"
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setErrorMessage(
          "Workspace settings are not connected yet. The privacy controls are ready for the API route."
        );
        setIsLoading(false);
        return;
      }

      setSettings(normalizeWorkspaceSettings(responseData));
      setStatusMessage("Workspace privacy settings loaded.");
      setIsLoading(false);
    } catch {
      setErrorMessage(
        "Workspace settings are not connected yet. The privacy controls are ready for the API route."
      );
      setIsLoading(false);
    }
  }

  async function loadPrivacyRequests() {
    setIsLoadingRequests(true);
    setRequestStatusMessage("");
    setRequestErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/privacy-requests", {
        method: "GET",
        cache: "no-store"
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setPrivacyRequests([]);
        setRequestErrorMessage(
          "Privacy requests are not connected yet. The request UI is ready for the API route."
        );
        setIsLoadingRequests(false);
        return;
      }

      const records = getRecordsFromResponse(responseData)
        .map((record) => normalizeWorkspacePrivacyRequest(record))
        .filter((record): record is WorkspacePrivacyRequest => record !== null);

      setPrivacyRequests(records);
      setRequestReviewDrafts(buildReviewDrafts(records));
      setRequestStatusMessage("Privacy request history loaded.");
      setIsLoadingRequests(false);
    } catch {
      setPrivacyRequests([]);
      setRequestErrorMessage(
        "Privacy requests are not connected yet. The request UI is ready for the API route."
      );
      setIsLoadingRequests(false);
    }
  }

  async function saveSettings() {
    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/settings", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify(buildSettingsPayload(settings))
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setErrorMessage("Could not save workspace privacy settings.");
        setIsSaving(false);
        return;
      }

      setSettings(normalizeWorkspaceSettings(responseData));
      setStatusMessage("Workspace privacy settings saved.");
      setIsSaving(false);
    } catch {
      setErrorMessage("Could not save workspace privacy settings.");
      setIsSaving(false);
    }
  }

  async function submitPrivacyRequest() {
    const cleanSubject = requestSubject.trim();
    const cleanDetails = requestDetails.trim();

    if (cleanSubject.length < 3) {
      setRequestErrorMessage("Request subject must contain at least 3 characters.");
      return;
    }

    if (requestType === "data_export" && !settings.allowDataExportRequests) {
      setRequestErrorMessage("Data export requests are disabled in workspace settings.");
      return;
    }

    if (requestType === "deletion" && !settings.allowDeletionRequests) {
      setRequestErrorMessage("Deletion requests are disabled in workspace settings.");
      return;
    }

    setIsSubmittingRequest(true);
    setRequestStatusMessage("");
    setRequestErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/privacy-requests", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          requestType,
          subject: cleanSubject,
          details: cleanDetails
        })
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setRequestErrorMessage("Could not submit privacy request.");
        setIsSubmittingRequest(false);
        return;
      }

      const recordSource = isPlainObject(responseData) ? responseData.record : null;
      const createdRecord = normalizeWorkspacePrivacyRequest(recordSource);

      if (createdRecord) {
        setPrivacyRequests((currentRequests) => [
          createdRecord,
          ...currentRequests.filter((request) => request.id !== createdRecord.id)
        ]);

        setRequestReviewDrafts((currentDrafts) => ({
          ...currentDrafts,
          [createdRecord.id]: {
            status: createdRecord.status,
            reviewNote: createdRecord.reviewNote
          }
        }));
      }

      setRequestSubject("");
      setRequestDetails("");
      setRequestStatusMessage("Privacy request submitted.");
      setIsSubmittingRequest(false);
    } catch {
      setRequestErrorMessage("Could not submit privacy request.");
      setIsSubmittingRequest(false);
    }
  }

  async function updatePrivacyRequest(requestId: string) {
    const draft = requestReviewDrafts[requestId];

    if (!draft) {
      setRequestErrorMessage("No review values are available for this request.");
      return;
    }

    setUpdatingRequestId(requestId);
    setRequestStatusMessage("");
    setRequestErrorMessage("");

    try {
      const response = await fetch(
        `/api/local/workspace/privacy-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          cache: "no-store",
          body: JSON.stringify({
            status: draft.status,
            reviewNote: draft.reviewNote.trim()
          })
        }
      );

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setRequestErrorMessage("Could not update privacy request status.");
        setUpdatingRequestId("");
        return;
      }

      const recordSource = isPlainObject(responseData) ? responseData.record : null;
      const updatedRecord = normalizeWorkspacePrivacyRequest(recordSource);

      if (updatedRecord) {
        setPrivacyRequests((currentRequests) =>
          currentRequests.map((request) =>
            request.id === updatedRecord.id ? updatedRecord : request
          )
        );

        setRequestReviewDrafts((currentDrafts) => ({
          ...currentDrafts,
          [updatedRecord.id]: {
            status: updatedRecord.status,
            reviewNote: updatedRecord.reviewNote
          }
        }));
      }

      setRequestStatusMessage("Privacy request status updated.");
      setUpdatingRequestId("");
    } catch {
      setRequestErrorMessage("Could not update privacy request status.");
      setUpdatingRequestId("");
    }
  }

  useEffect(() => {
    void loadSettings();
    void loadPrivacyRequests();
  }, []);

  const retentionRows = useMemo(() => {
    return [
      {
        label: "Retention mode",
        value: formatRetentionMode(settings.retentionMode)
      },
      {
        label: "Invoice draft retention",
        value: `${settings.invoiceDraftRetentionDays} days`
      },
      {
        label: "Validation report retention",
        value: `${settings.validationRunRetentionDays} days`
      },
      {
        label: "XML report retention",
        value: `${settings.xmlReportRetentionDays} days`
      },
      {
        label: "Activity log retention",
        value: `${settings.activityLogRetentionDays} days`
      },
      {
        label: "Data export requests",
        value: settings.allowDataExportRequests ? "Allowed" : "Disabled"
      },
      {
        label: "Deletion requests",
        value: settings.allowDeletionRequests ? "Allowed" : "Disabled"
      },
      {
        label: "Last updated",
        value: formatUpdatedAt(settings.updatedAt)
      }
    ];
  }, [settings]);

  const selectedRequestTypeAllowed =
    requestType === "data_export"
      ? settings.allowDataExportRequests
      : requestType === "deletion"
        ? settings.allowDeletionRequests
        : true;

  const canSubmitPrivacyRequest =
    selectedRequestTypeAllowed &&
    requestSubject.trim().length >= 3 &&
    !isSubmittingRequest;

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Privacy and audit</p>
        <h2>GDPR-oriented controls for invoice data.</h2>
        <p>
          Configure workspace-level privacy settings for retention, data exports,
          deletion requests, and data minimisation boundaries. These controls are
          platform settings only; they do not replace legal, tax, accounting, or
          authority retention obligations.
        </p>
      </section>

      <section className="workspace-step-grid">
        {privacyControls.map((item) => (
          <div className="workspace-step" key={item.title}>
            <div>{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </section>

      <section className="privacy-retention">
        <div className="privacy-retention-head">
          <div>
            <p>Workspace settings</p>
            <h3>Retention and privacy controls</h3>
          </div>

          <LockKeyhole size={26} />
        </div>

        <div className="workspace-history-filters">
          <label>
            <span>Retention mode</span>
            <select
              value={settings.retentionMode}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  retentionMode: normalizeRetentionMode(event.target.value)
                }));
              }}
            >
              <option value="manual">Manual review</option>
              <option value="scheduled">Scheduled cleanup</option>
            </select>
          </label>

          <label>
            <span>Invoice drafts</span>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.invoiceDraftRetentionDays}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  invoiceDraftRetentionDays: clampRetentionDays(
                    Number(event.target.value)
                  )
                }));
              }}
            />
          </label>

          <label>
            <span>Validation reports</span>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.validationRunRetentionDays}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  validationRunRetentionDays: clampRetentionDays(
                    Number(event.target.value)
                  )
                }));
              }}
            />
          </label>

          <label>
            <span>XML reports</span>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.xmlReportRetentionDays}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  xmlReportRetentionDays: clampRetentionDays(Number(event.target.value))
                }));
              }}
            />
          </label>

          <label>
            <span>Activity logs</span>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.activityLogRetentionDays}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  activityLogRetentionDays: clampRetentionDays(
                    Number(event.target.value)
                  )
                }));
              }}
            />
          </label>
        </div>

        <div className="retention-list">
          <div className="retention-row">
            <div>
              <Download size={16} />
              <span>Allow data export requests</span>
            </div>

            <input
              type="checkbox"
              checked={settings.allowDataExportRequests}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  allowDataExportRequests: event.target.checked
                }));
              }}
            />
          </div>

          <div className="retention-row">
            <div>
              <Trash2 size={16} />
              <span>Allow deletion requests</span>
            </div>

            <input
              type="checkbox"
              checked={settings.allowDeletionRequests}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  allowDeletionRequests: event.target.checked
                }));
              }}
            />
          </div>
        </div>

        <div className="workspace-row-actions">
          <button
            type="button"
            className="workspace-auth-action"
            disabled={isLoading || isSaving}
            onClick={() => {
              void saveSettings();
            }}
          >
            <Save size={16} />
            {isSaving ? "Saving" : "Save settings"}
          </button>

          <button
            type="button"
            className="workspace-auth-action"
            disabled={isLoading || isSaving}
            onClick={() => {
              void loadSettings();
            }}
          >
            <RefreshCcw size={16} />
            Reload
          </button>
        </div>

        {statusMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <CheckCircle2 size={16} />
                <span>{statusMessage}</span>
              </div>

              <strong>OK</strong>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>{errorMessage}</span>
              </div>

              <strong>Pending API</strong>
            </div>
          </div>
        ) : null}
      </section>

      <section className="privacy-retention">
        <div className="privacy-retention-head">
          <div>
            <p>Privacy request workflow</p>
            <h3>Submit data export, deletion, or retention review requests</h3>
          </div>

          <ClipboardList size={26} />
        </div>

        <div className="workspace-history-filters">
          <label>
            <span>Request type</span>
            <select
              value={requestType}
              disabled={isSubmittingRequest}
              onChange={(event) => {
                setRequestType(normalizePrivacyRequestType(event.target.value));
              }}
            >
              <option value="data_export">Data export</option>
              <option value="deletion">Deletion request</option>
              <option value="retention_review">Retention review</option>
            </select>
          </label>

          <label>
            <span>Subject</span>
            <input
              type="text"
              maxLength={120}
              value={requestSubject}
              disabled={isSubmittingRequest}
              placeholder="Example: Export my workspace data"
              onChange={(event) => {
                setRequestSubject(event.target.value);
              }}
            />
          </label>

          <label>
            <span>Details</span>
            <input
              type="text"
              maxLength={500}
              value={requestDetails}
              disabled={isSubmittingRequest}
              placeholder="Optional context for the request"
              onChange={(event) => {
                setRequestDetails(event.target.value);
              }}
            />
          </label>

          <button
            type="button"
            className="workspace-auth-action"
            disabled={!canSubmitPrivacyRequest}
            onClick={() => {
              void submitPrivacyRequest();
            }}
          >
            <Send size={16} />
            {isSubmittingRequest ? "Submitting" : "Submit"}
          </button>
        </div>

        {!selectedRequestTypeAllowed ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>
                  This request type is currently disabled in workspace privacy
                  settings.
                </span>
              </div>

              <strong>Disabled</strong>
            </div>
          </div>
        ) : null}

        {requestStatusMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <CheckCircle2 size={16} />
                <span>{requestStatusMessage}</span>
              </div>

              <strong>OK</strong>
            </div>
          </div>
        ) : null}

        {requestErrorMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>{requestErrorMessage}</span>
              </div>

              <strong>
                {requestErrorMessage.includes("not connected")
                  ? "Pending API"
                  : "Review"}
              </strong>
            </div>
          </div>
        ) : null}
      </section>

      <section className="privacy-retention">
        <div className="privacy-retention-head">
          <div>
            <p>Privacy request history</p>
            <h3>Workspace request trail and review actions</h3>
          </div>

          <FileClock size={26} />
        </div>

        <div className="retention-list">
          {isLoadingRequests ? (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>Loading privacy requests</span>
              </div>

              <strong>Loading</strong>
            </div>
          ) : privacyRequests.length > 0 ? (
            privacyRequests.map((request) => {
              const draft = requestReviewDrafts[request.id] ?? {
                status: request.status,
                reviewNote: request.reviewNote
              };

              return (
                <Fragment key={request.id}>
                  <div className="retention-row">
                    <div>
                      <FileClock size={16} />
                      <span>
                        {formatPrivacyRequestType(request.requestType)} ·{" "}
                        {request.subject}
                        <br />
                        {request.details || "No additional details"}
                        <br />
                        {request.requesterEmail || "Requester not shown"} · Created{" "}
                        {formatUpdatedAt(request.createdAt)}
                        {request.reviewNote ? (
                          <>
                            <br />
                            Review note: {request.reviewNote}
                          </>
                        ) : null}
                        {request.completedAt ? (
                          <>
                            <br />
                            Completed: {formatUpdatedAt(request.completedAt)}
                          </>
                        ) : null}
                      </span>
                    </div>

                    <strong>{formatPrivacyRequestStatus(request.status)}</strong>
                  </div>

                  <div className="workspace-history-filters">
                    <label>
                      <span>Status</span>
                      <select
                        value={draft.status}
                        disabled={updatingRequestId === request.id}
                        onChange={(event) => {
                          const status = normalizePrivacyRequestStatus(
                            event.target.value
                          );

                          setRequestReviewDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [request.id]: {
                              ...draft,
                              status
                            }
                          }));
                        }}
                      >
                        <option value="submitted">Submitted</option>
                        <option value="in_review">In review</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </label>

                    <label>
                      <span>Review note</span>
                      <input
                        type="text"
                        maxLength={1000}
                        value={draft.reviewNote}
                        disabled={updatingRequestId === request.id}
                        placeholder="Optional internal review note"
                        onChange={(event) => {
                          setRequestReviewDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [request.id]: {
                              ...draft,
                              reviewNote: event.target.value
                            }
                          }));
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      className="workspace-auth-action"
                      disabled={Boolean(updatingRequestId)}
                      onClick={() => {
                        void updatePrivacyRequest(request.id);
                      }}
                    >
                      <Save size={16} />
                      {updatingRequestId === request.id ? "Updating" : "Update"}
                    </button>
                  </div>
                </Fragment>
              );
            })
          ) : (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>No privacy requests have been submitted yet.</span>
              </div>

              <strong>Empty</strong>
            </div>
          )}
        </div>
      </section>

      <section className="privacy-retention">
        <div className="privacy-retention-head">
          <div>
            <p>Active policy summary</p>
            <h3>Current workspace privacy configuration</h3>
          </div>

          <FileClock size={26} />
        </div>

        <div className="retention-list">
          {retentionRows.map((item) => (
            <div className="retention-row" key={item.label}>
              <div>
                <FileClock size={16} />
                <span>{item.label}</span>
              </div>

              <strong>{isLoading ? "Loading" : item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="workspace-map">
        <div>
          <Database size={24} />
          <h3>Database-backed controls</h3>
          <p>
            Workspace settings persist through public.workspace_settings. Privacy
            requests persist through public.workspace_privacy_requests and now
            support a review/status workflow.
          </p>
        </div>

        <div>
          <ShieldCheck size={24} />
          <h3>Safety boundary</h3>
          <p>
            Retention settings and privacy requests define product behavior inside
            Invoice Lantern. They do not decide statutory retention duties,
            accounting obligations, or authority-facing recordkeeping requirements.
          </p>
        </div>
      </section>
    </div>
  );
}
