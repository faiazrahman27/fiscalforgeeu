import { randomUUID } from "node:crypto";
import { resolveApiStorageBackend } from "../config/env.js";
import {
  getSupabaseUserClient,
  hasSupabaseJwtConfig
} from "../lib/supabase/server-client.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";
import type {
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  WebhookEventType
} from "../schemas/webhooks.js";

export type WebhookEndpointRecord = {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  status: WebhookEndpointStatus;
  eventTypes: WebhookEventType[];
  description: string | null;
  signingSecretEncrypted: string | null;
  signingSecretIv: string | null;
  signingSecretTag: string | null;
  signingSecretLast4: string | null;
  signingSecretKeyId: string | null;
  lastDeliveryAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
};

export type WebhookDeliveryRecord = {
  id: string;
  organizationId: string;
  webhookEndpointId: string;
  eventType: WebhookEventType;
  status: WebhookDeliveryStatus;
  attemptNumber: number;
  maxAttempts: number;
  requestUrl: string;
  requestMethod: "POST";
  requestHeadersRedacted: Record<string, string>;
  requestPayload: Record<string, unknown>;
  payloadHash: string;
  signatureHeader: string | null;
  responseStatus: number | null;
  responseHeadersRedacted: Record<string, string>;
  responseBodyPreview: string | null;
  responseTimeMs: number | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
  nextRetryAt: string | null;
  deliveredAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type CreateWebhookEndpointInput = {
  organizationId: string;
  name: string;
  url: string;
  eventTypes: WebhookEventType[];
  description: string | null;
  encryptedSecret: {
    encrypted: string;
    iv: string;
    tag: string;
    last4: string;
    keyId: string;
  };
  createdBy: string;
  accessToken: string;
};

export type UpdateWebhookEndpointInput = {
  endpointId: string;
  organizationId: string;
  accessToken: string;
  updatedBy: string;
  updates: Partial<{
    name: string | undefined;
    url: string | undefined;
    status: WebhookEndpointStatus | undefined;
    eventTypes: WebhookEventType[] | undefined;
    description: string | null | undefined;
    signingSecretEncrypted: string | undefined;
    signingSecretIv: string | undefined;
    signingSecretTag: string | undefined;
    signingSecretLast4: string | undefined;
    signingSecretKeyId: string | undefined;
    lastDeliveryAt: string | null | undefined;
    lastSuccessAt: string | null | undefined;
    lastFailureAt: string | null | undefined;
    failureCount: number | undefined;
    disabledAt: string | null | undefined;
  }>;
};

export type CreateWebhookDeliveryInput = Omit<
  WebhookDeliveryRecord,
  "createdAt"
> & {
  accessToken: string;
};

export type ListWebhookEndpointsInput = {
  organizationId: string;
  accessToken: string;
  status?: WebhookEndpointStatus | undefined;
  eventType?: WebhookEventType | undefined;
  limit: number;
};

export type ListWebhookDeliveriesInput = {
  organizationId: string;
  accessToken: string;
  endpointId?: string | undefined;
  status?: WebhookDeliveryStatus | undefined;
  eventType?: WebhookEventType | undefined;
  limit: number;
};

export type WebhookRepository = {
  createEndpoint(
    input: CreateWebhookEndpointInput
  ): Promise<WebhookEndpointRecord>;
  listEndpoints(
    input: ListWebhookEndpointsInput
  ): Promise<WebhookEndpointRecord[]>;
  getEndpoint(input: {
    endpointId: string;
    organizationId: string;
    accessToken: string;
  }): Promise<WebhookEndpointRecord | null>;
  updateEndpoint(
    input: UpdateWebhookEndpointInput
  ): Promise<WebhookEndpointRecord | null>;
  createDelivery(
    input: CreateWebhookDeliveryInput
  ): Promise<WebhookDeliveryRecord>;
  listDeliveries(
    input: ListWebhookDeliveriesInput
  ): Promise<WebhookDeliveryRecord[]>;
  getDelivery(input: {
    deliveryId: string;
    organizationId: string;
    accessToken: string;
  }): Promise<WebhookDeliveryRecord | null>;
};

const endpointCollection = "webhook-endpoints";
const deliveryCollection = "webhook-deliveries";

let repositoryForTesting: WebhookRepository | null = null;

export function setWebhookRepositoryForTesting(repository: WebhookRepository) {
  repositoryForTesting = repository;
}

export function resetWebhookRepositoryForTesting() {
  repositoryForTesting = null;
}

export function getWebhookRepository(): WebhookRepository {
  if (repositoryForTesting) {
    return repositoryForTesting;
  }

  if (resolveApiStorageBackend() === "supabase" && hasSupabaseJwtConfig()) {
    return supabaseWebhookRepository;
  }

  return jsonWebhookRepository;
}

const jsonWebhookRepository: WebhookRepository = {
  async createEndpoint(input) {
    const storage = getCollectionStorageProvider();
    const records = await storage.readCollection<WebhookEndpointRecord>(
      endpointCollection
    );
    const now = new Date().toISOString();
    const record: WebhookEndpointRecord = {
      id: randomUUID(),
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
      createdAt: now,
      updatedAt: now,
      disabledAt: null
    };

    records.unshift(record);
    await storage.writeCollection(endpointCollection, records);

    return record;
  },

  async listEndpoints(input) {
    const storage = getCollectionStorageProvider();
    const records = await storage.readCollection<WebhookEndpointRecord>(
      endpointCollection
    );

    return records
      .filter((record) => record.organizationId === input.organizationId)
      .filter((record) => (input.status ? record.status === input.status : true))
      .filter((record) =>
        input.eventType ? record.eventTypes.includes(input.eventType) : true
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, input.limit);
  },

  async getEndpoint(input) {
    const storage = getCollectionStorageProvider();
    const records = await storage.readCollection<WebhookEndpointRecord>(
      endpointCollection
    );

    return (
      records.find(
        (record) =>
          record.id === input.endpointId &&
          record.organizationId === input.organizationId
      ) ?? null
    );
  },

  async updateEndpoint(input) {
    const storage = getCollectionStorageProvider();
    const records = await storage.readCollection<WebhookEndpointRecord>(
      endpointCollection
    );
    const record = records.find(
      (item) =>
        item.id === input.endpointId &&
        item.organizationId === input.organizationId
    );

    if (!record) {
      return null;
    }

    Object.assign(record, input.updates, {
      updatedBy: input.updatedBy,
      updatedAt: new Date().toISOString()
    });

    await storage.writeCollection(endpointCollection, records);

    return record;
  },

  async createDelivery(input) {
    const storage = getCollectionStorageProvider();
    const deliveries = await storage.readCollection<WebhookDeliveryRecord>(
      deliveryCollection
    );
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
      createdAt: new Date().toISOString()
    };

    deliveries.unshift(delivery);
    await storage.writeCollection(deliveryCollection, deliveries);

    await updateJsonEndpointStats({
      endpointId: input.webhookEndpointId,
      organizationId: input.organizationId,
      status: input.status
    });

    return delivery;
  },

  async listDeliveries(input) {
    const storage = getCollectionStorageProvider();
    const records = await storage.readCollection<WebhookDeliveryRecord>(
      deliveryCollection
    );

    return records
      .filter((record) => record.organizationId === input.organizationId)
      .filter((record) =>
        input.endpointId ? record.webhookEndpointId === input.endpointId : true
      )
      .filter((record) => (input.status ? record.status === input.status : true))
      .filter((record) =>
        input.eventType ? record.eventType === input.eventType : true
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, input.limit);
  },

  async getDelivery(input) {
    const storage = getCollectionStorageProvider();
    const records = await storage.readCollection<WebhookDeliveryRecord>(
      deliveryCollection
    );

    return (
      records.find(
        (record) =>
          record.id === input.deliveryId &&
          record.organizationId === input.organizationId
      ) ?? null
    );
  }
};

const supabaseWebhookRepository: WebhookRepository = {
  async createEndpoint(input) {
    const client = getSupabaseUserClient(input.accessToken);
    const { data, error } = await client
      .from("webhook_endpoints")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        url: input.url,
        status: "active",
        event_types: input.eventTypes,
        description: input.description,
        signing_secret_encrypted: input.encryptedSecret.encrypted,
        signing_secret_iv: input.encryptedSecret.iv,
        signing_secret_tag: input.encryptedSecret.tag,
        signing_secret_last4: input.encryptedSecret.last4,
        signing_secret_key_id: input.encryptedSecret.keyId,
        created_by: input.createdBy,
        updated_by: input.createdBy
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapEndpointRow(data);
  },

  async listEndpoints(input) {
    const client = getSupabaseUserClient(input.accessToken);
    let query = client
      .from("webhook_endpoints")
      .select("*")
      .eq("organization_id", input.organizationId)
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (input.status) {
      query = query.eq("status", input.status);
    }

    if (input.eventType) {
      query = query.contains("event_types", [input.eventType]);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapEndpointRow);
  },

  async getEndpoint(input) {
    const client = getSupabaseUserClient(input.accessToken);
    const { data, error } = await client
      .from("webhook_endpoints")
      .select("*")
      .eq("id", input.endpointId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapEndpointRow(data) : null;
  },

  async updateEndpoint(input) {
    const client = getSupabaseUserClient(input.accessToken);
    const updatePayload = mapEndpointUpdatePayload(input);
    const { data, error } = await client
      .from("webhook_endpoints")
      .update(updatePayload)
      .eq("id", input.endpointId)
      .eq("organization_id", input.organizationId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapEndpointRow(data) : null;
  },

  async createDelivery(input) {
    const client = getSupabaseUserClient(input.accessToken);
    const { data, error } = await client
      .from("webhook_deliveries")
      .insert({
        id: input.id,
        organization_id: input.organizationId,
        webhook_endpoint_id: input.webhookEndpointId,
        event_type: input.eventType,
        status: input.status,
        attempt_number: input.attemptNumber,
        max_attempts: input.maxAttempts,
        request_url: input.requestUrl,
        request_method: input.requestMethod,
        request_headers_redacted: input.requestHeadersRedacted,
        request_payload: input.requestPayload,
        payload_hash: input.payloadHash,
        signature_header: input.signatureHeader,
        response_status: input.responseStatus,
        response_headers_redacted: input.responseHeadersRedacted,
        response_body_preview: input.responseBodyPreview,
        response_time_ms: input.responseTimeMs,
        error_code: input.errorCode,
        error_message_safe: input.errorMessageSafe,
        next_retry_at: input.nextRetryAt,
        delivered_at: input.deliveredAt,
        created_by: input.createdBy
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const endpoint = await supabaseWebhookRepository.getEndpoint({
      endpointId: input.webhookEndpointId,
      organizationId: input.organizationId,
      accessToken: input.accessToken
    });
    await supabaseWebhookRepository.updateEndpoint({
      endpointId: input.webhookEndpointId,
      organizationId: input.organizationId,
      accessToken: input.accessToken,
      updatedBy: input.createdBy ?? "",
      updates: buildEndpointDeliveryStatsUpdate(
        input.status,
        endpoint?.failureCount ?? 0
      )
    });

    return mapDeliveryRow(data);
  },

  async listDeliveries(input) {
    const client = getSupabaseUserClient(input.accessToken);
    let query = client
      .from("webhook_deliveries")
      .select("*")
      .eq("organization_id", input.organizationId)
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (input.endpointId) {
      query = query.eq("webhook_endpoint_id", input.endpointId);
    }

    if (input.status) {
      query = query.eq("status", input.status);
    }

    if (input.eventType) {
      query = query.eq("event_type", input.eventType);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapDeliveryRow);
  },

  async getDelivery(input) {
    const client = getSupabaseUserClient(input.accessToken);
    const { data, error } = await client
      .from("webhook_deliveries")
      .select("*")
      .eq("id", input.deliveryId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapDeliveryRow(data) : null;
  }
};

async function updateJsonEndpointStats(input: {
  endpointId: string;
  organizationId: string;
  status: WebhookDeliveryStatus;
}) {
  const storage = getCollectionStorageProvider();
  const endpoints = await storage.readCollection<WebhookEndpointRecord>(
    endpointCollection
  );
  const endpoint = endpoints.find(
    (item) =>
      item.id === input.endpointId && item.organizationId === input.organizationId
  );

  if (!endpoint) {
    return;
  }

  Object.assign(
    endpoint,
    buildEndpointDeliveryStatsUpdate(input.status, endpoint.failureCount),
    {
      updatedAt: new Date().toISOString()
    }
  );
  await storage.writeCollection(endpointCollection, endpoints);
}

function buildEndpointDeliveryStatsUpdate(
  status: WebhookDeliveryStatus,
  currentFailureCount = 0
) {
  const now = new Date().toISOString();

  if (status === "delivered") {
    return {
      lastDeliveryAt: now,
      lastSuccessAt: now,
      lastFailureAt: null,
      failureCount: 0,
      status: "active" as const
    };
  }

  if (status === "failed" || status === "blocked") {
    return {
      lastDeliveryAt: now,
      lastFailureAt: now,
      failureCount: currentFailureCount + 1,
      status: "failing" as const
    };
  }

  return {
    lastDeliveryAt: now
  };
}

function mapEndpointUpdatePayload(input: UpdateWebhookEndpointInput) {
  const updates: Record<string, unknown> = {
    updated_by: input.updatedBy
  };

  for (const [key, value] of Object.entries(input.updates)) {
    if (value === undefined) {
      continue;
    }

    updates[camelToSnake(key)] = value;
  }

  if (typeof updates.event_types === "undefined" && input.updates.eventTypes) {
    updates.event_types = input.updates.eventTypes;
  }

  return updates;
}

function camelToSnake(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function mapEndpointRow(row: Record<string, unknown>): WebhookEndpointRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    url: String(row.url),
    status: row.status as WebhookEndpointStatus,
    eventTypes: (row.event_types ?? []) as WebhookEventType[],
    description: nullableString(row.description),
    signingSecretEncrypted: nullableString(row.signing_secret_encrypted),
    signingSecretIv: nullableString(row.signing_secret_iv),
    signingSecretTag: nullableString(row.signing_secret_tag),
    signingSecretLast4: nullableString(row.signing_secret_last4),
    signingSecretKeyId: nullableString(row.signing_secret_key_id),
    lastDeliveryAt: nullableString(row.last_delivery_at),
    lastSuccessAt: nullableString(row.last_success_at),
    lastFailureAt: nullableString(row.last_failure_at),
    failureCount: Number(row.failure_count ?? 0),
    createdBy: nullableString(row.created_by),
    updatedBy: nullableString(row.updated_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    disabledAt: nullableString(row.disabled_at)
  };
}

function mapDeliveryRow(row: Record<string, unknown>): WebhookDeliveryRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    webhookEndpointId: String(row.webhook_endpoint_id),
    eventType: row.event_type as WebhookEventType,
    status: row.status as WebhookDeliveryStatus,
    attemptNumber: Number(row.attempt_number ?? 1),
    maxAttempts: Number(row.max_attempts ?? 3),
    requestUrl: String(row.request_url),
    requestMethod: "POST",
    requestHeadersRedacted: objectRecord(row.request_headers_redacted),
    requestPayload: unknownObjectRecord(row.request_payload),
    payloadHash: String(row.payload_hash),
    signatureHeader: nullableString(row.signature_header),
    responseStatus:
      typeof row.response_status === "number" ? row.response_status : null,
    responseHeadersRedacted: objectRecord(row.response_headers_redacted),
    responseBodyPreview: nullableString(row.response_body_preview),
    responseTimeMs:
      typeof row.response_time_ms === "number" ? row.response_time_ms : null,
    errorCode: nullableString(row.error_code),
    errorMessageSafe: nullableString(row.error_message_safe),
    nextRetryAt: nullableString(row.next_retry_at),
    deliveredAt: nullableString(row.delivered_at),
    createdBy: nullableString(row.created_by),
    createdAt: String(row.created_at)
  };
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function objectRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, String(child)])
  );
}

function unknownObjectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
