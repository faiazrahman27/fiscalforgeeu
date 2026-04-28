import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  getAuthenticatedWorkspaceRetentionPreview,
  hasAuthenticatedWorkspaceRetentionPreviewContext,
  type AuthenticatedWorkspaceRetentionPreviewContext
} from "../../repositories/workspace-retention-preview-repository.js";

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

function getAuthenticatedWorkspaceRetentionPreviewContext(
  request: FastifyRequest
): AuthenticatedWorkspaceRetentionPreviewContext | null {
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

export async function workspaceRetentionPreviewRoutes(app: FastifyInstance) {
  app.get(
    "/retention-preview",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceRetentionPreviewContext(request);

      if (!context || !hasAuthenticatedWorkspaceRetentionPreviewContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Retention preview requires a signed-in Supabase user.",
            details: null
          }
        });
      }

      const record = await getAuthenticatedWorkspaceRetentionPreview(context);

      return {
        record
      };
    }
  );
}
