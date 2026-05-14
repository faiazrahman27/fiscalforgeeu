import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { env } from "../config/env.js";

export type EncryptedWebhookSecret = {
  encrypted: string;
  iv: string;
  tag: string;
  last4: string;
  keyId: string;
};

export type WebhookSignatureInput = {
  deliveryId: string;
  timestamp: string;
  rawJsonPayload: string;
  signingSecret: string;
};

export const WEBHOOK_SIGNATURE_VERSION = "v1";

export class WebhookSigningError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(input: { code: string; message: string; statusCode?: number }) {
    super(input.message);
    this.name = "WebhookSigningError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? 503;
  }
}

export function generateWebhookSigningSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function encryptWebhookSigningSecret(
  rawSecret: string
): EncryptedWebhookSecret {
  const encryptionKey = getWebhookSecretEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(rawSecret, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    last4: rawSecret.slice(-4),
    keyId: env.WEBHOOK_SIGNING_KEY_ID
  };
}

export function decryptWebhookSigningSecret(input: {
  encrypted: string | null;
  iv: string | null;
  tag: string | null;
}) {
  if (!input.encrypted || !input.iv || !input.tag) {
    throw new WebhookSigningError({
      code: "WEBHOOK_SIGNING_SECRET_UNAVAILABLE",
      message:
        "Webhook signing secret is unavailable. Rotate the endpoint secret before sending test events."
    });
  }

  const encryptionKey = getWebhookSecretEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(input.iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(input.tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(input.encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function signWebhookPayload(input: WebhookSignatureInput) {
  const signatureBase = buildWebhookSignatureBase(input);
  const digest = createHmac("sha256", input.signingSecret)
    .update(signatureBase, "utf8")
    .digest("hex");

  return `${WEBHOOK_SIGNATURE_VERSION}=${digest}`;
}

export function verifyWebhookPayloadSignature(input: WebhookSignatureInput & {
  signatureHeader: string;
}) {
  const expected = signWebhookPayload(input);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(input.signatureHeader, "utf8");

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function hashWebhookPayload(rawJsonPayload: string) {
  return createHash("sha256").update(rawJsonPayload, "utf8").digest("hex");
}

export function stableStringifyJson(value: unknown) {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJsonValue(child)])
  );
}

function buildWebhookSignatureBase(input: WebhookSignatureInput) {
  return `${input.timestamp}.${input.deliveryId}.${input.rawJsonPayload}`;
}

function getWebhookSecretEncryptionKey() {
  const configuredKey = env.WEBHOOK_SECRET_ENCRYPTION_KEY.trim();

  if (configuredKey.length < 32) {
    throw new WebhookSigningError({
      code: "WEBHOOK_SECRET_ENCRYPTION_KEY_MISSING",
      message:
        "Webhook signing secrets require WEBHOOK_SECRET_ENCRYPTION_KEY to be configured on the API server before endpoint creation, rotation, or delivery."
    });
  }

  return createHash("sha256").update(configuredKey, "utf8").digest();
}
