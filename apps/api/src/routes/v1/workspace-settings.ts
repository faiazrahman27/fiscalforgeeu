import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  getAuthenticatedWorkspaceSettings,
  hasAuthenticatedWorkspaceSettingsContext,
  updateAuthenticatedWorkspaceSettings,
  type AuthenticatedWorkspaceSettingsContext
} from "../../repositories/workspace-settings-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

const workspaceSettingsSchema = z
  .object({
    retentionMode: z.enum(["manual", "scheduled"]),
    invoiceDraftRetentionDays: z.number().int().min(0).max(3650),
    validationRunRetentionDays: z.number().int().min(0).max(3650),
    xmlReportRetentionDays: z.number().int().min(0).max(3650),
    activityLogRetentionDays: z.number().int().min(0).max(3650),
    allowDataExportRequests: z.boolean(),
    allowDeletionRequests: z.boolean()
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

function getAuthenticatedWorkspaceSettingsContext(
  request: FastifyRequest
): AuthenticatedWorkspaceSettingsContext | null {
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

export async function workspaceSettingsRoutes(app: FastifyInstance) {
  app.get(
    "/settings",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceSettingsContext(request);

      if (!context || !hasAuthenticatedWorkspaceSettingsContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Workspace settings require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const record = await getAuthenticatedWorkspaceSettings(context);

      return {
        record
      };
    }
  );

  app.put(
    "/settings",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceSettingsContext(request);

      if (!context || !hasAuthenticatedWorkspaceSettingsContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Workspace settings require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const parsedBody = workspaceSettingsSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Workspace settings failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      const record = await updateAuthenticatedWorkspaceSettings(
        context,
        parsedBody.data
      );

      return reply.status(200).send({
        record
      });
    }
  );
}
