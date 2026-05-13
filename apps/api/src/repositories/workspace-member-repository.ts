import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleClient,
  getSupabaseUserClient
} from "../lib/supabase/server-client.js";
import type { WorkspaceRole } from "../middleware/require-workspace-role.js";

export type WorkspaceMemberRecord = {
  id: string;
  organizationId: string;
  userId: string;
  role: WorkspaceRole;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceInvitationStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";

export type WorkspaceInvitationRecord = {
  id: string;
  organizationId: string;
  email: string;
  role: WorkspaceRole;
  tokenPrefix: string;
  status: WorkspaceInvitationStatus;
  invitedBy: string | null;
  acceptedBy: string | null;
  revokedBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceInvitationInternalRecord = WorkspaceInvitationRecord & {
  tokenHash: string;
};

export type WorkspaceActivityEventInput = {
  organizationId: string;
  actorUserId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  severity?: "info" | "warning" | "error";
  metadata?: Record<string, unknown>;
};

export type WorkspaceSecurityEventInput = {
  organizationId: string | null;
  actorUserId: string | null;
  eventType: string;
  severity?: "info" | "warning" | "high" | "critical";
  category?: string;
  resourceType?: string | null;
  resourceId?: string | null;
  outcome?: "success" | "failure" | "blocked" | "recorded";
  metadata?: Record<string, unknown>;
};

export type WorkspaceMemberRepository = {
  listMembers(input: {
    organizationId: string;
    accessToken?: string;
  }): Promise<WorkspaceMemberRecord[]>;
  getMemberById(input: {
    organizationId: string;
    memberId: string;
    accessToken?: string;
  }): Promise<WorkspaceMemberRecord | null>;
  findMembershipByUser(input: {
    organizationId: string;
    userId: string;
  }): Promise<WorkspaceMemberRecord | null>;
  countOwners(input: {
    organizationId: string;
  }): Promise<number>;
  updateMemberRole(input: {
    organizationId: string;
    memberId: string;
    role: WorkspaceRole;
    accessToken?: string;
  }): Promise<WorkspaceMemberRecord | null>;
  removeMember(input: {
    organizationId: string;
    memberId: string;
    accessToken?: string;
  }): Promise<WorkspaceMemberRecord | null>;
  upsertProfile(input: {
    userId: string;
    email: string;
  }): Promise<void>;
  createMembership(input: {
    organizationId: string;
    userId: string;
    role: WorkspaceRole;
  }): Promise<WorkspaceMemberRecord>;
  listInvitations(input: {
    organizationId: string;
    accessToken?: string;
  }): Promise<WorkspaceInvitationRecord[]>;
  getInvitationById(input: {
    organizationId: string;
    invitationId: string;
    accessToken?: string;
  }): Promise<WorkspaceInvitationRecord | null>;
  findPendingInvitationByEmail(input: {
    organizationId: string;
    email: string;
    accessToken?: string;
  }): Promise<WorkspaceInvitationRecord | null>;
  findInvitationByTokenHash(input: {
    tokenHash: string;
  }): Promise<WorkspaceInvitationInternalRecord | null>;
  createInvitation(input: {
    organizationId: string;
    email: string;
    role: WorkspaceRole;
    tokenHash: string;
    tokenPrefix: string;
    expiresAt: string;
    invitedBy: string;
    accessToken?: string;
  }): Promise<WorkspaceInvitationRecord>;
  markInvitationAccepted(input: {
    organizationId: string;
    invitationId: string;
    acceptedBy: string;
  }): Promise<WorkspaceInvitationRecord | null>;
  markInvitationExpired(input: {
    organizationId: string;
    invitationId: string;
  }): Promise<WorkspaceInvitationRecord | null>;
  revokeInvitation(input: {
    organizationId: string;
    invitationId: string;
    revokedBy: string;
    accessToken?: string;
  }): Promise<WorkspaceInvitationRecord | null>;
  recordActivityEvent(input: WorkspaceActivityEventInput): Promise<void>;
  recordSecurityEvent(input: WorkspaceSecurityEventInput): Promise<void>;
};

type SupabaseMembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
};

type SupabaseProfileRow = {
  id: string;
  email: string;
  display_name: string;
};

type SupabaseInvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  token_hash?: string | null;
  token_prefix: string;
  status: string;
  invited_by: string | null;
  accepted_by: string | null;
  revoked_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

const MEMBERSHIP_SELECT_FIELDS =
  "id, organization_id, user_id, role, created_at, updated_at";

const INVITATION_SELECT_FIELDS =
  "id, organization_id, email, role, token_prefix, status, invited_by, accepted_by, revoked_by, expires_at, accepted_at, revoked_at, metadata, created_at, updated_at";

const INVITATION_INTERNAL_SELECT_FIELDS =
  "id, organization_id, email, role, token_hash, token_prefix, status, invited_by, accepted_by, revoked_by, expires_at, accepted_at, revoked_at, metadata, created_at, updated_at";

const PROFILE_SELECT_FIELDS = "id, email, display_name";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWorkspaceRole(value: string): WorkspaceRole {
  if (
    value === "owner" ||
    value === "admin" ||
    value === "accountant" ||
    value === "developer" ||
    value === "reviewer" ||
    value === "viewer"
  ) {
    return value;
  }

  return "viewer";
}

function normalizeInvitationStatus(value: string): WorkspaceInvitationStatus {
  if (value === "accepted" || value === "revoked" || value === "expired") {
    return value;
  }

  return "pending";
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function createClient(input: { accessToken?: string }): SupabaseClient {
  return input.accessToken
    ? getSupabaseUserClient(input.accessToken)
    : getSupabaseServiceRoleClient();
}

function createServiceRoleClient() {
  return getSupabaseServiceRoleClient();
}

function normalizeMemberRow(
  row: SupabaseMembershipRow,
  profile: SupabaseProfileRow | null
): WorkspaceMemberRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: normalizeWorkspaceRole(row.role),
    email: profile?.email ?? null,
    displayName: profile?.display_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeInvitationRow(
  row: SupabaseInvitationRow
): WorkspaceInvitationRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: normalizeWorkspaceRole(row.role),
    tokenPrefix: row.token_prefix,
    status: normalizeInvitationStatus(row.status),
    invitedBy: row.invited_by,
    acceptedBy: row.accepted_by,
    revokedBy: row.revoked_by,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeInternalInvitationRow(
  row: SupabaseInvitationRow
): WorkspaceInvitationInternalRecord {
  return {
    ...normalizeInvitationRow(row),
    tokenHash: typeof row.token_hash === "string" ? row.token_hash : ""
  };
}

async function getProfilesByUserId(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, SupabaseProfileRow>();
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_FIELDS)
    .in("id", userIds);

  if (error) {
    throw new Error(`Could not read member profiles: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as SupabaseProfileRow[]).map((profile) => [
      profile.id,
      profile
    ])
  );
}

async function normalizeMemberRows(rows: SupabaseMembershipRow[]) {
  const profilesByUserId = await getProfilesByUserId(
    rows.map((row) => row.user_id)
  );

  return rows.map((row) =>
    normalizeMemberRow(row, profilesByUserId.get(row.user_id) ?? null)
  );
}

export const supabaseWorkspaceMemberRepository: WorkspaceMemberRepository = {
  async listMembers(input) {
    const supabase = createClient(input);
    const { data, error } = await supabase
      .from("organization_memberships")
      .select(MEMBERSHIP_SELECT_FIELDS)
      .eq("organization_id", input.organizationId)
      .order("created_at", {
        ascending: true
      });

    if (error) {
      throw new Error(`Could not list workspace members: ${error.message}`);
    }

    return normalizeMemberRows((data ?? []) as SupabaseMembershipRow[]);
  },

  async getMemberById(input) {
    const supabase = createClient(input);
    const { data, error } = await supabase
      .from("organization_memberships")
      .select(MEMBERSHIP_SELECT_FIELDS)
      .eq("organization_id", input.organizationId)
      .eq("id", input.memberId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not read workspace member: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const [member] = await normalizeMemberRows([data as SupabaseMembershipRow]);

    return member ?? null;
  },

  async findMembershipByUser(input) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("organization_memberships")
      .select(MEMBERSHIP_SELECT_FIELDS)
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not read workspace membership: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const [member] = await normalizeMemberRows([data as SupabaseMembershipRow]);

    return member ?? null;
  },

  async countOwners(input) {
    const supabase = createServiceRoleClient();
    const { count, error } = await supabase
      .from("organization_memberships")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("organization_id", input.organizationId)
      .eq("role", "owner");

    if (error) {
      throw new Error(`Could not count workspace owners: ${error.message}`);
    }

    return count ?? 0;
  },

  async updateMemberRole(input) {
    const supabase = createClient(input);
    const { data, error } = await supabase
      .from("organization_memberships")
      .update({
        role: input.role
      })
      .eq("organization_id", input.organizationId)
      .eq("id", input.memberId)
      .select(MEMBERSHIP_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not update workspace member role: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const [member] = await normalizeMemberRows([data as SupabaseMembershipRow]);

    return member ?? null;
  },

  async removeMember(input) {
    const supabase = createClient(input);
    const { data: existingData, error: readError } = await supabase
      .from("organization_memberships")
      .select(MEMBERSHIP_SELECT_FIELDS)
      .eq("organization_id", input.organizationId)
      .eq("id", input.memberId)
      .maybeSingle();

    if (readError) {
      throw new Error(`Could not read workspace member: ${readError.message}`);
    }

    const [existingMember] = existingData
      ? await normalizeMemberRows([existingData as SupabaseMembershipRow])
      : [];

    if (!existingMember) {
      return null;
    }

    const { error } = await supabase
      .from("organization_memberships")
      .delete()
      .eq("organization_id", input.organizationId)
      .eq("id", input.memberId);

    if (error) {
      throw new Error(`Could not remove workspace member: ${error.message}`);
    }

    return existingMember;
  },

  async upsertProfile(input) {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("profiles").upsert(
      {
        id: input.userId,
        email: input.email,
        display_name: ""
      },
      {
        onConflict: "id"
      }
    );

    if (error) {
      throw new Error(`Could not upsert accepted member profile: ${error.message}`);
    }
  },

  async createMembership(input) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("organization_memberships")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        role: input.role
      })
      .select(MEMBERSHIP_SELECT_FIELDS)
      .single();

    if (error) {
      throw new Error(`Could not create workspace membership: ${error.message}`);
    }

    const [member] = await normalizeMemberRows([data as SupabaseMembershipRow]);

    if (!member) {
      throw new Error("Workspace membership creation returned no member.");
    }

    return member;
  },

  async listInvitations(input) {
    const supabase = createClient(input);
    const { data, error } = await supabase
      .from("workspace_member_invitations")
      .select(INVITATION_SELECT_FIELDS)
      .eq("organization_id", input.organizationId)
      .order("created_at", {
        ascending: false
      })
      .limit(250);

    if (error) {
      throw new Error(`Could not list workspace invitations: ${error.message}`);
    }

    return ((data ?? []) as SupabaseInvitationRow[]).map(normalizeInvitationRow);
  },

  async getInvitationById(input) {
    const supabase = createClient(input);
    const { data, error } = await supabase
      .from("workspace_member_invitations")
      .select(INVITATION_SELECT_FIELDS)
      .eq("organization_id", input.organizationId)
      .eq("id", input.invitationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not read workspace invitation: ${error.message}`);
    }

    return data ? normalizeInvitationRow(data as SupabaseInvitationRow) : null;
  },

  async findPendingInvitationByEmail(input) {
    const supabase = createClient(input);
    const { data, error } = await supabase
      .from("workspace_member_invitations")
      .select(INVITATION_SELECT_FIELDS)
      .eq("organization_id", input.organizationId)
      .eq("email", input.email)
      .eq("status", "pending")
      .maybeSingle();

    if (error) {
      throw new Error(`Could not read pending invitation: ${error.message}`);
    }

    return data ? normalizeInvitationRow(data as SupabaseInvitationRow) : null;
  },

  async findInvitationByTokenHash(input) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("workspace_member_invitations")
      .select(INVITATION_INTERNAL_SELECT_FIELDS)
      .eq("token_hash", input.tokenHash)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not read invitation token: ${error.message}`);
    }

    return data
      ? normalizeInternalInvitationRow(data as SupabaseInvitationRow)
      : null;
  },

  async createInvitation(input) {
    const supabase = createClient(input);
    const { data, error } = await supabase
      .from("workspace_member_invitations")
      .insert({
        organization_id: input.organizationId,
        email: input.email,
        role: input.role,
        token_hash: input.tokenHash,
        token_prefix: input.tokenPrefix,
        status: "pending",
        invited_by: input.invitedBy,
        expires_at: input.expiresAt,
        metadata: {}
      })
      .select(INVITATION_SELECT_FIELDS)
      .single();

    if (error) {
      throw new Error(`Could not create workspace invitation: ${error.message}`);
    }

    return normalizeInvitationRow(data as SupabaseInvitationRow);
  },

  async markInvitationAccepted(input) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("workspace_member_invitations")
      .update({
        status: "accepted",
        accepted_by: input.acceptedBy,
        accepted_at: new Date().toISOString()
      })
      .eq("organization_id", input.organizationId)
      .eq("id", input.invitationId)
      .eq("status", "pending")
      .select(INVITATION_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not accept workspace invitation: ${error.message}`);
    }

    return data ? normalizeInvitationRow(data as SupabaseInvitationRow) : null;
  },

  async markInvitationExpired(input) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("workspace_member_invitations")
      .update({
        status: "expired"
      })
      .eq("organization_id", input.organizationId)
      .eq("id", input.invitationId)
      .eq("status", "pending")
      .select(INVITATION_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not expire workspace invitation: ${error.message}`);
    }

    return data ? normalizeInvitationRow(data as SupabaseInvitationRow) : null;
  },

  async revokeInvitation(input) {
    const supabase = createClient(input);
    const { data, error } = await supabase
      .from("workspace_member_invitations")
      .update({
        status: "revoked",
        revoked_by: input.revokedBy,
        revoked_at: new Date().toISOString()
      })
      .eq("organization_id", input.organizationId)
      .eq("id", input.invitationId)
      .eq("status", "pending")
      .select(INVITATION_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not revoke workspace invitation: ${error.message}`);
    }

    return data ? normalizeInvitationRow(data as SupabaseInvitationRow) : null;
  },

  async recordActivityEvent(input) {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("workspace_activity_events").insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      entity_label: input.entityLabel,
      severity: input.severity ?? "info",
      source: "api",
      metadata: input.metadata ?? {}
    });

    if (error) {
      throw new Error(`Could not record workspace activity: ${error.message}`);
    }
  },

  async recordSecurityEvent(input) {
    const supabase = createServiceRoleClient();
    const values = {
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      event_type: input.eventType,
      severity: input.severity ?? "warning",
      category: input.category ?? "workspace_management",
      resource_type: input.resourceType ?? null,
      outcome: input.outcome ?? "recorded",
      metadata: input.metadata ?? {},
      ...(input.resourceId ? { resource_id: input.resourceId } : {})
    };

    const { error } = await supabase.from("security_events").insert(values);

    if (error) {
      throw new Error(`Could not record security event: ${error.message}`);
    }
  }
};
