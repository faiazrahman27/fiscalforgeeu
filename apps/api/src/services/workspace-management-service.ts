import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import type {
  WorkspaceAuthorizationContext,
  WorkspaceRole
} from "../middleware/require-workspace-role.js";
import {
  supabaseWorkspaceMemberRepository,
  type WorkspaceInvitationRecord,
  type WorkspaceMemberRecord,
  type WorkspaceMemberRepository
} from "../repositories/workspace-member-repository.js";

export type CreateWorkspaceInvitationInput = {
  context: WorkspaceAuthorizationContext;
  email: string;
  role: WorkspaceRole;
  expiresInDays?: number;
};

export type AcceptWorkspaceInvitationInput = {
  userId: string;
  userEmail: string;
  token: string;
};

export type UpdateWorkspaceMemberRoleInput = {
  context: WorkspaceAuthorizationContext;
  memberId: string;
  role: WorkspaceRole;
};

export type RemoveWorkspaceMemberInput = {
  context: WorkspaceAuthorizationContext;
  memberId: string;
};

export class WorkspaceManagementServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "WorkspaceManagementServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const WORKSPACE_MANAGER_ROLES = new Set<WorkspaceRole>(["owner", "admin"]);
const INVITE_PREFIX_RANDOM_BYTES = 9;
const INVITE_SECRET_RANDOM_BYTES = 32;
const DEFAULT_INVITE_EXPIRY_DAYS = 7;
const MAX_INVITE_EXPIRY_DAYS = 30;

const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  viewer: 1,
  reviewer: 2,
  accountant: 2,
  developer: 2,
  admin: 3,
  owner: 4
};

let activeRepository: WorkspaceMemberRepository =
  supabaseWorkspaceMemberRepository;

function getRepository() {
  return activeRepository;
}

export function setWorkspaceMemberRepositoryForTesting(
  repository: WorkspaceMemberRepository
) {
  activeRepository = repository;
}

export function resetWorkspaceMemberRepositoryForTesting() {
  activeRepository = supabaseWorkspaceMemberRepository;
}

export function hashWorkspaceInvitationToken(token: string) {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

function generateTokenSegment(bytes: number) {
  return randomBytes(bytes).toString("base64url");
}

function generateWorkspaceInvitationToken() {
  const tokenPrefix = `il_inv_${generateTokenSegment(
    INVITE_PREFIX_RANDOM_BYTES
  )}`;
  const token = `${tokenPrefix}.${generateTokenSegment(
    INVITE_SECRET_RANDOM_BYTES
  )}`;

  return {
    token,
    tokenHash: hashWorkspaceInvitationToken(token),
    tokenPrefix
  };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getExpiryIso(expiresInDays: number | undefined) {
  const safeDays = Math.min(
    Math.max(
      Number.isInteger(expiresInDays)
        ? expiresInDays ?? DEFAULT_INVITE_EXPIRY_DAYS
        : DEFAULT_INVITE_EXPIRY_DAYS,
      1
    ),
    MAX_INVITE_EXPIRY_DAYS
  );

  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

function buildInviteUrl(token: string) {
  const baseUrl = env.WEB_APP_URL.trim().replace(/\/+$/, "");

  return `${baseUrl}/workspace/invitations/accept?token=${encodeURIComponent(
    token
  )}`;
}

function isManagerRole(role: WorkspaceRole) {
  return WORKSPACE_MANAGER_ROLES.has(role);
}

function assertCanManageWorkspace(context: WorkspaceAuthorizationContext) {
  if (isManagerRole(context.membershipRole)) {
    return;
  }

  throw new WorkspaceManagementServiceError(
    "WORKSPACE_MANAGER_ROLE_REQUIRED",
    "Workspace member management requires an organization owner or admin role.",
    403
  );
}

function isExpired(invitation: Pick<WorkspaceInvitationRecord, "expiresAt">) {
  const expiresAt = new Date(invitation.expiresAt).getTime();

  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function isSelfEscalation(input: {
  context: WorkspaceAuthorizationContext;
  targetMember: WorkspaceMemberRecord;
  targetRole: WorkspaceRole;
}) {
  if (input.context.userId !== input.targetMember.userId) {
    return false;
  }

  return (
    ROLE_WEIGHT[input.targetRole] > ROLE_WEIGHT[input.context.membershipRole]
  );
}

async function recordActivity(input: Parameters<WorkspaceMemberRepository["recordActivityEvent"]>[0]) {
  try {
    await getRepository().recordActivityEvent(input);
  } catch {
    /*
     * Workspace member changes remain authoritative even if activity logging
     * is temporarily unavailable. Security-sensitive failures are still
     * enforced before data mutation.
     */
  }
}

async function recordSecurity(input: Parameters<WorkspaceMemberRepository["recordSecurityEvent"]>[0]) {
  try {
    await getRepository().recordSecurityEvent(input);
  } catch {
    /*
     * Security event logging is best-effort here. The route result must still
     * be driven by the authorization or invite-state decision.
     */
  }
}

function isDuplicateError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("duplicate") ||
    message.includes("unique") ||
    message.includes("already exists")
  );
}

function toRepositoryFailure(error: unknown, fallbackCode: string) {
  if (error instanceof WorkspaceManagementServiceError) {
    return error;
  }

  if (isDuplicateError(error)) {
    return new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_DUPLICATE",
      "A pending invitation already exists for this email address in the workspace.",
      409
    );
  }

  return new WorkspaceManagementServiceError(
    fallbackCode,
    "Could not complete the workspace management operation.",
    500
  );
}

export function getWorkspacePermissionSummary(
  context: WorkspaceAuthorizationContext
) {
  return {
    canManageMembers: isManagerRole(context.membershipRole),
    canManageInvitations: isManagerRole(context.membershipRole),
    canManageWorkspaceSettings: isManagerRole(context.membershipRole),
    canManagePrivacy: isManagerRole(context.membershipRole),
    canManageApiKeys:
      context.membershipRole === "owner" ||
      context.membershipRole === "admin" ||
      context.membershipRole === "developer",
    canViewActivity:
      context.membershipRole === "owner" ||
      context.membershipRole === "admin" ||
      context.membershipRole === "developer"
  };
}

export function getWorkspaceContextSummary(
  context: WorkspaceAuthorizationContext
) {
  return {
    organizationId: context.organizationId,
    organizationName: context.organizationName,
    organizationSlug: context.organizationSlug,
    role: context.membershipRole,
    userId: context.userId,
    userEmail: context.userEmail,
    permissions: getWorkspacePermissionSummary(context)
  };
}

export async function listWorkspaceMembers(
  context: WorkspaceAuthorizationContext
) {
  assertCanManageWorkspace(context);

  return getRepository().listMembers({
    organizationId: context.organizationId,
    accessToken: context.accessToken
  });
}

export async function listWorkspaceInvitations(
  context: WorkspaceAuthorizationContext
) {
  assertCanManageWorkspace(context);

  const invitations = await getRepository().listInvitations({
    organizationId: context.organizationId,
    accessToken: context.accessToken
  });

  const records: WorkspaceInvitationRecord[] = [];

  for (const invitation of invitations) {
    if (invitation.status === "pending" && isExpired(invitation)) {
      const expiredInvitation = await getRepository().markInvitationExpired({
        organizationId: invitation.organizationId,
        invitationId: invitation.id
      });

      records.push(
        expiredInvitation ?? {
          ...invitation,
          status: "expired"
        }
      );
      continue;
    }

    records.push(invitation);
  }

  return records;
}

export async function createWorkspaceInvitation(
  input: CreateWorkspaceInvitationInput
) {
  assertCanManageWorkspace(input.context);

  const email = normalizeEmail(input.email);
  const existingInvitation = await getRepository().findPendingInvitationByEmail({
    organizationId: input.context.organizationId,
    email,
    accessToken: input.context.accessToken
  });

  if (existingInvitation) {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_DUPLICATE",
      "A pending invitation already exists for this email address in the workspace.",
      409
    );
  }

  const { token, tokenHash, tokenPrefix } = generateWorkspaceInvitationToken();

  try {
    const invitation = await getRepository().createInvitation({
      organizationId: input.context.organizationId,
      email,
      role: input.role,
      tokenHash,
      tokenPrefix,
      expiresAt: getExpiryIso(input.expiresInDays),
      invitedBy: input.context.userId,
      accessToken: input.context.accessToken
    });

    await recordActivity({
      organizationId: input.context.organizationId,
      actorUserId: input.context.userId,
      eventType: "workspace_member_invited",
      entityType: "workspace_member_invitation",
      entityId: invitation.id,
      entityLabel: email,
      severity: input.role === "owner" || input.role === "admin" ? "warning" : "info",
      metadata: {
        email,
        role: input.role,
        tokenPrefix: invitation.tokenPrefix,
        expiresAt: invitation.expiresAt
      }
    });

    await recordSecurity({
      organizationId: input.context.organizationId,
      actorUserId: input.context.userId,
      eventType: "workspace_member_invitation_created",
      severity: input.role === "owner" || input.role === "admin" ? "warning" : "info",
      resourceType: "workspace_member_invitation",
      resourceId: invitation.id,
      outcome: "success",
      metadata: {
        email,
        role: input.role,
        tokenPrefix: invitation.tokenPrefix,
        expiresAt: invitation.expiresAt
      }
    });

    return {
      invitation,
      token,
      inviteUrl: buildInviteUrl(token),
      warning:
        "Copy this invitation link now. Invoice Lantern stores only a token hash and cannot show the raw token again."
    };
  } catch (error) {
    throw toRepositoryFailure(error, "WORKSPACE_INVITATION_CREATE_FAILED");
  }
}

export async function revokeWorkspaceInvitation(input: {
  context: WorkspaceAuthorizationContext;
  invitationId: string;
}) {
  assertCanManageWorkspace(input.context);

  const invitation = await getRepository().getInvitationById({
    organizationId: input.context.organizationId,
    invitationId: input.invitationId,
    accessToken: input.context.accessToken
  });

  if (!invitation) {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_NOT_FOUND",
      "Workspace invitation was not found.",
      404
    );
  }

  if (invitation.status === "accepted") {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_ALREADY_ACCEPTED",
      "Accepted invitations cannot be revoked.",
      409
    );
  }

  if (invitation.status === "revoked" || invitation.status === "expired") {
    return invitation;
  }

  const revokedInvitation = await getRepository().revokeInvitation({
    organizationId: input.context.organizationId,
    invitationId: input.invitationId,
    revokedBy: input.context.userId,
    accessToken: input.context.accessToken
  });

  if (!revokedInvitation) {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_REVOKE_CONFLICT",
      "Workspace invitation could not be revoked because its status changed.",
      409
    );
  }

  await recordActivity({
    organizationId: input.context.organizationId,
    actorUserId: input.context.userId,
    eventType: "workspace_member_invite_revoked",
    entityType: "workspace_member_invitation",
    entityId: revokedInvitation.id,
    entityLabel: revokedInvitation.email,
    severity: "warning",
    metadata: {
      email: revokedInvitation.email,
      role: revokedInvitation.role,
      tokenPrefix: revokedInvitation.tokenPrefix
    }
  });

  return revokedInvitation;
}

export async function acceptWorkspaceInvitation(
  input: AcceptWorkspaceInvitationInput
) {
  const tokenHash = hashWorkspaceInvitationToken(input.token);
  const invitation = await getRepository().findInvitationByTokenHash({
    tokenHash
  });
  const userEmail = normalizeEmail(input.userEmail);

  if (!invitation) {
    await recordSecurity({
      organizationId: null,
      actorUserId: input.userId,
      eventType: "workspace_member_invite_invalid_token",
      severity: "warning",
      resourceType: "workspace_member_invitation",
      outcome: "failure",
      metadata: {
        reason: "token_not_found"
      }
    });

    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_NOT_FOUND",
      "Workspace invitation was not found or is no longer available.",
      404
    );
  }

  if (invitation.status === "accepted") {
    await recordSecurity({
      organizationId: invitation.organizationId,
      actorUserId: input.userId,
      eventType: "workspace_member_invite_replay_blocked",
      severity: "warning",
      resourceType: "workspace_member_invitation",
      resourceId: invitation.id,
      outcome: "blocked",
      metadata: {
        tokenPrefix: invitation.tokenPrefix,
        status: invitation.status
      }
    });

    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_ALREADY_ACCEPTED",
      "Workspace invitation has already been accepted.",
      409
    );
  }

  if (invitation.status === "revoked") {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_REVOKED",
      "Workspace invitation has been revoked.",
      409
    );
  }

  if (invitation.status === "expired" || isExpired(invitation)) {
    await getRepository().markInvitationExpired({
      organizationId: invitation.organizationId,
      invitationId: invitation.id
    });
    await recordSecurity({
      organizationId: invitation.organizationId,
      actorUserId: input.userId,
      eventType: "workspace_member_invite_expired_attempt",
      severity: "warning",
      resourceType: "workspace_member_invitation",
      resourceId: invitation.id,
      outcome: "blocked",
      metadata: {
        tokenPrefix: invitation.tokenPrefix,
        status: "expired"
      }
    });

    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_EXPIRED",
      "Workspace invitation has expired.",
      410
    );
  }

  if (normalizeEmail(invitation.email) !== userEmail) {
    await recordSecurity({
      organizationId: invitation.organizationId,
      actorUserId: input.userId,
      eventType: "workspace_member_invite_email_mismatch",
      severity: "high",
      resourceType: "workspace_member_invitation",
      resourceId: invitation.id,
      outcome: "blocked",
      metadata: {
        tokenPrefix: invitation.tokenPrefix,
        invitedEmail: invitation.email,
        authenticatedEmail: userEmail
      }
    });

    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_EMAIL_MISMATCH",
      "Workspace invitation can only be accepted by the invited email address.",
      403
    );
  }

  const existingMembership = await getRepository().findMembershipByUser({
    organizationId: invitation.organizationId,
    userId: input.userId
  });

  if (existingMembership) {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_MEMBER_ALREADY_EXISTS",
      "Authenticated user is already a member of this workspace.",
      409
    );
  }

  await getRepository().upsertProfile({
    userId: input.userId,
    email: userEmail
  });

  let member: WorkspaceMemberRecord;

  try {
    member = await getRepository().createMembership({
      organizationId: invitation.organizationId,
      userId: input.userId,
      role: invitation.role
    });
  } catch (error) {
    if (isDuplicateError(error)) {
      throw new WorkspaceManagementServiceError(
        "WORKSPACE_MEMBER_ALREADY_EXISTS",
        "Authenticated user is already a member of this workspace.",
        409
      );
    }

    throw error;
  }

  const acceptedInvitation = await getRepository().markInvitationAccepted({
    organizationId: invitation.organizationId,
    invitationId: invitation.id,
    acceptedBy: input.userId
  });

  if (!acceptedInvitation) {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_INVITATION_ACCEPT_CONFLICT",
      "Workspace invitation could not be accepted because its status changed.",
      409
    );
  }

  await recordActivity({
    organizationId: invitation.organizationId,
    actorUserId: input.userId,
    eventType: "workspace_member_invite_accepted",
    entityType: "workspace_member_invitation",
    entityId: acceptedInvitation.id,
    entityLabel: acceptedInvitation.email,
    severity:
      acceptedInvitation.role === "owner" || acceptedInvitation.role === "admin"
        ? "warning"
        : "info",
    metadata: {
      email: acceptedInvitation.email,
      role: acceptedInvitation.role,
      memberId: member.id,
      tokenPrefix: acceptedInvitation.tokenPrefix
    }
  });

  return {
    invitation: acceptedInvitation,
    member
  };
}

export async function updateWorkspaceMemberRole(
  input: UpdateWorkspaceMemberRoleInput
) {
  assertCanManageWorkspace(input.context);

  const member = await getRepository().getMemberById({
    organizationId: input.context.organizationId,
    memberId: input.memberId,
    accessToken: input.context.accessToken
  });

  if (!member) {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_MEMBER_NOT_FOUND",
      "Workspace member was not found.",
      404
    );
  }

  if (
    isSelfEscalation({
      context: input.context,
      targetMember: member,
      targetRole: input.role
    })
  ) {
    await recordSecurity({
      organizationId: input.context.organizationId,
      actorUserId: input.context.userId,
      eventType: "workspace_member_self_escalation_blocked",
      severity: "high",
      resourceType: "organization_membership",
      resourceId: member.id,
      outcome: "blocked",
      metadata: {
        currentRole: input.context.membershipRole,
        requestedRole: input.role
      }
    });

    throw new WorkspaceManagementServiceError(
      "WORKSPACE_MEMBER_SELF_ESCALATION_BLOCKED",
      "Workspace users cannot escalate their own role.",
      403
    );
  }

  if (member.role === "owner" && input.role !== "owner") {
    const ownerCount = await getRepository().countOwners({
      organizationId: input.context.organizationId
    });

    if (ownerCount <= 1) {
      await recordSecurity({
        organizationId: input.context.organizationId,
        actorUserId: input.context.userId,
        eventType: "workspace_member_last_owner_blocked",
        severity: "high",
        resourceType: "organization_membership",
        resourceId: member.id,
        outcome: "blocked",
        metadata: {
          action: "role_update",
          previousRole: member.role,
          requestedRole: input.role
        }
      });

      throw new WorkspaceManagementServiceError(
        "WORKSPACE_LAST_OWNER_REQUIRED",
        "At least one workspace owner must remain.",
        409
      );
    }
  }

  const updatedMember = await getRepository().updateMemberRole({
    organizationId: input.context.organizationId,
    memberId: input.memberId,
    role: input.role,
    accessToken: input.context.accessToken
  });

  if (!updatedMember) {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_MEMBER_NOT_FOUND",
      "Workspace member was not found.",
      404
    );
  }

  await recordActivity({
    organizationId: input.context.organizationId,
    actorUserId: input.context.userId,
    eventType: "workspace_member_role_changed",
    entityType: "organization_membership",
    entityId: updatedMember.id,
    entityLabel: updatedMember.email ?? updatedMember.userId,
    severity:
      member.role === "owner" ||
      input.role === "owner" ||
      member.role === "admin" ||
      input.role === "admin"
        ? "warning"
        : "info",
    metadata: {
      userId: updatedMember.userId,
      email: updatedMember.email,
      previousRole: member.role,
      role: updatedMember.role
    }
  });

  return updatedMember;
}

export async function removeWorkspaceMember(input: RemoveWorkspaceMemberInput) {
  assertCanManageWorkspace(input.context);

  const member = await getRepository().getMemberById({
    organizationId: input.context.organizationId,
    memberId: input.memberId,
    accessToken: input.context.accessToken
  });

  if (!member) {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_MEMBER_NOT_FOUND",
      "Workspace member was not found.",
      404
    );
  }

  if (member.role === "owner") {
    const ownerCount = await getRepository().countOwners({
      organizationId: input.context.organizationId
    });

    if (ownerCount <= 1) {
      await recordSecurity({
        organizationId: input.context.organizationId,
        actorUserId: input.context.userId,
        eventType: "workspace_member_last_owner_blocked",
        severity: "high",
        resourceType: "organization_membership",
        resourceId: member.id,
        outcome: "blocked",
        metadata: {
          action: "member_removal",
          role: member.role
        }
      });

      throw new WorkspaceManagementServiceError(
        "WORKSPACE_LAST_OWNER_REQUIRED",
        "At least one workspace owner must remain.",
        409
      );
    }
  }

  const removedMember = await getRepository().removeMember({
    organizationId: input.context.organizationId,
    memberId: input.memberId,
    accessToken: input.context.accessToken
  });

  if (!removedMember) {
    throw new WorkspaceManagementServiceError(
      "WORKSPACE_MEMBER_NOT_FOUND",
      "Workspace member was not found.",
      404
    );
  }

  await recordActivity({
    organizationId: input.context.organizationId,
    actorUserId: input.context.userId,
    eventType: "workspace_member_removed",
    entityType: "organization_membership",
    entityId: removedMember.id,
    entityLabel: removedMember.email ?? removedMember.userId,
    severity:
      removedMember.role === "owner" || removedMember.role === "admin"
        ? "warning"
        : "info",
    metadata: {
      userId: removedMember.userId,
      email: removedMember.email,
      role: removedMember.role
    }
  });

  return removedMember;
}
