import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  ApiKeyServiceError,
  getApiKeyWorkspaceForUser
} from "../../services/api-key-service.js";
import {
  API_RATE_LIMIT_POLICY_LIST,
  getApiRateLimitPolicy
} from "../../services/api-rate-limit-policy.js";
import { getApiRateLimitUsage } from "../../services/api-rate-limit-service.js";
import { formatZodError } from "../../utils/zod-error.js";

const RATE_LIMIT_DISCLAIMER =
  "These limits protect the sandbox API from abuse and unrestricted resource consumption. They are not a service-level agreement.";

const apiUsageCurrentQuerySchema = z
  .object({
    apiKeyId: z.string().uuid().optional(),
    policyKey: z.string().trim().min(1).max(120).optional()
  })
  .strict();

type ApiUsageViewerContext = {
  userId: string;
  accessToken: string;
  organizationId: string;
  membershipRole: string;
};

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

async function getApiUsageViewerContext(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiUsageViewerContext | null> {
  const authenticatedContext = getAuthenticatedContext(request);

  if (!authenticatedContext) {
    reply.status(401).send({
      error: {
        code: "AUTHENTICATED_USER_REQUIRED",
        message: "API usage policy viewing requires a signed-in Supabase user.",
        details: null
      }
    });
    return null;
  }

  const workspace = await getApiKeyWorkspaceForUser(authenticatedContext);

  return {
    ...authenticatedContext,
    organizationId: workspace.organizationId,
    membershipRole: workspace.membershipRole
  };
}

function sendApiUsageRouteError(reply: FastifyReply, error: unknown) {
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
      code: "API_USAGE_OPERATION_FAILED",
      message: "Could not complete the API usage operation.",
      details: null
    }
  });
}

function buildPolicyResponse() {
  return API_RATE_LIMIT_POLICY_LIST.map((policy) => ({
    policyKey: policy.policyKey,
    scope: policy.scope,
    windowSeconds: policy.windowSeconds,
    maxRequests: policy.maxRequests,
    description: policy.description,
    appliesTo: policy.appliesTo
  }));
}

export async function apiUsageRoutes(app: FastifyInstance) {
  app.get(
    "/policies",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      try {
        const context = await getApiUsageViewerContext(request, reply);

        if (!context) {
          return reply;
        }

        return {
          policies: buildPolicyResponse(),
          disclaimer: RATE_LIMIT_DISCLAIMER
        };
      } catch (error) {
        return sendApiUsageRouteError(reply, error);
      }
    }
  );

  app.get(
    "/current",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      const parsedQuery = apiUsageCurrentQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "API usage query failed validation.",
            details: formatZodError(parsedQuery.error)
          }
        });
      }

      const policy = parsedQuery.data.policyKey
        ? getApiRateLimitPolicy(parsedQuery.data.policyKey)
        : null;

      if (parsedQuery.data.policyKey && !policy) {
        return reply.status(400).send({
          error: {
            code: "API_RATE_LIMIT_POLICY_UNKNOWN",
            message: "Unknown API usage policy key.",
            details: null
          }
        });
      }

      if (
        policy?.appliesTo === "api_key" &&
        parsedQuery.data.apiKeyId === undefined
      ) {
        return reply.status(400).send({
          error: {
            code: "API_RATE_LIMIT_API_KEY_REQUIRED",
            message: "apiKeyId is required when querying an API-key policy.",
            details: null
          }
        });
      }

      try {
        const context = await getApiUsageViewerContext(request, reply);

        if (!context) {
          return reply;
        }

        const usageInput = {
          organizationId: context.organizationId,
          accessToken: context.accessToken
        } as Parameters<typeof getApiRateLimitUsage>[0];

        if (parsedQuery.data.apiKeyId) {
          usageInput.apiKeyId = parsedQuery.data.apiKeyId;
        }

        if (parsedQuery.data.policyKey) {
          usageInput.policyKey = parsedQuery.data.policyKey;
        }

        const usage = await getApiRateLimitUsage(usageInput);

        return {
          usage,
          disclaimer: RATE_LIMIT_DISCLAIMER
        };
      } catch (error) {
        return sendApiUsageRouteError(reply, error);
      }
    }
  );
}
