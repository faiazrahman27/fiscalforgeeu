import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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
  "invoices:export_cii",
  "invoices:parse_cii",
  "invoices:import_cii",
  "xml:validation_jobs",
  "vat:validate_format",
  "vat:check_vies",
  "transactions:classify",
  "transactions:simulate_vida",
  "learning_scenarios:read",
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

const API_KEY_PREFIX_PATTERN = /^il_(test|live)_[A-Za-z0-9_-]{6,40}$/;
const API_KEY_PATTERN =
  /^il_(test|live)_[A-Za-z0-9_-]{6,40}\.[A-Za-z0-9_-]{24,}$/;
const API_KEY_HASH_PATTERN = /^[a-f0-9]{64}$/;
const API_KEY_PREFIX_RANDOM_BYTES = 8;
const API_KEY_SECRET_RANDOM_BYTES = 32;
const MAX_API_KEY_NAME_LENGTH = 120;
const DEFAULT_API_REQUEST_LIMIT = 50;

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

function normalizeApiKeyScopesForCreate(scopes: readonly string[]) {
  const normalizedScopes = normalizeApiKeyScopes(scopes);

  if (normalizedScopes.length === 0) {
    throw new ApiKeyServiceError(
      "API_KEY_SCOPE_REQUIRED",
      "Select at least one API key scope.",
      400
    );
  }

  return normalizedScopes;
}

export function looksLikeInvoiceLanternApiKey(value: string) {
  return API_KEY_PATTERN.test(value.trim());
}

export function getApiKeyPrefix(rawKey: string) {
  const trimmedKey = rawKey.trim();
  const separatorIndex = trimmedKey.indexOf(".");

  if (separatorIndex <= 0) {
    return "";
  }

  const prefix = trimmedKey.slice(0, separatorIndex);

  return API_KEY_PREFIX_PATTERN.test(prefix) ? prefix : "";
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
  if (!API_KEY_HASH_PATTERN.test(leftHash) || !API_KEY_HASH_PATTERN.test(rightHash)) {
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
  return `il_${environment}_${generateToken(API_KEY_PREFIX_RANDOM_BYTES)}`;
}

function buildSecret(prefix: string) {
  return `${prefix}.${generateToken(API_KEY_SECRET_RANDOM_BYTES)}`;
}

function isExpired(apiKey: Pick<ApiKeyMetadata, "expiresAt">) {
  if (!apiKey.expiresAt) {
    return false;
  }

  const expiryTime = new Date(apiKey.expiresAt).getTime();

  return Number.isFinite(expiryTime) && expiryTime <= Date.now();
}

function normalizeOrganizationId(organizationId: string) {
  const normalizedOrganizationId = organizationId.trim();

  if (!normalizedOrganizationId) {
    throw new ApiKeyServiceError(
      "ORGANIZATION_ID_REQUIRED",
      "Organization ID is required.",
      400
    );
  }

  return normalizedOrganizationId;
}

function normalizeApiKeyName(name: string) {
  const normalizedName = name.trim();

  if (
    normalizedName.length < 1 ||
    normalizedName.length > MAX_API_KEY_NAME_LENGTH
  ) {
    throw new ApiKeyServiceError(
      "API_KEY_NAME_INVALID",
      `API key name must be between 1 and ${MAX_API_KEY_NAME_LENGTH} characters.`,
      400
    );
  }

  return normalizedName;
}

function normalizeExpiresAt(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    return null;
  }

  const expiryTime = new Date(normalizedValue).getTime();

  if (!Number.isFinite(expiryTime)) {
    throw new ApiKeyServiceError(
      "API_KEY_EXPIRY_INVALID",
      "API key expiry must be a valid date-time string.",
      400
    );
  }

  return new Date(expiryTime).toISOString();
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
  const organizationId = normalizeOrganizationId(input.organizationId);
  const normalizedName = normalizeApiKeyName(input.name);
  const scopes = normalizeApiKeyScopesForCreate(input.scopes);
  const expiresAt = normalizeExpiresAt(input.expiresAt);
  const keyPrefix = buildKeyPrefix(input.environment);
  const secret = buildSecret(keyPrefix);
  const keyHash = hashApiKey(secret);

  const record = await getRepository().createApiKeyRecord({
    organizationId,
    name: normalizedName,
    keyPrefix,
    keyHash,
    environment: input.environment,
    scopes,
    expiresAt,
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
  const records = await getRepository().listApiKeys({
    organizationId: normalizeOrganizationId(input.organizationId),
    ...(input.accessToken ? { accessToken: input.accessToken } : {})
  });

  return records.map(toEffectiveMetadata);
}

export async function revokeApiKey(input: {
  organizationId: string;
  apiKeyId: string;
  revokedBy?: string | null;
  accessToken?: string;
}) {
  const record = await getRepository().revokeApiKey({
    organizationId: normalizeOrganizationId(input.organizationId),
    apiKeyId: input.apiKeyId.trim(),
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

  const submittedKeyHash = hashApiKey(trimmedKey);
  const candidates = await getRepository().findApiKeysByPrefix({ keyPrefix });
  const record =
    candidates.find(
      (candidate) =>
        typeof candidate.keyHash === "string" &&
        hashMatches(submittedKeyHash, candidate.keyHash)
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
  await getRepository().recordApiRequest({
    organizationId: input.organizationId,
    apiKeyId: input.apiKeyId,
    requestMethod: input.requestMethod.trim().toUpperCase(),
    requestPath: input.requestPath.trim(),
    statusCode: input.statusCode,
    durationMs: input.durationMs,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    errorCode: input.errorCode ?? null
  });
}

export async function countRecentApiRequests(
  input: CountRecentApiRequestsInput
) {
  const countInput: CountRecentApiRequestsInput = {
    organizationId: normalizeOrganizationId(input.organizationId),
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
    organizationId: normalizeOrganizationId(input.organizationId),
    limit: input.limit ?? DEFAULT_API_REQUEST_LIMIT
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
    organizationId: normalizeOrganizationId(input.organizationId),
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
