import { z } from "zod";

export const WEBHOOK_EVENT_TYPES = [
  "invoice.validation.completed",
  "invoice.ubl.exported",
  "xml.validation.completed",
  "vat.vies.checked",
  "vida.simulation.completed",
  "country_pack.review_required",
  "webhook.test"
] as const;

export const WEBHOOK_ENDPOINT_STATUSES = [
  "active",
  "disabled",
  "failing",
  "suspended"
] as const;

export const WEBHOOK_DELIVERY_STATUSES = [
  "pending",
  "delivered",
  "failed",
  "retry_scheduled",
  "skipped",
  "blocked"
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
export type WebhookEndpointStatus = (typeof WEBHOOK_ENDPOINT_STATUSES)[number];
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export const WEBHOOK_SIMULATOR_DISCLAIMER =
  "Webhook events are signed sandbox test events for technical integration testing. They are informational only, not official filing, not authority submission, and not legal, tax, accounting, or compliance advice.";

export const webhookEventTypeSchema = z.enum(WEBHOOK_EVENT_TYPES);
export const webhookEndpointStatusSchema = z.enum(WEBHOOK_ENDPOINT_STATUSES);
export const webhookDeliveryStatusSchema = z.enum(WEBHOOK_DELIVERY_STATUSES);

const forbiddenPayloadKeyPattern =
  /(^|[_-])(api[-_]?key|secret|token|password|service[-_]?role)($|[_-])/i;

const forbiddenPayloadStringPattern =
  /<\s*(\?xml|invoice|creditnote|soap|env:envelope|soapenv:envelope|ubl:invoice|ubl:creditnote)\b/i;

export const webhookEndpointIdParamSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict();

export const webhookDeliveryIdParamSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict();

export const webhookEndpointCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    url: z.string().trim().url().min(12).max(2048),
    eventTypes: z
      .array(webhookEventTypeSchema)
      .max(16)
      .default(["webhook.test"]),
    description: z.string().trim().max(1000).optional()
  })
  .strict()
  .superRefine((value, context) => {
    ensureUniqueEventTypes(value.eventTypes, context);
  });

export const webhookEndpointUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    url: z.string().trim().url().min(12).max(2048).optional(),
    status: webhookEndpointStatusSchema.optional(),
    eventTypes: z.array(webhookEventTypeSchema).max(16).optional(),
    description: z.string().trim().max(1000).nullable().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one endpoint field must be provided."
      });
    }

    if (value.eventTypes) {
      ensureUniqueEventTypes(value.eventTypes, context);
    }
  });

export const webhookEndpointListQuerySchema = z
  .object({
    status: webhookEndpointStatusSchema.optional(),
    eventType: webhookEventTypeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
  .strict();

export const webhookDeliveryListQuerySchema = z
  .object({
    endpointId: z.string().uuid().optional(),
    status: webhookDeliveryStatusSchema.optional(),
    eventType: webhookEventTypeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
  .strict();

export const webhookTestEventSchema = z
  .object({
    eventType: webhookEventTypeSchema.default("webhook.test"),
    payload: z.record(z.string(), z.unknown()).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.payload) {
      validateSafePayload(value.payload, context);
    }
  });

export function validateSafePayload(
  value: Record<string, unknown>,
  context: z.RefinementCtx
) {
  const serialized = JSON.stringify(value);

  if (serialized.length > 12_000) {
    context.addIssue({
      code: "custom",
      path: ["payload"],
      message: "Webhook test payload must be 12 KB or smaller."
    });
  }

  inspectPayloadValue(value, context, ["payload"]);
}

function ensureUniqueEventTypes(
  eventTypes: readonly WebhookEventType[],
  context: z.RefinementCtx
) {
  if (new Set(eventTypes).size !== eventTypes.length) {
    context.addIssue({
      code: "custom",
      path: ["eventTypes"],
      message: "Webhook event types must be unique."
    });
  }
}

function inspectPayloadValue(
  value: unknown,
  context: z.RefinementCtx,
  path: (string | number)[]
) {
  if (typeof value === "string") {
    if (forbiddenPayloadStringPattern.test(value)) {
      context.addIssue({
        code: "custom",
        path,
        message:
          "Webhook test payloads must not include raw XML, SOAP, UBL, or local validation bodies."
      });
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      inspectPayloadValue(item, context, [...path, index]);
    });
    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenPayloadKeyPattern.test(key)) {
      context.addIssue({
        code: "custom",
        path: [...path, key],
        message:
          "Webhook test payloads must not include API keys, tokens, passwords, service-role values, or secrets."
      });
    }

    inspectPayloadValue(child, context, [...path, key]);
  }
}
