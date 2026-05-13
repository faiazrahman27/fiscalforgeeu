import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import type { WorkspaceAuthorizationContext } from "../../middleware/require-workspace-role.js";
import type {
  WorkspaceActivityEventInput,
  WorkspaceInvitationInternalRecord,
  WorkspaceMemberRecord,
  WorkspaceMemberRepository,
  WorkspaceSecurityEventInput
} from "../../repositories/workspace-member-repository.js";
import {
  resetWorkspaceMemberRepositoryForTesting,
  setWorkspaceMemberRepositoryForTesting
} from "../../services/workspace-management-service.js";
import { workspaceMemberRoutes } from "./workspace-members.js";

type CapturedRouteHandler = (
  request: Record<string, unknown>,
  reply: ReturnType<typeof createRouteReply>
) => Promise<unknown> | unknown;

type MinimalRepository = WorkspaceMemberRepository & {
  invitations: WorkspaceInvitationInternalRecord[];
};

const organizationId = "00000000-0000-4000-8000-000000000001";
const ownerUserId = "00000000-0000-4000-8000-000000000002";

let repository: MinimalRepository;

beforeEach(() => {
  repository = createMinimalRepository();
  setWorkspaceMemberRepositoryForTesting(repository);
});

afterEach(() => {
  resetWorkspaceMemberRepositoryForTesting();
});

function createContext(
  role: WorkspaceAuthorizationContext["membershipRole"] = "owner"
): WorkspaceAuthorizationContext {
  return {
    userId: ownerUserId,
    accessToken: "test-access-token",
    organizationId,
    organizationName: "Main workspace",
    organizationSlug: "main-workspace",
    membershipRole: role,
    userEmail: "owner@example.test"
  };
}

function nowIso() {
  return new Date().toISOString();
}

function createRouteReply() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return payload;
    }
  };
}

async function getWorkspaceRouteHandler(method: string, path: string) {
  const handlers = new Map<string, CapturedRouteHandler>();
  const appStub = {
    get(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`GET ${routePath}`, handler);
      return appStub;
    },
    post(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`POST ${routePath}`, handler);
      return appStub;
    },
    patch(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`PATCH ${routePath}`, handler);
      return appStub;
    },
    delete(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`DELETE ${routePath}`, handler);
      return appStub;
    }
  };

  await workspaceMemberRoutes(appStub as never);

  const handler = handlers.get(`${method} ${path}`);

  assert.ok(handler, `Expected route handler ${method} ${path}`);

  return handler;
}

function createMinimalRepository(): MinimalRepository {
  const invitations: WorkspaceInvitationInternalRecord[] = [];
  const member: WorkspaceMemberRecord = {
    id: "00000000-0000-4000-8000-000000000010",
    organizationId,
    userId: ownerUserId,
    role: "owner",
    email: "owner@example.test",
    displayName: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  return {
    invitations,
    async listMembers() {
      return [member];
    },
    async getMemberById() {
      return member;
    },
    async findMembershipByUser() {
      return null;
    },
    async countOwners() {
      return 1;
    },
    async updateMemberRole() {
      return member;
    },
    async removeMember() {
      return member;
    },
    async upsertProfile() {},
    async createMembership() {
      return member;
    },
    async listInvitations() {
      return invitations.map(({ tokenHash: _tokenHash, ...invitation }) => ({
        ...invitation
      }));
    },
    async getInvitationById() {
      return null;
    },
    async findPendingInvitationByEmail() {
      return null;
    },
    async findInvitationByTokenHash() {
      return null;
    },
    async createInvitation(input) {
      const timestamp = nowIso();
      const invitation: WorkspaceInvitationInternalRecord = {
        id: "00000000-0000-4000-8000-000000000020",
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

      invitations.push(invitation);
      const { tokenHash: _tokenHash, ...safeInvitation } = invitation;

      return {
        ...safeInvitation
      };
    },
    async markInvitationAccepted() {
      return null;
    },
    async markInvitationExpired() {
      return null;
    },
    async revokeInvitation() {
      return null;
    },
    async recordActivityEvent(_input: WorkspaceActivityEventInput) {},
    async recordSecurityEvent(_input: WorkspaceSecurityEventInput) {}
  };
}

test("workspace invitation route validates unknown fields and returns token once without token hash", async () => {
  const handler = await getWorkspaceRouteHandler("POST", "/invitations");

  const invalidReply = createRouteReply();
  const invalidResult = await handler(
    {
      body: {
        email: "member@example.test",
        role: "viewer",
        unexpected: true
      },
      workspaceAuthorization: createContext("owner")
    },
    invalidReply
  );

  assert.equal(invalidReply.statusCode, 400);
  assert.match(JSON.stringify(invalidReply.payload ?? invalidResult), /VALIDATION_ERROR/);

  const reply = createRouteReply();
  const result = await handler(
    {
      body: {
        email: "member@example.test",
        role: "viewer"
      },
      workspaceAuthorization: createContext("owner")
    },
    reply
  );

  assert.equal(reply.statusCode, 201);

  const body = (reply.payload ?? result) as Record<string, unknown>;

  assert.equal(typeof body.token, "string");
  assert.equal(typeof body.inviteUrl, "string");
  assert.equal(JSON.stringify(body).includes("tokenHash"), false);
  assert.equal(JSON.stringify(body).includes("token_hash"), false);
  assert.equal(repository.invitations[0]?.tokenHash.length, 64);
});

test("workspace invitation route preserves service-level role denial", async () => {
  const handler = await getWorkspaceRouteHandler("POST", "/invitations");
  const reply = createRouteReply();
  const result = await handler(
    {
      body: {
        email: "member@example.test",
        role: "viewer"
      },
      workspaceAuthorization: createContext("viewer")
    },
    reply
  );

  assert.equal(reply.statusCode, 403);
  assert.match(
    JSON.stringify(reply.payload ?? result),
    /WORKSPACE_MANAGER_ROLE_REQUIRED/
  );
});

test("workspace member management routes reject organization API keys", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const responses = await Promise.all([
    app.inject({
      method: "GET",
      url: "/api/v1/workspace/members",
      headers: {
        "x-api-key": env.DEV_API_KEY
      }
    }),
    app.inject({
      method: "POST",
      url: "/api/v1/workspace/invitations",
      headers: {
        "x-api-key": env.DEV_API_KEY
      },
      payload: {
        email: "member@example.test",
        role: "viewer"
      }
    }),
    app.inject({
      method: "POST",
      url: "/api/v1/workspace/invitations/accept",
      headers: {
        "x-api-key": env.DEV_API_KEY
      },
      payload: {
        token: "il_inv_aaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      }
    })
  ]);

  for (const response of responses) {
    assert.equal(response.statusCode, 401);
    assert.match(response.body, /AUTH_TOKEN_REQUIRED/);
    assert.doesNotMatch(response.body, /tokenHash|token_hash/);
  }
});
