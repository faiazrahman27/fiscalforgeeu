import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import {
  WORKSPACE_ROLE_SETS,
  type WorkspaceAuthorizationContext
} from "../../middleware/require-workspace-role.js";
import type {
  CreateWebhookDeliveryInput,
  CreateWebhookEndpointInput,
  ListWebhookDeliveriesInput,
  ListWebhookEndpointsInput,
  UpdateWebhookEndpointInput,
  WebhookDeliveryRecord,
  WebhookEndpointRecord,
  WebhookRepository
} from "../../repositories/webhook-repository.js";
import {
  resetWebhookDeliveryDependenciesForTesting,
  setWebhookDeliveryDependenciesForTesting
} from "../../services/webhook-delivery-service.js";
import { resetWebhookOperationRateLimitsForTesting, webhookRoutes } from "./webhooks.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const otherOrganizationId = "00000000-0000-4000-8000-000000000999";
const userId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-05-14T12:00:00.000Z");

let repository: RouteMemoryWebhookRepository;

beforeEach(() => {
  repository = new RouteMemoryWebhookRepository();
  resetWebhookDeliveryDependenciesForTesting();
  resetWebhookOperationRateLimitsForTesting();
  setWebhookDeliveryDependenciesForTesting({
    repository,
    now: () => now,
    fetchImplementation: async () => new Response("accepted", { status: 200 }),
    resolver: async () => [
      {
        address: "93.184.216.34",
        family: 4
      }
    ]
  });
});

test("webhook migration creates tenant-scoped endpoint and delivery tables with RLS", () => {
  const migration = readFileSync(
    join(process.cwd(), "../../supabase/migrations/038_create_webhook_simulator.sql"),
    "utf8"
  );

  assert.match(migration, /create table if not exists public\.webhook_endpoints/);
  assert.match(migration, /create table if not exists public\.webhook_deliveries/);
  assert.match(migration, /organization_id uuid not null/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public\.can_manage_api_keys\(organization_id\)/);
  assert.doesNotMatch(migration, /drop table/i);
});

test("webhook routes reject development API key access and stay signed-user-only", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/webhooks/endpoints",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /AUTH_TOKEN_REQUIRED/);
  const webhookRoles = WORKSPACE_ROLE_SETS.apiKeyManagers as readonly string[];

  assert.equal(webhookRoles.includes("developer"), true);
  assert.equal(webhookRoles.includes("viewer"), false);
  assert.equal(webhookRoles.includes("reviewer"), false);
  assert.equal(webhookRoles.includes("accountant"), false);
});

test("webhook endpoint routes create, list, read, and rotate without leaking raw secrets", async () => {
  const createResponse = await callWebhookRoute("POST", "/endpoints", {
    body: {
      name: "Route endpoint",
      url: "https://example.com/webhook",
      eventTypes: ["webhook.test", "vida.simulation.completed"],
      description: "Signed sandbox test endpoint"
    }
  });

  assert.equal(createResponse.statusCode, 201);

  const createBody = createResponse.body as Record<string, unknown>;
  const endpoint = createBody.endpoint as Record<string, unknown>;
  const signingSecret = String(createBody.signingSecret);

  assert.match(signingSecret, /^whsec_/);
  assert.equal(JSON.stringify(endpoint).includes(signingSecret), false);

  const listResponse = await callWebhookRoute("GET", "/endpoints");

  assert.equal(listResponse.statusCode, 200);
  assert.equal(JSON.stringify(listResponse.body).includes(signingSecret), false);

  const detailResponse = await callWebhookRoute("GET", "/endpoints/:id", {
    params: {
      id: endpoint.id
    }
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(JSON.stringify(detailResponse.body).includes(signingSecret), false);

  const rotateResponse = await callWebhookRoute("POST", "/endpoints/:id/rotate-secret", {
    params: {
      id: endpoint.id
    }
  });

  assert.equal(rotateResponse.statusCode, 200);

  const rotatedSecret = String((rotateResponse.body as Record<string, unknown>).signingSecret);

  assert.match(rotatedSecret, /^whsec_/);
  assert.notEqual(rotatedSecret, signingSecret);
  assert.equal(JSON.stringify(repository.endpoints).includes(rotatedSecret), false);
});

test("webhook route validation blocks unsafe URL and secret-bearing payloads safely", async () => {
  setWebhookDeliveryDependenciesForTesting({
    repository,
    now: () => now,
    fetchImplementation: async () => new Response("accepted", { status: 200 }),
    resolver: async () => [
      {
        address: "169.254.169.254",
        family: 4
      }
    ]
  });

  const unsafeUrlResponse = await callWebhookRoute("POST", "/endpoints", {
    body: {
      name: "Unsafe endpoint",
      url: "https://example.com/webhook",
      eventTypes: ["webhook.test"]
    }
  });

  assert.equal(unsafeUrlResponse.statusCode, 400);
  assert.match(JSON.stringify(unsafeUrlResponse.body), /WEBHOOK_URL_PRIVATE_ADDRESS_BLOCKED/);

  setWebhookDeliveryDependenciesForTesting({
    repository,
    now: () => now,
    fetchImplementation: async () => new Response("accepted", { status: 200 }),
    resolver: async () => [
      {
        address: "93.184.216.34",
        family: 4
      }
    ]
  });

  const created = await callWebhookRoute("POST", "/endpoints", {
    body: {
      name: "Safe endpoint",
      url: "https://example.com/webhook",
      eventTypes: ["webhook.test"]
    }
  });
  const endpoint = (created.body as Record<string, unknown>).endpoint as Record<string, unknown>;
  const payloadResponse = await callWebhookRoute("POST", "/endpoints/:id/test", {
    params: {
      id: endpoint.id
    },
    body: {
      eventType: "webhook.test",
      payload: {
        apiKey: "secret",
        rawXml: "<Invoice />"
      }
    }
  });

  assert.equal(payloadResponse.statusCode, 400);
  assert.match(JSON.stringify(payloadResponse.body), /must not include API keys/i);
  assert.doesNotMatch(JSON.stringify(payloadResponse.body), /"apiKey":"secret"/);
  assert.doesNotMatch(JSON.stringify(payloadResponse.body), /<Invoice/);
});

test("webhook test delivery and retry routes are tenant-scoped and bounded", async () => {
  setWebhookDeliveryDependenciesForTesting({
    repository,
    now: () => now,
    fetchImplementation: async () => new Response("temporary failure", { status: 503 }),
    resolver: async () => [
      {
        address: "93.184.216.34",
        family: 4
      }
    ]
  });

  const createResponse = await callWebhookRoute("POST", "/endpoints", {
    body: {
      name: "Retry endpoint",
      url: "https://example.com/webhook",
      eventTypes: ["webhook.test"]
    }
  });
  const endpoint = (createResponse.body as Record<string, unknown>).endpoint as Record<string, unknown>;
  const testResponse = await callWebhookRoute("POST", "/endpoints/:id/test", {
    params: {
      id: endpoint.id
    },
    body: {
      eventType: "webhook.test"
    }
  });

  assert.equal(testResponse.statusCode, 200);

  const delivery = (testResponse.body as Record<string, unknown>).delivery as Record<string, unknown>;

  assert.equal(delivery.status, "failed");
  assert.equal(delivery.attemptNumber, 1);

  const retryResponse = await callWebhookRoute("POST", "/deliveries/:id/retry", {
    params: {
      id: delivery.id
    }
  });

  assert.equal(retryResponse.statusCode, 200);

  const retryDelivery = (retryResponse.body as Record<string, unknown>).delivery as Record<string, unknown>;

  assert.equal(retryDelivery.attemptNumber, 2);

  const otherOrgDetail = await callWebhookRoute("GET", "/deliveries/:id", {
    organizationId: otherOrganizationId,
    params: {
      id: retryDelivery.id
    }
  });

  assert.equal(otherOrgDetail.statusCode, 404);
});

type CapturedRouteHandler = (
  request: Record<string, unknown>,
  reply: ReturnType<typeof createRouteReply>
) => Promise<unknown> | unknown;

async function callWebhookRoute(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  input: {
    body?: unknown;
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    organizationId?: string;
  } = {}
) {
  const handler = await getWebhookRouteHandler(method, path);
  const reply = createRouteReply();
  const result = await handler(
    {
      body: input.body,
      params: input.params ?? {},
      query: input.query ?? {},
      workspaceAuthorization: buildWorkspaceContext(
        input.organizationId ?? organizationId
      )
    },
    reply
  );

  return {
    statusCode: reply.statusCode,
    body: reply.payload ?? result,
    headers: reply.headers
  };
}

async function getWebhookRouteHandler(method: string, path: string) {
  const handlers = new Map<string, CapturedRouteHandler>();
  const appStub = {
    get(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`GET ${routePath}`, handler);
      return appStub;
    },
    post(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`POST ${routePath}`, handler);
      return appStub;
    },
    patch(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`PATCH ${routePath}`, handler);
      return appStub;
    },
    delete(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`DELETE ${routePath}`, handler);
      return appStub;
    }
  };

  await webhookRoutes(appStub as never);

  const handler = handlers.get(`${method} ${path}`);

  assert.ok(handler);

  return handler;
}

function createRouteReply() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    headers: new Map<string, string>(),
    sent: false,
    header(name: string, value: string) {
      this.headers.set(name.toLowerCase(), value);
      return this;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      this.sent = true;
      return payload;
    }
  };
}

function buildWorkspaceContext(
  targetOrganizationId: string
): WorkspaceAuthorizationContext {
  return {
    userId,
    accessToken: "test-access-token",
    organizationId: targetOrganizationId,
    organizationName: "Test workspace",
    organizationSlug: "test-workspace",
    membershipRole: "developer",
    userEmail: "developer@example.test"
  };
}

class RouteMemoryWebhookRepository implements WebhookRepository {
  public readonly endpoints: WebhookEndpointRecord[] = [];
  public readonly deliveries: WebhookDeliveryRecord[] = [];

  async createEndpoint(
    input: CreateWebhookEndpointInput
  ): Promise<WebhookEndpointRecord> {
    const endpoint: WebhookEndpointRecord = {
      id: `00000000-0000-4000-8000-${String(this.endpoints.length + 20).padStart(
        12,
        "0"
      )}`,
      organizationId: input.organizationId,
      name: input.name,
      url: input.url,
      status: "active",
      eventTypes: input.eventTypes,
      description: input.description,
      signingSecretEncrypted: input.encryptedSecret.encrypted,
      signingSecretIv: input.encryptedSecret.iv,
      signingSecretTag: input.encryptedSecret.tag,
      signingSecretLast4: input.encryptedSecret.last4,
      signingSecretKeyId: input.encryptedSecret.keyId,
      lastDeliveryAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      failureCount: 0,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      disabledAt: null
    };

    this.endpoints.unshift(endpoint);

    return endpoint;
  }

  async listEndpoints(
    input: ListWebhookEndpointsInput
  ): Promise<WebhookEndpointRecord[]> {
    return this.endpoints
      .filter((endpoint) => endpoint.organizationId === input.organizationId)
      .slice(0, input.limit);
  }

  async getEndpoint(input: {
    endpointId: string;
    organizationId: string;
  }): Promise<WebhookEndpointRecord | null> {
    return (
      this.endpoints.find(
        (endpoint) =>
          endpoint.id === input.endpointId &&
          endpoint.organizationId === input.organizationId
      ) ?? null
    );
  }

  async updateEndpoint(
    input: UpdateWebhookEndpointInput
  ): Promise<WebhookEndpointRecord | null> {
    const endpoint = await this.getEndpoint(input);

    if (!endpoint) {
      return null;
    }

    Object.assign(endpoint, input.updates, {
      updatedAt: now.toISOString(),
      updatedBy: input.updatedBy
    });

    return endpoint;
  }

  async createDelivery(
    input: CreateWebhookDeliveryInput
  ): Promise<WebhookDeliveryRecord> {
    const delivery: WebhookDeliveryRecord = {
      id: input.id,
      organizationId: input.organizationId,
      webhookEndpointId: input.webhookEndpointId,
      eventType: input.eventType,
      status: input.status,
      attemptNumber: input.attemptNumber,
      maxAttempts: input.maxAttempts,
      requestUrl: input.requestUrl,
      requestMethod: input.requestMethod,
      requestHeadersRedacted: input.requestHeadersRedacted,
      requestPayload: input.requestPayload,
      payloadHash: input.payloadHash,
      signatureHeader: input.signatureHeader,
      responseStatus: input.responseStatus,
      responseHeadersRedacted: input.responseHeadersRedacted,
      responseBodyPreview: input.responseBodyPreview,
      responseTimeMs: input.responseTimeMs,
      errorCode: input.errorCode,
      errorMessageSafe: input.errorMessageSafe,
      nextRetryAt: input.nextRetryAt,
      deliveredAt: input.deliveredAt,
      createdBy: input.createdBy,
      createdAt: now.toISOString()
    };

    this.deliveries.unshift(delivery);

    return delivery;
  }

  async listDeliveries(
    input: ListWebhookDeliveriesInput
  ): Promise<WebhookDeliveryRecord[]> {
    return this.deliveries
      .filter((delivery) => delivery.organizationId === input.organizationId)
      .slice(0, input.limit);
  }

  async getDelivery(input: {
    deliveryId: string;
    organizationId: string;
  }): Promise<WebhookDeliveryRecord | null> {
    return (
      this.deliveries.find(
        (delivery) =>
          delivery.id === input.deliveryId &&
          delivery.organizationId === input.organizationId
      ) ?? null
    );
  }
}
