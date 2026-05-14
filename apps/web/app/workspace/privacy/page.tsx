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
  Scale,
  Send,
  ShieldCheck,
  Trash2
} from "lucide-react";

type RetentionMode = "manual" | "scheduled";
type DataMinimizationMode = "standard" | "reduced" | "strict";

type WorkspaceSettings = {
  retentionMode: RetentionMode;
  invoiceDraftRetentionDays: number;
  validationRunRetentionDays: number;
  xmlReportRetentionDays: number;
  xmlValidationJobRetentionDays: number;
  invoiceExportRetentionDays: number;
  apiRequestLogRetentionDays: number;
  webhookDeliveryLogRetentionDays: number;
  viesEvidenceRetentionDays: number;
  vidaSimulationRetentionDays: number;
  activityLogRetentionDays: number;
  privacyRequestRetentionDays: number;
  retentionRunRetentionDays: number;
  deletionRunRetentionDays: number;
  legalAcceptanceRetentionDays: number;
  storeUploadedXmlAfterValidation: boolean;
  retainValidationReports: boolean;
  retainViesEvidence: boolean;
  retainWebhookPayloadPreviews: boolean;
  allowDataExportRequests: boolean;
  allowDeletionRequests: boolean;
  includeApiLogsInExports: boolean;
  includeWebhookLogsInExports: boolean;
  includeLegalAcceptancesInExports: boolean;
  dataMinimizationMode: DataMinimizationMode;
  privacyContactEmail: string;
  securityContactEmail: string;
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
  xmlValidationJobs: RetentionPreviewBucket;
  invoiceExports: RetentionPreviewBucket;
  apiRequests: RetentionPreviewBucket;
  webhookDeliveries: RetentionPreviewBucket;
  viesEvidenceChecks: RetentionPreviewBucket;
  vidaSimulationRuns: RetentionPreviewBucket;
  activityEvents: RetentionPreviewBucket;
  privacyRequests: RetentionPreviewBucket;
  retentionRuns: RetentionPreviewBucket;
  deletionRuns: RetentionPreviewBucket;
  legalAcceptances: RetentionPreviewBucket;
  warnings: string[];
  disclaimer: string;
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
  xmlValidationJobs: WorkspaceRetentionRunBucket;
  invoiceExports: WorkspaceRetentionRunBucket;
  apiRequests: WorkspaceRetentionRunBucket;
  webhookDeliveries: WorkspaceRetentionRunBucket;
  viesEvidenceChecks: WorkspaceRetentionRunBucket;
  vidaSimulationRuns: WorkspaceRetentionRunBucket;
  activityEvents: WorkspaceRetentionRunBucket;
  privacyRequests: WorkspaceRetentionRunBucket;
  retentionRuns: WorkspaceRetentionRunBucket;
  deletionRuns: WorkspaceRetentionRunBucket;
  legalAcceptances: WorkspaceRetentionRunBucket;
  totalAffectedCount: number;
  totalExecutedCount: number;
  warnings: string[];
  disclaimer: string;
  errorMessage: string;
  executedAt: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceDeletionRunStatus = "prepared" | "executed" | "failed";

type WorkspaceDeletionRunRecordCounts = {
  invoiceDrafts: number;
  validationRuns: number;
  xmlReadinessReports: number;
  workspaceExportPackages: number;
  activityEvents: number;
  productionInvoices: number;
  businessProfiles: number;
  contacts: number;
  invoiceExports: number;
  vatNumberChecks: number;
  xmlValidationJobs: number;
  apiKeys: number;
  apiRequests: number;
  webhookEndpoints: number;
  webhookDeliveries: number;
  viesEvidenceChecks: number;
  vidaSimulationRuns: number;
  legalAcceptances: number;
  privacyRequestEvents: number;
  privacyAuditEvents: number;
};

type WorkspaceDeletionRun = {
  id: string;
  runType: "privacy_request_deletion";
  status: WorkspaceDeletionRunStatus;
  sourcePrivacyRequestId: string;
  affectedCounts: WorkspaceDeletionRunRecordCounts;
  executedCounts: WorkspaceDeletionRunRecordCounts;
  totalAffectedCount: number;
  totalExecutedCount: number;
  warnings: string[];
  disclaimer: string;
  errorMessage: string;
  executedAt: string;
  createdAt: string;
  updatedAt: string;
};

type PrivacyRequestType =
  | "data_export"
  | "export"
  | "deletion"
  | "access"
  | "correction"
  | "objection"
  | "restriction"
  | "portability"
  | "retention_review"
  | "other";

type PrivacyRequestStatus =
  | "submitted"
  | "in_review"
  | "awaiting_verification"
  | "approved"
  | "rejected"
  | "fulfilled"
  | "cancelled"
  | "completed";

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
  organizationProfile: number;
  members: number;
  invitations: number;
  businessProfiles: number;
  contacts: number;
  productionInvoices: number;
  invoiceLines: number;
  invoiceTaxes: number;
  invoiceAllowances: number;
  invoiceCharges: number;
  invoiceExports: number;
  invoiceDrafts: number;
  validationRuns: number;
  vatNumberChecks: number;
  viesEvidenceChecks: number;
  vidaSimulationRuns: number;
  xmlValidationJobs: number;
  xmlReadinessReports: number;
  workspaceSettings: number;
  apiKeys: number;
  apiRequests: number;
  webhookEndpoints: number;
  webhookDeliveries: number;
  legalAcceptances: number;
  privacyRequests: number;
  privacyRequestEvents: number;
  retentionRuns: number;
  deletionRuns: number;
  activityEvents: number;
  securityEvents: number;
  privacyAuditEvents: number;
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

type PrivacyDataMapRecord = {
  datasetKey: string;
  dataCategory: string;
  purpose: string;
  tableOrSource: string;
  defaultRetentionDays: number | null;
  exportable: boolean;
  deletable: boolean;
  anonymizable: boolean;
  rawPayloadStored: boolean;
  userFacingDescription: string;
  riskNote: string;
  legalReviewRequired: boolean;
};

type SubprocessorRecord = {
  providerKey: string;
  provider: string;
  status: "configured" | "not_configured" | "review_required";
  purpose: string;
  dataCategories: string[];
  region: string;
  legalReviewRequired: boolean;
  notes: string;
};

type CookieTrackingStanceRecord = {
  stance: "essential_only";
  essentialCookiesUsed: boolean;
  nonEssentialCookiesUsed: boolean;
  analyticsConfigured: boolean;
  preferenceStorage: "minimal";
  summary: string;
  legalReviewRequired: boolean;
};

type LegalAcceptanceRecord = {
  id: string;
  organizationId: string | null;
  userId: string;
  documentKey: string;
  title: string;
  version: string;
  acceptedAt: string;
  acceptanceContext: string;
};

const defaultWorkspaceSettings: WorkspaceSettings = {
  retentionMode: "manual",
  invoiceDraftRetentionDays: 365,
  validationRunRetentionDays: 365,
  xmlReportRetentionDays: 180,
  xmlValidationJobRetentionDays: 180,
  invoiceExportRetentionDays: 365,
  apiRequestLogRetentionDays: 180,
  webhookDeliveryLogRetentionDays: 180,
  viesEvidenceRetentionDays: 365,
  vidaSimulationRetentionDays: 365,
  activityLogRetentionDays: 365,
  privacyRequestRetentionDays: 1095,
  retentionRunRetentionDays: 1095,
  deletionRunRetentionDays: 1095,
  legalAcceptanceRetentionDays: 2555,
  storeUploadedXmlAfterValidation: false,
  retainValidationReports: true,
  retainViesEvidence: true,
  retainWebhookPayloadPreviews: false,
  allowDataExportRequests: true,
  allowDeletionRequests: true,
  includeApiLogsInExports: true,
  includeWebhookLogsInExports: true,
  includeLegalAcceptancesInExports: true,
  dataMinimizationMode: "standard",
  privacyContactEmail: "",
  securityContactEmail: "",
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

const emptyDeletionRunRecordCounts: WorkspaceDeletionRunRecordCounts = {
  invoiceDrafts: 0,
  validationRuns: 0,
  xmlReadinessReports: 0,
  workspaceExportPackages: 0,
  activityEvents: 0,
  productionInvoices: 0,
  businessProfiles: 0,
  contacts: 0,
  invoiceExports: 0,
  vatNumberChecks: 0,
  xmlValidationJobs: 0,
  apiKeys: 0,
  apiRequests: 0,
  webhookEndpoints: 0,
  webhookDeliveries: 0,
  viesEvidenceChecks: 0,
  vidaSimulationRuns: 0,
  legalAcceptances: 0,
  privacyRequestEvents: 0,
  privacyAuditEvents: 0
};

const emptyExportRecordCounts: WorkspaceExportPackageRecordCounts = {
  organizationProfile: 0,
  members: 0,
  invitations: 0,
  businessProfiles: 0,
  contacts: 0,
  productionInvoices: 0,
  invoiceLines: 0,
  invoiceTaxes: 0,
  invoiceAllowances: 0,
  invoiceCharges: 0,
  invoiceExports: 0,
  invoiceDrafts: 0,
  validationRuns: 0,
  vatNumberChecks: 0,
  viesEvidenceChecks: 0,
  vidaSimulationRuns: 0,
  xmlValidationJobs: 0,
  xmlReadinessReports: 0,
  workspaceSettings: 0,
  apiKeys: 0,
  apiRequests: 0,
  webhookEndpoints: 0,
  webhookDeliveries: 0,
  legalAcceptances: 0,
  privacyRequests: 0,
  privacyRequestEvents: 0,
  retentionRuns: 0,
  deletionRuns: 0,
  activityEvents: 0,
  securityEvents: 0,
  privacyAuditEvents: 0
};

const privacyControls: PrivacyControlCard[] = [
  {
    title: "Data export requests",
    description:
      "Prepare workspace-level controls for user-requested data exports across invoice drafts, validation reports, XML reports, privacy records, and activity records.",
    icon: <Download size={22} />
  },
  {
    title: "Deletion requests",
    description:
      "Prepare deletion-request handling for workspace-owned records while preserving clear review, audit, and legal-boundary warnings.",
    icon: <Trash2 size={22} />
  },
  {
    title: "Retention policy",
    description:
      "Control how long invoice drafts, validation reports, XML readiness reports, and activity events should remain available inside the platform.",
    icon: <Archive size={22} />
  },
  {
    title: "Data minimisation",
    description:
      "Keep the platform focused on structured invoice readiness data instead of storing unnecessary personal, tax, or document data.",
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

function normalizeDataMinimizationMode(value: string): DataMinimizationMode {
  if (value === "reduced" || value === "strict") {
    return value;
  }

  return "standard";
}

function normalizePrivacyRequestType(value: string): PrivacyRequestType {
  if (
    value === "data_export" ||
    value === "export" ||
    value === "deletion" ||
    value === "access" ||
    value === "correction" ||
    value === "objection" ||
    value === "restriction" ||
    value === "portability" ||
    value === "retention_review" ||
    value === "other"
  ) {
    return value;
  }

  return "data_export";
}

function normalizePrivacyRequestStatus(value: string): PrivacyRequestStatus {
  if (
    value === "submitted" ||
    value === "in_review" ||
    value === "awaiting_verification" ||
    value === "approved" ||
    value === "rejected" ||
    value === "fulfilled" ||
    value === "cancelled" ||
    value === "completed"
  ) {
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

function normalizeDeletionRunStatus(value: string): WorkspaceDeletionRunStatus {
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
    xmlValidationJobRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "xmlValidationJobRetentionDays",
        defaultWorkspaceSettings.xmlValidationJobRetentionDays
      )
    ),
    invoiceExportRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "invoiceExportRetentionDays",
        defaultWorkspaceSettings.invoiceExportRetentionDays
      )
    ),
    apiRequestLogRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "apiRequestLogRetentionDays",
        defaultWorkspaceSettings.apiRequestLogRetentionDays
      )
    ),
    webhookDeliveryLogRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "webhookDeliveryLogRetentionDays",
        defaultWorkspaceSettings.webhookDeliveryLogRetentionDays
      )
    ),
    viesEvidenceRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "viesEvidenceRetentionDays",
        defaultWorkspaceSettings.viesEvidenceRetentionDays
      )
    ),
    vidaSimulationRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "vidaSimulationRetentionDays",
        defaultWorkspaceSettings.vidaSimulationRetentionDays
      )
    ),
    activityLogRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "activityLogRetentionDays",
        defaultWorkspaceSettings.activityLogRetentionDays
      )
    ),
    privacyRequestRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "privacyRequestRetentionDays",
        defaultWorkspaceSettings.privacyRequestRetentionDays
      )
    ),
    retentionRunRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "retentionRunRetentionDays",
        defaultWorkspaceSettings.retentionRunRetentionDays
      )
    ),
    deletionRunRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "deletionRunRetentionDays",
        defaultWorkspaceSettings.deletionRunRetentionDays
      )
    ),
    legalAcceptanceRetentionDays: clampRetentionDays(
      readNumberField(
        record,
        "legalAcceptanceRetentionDays",
        defaultWorkspaceSettings.legalAcceptanceRetentionDays
      )
    ),
    storeUploadedXmlAfterValidation: readBooleanField(
      record,
      "storeUploadedXmlAfterValidation",
      defaultWorkspaceSettings.storeUploadedXmlAfterValidation
    ),
    retainValidationReports: readBooleanField(
      record,
      "retainValidationReports",
      defaultWorkspaceSettings.retainValidationReports
    ),
    retainViesEvidence: readBooleanField(
      record,
      "retainViesEvidence",
      defaultWorkspaceSettings.retainViesEvidence
    ),
    retainWebhookPayloadPreviews: readBooleanField(
      record,
      "retainWebhookPayloadPreviews",
      defaultWorkspaceSettings.retainWebhookPayloadPreviews
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
    includeApiLogsInExports: readBooleanField(
      record,
      "includeApiLogsInExports",
      defaultWorkspaceSettings.includeApiLogsInExports
    ),
    includeWebhookLogsInExports: readBooleanField(
      record,
      "includeWebhookLogsInExports",
      defaultWorkspaceSettings.includeWebhookLogsInExports
    ),
    includeLegalAcceptancesInExports: readBooleanField(
      record,
      "includeLegalAcceptancesInExports",
      defaultWorkspaceSettings.includeLegalAcceptancesInExports
    ),
    dataMinimizationMode: normalizeDataMinimizationMode(
      readStringField(
        record,
        "dataMinimizationMode",
        defaultWorkspaceSettings.dataMinimizationMode
      )
    ),
    privacyContactEmail: readStringField(record, "privacyContactEmail"),
    securityContactEmail: readStringField(record, "securityContactEmail"),
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
    xmlValidationJobs: normalizeRetentionPreviewBucket(
      record.xmlValidationJobs,
      settings.xmlValidationJobRetentionDays
    ),
    invoiceExports: normalizeRetentionPreviewBucket(
      record.invoiceExports,
      settings.invoiceExportRetentionDays
    ),
    apiRequests: normalizeRetentionPreviewBucket(
      record.apiRequests,
      settings.apiRequestLogRetentionDays
    ),
    webhookDeliveries: normalizeRetentionPreviewBucket(
      record.webhookDeliveries,
      settings.webhookDeliveryLogRetentionDays
    ),
    viesEvidenceChecks: normalizeRetentionPreviewBucket(
      record.viesEvidenceChecks,
      settings.viesEvidenceRetentionDays
    ),
    vidaSimulationRuns: normalizeRetentionPreviewBucket(
      record.vidaSimulationRuns,
      settings.vidaSimulationRetentionDays
    ),
    activityEvents: normalizeRetentionPreviewBucket(
      record.activityEvents,
      settings.activityLogRetentionDays
    ),
    privacyRequests: normalizeRetentionPreviewBucket(
      record.privacyRequests,
      settings.privacyRequestRetentionDays
    ),
    retentionRuns: normalizeRetentionPreviewBucket(
      record.retentionRuns,
      settings.retentionRunRetentionDays
    ),
    deletionRuns: normalizeRetentionPreviewBucket(
      record.deletionRuns,
      settings.deletionRunRetentionDays
    ),
    legalAcceptances: normalizeRetentionPreviewBucket(
      record.legalAcceptances,
      settings.legalAcceptanceRetentionDays
    ),
    warnings: Array.isArray(record.warnings)
      ? record.warnings.filter((item): item is string => typeof item === "string")
      : [],
    disclaimer: readStringField(record, "disclaimer")
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
    xmlValidationJobs: normalizeRetentionRunBucket(value.xmlValidationJobs),
    invoiceExports: normalizeRetentionRunBucket(value.invoiceExports),
    apiRequests: normalizeRetentionRunBucket(value.apiRequests),
    webhookDeliveries: normalizeRetentionRunBucket(value.webhookDeliveries),
    viesEvidenceChecks: normalizeRetentionRunBucket(value.viesEvidenceChecks),
    vidaSimulationRuns: normalizeRetentionRunBucket(value.vidaSimulationRuns),
    activityEvents: normalizeRetentionRunBucket(value.activityEvents),
    privacyRequests: normalizeRetentionRunBucket(value.privacyRequests),
    retentionRuns: normalizeRetentionRunBucket(value.retentionRuns),
    deletionRuns: normalizeRetentionRunBucket(value.deletionRuns),
    legalAcceptances: normalizeRetentionRunBucket(value.legalAcceptances),
    totalAffectedCount: Math.max(
      0,
      readNumberField(value, "totalAffectedCount", 0)
    ),
    totalExecutedCount: Math.max(
      0,
      readNumberField(value, "totalExecutedCount", 0)
    ),
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((item): item is string => typeof item === "string")
      : [],
    disclaimer: readStringField(value, "disclaimer"),
    errorMessage: readStringField(value, "errorMessage"),
    executedAt: readStringField(value, "executedAt"),
    createdAt,
    updatedAt: readStringField(value, "updatedAt")
  };
}

function normalizeDeletionRunRecordCounts(
  value: unknown
): WorkspaceDeletionRunRecordCounts {
  if (!isPlainObject(value)) {
    return emptyDeletionRunRecordCounts;
  }

  return {
    invoiceDrafts: Math.max(0, readNumberField(value, "invoiceDrafts", 0)),
    validationRuns: Math.max(0, readNumberField(value, "validationRuns", 0)),
    xmlReadinessReports: Math.max(
      0,
      readNumberField(value, "xmlReadinessReports", 0)
    ),
    workspaceExportPackages: Math.max(
      0,
      readNumberField(value, "workspaceExportPackages", 0)
    ),
    activityEvents: Math.max(0, readNumberField(value, "activityEvents", 0)),
    productionInvoices: Math.max(
      0,
      readNumberField(value, "productionInvoices", 0)
    ),
    businessProfiles: Math.max(0, readNumberField(value, "businessProfiles", 0)),
    contacts: Math.max(0, readNumberField(value, "contacts", 0)),
    invoiceExports: Math.max(0, readNumberField(value, "invoiceExports", 0)),
    vatNumberChecks: Math.max(0, readNumberField(value, "vatNumberChecks", 0)),
    xmlValidationJobs: Math.max(
      0,
      readNumberField(value, "xmlValidationJobs", 0)
    ),
    apiKeys: Math.max(0, readNumberField(value, "apiKeys", 0)),
    apiRequests: Math.max(0, readNumberField(value, "apiRequests", 0)),
    webhookEndpoints: Math.max(
      0,
      readNumberField(value, "webhookEndpoints", 0)
    ),
    webhookDeliveries: Math.max(
      0,
      readNumberField(value, "webhookDeliveries", 0)
    ),
    viesEvidenceChecks: Math.max(
      0,
      readNumberField(value, "viesEvidenceChecks", 0)
    ),
    vidaSimulationRuns: Math.max(
      0,
      readNumberField(value, "vidaSimulationRuns", 0)
    ),
    legalAcceptances: Math.max(0, readNumberField(value, "legalAcceptances", 0)),
    privacyRequestEvents: Math.max(
      0,
      readNumberField(value, "privacyRequestEvents", 0)
    ),
    privacyAuditEvents: Math.max(
      0,
      readNumberField(value, "privacyAuditEvents", 0)
    )
  };
}

function sumDeletionRunRecordCounts(counts: WorkspaceDeletionRunRecordCounts) {
  return (
    counts.invoiceDrafts +
    counts.validationRuns +
    counts.xmlReadinessReports +
    counts.workspaceExportPackages +
    counts.activityEvents +
    counts.productionInvoices +
    counts.businessProfiles +
    counts.contacts +
    counts.invoiceExports +
    counts.vatNumberChecks +
    counts.xmlValidationJobs +
    counts.apiKeys +
    counts.apiRequests +
    counts.webhookEndpoints +
    counts.webhookDeliveries +
    counts.viesEvidenceChecks +
    counts.vidaSimulationRuns +
    counts.legalAcceptances +
    counts.privacyRequestEvents +
    counts.privacyAuditEvents
  );
}

function normalizeWorkspaceDeletionRun(
  value: unknown
): WorkspaceDeletionRun | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const createdAt = readStringField(value, "createdAt");

  if (!id || !createdAt) {
    return null;
  }

  const affectedCounts = normalizeDeletionRunRecordCounts(value.affectedCounts);
  const executedCounts = normalizeDeletionRunRecordCounts(value.executedCounts);

  return {
    id,
    runType: "privacy_request_deletion",
    status: normalizeDeletionRunStatus(readStringField(value, "status")),
    sourcePrivacyRequestId: readStringField(value, "sourcePrivacyRequestId"),
    affectedCounts,
    executedCounts,
    totalAffectedCount: Math.max(
      0,
      readNumberField(
        value,
        "totalAffectedCount",
        sumDeletionRunRecordCounts(affectedCounts)
      )
    ),
    totalExecutedCount: Math.max(
      0,
      readNumberField(
        value,
        "totalExecutedCount",
        sumDeletionRunRecordCounts(executedCounts)
      )
    ),
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((item): item is string => typeof item === "string")
      : [],
    disclaimer: readStringField(value, "disclaimer"),
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
    organizationProfile: readNumberField(value, "organizationProfile", 0),
    members: readNumberField(value, "members", 0),
    invitations: readNumberField(value, "invitations", 0),
    businessProfiles: readNumberField(value, "businessProfiles", 0),
    contacts: readNumberField(value, "contacts", 0),
    productionInvoices: readNumberField(value, "productionInvoices", 0),
    invoiceLines: readNumberField(value, "invoiceLines", 0),
    invoiceTaxes: readNumberField(value, "invoiceTaxes", 0),
    invoiceAllowances: readNumberField(value, "invoiceAllowances", 0),
    invoiceCharges: readNumberField(value, "invoiceCharges", 0),
    invoiceExports: readNumberField(value, "invoiceExports", 0),
    invoiceDrafts: readNumberField(value, "invoiceDrafts", 0),
    validationRuns: readNumberField(value, "validationRuns", 0),
    vatNumberChecks: readNumberField(value, "vatNumberChecks", 0),
    viesEvidenceChecks: readNumberField(value, "viesEvidenceChecks", 0),
    vidaSimulationRuns: readNumberField(value, "vidaSimulationRuns", 0),
    xmlValidationJobs: readNumberField(value, "xmlValidationJobs", 0),
    xmlReadinessReports: readNumberField(value, "xmlReadinessReports", 0),
    workspaceSettings: readNumberField(value, "workspaceSettings", 0),
    apiKeys: readNumberField(value, "apiKeys", 0),
    apiRequests: readNumberField(value, "apiRequests", 0),
    webhookEndpoints: readNumberField(value, "webhookEndpoints", 0),
    webhookDeliveries: readNumberField(value, "webhookDeliveries", 0),
    legalAcceptances: readNumberField(value, "legalAcceptances", 0),
    privacyRequests: readNumberField(value, "privacyRequests", 0),
    privacyRequestEvents: readNumberField(value, "privacyRequestEvents", 0),
    retentionRuns: readNumberField(value, "retentionRuns", 0),
    deletionRuns: readNumberField(value, "deletionRuns", 0),
    activityEvents: readNumberField(value, "activityEvents", 0),
    securityEvents: readNumberField(value, "securityEvents", 0),
    privacyAuditEvents: readNumberField(value, "privacyAuditEvents", 0)
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
    xmlValidationJobRetentionDays: clampRetentionDays(
      settings.xmlValidationJobRetentionDays
    ),
    invoiceExportRetentionDays: clampRetentionDays(
      settings.invoiceExportRetentionDays
    ),
    apiRequestLogRetentionDays: clampRetentionDays(
      settings.apiRequestLogRetentionDays
    ),
    webhookDeliveryLogRetentionDays: clampRetentionDays(
      settings.webhookDeliveryLogRetentionDays
    ),
    viesEvidenceRetentionDays: clampRetentionDays(
      settings.viesEvidenceRetentionDays
    ),
    vidaSimulationRetentionDays: clampRetentionDays(
      settings.vidaSimulationRetentionDays
    ),
    activityLogRetentionDays: clampRetentionDays(settings.activityLogRetentionDays),
    privacyRequestRetentionDays: clampRetentionDays(
      settings.privacyRequestRetentionDays
    ),
    retentionRunRetentionDays: clampRetentionDays(settings.retentionRunRetentionDays),
    deletionRunRetentionDays: clampRetentionDays(settings.deletionRunRetentionDays),
    legalAcceptanceRetentionDays: clampRetentionDays(
      settings.legalAcceptanceRetentionDays
    ),
    storeUploadedXmlAfterValidation: settings.storeUploadedXmlAfterValidation,
    retainValidationReports: settings.retainValidationReports,
    retainViesEvidence: settings.retainViesEvidence,
    retainWebhookPayloadPreviews: settings.retainWebhookPayloadPreviews,
    allowDataExportRequests: settings.allowDataExportRequests,
    allowDeletionRequests: settings.allowDeletionRequests,
    includeApiLogsInExports: settings.includeApiLogsInExports,
    includeWebhookLogsInExports: settings.includeWebhookLogsInExports,
    includeLegalAcceptancesInExports: settings.includeLegalAcceptancesInExports,
    dataMinimizationMode: settings.dataMinimizationMode,
    privacyContactEmail: settings.privacyContactEmail.trim(),
    securityContactEmail: settings.securityContactEmail.trim()
  };
}

function normalizePrivacyDataMapRecord(value: unknown): PrivacyDataMapRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const datasetKey = readStringField(value, "datasetKey");
  const dataCategory = readStringField(value, "dataCategory");

  if (!datasetKey || !dataCategory) {
    return null;
  }

  return {
    datasetKey,
    dataCategory,
    purpose: readStringField(value, "purpose"),
    tableOrSource: readStringField(value, "tableOrSource"),
    defaultRetentionDays:
      typeof value.defaultRetentionDays === "number"
        ? value.defaultRetentionDays
        : null,
    exportable: readBooleanField(value, "exportable", false),
    deletable: readBooleanField(value, "deletable", false),
    anonymizable: readBooleanField(value, "anonymizable", false),
    rawPayloadStored: readBooleanField(value, "rawPayloadStored", false),
    userFacingDescription: readStringField(value, "userFacingDescription"),
    riskNote: readStringField(value, "riskNote"),
    legalReviewRequired: readBooleanField(value, "legalReviewRequired", true)
  };
}

function normalizeSubprocessorRecord(value: unknown): SubprocessorRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const provider = readStringField(value, "provider");
  const providerName = readStringField(value, "providerName", provider);
  const providerKey = readStringField(
    value,
    "providerKey",
    providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  );

  if (!providerKey || !providerName) {
    return null;
  }

  const status = readStringField(value, "status");

  return {
    providerKey,
    provider: providerName,
    status:
      status === "configured" ||
      status === "not_configured" ||
      status === "review_required"
        ? status
        : "review_required",
    purpose: readStringField(value, "purpose"),
    dataCategories: Array.isArray(value.dataCategories)
      ? value.dataCategories.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    region: readStringField(value, "region", "review_required"),
    legalReviewRequired: readBooleanField(value, "legalReviewRequired", true),
    notes: readStringField(value, "notes")
  };
}

function normalizeCookieTrackingStanceRecord(
  value: unknown
): CookieTrackingStanceRecord | null {
  const record = isPlainObject(value) && isPlainObject(value.record)
    ? value.record
    : value;

  if (!isPlainObject(record)) {
    return null;
  }

  return {
    stance: "essential_only",
    essentialCookiesUsed: readBooleanField(record, "essentialCookiesUsed", true),
    nonEssentialCookiesUsed: readBooleanField(
      record,
      "nonEssentialCookiesUsed",
      false
    ),
    analyticsConfigured: readBooleanField(record, "analyticsConfigured", false),
    preferenceStorage: "minimal",
    summary: readStringField(record, "summary"),
    legalReviewRequired: readBooleanField(record, "legalReviewRequired", true)
  };
}

function normalizeLegalAcceptanceRecord(
  value: unknown
): LegalAcceptanceRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const documentKey = readStringField(value, "documentKey");
  const title = readStringField(value, "title");

  if (!id || !documentKey || !title) {
    return null;
  }

  return {
    id,
    organizationId: readStringField(value, "organizationId") || null,
    userId: readStringField(value, "userId"),
    documentKey,
    title,
    version: readStringField(value, "version"),
    acceptedAt: readStringField(value, "acceptedAt"),
    acceptanceContext: readStringField(value, "acceptanceContext")
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
  if (value === "access") {
    return "Access request";
  }

  if (value === "correction") {
    return "Correction request";
  }

  if (value === "deletion") {
    return "Deletion request";
  }

  if (value === "objection") {
    return "Objection request";
  }

  if (value === "restriction") {
    return "Restriction request";
  }

  if (value === "portability") {
    return "Portability request";
  }

  if (value === "retention_review") {
    return "Retention review";
  }

  if (value === "other") {
    return "Other request";
  }

  return "Data export";
}

function formatPrivacyRequestStatus(value: PrivacyRequestStatus) {
  if (value === "awaiting_verification") {
    return "Awaiting verification";
  }

  if (value === "approved") {
    return "Approved";
  }

  if (value === "in_review") {
    return "In review";
  }

  if (value === "fulfilled") {
    return "Fulfilled";
  }

  if (value === "cancelled") {
    return "Cancelled";
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

function formatDeletionRunStatus(value: WorkspaceDeletionRunStatus) {
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
    `${counts.organizationProfile} organization profile`,
    `${counts.members} member(s)`,
    `${counts.invoiceDrafts} draft(s)`,
    `${counts.validationRuns} validation run(s)`,
    `${counts.xmlValidationJobs} XML job(s)`,
    `${counts.xmlReadinessReports} XML report(s)`,
    `${counts.invoiceExports} invoice export(s)`,
    `${counts.apiRequests} API request(s)`,
    `${counts.webhookDeliveries} webhook delivery log(s)`,
    `${counts.viesEvidenceChecks} VIES evidence record(s)`,
    `${counts.vidaSimulationRuns} ViDA run(s)`,
    `${counts.legalAcceptances} legal acceptance(s)`,
    `${counts.privacyRequests} privacy request(s)`,
    `${counts.retentionRuns} retention run(s)`,
    `${counts.deletionRuns} deletion run(s)`,
    `${counts.activityEvents} activity event(s)`
  ].join(" - ");
}

function formatRetentionRunCounts(record: WorkspaceRetentionRun) {
  return [
    `${record.invoiceDrafts.affectedCount} draft(s)`,
    `${record.validationRuns.affectedCount} validation run(s)`,
    `${record.xmlValidationJobs.affectedCount} XML job(s)`,
    `${record.xmlReadinessReports.affectedCount} XML report(s)`,
    `${record.invoiceExports.affectedCount} invoice export(s)`,
    `${record.apiRequests.affectedCount} API log(s)`,
    `${record.webhookDeliveries.affectedCount} webhook log(s)`,
    `${record.viesEvidenceChecks.affectedCount} VIES evidence record(s)`,
    `${record.vidaSimulationRuns.affectedCount} ViDA run(s)`,
    `${record.activityEvents.affectedCount} activity event(s)`,
    `${record.privacyRequests.affectedCount} privacy request(s)`,
    `${record.legalAcceptances.affectedCount} legal acceptance(s)`
  ].join(" - ");
}

function formatRetentionRunExecutedCounts(record: WorkspaceRetentionRun) {
  return [
    `${record.invoiceDrafts.executedCount} draft(s)`,
    `${record.validationRuns.executedCount} validation run(s)`,
    `${record.xmlValidationJobs.executedCount} XML job(s)`,
    `${record.xmlReadinessReports.executedCount} XML report(s)`,
    `${record.invoiceExports.executedCount} invoice export(s)`,
    `${record.apiRequests.executedCount} API log(s)`,
    `${record.webhookDeliveries.executedCount} webhook log(s)`,
    `${record.viesEvidenceChecks.executedCount} VIES evidence record(s)`,
    `${record.vidaSimulationRuns.executedCount} ViDA run(s)`,
    `${record.activityEvents.executedCount} activity event(s)`,
    `${record.privacyRequests.executedCount} privacy request(s)`,
    `${record.legalAcceptances.executedCount} legal acceptance(s)`
  ].join(" - ");
}

function formatDeletionRunRecordCounts(counts: WorkspaceDeletionRunRecordCounts) {
  return [
    `${counts.invoiceDrafts} draft(s)`,
    `${counts.validationRuns} validation run(s)`,
    `${counts.xmlReadinessReports} XML report(s)`,
    `${counts.workspaceExportPackages} export package(s)`,
    `${counts.productionInvoices} production invoice(s)`,
    `${counts.businessProfiles} business profile(s)`,
    `${counts.contacts} contact(s)`,
    `${counts.invoiceExports} invoice export(s)`,
    `${counts.vatNumberChecks} VAT check(s)`,
    `${counts.xmlValidationJobs} XML job(s)`,
    `${counts.apiKeys} API key record(s)`,
    `${counts.apiRequests} API request(s)`,
    `${counts.webhookEndpoints} webhook endpoint(s)`,
    `${counts.webhookDeliveries} webhook delivery log(s)`,
    `${counts.viesEvidenceChecks} VIES evidence record(s)`,
    `${counts.vidaSimulationRuns} ViDA run(s)`,
    `${counts.legalAcceptances} preserved legal acceptance(s)`,
    `${counts.privacyRequestEvents} privacy request event(s)`,
    `${counts.privacyAuditEvents} privacy audit event(s)`,
    `${counts.activityEvents} activity event(s)`
  ].join(" - ");
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
  const [deletionRuns, setDeletionRuns] = useState<WorkspaceDeletionRun[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<
    WorkspacePrivacyRequest[]
  >([]);
  const [requestReviewDrafts, setRequestReviewDrafts] = useState<
    Record<string, PrivacyRequestReviewDraft>
  >({});

  const [exportPackages, setExportPackages] = useState<WorkspaceExportPackage[]>(
    []
  );
  const [privacyDataMapRecords, setPrivacyDataMapRecords] = useState<
    PrivacyDataMapRecord[]
  >([]);
  const [subprocessors, setSubprocessors] = useState<SubprocessorRecord[]>([]);
  const [cookieTrackingStance, setCookieTrackingStance] =
    useState<CookieTrackingStanceRecord | null>(null);
  const [myLegalAcceptances, setMyLegalAcceptances] = useState<
    LegalAcceptanceRecord[]
  >([]);
  const [workspaceLegalAcceptances, setWorkspaceLegalAcceptances] = useState<
    LegalAcceptanceRecord[]
  >([]);
  const [exportName, setExportName] = useState(buildDefaultExportName);
  const [sourcePrivacyRequestId, setSourcePrivacyRequestId] = useState("");
  const [sourceDeletionPrivacyRequestId, setSourceDeletionPrivacyRequestId] =
    useState("");

  const [requestType, setRequestType] =
    useState<PrivacyRequestType>("data_export");
  const [requestSubject, setRequestSubject] = useState("");
  const [requestDetails, setRequestDetails] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRetentionPreview, setIsLoadingRetentionPreview] =
    useState(true);
  const [isLoadingRetentionRuns, setIsLoadingRetentionRuns] = useState(true);
  const [isLoadingDeletionRuns, setIsLoadingDeletionRuns] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isLoadingExportPackages, setIsLoadingExportPackages] = useState(true);
  const [isLoadingPrivacyOverview, setIsLoadingPrivacyOverview] = useState(true);
  const [isLoadingLegalAcceptances, setIsLoadingLegalAcceptances] =
    useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingRetentionRun, setIsPreparingRetentionRun] = useState(false);
  const [isPreparingDeletionRun, setIsPreparingDeletionRun] = useState(false);
  const [executingRetentionRunId, setExecutingRetentionRunId] = useState("");
  const [executingDeletionRunId, setExecutingDeletionRunId] = useState("");
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
  const [deletionRunStatusMessage, setDeletionRunStatusMessage] = useState("");
  const [deletionRunErrorMessage, setDeletionRunErrorMessage] = useState("");
  const [requestStatusMessage, setRequestStatusMessage] = useState("");
  const [requestErrorMessage, setRequestErrorMessage] = useState("");
  const [exportStatusMessage, setExportStatusMessage] = useState("");
  const [exportErrorMessage, setExportErrorMessage] = useState("");
  const [privacyOverviewStatusMessage, setPrivacyOverviewStatusMessage] =
    useState("");
  const [privacyOverviewErrorMessage, setPrivacyOverviewErrorMessage] =
    useState("");
  const [legalAcceptanceStatusMessage, setLegalAcceptanceStatusMessage] =
    useState("");
  const [legalAcceptanceErrorMessage, setLegalAcceptanceErrorMessage] =
    useState("");

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
          readErrorMessage(
            responseData,
            "Could not load workspace privacy settings. Owner or admin role may be required."
          )
        );
        setIsLoading(false);
        return;
      }

      setSettings(normalizeWorkspaceSettings(responseData));
      setStatusMessage("Workspace privacy settings loaded.");
      setIsLoading(false);
    } catch {
      setErrorMessage("Could not load workspace privacy settings.");
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
          readErrorMessage(
            responseData,
            "Could not load retention preview. Owner or admin role may be required."
          )
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
      setRetentionPreviewErrorMessage("Could not load retention preview.");
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
          readErrorMessage(
            responseData,
            "Could not load retention run history. Owner or admin role may be required."
          )
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
      setRetentionRunErrorMessage("Could not load retention run history.");
      setIsLoadingRetentionRuns(false);
    }
  }

  async function loadDeletionRuns() {
    setIsLoadingDeletionRuns(true);
    setDeletionRunStatusMessage("");
    setDeletionRunErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/deletion-runs", {
        method: "GET",
        cache: "no-store"
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setDeletionRuns([]);
        setDeletionRunErrorMessage(
          readErrorMessage(
            responseData,
            "Could not load deletion run history. Owner or admin role may be required."
          )
        );
        setIsLoadingDeletionRuns(false);
        return;
      }

      const records = getRecordsFromResponse(responseData)
        .map((record) => normalizeWorkspaceDeletionRun(record))
        .filter((record): record is WorkspaceDeletionRun => record !== null);

      setDeletionRuns(records);
      setDeletionRunStatusMessage("Deletion run history loaded.");
      setIsLoadingDeletionRuns(false);
    } catch {
      setDeletionRuns([]);
      setDeletionRunErrorMessage("Could not load deletion run history.");
      setIsLoadingDeletionRuns(false);
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
          readErrorMessage(
            responseData,
            "Could not load privacy requests. Owner or admin role may be required."
          )
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
      setRequestErrorMessage("Could not load privacy requests.");
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
          readErrorMessage(
            responseData,
            "Could not load workspace export packages. Owner or admin role may be required."
          )
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
      setExportErrorMessage("Could not load workspace export packages.");
      setIsLoadingExportPackages(false);
    }
  }

  async function loadPrivacyOverview() {
    setIsLoadingPrivacyOverview(true);
    setPrivacyOverviewStatusMessage("");
    setPrivacyOverviewErrorMessage("");

    try {
      const [dataMapResponse, subprocessorsResponse, cookieResponse] =
        await Promise.all([
          fetch("/api/local/workspace/privacy/data-map", {
            method: "GET",
            cache: "no-store"
          }),
          fetch("/api/local/workspace/privacy/subprocessors", {
            method: "GET",
            cache: "no-store"
          }),
          fetch("/api/local/workspace/privacy/cookie-stance", {
            method: "GET",
            cache: "no-store"
          })
        ]);

      const dataMapData = await readResponseBody(dataMapResponse);
      const subprocessorsData = await readResponseBody(subprocessorsResponse);
      const cookieData = await readResponseBody(cookieResponse);

      if (!dataMapResponse.ok || !subprocessorsResponse.ok || !cookieResponse.ok) {
        setPrivacyDataMapRecords([]);
        setSubprocessors([]);
        setCookieTrackingStance(null);
        setPrivacyOverviewErrorMessage(
          readErrorMessage(
            dataMapData ?? subprocessorsData ?? cookieData,
            "Could not load privacy data map, subprocessor, or cookie stance. Owner or admin role may be required."
          )
        );
        setIsLoadingPrivacyOverview(false);
        return;
      }

      const dataMapRecords = getRecordsFromResponse(dataMapData)
        .map((record) => normalizePrivacyDataMapRecord(record))
        .filter((record): record is PrivacyDataMapRecord => record !== null);
      const subprocessorRecords = getRecordsFromResponse(subprocessorsData)
        .map((record) => normalizeSubprocessorRecord(record))
        .filter((record): record is SubprocessorRecord => record !== null);

      setPrivacyDataMapRecords(dataMapRecords);
      setSubprocessors(subprocessorRecords);
      setCookieTrackingStance(normalizeCookieTrackingStanceRecord(cookieData));
      setPrivacyOverviewStatusMessage("Privacy overview loaded.");
      setIsLoadingPrivacyOverview(false);
    } catch {
      setPrivacyDataMapRecords([]);
      setSubprocessors([]);
      setCookieTrackingStance(null);
      setPrivacyOverviewErrorMessage("Could not load privacy overview.");
      setIsLoadingPrivacyOverview(false);
    }
  }

  async function loadLegalAcceptances() {
    setIsLoadingLegalAcceptances(true);
    setLegalAcceptanceStatusMessage("");
    setLegalAcceptanceErrorMessage("");

    try {
      const [myResponse, workspaceResponse] = await Promise.all([
        fetch("/api/local/legal/acceptances/me", {
          method: "GET",
          cache: "no-store"
        }),
        fetch("/api/local/legal/acceptances/workspace", {
          method: "GET",
          cache: "no-store"
        })
      ]);

      const myData = await readResponseBody(myResponse);
      const workspaceData = await readResponseBody(workspaceResponse);

      if (!myResponse.ok || !workspaceResponse.ok) {
        setMyLegalAcceptances([]);
        setWorkspaceLegalAcceptances([]);
        setLegalAcceptanceErrorMessage(
          readErrorMessage(
            myData ?? workspaceData,
            "Could not load legal acceptance status. Signed-in owner/admin access may be required."
          )
        );
        setIsLoadingLegalAcceptances(false);
        return;
      }

      const myRecords = getRecordsFromResponse(myData)
        .map((record) => normalizeLegalAcceptanceRecord(record))
        .filter((record): record is LegalAcceptanceRecord => record !== null);
      const workspaceRecords = getRecordsFromResponse(workspaceData)
        .map((record) => normalizeLegalAcceptanceRecord(record))
        .filter((record): record is LegalAcceptanceRecord => record !== null);

      setMyLegalAcceptances(myRecords);
      setWorkspaceLegalAcceptances(workspaceRecords);
      setLegalAcceptanceStatusMessage("Legal acceptance status loaded.");
      setIsLoadingLegalAcceptances(false);
    } catch {
      setMyLegalAcceptances([]);
      setWorkspaceLegalAcceptances([]);
      setLegalAcceptanceErrorMessage("Could not load legal acceptance status.");
      setIsLoadingLegalAcceptances(false);
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
        setErrorMessage(
          readErrorMessage(
            responseData,
            "Could not save workspace privacy settings. Owner or admin role may be required."
          )
        );
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
        setRetentionRunErrorMessage(
          readErrorMessage(
            responseData,
            "Could not prepare retention run. Owner or admin role may be required."
          )
        );
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

  async function prepareDeletionRun() {
    if (!sourceDeletionPrivacyRequestId) {
      setDeletionRunErrorMessage("Choose a deletion privacy request first.");
      return;
    }

    if (!settings.allowDeletionRequests) {
      setDeletionRunErrorMessage("Deletion requests are disabled in workspace settings.");
      return;
    }

    setIsPreparingDeletionRun(true);
    setDeletionRunStatusMessage("");
    setDeletionRunErrorMessage("");

    try {
      const response = await fetch("/api/local/workspace/deletion-runs", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          sourcePrivacyRequestId: sourceDeletionPrivacyRequestId
        })
      });

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setDeletionRunErrorMessage(
          readErrorMessage(
            responseData,
            "Could not prepare deletion run. Owner or admin role may be required."
          )
        );
        setIsPreparingDeletionRun(false);
        return;
      }

      const recordSource = getSingleRecordFromResponse(responseData);
      const createdRecord = normalizeWorkspaceDeletionRun(recordSource);

      if (createdRecord) {
        setDeletionRuns((currentRuns) => [
          createdRecord,
          ...currentRuns.filter((run) => run.id !== createdRecord.id)
        ]);
      }

      setDeletionRunStatusMessage(
        "Deletion run prepared. No records were deleted."
      );
      setIsPreparingDeletionRun(false);
    } catch {
      setDeletionRunErrorMessage("Could not prepare deletion run.");
      setIsPreparingDeletionRun(false);
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
          readErrorMessage(
            responseData,
            "Could not execute retention run. Owner or admin role may be required."
          )
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

  async function executeDeletionRun(deletionRunId: string) {
    const confirmed = window.confirm(
      "Execute this deletion run? This can permanently delete workspace records connected to the selected deletion review. Continue only if the deletion request has been properly reviewed."
    );

    if (!confirmed) {
      return;
    }

    setExecutingDeletionRunId(deletionRunId);
    setDeletionRunStatusMessage("");
    setDeletionRunErrorMessage("");

    try {
      const response = await fetch(
        `/api/local/workspace/deletion-runs/${encodeURIComponent(
          deletionRunId
        )}/execute`,
        {
          method: "POST",
          cache: "no-store"
        }
      );

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setDeletionRunErrorMessage(
          readErrorMessage(
            responseData,
            "Could not execute deletion run. Owner or admin role may be required."
          )
        );
        setExecutingDeletionRunId("");
        return;
      }

      const recordSource = getSingleRecordFromResponse(responseData);
      const executedRecord = normalizeWorkspaceDeletionRun(recordSource);

      if (executedRecord) {
        setDeletionRuns((currentRuns) =>
          currentRuns.map((run) =>
            run.id === executedRecord.id ? executedRecord : run
          )
        );
      }

      setDeletionRunStatusMessage(
        "Deletion run executed. Workspace records were deleted according to the prepared deletion review."
      );
      setExecutingDeletionRunId("");

      void loadDeletionRuns();
      void loadPrivacyRequests();
      void loadExportPackages();
      void loadRetentionPreview();
      void loadRetentionRuns();
    } catch {
      setDeletionRunErrorMessage("Could not execute deletion run.");
      setExecutingDeletionRunId("");
    }
  }

  async function submitPrivacyRequest() {
    const cleanSubject = requestSubject.trim();
    const cleanDetails = requestDetails.trim();

    if (cleanSubject.length < 3) {
      setRequestErrorMessage("Request subject must contain at least 3 characters.");
      return;
    }

    if (
      (requestType === "data_export" || requestType === "export") &&
      !settings.allowDataExportRequests
    ) {
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
        setRequestErrorMessage(
          readErrorMessage(responseData, "Could not submit privacy request.")
        );
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

        if (
          createdRecord.requestType === "data_export" ||
          createdRecord.requestType === "export"
        ) {
          setSourcePrivacyRequestId(createdRecord.id);
        }

        if (createdRecord.requestType === "deletion") {
          setSourceDeletionPrivacyRequestId(createdRecord.id);
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
        setRequestErrorMessage(
          readErrorMessage(
            responseData,
            "Could not update privacy request status. Owner or admin role may be required."
          )
        );
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
        setExportErrorMessage(
          readErrorMessage(
            responseData,
            "Could not create export package. Owner or admin role may be required."
          )
        );
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
        setExportErrorMessage(
          readErrorMessage(responseData, "Could not load export package payload.")
        );
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
    void loadDeletionRuns();
    void loadPrivacyRequests();
    void loadExportPackages();
    void loadPrivacyOverview();
    void loadLegalAcceptances();
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
        label: "XML validation job retention",
        value: `${settings.xmlValidationJobRetentionDays} days`
      },
      {
        label: "Invoice export retention",
        value: `${settings.invoiceExportRetentionDays} days`
      },
      {
        label: "API request log retention",
        value: `${settings.apiRequestLogRetentionDays} days`
      },
      {
        label: "Webhook delivery log retention",
        value: `${settings.webhookDeliveryLogRetentionDays} days`
      },
      {
        label: "VIES evidence retention",
        value: `${settings.viesEvidenceRetentionDays} days`
      },
      {
        label: "ViDA simulation retention",
        value: `${settings.vidaSimulationRetentionDays} days`
      },
      {
        label: "Activity log retention",
        value: `${settings.activityLogRetentionDays} days`
      },
      {
        label: "Legal acceptance retention",
        value: `${settings.legalAcceptanceRetentionDays} days`
      },
      {
        label: "Data minimization mode",
        value: settings.dataMinimizationMode
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
        label: "API logs in exports",
        value: settings.includeApiLogsInExports ? "Included" : "Excluded"
      },
      {
        label: "Webhook logs in exports",
        value: settings.includeWebhookLogsInExports ? "Included" : "Excluded"
      },
      {
        label: "Legal acceptances in exports",
        value: settings.includeLegalAcceptancesInExports ? "Included" : "Excluded"
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
        label: "XML validation jobs",
        bucket: retentionPreview.xmlValidationJobs,
        description: "XML validation jobs older than the XML job retention window."
      },
      {
        label: "Invoice exports",
        bucket: retentionPreview.invoiceExports,
        description: "Generated invoice export metadata older than the export retention window."
      },
      {
        label: "API request logs",
        bucket: retentionPreview.apiRequests,
        description: "Developer API request metadata older than the API log retention window."
      },
      {
        label: "Webhook delivery logs",
        bucket: retentionPreview.webhookDeliveries,
        description: "Webhook simulator delivery metadata older than the webhook log window."
      },
      {
        label: "VIES evidence",
        bucket: retentionPreview.viesEvidenceChecks,
        description: "VIES evidence metadata older than the VIES evidence window."
      },
      {
        label: "ViDA simulation runs",
        bucket: retentionPreview.vidaSimulationRuns,
        description: "Saved ViDA-readiness simulation runs older than the simulation window."
      },
      {
        label: "Workspace activity events",
        bucket: retentionPreview.activityEvents,
        description: "Audit/activity records older than the activity log retention window."
      },
      {
        label: "Legal acceptance records",
        bucket: retentionPreview.legalAcceptances,
        description:
          "Acceptance records are counted for policy review and preserved by default."
      }
    ];
  }, [retentionPreview]);

  const dataExportPrivacyRequests = useMemo(() => {
    return privacyRequests.filter(
      (request) =>
        request.requestType === "data_export" || request.requestType === "export"
    );
  }, [privacyRequests]);

  const deletionPrivacyRequests = useMemo(() => {
    return privacyRequests.filter((request) => request.requestType === "deletion");
  }, [privacyRequests]);

  const selectedRequestTypeAllowed =
    requestType === "data_export" || requestType === "export"
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

  const canPrepareDeletionRun =
    settings.allowDeletionRequests &&
    sourceDeletionPrivacyRequestId.length > 0 &&
    !isPreparingDeletionRun;

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Privacy and audit</p>
        <h2>GDPR-oriented controls for invoice data.</h2>
        <p>
          Configure workspace-level privacy settings for retention, data exports,
          deletion requests, and data minimisation boundaries. Privacy
          administration is restricted to owner and admin workspace roles. These
          controls are platform settings only; they do not replace legal, tax,
          accounting, statutory-retention, or authority recordkeeping obligations.
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

      <section className="workspace-alerts">
        <div className="alerts-head">
          <LockKeyhole size={22} />
          <div>
            <p>Access boundary</p>
            <h3>Owner/admin privacy administration.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              Privacy settings, privacy-request review, export package
              preparation, retention runs, and deletion runs are restricted to
              owner and admin workspace roles.
            </p>
          </div>
          <div className="alert-item">
            <span />
            <p>
              Deletion and retention execution can remove workspace records. Use
              these controls only after internal review and any required
              professional or legal assessment.
            </p>
          </div>
        </div>
      </section>

      <section className="privacy-retention">
        <div className="privacy-retention-head">
          <div>
            <p>Privacy dashboard overview</p>
            <h3>Data map, subprocessors, cookie stance, and legal status</h3>
          </div>

          <ShieldCheck size={26} />
        </div>

        <div className="workspace-row-actions">
          <button
            type="button"
            className="workspace-auth-action"
            disabled={isLoadingPrivacyOverview}
            onClick={() => {
              void loadPrivacyOverview();
            }}
          >
            <RefreshCcw size={16} />
            {isLoadingPrivacyOverview ? "Loading" : "Reload overview"}
          </button>

          <button
            type="button"
            className="workspace-auth-action"
            disabled={isLoadingLegalAcceptances}
            onClick={() => {
              void loadLegalAcceptances();
            }}
          >
            <RefreshCcw size={16} />
            {isLoadingLegalAcceptances ? "Loading" : "Reload acceptances"}
          </button>
        </div>

        <div className="retention-list">
          <div className="retention-row">
            <div>
              <Database size={16} />
              <span>Privacy data map datasets</span>
            </div>

            <strong>
              {isLoadingPrivacyOverview
                ? "Loading"
                : `${privacyDataMapRecords.length} records`}
            </strong>
          </div>

          <div className="retention-row">
            <div>
              <ShieldCheck size={16} />
              <span>Subprocessors requiring review</span>
            </div>

            <strong>
              {isLoadingPrivacyOverview
                ? "Loading"
                : `${subprocessors.length} entries`}
            </strong>
          </div>

          <div className="retention-row">
            <div>
              <EyeOff size={16} />
              <span>Cookie/tracking stance</span>
            </div>

            <strong>
              {cookieTrackingStance
                ? cookieTrackingStance.nonEssentialCookiesUsed
                  ? "Review tracking"
                  : "Essential-only"
                : isLoadingPrivacyOverview
                  ? "Loading"
                  : "Unavailable"}
            </strong>
          </div>

          <div className="retention-row">
            <div>
              <Scale size={16} />
              <span>My legal acceptances</span>
            </div>

            <strong>
              {isLoadingLegalAcceptances
                ? "Loading"
                : `${myLegalAcceptances.length} version(s)`}
            </strong>
          </div>

          <div className="retention-row">
            <div>
              <Scale size={16} />
              <span>Workspace legal acceptance records</span>
            </div>

            <strong>
              {isLoadingLegalAcceptances
                ? "Loading"
                : `${workspaceLegalAcceptances.length} record(s)`}
            </strong>
          </div>

          <div className="retention-row">
            <div>
              <LockKeyhole size={16} />
              <span>Privacy contact</span>
            </div>

            <strong>
              {settings.privacyContactEmail || "Placeholder pending review"}
            </strong>
          </div>

          <div className="retention-row">
            <div>
              <LockKeyhole size={16} />
              <span>Security contact</span>
            </div>

            <strong>
              {settings.securityContactEmail || "Placeholder pending review"}
            </strong>
          </div>
        </div>

        {privacyOverviewStatusMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <CheckCircle2 size={16} />
                <span>{privacyOverviewStatusMessage}</span>
              </div>

              <strong>OK</strong>
            </div>
          </div>
        ) : null}

        {privacyOverviewErrorMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>{privacyOverviewErrorMessage}</span>
              </div>

              <strong>Review</strong>
            </div>
          </div>
        ) : null}

        {legalAcceptanceStatusMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <CheckCircle2 size={16} />
                <span>{legalAcceptanceStatusMessage}</span>
              </div>

              <strong>OK</strong>
            </div>
          </div>
        ) : null}

        {legalAcceptanceErrorMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>{legalAcceptanceErrorMessage}</span>
              </div>

              <strong>Review</strong>
            </div>
          </div>
        ) : null}
      </section>

      <section className="privacy-retention">
        <div className="privacy-retention-head">
          <div>
            <p>Privacy data map</p>
            <h3>Datasets and minimization notes</h3>
          </div>

          <Database size={26} />
        </div>

        <div className="retention-list">
          {isLoadingPrivacyOverview ? (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>Loading data map</span>
              </div>

              <strong>Loading</strong>
            </div>
          ) : privacyDataMapRecords.length > 0 ? (
            privacyDataMapRecords.map((record) => (
              <div className="retention-row" key={record.datasetKey}>
                <div>
                  <Database size={16} />
                  <span>
                    {record.dataCategory}
                    <br />
                    {record.userFacingDescription || record.purpose}
                    <br />
                    Source: {record.tableOrSource}
                    <br />
                    Raw payload stored: {record.rawPayloadStored ? "Review" : "No"}
                    {" - "}
                    Exportable: {record.exportable ? "Yes" : "No"}
                    {" - "}
                    Deletable: {record.deletable ? "Yes" : "Preserve/minimize"}
                    <br />
                    {record.riskNote}
                  </span>
                </div>

                <strong>
                  {record.legalReviewRequired ? "Review required" : "Mapped"}
                </strong>
              </div>
            ))
          ) : (
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>Data map is unavailable or empty.</span>
              </div>

              <strong>Empty</strong>
            </div>
          )}
        </div>
      </section>

      <section className="privacy-retention">
        <div className="privacy-retention-head">
          <div>
            <p>Subprocessors and cookies</p>
            <h3>Review-required provider and tracking stance</h3>
          </div>

          <EyeOff size={26} />
        </div>

        <div className="retention-list">
          {cookieTrackingStance ? (
            <div className="retention-row">
              <div>
                <EyeOff size={16} />
                <span>
                  {cookieTrackingStance.summary || "Essential-only cookie stance."}
                  <br />
                  Non-essential cookies:{" "}
                  {cookieTrackingStance.nonEssentialCookiesUsed ? "Yes" : "No"}
                  {" - "}
                  Analytics configured:{" "}
                  {cookieTrackingStance.analyticsConfigured ? "Yes" : "No"}
                </span>
              </div>

              <strong>Essential-only</strong>
            </div>
          ) : null}

          {isLoadingPrivacyOverview ? (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>Loading subprocessors</span>
              </div>

              <strong>Loading</strong>
            </div>
          ) : subprocessors.length > 0 ? (
            subprocessors.map((record) => (
              <div className="retention-row" key={record.providerKey}>
                <div>
                  <ShieldCheck size={16} />
                  <span>
                    {record.provider}
                    <br />
                    {record.purpose}
                    <br />
                    Region: {record.region} - Categories:{" "}
                    {record.dataCategories.join(", ") || "review required"}
                    <br />
                    {record.notes}
                  </span>
                </div>

                <strong>{record.status.replace(/_/g, " ")}</strong>
              </div>
            ))
          ) : (
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>Subprocessor list is unavailable or empty.</span>
              </div>

              <strong>Empty</strong>
            </div>
          )}
        </div>
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
            <span>XML validation jobs</span>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.xmlValidationJobRetentionDays}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  xmlValidationJobRetentionDays: clampRetentionDays(
                    Number(event.target.value)
                  )
                }));
              }}
            />
          </label>

          <label>
            <span>API logs</span>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.apiRequestLogRetentionDays}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  apiRequestLogRetentionDays: clampRetentionDays(
                    Number(event.target.value)
                  )
                }));
              }}
            />
          </label>

          <label>
            <span>Webhook logs</span>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.webhookDeliveryLogRetentionDays}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  webhookDeliveryLogRetentionDays: clampRetentionDays(
                    Number(event.target.value)
                  )
                }));
              }}
            />
          </label>

          <label>
            <span>VIES evidence</span>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.viesEvidenceRetentionDays}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  viesEvidenceRetentionDays: clampRetentionDays(
                    Number(event.target.value)
                  )
                }));
              }}
            />
          </label>

          <label>
            <span>ViDA simulations</span>
            <input
              type="number"
              min="0"
              max="3650"
              value={settings.vidaSimulationRetentionDays}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  vidaSimulationRetentionDays: clampRetentionDays(
                    Number(event.target.value)
                  )
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

          <label>
            <span>Data minimization</span>
            <select
              value={settings.dataMinimizationMode}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  dataMinimizationMode: normalizeDataMinimizationMode(
                    event.target.value
                  )
                }));
              }}
            >
              <option value="standard">Standard</option>
              <option value="reduced">Reduced</option>
              <option value="strict">Strict</option>
            </select>
          </label>

          <label>
            <span>Privacy contact</span>
            <input
              type="email"
              maxLength={320}
              value={settings.privacyContactEmail}
              disabled={isLoading || isSaving}
              placeholder="privacy@example.test"
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  privacyContactEmail: event.target.value
                }));
              }}
            />
          </label>

          <label>
            <span>Security contact</span>
            <input
              type="email"
              maxLength={320}
              value={settings.securityContactEmail}
              disabled={isLoading || isSaving}
              placeholder="security@example.test"
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  securityContactEmail: event.target.value
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

          <div className="retention-row">
            <div>
              <Database size={16} />
              <span>Include API log metadata in exports</span>
            </div>

            <input
              type="checkbox"
              checked={settings.includeApiLogsInExports}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  includeApiLogsInExports: event.target.checked
                }));
              }}
            />
          </div>

          <div className="retention-row">
            <div>
              <Database size={16} />
              <span>Include webhook log metadata in exports</span>
            </div>

            <input
              type="checkbox"
              checked={settings.includeWebhookLogsInExports}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  includeWebhookLogsInExports: event.target.checked
                }));
              }}
            />
          </div>

          <div className="retention-row">
            <div>
              <Scale size={16} />
              <span>Include legal acceptance records in exports</span>
            </div>

            <input
              type="checkbox"
              checked={settings.includeLegalAcceptancesInExports}
              disabled={isLoading || isSaving}
              onChange={(event) => {
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  includeLegalAcceptancesInExports: event.target.checked
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

              <strong>Review</strong>
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
                  preview after confirming API connectivity and owner/admin
                  access.
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

              <strong>Review</strong>
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

              <strong>Review</strong>
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
              <option value="export">Export</option>
              <option value="deletion">Deletion request</option>
              <option value="access">Access request</option>
              <option value="correction">Correction request</option>
              <option value="objection">Objection request</option>
              <option value="restriction">Restriction request</option>
              <option value="portability">Portability request</option>
              <option value="retention_review">Retention review</option>
              <option value="other">Other</option>
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

              <strong>Review</strong>
            </div>
          </div>
        ) : null}
      </section>

      <section className="privacy-retention">
        <div className="privacy-retention-head">
          <div>
            <p>Deletion runs</p>
            <h3>Prepare and execute workspace deletion reviews</h3>
          </div>

          <Trash2 size={26} />
        </div>

        <div className="workspace-history-filters">
          <label>
            <span>Linked deletion request</span>
            <select
              value={sourceDeletionPrivacyRequestId}
              disabled={isPreparingDeletionRun}
              onChange={(event) => {
                setSourceDeletionPrivacyRequestId(event.target.value);
              }}
            >
              <option value="">Choose a deletion request</option>
              {deletionPrivacyRequests.map((request) => (
                <option value={request.id} key={request.id}>
                  {request.subject} · {formatPrivacyRequestStatus(request.status)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="workspace-auth-action"
            disabled={!canPrepareDeletionRun}
            onClick={() => {
              void prepareDeletionRun();
            }}
          >
            <Trash2 size={16} />
            {isPreparingDeletionRun ? "Preparing" : "Prepare deletion review"}
          </button>

          <button
            type="button"
            className="workspace-auth-action"
            disabled={isLoadingDeletionRuns}
            onClick={() => {
              void loadDeletionRuns();
            }}
          >
            <RefreshCcw size={16} />
            Reload
          </button>
        </div>

        {!settings.allowDeletionRequests ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>
                  Deletion run preparation is disabled because deletion requests are
                  disabled in workspace settings.
                </span>
              </div>

              <strong>Disabled</strong>
            </div>
          </div>
        ) : null}

        {settings.allowDeletionRequests && deletionPrivacyRequests.length === 0 ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>
                  No deletion privacy request is available. Submit a deletion request
                  first, then prepare a deletion review from that request.
                </span>
              </div>

              <strong>Waiting</strong>
            </div>
          </div>
        ) : null}

        <div className="retention-list">
          {isLoadingDeletionRuns ? (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>Loading deletion runs</span>
              </div>

              <strong>Loading</strong>
            </div>
          ) : deletionRuns.length > 0 ? (
            deletionRuns.map((run) => (
              <div className="retention-row" key={run.id}>
                <div>
                  <FileClock size={16} />
                  <span>
                    Deletion review prepared {formatUpdatedAt(run.createdAt)}
                    <br />
                    Linked request: {run.sourcePrivacyRequestId || "Not linked"}
                    <br />
                    Affected: {formatDeletionRunRecordCounts(run.affectedCounts)}
                    <br />
                    Executed: {formatDeletionRunRecordCounts(run.executedCounts)}
                    <br />
                    Total affected: {run.totalAffectedCount} · Total executed:{" "}
                    {run.totalExecutedCount}
                    <br />
                    Prepared deletion reviews are non-destructive until executed.
                    Execution is destructive and should only be used after review.
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
                  <strong>{formatDeletionRunStatus(run.status)}</strong>

                  {run.status === "prepared" ? (
                    <button
                      type="button"
                      className="workspace-auth-action"
                      disabled={Boolean(executingDeletionRunId)}
                      onClick={() => {
                        void executeDeletionRun(run.id);
                      }}
                    >
                      <Trash2 size={16} />
                      {executingDeletionRunId === run.id
                        ? "Executing"
                        : "Execute deletion"}
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
                  No deletion run has been prepared yet. Preparing a deletion review
                  stores affected workspace counts without deleting data.
                </span>
              </div>

              <strong>Empty</strong>
            </div>
          )}
        </div>

        {deletionRunStatusMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <CheckCircle2 size={16} />
                <span>{deletionRunStatusMessage}</span>
              </div>

              <strong>OK</strong>
            </div>
          </div>
        ) : null}

        {deletionRunErrorMessage ? (
          <div className="retention-list">
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>{deletionRunErrorMessage}</span>
              </div>

              <strong>Review</strong>
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

              <strong>Review</strong>
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
                        <option value="awaiting_verification">
                          Awaiting verification
                        </option>
                        <option value="approved">Approved</option>
                        <option value="fulfilled">Fulfilled</option>
                        <option value="cancelled">Cancelled</option>
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
            <p>Legal acceptance status</p>
            <h3>Versioned policy acceptance records</h3>
          </div>

          <Scale size={26} />
        </div>

        <div className="retention-list">
          {isLoadingLegalAcceptances ? (
            <div className="retention-row">
              <div>
                <FileClock size={16} />
                <span>Loading legal acceptance records</span>
              </div>

              <strong>Loading</strong>
            </div>
          ) : myLegalAcceptances.length > 0 || workspaceLegalAcceptances.length > 0 ? (
            [...myLegalAcceptances, ...workspaceLegalAcceptances]
              .slice(0, 12)
              .map((record) => (
                <div className="retention-row" key={`${record.id}-${record.userId}`}>
                  <div>
                    <Scale size={16} />
                    <span>
                      {record.title} version {record.version}
                      <br />
                      Context: {record.acceptanceContext || "workspace"} - User:{" "}
                      {record.userId || "not shown"}
                      <br />
                      Accepted: {formatUpdatedAt(record.acceptedAt)}
                    </span>
                  </div>

                  <strong>{record.documentKey}</strong>
                </div>
              ))
          ) : (
            <div className="retention-row">
              <div>
                <AlertTriangle size={16} />
                <span>
                  No legal acceptance records are visible for this workspace.
                  Required document acceptance should be completed by signed-in
                  users where applicable.
                </span>
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
            previews read existing records without deleting anything. Retention runs
            store auditable cleanup-review snapshots before execution, and deletion
            runs store deletion-impact snapshots linked to deletion privacy requests
            before execution.
          </p>
        </div>

        <div>
          <ShieldCheck size={24} />
          <h3>Safety boundary</h3>
          <p>
            Retention settings, privacy requests, export packages, retention
            previews, retention runs, and deletion runs define product behavior
            inside Invoice Lantern. They do not decide statutory retention duties,
            accounting obligations, legal duties, or authority-facing
            recordkeeping requirements.
          </p>
        </div>
      </section>
    </div>
  );
}
