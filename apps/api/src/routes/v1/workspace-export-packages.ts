import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  createAuthenticatedWorkspaceExportPackage,
  getAuthenticatedWorkspaceExportPackageById,
  hasAuthenticatedWorkspaceExportPackageContext,
  listAuthenticatedWorkspaceExportPackages,
  type AuthenticatedWorkspaceExportPackageContext
} from "../../repositories/workspace-export-package-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

const workspaceExportPackageSchema = z
  .object({
    exportName: z.string().trim().min(3).max(180),
    sourcePrivacyRequestId: z.string().trim().uuid().optional()
  })
  .strict();

const workspaceExportPackageParamsSchema = z
  .object({
    id: z.string().trim().uuid()
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

function getAuthenticatedWorkspaceExportPackageContext(
  request: FastifyRequest
): AuthenticatedWorkspaceExportPackageContext | null {
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

export async function workspaceExportPackageRoutes(app: FastifyInstance) {
  app.get(
    "/export-packages",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "WORKSPACE_EXPORT_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace export packages require an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceExportPackageContext(request);

      if (!context || !hasAuthenticatedWorkspaceExportPackageContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Export packages require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const records = await listAuthenticatedWorkspaceExportPackages(context);

      return {
        records
      };
    }
  );

  app.post(
    "/export-packages",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "WORKSPACE_EXPORT_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace export package creation requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceExportPackageContext(request);

      if (!context || !hasAuthenticatedWorkspaceExportPackageContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Export packages require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const parsedBody = workspaceExportPackageSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Export package request failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      /*
       * exactOptionalPropertyTypes is enabled.
       * So sourcePrivacyRequestId must be omitted entirely when it is absent,
       * not passed as sourcePrivacyRequestId: undefined.
       */
      const payload = {
        exportName: parsedBody.data.exportName,
        ...(parsedBody.data.sourcePrivacyRequestId
          ? {
              sourcePrivacyRequestId: parsedBody.data.sourcePrivacyRequestId
            }
          : {})
      };

      const record = await createAuthenticatedWorkspaceExportPackage(
        context,
        payload
      );

      return reply.status(201).send({
        record
      });
    }
  );

  app.get(
    "/export-packages/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "WORKSPACE_EXPORT_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace export package detail requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceExportPackageContext(request);

      if (!context || !hasAuthenticatedWorkspaceExportPackageContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Export packages require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const parsedParams = workspaceExportPackageParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Export package ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      const record = await getAuthenticatedWorkspaceExportPackageById(
        context,
        parsedParams.data.id
      );

      if (!record) {
        return reply.status(404).send({
          error: {
            code: "WORKSPACE_EXPORT_PACKAGE_NOT_FOUND",
            message: "Export package was not found.",
            details: null
          }
        });
      }

      return {
        record
      };
    }
  );
}
