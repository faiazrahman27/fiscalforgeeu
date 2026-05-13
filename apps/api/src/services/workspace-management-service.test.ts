import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type {
  WorkspaceAuthorizationContext,
  WorkspaceRole
} from "../middleware/require-workspace-role.js";
import type {
  WorkspaceActivityEventInput,
  WorkspaceInvitationInternalRecord,
  WorkspaceInvitationRecord,
  WorkspaceMemberRecord,
  WorkspaceMemberRepository,
  WorkspaceSecurityEventInput
} from "../repositories/workspace-member-repository.js";
import {
  WorkspaceManagementServiceError,
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  hashWorkspaceInvitationToken,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  removeWorkspaceMember,
  resetWorkspaceMemberRepositoryForTesting,
  revokeWorkspaceInvitation,
  setWorkspaceMemberRepositoryForTesting,
  updateWorkspaceMemberRole
} from "./workspace-management-service.js";

type MemoryRepository = WorkspaceMemberRepository & {
  members: WorkspaceMemberRecord[];
  invitations: WorkspaceInvitationInternalRecord[];
  activityEvents: WorkspaceActivityEventInput[];
  securityEvents: WorkspaceSecurityEventInput[];
};

const organizationId = "00000000-0000-4000-8000-000000000001";
const otherOrganizationId = "00000000-0000-4000-8000-000000000099";
const ownerUserId = "00000000-0000-4000-8000-000000000002";
const adminUserId = "00000000-0000-4000-8000-000000000003";
const viewerUserId = "00000000-0000-4000-8000-000000000004";
const invitedUserId = "00000000-0000-4000-8000-000000000005";
const otherOwnerUserId = "00000000-0000-4000-8000-000000000006";

let repository: MemoryRepository;

beforeEach(() => {
  repository = createMemoryRepository();
  setWorkspaceMemberRepositoryForTesting(repository);
});

afterEach(() => {
  resetWorkspaceMemberRepositoryForTesting();
});

function createContext(
  role: WorkspaceRole = "owner",
  userId = ownerUserId,
  orgId = organizationId
): WorkspaceAuthorizationContext {
  return {
    userId,
    accessToken: "test-access-token",
    organizationId: orgId,
    organizationName: orgId === organizationId ? "Main workspace" : "Other",
    organizationSlug: orgId === organizationId ? "main-workspace" : "other",
    membershipRole: role,
    userEmail:
      userId === ownerUserId
        ? "owner@example.test"
        : userId === adminUserId
          ? "admin@example.test"
          : "viewer@example.test"
  };
}

function nowIso() {
  return new Date().toISOString();
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function nextId(prefix: number, index: number) {
  return `00000000-0000-4000-8000-${String(prefix + index).padStart(12, "0")}`;
}

function stripInvitation(
  invitation: WorkspaceInvitationInternalRecord
): WorkspaceInvitationRecord {
  const { tokenHash: _tokenHash, ...safeInvitation } = invitation;

  return {
    ...safeInvitation
  };
}

function createMember(input: {
  id: string;
  organizationId: string;
  userId: string;
  role: WorkspaceRole;
  email: string | null;
}): WorkspaceMemberRecord {
  const timestamp = nowIso();

  return {
    id: input.id,
    organizationId: input.organizationId,
    userId: input.userId,
    role: input.role,
    email: input.email,
    displayName: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createMemoryRepository(): MemoryRepository {
  const members: WorkspaceMemberRecord[] = [
    createMember({
      id: nextId(10, 1),
      organizationId,
      userId: ownerUserId,
      role: "owner",
      email: "owner@example.test"
    }),
    createMember({
      id: nextId(10, 2),
      organizationId,
      userId: adminUserId,
      role: "admin",
      email: "admin@example.test"
    }),
    createMember({
      id: nextId(10, 3),
      organizationId,
      userId: viewerUserId,
      role: "viewer",
      email: "viewer@example.test"
    }),
    createMember({
      id: nextId(10, 4),
      organizationId: otherOrganizationId,
      userId: otherOwnerUserId,
      role: "owner",
      email: "owner@other.example"
    })
  ];
  const invitations: WorkspaceInvitationInternalRecord[] = [];
  const activityEvents: WorkspaceActivityEventInput[] = [];
  const securityEvents: WorkspaceSecurityEventInput[] = [];

  return {
    members,
    invitations,
    activityEvents,
    securityEvents,

    async listMembers(input) {
      return members.filter(
        (member) => member.organizationId === input.organizationId
      );
    },

    async getMemberById(input) {
      return (
        members.find(
          (member) =>
            member.organizationId === input.organizationId &&
            member.id === input.memberId
        ) ?? null
      );
    },

    async findMembershipByUser(input) {
      return (
        members.find(
          (member) =>
            member.organizationId === input.organizationId &&
            member.userId === input.userId
        ) ?? null
      );
    },

    async countOwners(input) {
      return members.filter(
        (member) =>
          member.organizationId === input.organizationId &&
          member.role === "owner"
      ).length;
    },

    async updateMemberRole(input) {
      const member =
        members.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.id === input.memberId
        ) ?? null;

      if (!member) {
        return null;
      }

      member.role = input.role;
      member.updatedAt = nowIso();

      return member;
    },

    async removeMember(input) {
      const index = members.findIndex(
        (member) =>
          member.organizationId === input.organizationId &&
          member.id === input.memberId
      );

      if (index < 0) {
        return null;
      }

      const [member] = members.splice(index, 1);

      return member ?? null;
    },

    async upsertProfile(input) {
      const member = members.find((item) => item.userId === input.userId);

      if (member) {
        member.email = input.email;
      }
    },

    async createMembership(input) {
      const duplicate = members.find(
        (member) =>
          member.organizationId === input.organizationId &&
          member.userId === input.userId
      );

      if (duplicate) {
        throw new Error("duplicate membership");
      }

      const member = createMember({
        id: nextId(100, members.length + 1),
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
        email: null
      });

      members.push(member);

      return member;
    },

    async listInvitations(input) {
      return invitations
        .filter((invitation) => invitation.organizationId === input.organizationId)
        .map(stripInvitation);
    },

    async getInvitationById(input) {
      const invitation =
        invitations.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.id === input.invitationId
        ) ?? null;

      return invitation ? stripInvitation(invitation) : null;
    },

    async findPendingInvitationByEmail(input) {
      const invitation =
        invitations.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.email === input.email &&
            item.status === "pending"
        ) ?? null;

      return invitation ? stripInvitation(invitation) : null;
    },

    async findInvitationByTokenHash(input) {
      return (
        invitations.find(
          (invitation) => invitation.tokenHash === input.tokenHash
        ) ?? null
      );
    },

    async createInvitation(input) {
      const duplicate = invitations.find(
        (invitation) =>
          invitation.organizationId === input.organizationId &&
          invitation.email === input.email &&
          invitation.status === "pending"
      );

      if (duplicate) {
        throw new Error("duplicate pending invitation");
      }

      const timestamp = nowIso();
      const invitation: WorkspaceInvitationInternalRecord = {
        id: nextId(200, invitations.length + 1),
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        tokenHash: input.tokenHash,
        tokenPrefix: input.tokenPrefix,
        status: "pending",
        invitedBy: input.invitedBy,
        acceptedBy: null,
        revokedBy: null,
        expiresAt: input.expiresAt,
        acceptedAt: null,
        revokedAt: null,
        metadata: {},
        createdAt: timestamp,
        updatedAt: timestamp
      };

      invitations.unshift(invitation);

      return stripInvitation(invitation);
    },

    async markInvitationAccepted(input) {
      const invitation =
        invitations.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.id === input.invitationId &&
            item.status === "pending"
        ) ?? null;

      if (!invitation) {
        return null;
      }

      invitation.status = "accepted";
      invitation.acceptedBy = input.acceptedBy;
      invitation.acceptedAt = nowIso();
      invitation.updatedAt = invitation.acceptedAt;

      return stripInvitation(invitation);
    },

    async markInvitationExpired(input) {
      const invitation =
        invitations.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.id === input.invitationId &&
            item.status === "pending"
        ) ?? null;

      if (!invitation) {
        return null;
      }

      invitation.status = "expired";
      invitation.updatedAt = nowIso();

      return stripInvitation(invitation);
    },

    async revokeInvitation(input) {
      const invitation =
        invitations.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.id === input.invitationId &&
            item.status === "pending"
        ) ?? null;

      if (!invitation) {
        return null;
      }

      invitation.status = "revoked";
      invitation.revokedBy = input.revokedBy;
      invitation.revokedAt = nowIso();
      invitation.updatedAt = invitation.revokedAt;

      return stripInvitation(invitation);
    },

    async recordActivityEvent(input) {
      activityEvents.push(input);
    },

    async recordSecurityEvent(input) {
      securityEvents.push(input);
    }
  };
}

function assertServiceError(
  error: unknown,
  code: string,
  statusCode: number
) {
  assert.equal(error instanceof WorkspaceManagementServiceError, true);
  const serviceError = error as WorkspaceManagementServiceError;

  assert.equal(serviceError.code, code);
  assert.equal(serviceError.statusCode, statusCode);
}

test("owner can create an invitation with one-time raw token and hash-only storage", async () => {
  const created = await createWorkspaceInvitation({
    context: createContext("owner"),
    email: "New.Member@Example.Test",
    role: "reviewer"
  });

  assert.match(created.token, /^il_inv_[A-Za-z0-9_-]+\./);
  assert.match(created.inviteUrl, /\/workspace\/invitations\/accept\?token=/);
  assert.equal(created.warning.includes("stores only a token hash"), true);
  assert.equal(created.invitation.email, "new.member@example.test");
  assert.equal("tokenHash" in created.invitation, false);

  const storedInvitation = repository.invitations[0];

  assert.ok(storedInvitation);
  assert.equal(storedInvitation.tokenHash, hashWorkspaceInvitationToken(created.token));
  assert.notEqual(storedInvitation.tokenHash, created.token);
  assert.match(storedInvitation.tokenHash, /^[a-f0-9]{64}$/);

  const listed = await listWorkspaceInvitations(createContext("owner"));
  const serializedList = JSON.stringify(listed);

  assert.equal(listed.length, 1);
  assert.equal(serializedList.includes(created.token), false);
  assert.equal(serializedList.includes("tokenHash"), false);
  assert.equal(repository.activityEvents[0]?.eventType, "workspace_member_invited");
});

test("non-manager workspace roles cannot create invitations", async () => {
  for (const role of ["accountant", "developer", "reviewer", "viewer"] as const) {
    await assert.rejects(
      () =>
        createWorkspaceInvitation({
          context: createContext(role),
          email: `${role}@example.test`,
          role: "viewer"
        }),
      (error) => {
        assertServiceError(error, "WORKSPACE_MANAGER_ROLE_REQUIRED", 403);
        return true;
      }
    );
  }
});

test("matching authenticated email can accept a pending invitation", async () => {
  const created = await createWorkspaceInvitation({
    context: createContext("admin", adminUserId),
    email: "Invited@Example.Test",
    role: "accountant"
  });

  const accepted = await acceptWorkspaceInvitation({
    userId: invitedUserId,
    userEmail: "invited@example.test",
    token: created.token
  });

  assert.equal(accepted.member.organizationId, organizationId);
  assert.equal(accepted.member.userId, invitedUserId);
  assert.equal(accepted.member.role, "accountant");
  assert.equal(accepted.invitation.status, "accepted");
  assert.equal(accepted.invitation.acceptedBy, invitedUserId);
  assert.equal(repository.activityEvents.at(-1)?.eventType, "workspace_member_invite_accepted");
});

test("invitation acceptance rejects email mismatch, expired, revoked, and replayed tokens", async () => {
  const mismatch = await createWorkspaceInvitation({
    context: createContext("owner"),
    email: "target@example.test",
    role: "viewer"
  });

  await assert.rejects(
    () =>
      acceptWorkspaceInvitation({
        userId: invitedUserId,
        userEmail: "other@example.test",
        token: mismatch.token
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_INVITATION_EMAIL_MISMATCH", 403);
      return true;
    }
  );
  assert.equal(
    repository.securityEvents.some(
      (event) => event.eventType === "workspace_member_invite_email_mismatch"
    ),
    true
  );

  const expired = await createWorkspaceInvitation({
    context: createContext("owner"),
    email: "expired@example.test",
    role: "viewer"
  });
  const expiredRecord = repository.invitations.find(
    (invitation) => invitation.email === "expired@example.test"
  );
  assert.ok(expiredRecord);
  expiredRecord.expiresAt = daysFromNow(-1);

  await assert.rejects(
    () =>
      acceptWorkspaceInvitation({
        userId: invitedUserId,
        userEmail: "expired@example.test",
        token: expired.token
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_INVITATION_EXPIRED", 410);
      return true;
    }
  );

  const revoked = await createWorkspaceInvitation({
    context: createContext("owner"),
    email: "revoked@example.test",
    role: "viewer"
  });

  await revokeWorkspaceInvitation({
    context: createContext("owner"),
    invitationId: revoked.invitation.id
  });

  await assert.rejects(
    () =>
      acceptWorkspaceInvitation({
        userId: invitedUserId,
        userEmail: "revoked@example.test",
        token: revoked.token
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_INVITATION_REVOKED", 409);
      return true;
    }
  );

  const replay = await createWorkspaceInvitation({
    context: createContext("owner"),
    email: "replay@example.test",
    role: "viewer"
  });

  await acceptWorkspaceInvitation({
    userId: invitedUserId,
    userEmail: "replay@example.test",
    token: replay.token
  });

  await assert.rejects(
    () =>
      acceptWorkspaceInvitation({
        userId: "00000000-0000-4000-8000-000000000088",
        userEmail: "replay@example.test",
        token: replay.token
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_INVITATION_ALREADY_ACCEPTED", 409);
      return true;
    }
  );
});

test("invitation revocation is manager-only and tenant-scoped", async () => {
  const created = await createWorkspaceInvitation({
    context: createContext("owner"),
    email: "revoke@example.test",
    role: "developer"
  });

  await assert.rejects(
    () =>
      revokeWorkspaceInvitation({
        context: createContext("viewer", viewerUserId),
        invitationId: created.invitation.id
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_MANAGER_ROLE_REQUIRED", 403);
      return true;
    }
  );

  await assert.rejects(
    () =>
      revokeWorkspaceInvitation({
        context: createContext("owner", otherOwnerUserId, otherOrganizationId),
        invitationId: created.invitation.id
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_INVITATION_NOT_FOUND", 404);
      return true;
    }
  );

  const revoked = await revokeWorkspaceInvitation({
    context: createContext("admin", adminUserId),
    invitationId: created.invitation.id
  });

  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.revokedBy, adminUserId);
  assert.equal(repository.activityEvents.at(-1)?.eventType, "workspace_member_invite_revoked");
});

test("member listing is tenant-scoped and returns safe identity fields only", async () => {
  const records = await listWorkspaceMembers(createContext("owner"));
  const serialized = JSON.stringify(records);

  assert.equal(records.length, 3);
  assert.equal(
    records.some((member) => member.organizationId === otherOrganizationId),
    false
  );
  assert.equal(serialized.includes("password"), false);
  assert.equal(serialized.includes("raw_user_meta_data"), false);
});

test("role updates enforce manager roles, self-escalation block, and last-owner protection", async () => {
  const viewer = repository.members.find((member) => member.userId === viewerUserId);

  assert.ok(viewer);

  const updated = await updateWorkspaceMemberRole({
    context: createContext("owner"),
    memberId: viewer.id,
    role: "reviewer"
  });

  assert.equal(updated.role, "reviewer");
  assert.equal(repository.activityEvents.at(-1)?.eventType, "workspace_member_role_changed");

  await assert.rejects(
    () =>
      updateWorkspaceMemberRole({
        context: createContext("viewer", viewerUserId),
        memberId: viewer.id,
        role: "admin"
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_MANAGER_ROLE_REQUIRED", 403);
      return true;
    }
  );

  const admin = repository.members.find((member) => member.userId === adminUserId);

  assert.ok(admin);

  await assert.rejects(
    () =>
      updateWorkspaceMemberRole({
        context: createContext("admin", adminUserId),
        memberId: admin.id,
        role: "owner"
      }),
    (error) => {
      assertServiceError(
        error,
        "WORKSPACE_MEMBER_SELF_ESCALATION_BLOCKED",
        403
      );
      return true;
    }
  );

  for (let index = repository.members.length - 1; index >= 0; index -= 1) {
    const member = repository.members[index];

    if (
      member?.organizationId === organizationId &&
      member.userId === adminUserId
    ) {
      repository.members.splice(index, 1);
    }
  }

  const owner = repository.members.find((member) => member.userId === ownerUserId);

  assert.ok(owner);

  await assert.rejects(
    () =>
      updateWorkspaceMemberRole({
        context: createContext("owner"),
        memberId: owner.id,
        role: "admin"
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_LAST_OWNER_REQUIRED", 409);
      return true;
    }
  );
});

test("member removal is tenant-scoped and preserves the last owner", async () => {
  const viewer = repository.members.find((member) => member.userId === viewerUserId);

  assert.ok(viewer);

  await assert.rejects(
    () =>
      removeWorkspaceMember({
        context: createContext("viewer", viewerUserId),
        memberId: viewer.id
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_MANAGER_ROLE_REQUIRED", 403);
      return true;
    }
  );

  const removed = await removeWorkspaceMember({
    context: createContext("admin", adminUserId),
    memberId: viewer.id
  });

  assert.equal(removed.id, viewer.id);
  assert.equal(
    repository.members.some((member) => member.id === viewer.id),
    false
  );
  assert.equal(repository.activityEvents.at(-1)?.eventType, "workspace_member_removed");

  await assert.rejects(
    () =>
      removeWorkspaceMember({
        context: createContext("owner", otherOwnerUserId, otherOrganizationId),
        memberId: nextId(10, 1)
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_MEMBER_NOT_FOUND", 404);
      return true;
    }
  );

  for (let index = repository.members.length - 1; index >= 0; index -= 1) {
    const member = repository.members[index];

    if (
      member?.organizationId === organizationId &&
      member.userId === adminUserId
    ) {
      repository.members.splice(index, 1);
    }
  }

  const owner = repository.members.find((member) => member.userId === ownerUserId);

  assert.ok(owner);

  await assert.rejects(
    () =>
      removeWorkspaceMember({
        context: createContext("owner"),
        memberId: owner.id
      }),
    (error) => {
      assertServiceError(error, "WORKSPACE_LAST_OWNER_REQUIRED", 409);
      return true;
    }
  );
});
