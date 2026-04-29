import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  createAuthenticatedWorkspaceDeletionRun,
  hasAuthenticatedWorkspaceDeletionRunContext,
  listAuthenticatedWorkspaceDeletionRuns,
  type AuthenticatedWorkspaceDeletionRunContext
} from "../../repositories/workspace-deletion-run-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

const deletionRunCreateBodySchema = z
  .object({
    sourcePrivacyRequestId: z.string().uuid()
  })
  .strict();

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

function getAuthenticatedWorkspaceDeletionRunContext(
  request: FastifyRequest
): AuthenticatedWorkspaceDeletionRunContext | null {
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

export async function workspaceDeletionRunRoutes(app: FastifyInstance) {
  app.get(
    "/deletion-runs",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceDeletionRunContext(request);

      if (!context || !hasAuthenticatedWorkspaceDeletionRunContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Deletion runs require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const records = await listAuthenticatedWorkspaceDeletionRuns(context);

      return {
        records
      };
    }
  );

  app.post(
    "/deletion-runs",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceDeletionRunContext(request);

      if (!context || !hasAuthenticatedWorkspaceDeletionRunContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Deletion run preparation requires a signed-in Supabase user.",
            details: null
          }
        });
      }

      const parsedBody = deletionRunCreateBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Deletion run payload failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      try {
        const record = await createAuthenticatedWorkspaceDeletionRun(
          context,
          parsedBody.data
        );

        if (!record) {
          return reply.status(404).send({
            error: {
              code: "SOURCE_PRIVACY_REQUEST_NOT_FOUND",
              message: "The linked deletion privacy request was not found.",
              details: null
            }
          });
        }

        return reply.status(201).send({
          record
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not prepare deletion run.";

        if (
          message ===
          "Deletion runs must be linked to a deletion privacy request."
        ) {
          return reply.status(409).send({
            error: {
              code: "INVALID_SOURCE_PRIVACY_REQUEST",
              message,
              details: null
            }
          });
        }

        throw error;
      }
    }
  );
}
