import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ApiKeyServiceError,
  getApiKeyWorkspaceForUser,
  type ApiKeyWorkspace
} from "../services/api-key-service.js";

export const WORKSPACE_ROLES = [
  "owner",
  "admin",
  "accountant",
  "developer",
  "reviewer",
  "viewer"
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WORKSPACE_ROLE_SETS = {
  workspaceManagers: ["owner", "admin"],
  apiKeyManagers: ["owner", "admin", "developer"],
  apiRequestViewers: ["owner", "admin", "developer"],
  invoiceDraftReaders: [
    "owner",
    "admin",
    "accountant",
    "developer",
    "reviewer",
    "viewer"
  ],
  invoiceDraftEditors: ["owner", "admin", "accountant", "reviewer"],
  invoiceValidators: ["owner", "admin", "accountant", "developer", "reviewer"],
  invoiceExporters: ["owner", "admin", "accountant", "developer"],
  validationRunReaders: [
    "owner",
    "admin",
    "accountant",
    "developer",
    "reviewer",
    "viewer"
  ],
  workspaceActivityViewers: ["owner", "admin", "developer"],
  privacyManagers: ["owner", "admin"],
  retentionManagers: ["owner", "admin"],
  deletionManagers: ["owner", "admin"]
} as const satisfies Record<string, readonly WorkspaceRole[]>;

export type WorkspaceAuthorizationContext = {
  userId: string;
  accessToken: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: WorkspaceRole;
  userEmail: string;
};

declare module "fastify" {
  interface FastifyRequest {
    workspaceAuthorization?: WorkspaceAuthorizationContext;
  }
}

function isWorkspaceRole(value: string): value is WorkspaceRole {
  return WORKSPACE_ROLES.includes(value as WorkspaceRole);
}

function sendError(
  reply: FastifyReply,
  input: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  }
) {
  return reply.status(input.statusCode).send({
    error: {
      code: input.code,
      message: input.message,
      details: input.details ?? null
    }
  });
}

function sendWorkspaceContextError(reply: FastifyReply, error: unknown) {
  if (error instanceof ApiKeyServiceError) {
    return sendError(reply, {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    });
  }

  return sendError(reply, {
    statusCode: 503,
    code: "WORKSPACE_CONTEXT_UNAVAILABLE",
    message:
      "Workspace context could not be loaded. Confirm the required database migrations are applied."
  });
}

function buildWorkspaceAuthorizationContext(input: {
  userId: string;
  accessToken: string;
  workspace: ApiKeyWorkspace;
}): WorkspaceAuthorizationContext | null {
  if (!isWorkspaceRole(input.workspace.membershipRole)) {
    return null;
  }

  return {
    userId: input.userId,
    accessToken: input.accessToken,
    organizationId: input.workspace.organizationId,
    organizationName: input.workspace.organizationName,
    organizationSlug: input.workspace.organizationSlug,
    membershipRole: input.workspace.membershipRole,
    userEmail: input.workspace.userEmail
  };
}

export async function rejectOrganizationApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (request.authenticationMode !== "organization_api_key") {
    return;
  }

  return sendError(reply, {
    statusCode: 403,
    code: "SUPABASE_USER_REQUIRED",
    message:
      "This workspace endpoint requires a signed-in Supabase user. Organization API keys are not allowed for this operation."
  });
}

export function requireWorkspaceRole(
  allowedRoles: readonly WorkspaceRole[],
  input: {
    code: string;
    message: string;
  }
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.authenticationMode !== "supabase_user") {
      return;
    }

    const userId = request.authenticatedUser?.id ?? "";
    const accessToken = request.authenticatedAccessToken ?? "";

    if (!userId || !accessToken) {
      return sendError(reply, {
        statusCode: 401,
        code: "AUTHENTICATED_USER_REQUIRED",
        message: "This operation requires a signed-in Supabase user."
      });
    }

    let workspace: ApiKeyWorkspace;

    try {
      workspace = await getApiKeyWorkspaceForUser({
        userId,
        accessToken
      });
    } catch (error) {
      return sendWorkspaceContextError(reply, error);
    }

    const context = buildWorkspaceAuthorizationContext({
      userId,
      accessToken,
      workspace
    });

    if (!context || !allowedRoles.includes(context.membershipRole)) {
      return sendError(reply, {
        statusCode: 403,
        code: input.code,
        message: input.message,
        details: {
          allowedRoles
        }
      });
    }

    request.workspaceAuthorization = context;
  };
}
