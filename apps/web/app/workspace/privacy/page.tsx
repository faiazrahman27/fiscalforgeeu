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

type RetentionPreviewBucket = {
  retentionDays: number;
  cutoffDate: string;
  affectedCount: number;
};

type WorkspaceRetentionPreview = {
  retentionMode: RetentionMode;
  generatedAt: string;
  invoiceDrafts: RetentionPreviewBucket;
  validationRuns: RetentionPreviewBucket;
  xmlReadinessReports: RetentionPreviewBucket;
  activityEvents: RetentionPreviewBucket;
};

type WorkspaceRetentionRunStatus = "prepared" | "executed" | "failed";

type WorkspaceRetentionRunBucket = {
  retentionDays: number;
  cutoffDate: string;
  affectedCount: number;
  executedCount: number;
};

type WorkspaceRetentionRun = {
  id: string;
  runType: "manual_retention_review";
  status: WorkspaceRetentionRunStatus;
  retentionMode: RetentionMode;
  invoiceDrafts: WorkspaceRetentionRunBucket;
  validationRuns: WorkspaceRetentionRunBucket;
  xmlReadinessReports: WorkspaceRetentionRunBucket;
  activityEvents: WorkspaceRetentionRunBucket;
  totalAffectedCount: number;
  totalExecutedCount: number;
  errorMessage: string;
  executedAt: string;
  createdAt: string;
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

type WorkspaceExportPackageStatus = "prepared" | "failed";

type WorkspaceExportPackageRecordCounts = {
  invoiceDrafts: number;
  validationRuns: number;
  xmlReadinessReports: number;
  workspaceSettings: number;
  privacyRequests: number;
  activityEvents: number;
};

type WorkspaceExportPackage = {
  id: string;
  packageType: "full_workspace";
  status: WorkspaceExportPackageStatus;
  exportName: string;
  exportFormat: "json";
  sourcePrivacyRequestId: string;
  recordCounts: WorkspaceExportPackageRecordCounts;
  packagePayload: unknown;
  packageSizeBytes: number;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
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

const emptyRetentionPreviewBucket: RetentionPreviewBucket = {
  retentionDays: 0,
  cutoffDate: "",
  affectedCount: 0
};

const emptyRetentionRunBucket: WorkspaceRetentionRunBucket = {
  retentionDays: 0,
  cutoffDate: "",
  affectedCount: 0,
  executedCount: 0
};

const emptyExportRecordCounts: WorkspaceExportPackageRecordCounts = {
  invoiceDrafts: 0,
  validationRuns: 0,
  xmlReadinessReports: 0,
  workspaceSettings: 0,
  privacyRequests: 0,
  activityEvents: 0
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

function normalizeExportPackageStatus(value: string): WorkspaceExportPackageStatus {
  return value === "failed" ? "failed" : "prepared";
}

function normalizeRetentionRunStatus(value: string): WorkspaceRetentionRunStatus {
  if (value === "executed" || value === "failed") {
    return value;
  }

  return "prepared";
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

function getSingleRecordFromResponse(data: unknown) {
  if (!isPlainObject(data)) {
    return null;
  }

  if (isPlainObject(data.record)) {
    return data.record;
  }

  return data;
}

function getRecordsFromResponse(data: unknown) {
  if (!isPlainObject(data) || !Array.isArray(data.records)) {
    return [];
  }

  return data.records;
}

function readErrorMessage(data: unknown, fallback: string) {
  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  return readStringField(data.error, "message", fallback);
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

function normalizeRetentionPreviewBucket(
  value: unknown,
  fallbackRetentionDays: number
): RetentionPreviewBucket {
  if (!isPlainObject(value)) {
    return {
      ...emptyRetentionPreviewBucket,
      retentionDays: fallbackRetentionDays
    };
  }

  return {
    retentionDays: clampRetentionDays(
      readNumberField(value, "retentionDays", fallbackRetentionDays)
    ),
    cutoffDate: readStringField(value, "cutoffDate"),
    affectedCount: Math.max(0, readNumberField(value, "affectedCount", 0))
  };
}

function normalizeWorkspaceRetentionPreview(
  data: unknown,
  settings: WorkspaceSettings
): WorkspaceRetentionPreview | null {
  const record = getSingleRecordFromResponse(data);

  if (!record) {
    return null;
  }

  return {
    retentionMode: normalizeRetentionMode(
      readStringField(record, "retentionMode", settings.retentionMode)
    ),
    generatedAt: readStringField(record, "generatedAt"),
    invoiceDrafts: normalizeRetentionPreviewBucket(
      record.invoiceDrafts,
      settings.invoiceDraftRetentionDays
    ),
    validationRuns: normalizeRetentionPreviewBucket(
      record.validationRuns,
      settings.validationRunRetentionDays
    ),
    xmlReadinessReports: normalizeRetentionPreviewBucket(
      record.xmlReadinessReports,
      settings.xmlReportRetentionDays
    ),
    activityEvents: normalizeRetentionPreviewBucket(
      record.activityEvents,
      settings.activityLogRetentionDays
    )
  };
}

function normalizeRetentionRunBucket(value: unknown): WorkspaceRetentionRunBucket {
  if (!isPlainObject(value)) {
    return emptyRetentionRunBucket;
  }

  return {
    retentionDays: clampRetentionDays(readNumberField(value, "retentionDays", 0)),
    cutoffDate: readStringField(value, "cutoffDate"),
    affectedCount: Math.max(0, readNumberField(value, "affectedCount", 0)),
    executedCount: Math.max(0, readNumberField(value, "executedCount", 0))
  };
}

function normalizeWorkspaceRetentionRun(
  value: unknown
): WorkspaceRetentionRun | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const createdAt = readStringField(value, "createdAt");

  if (!id || !createdAt) {
    return null;
  }

  return {
    id,
    runType: "manual_retention_review",
    status: normalizeRetentionRunStatus(readStringField(value, "status")),
    retentionMode: normalizeRetentionMode(readStringField(value, "retentionMode")),
    invoiceDrafts: normalizeRetentionRunBucket(value.invoiceDrafts),
    validationRuns: normalizeRetentionRunBucket(value.validationRuns),
    xmlReadinessReports: normalizeRetentionRunBucket(value.xmlReadinessReports),
    activityEvents: normalizeRetentionRunBucket(value.activityEvents),
    totalAffectedCount: Math.max(
      0,
      readNumberField(value, "totalAffectedCount", 0)
    ),
    totalExecutedCount: Math.max(
      0,
      readNumberField(value, "totalExecutedCount", 0)
    ),
    errorMessage: readStringField(value, "errorMessage"),
    executedAt: readStringField(value, "executedAt"),
    createdAt,
    updatedAt: readStringField(value, "updatedAt")
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

function normalizeExportRecordCounts(
  value: unknown
): WorkspaceExportPackageRecordCounts {
  if (!isPlainObject(value)) {
    return emptyExportRecordCounts;
  }

  return {
    invoiceDrafts: readNumberField(value, "invoiceDrafts", 0),
    validationRuns: readNumberField(value, "validationRuns", 0),
    xmlReadinessReports: readNumberField(value, "xmlReadinessReports", 0),
    workspaceSettings: readNumberField(value, "workspaceSettings", 0),
    privacyRequests: readNumberField(value, "privacyRequests", 0),
    activityEvents: readNumberField(value, "activityEvents", 0)
  };
}

function normalizeWorkspaceExportPackage(
  value: unknown
): WorkspaceExportPackage | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const exportName = readStringField(value, "exportName");
  const createdAt = readStringField(value, "createdAt");

  if (!id || !exportName || !createdAt) {
    return null;
  }

  return {
    id,
    packageType: "full_workspace",
    status: normalizeExportPackageStatus(readStringField(value, "status")),
    exportName,
    exportFormat: "json",
    sourcePrivacyRequestId: readStringField(value, "sourcePrivacyRequestId"),
    recordCounts: normalizeExportRecordCounts(value.recordCounts),
    packagePayload: value.packagePayload ?? null,
    packageSizeBytes: readNumberField(value, "packageSizeBytes", 0),
    errorMessage: readStringField(value, "errorMessage"),
    createdAt,
    updatedAt: readStringField(value, "updatedAt")
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

function buildDefaultExportName() {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10);

  return `Workspace export ${datePart}`;
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

function formatDateOnly(value: string) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    dateStyle: "medium"
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

function formatExportPackageStatus(value: WorkspaceExportPackageStatus) {
  return value === "failed" ? "Failed" : "Prepared";
}

function formatRetentionRunStatus(value: WorkspaceRetentionRunStatus) {
  if (value === "executed") {
    return "Executed";
  }

  if (value === "failed") {
    return "Failed";
  }

  return "Prepared";
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatRecordCounts(counts: WorkspaceExportPackageRecordCounts) {
  return [
    `${counts.invoiceDrafts} draft(s)`,
    `${counts.validationRuns} validation run(s)`,
    `${counts.xmlReadinessReports} XML report(s)`,
    `${counts.privacyRequests} privacy request(s)`,
    `${counts.activityEvents} activity event(s)`
  ].join(" · ");
}

function formatRetentionRunCounts(record: WorkspaceRetentionRun) {
  return [
    `${record.invoiceDrafts.affectedCount} draft(s)`,
    `${record.validationRuns.affectedCount} validation run(s)`,
    `${record.xmlReadinessReports.affectedCount} XML report(s)`,
    `${record.activityEvents.affectedCount} activity event(s)`
  ].join(" · ");
}

function formatRetentionRunExecutedCounts(record: WorkspaceRetentionRun) {
  return [
    `${record.invoiceDrafts.executedCount} draft(s)`,
    `${record.validationRuns.executedCount} validation run(s)`,
    `${record.xmlReadinessReports.executedCount} XML report(s)`,
    `${record.activityEvents.executedCount} activity event(s)`
  ].join(" · ");
}

function downloadJsonFile(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = `${fileName.replace(/[^\w.-]+/g, "-").slice(0, 120)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function WorkspacePrivacyPage() {
  const [settings, setSettings] = useState<WorkspaceSettings>(
    defaultWorkspaceSettings
  );
  const [retentionPreview, setRetentionPreview] =
    useState<WorkspaceRetentionPreview | null>(null);
  const [retentionRuns, setRetentionRuns] = useState<WorkspaceRetentionRun[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<
    WorkspacePrivacyRequest[]
  >([]);
  const [requestReviewDrafts, setRequestReviewDrafts] = useState<
    Record<string, PrivacyRequestReviewDraft>
  >({});

  const [exportPackages, setExportPackages] = useState<WorkspaceExportPackage[]>(
    []
  );
  const [exportName, setExportName] = useState(buildDefaultExportName);
  const [sourcePrivacyRequestId, setSourcePrivacyRequestId] = useState("");

  const [requestType, setRequestType] =
    useState<PrivacyRequestType>("data_export");
  const [requestSubject, setRequestSubject] = useState("");
  const [requestDetails, setRequestDetails] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRetentionPreview, setIsLoadingRetentionPreview] =
    useState(true);
  const [isLoadingRetentionRuns, setIsLoadingRetentionRuns] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isLoadingExportPackages, setIsLoadingExportPackages] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingRetentionRun, setIsPreparingRetentionRun] = useState(false);
  const [executingRetentionRunId, setExecutingRetentionRunId] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isCreatingExportPackage, setIsCreatingExportPackage] = useState(false);
  const [downloadingExportPackageId, setDownloadingExportPackageId] = useState("");
  const [updatingRequestId, setUpdatingRequestId] = useState("");

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [retentionPreviewStatusMessage, setRetentionPreviewStatusMessage] =
    useState("");
  const [retentionPreviewErrorMessage, setRetentionPreviewErrorMessage] =
    useState("");
  const [retentionRunStatusMessage, setRetentionRunStatusMessage] = useState("");
  const [retentionRunErrorMessage, setRetentionRunErrorMessage] = useState("");
  const [requestStatusMessage, setRequestStatusMessage] = useState("");
  const [requestErrorMessage, setRequestErrorMessage] = useState("");
  const [exportStatusMessage, setExportStatusMessage] = useState("");
  const [exportErrorMessage, setExportErrorMessage] = useState("");

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

  async function loadRetentionPreview() {
    setIsLoadingRetentionPreview(true);
    setRetentionPreviewStatusMessage("");
    setRetentionPreviewErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/retention-preview", {
        method: "GET",
        cache: "no-store"
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setRetentionPreview(null);
        setRetentionPreviewErrorMessage(
          "Retention preview is not connected yet. The preview UI is ready for the API route."
        );
        setIsLoadingRetentionPreview(false);
        return;
      }

      const preview = normalizeWorkspaceRetentionPreview(responseData, settings);

      setRetentionPreview(preview);
      setRetentionPreviewStatusMessage("Retention preview loaded.");
      setIsLoadingRetentionPreview(false);
    } catch {
      setRetentionPreview(null);
      setRetentionPreviewErrorMessage(
        "Retention preview is not connected yet. The preview UI is ready for the API route."
      );
      setIsLoadingRetentionPreview(false);
    }
  }

  async function loadRetentionRuns() {
    setIsLoadingRetentionRuns(true);
    setRetentionRunStatusMessage("");
    setRetentionRunErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/retention-runs", {
        method: "GET",
        cache: "no-store"
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setRetentionRuns([]);
        setRetentionRunErrorMessage(
          "Retention runs are not connected yet. The run history UI is ready for the API route."
        );
        setIsLoadingRetentionRuns(false);
        return;
      }

      const records = getRecordsFromResponse(responseData)
        .map((record) => normalizeWorkspaceRetentionRun(record))
        .filter((record): record is WorkspaceRetentionRun => record !== null);

      setRetentionRuns(records);
      setRetentionRunStatusMessage("Retention run history loaded.");
      setIsLoadingRetentionRuns(false);
    } catch {
      setRetentionRuns([]);
      setRetentionRunErrorMessage(
        "Retention runs are not connected yet. The run history UI is ready for the API route."
      );
      setIsLoadingRetentionRuns(false);
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

  async function loadExportPackages() {
    setIsLoadingExportPackages(true);
    setExportStatusMessage("");
    setExportErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/export-packages", {
        method: "GET",
        cache: "no-store"
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setExportPackages([]);
        setExportErrorMessage(
          "Export packages are not connected yet. The export UI is ready for the API route."
        );
        setIsLoadingExportPackages(false);
        return;
      }

      const records = getRecordsFromResponse(responseData)
        .map((record) => normalizeWorkspaceExportPackage(record))
        .filter((record): record is WorkspaceExportPackage => record !== null);

      setExportPackages(records);
      setExportStatusMessage("Export package history loaded.");
      setIsLoadingExportPackages(false);
    } catch {
      setExportPackages([]);
      setExportErrorMessage(
        "Export packages are not connected yet. The export UI is ready for the API route."
      );
      setIsLoadingExportPackages(false);
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
      void loadRetentionPreview();
    } catch {
      setErrorMessage("Could not save workspace privacy settings.");
      setIsSaving(false);
    }
  }

  async function prepareRetentionRun() {
    setIsPreparingRetentionRun(true);
    setRetentionRunStatusMessage("");
    setRetentionRunErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/retention-runs", {
        method: "POST",
        cache: "no-store"
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setRetentionRunErrorMessage("Could not prepare retention run.");
        setIsPreparingRetentionRun(false);
        return;
      }

      const recordSource = getSingleRecordFromResponse(responseData);
      const createdRecord = normalizeWorkspaceRetentionRun(recordSource);

      if (createdRecord) {
        setRetentionRuns((currentRuns) => [
          createdRecord,
          ...currentRuns.filter((run) => run.id !== createdRecord.id)
        ]);
      }

      setRetentionRunStatusMessage("Retention run prepared. No records were deleted.");
      setIsPreparingRetentionRun(false);
    } catch {
      setRetentionRunErrorMessage("Could not prepare retention run.");
      setIsPreparingRetentionRun(false);
    }
  }

  async function executeRetentionRun(retentionRunId: string) {
    const confirmed = window.confirm(
      "Execute this retention run? This can permanently delete expired workspace records based on this run's saved cutoff dates."
    );

    if (!confirmed) {
      return;
    }

    setExecutingRetentionRunId(retentionRunId);
    setRetentionRunStatusMessage("");
    setRetentionRunErrorMessage("");

    try {
      const response = await fetch(
        `/api/local/workspace/retention-runs/${encodeURIComponent(
          retentionRunId
        )}/execute`,
        {
          method: "POST",
          cache: "no-store"
        }
      );

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setRetentionRunErrorMessage(
          readErrorMessage(responseData, "Could not execute retention run.")
        );
        setExecutingRetentionRunId("");
        return;
      }

      const recordSource = getSingleRecordFromResponse(responseData);
      const executedRecord = normalizeWorkspaceRetentionRun(recordSource);

      if (executedRecord) {
        setRetentionRuns((currentRuns) =>
          currentRuns.map((run) =>
            run.id === executedRecord.id ? executedRecord : run
          )
        );
      }

      setRetentionRunStatusMessage(
        "Retention run executed. Expired records were deleted according to the saved cutoff dates."
      );
      setExecutingRetentionRunId("");
      void loadRetentionPreview();
    } catch {
      setRetentionRunErrorMessage("Could not execute retention run.");
      setExecutingRetentionRunId("");
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

        if (createdRecord.requestType === "data_export") {
          setSourcePrivacyRequestId(createdRecord.id);
        }
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

  async function createExportPackage() {
    const cleanExportName = exportName.trim();

    if (cleanExportName.length < 3) {
      setExportErrorMessage("Export name must contain at least 3 characters.");
      return;
    }

    if (!settings.allowDataExportRequests) {
      setExportErrorMessage("Data export requests are disabled in workspace settings.");
      return;
    }

    setIsCreatingExportPackage(true);
    setExportStatusMessage("");
    setExportErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/export-packages", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          exportName: cleanExportName,
          ...(sourcePrivacyRequestId
            ? {
                sourcePrivacyRequestId
              }
            : {})
        })
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setExportErrorMessage("Could not create export package.");
        setIsCreatingExportPackage(false);
        return;
      }

      const recordSource = getSingleRecordFromResponse(responseData);
      const createdRecord = normalizeWorkspaceExportPackage(recordSource);

      if (createdRecord) {
        setExportPackages((currentPackages) => [
          createdRecord,
          ...currentPackages.filter((item) => item.id !== createdRecord.id)
        ]);
        setExportName(buildDefaultExportName());
      }

      setExportStatusMessage("Workspace export package prepared.");
      setIsCreatingExportPackage(false);
    } catch {
      setExportErrorMessage("Could not create export package.");
      setIsCreatingExportPackage(false);
    }
  }

  async function downloadExportPackage(packageRecord: WorkspaceExportPackage) {
    setDownloadingExportPackageId(packageRecord.id);
    setExportStatusMessage("");
    setExportErrorMessage("");

    try {
      const response = await fetch(
        `/api/local/workspace/export-packages/${encodeURIComponent(packageRecord.id)}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setExportErrorMessage("Could not load export package payload.");
        setDownloadingExportPackageId("");
        return;
      }

      const recordSource = getSingleRecordFromResponse(responseData);
      const record = normalizeWorkspaceExportPackage(recordSource);

      if (!record || !record.packagePayload) {
        setExportErrorMessage("Export package payload is not available.");
        setDownloadingExportPackageId("");
        return;
      }

      downloadJsonFile(record.exportName || record.id, record.packagePayload);
      setExportStatusMessage("Export package JSON downloaded.");
      setDownloadingExportPackageId("");
    } catch {
      setExportErrorMessage("Could not download export package.");
      setDownloadingExportPackageId("");
    }
  }

  useEffect(() => {
    void loadSettings();
    void loadRetentionPreview();
    void loadRetentionRuns();
    void loadPrivacyRequests();
    void loadExportPackages();
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

  const retentionPreviewRows = useMemo(() => {
    if (!retentionPreview) {
      return [];
    }

    return [
      {
        label: "Invoice drafts",
        bucket: retentionPreview.invoiceDrafts,
        description: "Draft records older than the invoice draft retention window."
      },
      {
        label: "Validation reports",
        bucket: retentionPreview.validationRuns,
        description:
          "Validation run records older than the validation report retention window."
      },
      {
        label: "XML readiness reports",
        bucket: retentionPreview.xmlReadinessReports,
        description: "XML readiness records older than the XML report retention window."
      },
      {
        label: "Workspace activity events",
        bucket: retentionPreview.activityEvents,
        description: "Audit/activity records older than the activity log retention window."
      }
    ];
  }, [retentionPreview]);

  const dataExportPrivacyRequests = useMemo(() => {
    return privacyRequests.filter((request) => request.requestType === "data_export");
  }, [privacyRequests]);

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

  const canCreateExportPackage =
    settings.allowDataExportRequests &&
    exportName.trim().length >= 3 &&
    !isCreatingExportPackage;

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
            <p>Retention impact preview</p>
            <h3>Non-destructive cleanup estimate</h3>
          </div>

          <Archive size={26} />
        </div>

        <div className="workspace-row-actions">
          <button
            type="button"
            className="workspace-auth-action"
            disabled={isLoadingRetentionPreview}
            onClick={() => {
              void loadRetentionPreview();
            }}
          >
            <RefreshCcw size={16} />
            {isLoadingRetentionPreview ? "Loading" : "Reload preview"}
          </button>
        </div>

        <div className="retention-list">
          {isLoadingRetentionPreview ? (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>Loading retention preview</span>
              </div>

              <strong>Loading</strong>
            </div>
          ) : retentionPreview ? (
            <>
              <div className="retention-row">
                <div>
                  <FileClock size={16} />
                  <span>
                    Preview generated at {formatUpdatedAt(retentionPreview.generatedAt)}
                    <br />
                    Mode: {formatRetentionMode(retentionPreview.retentionMode)}
                    <br />
                    This is a read-only estimate. No records are deleted from this
                    preview.
                  </span>
                </div>

                <strong>Preview</strong>
              </div>

              {retentionPreviewRows.map((item) => (
                <div className="retention-row" key={item.label}>
                  <div>
                    <FileClock size={16} />
                    <span>
                      {item.label}
                      <br />
                      {item.description}
                      <br />
                      Retention: {item.bucket.retentionDays} days · Cutoff:{" "}
                      {formatDateOnly(item.bucket.cutoffDate)}
                    </span>
                  </div>

                  <strong>{item.bucket.affectedCount} affected</strong>
                </div>
              ))}
            </>
          ) : (
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>
                  Retention preview is unavailable. Save settings and reload the
                  preview after the API route is available.
                </span>
              </div>

              <strong>Unavailable</strong>
            </div>
          )}
        </div>

        {retentionPreviewStatusMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <CheckCircle2 size={16} />
                <span>{retentionPreviewStatusMessage}</span>
              </div>

              <strong>OK</strong>
            </div>
          </div>
        ) : null}

        {retentionPreviewErrorMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>{retentionPreviewErrorMessage}</span>
              </div>

              <strong>
                {retentionPreviewErrorMessage.includes("not connected")
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
            <p>Retention runs</p>
            <h3>Prepared cleanup review history</h3>
          </div>

          <Archive size={26} />
        </div>

        <div className="workspace-row-actions">
          <button
            type="button"
            className="workspace-auth-action"
            disabled={isPreparingRetentionRun}
            onClick={() => {
              void prepareRetentionRun();
            }}
          >
            <Archive size={16} />
            {isPreparingRetentionRun ? "Preparing" : "Prepare retention run"}
          </button>

          <button
            type="button"
            className="workspace-auth-action"
            disabled={isLoadingRetentionRuns}
            onClick={() => {
              void loadRetentionRuns();
            }}
          >
            <RefreshCcw size={16} />
            Reload
          </button>
        </div>

        <div className="retention-list">
          {isLoadingRetentionRuns ? (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>Loading retention runs</span>
              </div>

              <strong>Loading</strong>
            </div>
          ) : retentionRuns.length > 0 ? (
            retentionRuns.map((run) => (
              <div className="retention-row" key={run.id}>
                <div>
                  <FileClock size={16} />
                  <span>
                    Retention review prepared {formatUpdatedAt(run.createdAt)}
                    <br />
                    Mode: {formatRetentionMode(run.retentionMode)}
                    <br />
                    Affected: {formatRetentionRunCounts(run)}
                    <br />
                    Executed: {formatRetentionRunExecutedCounts(run)}
                    <br />
                    Total affected: {run.totalAffectedCount} · Total executed:{" "}
                    {run.totalExecutedCount}
                    {run.executedAt ? (
                      <>
                        <br />
                        Executed at: {formatUpdatedAt(run.executedAt)}
                      </>
                    ) : null}
                    {run.errorMessage ? (
                      <>
                        <br />
                        Error: {run.errorMessage}
                      </>
                    ) : null}
                  </span>
                </div>

                <div className="workspace-row-actions">
                  <strong>{formatRetentionRunStatus(run.status)}</strong>

                  {run.status === "prepared" ? (
                    <button
                      type="button"
                      className="workspace-auth-action"
                      disabled={Boolean(executingRetentionRunId)}
                      onClick={() => {
                        void executeRetentionRun(run.id);
                      }}
                    >
                      <Trash2 size={16} />
                      {executingRetentionRunId === run.id
                        ? "Executing"
                        : "Execute cleanup"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>
                  No retention run has been prepared yet. Preparing a run stores
                  the current cleanup estimate as an auditable record and does not
                  delete data.
                </span>
              </div>

              <strong>Empty</strong>
            </div>
          )}
        </div>

        {retentionRunStatusMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <CheckCircle2 size={16} />
                <span>{retentionRunStatusMessage}</span>
              </div>

              <strong>OK</strong>
            </div>
          </div>
        ) : null}

        {retentionRunErrorMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>{retentionRunErrorMessage}</span>
              </div>

              <strong>
                {retentionRunErrorMessage.includes("not connected")
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
            <p>Workspace export packages</p>
            <h3>Prepare downloadable JSON exports from real workspace records</h3>
          </div>

          <Download size={26} />
        </div>

        <div className="workspace-history-filters">
          <label>
            <span>Export name</span>
            <input
              type="text"
              maxLength={180}
              value={exportName}
              disabled={isCreatingExportPackage}
              onChange={(event) => {
                setExportName(event.target.value);
              }}
            />
          </label>

          <label>
            <span>Linked data export request</span>
            <select
              value={sourcePrivacyRequestId}
              disabled={isCreatingExportPackage}
              onChange={(event) => {
                setSourcePrivacyRequestId(event.target.value);
              }}
            >
              <option value="">No linked request</option>
              {dataExportPrivacyRequests.map((request) => (
                <option value={request.id} key={request.id}>
                  {request.subject} · {formatPrivacyRequestStatus(request.status)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="workspace-auth-action"
            disabled={!canCreateExportPackage}
            onClick={() => {
              void createExportPackage();
            }}
          >
            <Download size={16} />
            {isCreatingExportPackage ? "Preparing" : "Prepare export"}
          </button>

          <button
            type="button"
            className="workspace-auth-action"
            disabled={isLoadingExportPackages}
            onClick={() => {
              void loadExportPackages();
            }}
          >
            <RefreshCcw size={16} />
            Reload
          </button>
        </div>

        {!settings.allowDataExportRequests ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>
                  Export package preparation is disabled because data export
                  requests are disabled in workspace settings.
                </span>
              </div>

              <strong>Disabled</strong>
            </div>
          </div>
        ) : null}

        {exportStatusMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <CheckCircle2 size={16} />
                <span>{exportStatusMessage}</span>
              </div>

              <strong>OK</strong>
            </div>
          </div>
        ) : null}

        {exportErrorMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>{exportErrorMessage}</span>
              </div>

              <strong>
                {exportErrorMessage.includes("not connected")
                  ? "Pending API"
                  : "Review"}
              </strong>
            </div>
          </div>
        ) : null}

        <div className="retention-list">
          {isLoadingExportPackages ? (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>Loading export packages</span>
              </div>

              <strong>Loading</strong>
            </div>
          ) : exportPackages.length > 0 ? (
            exportPackages.map((item) => (
              <div className="retention-row" key={item.id}>
                <div>
                  <Download size={16} />
                  <span>
                    {item.exportName}
                    <br />
                    {formatRecordCounts(item.recordCounts)}
                    <br />
                    {formatBytes(item.packageSizeBytes)} · Created{" "}
                    {formatUpdatedAt(item.createdAt)}
                    {item.sourcePrivacyRequestId ? (
                      <>
                        <br />
                        Linked request: {item.sourcePrivacyRequestId}
                      </>
                    ) : null}
                    {item.errorMessage ? (
                      <>
                        <br />
                        Error: {item.errorMessage}
                      </>
                    ) : null}
                  </span>
                </div>

                <div className="workspace-row-actions">
                  <strong>{formatExportPackageStatus(item.status)}</strong>

                  <button
                    type="button"
                    className="workspace-auth-action"
                    disabled={Boolean(downloadingExportPackageId)}
                    onClick={() => {
                      void downloadExportPackage(item);
                    }}
                  >
                    <Download size={16} />
                    {downloadingExportPackageId === item.id ? "Loading" : "JSON"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>No export package has been prepared yet.</span>
              </div>

              <strong>Empty</strong>
            </div>
          )}
        </div>
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
            requests persist through public.workspace_privacy_requests. Export
            packages persist through public.workspace_export_packages. Retention
            previews read existing records without deleting anything, and retention
            runs store auditable cleanup-review snapshots before execution.
          </p>
        </div>

        <div>
          <ShieldCheck size={24} />
          <h3>Safety boundary</h3>
          <p>
            Retention settings, privacy requests, export packages, retention
            previews, and retention runs define product behavior inside Invoice
            Lantern. They do not decide statutory retention duties, accounting
            obligations, or authority-facing recordkeeping requirements.
          </p>
        </div>
      </section>
    </div>
  );
}
