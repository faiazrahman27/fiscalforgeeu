import {
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { env } from "../config/env.js";
import {
  supabaseApiKeyRepository,
  type ApiKeyRepository
} from "../repositories/api-key-repository.js";

export const API_KEY_SCOPES = [
  "invoices:validate",
  "invoices:export_ubl",
  "invoices:parse_ubl",
  "invoices:import_ubl",
  "xml:validation_jobs",
  "vat:validate_format",
  "validation_runs:read",
  "rules:read"
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
export type ApiKeyEnvironment = "test" | "live";
export type ApiKeyStatus = "active" | "revoked" | "expired";

export type ApiKeyMetadata = {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: ApiKeyScope[];
  status: ApiKeyStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdBy: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiKeyRecord = ApiKeyMetadata & {
  keyHash?: string;
};

export type ApiKeyWorkspace = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

export type CreateApiKeyInput = {
  organizationId: string;
  name: string;
  environment: ApiKeyEnvironment;
  scopes: ApiKeyScope[];
  expiresAt?: string | null;
  createdBy?: string | null;
  accessToken?: string;
};

export type RecordApiRequestInput = {
  organizationId: string | null;
  apiKeyId: string | null;
  requestMethod: string;
  requestPath: string;
  statusCode: number | null;
  durationMs: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  errorCode?: string | null;
};

export type CountRecentApiRequestsInput = {
  organizationId: string;
  apiKeyId?: string;
  sinceIso: string;
  pathPrefix?: string;
  accessToken?: string;
};

export type RecentApiRequestWindow = {
  count: number;
  oldestRequestAt: string | null;
};

export type ApiRequestMetadata = {
  id: string;
  organizationId: string | null;
  apiKeyId: string | null;
  apiKeyName: string | null;
  apiKeyPrefix: string | null;
  requestMethod: string;
  requestPath: string;
  statusCode: number | null;
  durationMs: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  errorCode: string | null;
  createdAt: string;
};

export type ListApiRequestsInput = {
  organizationId: string;
  apiKeyId?: string;
  limit?: number;
  statusCode?: number;
  pathPrefix?: string;
  accessToken?: string;
};

export type ApiUsageSummary = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  clientErrorCount: number;
  serverErrorCount: number;
  averageDurationMs: number;
  lastRequestAt: string | null;
  topPaths: {
    path: string;
    count: number;
  }[];
  statusBuckets: {
    "2xx": number;
    "3xx": number;
    "4xx": number;
    "5xx": number;
  };
};

export type GetApiUsageSummaryInput = {
  organizationId: string;
  apiKeyId?: string;
  sinceDays?: number;
  accessToken?: string;
};

export type VerifyApiKeyResult =
  | {
      ok: true;
      apiKey: ApiKeyMetadata;
    }
  | {
      ok: false;
      statusCode: 401 | 403;
      code: string;
      message: string;
    };

export class ApiKeyServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "ApiKeyServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function toWorkspaceContextError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("unreadable record")) {
    return new ApiKeyServiceError(
      "WORKSPACE_CONTEXT_REQUIRED",
      "Create or select an organization before using this workspace feature.",
      409
    );
  }

  return new ApiKeyServiceError(
    "WORKSPACE_CONTEXT_UNAVAILABLE",
    "Workspace context could not be loaded. Confirm the required database migrations are applied.",
    503
  );
}

let activeRepository: ApiKeyRepository = supabaseApiKeyRepository;

function getRepository() {
  return activeRepository;
}

export function setApiKeyRepositoryForTesting(repository: ApiKeyRepository) {
  activeRepository = repository;
}

export function resetApiKeyRepositoryForTesting() {
  activeRepository = supabaseApiKeyRepository;
}

export function isApiKeyScope(value: string): value is ApiKeyScope {
  return API_KEY_SCOPES.includes(value as ApiKeyScope);
}

export function normalizeApiKeyScopes(scopes: readonly string[]) {
  const normalizedScopes: ApiKeyScope[] = [];

  for (const scope of scopes) {
    const normalizedScope = scope.trim();

    if (!isApiKeyScope(normalizedScope)) {
      throw new ApiKeyServiceError(
        "API_KEY_SCOPE_INVALID",
        `Unsupported API key scope: ${normalizedScope}`,
        400
      );
    }

    if (!normalizedScopes.includes(normalizedScope)) {
      normalizedScopes.push(normalizedScope);
    }
  }

  return normalizedScopes;
}

export function looksLikeInvoiceLanternApiKey(value: string) {
  return /^il_(test|live)_[A-Za-z0-9_-]{6,40}\.[A-Za-z0-9_-]{24,}$/.test(
    value.trim()
  );
}

export function getApiKeyPrefix(rawKey: string) {
  const trimmedKey = rawKey.trim();
  const separatorIndex = trimmedKey.indexOf(".");

  if (separatorIndex <= 0) {
    return "";
  }

  const prefix = trimmedKey.slice(0, separatorIndex);

  return /^il_(test|live)_[A-Za-z0-9_-]{6,40}$/.test(prefix) ? prefix : "";
}

function getApiKeyHashSecret() {
  const configuredSecret = env.API_KEY_HASH_SECRET.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (env.APP_ENV !== "production") {
    return `invoice-lantern-development-api-key-hash-secret:${env.DEV_API_KEY}`;
  }

  throw new ApiKeyServiceError(
    "API_KEY_HASH_SECRET_MISSING",
    "API key hashing is not configured.",
    500
  );
}

export function hashApiKey(rawKey: string) {
  return createHmac("sha256", getApiKeyHashSecret())
    .update(rawKey.trim(), "utf8")
    .digest("hex");
}

function hashMatches(leftHash: string, rightHash: string) {
  if (!/^[a-f0-9]{64}$/.test(leftHash) || !/^[a-f0-9]{64}$/.test(rightHash)) {
    return false;
  }

  const leftBuffer = Buffer.from(leftHash, "hex");
  const rightBuffer = Buffer.from(rightHash, "hex");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function generateToken(bytes: number) {
  return randomBytes(bytes).toString("base64url");
}

function buildKeyPrefix(environment: ApiKeyEnvironment) {
  return `il_${environment}_${generateToken(8)}`;
}

function buildSecret(prefix: string) {
  return `${prefix}.${generateToken(32)}`;
}

function isExpired(apiKey: Pick<ApiKeyMetadata, "expiresAt">) {
  if (!apiKey.expiresAt) {
    return false;
  }

  const expiryTime = new Date(apiKey.expiresAt).getTime();

  return Number.isFinite(expiryTime) && expiryTime <= Date.now();
}

function toEffectiveMetadata(record: ApiKeyRecord): ApiKeyMetadata {
  const { keyHash: _keyHash, ...metadata } = record;

  if (metadata.status === "active" && isExpired(metadata)) {
    return {
      ...metadata,
      status: "expired"
    };
  }

  return metadata;
}

export async function getApiKeyWorkspaceForUser(input: {
  userId: string;
  accessToken: string;
}) {
  try {
    return await getRepository().getWorkspaceForUser(input);
  } catch (error) {
    if (error instanceof ApiKeyServiceError) {
      throw error;
    }

    throw toWorkspaceContextError(error);
  }
}

export async function createApiKey(input: CreateApiKeyInput) {
  const normalizedName = input.name.trim();

  if (normalizedName.length < 1 || normalizedName.length > 120) {
    throw new ApiKeyServiceError(
      "API_KEY_NAME_INVALID",
      "API key name must be between 1 and 120 characters.",
      400
    );
  }

  const scopes = normalizeApiKeyScopes(input.scopes);
  const keyPrefix = buildKeyPrefix(input.environment);
  const secret = buildSecret(keyPrefix);
  const keyHash = hashApiKey(secret);

  const record = await getRepository().createApiKeyRecord({
    organizationId: input.organizationId,
    name: normalizedName,
    keyPrefix,
    keyHash,
    environment: input.environment,
    scopes,
    expiresAt: input.expiresAt ?? null,
    createdBy: input.createdBy ?? null,
    ...(input.accessToken ? { accessToken: input.accessToken } : {})
  });

  return {
    apiKey: toEffectiveMetadata(record),
    secret,
    warning:
      "Copy this API key now. Invoice Lantern stores only a hash and cannot show it again."
  };
}

export async function listApiKeys(input: {
  organizationId: string;
  accessToken?: string;
}) {
  const records = await getRepository().listApiKeys(input);

  return records.map(toEffectiveMetadata);
}

export async function revokeApiKey(input: {
  organizationId: string;
  apiKeyId: string;
  revokedBy?: string | null;
  accessToken?: string;
}) {
  const record = await getRepository().revokeApiKey({
    organizationId: input.organizationId,
    apiKeyId: input.apiKeyId,
    revokedBy: input.revokedBy ?? null,
    ...(input.accessToken ? { accessToken: input.accessToken } : {})
  });

  if (!record) {
    throw new ApiKeyServiceError(
      "API_KEY_NOT_FOUND",
      "API key was not found in this organization.",
      404
    );
  }

  return toEffectiveMetadata(record);
}

export async function verifyApiKey(
  rawKey: string,
  requiredScopes: readonly ApiKeyScope[] = [],
  metadata?: {
    ipAddress?: string | null;
  }
): Promise<VerifyApiKeyResult> {
  const trimmedKey = rawKey.trim();
  const keyPrefix = getApiKeyPrefix(trimmedKey);

  if (!keyPrefix || !looksLikeInvoiceLanternApiKey(trimmedKey)) {
    return {
      ok: false,
      statusCode: 401,
      code: "API_KEY_INVALID",
      message: "Invalid API key."
    };
  }

  const candidates = await getRepository().findApiKeysByPrefix({ keyPrefix });
  const record =
    candidates.find((candidate) =>
      typeof candidate.keyHash === "string" &&
      hashMatches(hashApiKey(trimmedKey), candidate.keyHash)
    ) ?? null;

  if (!record) {
    return {
      ok: false,
      statusCode: 401,
      code: "API_KEY_INVALID",
      message: "Invalid API key."
    };
  }

  if (record.status === "revoked") {
    return {
      ok: false,
      statusCode: 401,
      code: "API_KEY_REVOKED",
      message: "API key has been revoked."
    };
  }

  if (record.status === "expired" || isExpired(record)) {
    void getRepository()
      .markApiKeyExpired({
        organizationId: record.organizationId,
        apiKeyId: record.id
      })
      .catch(() => undefined);

    return {
      ok: false,
      statusCode: 401,
      code: "API_KEY_EXPIRED",
      message: "API key has expired."
    };
  }

  const missingScope = requiredScopes.find(
    (scope) => !record.scopes.includes(scope)
  );

  if (missingScope) {
    return {
      ok: false,
      statusCode: 403,
      code: "API_KEY_SCOPE_INSUFFICIENT",
      message: "API key does not include the required scope."
    };
  }

  void getRepository()
    .updateLastUsed({
      apiKeyId: record.id,
      ipAddress: metadata?.ipAddress ?? null
    })
    .catch(() => undefined);

  return {
    ok: true,
    apiKey: toEffectiveMetadata(record)
  };
}

export async function recordApiRequest(input: RecordApiRequestInput) {
  await getRepository().recordApiRequest(input);
}

export async function countRecentApiRequests(
  input: CountRecentApiRequestsInput
) {
  const countInput: CountRecentApiRequestsInput = {
    organizationId: input.organizationId,
    sinceIso: input.sinceIso
  };

  if (input.apiKeyId) {
    countInput.apiKeyId = input.apiKeyId;
  }

  if (input.pathPrefix) {
    countInput.pathPrefix = input.pathPrefix;
  }

  if (input.accessToken) {
    countInput.accessToken = input.accessToken;
  }

  return getRepository().countRecentApiRequests(countInput);
}

export async function listApiRequests(input: ListApiRequestsInput) {
  const listInput: ListApiRequestsInput = {
    organizationId: input.organizationId,
    limit: input.limit ?? 50
  };

  if (input.apiKeyId) {
    listInput.apiKeyId = input.apiKeyId;
  }

  if (typeof input.statusCode === "number") {
    listInput.statusCode = input.statusCode;
  }

  if (input.pathPrefix) {
    listInput.pathPrefix = input.pathPrefix;
  }

  if (input.accessToken) {
    listInput.accessToken = input.accessToken;
  }

  return getRepository().listApiRequests(listInput);
}

export async function getApiUsageSummary(input: GetApiUsageSummaryInput) {
  const summaryInput: GetApiUsageSummaryInput = {
    organizationId: input.organizationId,
    sinceDays: input.sinceDays ?? 30
  };

  if (input.apiKeyId) {
    summaryInput.apiKeyId = input.apiKeyId;
  }

  if (input.accessToken) {
    summaryInput.accessToken = input.accessToken;
  }

  return getRepository().getApiUsageSummary(summaryInput);
}

export async function updateLastUsed(apiKeyId: string, ipAddress: string | null) {
  await getRepository().updateLastUsed({
    apiKeyId,
    ipAddress
  });
}
