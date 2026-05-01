import {
  countRecentApiRequests,
  type ApiKeyMetadata
} from "./api-key-service.js";
import {
  API_KEY_RATE_LIMIT_POLICIES,
  API_RATE_LIMIT_POLICY_LIST,
  ORGANIZATION_RATE_LIMIT_POLICY,
  getSandboxRateLimitMessage,
  type ApiRateLimitPolicy
} from "./api-rate-limit-policy.js";

export type ApiRateLimitScopeStatus = {
  policy: ApiRateLimitPolicy;
  used: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number;
  status: "ok" | "limited";
};

export type ApiRateLimitUsageStatus = {
  apiKeyId: string | null;
  policyKey: string;
  windowSeconds: number;
  maxRequests: number;
  used: number;
  remaining: number;
  resetAt: string;
  status: "ok" | "limited";
};

export type ApiRateLimitCheckResult =
  | {
      ok: true;
      apiKeyStatus: ApiRateLimitScopeStatus;
      organizationStatus: ApiRateLimitScopeStatus;
    }
  | {
      ok: false;
      limitedStatus: ApiRateLimitScopeStatus;
      apiKeyStatus: ApiRateLimitScopeStatus;
      organizationStatus: ApiRateLimitScopeStatus;
      message: string;
    };

function getWindowStartIso(nowMs: number, windowSeconds: number) {
  return new Date(nowMs - windowSeconds * 1000).toISOString();
}

function normalizeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function getResetAt(input: {
  nowMs: number;
  oldestRequestAt: string | null;
  windowSeconds: number;
}) {
  if (!input.oldestRequestAt) {
    return new Date(input.nowMs + input.windowSeconds * 1000).toISOString();
  }

  const oldestTime = new Date(input.oldestRequestAt).getTime();

  if (!Number.isFinite(oldestTime)) {
    return new Date(input.nowMs + input.windowSeconds * 1000).toISOString();
  }

  return new Date(oldestTime + input.windowSeconds * 1000).toISOString();
}

function getRetryAfterSeconds(resetAt: string, nowMs: number) {
  const resetTime = new Date(resetAt).getTime();

  if (!Number.isFinite(resetTime)) {
    return 1;
  }

  return Math.max(1, Math.ceil((resetTime - nowMs) / 1000));
}

async function getPolicyStatus(input: {
  organizationId: string;
  apiKeyId?: string;
  accessToken?: string;
  policy: ApiRateLimitPolicy;
  nowMs: number;
}) {
  const baseWindowInput = {
    organizationId: input.organizationId,
    sinceIso: getWindowStartIso(input.nowMs, input.policy.windowSeconds),
    ...(input.accessToken ? { accessToken: input.accessToken } : {})
  };
  const windowInput = input.apiKeyId
    ? {
        ...baseWindowInput,
        apiKeyId: input.apiKeyId
      }
    : baseWindowInput;
  const window = await countRecentApiRequests(
    input.policy.requestPathPrefix
      ? {
          ...windowInput,
          pathPrefix: input.policy.requestPathPrefix
        }
      : windowInput
  );
  const used = normalizeCount(window.count);
  const resetAt = getResetAt({
    nowMs: input.nowMs,
    oldestRequestAt: window.oldestRequestAt,
    windowSeconds: input.policy.windowSeconds
  });
  const remaining = Math.max(input.policy.maxRequests - used, 0);

  return {
    policy: input.policy,
    used,
    remaining,
    resetAt,
    retryAfterSeconds: getRetryAfterSeconds(resetAt, input.nowMs),
    status: remaining > 0 ? ("ok" as const) : ("limited" as const)
  };
}

export async function checkApiKeyRateLimit(input: {
  apiKey: ApiKeyMetadata;
  policy: ApiRateLimitPolicy;
  nowMs?: number;
}): Promise<ApiRateLimitCheckResult> {
  const nowMs = input.nowMs ?? Date.now();
  const [apiKeyStatus, organizationStatus] = await Promise.all([
    getPolicyStatus({
      organizationId: input.apiKey.organizationId,
      apiKeyId: input.apiKey.id,
      policy: input.policy,
      nowMs
    }),
    getPolicyStatus({
      organizationId: input.apiKey.organizationId,
      policy: ORGANIZATION_RATE_LIMIT_POLICY,
      nowMs
    })
  ]);
  const limitedStatus =
    apiKeyStatus.status === "limited"
      ? apiKeyStatus
      : organizationStatus.status === "limited"
        ? organizationStatus
        : null;

  if (!limitedStatus) {
    return {
      ok: true,
      apiKeyStatus,
      organizationStatus
    };
  }

  return {
    ok: false,
    limitedStatus,
    apiKeyStatus,
    organizationStatus,
    message: getSandboxRateLimitMessage(limitedStatus.policy)
  };
}

export async function getApiRateLimitUsage(input: {
  organizationId: string;
  apiKeyId?: string;
  policyKey?: string;
  accessToken?: string;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const policies =
    input.policyKey !== undefined
      ? API_RATE_LIMIT_POLICY_LIST.filter(
          (policy) => policy.policyKey === input.policyKey
        )
      : input.apiKeyId
        ? [...API_KEY_RATE_LIMIT_POLICIES, ORGANIZATION_RATE_LIMIT_POLICY]
        : [ORGANIZATION_RATE_LIMIT_POLICY];
  const statuses = await Promise.all(
    policies.map(async (policy) => {
      const policyStatusInput = {
        organizationId: input.organizationId,
        policy,
        nowMs,
        ...(input.accessToken ? { accessToken: input.accessToken } : {})
      };
      const policyStatus = await getPolicyStatus(
        policy.appliesTo === "api_key" && input.apiKeyId
          ? {
              ...policyStatusInput,
              apiKeyId: input.apiKeyId
            }
          : policyStatusInput
      );

      return {
        apiKeyId: policy.appliesTo === "api_key" ? input.apiKeyId ?? null : null,
        policyKey: policy.policyKey,
        windowSeconds: policy.windowSeconds,
        maxRequests: policy.maxRequests,
        used: policyStatus.used,
        remaining: policyStatus.remaining,
        resetAt: policyStatus.resetAt,
        status: policyStatus.status
      } satisfies ApiRateLimitUsageStatus;
    })
  );

  return statuses;
}
