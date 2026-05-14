import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  WorkspacePrivacyRequestRepositoryError,
  createAuthenticatedWorkspacePrivacyRequest,
  getAuthenticatedWorkspacePrivacyRequestById,
  hasAuthenticatedWorkspacePrivacyRequestContext,
  listAuthenticatedWorkspacePrivacyRequests,
  updateAuthenticatedWorkspacePrivacyRequestById,
  type AuthenticatedWorkspacePrivacyRequestContext
} from "../../repositories/workspace-privacy-request-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

const workspacePrivacyRequestSchema = z
  .object({
    requestType: z.enum([
      "data_export",
      "export",
      "deletion",
      "access",
      "correction",
      "objection",
      "restriction",
      "portability",
      "retention_review",
      "other"
    ]),
    subject: z.string().trim().min(3).max(120),
    details: z.string().trim().max(1000).optional().default("")
  })
  .strict();

const workspacePrivacyRequestParamsSchema = z
  .object({
    id: z.string().trim().uuid()
  })
  .strict();

const workspacePrivacyRequestReviewSchema = z
  .object({
    status: z.enum([
      "submitted",
      "in_review",
      "awaiting_verification",
      "approved",
      "rejected",
      "fulfilled",
      "cancelled",
      "completed"
    ]),
    reviewNote: z.string().trim().max(1000).optional().default("")
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

function getAuthenticatedWorkspacePrivacyRequestContext(
  request: FastifyRequest
): AuthenticatedWorkspacePrivacyRequestContext | null {
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

function sendWorkspacePrivacyRequestError(
  reply: FastifyReply,
  error: unknown
) {
  if (error instanceof WorkspacePrivacyRequestRepositoryError) {
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
      code: "PRIVACY_REQUEST_OPERATION_FAILED",
      message: "Could not complete the privacy request operation.",
      details: null
    }
  });
}

export async function workspacePrivacyRequestRoutes(app: FastifyInstance) {
  app.get(
    "/privacy-requests",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "PRIVACY_REQUEST_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace privacy requests require an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspacePrivacyRequestContext(request);

      if (!context || !hasAuthenticatedWorkspacePrivacyRequestContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Privacy requests require a signed-in Supabase user.",
            details: null
          }
        });
      }

      try {
        const records = await listAuthenticatedWorkspacePrivacyRequests(context);

        return {
          records
        };
      } catch (error) {
        return sendWorkspacePrivacyRequestError(reply, error);
      }
    }
  );

  app.post(
    "/privacy-requests",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "PRIVACY_REQUEST_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace privacy requests require an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspacePrivacyRequestContext(request);

      if (!context || !hasAuthenticatedWorkspacePrivacyRequestContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Privacy requests require a signed-in Supabase user.",
            details: null
          }
        });
      }

      const parsedBody = workspacePrivacyRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Privacy request failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      try {
        const record = await createAuthenticatedWorkspacePrivacyRequest(
          context,
          parsedBody.data
        );

        return reply.status(201).send({
          record
        });
      } catch (error) {
        return sendWorkspacePrivacyRequestError(reply, error);
      }
    }
  );

  app.get(
    "/privacy-requests/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "PRIVACY_REQUEST_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace privacy request detail requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspacePrivacyRequestContext(request);

      if (!context || !hasAuthenticatedWorkspacePrivacyRequestContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Privacy request detail requires a signed-in Supabase user.",
            details: null
          }
        });
      }

      const parsedParams = workspacePrivacyRequestParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Privacy request ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const record = await getAuthenticatedWorkspacePrivacyRequestById(
          context,
          parsedParams.data.id
        );

        if (!record) {
          return reply.status(404).send({
            error: {
              code: "PRIVACY_REQUEST_NOT_FOUND",
              message: "Privacy request was not found.",
              details: null
            }
          });
        }

        return {
          record,
          disclaimer:
            "Privacy request records support workflow review only. They do not provide legal advice or guarantee statutory privacy deadlines without professional review."
        };
      } catch (error) {
        return sendWorkspacePrivacyRequestError(reply, error);
      }
    }
  );

  app.patch(
    "/privacy-requests/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "PRIVACY_REQUEST_MANAGER_ROLE_REQUIRED",
          message:
            "Workspace privacy request review requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getAuthenticatedWorkspacePrivacyRequestContext(request);

      if (!context || !hasAuthenticatedWorkspacePrivacyRequestContext(context)) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Privacy request review requires a signed-in Supabase user.",
            details: null
          }
        });
      }

      const parsedParams = workspacePrivacyRequestParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Privacy request ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      const parsedBody = workspacePrivacyRequestReviewSchema.safeParse(
        request.body
      );

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Privacy request review failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      try {
        const record = await updateAuthenticatedWorkspacePrivacyRequestById(
          context,
          parsedParams.data.id,
          parsedBody.data
        );

        if (!record) {
          return reply.status(404).send({
            error: {
              code: "PRIVACY_REQUEST_NOT_FOUND",
              message: "Privacy request was not found.",
              details: null
            }
          });
        }

        return reply.status(200).send({
          record
        });
      } catch (error) {
        return sendWorkspacePrivacyRequestError(reply, error);
      }
    }
  );
}
