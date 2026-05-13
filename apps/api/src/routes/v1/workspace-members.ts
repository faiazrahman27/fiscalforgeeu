import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  WORKSPACE_ROLES,
  requireWorkspaceRole,
  type WorkspaceAuthorizationContext
} from "../../middleware/require-workspace-role.js";
import {
  workspaceInvitationAcceptSchema,
  workspaceInvitationCreateSchema,
  workspaceInvitationParamsSchema,
  workspaceMemberParamsSchema,
  workspaceMemberRoleUpdateSchema
} from "../../schemas/workspace-management.js";
import {
  WorkspaceManagementServiceError,
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  getWorkspaceContextSummary,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole
} from "../../services/workspace-management-service.js";
import { formatZodError } from "../../utils/zod-error.js";

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

function sendValidationError(
  reply: FastifyReply,
  message: string,
  details: unknown
) {
  return sendError(reply, {
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message,
    details
  });
}

function sendWorkspaceManagementError(
  reply: FastifyReply,
  error: unknown
) {
  if (error instanceof WorkspaceManagementServiceError) {
    return sendError(reply, {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    });
  }

  return sendError(reply, {
    statusCode: 500,
    code: "WORKSPACE_MANAGEMENT_OPERATION_FAILED",
    message: "Could not complete the workspace management operation."
  });
}

function getWorkspaceAuthorizationContext(
  request: FastifyRequest,
  reply: FastifyReply
): WorkspaceAuthorizationContext | null {
  const context = request.workspaceAuthorization;

  if (context) {
    return context;
  }

  sendError(reply, {
    statusCode: 401,
    code: "AUTHENTICATED_USER_REQUIRED",
    message: "Workspace management requires a signed-in Supabase user."
  });

  return null;
}

function getAuthenticatedUser(request: FastifyRequest, reply: FastifyReply) {
  const user = request.authenticatedUser;

  if (user?.id && user.email) {
    return user;
  }

  sendError(reply, {
    statusCode: 401,
    code: "AUTHENTICATED_USER_REQUIRED",
    message: "Invitation acceptance requires a signed-in Supabase user."
  });

  return null;
}

export async function workspaceMemberRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLES, {
          code: "WORKSPACE_MEMBER_ROLE_REQUIRED",
          message: "Workspace context requires an active workspace membership."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      return {
        workspace: getWorkspaceContextSummary(context)
      };
    }
  );

  app.get(
    "/members",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace member listing requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      try {
        const records = await listWorkspaceMembers(context);

        return {
          records
        };
      } catch (error) {
        return sendWorkspaceManagementError(reply, error);
      }
    }
  );

  app.patch(
    "/members/:memberId",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace member role updates require an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = workspaceMemberParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Workspace member ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      const parsedBody = workspaceMemberRoleUpdateSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Workspace member role update failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const record = await updateWorkspaceMemberRole({
          context,
          memberId: parsedParams.data.memberId,
          role: parsedBody.data.role
        });

        return {
          record
        };
      } catch (error) {
        return sendWorkspaceManagementError(reply, error);
      }
    }
  );

  app.delete(
    "/members/:memberId",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace member removal requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = workspaceMemberParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Workspace member ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      try {
        const record = await removeWorkspaceMember({
          context,
          memberId: parsedParams.data.memberId
        });

        return {
          record
        };
      } catch (error) {
        return sendWorkspaceManagementError(reply, error);
      }
    }
  );

  app.get(
    "/invitations",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace invitation listing requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      try {
        const records = await listWorkspaceInvitations(context);

        return {
          records
        };
      } catch (error) {
        return sendWorkspaceManagementError(reply, error);
      }
    }
  );

  app.post(
    "/invitations",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace invitations require an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedBody = workspaceInvitationCreateSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Workspace invitation failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const created = await createWorkspaceInvitation({
          context,
          email: parsedBody.data.email,
          role: parsedBody.data.role,
          expiresInDays: parsedBody.data.expiresInDays
        });

        return reply.status(201).send(created);
      } catch (error) {
        return sendWorkspaceManagementError(reply, error);
      }
    }
  );

  app.post(
    "/invitations/accept",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      const user = getAuthenticatedUser(request, reply);

      if (!user) {
        return reply;
      }

      const parsedBody = workspaceInvitationAcceptSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Workspace invitation acceptance failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const accepted = await acceptWorkspaceInvitation({
          userId: user.id,
          userEmail: user.email,
          token: parsedBody.data.token
        });

        return {
          record: accepted.invitation,
          member: accepted.member
        };
      } catch (error) {
        return sendWorkspaceManagementError(reply, error);
      }
    }
  );

  app.post(
    "/invitations/:id/revoke",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace invitation revocation requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = workspaceInvitationParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Workspace invitation ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      try {
        const record = await revokeWorkspaceInvitation({
          context,
          invitationId: parsedParams.data.id
        });

        return {
          record
        };
      } catch (error) {
        return sendWorkspaceManagementError(reply, error);
      }
    }
  );
}
