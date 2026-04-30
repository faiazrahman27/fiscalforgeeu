import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import type { ApiKeyRepository } from "../repositories/api-key-repository.js";
import {
  createApiKey,
  listApiKeys,
  resetApiKeyRepositoryForTesting,
  revokeApiKey,
  setApiKeyRepositoryForTesting,
  type ApiKeyRecord,
  type ApiKeyScope,
  type RecordApiRequestInput
} from "./api-key-service.js";

type MemoryRepository = ApiKeyRepository & {
  records: ApiKeyRecord[];
  requests: (RecordApiRequestInput & { id: string })[];
};

const organizationId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

const invoicePayload = {
  document: {
    type: "invoice",
    number: "INV-API-KEY-001",
    currency: "EUR",
    issueDate: "2026-04-29"
  },
  seller: {
    name: "Invoice Lantern Seller",
    country: "DE",
    vatId: "DE123456789"
  },
  buyer: {
    name: "Invoice Lantern Buyer",
    country: "DE",
    vatId: "DE987654321"
  },
  lines: [
    {
      id: "1",
      description: "API key technical validation test",
      quantity: "1",
      unitCode: "EA",
      unitPrice: "100.00",
      vatCategory: "S",
      vatRate: "19"
    }
  ]
};

let repository: MemoryRepository;

beforeEach(() => {
  repository = createMemoryRepository();
  setApiKeyRepositoryForTesting(repository);
});

afterEach(() => {
  resetApiKeyRepositoryForTesting();
});

function createMemoryRepository(): MemoryRepository {
  const records: ApiKeyRecord[] = [];
  const requests: (RecordApiRequestInput & { id: string })[] = [];

  return {
    records,
    requests,

    async getWorkspaceForUser() {
      return {
        organizationId,
        organizationName: "Test workspace",
        organizationSlug: "test-workspace",
        membershipRole: "admin",
        userEmail: "admin@example.test"
      };
    },

    async createApiKeyRecord(input) {
      const now = new Date().toISOString();
      const record: ApiKeyRecord = {
        id: `api_key_${records.length + 1}`,
        organizationId: input.organizationId,
        name: input.name,
        keyPrefix: input.keyPrefix,
        keyHash: input.keyHash,
        environment: input.environment,
        scopes: input.scopes,
        status: "active",
        expiresAt: input.expiresAt,
        lastUsedAt: null,
        lastUsedIp: null,
        createdBy: input.createdBy,
        revokedBy: null,
        revokedAt: null,
        createdAt: now,
        updatedAt: now
      };

      records.unshift(record);

      return record;
    },

    async listApiKeys(input) {
      return records.filter(
        (record) => record.organizationId === input.organizationId
      );
    },

    async findApiKeysByPrefix(input) {
      return records.filter((record) => record.keyPrefix === input.keyPrefix);
    },

    async revokeApiKey(input) {
      const record = records.find(
        (item) =>
          item.id === input.apiKeyId &&
          item.organizationId === input.organizationId
      );

      if (!record) {
        return null;
      }

      record.status = "revoked";
      record.revokedBy = input.revokedBy;
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;

      return record;
    },

    async markApiKeyExpired(input) {
      const record = records.find(
        (item) =>
          item.id === input.apiKeyId &&
          item.organizationId === input.organizationId
      );

      if (record) {
        record.status = "expired";
        record.updatedAt = new Date().toISOString();
      }
    },

    async updateLastUsed(input) {
      const record = records.find((item) => item.id === input.apiKeyId);

      if (record) {
        record.lastUsedAt = new Date().toISOString();
        record.lastUsedIp = input.ipAddress;
        record.updatedAt = record.lastUsedAt;
      }
    },

    async recordApiRequest(input) {
      requests.push({
        ...input,
        id: `api_request_${requests.length + 1}`
      });
    }
  };
}

async function createKey(scopes: ApiKeyScope[], expiresAt: string | null = null) {
  return createApiKey({
    organizationId,
    name: "Local test key",
    environment: "test",
    scopes,
    expiresAt,
    createdBy: userId
  });
}

async function waitForRequestLogging() {
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
}

test("API key generation uses test and live prefixes", async () => {
  const testKey = await createKey(["invoices:validate"]);
  const liveKey = await createApiKey({
    organizationId,
    name: "Live key",
    environment: "live",
    scopes: ["rules:read"],
    expiresAt: null,
    createdBy: userId
  });

  assert.match(testKey.secret, /^il_test_[A-Za-z0-9_-]{6,40}\./);
  assert.match(liveKey.secret, /^il_live_[A-Za-z0-9_-]{6,40}\./);
  assert.match(testKey.apiKey.keyPrefix, /^il_test_/);
  assert.match(liveKey.apiKey.keyPrefix, /^il_live_/);
});

test("API key secret is only returned by create and plaintext is not stored", async () => {
  const created = await createKey(["invoices:validate", "vat:validate_format"]);

  assert.equal(typeof created.secret, "string");
  assert.match(created.secret, /^il_test_/);
  assert.equal(created.warning.includes("cannot show it again"), true);

  const storedRecord = repository.records[0];

  assert.ok(storedRecord);
  assert.match(storedRecord.keyHash, /^[a-f0-9]{64}$/);
  assert.notEqual(storedRecord.keyHash, created.secret);
  assert.equal(JSON.stringify(repository.records).includes(created.secret), false);

  const listed = await listApiKeys({ organizationId });
  const firstListed = listed[0];

  assert.equal(listed.length, 1);
  assert.ok(firstListed);
  assert.equal("keyHash" in firstListed, false);
  assert.equal("secret" in firstListed, false);
});

test("revoking an API key changes status and blocks authentication", async (t) => {
  const created = await createKey(["rules:read"]);
  const revoked = await revokeApiKey({
    organizationId,
    apiKeyId: created.apiKey.id,
    revokedBy: userId
  });

  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.revokedBy, userId);

  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/validation/rules",
    headers: {
      "x-api-key": created.secret
    }
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /API_KEY_REVOKED/);
});

test("expired API keys cannot authenticate", async (t) => {
  const created = await createKey(
    ["rules:read"],
    new Date(Date.now() - 60_000).toISOString()
  );
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/validation/rules",
    headers: {
      "x-api-key": created.secret
    }
  });

  assert.equal(response.statusCode, 401);
  assert.match(response.body, /API_KEY_EXPIRED/);
});

test("insufficient API key scope is rejected", async (t) => {
  const created = await createKey(["rules:read"]);
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/validate",
    headers: {
      "x-api-key": created.secret
    },
    payload: invoicePayload
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body, /API_KEY_SCOPE_INSUFFICIENT/);
});

test("valid API key can call a scoped developer endpoint", async (t) => {
  const created = await createKey(["rules:read"]);
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/validation/rules",
    headers: {
      "x-api-key": created.secret
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(Array.isArray(response.json().ruleSets), true);
});

test("API-key request logging records method path and status without bodies or full keys", async (t) => {
  const created = await createKey(["vat:validate_format"]);
  const app = await buildApp();
  const vatId = "DE123456789";

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/vat/validate-format",
    headers: {
      "x-api-key": created.secret,
      "user-agent": "invoice-lantern-test-agent"
    },
    payload: {
      vatId,
      countryHint: "DE"
    }
  });

  assert.equal(response.statusCode, 200);
  await waitForRequestLogging();

  assert.equal(repository.requests.length, 1);
  assert.equal(repository.requests[0]?.requestMethod, "POST");
  assert.equal(repository.requests[0]?.requestPath, "/api/v1/vat/validate-format");
  assert.equal(repository.requests[0]?.statusCode, 200);
  assert.equal(repository.requests[0]?.userAgent, "invoice-lantern-test-agent");

  const loggedPayload = JSON.stringify(repository.requests);

  assert.equal(loggedPayload.includes(created.secret), false);
  assert.equal(loggedPayload.includes(vatId), false);
  assert.doesNotMatch(loggedPayload, /countryHint/);
});

test("development API key behavior still works for existing local routes", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/validation/rules",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(response.statusCode, 200);
});
