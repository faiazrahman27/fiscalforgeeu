import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleClient,
  getSupabaseUserClient
} from "../lib/supabase/server-client.js";
import type {
  ApiKeyEnvironment,
  ApiKeyRecord,
  ApiKeyScope,
  ApiKeyStatus,
  ApiKeyWorkspace,
  RecordApiRequestInput
} from "../services/api-key-service.js";

export type CreateApiKeyRecordInput = {
  organizationId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  environment: ApiKeyEnvironment;
  scopes: ApiKeyScope[];
  expiresAt: string | null;
  createdBy: string | null;
};

export type ApiKeyRepository = {
  getWorkspaceForUser(input: {
    userId: string;
    accessToken: string;
  }): Promise<ApiKeyWorkspace>;
  createApiKeyRecord(input: CreateApiKeyRecordInput): Promise<ApiKeyRecord>;
  listApiKeys(input: { organizationId: string }): Promise<ApiKeyRecord[]>;
  findApiKeysByPrefix(input: { keyPrefix: string }): Promise<ApiKeyRecord[]>;
  revokeApiKey(input: {
    organizationId: string;
    apiKeyId: string;
    revokedBy: string | null;
  }): Promise<ApiKeyRecord | null>;
  markApiKeyExpired(input: {
    organizationId: string;
    apiKeyId: string;
  }): Promise<void>;
  updateLastUsed(input: {
    apiKeyId: string;
    ipAddress: string | null;
  }): Promise<void>;
  recordApiRequest(input: RecordApiRequestInput): Promise<void>;
};

type SupabaseWorkspaceBootstrapRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

type SupabaseApiKeyRow = {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  environment: string;
  scopes: unknown;
  status: string;
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  created_by: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

const API_KEY_SELECT_FIELDS =
  "id, organization_id, name, key_prefix, key_hash, environment, scopes, status, expires_at, last_used_at, last_used_ip, created_by, revoked_by, revoked_at, created_at, updated_at";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function normalizeWorkspaceBootstrapRecord(
  value: unknown
): SupabaseWorkspaceBootstrapRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const organizationId = readStringField(value, "organization_id");
  const organizationName = readStringField(value, "organization_name");
  const organizationSlug = readStringField(value, "organization_slug");
  const membershipRole = readStringField(value, "membership_role", "member");
  const userEmail = readStringField(value, "user_email");

  if (!organizationId || !organizationName || !organizationSlug) {
    return null;
  }

  return {
    organizationId,
    organizationName,
    organizationSlug,
    membershipRole,
    userEmail
  };
}

function normalizeEnvironment(value: string): ApiKeyEnvironment {
  return value === "live" ? "live" : "test";
}

function normalizeStatus(value: string): ApiKeyStatus {
  if (value === "revoked" || value === "expired") {
    return value;
  }

  return "active";
}

function normalizeScopes(value: unknown): ApiKeyScope[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((scope): scope is ApiKeyScope => typeof scope === "string")
    .map((scope) => scope.trim())
    .filter((scope): scope is ApiKeyScope =>
      [
        "invoices:validate",
        "invoices:export_ubl",
        "invoices:parse_ubl",
        "invoices:import_ubl",
        "vat:validate_format",
        "validation_runs:read",
        "rules:read"
      ].includes(scope)
    );
}

function normalizeNullableString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeApiKeyRow(row: SupabaseApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    keyHash: row.key_hash,
    environment: normalizeEnvironment(row.environment),
    scopes: normalizeScopes(row.scopes),
    status: normalizeStatus(row.status),
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    lastUsedIp: normalizeNullableString(row.last_used_ip),
    createdBy: row.created_by,
    revokedBy: row.revoked_by,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createServiceRoleClient() {
  return getSupabaseServiceRoleClient();
}

function createAuthenticatedSupabaseClient(input: {
  accessToken: string;
}) {
  return getSupabaseUserClient(input.accessToken);
}

async function getWorkspaceForUser(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase.rpc("bootstrap_personal_workspace");

  if (error) {
    throw new Error(`Workspace bootstrap failed: ${error.message}`);
  }

  const firstRecord = Array.isArray(data) ? data[0] : data;
  const workspace = normalizeWorkspaceBootstrapRecord(firstRecord);

  if (!workspace) {
    throw new Error("Workspace bootstrap returned an unreadable record.");
  }

  if (!userId) {
    throw new Error("Authenticated user ID is required.");
  }

  return workspace;
}

function buildInsertValues(input: CreateApiKeyRecordInput) {
  return {
    organization_id: input.organizationId,
    name: input.name,
    key_prefix: input.keyPrefix,
    key_hash: input.keyHash,
    environment: input.environment,
    scopes: input.scopes,
    status: "active",
    expires_at: input.expiresAt,
    created_by: input.createdBy
  };
}

function getSafeIpAddress(value: string | null) {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export const supabaseApiKeyRepository: ApiKeyRepository = {
  async getWorkspaceForUser(input) {
    const supabase = createAuthenticatedSupabaseClient({
      accessToken: input.accessToken
    });

    return getWorkspaceForUser(supabase, input.userId);
  },

  async createApiKeyRecord(input) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("api_keys")
      .insert(buildInsertValues(input))
      .select(API_KEY_SELECT_FIELDS)
      .single();

    if (error) {
      throw new Error(`Could not create API key: ${error.message}`);
    }

    return normalizeApiKeyRow(data as SupabaseApiKeyRow);
  },

  async listApiKeys(input) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select(API_KEY_SELECT_FIELDS)
      .eq("organization_id", input.organizationId)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      throw new Error(`Could not list API keys: ${error.message}`);
    }

    return ((data ?? []) as SupabaseApiKeyRow[]).map(normalizeApiKeyRow);
  },

  async findApiKeysByPrefix(input) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select(API_KEY_SELECT_FIELDS)
      .eq("key_prefix", input.keyPrefix)
      .limit(5);

    if (error) {
      throw new Error(`Could not read API key: ${error.message}`);
    }

    return ((data ?? []) as SupabaseApiKeyRow[]).map(normalizeApiKeyRow);
  },

  async revokeApiKey(input) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("api_keys")
      .update({
        status: "revoked",
        revoked_by: input.revokedBy,
        revoked_at: new Date().toISOString()
      })
      .eq("id", input.apiKeyId)
      .eq("organization_id", input.organizationId)
      .select(API_KEY_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not revoke API key: ${error.message}`);
    }

    return data ? normalizeApiKeyRow(data as SupabaseApiKeyRow) : null;
  },

  async markApiKeyExpired(input) {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("api_keys")
      .update({
        status: "expired"
      })
      .eq("id", input.apiKeyId)
      .eq("organization_id", input.organizationId)
      .eq("status", "active");

    if (error) {
      throw new Error(`Could not mark API key expired: ${error.message}`);
    }
  },

  async updateLastUsed(input) {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip: getSafeIpAddress(input.ipAddress)
      })
      .eq("id", input.apiKeyId);

    if (error) {
      throw new Error(`Could not update API key last-used metadata: ${error.message}`);
    }
  },

  async recordApiRequest(input) {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("api_requests").insert({
      organization_id: input.organizationId,
      api_key_id: input.apiKeyId,
      request_method: input.requestMethod,
      request_path: input.requestPath,
      status_code: input.statusCode,
      duration_ms: input.durationMs,
      ip_address: getSafeIpAddress(input.ipAddress),
      user_agent: input.userAgent,
      error_code: input.errorCode ?? null
    });

    if (error) {
      throw new Error(`Could not record API request: ${error.message}`);
    }
  }
};
