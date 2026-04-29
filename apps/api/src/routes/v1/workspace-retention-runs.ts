import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  createAuthenticatedWorkspaceRetentionRun,
  executeAuthenticatedWorkspaceRetentionRun,
  hasAuthenticatedWorkspaceRetentionRunContext,
  listAuthenticatedWorkspaceRetentionRuns,
  type AuthenticatedWorkspaceRetentionRunContext
} from "../../repositories/workspace-retention-run-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

const retentionRunParamsSchema = z
  .object({
    id: z.string().uuid()
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

function getAuthenticatedWorkspaceRetentionRunContext(
  request: FastifyRequest
): AuthenticatedWorkspaceRetentionRunContext | null {
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

export async function workspaceRetentionRunRoutes(app: FastifyInstance) {
  app.get(
    "/retention-runs",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceRetentionRunContext(request);

      if (!context || !hasAuthenticatedWorkspaceRetentionRunContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Retention runs require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const records = await listAuthenticatedWorkspaceRetentionRuns(context);

      return {
        records
      };
    }
  );

  app.post(
    "/retention-runs",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceRetentionRunContext(request);

      if (!context || !hasAuthenticatedWorkspaceRetentionRunContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Retention runs require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const record = await createAuthenticatedWorkspaceRetentionRun(context);

      return reply.status(201).send({
        record
      });
    }
  );

  app.post(
    "/retention-runs/:id/execute",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceRetentionRunContext(request);

      if (!context || !hasAuthenticatedWorkspaceRetentionRunContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Retention run execution requires a signed-in Supabase user.",
            details: null
          }
        });
      }

      const parsedParams = retentionRunParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Retention run id failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const record = await executeAuthenticatedWorkspaceRetentionRun(
          context,
          parsedParams.data.id
        );

        if (!record) {
          return reply.status(404).send({
            error: {
              code: "RETENTION_RUN_NOT_FOUND",
              message: "Retention run was not found for this workspace.",
              details: null
            }
          });
        }

        return reply.status(200).send({
          record
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Retention run execution failed.";

        if (message === "Only prepared retention runs can be executed.") {
          return reply.status(409).send({
            error: {
              code: "RETENTION_RUN_NOT_EXECUTABLE",
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
