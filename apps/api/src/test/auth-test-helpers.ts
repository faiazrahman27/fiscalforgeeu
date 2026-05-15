import type { ApiKeyRepository } from "../repositories/api-key-repository.js";
import {
  createApiKey,
  resetApiKeyRepositoryForTesting,
  setApiKeyRepositoryForTesting,
  type ApiKeyRecord,
  type ApiKeyScope,
  type ApiRequestMetadata,
  type ApiUsageSummary,
  type CountRecentApiRequestsInput,
  type RecentApiRequestWindow,
  type RecordApiRequestInput
} from "../services/api-key-service.js";
import {
  resetSupabaseAuthVerifierForTesting,
  setSupabaseAuthVerifierForTesting
} from "../middleware/require-api-key.js";

export const testOrganizationId = "00000000-0000-4000-8000-000000000201";
export const testUserId = "00000000-0000-4000-8000-000000000202";
export const testBearerToken = "test-supabase-access-token";

type MemoryApiRequest = RecordApiRequestInput & {
  id: string;
  createdAt: string;
};

export type TestApiKeyRepository = ApiKeyRepository & {
  records: ApiKeyRecord[];
  requests: MemoryApiRequest[];
  membershipRole: string;
};

function summarizeRequests(requests: MemoryApiRequest[]): ApiUsageSummary {
  const statusBuckets = {
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0
  };

  for (const request of requests) {
    const statusCode = request.statusCode;

    if (typeof statusCode !== "number") {
      continue;
    }

    if (statusCode >= 200 && statusCode < 300) {
      statusBuckets["2xx"] += 1;
    } else if (statusCode >= 300 && statusCode < 400) {
      statusBuckets["3xx"] += 1;
    } else if (statusCode >= 400 && statusCode < 500) {
      statusBuckets["4xx"] += 1;
    } else if (statusCode >= 500 && statusCode < 600) {
      statusBuckets["5xx"] += 1;
    }
  }

  return {
    totalRequests: requests.length,
    successfulRequests: statusBuckets["2xx"],
    failedRequests: statusBuckets["4xx"] + statusBuckets["5xx"],
    clientErrorCount: statusBuckets["4xx"],
    serverErrorCount: statusBuckets["5xx"],
    averageDurationMs: 0,
    lastRequestAt: requests.at(-1)?.createdAt ?? null,
    topPaths: [],
    statusBuckets
  };
}

export function createTestApiKeyRepository(): TestApiKeyRepository {
  const records: ApiKeyRecord[] = [];
  const requests: MemoryApiRequest[] = [];

  const repository: TestApiKeyRepository = {
    records,
    requests,
    membershipRole: "admin",

    async getWorkspaceForUser() {
      return {
        organizationId: testOrganizationId,
        organizationName: "Invoice Lantern test workspace",
        organizationSlug: "invoice-lantern-test-workspace",
        membershipRole: repository.membershipRole,
        userEmail: "tester@example.test"
      };
    },

    async createApiKeyRecord(input) {
      const now = new Date().toISOString();
      const record: ApiKeyRecord = {
        id: `00000000-0000-4000-8000-${String(records.length + 210).padStart(
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
      requests.push({
        ...input,
        id: `10000000-0000-4000-8000-${String(requests.length + 210).padStart(
          12,
          "0"
        )}`,
        createdAt: new Date(Date.now() + requests.length * 1000).toISOString()
      });
    },

    async countRecentApiRequests(input): Promise<RecentApiRequestWindow> {
      const sinceTime = new Date(input.sinceIso).getTime();
      const matchingRequests = requests
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
        count: matchingRequests.length,
        oldestRequestAt: matchingRequests[0]?.createdAt ?? null
      };
    },

    async listApiRequests(input) {
      return requests
        .filter((request) => request.organizationId === input.organizationId)
        .filter((request) =>
          input.apiKeyId ? request.apiKeyId === input.apiKeyId : true
        )
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
      return summarizeRequests(
        requests.filter(
          (request) =>
            request.organizationId === input.organizationId &&
            (!input.apiKeyId || request.apiKeyId === input.apiKeyId)
        )
      );
    }
  };

  return repository;
}

export function installSignedUserAndApiKeyTestAuth() {
  const repository = createTestApiKeyRepository();

  setApiKeyRepositoryForTesting(repository);
  setSupabaseAuthVerifierForTesting((token) =>
    token === testBearerToken
      ? {
          id: testUserId,
          email: "tester@example.test",
          role: "authenticated"
        }
      : null
  );

  return repository;
}

export function resetSignedUserAndApiKeyTestAuth() {
  resetSupabaseAuthVerifierForTesting();
  resetApiKeyRepositoryForTesting();
}

export async function createTestOrganizationApiKey(scopes: ApiKeyScope[]) {
  return createApiKey({
    organizationId: testOrganizationId,
    name: "Route test key",
    environment: "test",
    scopes,
    createdBy: testUserId
  });
}
