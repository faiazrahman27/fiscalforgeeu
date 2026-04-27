import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
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

export async function workspaceActivityRoutes(app: FastifyInstance) {
  app.get(
    "/activity",
    {
      preHandler: requireApiKey
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

      const records = await listAuthenticatedWorkspaceActivityEvents(context);

      return {
        records
      };
    }
  );
}
