import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole,
  type WorkspaceAuthorizationContext
} from "../../middleware/require-workspace-role.js";
import {
  businessProfileCreateSchema,
  businessProfileUpdateSchema
} from "../../schemas/production-data-model.js";
import {
  WorkspaceBusinessRecordServiceError,
  archiveWorkspaceBusinessProfile,
  createWorkspaceBusinessProfile,
  getWorkspaceBusinessProfile,
  listWorkspaceBusinessProfiles,
  normalizeWorkspaceBusinessRecordError,
  updateWorkspaceBusinessProfile
} from "../../services/workspace-business-record-service.js";
import { formatZodError } from "../../utils/zod-error.js";

const businessProfileParamsSchema = z
  .object({
    id: z.string().trim().uuid()
  })
  .strict();

const businessProfileListQuerySchema = z
  .object({
    profileType: z.enum(["seller", "buyer", "both"]).optional(),
    status: z.enum(["active", "archived"]).optional().default("active")
  })
  .strict();

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

function sendBusinessRecordError(reply: FastifyReply, error: unknown) {
  const mappedError = normalizeWorkspaceBusinessRecordError(error);

  if (mappedError instanceof WorkspaceBusinessRecordServiceError) {
    return sendError(reply, {
      statusCode: mappedError.statusCode,
      code: mappedError.code,
      message: mappedError.message
    });
  }

  console.error("Workspace business profile route error:", mappedError);

  return sendError(reply, {
    statusCode: 500,
    code: "WORKSPACE_BUSINESS_PROFILE_OPERATION_FAILED",
    message: "Could not complete the workspace business profile operation."
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
    message: "Workspace business profile routes require a signed-in Supabase user."
  });

  return null;
}

function sendNotFound(reply: FastifyReply) {
  return sendError(reply, {
    statusCode: 404,
    code: "WORKSPACE_BUSINESS_PROFILE_NOT_FOUND",
    message: "Business profile was not found in this workspace."
  });
}

export async function workspaceBusinessProfileRoutes(app: FastifyInstance) {
  app.get(
    "/business-profiles",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftReaders, {
          code: "WORKSPACE_BUSINESS_PROFILE_READ_ROLE_REQUIRED",
          message:
            "Workspace business profile reading requires workspace membership with an allowed read role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedQuery = businessProfileListQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return sendValidationError(
          reply,
          "Business profile list query failed schema validation.",
          formatZodError(parsedQuery.error)
        );
      }

      try {
        const filters: NonNullable<
          Parameters<typeof listWorkspaceBusinessProfiles>[0]["filters"]
        > = {
          status: parsedQuery.data.status
        };

        if (parsedQuery.data.profileType) {
          filters.profileType = parsedQuery.data.profileType;
        }

        const records = await listWorkspaceBusinessProfiles({
          context,
          filters
        });

        return {
          records,
          disclaimer:
            "Workspace business profiles are reusable Invoice Lantern records. They are not official registration verification, legal advice, tax advice, accounting advice, filing, or authority acceptance."
        };
      } catch (error) {
        return sendBusinessRecordError(reply, error);
      }
    }
  );

  app.post(
    "/business-profiles",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "WORKSPACE_BUSINESS_PROFILE_MUTATION_ROLE_REQUIRED",
          message:
            "Workspace business profile changes require an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedBody = businessProfileCreateSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Business profile create request failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const record = await createWorkspaceBusinessProfile({
          context,
          data: parsedBody.data
        });

        return reply.status(201).send({
          record
        });
      } catch (error) {
        return sendBusinessRecordError(reply, error);
      }
    }
  );

  app.get(
    "/business-profiles/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftReaders, {
          code: "WORKSPACE_BUSINESS_PROFILE_READ_ROLE_REQUIRED",
          message:
            "Workspace business profile reading requires workspace membership with an allowed read role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = businessProfileParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Business profile ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      try {
        const record = await getWorkspaceBusinessProfile({
          context,
          id: parsedParams.data.id
        });

        if (!record) {
          return sendNotFound(reply);
        }

        return {
          record
        };
      } catch (error) {
        return sendBusinessRecordError(reply, error);
      }
    }
  );

  app.patch(
    "/business-profiles/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "WORKSPACE_BUSINESS_PROFILE_MUTATION_ROLE_REQUIRED",
          message:
            "Workspace business profile changes require an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = businessProfileParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Business profile ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      const parsedBody = businessProfileUpdateSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Business profile update request failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const record = await updateWorkspaceBusinessProfile({
          context,
          id: parsedParams.data.id,
          data: request.body as Record<string, unknown>
        });

        if (!record) {
          return sendNotFound(reply);
        }

        return {
          record
        };
      } catch (error) {
        return sendBusinessRecordError(reply, error);
      }
    }
  );

  app.delete(
    "/business-profiles/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "WORKSPACE_BUSINESS_PROFILE_MUTATION_ROLE_REQUIRED",
          message:
            "Workspace business profile archival requires an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = businessProfileParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Business profile ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      try {
        const record = await archiveWorkspaceBusinessProfile({
          context,
          id: parsedParams.data.id
        });

        if (!record) {
          return sendNotFound(reply);
        }

        return {
          record,
          archived: true
        };
      } catch (error) {
        return sendBusinessRecordError(reply, error);
      }
    }
  );
}
