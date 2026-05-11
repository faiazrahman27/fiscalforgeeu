import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  ApiKeyServiceError,
  getApiKeyWorkspaceForUser,
  getApiUsageSummary,
  listApiRequests,
  type ApiRequestMetadata,
  type ApiUsageSummary
} from "../../services/api-key-service.js";
import { formatZodError } from "../../utils/zod-error.js";

const safePathPrefixSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(/^\/[A-Za-z0-9/_\-.:]*$/, {
    message:
      "pathPrefix must start with / and contain only safe path characters."
  });

const apiRequestListQuerySchema = z
  .object({
    apiKeyId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    statusCode: z.coerce.number().int().min(100).max(599).optional(),
    pathPrefix: safePathPrefixSchema.optional()
  })
  .strict();

const apiUsageSummaryQuerySchema = z
  .object({
    apiKeyId: z.string().uuid().optional(),
    sinceDays: z.coerce.number().int().min(1).max(365).default(30)
  })
  .strict();

type ApiRequestViewerContext = {
  userId: string;
  accessToken: string;
  organizationId: string;
  membershipRole: string;
};

const API_REQUEST_VIEWER_ROLES = new Set(["owner", "admin", "developer"]);

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

function isApiRequestViewerRole(role: string) {
  return API_REQUEST_VIEWER_ROLES.has(role);
}

async function getApiRequestViewerContext(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiRequestViewerContext | null> {
  const authenticatedContext = getAuthenticatedContext(request);

  if (!authenticatedContext) {
    reply.status(401).send({
      error: {
        code: "AUTHENTICATED_USER_REQUIRED",
        message: "API request logs require a signed-in Supabase user.",
        details: null
      }
    });
    return null;
  }

  const workspace = await getApiKeyWorkspaceForUser(authenticatedContext);

  if (!isApiRequestViewerRole(workspace.membershipRole)) {
    reply.status(403).send({
      error: {
        code: "API_REQUEST_LOG_ROLE_REQUIRED",
        message:
          "API request logs require an organization owner, admin, or developer role.",
        details: {
          allowedRoles: Array.from(API_REQUEST_VIEWER_ROLES)
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

function buildApiRequestResponse(apiRequest: ApiRequestMetadata) {
  return {
    id: apiRequest.id,
    organizationId: apiRequest.organizationId,
    apiKeyId: apiRequest.apiKeyId,
    apiKeyName: apiRequest.apiKeyName,
    apiKeyPrefix: apiRequest.apiKeyPrefix,
    requestMethod: apiRequest.requestMethod,
    requestPath: apiRequest.requestPath,
    statusCode: apiRequest.statusCode,
    durationMs: apiRequest.durationMs,
    ipAddress: apiRequest.ipAddress,
    userAgent: apiRequest.userAgent,
    errorCode: apiRequest.errorCode,
    createdAt: apiRequest.createdAt
  };
}

function buildApiUsageSummaryResponse(summary: ApiUsageSummary) {
  return {
    totalRequests: summary.totalRequests,
    successfulRequests: summary.successfulRequests,
    failedRequests: summary.failedRequests,
    clientErrorCount: summary.clientErrorCount,
    serverErrorCount: summary.serverErrorCount,
    averageDurationMs: summary.averageDurationMs,
    lastRequestAt: summary.lastRequestAt,
    topPaths: summary.topPaths,
    statusBuckets: summary.statusBuckets
  };
}

function sendApiRequestRouteError(reply: FastifyReply, error: unknown) {
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
      code: "API_REQUEST_LOG_OPERATION_FAILED",
      message: "Could not complete the API request log operation.",
      details: null
    }
  });
}

export async function apiRequestRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      const parsedQuery = apiRequestListQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "API request log query failed validation.",
            details: formatZodError(parsedQuery.error)
          }
        });
      }

      try {
        const context = await getApiRequestViewerContext(request, reply);

        if (!context) {
          return reply;
        }

        const listInput = {
          organizationId: context.organizationId,
          limit: parsedQuery.data.limit,
          accessToken: context.accessToken
        } as Parameters<typeof listApiRequests>[0];

        if (parsedQuery.data.apiKeyId) {
          listInput.apiKeyId = parsedQuery.data.apiKeyId;
        }

        if (typeof parsedQuery.data.statusCode === "number") {
          listInput.statusCode = parsedQuery.data.statusCode;
        }

        if (parsedQuery.data.pathPrefix) {
          listInput.pathPrefix = parsedQuery.data.pathPrefix;
        }

        const apiRequests = await listApiRequests(listInput);

        return {
          apiRequests: apiRequests.map(buildApiRequestResponse)
        };
      } catch (error) {
        return sendApiRequestRouteError(reply, error);
      }
    }
  );

  app.get(
    "/summary",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      const parsedQuery = apiUsageSummaryQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "API usage summary query failed validation.",
            details: formatZodError(parsedQuery.error)
          }
        });
      }

      try {
        const context = await getApiRequestViewerContext(request, reply);

        if (!context) {
          return reply;
        }

        const summaryInput = {
          organizationId: context.organizationId,
          sinceDays: parsedQuery.data.sinceDays,
          accessToken: context.accessToken
        } as Parameters<typeof getApiUsageSummary>[0];

        if (parsedQuery.data.apiKeyId) {
          summaryInput.apiKeyId = parsedQuery.data.apiKeyId;
        }

        const summary = await getApiUsageSummary(summaryInput);

        return {
          summary: buildApiUsageSummaryResponse(summary)
        };
      } catch (error) {
        return sendApiRequestRouteError(reply, error);
      }
    }
  );
}