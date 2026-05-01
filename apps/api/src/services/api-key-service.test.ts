import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import type { ApiKeyRepository } from "../repositories/api-key-repository.js";
import { apiRequestRoutes } from "../routes/v1/api-requests.js";
import { apiUsageRoutes } from "../routes/v1/api-usage.js";
import { requireApiKeyRateLimitPolicy } from "../middleware/require-api-rate-limit.js";
import {
  createApiKey,
  getApiUsageSummary,
  listApiRequests,
  listApiKeys,
  resetApiKeyRepositoryForTesting,
  revokeApiKey,
  setApiKeyRepositoryForTesting,
  type ApiKeyRecord,
  type ApiKeyScope,
  type ApiRequestMetadata,
  type ApiUsageSummary,
  type CountRecentApiRequestsInput,
  type RecentApiRequestWindow,
  type RecordApiRequestInput
} from "./api-key-service.js";
import {
  API_RATE_LIMIT_POLICIES,
  RATE_LIMIT_EXCEEDED_ERROR_CODE
} from "./api-rate-limit-policy.js";

type MemoryApiRequest = RecordApiRequestInput & {
  id: string;
  createdAt: string;
};

type MemoryRepository = ApiKeyRepository & {
  records: ApiKeyRecord[];
  requests: MemoryApiRequest[];
  failRecordApiRequest: boolean;
  membershipRole: string;
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
  const requests: MemoryApiRequest[] = [];

  const memoryRepository: MemoryRepository = {
    records,
    requests,
    failRecordApiRequest: false,
    membershipRole: "admin",

    async getWorkspaceForUser() {
      return {
        organizationId,
        organizationName: "Test workspace",
        organizationSlug: "test-workspace",
        membershipRole: memoryRepository.membershipRole,
        userEmail: "admin@example.test"
      };
    },

    async createApiKeyRecord(input) {
      const now = new Date().toISOString();
      const record: ApiKeyRecord = {
        id: `00000000-0000-4000-8000-${String(records.length + 10).padStart(
          12,
          "0"
        )}`,
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
      if (memoryRepository.failRecordApiRequest) {
        throw new Error("Request logging failed for test.");
      }

      requests.push({
        ...input,
        id: `10000000-0000-4000-8000-${String(requests.length + 10).padStart(
          12,
          "0"
        )}`,
        createdAt: new Date(Date.now() + requests.length * 1000).toISOString()
      });
    },

    async countRecentApiRequests(input) {
      return countMemoryRecentApiRequests(records, requests, input);
    },

    async listApiRequests(input) {
      return requests
        .filter((request) => request.organizationId === input.organizationId)
        .filter((request) =>
          input.apiKeyId ? request.apiKeyId === input.apiKeyId : true
        )
        .filter((request) =>
          typeof input.statusCode === "number"
            ? request.statusCode === input.statusCode
            : true
        )
        .filter((request) =>
          input.pathPrefix
            ? request.requestPath.startsWith(input.pathPrefix)
            : true
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, input.limit ?? 50)
        .map((request): ApiRequestMetadata => {
          const apiKey =
            records.find((record) => record.id === request.apiKeyId) ?? null;

          return {
            id: request.id,
            organizationId: request.organizationId,
            apiKeyId: request.apiKeyId,
            apiKeyName: apiKey?.name ?? null,
            apiKeyPrefix: apiKey?.keyPrefix ?? null,
            requestMethod: request.requestMethod,
            requestPath: request.requestPath,
            statusCode: request.statusCode,
            durationMs: request.durationMs,
            ipAddress: request.ipAddress,
            userAgent: request.userAgent,
            errorCode: request.errorCode ?? null,
            createdAt: request.createdAt
          };
        });
    },

    async getApiUsageSummary(input) {
      const sinceTime =
        Date.now() - (input.sinceDays ?? 30) * 24 * 60 * 60 * 1000;
      const relevantRequests = requests.filter((request) => {
        const createdTime = new Date(request.createdAt).getTime();

        return (
          request.organizationId === input.organizationId &&
          (!input.apiKeyId || request.apiKeyId === input.apiKeyId) &&
          Number.isFinite(createdTime) &&
          createdTime >= sinceTime
        );
      });

      return summarizeMemoryRequests(relevantRequests);
    }
  };

  return memoryRepository;
}

function countMemoryRecentApiRequests(
  _records: ApiKeyRecord[],
  requests: MemoryApiRequest[],
  input: CountRecentApiRequestsInput
): RecentApiRequestWindow {
  const sinceTime = new Date(input.sinceIso).getTime();
  const relevantRequests = requests
    .filter((request) => request.organizationId === input.organizationId)
    .filter((request) =>
      input.apiKeyId ? request.apiKeyId === input.apiKeyId : true
    )
    .filter((request) =>
      input.pathPrefix ? request.requestPath.startsWith(input.pathPrefix) : true
    )
    .filter((request) => {
      const createdTime = new Date(request.createdAt).getTime();

      return Number.isFinite(createdTime) && createdTime >= sinceTime;
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return {
    count: relevantRequests.length,
    oldestRequestAt: relevantRequests[0]?.createdAt ?? null
  };
}

function summarizeMemoryRequests(requests: MemoryApiRequest[]): ApiUsageSummary {
  const pathCounts = new Map<string, number>();
  let durationTotal = 0;
  let durationCount = 0;
  let lastRequestAt: string | null = null;
  let lastRequestTime = 0;
  const summary: ApiUsageSummary = {
    totalRequests: requests.length,
    successfulRequests: 0,
    failedRequests: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    averageDurationMs: 0,
    lastRequestAt: null,
    topPaths: [],
    statusBuckets: {
      "2xx": 0,
      "3xx": 0,
      "4xx": 0,
      "5xx": 0
    }
  };

  for (const request of requests) {
    pathCounts.set(
      request.requestPath,
      (pathCounts.get(request.requestPath) ?? 0) + 1
    );

    const createdTime = new Date(request.createdAt).getTime();

    if (Number.isFinite(createdTime) && createdTime > lastRequestTime) {
      lastRequestTime = createdTime;
      lastRequestAt = request.createdAt;
    }

    if (typeof request.durationMs === "number") {
      durationTotal += request.durationMs;
      durationCount += 1;
    }

    const statusCode = request.statusCode;

    if (typeof statusCode !== "number") {
      continue;
    }

    if (statusCode >= 200 && statusCode < 300) {
      summary.statusBuckets["2xx"] += 1;
      summary.successfulRequests += 1;
    } else if (statusCode >= 300 && statusCode < 400) {
      summary.statusBuckets["3xx"] += 1;
    } else if (statusCode >= 400 && statusCode < 500) {
      summary.statusBuckets["4xx"] += 1;
      summary.clientErrorCount += 1;
      summary.failedRequests += 1;
    } else if (statusCode >= 500 && statusCode < 600) {
      summary.statusBuckets["5xx"] += 1;
      summary.serverErrorCount += 1;
      summary.failedRequests += 1;
    }
  }

  summary.averageDurationMs =
    durationCount > 0 ? Math.round(durationTotal / durationCount) : 0;
  summary.lastRequestAt = lastRequestAt;
  summary.topPaths = [...pathCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([path, count]) => ({
      path,
      count
    }));

  return summary;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type CapturedRouteHandler = (
  request: Record<string, unknown>,
  reply: ReturnType<typeof createRouteReply>
) => Promise<unknown> | unknown;

async function getApiRequestRouteHandler(path: "/" | "/summary") {
  const handlers = new Map<string, CapturedRouteHandler>();
  const appStub = {
    get(
      routePath: string,
      _options: unknown,
      handler: CapturedRouteHandler
    ) {
      handlers.set(routePath, handler);
      return appStub;
    }
  };

  await apiRequestRoutes(appStub as never);

  const handler = handlers.get(path);

  assert.ok(handler);

  return handler;
}

async function getApiUsageRouteHandler(path: "/policies" | "/current") {
  const handlers = new Map<string, CapturedRouteHandler>();
  const appStub = {
    get(
      routePath: string,
      _options: unknown,
      handler: CapturedRouteHandler
    ) {
      handlers.set(routePath, handler);
      return appStub;
    }
  };

  await apiUsageRoutes(appStub as never);

  const handler = handlers.get(path);

  assert.ok(handler);

  return handler;
}

function createRouteReply() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return payload;
    }
  };
}

async function callApiRequestRoute(
  path: "/" | "/summary",
  query: Record<string, unknown>
) {
  const handler = await getApiRequestRouteHandler(path);
  const reply = createRouteReply();
  const result = await handler(
    {
      query,
      authenticatedUser: {
        id: userId,
        email: "admin@example.test",
        role: "authenticated"
      },
      authenticatedAccessToken: "test-access-token"
    },
    reply
  );

  return {
    statusCode: reply.statusCode,
    body: reply.payload ?? result
  };
}

async function callApiUsageRoute(
  path: "/policies" | "/current",
  query: Record<string, unknown> = {}
) {
  const handler = await getApiUsageRouteHandler(path);
  const reply = createRouteReply();
  const result = await handler(
    {
      query,
      authenticatedUser: {
        id: userId,
        email: "admin@example.test",
        role: "authenticated"
      },
      authenticatedAccessToken: "test-access-token"
    },
    reply
  );

  return {
    statusCode: reply.statusCode,
    body: reply.payload ?? result
  };
}

async function callRateLimitPreHandler(input: {
  authenticationMode: "organization_api_key" | "supabase_user" | "dev_api_key";
  apiKey?: ApiKeyRecord;
}) {
  const handler = requireApiKeyRateLimitPolicy("invoices_validate");
  const headers = new Map<string, string>();
  const reply = {
    statusCode: 200,
    payload: undefined as unknown,
    header(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return payload;
    }
  };
  const request = {
    authenticationMode: input.authenticationMode,
    authenticatedApiKey: input.apiKey
  };
  const result = await handler(request as never, reply as never);

  return {
    result,
    statusCode: reply.statusCode,
    body: reply.payload,
    headers
  };
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

test("API rate-limit policy map exports expected sandbox policies", () => {
  assert.equal(API_RATE_LIMIT_POLICIES.validation_rules_catalog.maxRequests, 120);
  assert.equal(API_RATE_LIMIT_POLICIES.validation_rules_catalog.windowSeconds, 900);
  assert.equal(API_RATE_LIMIT_POLICIES.validation_rules_catalog.scope, "rules:read");
  assert.equal(API_RATE_LIMIT_POLICIES.vat_validate_format.maxRequests, 60);
  assert.equal(API_RATE_LIMIT_POLICIES.invoices_validate.maxRequests, 30);
  assert.equal(API_RATE_LIMIT_POLICIES.invoices_export_ubl.maxRequests, 30);
  assert.equal(API_RATE_LIMIT_POLICIES.invoices_parse_ubl.maxRequests, 30);
  assert.equal(
    API_RATE_LIMIT_POLICIES.organization_developer_api_total.maxRequests,
    300
  );
});

test("API-key request under the endpoint limit succeeds with rate headers", async (t) => {
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
  assert.equal(response.headers["x-ratelimit-limit"], "120");
  assert.equal(response.headers["x-ratelimit-remaining"], "119");
  assert.equal(typeof response.headers["x-ratelimit-reset"], "string");
});

test("API-key request over the endpoint limit returns graceful 429 and logs it", async (t) => {
  const created = await createKey(["invoices:validate"]);
  const app = await buildApp();

  for (let index = 0; index < API_RATE_LIMIT_POLICIES.invoices_validate.maxRequests; index += 1) {
    await repository.recordApiRequest({
      organizationId,
      apiKeyId: created.apiKey.id,
      requestMethod: "POST",
      requestPath: "/api/v1/invoices/validate",
      statusCode: 200,
      durationMs: 12,
      ipAddress: "127.0.0.1",
      userAgent: "rate-limit-test",
      errorCode: null
    });
  }

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/validate",
    headers: {
      "x-api-key": created.secret,
      "user-agent": "invoice-lantern-rate-limit-test"
    },
    payload: invoicePayload
  });

  assert.equal(response.statusCode, 429);

  const body = response.json() as Record<string, unknown>;

  assert.equal(isPlainObject(body.error), true);

  const error = body.error as Record<string, unknown>;

  assert.equal(error.code, RATE_LIMIT_EXCEEDED_ERROR_CODE);
  assert.equal(error.limit, 30);
  assert.equal(error.windowSeconds, 900);
  assert.equal(typeof error.retryAfterSeconds, "number");
  assert.match(String(error.message), /sandbox rate limit/i);
  assert.equal(response.headers["x-ratelimit-limit"], "30");
  assert.equal(response.headers["x-ratelimit-remaining"], "0");
  assert.equal(typeof response.headers["x-ratelimit-reset"], "string");
  assert.equal(typeof response.headers["retry-after"], "string");

  await waitForRequestLogging();

  const limitedLog = repository.requests.find(
    (request) =>
      request.statusCode === 429 &&
      request.errorCode === RATE_LIMIT_EXCEEDED_ERROR_CODE
  );

  assert.ok(limitedLog);
  assert.equal(limitedLog.requestMethod, "POST");
  assert.equal(limitedLog.requestPath, "/api/v1/invoices/validate");
  assert.equal(limitedLog.apiKeyId, created.apiKey.id);
  assert.equal(limitedLog.organizationId, organizationId);

  const serializedRequests = JSON.stringify(repository.requests);

  assert.equal(serializedRequests.includes(created.secret), false);
  assert.equal(serializedRequests.includes("keyHash"), false);
  assert.equal(serializedRequests.includes("<Invoice"), false);
  assert.equal(serializedRequests.includes("DE987654321"), false);
});

test("API-key limiter skips signed-in Supabase and development-key request modes", async () => {
  const created = await createKey(["invoices:validate"]);

  for (let index = 0; index < API_RATE_LIMIT_POLICIES.invoices_validate.maxRequests; index += 1) {
    await repository.recordApiRequest({
      organizationId,
      apiKeyId: created.apiKey.id,
      requestMethod: "POST",
      requestPath: "/api/v1/invoices/validate",
      statusCode: 200,
      durationMs: 12,
      ipAddress: "127.0.0.1",
      userAgent: "rate-limit-test",
      errorCode: null
    });
  }

  const supabaseResult = await callRateLimitPreHandler({
    authenticationMode: "supabase_user"
  });
  const devKeyResult = await callRateLimitPreHandler({
    authenticationMode: "dev_api_key"
  });

  assert.equal(supabaseResult.statusCode, 200);
  assert.equal(devKeyResult.statusCode, 200);
  assert.equal(supabaseResult.body, undefined);
  assert.equal(devKeyResult.body, undefined);
});

test("invoice validation and UBL export use their documented scopes", async (t) => {
  const validationKey = await createKey(["invoices:validate"]);
  const exportKey = await createKey(["invoices:export_ubl"]);
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const validationResponse = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/validate",
    headers: {
      "x-api-key": validationKey.secret
    },
    payload: invoicePayload
  });

  assert.equal(validationResponse.statusCode, 200);

  const exportResponse = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/export/ubl",
    headers: {
      "x-api-key": exportKey.secret
    },
    payload: invoicePayload
  });

  assert.equal(exportResponse.statusCode, 200);
  assert.equal(typeof exportResponse.json().xml, "string");
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

test("API-key request logging remains best-effort when storage fails", async (t) => {
  const created = await createKey(["rules:read"]);
  const app = await buildApp();

  repository.failRecordApiRequest = true;

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
  await waitForRequestLogging();
  assert.equal(repository.requests.length, 0);
});

test("API request list function returns safe metadata and supports filters", async () => {
  const firstKey = await createKey(["rules:read"]);
  const secondKey = await createKey(["vat:validate_format"]);

  await repository.recordApiRequest({
    organizationId,
    apiKeyId: firstKey.apiKey.id,
    requestMethod: "GET",
    requestPath: "/api/v1/validation/rules",
    statusCode: 200,
    durationMs: 20,
    ipAddress: "127.0.0.1",
    userAgent: "rules-agent",
    errorCode: null
  });
  await repository.recordApiRequest({
    organizationId,
    apiKeyId: secondKey.apiKey.id,
    requestMethod: "POST",
    requestPath: "/api/v1/vat/validate-format",
    statusCode: 404,
    durationMs: 40,
    ipAddress: "127.0.0.2",
    userAgent: "vat-agent",
    errorCode: "VAT_NOT_FOUND"
  });
  await repository.recordApiRequest({
    organizationId: "00000000-0000-4000-8000-000000009999",
    apiKeyId: secondKey.apiKey.id,
    requestMethod: "POST",
    requestPath: "/api/v1/vat/validate-format",
    statusCode: 500,
    durationMs: 90,
    ipAddress: "127.0.0.3",
    userAgent: "other-agent",
    errorCode: null
  });

  const apiRequests = await listApiRequests({
    organizationId,
    apiKeyId: secondKey.apiKey.id,
    limit: 5,
    statusCode: 404,
    pathPrefix: "/api/v1/vat"
  });

  assert.equal(apiRequests.length, 1);
  assert.equal(apiRequests[0]?.apiKeyName, "Local test key");
  assert.equal(apiRequests[0]?.apiKeyPrefix, secondKey.apiKey.keyPrefix);
  assert.equal(apiRequests[0]?.requestPath, "/api/v1/vat/validate-format");
  assert.equal(apiRequests[0]?.statusCode, 404);

  const serialized = JSON.stringify(apiRequests);

  assert.equal(serialized.includes(firstKey.secret), false);
  assert.equal(serialized.includes(secondKey.secret), false);
  assert.equal(serialized.includes("keyHash"), false);
  assert.equal(serialized.includes("DE123456789"), false);
  assert.equal(serialized.includes("<Invoice"), false);
});

test("API usage summary returns counts buckets averages and top paths", async () => {
  const created = await createKey(["rules:read"]);

  for (const request of [
    {
      requestPath: "/api/v1/validation/rules",
      statusCode: 200,
      durationMs: 20
    },
    {
      requestPath: "/api/v1/validation/rules",
      statusCode: 204,
      durationMs: 40
    },
    {
      requestPath: "/api/v1/vat/validate-format",
      statusCode: 404,
      durationMs: 60
    },
    {
      requestPath: "/api/v1/invoices/validate",
      statusCode: 500,
      durationMs: 80
    }
  ]) {
    await repository.recordApiRequest({
      organizationId,
      apiKeyId: created.apiKey.id,
      requestMethod: "GET",
      requestPath: request.requestPath,
      statusCode: request.statusCode,
      durationMs: request.durationMs,
      ipAddress: "127.0.0.1",
      userAgent: "summary-agent",
      errorCode: null
    });
  }

  const summary = await getApiUsageSummary({
    organizationId,
    apiKeyId: created.apiKey.id,
    sinceDays: 30
  });

  assert.equal(summary.totalRequests, 4);
  assert.equal(summary.successfulRequests, 2);
  assert.equal(summary.failedRequests, 2);
  assert.equal(summary.clientErrorCount, 1);
  assert.equal(summary.serverErrorCount, 1);
  assert.equal(summary.averageDurationMs, 50);
  assert.equal(summary.statusBuckets["2xx"], 2);
  assert.equal(summary.statusBuckets["4xx"], 1);
  assert.equal(summary.statusBuckets["5xx"], 1);
  assert.equal(summary.topPaths[0]?.path, "/api/v1/validation/rules");
  assert.equal(summary.topPaths[0]?.count, 2);
  assert.equal(typeof summary.lastRequestAt, "string");
});

test("API request routes return safe metadata and summary responses", async () => {
  const created = await createKey(["vat:validate_format"]);
  const vatId = "HU12345678";
  const xmlPayload = "<Invoice><cbc:ID>SECRET</cbc:ID></Invoice>";

  await repository.recordApiRequest({
    organizationId,
    apiKeyId: created.apiKey.id,
    requestMethod: "POST",
    requestPath: "/api/v1/vat/validate-format",
    statusCode: 200,
    durationMs: 33,
    ipAddress: "127.0.0.1",
    userAgent: "route-agent",
    errorCode: null
  });
  await repository.recordApiRequest({
    organizationId,
    apiKeyId: created.apiKey.id,
    requestMethod: "POST",
    requestPath: "/api/v1/vat/validate-format",
    statusCode: 422,
    durationMs: 66,
    ipAddress: "127.0.0.1",
    userAgent: "route-agent",
    errorCode: "VALIDATION_ERROR"
  });

  const listResponse = await callApiRequestRoute("/", {
    apiKeyId: created.apiKey.id,
    limit: "1",
    statusCode: "422",
    pathPrefix: "/api/v1/vat"
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(isPlainObject(listResponse.body), true);

  const apiRequests = (listResponse.body as Record<string, unknown>).apiRequests;

  assert.equal(Array.isArray(apiRequests), true);
  assert.equal((apiRequests as unknown[]).length, 1);

  const serializedList = JSON.stringify(listResponse.body);

  assert.equal(serializedList.includes(created.secret), false);
  assert.equal(serializedList.includes("keyHash"), false);
  assert.equal(serializedList.includes(vatId), false);
  assert.equal(serializedList.includes(xmlPayload), false);

  const summaryResponse = await callApiRequestRoute("/summary", {
    apiKeyId: created.apiKey.id,
    sinceDays: "30"
  });

  assert.equal(summaryResponse.statusCode, 200);
  assert.equal(isPlainObject(summaryResponse.body), true);

  const summary = (summaryResponse.body as Record<string, unknown>).summary;

  assert.equal(isPlainObject(summary), true);
  assert.equal((summary as Record<string, unknown>).totalRequests, 2);
  assert.equal(
    ((summary as Record<string, unknown>).statusBuckets as Record<string, unknown>)[
      "2xx"
    ],
    1
  );
  assert.equal(
    ((summary as Record<string, unknown>).statusBuckets as Record<string, unknown>)[
      "4xx"
    ],
    1
  );
});

test("API usage policy route returns safe rate-limit policy data", async () => {
  const response = await callApiUsageRoute("/policies");

  assert.equal(response.statusCode, 200);
  assert.equal(isPlainObject(response.body), true);

  const body = response.body as Record<string, unknown>;

  assert.equal(Array.isArray(body.policies), true);
  assert.match(String(body.disclaimer), /not a service-level agreement/i);

  const policies = body.policies as Record<string, unknown>[];
  const invoicePolicy = policies.find(
    (policy) => policy.policyKey === "invoices_validate"
  );

  assert.ok(invoicePolicy);
  assert.equal(invoicePolicy.scope, "invoices:validate");
  assert.equal(invoicePolicy.maxRequests, 30);
  assert.equal(invoicePolicy.windowSeconds, 900);

  const serialized = JSON.stringify(body);

  assert.equal(serialized.includes("keyHash"), false);
  assert.equal(serialized.includes("il_test_"), false);
  assert.equal(serialized.includes("<Invoice"), false);
});

test("API usage current route returns safe usage counts", async () => {
  const created = await createKey(["invoices:validate"]);

  await repository.recordApiRequest({
    organizationId,
    apiKeyId: created.apiKey.id,
    requestMethod: "POST",
    requestPath: "/api/v1/invoices/validate",
    statusCode: 200,
    durationMs: 20,
    ipAddress: "127.0.0.1",
    userAgent: "usage-current-test",
    errorCode: null
  });

  const apiKeyResponse = await callApiUsageRoute("/current", {
    apiKeyId: created.apiKey.id
  });
  const organizationResponse = await callApiUsageRoute("/current");

  assert.equal(apiKeyResponse.statusCode, 200);
  assert.equal(organizationResponse.statusCode, 200);

  const apiKeyBody = apiKeyResponse.body as Record<string, unknown>;
  const usage = apiKeyBody.usage as Record<string, unknown>[];
  const invoiceUsage = usage.find(
    (item) => item.policyKey === "invoices_validate"
  );
  const orgUsage = usage.find(
    (item) => item.policyKey === "organization_developer_api_total"
  );

  assert.ok(invoiceUsage);
  assert.equal(invoiceUsage.apiKeyId, created.apiKey.id);
  assert.equal(invoiceUsage.used, 1);
  assert.equal(invoiceUsage.remaining, 29);
  assert.equal(invoiceUsage.status, "ok");
  assert.ok(orgUsage);
  assert.equal(orgUsage.apiKeyId, null);
  assert.equal(orgUsage.used, 1);
  assert.equal(orgUsage.remaining, 299);

  const organizationBody = organizationResponse.body as Record<string, unknown>;
  const organizationUsage = organizationBody.usage as Record<string, unknown>[];

  assert.equal(organizationUsage.length, 1);
  assert.equal(
    organizationUsage[0]?.policyKey,
    "organization_developer_api_total"
  );

  const serialized = JSON.stringify(apiKeyBody);

  assert.equal(serialized.includes(created.secret), false);
  assert.equal(serialized.includes("keyHash"), false);
  assert.equal(serialized.includes("DE987654321"), false);
  assert.equal(serialized.includes("<Invoice"), false);
});

test("API request routes follow existing owner or admin visibility rules", async () => {
  repository.membershipRole = "member";

  const response = await callApiRequestRoute("/", {});

  assert.equal(response.statusCode, 403);
  assert.match(JSON.stringify(response.body), /API_REQUEST_LOG_ROLE_REQUIRED/);
});

test("API request routes reject unsigned access", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/api-requests",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });
  const summaryResponse = await app.inject({
    method: "GET",
    url: "/api/v1/api-requests/summary",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(listResponse.statusCode, 401);
  assert.match(listResponse.body, /AUTH_TOKEN_REQUIRED/);
  assert.equal(summaryResponse.statusCode, 401);
  assert.match(summaryResponse.body, /AUTH_TOKEN_REQUIRED/);
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
