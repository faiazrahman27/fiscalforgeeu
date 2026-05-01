import type { FastifyReply, FastifyRequest } from "fastify";
import { checkApiKeyRateLimit } from "../services/api-rate-limit-service.js";
import {
  RATE_LIMIT_EXCEEDED_ERROR_CODE,
  getApiKeyRateLimitPolicy,
  type ApiRateLimitPolicyKey
} from "../services/api-rate-limit-policy.js";

declare module "fastify" {
  interface FastifyRequest {
    apiKeyRequestErrorCode?: string;
    apiKeyRateLimitPolicyKey?: string;
  }
}

function setRateLimitHeaders(
  reply: FastifyReply,
  input: {
    limit: number;
    remaining: number;
    resetAt: string;
    retryAfterSeconds?: number;
  }
) {
  reply.header("X-RateLimit-Limit", String(input.limit));
  reply.header("X-RateLimit-Remaining", String(Math.max(input.remaining, 0)));
  reply.header("X-RateLimit-Reset", input.resetAt);

  if (typeof input.retryAfterSeconds === "number") {
    reply.header("Retry-After", String(input.retryAfterSeconds));
  }
}

export function requireApiKeyRateLimitPolicy(
  policyKey: ApiRateLimitPolicyKey
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const policy = getApiKeyRateLimitPolicy(policyKey);
    const apiKey = request.authenticatedApiKey;

    if (!policy || request.authenticationMode !== "organization_api_key" || !apiKey) {
      return;
    }

    request.apiKeyRateLimitPolicyKey = policy.policyKey;

    const limitResult = await checkApiKeyRateLimit({
      apiKey,
      policy
    });

    if (limitResult.ok) {
      setRateLimitHeaders(reply, {
        limit: limitResult.apiKeyStatus.policy.maxRequests,
        remaining:
          Math.min(
            limitResult.apiKeyStatus.remaining,
            limitResult.organizationStatus.remaining
          ) - 1,
        resetAt: limitResult.apiKeyStatus.resetAt
      });
      return;
    }

    const limitedStatus = limitResult.limitedStatus;

    request.apiKeyRequestErrorCode = RATE_LIMIT_EXCEEDED_ERROR_CODE;

    setRateLimitHeaders(reply, {
      limit: limitedStatus.policy.maxRequests,
      remaining: 0,
      resetAt: limitedStatus.resetAt,
      retryAfterSeconds: limitedStatus.retryAfterSeconds
    });

    return reply.status(429).send({
      error: {
        code: RATE_LIMIT_EXCEEDED_ERROR_CODE,
        message: limitResult.message,
        limit: limitedStatus.policy.maxRequests,
        windowSeconds: limitedStatus.policy.windowSeconds,
        retryAfterSeconds: limitedStatus.retryAfterSeconds
      }
    });
  };
}
