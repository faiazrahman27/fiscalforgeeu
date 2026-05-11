import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspacePrivacyRequestType =
  | "data_export"
  | "deletion"
  | "retention_review";

export type WorkspacePrivacyRequestStatus =
  | "submitted"
  | "in_review"
  | "completed"
  | "rejected";

export type WorkspacePrivacyRequestRecord = {
  id: string;
  requestType: WorkspacePrivacyRequestType;
  status: WorkspacePrivacyRequestStatus;
  subject: string;
  details: string;
  requesterEmail: string;
  reviewNote: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspacePrivacyRequestPayload = {
  requestType: WorkspacePrivacyRequestType;
  subject: string;
  details: string;
};

export type WorkspacePrivacyRequestReviewPayload = {
  status: WorkspacePrivacyRequestStatus;
  reviewNote: string;
};

export type AuthenticatedWorkspacePrivacyRequestContext = {
  userId: string;
  accessToken: string;
};

type SupabaseWorkspaceBootstrapRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

type SupabaseWorkspacePrivacyRequestRow = {
  id: string;
  organization_id: string;
  requester_user_id: string;
  request_type: string;
  status: string;
  subject: string;
  details: string;
  requester_email: string;
  reviewer_user_id: string | null;
  review_note: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export class WorkspacePrivacyRequestRepositoryError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "WorkspacePrivacyRequestRepositoryError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const MAX_WORKSPACE_PRIVACY_REQUESTS = 250;

const WORKSPACE_PRIVACY_REQUEST_SELECT_FIELDS =
  "id, organization_id, requester_user_id, request_type, status, subject, details, requester_email, reviewer_user_id, review_note, completed_at, created_at, updated_at";

const PRIVACY_REQUEST_MANAGER_ROLES = new Set(["owner", "admin"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function normalizeWorkspaceBootstrapRecord(
  value: unknown
): SupabaseWorkspaceBootstrapRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const organizationId = readStringField(value, "organization_id");
  const organizationName = readStringField(value, "organization_name");
  const organizationSlug = readStringField(value, "organization_slug");
  const membershipRole = readStringField(value, "membership_role", "viewer");
  const userEmail = readStringField(value, "user_email");

  if (!organizationId || !organizationName || !organizationSlug) {
    return null;
  }

  return {
    organizationId,
    organizationName,
    organizationSlug,
    membershipRole,
    userEmail
  };
}

function normalizePrivacyRequestType(
  value: string
): WorkspacePrivacyRequestType {
  if (value === "deletion" || value === "retention_review") {
    return value;
  }

  return "data_export";
}

function normalizePrivacyRequestStatus(
  value: string
): WorkspacePrivacyRequestStatus {
  if (value === "in_review" || value === "completed" || value === "rejected") {
    return value;
  }

  return "submitted";
}

function normalizeWorkspacePrivacyRequestRow(
  row: SupabaseWorkspacePrivacyRequestRow
): WorkspacePrivacyRequestRecord {
  return {
    id: row.id,
    requestType: normalizePrivacyRequestType(row.request_type),
    status: normalizePrivacyRequestStatus(row.status),
    subject: row.subject,
    details: row.details,
    requesterEmail: row.requester_email,
    reviewNote: row.review_note,
    completedAt: row.completed_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildSupabaseWorkspacePrivacyRequestValues({
  payload,
  organizationId,
  userId,
  requesterEmail
}: {
  payload: WorkspacePrivacyRequestPayload;
  organizationId: string;
  userId: string;
  requesterEmail: string;
}) {
  return {
    organization_id: organizationId,
    requester_user_id: userId,
    request_type: payload.requestType,
    status: "submitted",
    subject: payload.subject,
    details: payload.details,
    requester_email: requesterEmail
  };
}

function buildSupabaseWorkspacePrivacyRequestReviewValues({
  payload,
  userId
}: {
  payload: WorkspacePrivacyRequestReviewPayload;
  userId: string;
}) {
  return {
    status: payload.status,
    reviewer_user_id: userId,
    review_note: payload.reviewNote,
    completed_at: payload.status === "completed" ? new Date().toISOString() : null
  };
}

async function getWorkspaceForAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("bootstrap_personal_workspace");

  if (error) {
    throw new WorkspacePrivacyRequestRepositoryError(
      "WORKSPACE_CONTEXT_UNAVAILABLE",
      `Workspace bootstrap failed: ${error.message}`,
      503
    );
  }

  const firstRecord = Array.isArray(data) ? data[0] : data;
  const workspace = normalizeWorkspaceBootstrapRecord(firstRecord);

  if (!workspace) {
    throw new WorkspacePrivacyRequestRepositoryError(
      "WORKSPACE_CONTEXT_REQUIRED",
      "Workspace bootstrap returned an unreadable record.",
      409
    );
  }

  return workspace;
}

function createAuthenticatedSupabaseClient(
  context: AuthenticatedWorkspacePrivacyRequestContext
) {
  return getSupabaseUserClient(context.accessToken);
}

function assertCanManagePrivacyRequests(
  workspace: SupabaseWorkspaceBootstrapRecord
) {
  if (PRIVACY_REQUEST_MANAGER_ROLES.has(workspace.membershipRole)) {
    return;
  }

  throw new WorkspacePrivacyRequestRepositoryError(
    "PRIVACY_REQUEST_MANAGER_ROLE_REQUIRED",
    "Workspace privacy request review requires an organization owner or admin role.",
    403
  );
}

async function insertPrivacyRequestActivityEvent({
  supabase,
  organizationId,
  userId,
  record,
  eventType
}: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  record: WorkspacePrivacyRequestRecord;
  eventType: "privacy_request.submitted" | "privacy_request.status_updated";
}) {
  await supabase.from("workspace_activity_events").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    event_type: eventType,
    entity_type: "workspace_privacy_request",
    entity_id: record.id,
    entity_label: record.subject,
    severity:
      record.requestType === "deletion" || record.status === "rejected"
        ? "warning"
        : "info",
    source: "api",
    metadata: {
      requestType: record.requestType,
      status: record.status,
      subject: record.subject,
      requesterEmail: record.requesterEmail,
      reviewNote: record.reviewNote,
      completedAt: record.completedAt
    }
  });
}

export function hasAuthenticatedWorkspacePrivacyRequestContext(
  context: AuthenticatedWorkspacePrivacyRequestContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function listAuthenticatedWorkspacePrivacyRequests(
  context: AuthenticatedWorkspacePrivacyRequestContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  assertCanManagePrivacyRequests(workspace);

  const { data, error } = await supabase
    .from("workspace_privacy_requests")
    .select(WORKSPACE_PRIVACY_REQUEST_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(MAX_WORKSPACE_PRIVACY_REQUESTS);

  if (error) {
    throw new WorkspacePrivacyRequestRepositoryError(
      "PRIVACY_REQUEST_LIST_FAILED",
      `Could not list privacy requests: ${error.message}`,
      500
    );
  }

  return ((data ?? []) as SupabaseWorkspacePrivacyRequestRow[]).map((row) =>
    normalizeWorkspacePrivacyRequestRow(row)
  );
}

export async function createAuthenticatedWorkspacePrivacyRequest(
  context: AuthenticatedWorkspacePrivacyRequestContext,
  payload: WorkspacePrivacyRequestPayload
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data: userData } = await supabase.auth.getUser();
  const requesterEmail = userData.user?.email ?? workspace.userEmail ?? "";

  const { data, error } = await supabase
    .from("workspace_privacy_requests")
    .insert(
      buildSupabaseWorkspacePrivacyRequestValues({
        payload,
        organizationId: workspace.organizationId,
        userId: context.userId,
        requesterEmail
      })
    )
    .select(WORKSPACE_PRIVACY_REQUEST_SELECT_FIELDS)
    .single();

  if (error) {
    throw new WorkspacePrivacyRequestRepositoryError(
      "PRIVACY_REQUEST_CREATE_FAILED",
      `Could not create privacy request: ${error.message}`,
      500
    );
  }

  const record = normalizeWorkspacePrivacyRequestRow(
    data as SupabaseWorkspacePrivacyRequestRow
  );

  try {
    await insertPrivacyRequestActivityEvent({
      supabase,
      organizationId: workspace.organizationId,
      userId: context.userId,
      record,
      eventType: "privacy_request.submitted"
    });
  } catch {
    /*
     * Privacy request creation should not fail only because activity logging
     * failed. Activity logging can be repaired independently.
     */
  }

  return record;
}

export async function updateAuthenticatedWorkspacePrivacyRequestById(
  context: AuthenticatedWorkspacePrivacyRequestContext,
  id: string,
  payload: WorkspacePrivacyRequestReviewPayload
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  assertCanManagePrivacyRequests(workspace);

  const { data, error } = await supabase
    .from("workspace_privacy_requests")
    .update(
      buildSupabaseWorkspacePrivacyRequestReviewValues({
        payload,
        userId: context.userId
      })
    )
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .select(WORKSPACE_PRIVACY_REQUEST_SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    throw new WorkspacePrivacyRequestRepositoryError(
      "PRIVACY_REQUEST_UPDATE_FAILED",
      `Could not update privacy request: ${error.message}`,
      500
    );
  }

  if (!data) {
    return null;
  }

  const record = normalizeWorkspacePrivacyRequestRow(
    data as SupabaseWorkspacePrivacyRequestRow
  );

  try {
    await insertPrivacyRequestActivityEvent({
      supabase,
      organizationId: workspace.organizationId,
      userId: context.userId,
      record,
      eventType: "privacy_request.status_updated"
    });
  } catch {
    /*
     * Privacy request status updates should still succeed if activity logging
     * fails. The main source of truth is the privacy request record.
     */
  }

  return record;
}