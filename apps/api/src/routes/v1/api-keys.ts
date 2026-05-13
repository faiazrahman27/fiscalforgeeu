import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import { WORKSPACE_ROLE_SETS } from "../../middleware/require-workspace-role.js";
import {
  API_KEY_SCOPES,
  ApiKeyServiceError,
  createApiKey,
  getApiKeyWorkspaceForUser,
  listApiKeys,
  revokeApiKey,
  type ApiKeyMetadata
} from "../../services/api-key-service.js";
import { formatZodError } from "../../utils/zod-error.js";

const apiKeyCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    environment: z.enum(["test", "live"]).default("test"),
    scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).max(API_KEY_SCOPES.length),
    expiresAt: z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: "expiresAt must be a valid ISO date."
      })
      .nullable()
      .optional()
  })
  .strict();

const apiKeyParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict();

type ApiKeyManagerContext = {
  userId: string;
  accessToken: string;
  organizationId: string;
  membershipRole: string;
};

const API_KEY_MANAGER_ROLES = new Set<string>(
  WORKSPACE_ROLE_SETS.apiKeyManagers
);

function getAuthenticatedContext(request: FastifyRequest) {
  const userId = request.authenticatedUser?.id ?? "";
  const accessToken = request.authenticatedAccessToken ?? "";

  if (!userId || !accessToken) {
    return null;
  }

  return {
    userId,
    accessToken
  };
}

function isApiKeyManagerRole(role: string) {
  return API_KEY_MANAGER_ROLES.has(role);
}

function buildApiKeyResponse(apiKey: ApiKeyMetadata) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    environment: apiKey.environment,
    scopes: apiKey.scopes,
    status: apiKey.status,
    expiresAt: apiKey.expiresAt,
    lastUsedAt: apiKey.lastUsedAt,
    lastUsedIp: apiKey.lastUsedIp,
    createdBy: apiKey.createdBy,
    revokedBy: apiKey.revokedBy,
    revokedAt: apiKey.revokedAt,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt
  };
}

async function getApiKeyManagerContext(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiKeyManagerContext | null> {
  const authenticatedContext = getAuthenticatedContext(request);

  if (!authenticatedContext) {
    reply.status(401).send({
      error: {
        code: "AUTHENTICATED_USER_REQUIRED",
        message: "API key management requires a signed-in Supabase user.",
        details: null
      }
    });
    return null;
  }

  const workspace = await getApiKeyWorkspaceForUser(authenticatedContext);

  if (!isApiKeyManagerRole(workspace.membershipRole)) {
    reply.status(403).send({
      error: {
        code: "API_KEY_MANAGER_ROLE_REQUIRED",
        message:
          "API key management requires an organization owner, admin, or developer role.",
        details: {
          allowedRoles: Array.from(API_KEY_MANAGER_ROLES)
        }
      }
    });
    return null;
  }

  return {
    ...authenticatedContext,
    organizationId: workspace.organizationId,
    membershipRole: workspace.membershipRole
  };
}

function sendApiKeyRouteError(reply: FastifyReply, error: unknown) {
  if (error instanceof ApiKeyServiceError) {
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
      code: "API_KEY_OPERATION_FAILED",
      message: "Could not complete the API key operation.",
      details: null
    }
  });
}

export async function apiKeyRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      try {
        const context = await getApiKeyManagerContext(request, reply);

        if (!context) {
          return reply;
        }

        const apiKeys = await listApiKeys({
          organizationId: context.organizationId,
          accessToken: context.accessToken
        });

        return {
          apiKeys: apiKeys.map(buildApiKeyResponse)
        };
      } catch (error) {
        return sendApiKeyRouteError(reply, error);
      }
    }
  );

  app.post(
    "/",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      const parsedBody = apiKeyCreateSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "API key request body failed validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      try {
        const context = await getApiKeyManagerContext(request, reply);

        if (!context) {
          return reply;
        }

        const created = await createApiKey({
          organizationId: context.organizationId,
          name: parsedBody.data.name,
          environment: parsedBody.data.environment,
          scopes: parsedBody.data.scopes,
          expiresAt: parsedBody.data.expiresAt ?? null,
          createdBy: context.userId,
          accessToken: context.accessToken
        });

        return reply.status(201).send({
          apiKey: buildApiKeyResponse(created.apiKey),
          secret: created.secret,
          warning: created.warning
        });
      } catch (error) {
        return sendApiKeyRouteError(reply, error);
      }
    }
  );

  app.post(
    "/:id/revoke",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      const parsedParams = apiKeyParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "API key ID failed validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const context = await getApiKeyManagerContext(request, reply);

        if (!context) {
          return reply;
        }

        const apiKey = await revokeApiKey({
          organizationId: context.organizationId,
          apiKeyId: parsedParams.data.id,
          revokedBy: context.userId,
          accessToken: context.accessToken
        });

        return {
          apiKey: buildApiKeyResponse(apiKey)
        };
      } catch (error) {
        return sendApiKeyRouteError(reply, error);
      }
    }
  );
}
