import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import {
  getWebhookRepository,
  type WebhookDeliveryRecord,
  type WebhookEndpointRecord,
  type WebhookRepository
} from "../repositories/webhook-repository.js";
import {
  WEBHOOK_SIMULATOR_DISCLAIMER,
  type WebhookDeliveryStatus,
  type WebhookEventType
} from "../schemas/webhooks.js";
import {
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
  generateWebhookSigningSecret,
  hashWebhookPayload,
  signWebhookPayload,
  stableStringifyJson,
  type EncryptedWebhookSecret
} from "./webhook-signing-service.js";
import {
  validateWebhookDeliveryUrl,
  type WebhookDnsResolver
} from "./webhook-url-safety.js";

type FetchImplementation = typeof fetch;

export type WebhookDeliveryDependencies = {
  repository?: WebhookRepository;
  fetchImplementation?: FetchImplementation;
  resolver?: WebhookDnsResolver;
  now?: () => Date;
};

type WorkspaceWebhookContext = {
  organizationId: string;
  userId: string;
  accessToken: string;
};

export class WebhookServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(input: {
    code: string;
    message: string;
    statusCode?: number;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "WebhookServiceError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? 400;
    this.details = input.details;
  }
}

let dependenciesForTesting: WebhookDeliveryDependencies | null = null;

export function setWebhookDeliveryDependenciesForTesting(
  dependencies: WebhookDeliveryDependencies
) {
  dependenciesForTesting = dependencies;
}

export function resetWebhookDeliveryDependenciesForTesting() {
  dependenciesForTesting = null;
}

export async function createWebhookEndpoint(input: WorkspaceWebhookContext & {
  name: string;
  url: string;
  eventTypes: WebhookEventType[];
  description: string | null;
}) {
  const dependencies = getDependencies();

  await validateWebhookDeliveryUrl(input.url, {
    resolver: dependencies.resolver
  });

  const signingSecret = generateWebhookSigningSecret();
  const encryptedSecret = encryptWebhookSigningSecret(signingSecret);
  const endpoint = await dependencies.repository.createEndpoint({
    organizationId: input.organizationId,
    name: input.name,
    url: input.url,
    eventTypes: input.eventTypes,
    description: input.description,
    encryptedSecret,
    createdBy: input.userId,
    accessToken: input.accessToken
  });

  return {
    endpoint: serializeEndpoint(endpoint),
    signingSecret,
    warning:
      "Store this webhook signing secret now. Invoice Lantern only shows it on creation or rotation.",
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export async function listWebhookEndpoints(input: WorkspaceWebhookContext & {
  status?: WebhookEndpointRecord["status"] | undefined;
  eventType?: WebhookEventType | undefined;
  limit: number;
}) {
  const endpoints = await getDependencies().repository.listEndpoints(input);

  return {
    endpoints: endpoints.map(serializeEndpoint),
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export async function getWebhookEndpoint(input: WorkspaceWebhookContext & {
  endpointId: string;
}) {
  const endpoint = await getEndpointOrThrow(input);

  return {
    endpoint: serializeEndpoint(endpoint),
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export async function updateWebhookEndpoint(input: WorkspaceWebhookContext & {
  endpointId: string;
  updates: Partial<{
    name: string | undefined;
    url: string | undefined;
    status: WebhookEndpointRecord["status"] | undefined;
    eventTypes: WebhookEventType[] | undefined;
    description: string | null | undefined;
    disabledAt: string | null | undefined;
  }>;
}) {
  const dependencies = getDependencies();

  if (input.updates.url) {
    await validateWebhookDeliveryUrl(input.updates.url, {
      resolver: dependencies.resolver
    });
  }

  const updated = await dependencies.repository.updateEndpoint({
    endpointId: input.endpointId,
    organizationId: input.organizationId,
    accessToken: input.accessToken,
    updatedBy: input.userId,
    updates: input.updates
  });

  if (!updated) {
    throw notFoundError("Webhook endpoint");
  }

  return {
    endpoint: serializeEndpoint(updated),
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export async function disableWebhookEndpoint(input: WorkspaceWebhookContext & {
  endpointId: string;
}) {
  return updateWebhookEndpoint({
    ...input,
    updates: {
      status: "disabled",
      disabledAt: new Date().toISOString()
    }
  });
}

export async function rotateWebhookEndpointSecret(
  input: WorkspaceWebhookContext & {
    endpointId: string;
  }
) {
  const dependencies = getDependencies();
  const signingSecret = generateWebhookSigningSecret();
  const encryptedSecret = encryptWebhookSigningSecret(signingSecret);
  const updated = await dependencies.repository.updateEndpoint({
    endpointId: input.endpointId,
    organizationId: input.organizationId,
    accessToken: input.accessToken,
    updatedBy: input.userId,
    updates: mapEncryptedSecretUpdate(encryptedSecret)
  });

  if (!updated) {
    throw notFoundError("Webhook endpoint");
  }

  return {
    endpoint: serializeEndpoint(updated),
    signingSecret,
    warning:
      "Store this rotated webhook signing secret now. Invoice Lantern will not show it again.",
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export async function sendWebhookTestEvent(input: WorkspaceWebhookContext & {
  endpointId: string;
  eventType: WebhookEventType;
  payload?: Record<string, unknown> | undefined;
}) {
  const endpoint = await getEndpointOrThrow(input);
  assertEndpointAcceptsEvent(endpoint, input.eventType);

  const requestPayload = buildWebhookEventPayload({
    eventType: input.eventType,
    organizationId: input.organizationId,
    now: getDependencies().now(),
    data: input.payload
  });

  const delivery = await deliverWebhookEvent({
    context: input,
    endpoint,
    requestPayload,
    attemptNumber: 1,
    maxAttempts: configuredMaxAttempts()
  });

  return {
    delivery: serializeDelivery(delivery),
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export async function retryWebhookDelivery(input: WorkspaceWebhookContext & {
  deliveryId: string;
}) {
  const dependencies = getDependencies();
  const delivery = await dependencies.repository.getDelivery(input);

  if (!delivery) {
    throw notFoundError("Webhook delivery");
  }

  if (!["failed", "retry_scheduled", "blocked"].includes(delivery.status)) {
    throw new WebhookServiceError({
      code: "WEBHOOK_DELIVERY_RETRY_NOT_ALLOWED",
      message: "Only failed, blocked, or retry-scheduled test deliveries can be retried.",
      statusCode: 409
    });
  }

  if (delivery.attemptNumber >= delivery.maxAttempts) {
    throw new WebhookServiceError({
      code: "WEBHOOK_DELIVERY_MAX_ATTEMPTS_REACHED",
      message: "This test delivery already reached its configured retry limit.",
      statusCode: 409
    });
  }

  const endpoint = await getEndpointOrThrow({
    ...input,
    endpointId: delivery.webhookEndpointId
  });

  assertEndpointCanDeliver(endpoint);

  const nextDelivery = await deliverWebhookEvent({
    context: input,
    endpoint,
    requestPayload: delivery.requestPayload,
    attemptNumber: delivery.attemptNumber + 1,
    maxAttempts: delivery.maxAttempts
  });

  return {
    delivery: serializeDelivery(nextDelivery),
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export async function listWebhookDeliveries(input: WorkspaceWebhookContext & {
  endpointId?: string | undefined;
  status?: WebhookDeliveryStatus | undefined;
  eventType?: WebhookEventType | undefined;
  limit: number;
}) {
  const deliveries = await getDependencies().repository.listDeliveries(input);

  return {
    deliveries: deliveries.map(serializeDelivery),
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export async function getWebhookDelivery(input: WorkspaceWebhookContext & {
  deliveryId: string;
}) {
  const delivery = await getDependencies().repository.getDelivery(input);

  if (!delivery) {
    throw notFoundError("Webhook delivery");
  }

  return {
    delivery: serializeDelivery(delivery),
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export function buildWebhookEventPayload(input: {
  eventType: WebhookEventType;
  organizationId: string;
  now: Date;
  data?: Record<string, unknown> | undefined;
}) {
  return {
    id: `evt_${randomUUID()}`,
    type: input.eventType,
    createdAt: input.now.toISOString(),
    apiVersion: "2026-05-14.webhook-simulator",
    organizationId: input.organizationId,
    livemode: false,
    simulator: true,
    data: input.data ?? defaultEventData(input.eventType),
    disclaimer: WEBHOOK_SIMULATOR_DISCLAIMER
  };
}

export function redactWebhookHeaders(
  headers: Headers | Record<string, string | undefined>
): Record<string, string> {
  const redacted: Record<string, string> = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      redacted[key] = redactHeaderValue(key, value);
    });
    return redacted;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      redacted[key] = redactHeaderValue(key, value);
    }
  }

  return redacted;
}

async function deliverWebhookEvent(input: {
  context: WorkspaceWebhookContext;
  endpoint: WebhookEndpointRecord;
  requestPayload: Record<string, unknown>;
  attemptNumber: number;
  maxAttempts: number;
}) {
  const dependencies = getDependencies();
  const deliveryId = randomUUID();
  const timestamp = Math.floor(dependencies.now().getTime() / 1000).toString();
  const rawJsonPayload = stableStringifyJson(input.requestPayload);
  const payloadHash = hashWebhookPayload(rawJsonPayload);

  if (input.endpoint.status === "disabled" || input.endpoint.status === "suspended") {
    return dependencies.repository.createDelivery({
      id: deliveryId,
      organizationId: input.context.organizationId,
      webhookEndpointId: input.endpoint.id,
      eventType: input.requestPayload.type as WebhookEventType,
      status: "skipped",
      attemptNumber: input.attemptNumber,
      maxAttempts: input.maxAttempts,
      requestUrl: input.endpoint.url,
      requestMethod: "POST",
      requestHeadersRedacted: {},
      requestPayload: input.requestPayload,
      payloadHash,
      signatureHeader: null,
      responseStatus: null,
      responseHeadersRedacted: {},
      responseBodyPreview: null,
      responseTimeMs: null,
      errorCode: "WEBHOOK_ENDPOINT_DISABLED",
      errorMessageSafe:
        "Webhook endpoint is disabled or suspended, so this sandbox delivery was skipped.",
      nextRetryAt: null,
      deliveredAt: null,
      createdBy: input.context.userId,
      accessToken: input.context.accessToken
    });
  }

  try {
    await validateWebhookDeliveryUrl(input.endpoint.url, {
      resolver: dependencies.resolver
    });
  } catch (error) {
    return dependencies.repository.createDelivery({
      id: deliveryId,
      organizationId: input.context.organizationId,
      webhookEndpointId: input.endpoint.id,
      eventType: input.requestPayload.type as WebhookEventType,
      status: "blocked",
      attemptNumber: input.attemptNumber,
      maxAttempts: input.maxAttempts,
      requestUrl: input.endpoint.url,
      requestMethod: "POST",
      requestHeadersRedacted: {},
      requestPayload: input.requestPayload,
      payloadHash,
      signatureHeader: null,
      responseStatus: null,
      responseHeadersRedacted: {},
      responseBodyPreview: null,
      responseTimeMs: null,
      errorCode: getErrorCode(error, "WEBHOOK_URL_BLOCKED"),
      errorMessageSafe: safeErrorMessage(error),
      nextRetryAt: null,
      deliveredAt: null,
      createdBy: input.context.userId,
      accessToken: input.context.accessToken
    });
  }

  const signingSecret = decryptWebhookSigningSecret({
    encrypted: input.endpoint.signingSecretEncrypted,
    iv: input.endpoint.signingSecretIv,
    tag: input.endpoint.signingSecretTag
  });
  const signature = signWebhookPayload({
    deliveryId,
    timestamp,
    rawJsonPayload,
    signingSecret
  });
  const requestHeaders = {
    "content-type": "application/json",
    "user-agent": "Invoice-Lantern-Webhook-Simulator/1.0",
    "Invoice-Lantern-Webhook-Id": deliveryId,
    "Invoice-Lantern-Webhook-Timestamp": timestamp,
    "Invoice-Lantern-Webhook-Signature": signature,
    "Invoice-Lantern-Webhook-Event": String(input.requestPayload.type)
  };
  const startedAt = performance.now();

  try {
    const response = await dependencies.fetchImplementation(input.endpoint.url, {
      method: "POST",
      headers: requestHeaders,
      body: rawJsonPayload,
      redirect: "manual",
      signal: AbortSignal.timeout(env.WEBHOOK_DELIVERY_TIMEOUT_MS)
    });
    const responseTimeMs = Math.max(0, Math.round(performance.now() - startedAt));
    const responseBodyPreview = await readResponsePreview(
      response,
      env.WEBHOOK_MAX_RESPONSE_BYTES
    );
    const redirected = response.status >= 300 && response.status < 400;
    const delivered = response.status >= 200 && response.status < 300;
    const status: WebhookDeliveryStatus = delivered ? "delivered" : "failed";

    return dependencies.repository.createDelivery({
      id: deliveryId,
      organizationId: input.context.organizationId,
      webhookEndpointId: input.endpoint.id,
      eventType: input.requestPayload.type as WebhookEventType,
      status,
      attemptNumber: input.attemptNumber,
      maxAttempts: input.maxAttempts,
      requestUrl: input.endpoint.url,
      requestMethod: "POST",
      requestHeadersRedacted: redactWebhookHeaders(requestHeaders),
      requestPayload: input.requestPayload,
      payloadHash,
      signatureHeader: "v1=redacted",
      responseStatus: response.status,
      responseHeadersRedacted: redactWebhookHeaders(response.headers),
      responseBodyPreview,
      responseTimeMs,
      errorCode: delivered
        ? null
        : redirected
          ? "WEBHOOK_REDIRECT_BLOCKED"
          : "WEBHOOK_HTTP_STATUS_FAILED",
      errorMessageSafe: delivered
        ? null
        : redirected
          ? "Webhook redirects are not followed by the simulator."
          : "Webhook endpoint returned a non-2xx response.",
      nextRetryAt:
        delivered || input.attemptNumber >= input.maxAttempts
          ? null
          : new Date(dependencies.now().getTime() + 5 * 60 * 1000).toISOString(),
      deliveredAt: delivered ? dependencies.now().toISOString() : null,
      createdBy: input.context.userId,
      accessToken: input.context.accessToken
    });
  } catch (error) {
    const responseTimeMs = Math.max(0, Math.round(performance.now() - startedAt));

    return dependencies.repository.createDelivery({
      id: deliveryId,
      organizationId: input.context.organizationId,
      webhookEndpointId: input.endpoint.id,
      eventType: input.requestPayload.type as WebhookEventType,
      status: "failed",
      attemptNumber: input.attemptNumber,
      maxAttempts: input.maxAttempts,
      requestUrl: input.endpoint.url,
      requestMethod: "POST",
      requestHeadersRedacted: redactWebhookHeaders(requestHeaders),
      requestPayload: input.requestPayload,
      payloadHash,
      signatureHeader: "v1=redacted",
      responseStatus: null,
      responseHeadersRedacted: {},
      responseBodyPreview: null,
      responseTimeMs,
      errorCode: getErrorCode(error, "WEBHOOK_DELIVERY_FAILED"),
      errorMessageSafe: safeErrorMessage(error),
      nextRetryAt:
        input.attemptNumber >= input.maxAttempts
          ? null
          : new Date(dependencies.now().getTime() + 5 * 60 * 1000).toISOString(),
      deliveredAt: null,
      createdBy: input.context.userId,
      accessToken: input.context.accessToken
    });
  }
}

function getDependencies(): Required<WebhookDeliveryDependencies> {
  return {
    repository: dependenciesForTesting?.repository ?? getWebhookRepository(),
    fetchImplementation:
      dependenciesForTesting?.fetchImplementation ?? globalThis.fetch,
    resolver: dependenciesForTesting?.resolver ?? undefinedResolver,
    now: dependenciesForTesting?.now ?? (() => new Date())
  };
}

async function undefinedResolver(hostname: string) {
  const safeUrl = await validateWebhookDeliveryUrl(`https://${hostname}`);

  return safeUrl.resolvedAddresses;
}

async function getEndpointOrThrow(input: WorkspaceWebhookContext & {
  endpointId: string;
}) {
  const endpoint = await getDependencies().repository.getEndpoint(input);

  if (!endpoint) {
    throw notFoundError("Webhook endpoint");
  }

  return endpoint;
}

function assertEndpointAcceptsEvent(
  endpoint: WebhookEndpointRecord,
  eventType: WebhookEventType
) {
  if (!endpoint.eventTypes.includes(eventType)) {
    throw new WebhookServiceError({
      code: "WEBHOOK_EVENT_TYPE_NOT_ENABLED",
      message: "This webhook endpoint is not configured for the requested sandbox event type.",
      statusCode: 409
    });
  }
}

function assertEndpointCanDeliver(endpoint: WebhookEndpointRecord) {
  if (endpoint.status === "disabled" || endpoint.status === "suspended") {
    throw new WebhookServiceError({
      code: "WEBHOOK_ENDPOINT_NOT_DELIVERABLE",
      message: "This webhook endpoint is disabled or suspended.",
      statusCode: 409
    });
  }
}

function serializeEndpoint(endpoint: WebhookEndpointRecord) {
  return {
    id: endpoint.id,
    organizationId: endpoint.organizationId,
    name: endpoint.name,
    url: endpoint.url,
    status: endpoint.status,
    eventTypes: endpoint.eventTypes,
    description: endpoint.description,
    signingSecretLast4: endpoint.signingSecretLast4,
    signingSecretKeyId: endpoint.signingSecretKeyId,
    lastDeliveryAt: endpoint.lastDeliveryAt,
    lastSuccessAt: endpoint.lastSuccessAt,
    lastFailureAt: endpoint.lastFailureAt,
    failureCount: endpoint.failureCount,
    createdBy: endpoint.createdBy,
    updatedBy: endpoint.updatedBy,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
    disabledAt: endpoint.disabledAt
  };
}

function serializeDelivery(delivery: WebhookDeliveryRecord) {
  return {
    id: delivery.id,
    organizationId: delivery.organizationId,
    webhookEndpointId: delivery.webhookEndpointId,
    eventType: delivery.eventType,
    status: delivery.status,
    attemptNumber: delivery.attemptNumber,
    maxAttempts: delivery.maxAttempts,
    requestUrl: delivery.requestUrl,
    requestMethod: delivery.requestMethod,
    requestHeadersRedacted: delivery.requestHeadersRedacted,
    requestPayload: delivery.requestPayload,
    payloadHash: delivery.payloadHash,
    signatureHeaderPresent: Boolean(delivery.signatureHeader),
    responseStatus: delivery.responseStatus,
    responseHeadersRedacted: delivery.responseHeadersRedacted,
    responseBodyPreview: delivery.responseBodyPreview,
    responseTimeMs: delivery.responseTimeMs,
    errorCode: delivery.errorCode,
    errorMessageSafe: delivery.errorMessageSafe,
    nextRetryAt: delivery.nextRetryAt,
    deliveredAt: delivery.deliveredAt,
    createdBy: delivery.createdBy,
    createdAt: delivery.createdAt
  };
}

function mapEncryptedSecretUpdate(
  encryptedSecret: EncryptedWebhookSecret
) {
  return {
    signingSecretEncrypted: encryptedSecret.encrypted,
    signingSecretIv: encryptedSecret.iv,
    signingSecretTag: encryptedSecret.tag,
    signingSecretLast4: encryptedSecret.last4,
    signingSecretKeyId: encryptedSecret.keyId
  };
}

function configuredMaxAttempts() {
  return Math.min(Math.max(env.WEBHOOK_MAX_RETRY_ATTEMPTS, 1), 10);
}

function notFoundError(label: string) {
  return new WebhookServiceError({
    code: "WEBHOOK_RESOURCE_NOT_FOUND",
    message: `${label} was not found in this workspace.`,
    statusCode: 404
  });
}

function defaultEventData(eventType: WebhookEventType) {
  switch (eventType) {
    case "invoice.validation.completed":
      return {
        invoiceId: "inv_test_8f35",
        validationRunId: "valrun_test_4d21",
        status: "completed",
        findingCounts: {
          info: 1,
          warning: 1,
          error: 0
        }
      };
    case "invoice.ubl.exported":
      return {
        invoiceId: "inv_test_8f35",
        exportId: "ubl_export_test_31af",
        format: "UBL",
        profile: "Peppol-style sandbox profile",
        rawXmlIncluded: false
      };
    case "xml.validation.completed":
      return {
        xmlValidationJobId: "xmljob_test_0bc2",
        status: "completed",
        xsdStatus: "passed",
        schematronStatus: "not_configured"
      };
    case "vat.vies.checked":
      return {
        vatCheckId: "vies_test_a19d",
        countryCode: "DE",
        status: "valid",
        evidenceMode: "sandbox-example",
        rawSoapIncluded: false
      };
    case "vida.simulation.completed":
      return {
        simulationRunId: "vida_test_7782",
        readinessStatus: "needs_more_invoice_data",
        confidence: "professional_review_required",
        officialFiling: false
      };
    case "country_pack.review_required":
      return {
        countryCode: "DE",
        countryPackVersion: "2026.05.1",
        reviewReason: "Source-linked rule update should be reviewed before operational use."
      };
    case "webhook.test":
    default:
      return {
        message: "This is a signed sandbox webhook test event.",
        sequence: 1
      };
  }
}

async function readResponsePreview(response: Response, maxBytes: number) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (totalBytes < maxBytes) {
    const { value, done } = await reader.read();

    if (done || !value) {
      break;
    }

    const remaining = maxBytes - totalBytes;
    const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
    chunks.push(chunk);
    totalBytes += chunk.byteLength;

    if (value.byteLength > remaining) {
      await reader.cancel();
      break;
    }
  }

  return sanitizePreview(new TextDecoder().decode(concatChunks(chunks)));
}

function concatChunks(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combined;
}

function redactHeaderValue(key: string, value: string) {
  if (
    /authorization|cookie|set-cookie|api[-_]?key|secret|token|password|signature/i.test(
      key
    )
  ) {
    return "redacted";
  }

  return value.slice(0, 500);
}

function sanitizePreview(value: string) {
  return value
    .replace(/<\s*(\?xml|invoice|creditnote|soap|env:envelope|soapenv:envelope)[^>]*>/gi, "[redacted-xml]")
    .replace(/(service[-_]?role|api[-_]?key|secret|token|password)\s*[:=]\s*["']?[^"',\s<]+/gi, "$1=redacted")
    .slice(0, env.WEBHOOK_MAX_RESPONSE_BYTES);
}

function getErrorCode(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;

    if (typeof code === "string") {
      return code;
    }
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return "WEBHOOK_DELIVERY_TIMEOUT";
  }

  return fallback;
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return sanitizePreview(error.message).slice(0, 500);
  }

  return "Webhook simulator could not complete this bounded sandbox delivery.";
}
