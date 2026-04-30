import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type AuthenticatedWorkspaceActivityContext = {
  userId: string;
  accessToken: string;
};

export type WorkspaceActivityEventSummary = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  severity: "info" | "warning" | "error";
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CreateWorkspaceActivityEventInput = {
  eventType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  severity?: WorkspaceActivityEventSummary["severity"];
  source?: "api";
  metadata?: Record<string, unknown>;
};

type SupabaseWorkspaceBootstrapRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

type SupabaseWorkspaceActivityEventRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  severity: string;
  source: string;
  metadata: unknown;
  created_at: string;
};

const WORKSPACE_ACTIVITY_SELECT_FIELDS =
  "id, organization_id, actor_user_id, event_type, entity_type, entity_id, entity_label, severity, source, metadata, created_at";

const MAX_ACTIVITY_EVENTS = 100;

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
  const membershipRole = readStringField(value, "membership_role", "member");
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

function normalizeSeverity(
  value: string
): WorkspaceActivityEventSummary["severity"] {
  if (value === "warning" || value === "error") {
    return value;
  }

  return "info";
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function normalizeWorkspaceActivityEventRow(
  row: SupabaseWorkspaceActivityEventRow
): WorkspaceActivityEventSummary {
  return {
    id: row.id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    severity: normalizeSeverity(row.severity),
    source: row.source,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at
  };
}

async function getWorkspaceForAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("bootstrap_personal_workspace");

  if (error) {
    throw new Error(`Workspace bootstrap failed: ${error.message}`);
  }

  const firstRecord = Array.isArray(data) ? data[0] : data;
  const workspace = normalizeWorkspaceBootstrapRecord(firstRecord);

  if (!workspace) {
    throw new Error("Workspace bootstrap returned an unreadable record.");
  }

  return workspace;
}

function createAuthenticatedSupabaseClient(
  context: AuthenticatedWorkspaceActivityContext
) {
  return getSupabaseUserClient(context.accessToken);
}

export function hasAuthenticatedWorkspaceActivityContext(
  context: AuthenticatedWorkspaceActivityContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function listAuthenticatedWorkspaceActivityEvents(
  context: AuthenticatedWorkspaceActivityContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("workspace_activity_events")
    .select(WORKSPACE_ACTIVITY_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(MAX_ACTIVITY_EVENTS);

  if (error) {
    throw new Error(`Could not list workspace activity events: ${error.message}`);
  }

  return ((data ?? []) as SupabaseWorkspaceActivityEventRow[]).map((row) =>
    normalizeWorkspaceActivityEventRow(row)
  );
}

export async function createAuthenticatedWorkspaceActivityEvent(
  context: AuthenticatedWorkspaceActivityContext,
  input: CreateWorkspaceActivityEventInput
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { error } = await supabase.from("workspace_activity_events").insert({
    organization_id: workspace.organizationId,
    actor_user_id: context.userId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_label: input.entityLabel,
    severity: input.severity ?? "info",
    source: input.source ?? "api",
    metadata: input.metadata ?? {}
  });

  if (error) {
    throw new Error(`Could not record workspace activity event: ${error.message}`);
  }
}
