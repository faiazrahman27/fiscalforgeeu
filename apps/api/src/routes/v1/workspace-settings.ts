import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  WorkspaceSettingsRepositoryError,
  getAuthenticatedWorkspaceSettings,
  hasAuthenticatedWorkspaceSettingsContext,
  updateAuthenticatedWorkspaceSettings,
  type AuthenticatedWorkspaceSettingsContext
} from "../../repositories/workspace-settings-repository.js";
import {
  getCookieTrackingStance,
  getPrivacyDataMap,
  getSubprocessorList
} from "../../services/privacy-data-map-service.js";
import { formatZodError } from "../../utils/zod-error.js";

const retentionDaysSchema = z.number().int().min(0).max(3650);

const workspaceSettingsSchema = z
  .object({
    retentionMode: z.enum(["manual", "scheduled"]),
    invoiceDraftRetentionDays: retentionDaysSchema,
    validationRunRetentionDays: retentionDaysSchema,
    xmlReportRetentionDays: retentionDaysSchema,
    xmlValidationJobRetentionDays: retentionDaysSchema.default(180),
    invoiceExportRetentionDays: retentionDaysSchema.default(365),
    apiRequestLogRetentionDays: retentionDaysSchema.default(180),
    webhookDeliveryLogRetentionDays: retentionDaysSchema.default(180),
    viesEvidenceRetentionDays: retentionDaysSchema.default(365),
    vidaSimulationRetentionDays: retentionDaysSchema.default(365),
    activityLogRetentionDays: retentionDaysSchema,
    privacyRequestRetentionDays: retentionDaysSchema.default(1095),
    retentionRunRetentionDays: retentionDaysSchema.default(1095),
    deletionRunRetentionDays: retentionDaysSchema.default(1095),
    legalAcceptanceRetentionDays: retentionDaysSchema.default(2555),
    storeUploadedXmlAfterValidation: z.boolean().default(false),
    retainValidationReports: z.boolean().default(true),
    retainViesEvidence: z.boolean().default(true),
    retainWebhookPayloadPreviews: z.boolean().default(false),
    allowDataExportRequests: z.boolean(),
    allowDeletionRequests: z.boolean(),
    includeApiLogsInExports: z.boolean().default(true),
    includeWebhookLogsInExports: z.boolean().default(true),
    includeLegalAcceptancesInExports: z.boolean().default(true),
    dataMinimizationMode: z
      .enum(["standard", "reduced", "strict"])
      .default("standard"),
    privacyContactEmail: z.string().trim().email().or(z.literal("")).default(""),
    securityContactEmail: z.string().trim().email().or(z.literal("")).default("")
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

function sendWorkspaceSettingsError(reply: FastifyReply, error: unknown) {
  if (error instanceof WorkspaceSettingsRepositoryError) {
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
      code: "WORKSPACE_SETTINGS_OPERATION_FAILED",
      message: "Could not complete the workspace settings operation.",
      details: null
    }
  });
}

export async function workspaceSettingsRoutes(app: FastifyInstance) {
  app.get(
    "/privacy/data-map",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "PRIVACY_DATA_MAP_ROLE_REQUIRED",
          message:
            "Workspace privacy data map requires an organization owner or admin role."
        })
      ]
    },
    async () => getPrivacyDataMap()
  );

  app.get(
    "/privacy/subprocessors",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "PRIVACY_SUBPROCESSOR_ROLE_REQUIRED",
          message:
            "Workspace subprocessor review requires an organization owner or admin role."
        })
      ]
    },
    async () => getSubprocessorList()
  );

  app.get(
    "/privacy/cookie-stance",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "PRIVACY_COOKIE_STANCE_ROLE_REQUIRED",
          message:
            "Workspace cookie/tracking stance requires an organization owner or admin role."
        })
      ]
    },
    async () => getCookieTrackingStance()
  );

  app.get(
    "/settings",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_SETTINGS_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace privacy and retention settings require an organization owner or admin role."
        })
      ]
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

      try {
        const record = await getAuthenticatedWorkspaceSettings(context);

        return {
          record
        };
      } catch (error) {
        return sendWorkspaceSettingsError(reply, error);
      }
    }
  );

  app.get(
    "/settings/privacy",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_SETTINGS_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace privacy and retention settings require an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceSettingsContext(request);

      if (!context || !hasAuthenticatedWorkspaceSettingsContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Workspace privacy settings require a signed-in Supabase user.",
            details: null
          }
        });
      }

      try {
        const record = await getAuthenticatedWorkspaceSettings(context);

        return {
          record,
          dataMap: getPrivacyDataMap(),
          subprocessors: getSubprocessorList(),
          cookieTracking: getCookieTrackingStance()
        };
      } catch (error) {
        return sendWorkspaceSettingsError(reply, error);
      }
    }
  );

  app.put(
    "/settings",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_SETTINGS_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace privacy and retention settings require an organization owner or admin role."
        })
      ]
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

      try {
        const record = await updateAuthenticatedWorkspaceSettings(
          context,
          parsedBody.data
        );

        return reply.status(200).send({
          record
        });
      } catch (error) {
        return sendWorkspaceSettingsError(reply, error);
      }
    }
  );

  app.patch(
    "/settings/privacy",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "WORKSPACE_SETTINGS_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace privacy and retention settings require an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspaceSettingsContext(request);

      if (!context || !hasAuthenticatedWorkspaceSettingsContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Workspace privacy settings require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const parsedBody = workspaceSettingsSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Workspace privacy settings failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      try {
        const record = await updateAuthenticatedWorkspaceSettings(
          context,
          parsedBody.data
        );

        return reply.status(200).send({
          record,
          dataMap: getPrivacyDataMap(),
          subprocessors: getSubprocessorList(),
          cookieTracking: getCookieTrackingStance()
        });
      } catch (error) {
        return sendWorkspaceSettingsError(reply, error);
      }
    }
  );
}
