import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole,
  type WorkspaceAuthorizationContext
} from "../../middleware/require-workspace-role.js";
import { createAuthenticatedWorkspaceActivityEvent } from "../../repositories/workspace-activity-repository.js";
import {
  webhookDeliveryIdParamSchema,
  webhookDeliveryListQuerySchema,
  webhookEndpointCreateSchema,
  webhookEndpointIdParamSchema,
  webhookEndpointListQuerySchema,
  webhookEndpointUpdateSchema,
  webhookTestEventSchema
} from "../../schemas/webhooks.js";
import {
  WebhookServiceError,
  createWebhookEndpoint,
  disableWebhookEndpoint,
  getWebhookDelivery,
  getWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  retryWebhookDelivery,
  rotateWebhookEndpointSecret,
  sendWebhookTestEvent,
  updateWebhookEndpoint
} from "../../services/webhook-delivery-service.js";
import { WebhookSigningError } from "../../services/webhook-signing-service.js";
import { WebhookUrlSafetyError } from "../../services/webhook-url-safety.js";
import { formatZodError } from "../../utils/zod-error.js";

const webhookRoutePreHandlers = [
  requireSupabaseUser,
  requireWorkspaceRole(WORKSPACE_ROLE_SETS.apiKeyManagers, {
    code: "WEBHOOK_ROLE_REQUIRED",
    message:
      "Only workspace owners, admins, and developers can manage webhook simulator endpoints."
  })
];

type OperationRateLimitPolicy = {
  maxRequests: number;
  windowSeconds: number;
};

const operationRateLimits = {
  read: {
    maxRequests: 120,
    windowSeconds: 60
  },
  create: {
    maxRequests: 20,
    windowSeconds: 900
  },
  update: {
    maxRequests: 40,
    windowSeconds: 900
  },
  rotate: {
    maxRequests: 10,
    windowSeconds: 900
  },
  test: {
    maxRequests: 30,
    windowSeconds: 900
  },
  retry: {
    maxRequests: 30,
    windowSeconds: 900
  }
} as const satisfies Record<string, OperationRateLimitPolicy>;

type OperationRateLimitKey = keyof typeof operationRateLimits;

const rateLimitBuckets = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

export function resetWebhookOperationRateLimitsForTesting() {
  rateLimitBuckets.clear();
}

export async function webhookRoutes(app: FastifyInstance) {
  app.get(
    "/endpoints",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "read");

      if (rateLimited) {
        return rateLimited;
      }

      const parsedQuery = webhookEndpointListQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return sendValidationError(reply, "WEBHOOK_ENDPOINT_QUERY_INVALID", parsedQuery.error);
      }

      return handleWebhookOperation(reply, async () =>
        listWebhookEndpoints({
          ...context,
          ...parsedQuery.data
        })
      );
    }
  );

  app.post(
    "/endpoints",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "create");

      if (rateLimited) {
        return rateLimited;
      }

      const parsedBody = webhookEndpointCreateSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return sendValidationError(reply, "WEBHOOK_ENDPOINT_CREATE_INVALID", parsedBody.error);
      }

      return handleWebhookOperation(reply, async () => {
        const result = await createWebhookEndpoint({
          ...context,
          name: parsedBody.data.name,
          url: parsedBody.data.url,
          eventTypes: parsedBody.data.eventTypes,
          description: parsedBody.data.description ?? null
        });

        await recordWebhookActivity(request, {
          eventType: "webhook.endpoint.created",
          entityId: result.endpoint.id,
          entityLabel: result.endpoint.name,
          metadata: {
            endpointId: result.endpoint.id,
            eventTypes: result.endpoint.eventTypes,
            status: result.endpoint.status
          }
        });

        return reply.status(201).send(result);
      });
    }
  );

  app.get(
    "/endpoints/:id",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "read");

      if (rateLimited) {
        return rateLimited;
      }

      const params = webhookEndpointIdParamSchema.safeParse(request.params);

      if (!params.success) {
        return sendValidationError(reply, "WEBHOOK_ENDPOINT_ID_INVALID", params.error);
      }

      return handleWebhookOperation(reply, async () =>
        getWebhookEndpoint({
          ...context,
          endpointId: params.data.id
        })
      );
    }
  );

  app.patch(
    "/endpoints/:id",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "update");

      if (rateLimited) {
        return rateLimited;
      }

      const params = webhookEndpointIdParamSchema.safeParse(request.params);
      const body = webhookEndpointUpdateSchema.safeParse(request.body);

      if (!params.success) {
        return sendValidationError(reply, "WEBHOOK_ENDPOINT_ID_INVALID", params.error);
      }

      if (!body.success) {
        return sendValidationError(reply, "WEBHOOK_ENDPOINT_UPDATE_INVALID", body.error);
      }

      return handleWebhookOperation(reply, async () => {
        const result = await updateWebhookEndpoint({
          ...context,
          endpointId: params.data.id,
          updates: body.data
        });

        await recordWebhookActivity(request, {
          eventType: "webhook.endpoint.updated",
          entityId: result.endpoint.id,
          entityLabel: result.endpoint.name,
          metadata: {
            endpointId: result.endpoint.id,
            status: result.endpoint.status,
            eventTypes: result.endpoint.eventTypes
          }
        });

        return result;
      });
    }
  );

  app.delete(
    "/endpoints/:id",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "update");

      if (rateLimited) {
        return rateLimited;
      }

      const params = webhookEndpointIdParamSchema.safeParse(request.params);

      if (!params.success) {
        return sendValidationError(reply, "WEBHOOK_ENDPOINT_ID_INVALID", params.error);
      }

      return handleWebhookOperation(reply, async () => {
        const result = await disableWebhookEndpoint({
          ...context,
          endpointId: params.data.id
        });

        await recordWebhookActivity(request, {
          eventType: "webhook.endpoint.disabled",
          entityId: result.endpoint.id,
          entityLabel: result.endpoint.name,
          metadata: {
            endpointId: result.endpoint.id,
            status: result.endpoint.status
          }
        });

        return result;
      });
    }
  );

  app.post(
    "/endpoints/:id/rotate-secret",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "rotate");

      if (rateLimited) {
        return rateLimited;
      }

      const params = webhookEndpointIdParamSchema.safeParse(request.params);

      if (!params.success) {
        return sendValidationError(reply, "WEBHOOK_ENDPOINT_ID_INVALID", params.error);
      }

      return handleWebhookOperation(reply, async () => {
        const result = await rotateWebhookEndpointSecret({
          ...context,
          endpointId: params.data.id
        });

        await recordWebhookActivity(request, {
          eventType: "webhook.endpoint.secret_rotated",
          entityId: result.endpoint.id,
          entityLabel: result.endpoint.name,
          severity: "warning",
          metadata: {
            endpointId: result.endpoint.id,
            signingSecretLast4: result.endpoint.signingSecretLast4
          }
        });

        return result;
      });
    }
  );

  app.post(
    "/endpoints/:id/test",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "test");

      if (rateLimited) {
        return rateLimited;
      }

      const params = webhookEndpointIdParamSchema.safeParse(request.params);
      const body = webhookTestEventSchema.safeParse(request.body ?? {});

      if (!params.success) {
        return sendValidationError(reply, "WEBHOOK_ENDPOINT_ID_INVALID", params.error);
      }

      if (!body.success) {
        return sendValidationError(reply, "WEBHOOK_TEST_EVENT_INVALID", body.error);
      }

      return handleWebhookOperation(reply, async () => {
        const result = await sendWebhookTestEvent({
          ...context,
          endpointId: params.data.id,
          eventType: body.data.eventType,
          payload: body.data.payload
        });

        await recordWebhookActivity(request, {
          eventType: "webhook.test_event.sent",
          entityId: result.delivery.id,
          entityLabel: result.delivery.eventType,
          metadata: {
            deliveryId: result.delivery.id,
            endpointId: result.delivery.webhookEndpointId,
            status: result.delivery.status,
            attemptNumber: result.delivery.attemptNumber
          }
        });

        return result;
      });
    }
  );

  app.get(
    "/deliveries",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "read");

      if (rateLimited) {
        return rateLimited;
      }

      const parsedQuery = webhookDeliveryListQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return sendValidationError(reply, "WEBHOOK_DELIVERY_QUERY_INVALID", parsedQuery.error);
      }

      return handleWebhookOperation(reply, async () =>
        listWebhookDeliveries({
          ...context,
          ...parsedQuery.data
        })
      );
    }
  );

  app.get(
    "/deliveries/:id",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "read");

      if (rateLimited) {
        return rateLimited;
      }

      const params = webhookDeliveryIdParamSchema.safeParse(request.params);

      if (!params.success) {
        return sendValidationError(reply, "WEBHOOK_DELIVERY_ID_INVALID", params.error);
      }

      return handleWebhookOperation(reply, async () =>
        getWebhookDelivery({
          ...context,
          deliveryId: params.data.id
        })
      );
    }
  );

  app.post(
    "/deliveries/:id/retry",
    {
      preHandler: webhookRoutePreHandlers
    },
    async (request, reply) => {
      const context = getWorkspaceContext(request);
      const rateLimited = enforceOperationRateLimit(request, reply, "retry");

      if (rateLimited) {
        return rateLimited;
      }

      const params = webhookDeliveryIdParamSchema.safeParse(request.params);

      if (!params.success) {
        return sendValidationError(reply, "WEBHOOK_DELIVERY_ID_INVALID", params.error);
      }

      return handleWebhookOperation(reply, async () => {
        const result = await retryWebhookDelivery({
          ...context,
          deliveryId: params.data.id
        });

        await recordWebhookActivity(request, {
          eventType: "webhook.delivery.retried",
          entityId: result.delivery.id,
          entityLabel: result.delivery.eventType,
          metadata: {
            deliveryId: result.delivery.id,
            endpointId: result.delivery.webhookEndpointId,
            status: result.delivery.status,
            attemptNumber: result.delivery.attemptNumber
          }
        });

        return result;
      });
    }
  );
}

function getWorkspaceContext(request: FastifyRequest): WorkspaceAuthorizationContext {
  if (!request.workspaceAuthorization) {
    throw new WebhookServiceError({
      code: "WEBHOOK_WORKSPACE_CONTEXT_REQUIRED",
      message: "Workspace context is required for webhook simulator routes.",
      statusCode: 401
    });
  }

  return request.workspaceAuthorization;
}

async function handleWebhookOperation(
  reply: FastifyReply,
  operation: () => Promise<unknown>
) {
  try {
    const result = await operation();

    if (reply.sent) {
      return result;
    }

    return result;
  } catch (error) {
    return sendWebhookError(reply, error);
  }
}

function sendValidationError(reply: FastifyReply, code: string, error: ZodError) {
  return reply.status(400).send({
    error: {
      code,
      message: "Webhook simulator request validation failed.",
      details: formatZodError(error)
    }
  });
}

function sendWebhookError(reply: FastifyReply, error: unknown) {
  if (
    error instanceof WebhookServiceError ||
    error instanceof WebhookSigningError ||
    error instanceof WebhookUrlSafetyError
  ) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details:
          error instanceof WebhookServiceError ? error.details ?? null : null
      }
    });
  }

  return reply.status(503).send({
    error: {
      code: "WEBHOOK_OPERATION_UNAVAILABLE",
      message:
        "Webhook simulator operation could not be completed. Confirm database migrations and server configuration are applied.",
      details: null
    }
  });
}

function enforceOperationRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: OperationRateLimitKey
) {
  const context = request.workspaceAuthorization;

  if (!context) {
    return null;
  }

  const policy = operationRateLimits[operation];
  const now = Date.now();
  const key = `${operation}:${context.organizationId}:${context.userId}`;
  const existingBucket = rateLimitBuckets.get(key);
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : {
          count: 0,
          resetAt: now + policy.windowSeconds * 1000
        };

  if (bucket.count >= policy.maxRequests) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000)
    );

    reply.header("retry-after", String(retryAfterSeconds));
    reply.header("x-ratelimit-limit", String(policy.maxRequests));
    reply.header("x-ratelimit-remaining", "0");
    reply.header("x-ratelimit-reset", new Date(bucket.resetAt).toISOString());

    return reply.status(429).send({
      error: {
        code: "WEBHOOK_RATE_LIMIT_EXCEEDED",
        message:
          "Webhook simulator operation rate limit exceeded. Slow down and try again.",
        details: {
          operation,
          limit: policy.maxRequests,
          windowSeconds: policy.windowSeconds,
          retryAfterSeconds
        }
      }
    });
  }

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  reply.header("x-ratelimit-limit", String(policy.maxRequests));
  reply.header(
    "x-ratelimit-remaining",
    String(Math.max(0, policy.maxRequests - bucket.count))
  );
  reply.header("x-ratelimit-reset", new Date(bucket.resetAt).toISOString());

  return null;
}

async function recordWebhookActivity(
  request: FastifyRequest,
  input: {
    eventType: string;
    entityId: string;
    entityLabel: string;
    severity?: "info" | "warning" | "error";
    metadata: Record<string, unknown>;
  }
) {
  const userId = request.authenticatedUser?.id;
  const accessToken = request.authenticatedAccessToken;

  if (!userId || !accessToken) {
    return;
  }

  try {
    await createAuthenticatedWorkspaceActivityEvent(
      {
        userId,
        accessToken
      },
      {
        eventType: input.eventType,
        entityType: "webhook",
        entityId: input.entityId,
        entityLabel: input.entityLabel,
        severity: input.severity ?? "info",
        source: "api",
        metadata: input.metadata
      }
    );
  } catch (error) {
    request.log.warn(
      {
        error,
        eventType: input.eventType
      },
      "Webhook workspace activity logging failed"
    );
  }
}
