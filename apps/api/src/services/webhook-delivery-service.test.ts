import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import type {
  CreateWebhookDeliveryInput,
  CreateWebhookEndpointInput,
  ListWebhookDeliveriesInput,
  ListWebhookEndpointsInput,
  UpdateWebhookEndpointInput,
  WebhookDeliveryRecord,
  WebhookEndpointRecord,
  WebhookRepository
} from "../repositories/webhook-repository.js";
import {
  resetWebhookDeliveryDependenciesForTesting,
  setWebhookDeliveryDependenciesForTesting,
  createWebhookEndpoint,
  listWebhookEndpoints,
  rotateWebhookEndpointSecret,
  sendWebhookTestEvent,
  retryWebhookDelivery
} from "./webhook-delivery-service.js";
import { verifyWebhookPayloadSignature } from "./webhook-signing-service.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const accessToken = "test-access-token";
const now = new Date("2026-05-14T12:00:00.000Z");

type FetchCall = {
  url: string;
  init: RequestInit;
};

let repository: MemoryWebhookRepository;
let fetchCalls: FetchCall[];

beforeEach(() => {
  repository = new MemoryWebhookRepository();
  fetchCalls = [];
  resetWebhookDeliveryDependenciesForTesting();
});

test("webhook endpoint creation returns secret once and list responses hide it", async () => {
  setDependencies(async () => new Response("accepted", { status: 200 }));

  const created = await createTestEndpoint();

  assert.match(created.signingSecret, /^whsec_/);
  assert.equal("signingSecret" in created.endpoint, false);
  assert.equal(JSON.stringify(repository.endpoints).includes(created.signingSecret), false);
  assert.equal(created.endpoint.signingSecretLast4, created.signingSecret.slice(-4));

  const listed = await listWebhookEndpoints({
    organizationId,
    userId,
    accessToken,
    limit: 20
  });

  assert.equal(listed.endpoints.length, 1);
  assert.equal(JSON.stringify(listed).includes(created.signingSecret), false);
  assert.match(listed.disclaimer, /not official/i);
});

test("webhook test delivery signs payloads, redacts headers, and caps safe previews", async () => {
  setDependencies(async (url, init) => {
    fetchCalls.push({
      url: String(url),
      init: init ?? {}
    });

    return new Response(
      `accepted secret=abc ${"x".repeat(700)} <soap:Envelope>hidden</soap:Envelope>`,
      {
        status: 200,
        headers: {
          "set-cookie": "session=secret",
          "x-result": "ok"
        }
      }
    );
  });

  const created = await createTestEndpoint();
  const result = await sendWebhookTestEvent({
    organizationId,
    userId,
    accessToken,
    endpointId: created.endpoint.id,
    eventType: "webhook.test"
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(result.delivery.status, "delivered");
  assert.equal(result.delivery.signatureHeaderPresent, true);
  assert.equal(result.delivery.responseHeadersRedacted["set-cookie"], "redacted");
  assert.doesNotMatch(String(result.delivery.responseBodyPreview), /abc/);
  assert.doesNotMatch(String(result.delivery.responseBodyPreview), /<soap/i);
  assert.ok(String(result.delivery.responseBodyPreview).length <= 512);

  const requestHeaders = result.delivery.requestHeadersRedacted;

  assert.equal(requestHeaders["Invoice-Lantern-Webhook-Signature"], "redacted");
  assert.doesNotMatch(JSON.stringify(result.delivery), /whsec_/);
  assert.doesNotMatch(JSON.stringify(result.delivery), /service_role/);
});

test("rotating a webhook secret signs future deliveries with the new secret", async () => {
  setDependencies(async (url, init) => {
    fetchCalls.push({
      url: String(url),
      init: init ?? {}
    });

    return new Response("ok", {
      status: 200
    });
  });

  const created = await createTestEndpoint();
  const oldSecret = created.signingSecret;
  const rotated = await rotateWebhookEndpointSecret({
    organizationId,
    userId,
    accessToken,
    endpointId: created.endpoint.id
  });

  assert.notEqual(rotated.signingSecret, oldSecret);

  await sendWebhookTestEvent({
    organizationId,
    userId,
    accessToken,
    endpointId: created.endpoint.id,
    eventType: "webhook.test"
  });

  const call = fetchCalls[0];

  assert.ok(call);

  const headers = call.init.headers as Record<string, string>;
  const deliveryId = headers["Invoice-Lantern-Webhook-Id"];
  const timestamp = headers["Invoice-Lantern-Webhook-Timestamp"];
  const signatureHeader = headers["Invoice-Lantern-Webhook-Signature"];
  const rawJsonPayload = String(call.init.body);

  assert.ok(deliveryId);
  assert.ok(timestamp);
  assert.ok(signatureHeader);

  assert.equal(
    verifyWebhookPayloadSignature({
      deliveryId,
      timestamp,
      rawJsonPayload,
      signingSecret: rotated.signingSecret,
      signatureHeader
    }),
    true
  );
  assert.equal(
    verifyWebhookPayloadSignature({
      deliveryId,
      timestamp,
      rawJsonPayload,
      signingSecret: oldSecret,
      signatureHeader
    }),
    false
  );
});

test("webhook retry creates bounded new attempts and stops at max attempts", async () => {
  setDependencies(async (url, init) => {
    fetchCalls.push({
      url: String(url),
      init: init ?? {}
    });

    return new Response("temporary failure", {
      status: 500
    });
  });

  const created = await createTestEndpoint();
  const first = await sendWebhookTestEvent({
    organizationId,
    userId,
    accessToken,
    endpointId: created.endpoint.id,
    eventType: "webhook.test"
  });
  const second = await retryWebhookDelivery({
    organizationId,
    userId,
    accessToken,
    deliveryId: first.delivery.id
  });
  const third = await retryWebhookDelivery({
    organizationId,
    userId,
    accessToken,
    deliveryId: second.delivery.id
  });

  assert.equal(first.delivery.status, "failed");
  assert.equal(second.delivery.attemptNumber, 2);
  assert.equal(third.delivery.attemptNumber, 3);
  assert.equal(repository.deliveries.length, 3);

  await assert.rejects(
    retryWebhookDelivery({
      organizationId,
      userId,
      accessToken,
      deliveryId: third.delivery.id
    }),
    /retry limit/
  );
});

test("webhook redirects are blocked and logged as failed sandbox deliveries", async () => {
  setDependencies(async () =>
    new Response("redirecting", {
      status: 302,
      headers: {
        location: "http://127.0.0.1/private"
      }
    })
  );

  const created = await createTestEndpoint();
  const result = await sendWebhookTestEvent({
    organizationId,
    userId,
    accessToken,
    endpointId: created.endpoint.id,
    eventType: "webhook.test"
  });

  assert.equal(result.delivery.status, "failed");
  assert.equal(result.delivery.errorCode, "WEBHOOK_REDIRECT_BLOCKED");
  assert.match(String(result.delivery.errorMessageSafe), /redirects are not followed/i);
});

async function createTestEndpoint() {
  return createWebhookEndpoint({
    organizationId,
    userId,
    accessToken,
    name: "Test endpoint",
    url: "https://example.com/webhook",
    eventTypes: ["webhook.test", "invoice.validation.completed"],
    description: "Integration test endpoint"
  });
}

function setDependencies(fetchImplementation: typeof fetch) {
  setWebhookDeliveryDependenciesForTesting({
    repository,
    fetchImplementation,
    now: () => now,
    resolver: async () => [
      {
        address: "93.184.216.34",
        family: 4
      }
    ]
  });
}

class MemoryWebhookRepository implements WebhookRepository {
  public readonly endpoints: WebhookEndpointRecord[] = [];
  public readonly deliveries: WebhookDeliveryRecord[] = [];

  async createEndpoint(
    input: CreateWebhookEndpointInput
  ): Promise<WebhookEndpointRecord> {
    const record: WebhookEndpointRecord = {
      id: `00000000-0000-4000-8000-${String(this.endpoints.length + 10).padStart(
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

    this.endpoints.unshift(record);

    return record;
  }

  async listEndpoints(
    input: ListWebhookEndpointsInput
  ): Promise<WebhookEndpointRecord[]> {
    return this.endpoints
      .filter((endpoint) => endpoint.organizationId === input.organizationId)
      .filter((endpoint) => (input.status ? endpoint.status === input.status : true))
      .filter((endpoint) =>
        input.eventType ? endpoint.eventTypes.includes(input.eventType) : true
      )
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
      ...input,
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
      .filter((delivery) =>
        input.endpointId ? delivery.webhookEndpointId === input.endpointId : true
      )
      .filter((delivery) => (input.status ? delivery.status === input.status : true))
      .filter((delivery) =>
        input.eventType ? delivery.eventType === input.eventType : true
      )
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
