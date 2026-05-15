import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole,
  type WorkspaceAuthorizationContext
} from "../../middleware/require-workspace-role.js";
import {
  contactCreateSchema,
  contactUpdateSchema
} from "../../schemas/production-data-model.js";
import {
  WorkspaceBusinessRecordServiceError,
  archiveWorkspaceContact,
  createWorkspaceContact,
  getWorkspaceContact,
  listWorkspaceContacts,
  normalizeWorkspaceBusinessRecordError,
  updateWorkspaceContact
} from "../../services/workspace-business-record-service.js";
import { formatZodError } from "../../utils/zod-error.js";

const contactParamsSchema = z
  .object({
    id: z.string().trim().uuid()
  })
  .strict();

const contactListQuerySchema = z
  .object({
    businessProfileId: z.string().trim().uuid().optional(),
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

function sendContactError(reply: FastifyReply, error: unknown) {
  const mappedError = normalizeWorkspaceBusinessRecordError(error);

  if (mappedError instanceof WorkspaceBusinessRecordServiceError) {
    return sendError(reply, {
      statusCode: mappedError.statusCode,
      code: mappedError.code,
      message: mappedError.message
    });
  }

  console.error("Workspace contact route error:", mappedError);

  return sendError(reply, {
    statusCode: 500,
    code: "WORKSPACE_CONTACT_OPERATION_FAILED",
    message: "Could not complete the workspace contact operation."
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
    message: "Workspace contact routes require a signed-in Supabase user."
  });

  return null;
}

function sendNotFound(reply: FastifyReply) {
  return sendError(reply, {
    statusCode: 404,
    code: "WORKSPACE_CONTACT_NOT_FOUND",
    message: "Contact was not found in this workspace."
  });
}

export async function workspaceContactRoutes(app: FastifyInstance) {
  app.get(
    "/contacts",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftReaders, {
          code: "WORKSPACE_CONTACT_READ_ROLE_REQUIRED",
          message:
            "Workspace contact reading requires workspace membership with an allowed read role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedQuery = contactListQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return sendValidationError(
          reply,
          "Contact list query failed schema validation.",
          formatZodError(parsedQuery.error)
        );
      }

      try {
        const filters: NonNullable<
          Parameters<typeof listWorkspaceContacts>[0]["filters"]
        > = {
          status: parsedQuery.data.status
        };

        if (parsedQuery.data.businessProfileId) {
          filters.businessProfileId = parsedQuery.data.businessProfileId;
        }

        const records = await listWorkspaceContacts({
          context,
          filters
        });

        return {
          records,
          disclaimer:
            "Workspace contacts are reusable Invoice Lantern records. They are not official registration verification, legal advice, tax advice, accounting advice, filing, or authority acceptance."
        };
      } catch (error) {
        return sendContactError(reply, error);
      }
    }
  );

  app.post(
    "/contacts",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "WORKSPACE_CONTACT_MUTATION_ROLE_REQUIRED",
          message:
            "Workspace contact changes require an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedBody = contactCreateSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Contact create request failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const record = await createWorkspaceContact({
          context,
          data: parsedBody.data
        });

        return reply.status(201).send({
          record
        });
      } catch (error) {
        return sendContactError(reply, error);
      }
    }
  );

  app.get(
    "/contacts/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftReaders, {
          code: "WORKSPACE_CONTACT_READ_ROLE_REQUIRED",
          message:
            "Workspace contact reading requires workspace membership with an allowed read role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = contactParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Contact ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      try {
        const record = await getWorkspaceContact({
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
        return sendContactError(reply, error);
      }
    }
  );

  app.patch(
    "/contacts/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "WORKSPACE_CONTACT_MUTATION_ROLE_REQUIRED",
          message:
            "Workspace contact changes require an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = contactParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Contact ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      const parsedBody = contactUpdateSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Contact update request failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const record = await updateWorkspaceContact({
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
        return sendContactError(reply, error);
      }
    }
  );

  app.delete(
    "/contacts/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "WORKSPACE_CONTACT_MUTATION_ROLE_REQUIRED",
          message:
            "Workspace contact archival requires an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = contactParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Contact ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      try {
        const record = await archiveWorkspaceContact({
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
        return sendContactError(reply, error);
      }
    }
  );
}
