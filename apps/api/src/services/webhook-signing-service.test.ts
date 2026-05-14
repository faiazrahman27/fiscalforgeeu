import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { env } from "../config/env.js";
import {
  WebhookSigningError,
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
  generateWebhookSigningSecret,
  signWebhookPayload,
  stableStringifyJson,
  verifyWebhookPayloadSignature
} from "./webhook-signing-service.js";

const originalEncryptionKey = env.WEBHOOK_SECRET_ENCRYPTION_KEY;

afterEach(() => {
  env.WEBHOOK_SECRET_ENCRYPTION_KEY = originalEncryptionKey;
});

test("webhook HMAC signatures are deterministic and verifiable", () => {
  const payload = stableStringifyJson({
    z: "last",
    a: {
      b: 1
    }
  });
  const signature = signWebhookPayload({
    deliveryId: "00000000-0000-4000-8000-000000000001",
    timestamp: "1778755200",
    rawJsonPayload: payload,
    signingSecret: "whsec_test_secret"
  });

  assert.match(signature, /^v1=[a-f0-9]{64}$/);
  assert.equal(
    verifyWebhookPayloadSignature({
      deliveryId: "00000000-0000-4000-8000-000000000001",
      timestamp: "1778755200",
      rawJsonPayload: payload,
      signingSecret: "whsec_test_secret",
      signatureHeader: signature
    }),
    true
  );
  assert.equal(
    verifyWebhookPayloadSignature({
      deliveryId: "00000000-0000-4000-8000-000000000001",
      timestamp: "1778755200",
      rawJsonPayload: payload,
      signingSecret: "wrong_secret",
      signatureHeader: signature
    }),
    false
  );
});

test("webhook signing secrets are generated, encrypted, and decryptable", () => {
  const rawSecret = generateWebhookSigningSecret();
  const encrypted = encryptWebhookSigningSecret(rawSecret);

  assert.match(rawSecret, /^whsec_[A-Za-z0-9_-]+$/);
  assert.notEqual(encrypted.encrypted, rawSecret);
  assert.equal(encrypted.last4, rawSecret.slice(-4));
  assert.equal(decryptWebhookSigningSecret(encrypted), rawSecret);
});

test("missing webhook encryption config fails safely", () => {
  env.WEBHOOK_SECRET_ENCRYPTION_KEY = "";

  assert.throws(
    () => encryptWebhookSigningSecret("whsec_example"),
    (error) =>
      error instanceof WebhookSigningError &&
      error.code === "WEBHOOK_SECRET_ENCRYPTION_KEY_MISSING"
  );
});
