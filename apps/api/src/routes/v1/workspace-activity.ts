import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  WorkspaceActivityRepositoryError,
  hasAuthenticatedWorkspaceActivityContext,
  listAuthenticatedWorkspaceActivityEvents,
  type AuthenticatedWorkspaceActivityContext
} from "../../repositories/workspace-activity-repository.js";

function readBearerToken(request: FastifyRequest) {
  const rawAuthorizationHeader = request.headers.authorization;

  if (
    Array.isArray(rawAuthorizationHeader) ||
    typeof rawAuthorizationHeader !== "string"
  ) {
    return "";
  }

  const trimmedHeader = rawAuthorizationHeader.trim();

  if (!trimmedHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return trimmedHeader.slice("bearer ".length).trim();
}

function getAuthenticatedWorkspaceActivityContext(
  request: FastifyRequest
): AuthenticatedWorkspaceActivityContext | null {
  const accessToken = readBearerToken(request);
  const userId = request.authenticatedUser?.id ?? "";

  if (!userId || !accessToken) {
    return null;
  }

  return {
    userId,
    accessToken
  };
}

function sendWorkspaceActivityError(reply: FastifyReply, error: unknown) {
  if (error instanceof WorkspaceActivityRepositoryError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: null
      }
    });
  }

  return reply.status(500).send({
    error: {
      code: "WORKSPACE_ACTIVITY_OPERATION_FAILED",
      message: "Could not complete the workspace activity operation.",
      details: null
    }
  });
}

export async function workspaceActivityRoutes(app: FastifyInstance) {
  app.get(
    "/activity",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceActivityViewers, {
          code: "WORKSPACE_ACTIVITY_ROLE_REQUIRED",
          message:
            "Workspace activity requires an organization owner, admin, or developer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceActivityContext(request);

      if (!context || !hasAuthenticatedWorkspaceActivityContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Workspace activity requires a signed-in Supabase user.",
            details: null
          }
        });
      }

      try {
        const records = await listAuthenticatedWorkspaceActivityEvents(context);

        return {
          records
        };
      } catch (error) {
        return sendWorkspaceActivityError(reply, error);
      }
    }
  );
}
