import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WebhookUrlSafetyError,
  isBlockedAddress,
  validateWebhookDeliveryUrl,
  type WebhookDnsResolver
} from "./webhook-url-safety.js";

const publicResolver: WebhookDnsResolver = async () => [
  {
    address: "93.184.216.34",
    family: 4
  }
];

test("webhook URL safety allows public HTTPS endpoints", async () => {
  const result = await validateWebhookDeliveryUrl("https://example.com/hook", {
    resolver: publicResolver
  });

  assert.equal(result.normalizedUrl, "https://example.com/hook");
});

test("webhook URL safety rejects non-http schemes, credentials, and HTTP public URLs", async () => {
  await assert.rejects(
    validateWebhookDeliveryUrl("file:///tmp/hook", {
      resolver: publicResolver
    }),
    (error) =>
      error instanceof WebhookUrlSafetyError &&
      error.code === "WEBHOOK_URL_SCHEME_BLOCKED"
  );

  await assert.rejects(
    validateWebhookDeliveryUrl("https://user:pass@example.com/hook", {
      resolver: publicResolver
    }),
    (error) =>
      error instanceof WebhookUrlSafetyError &&
      error.code === "WEBHOOK_URL_CREDENTIALS_BLOCKED"
  );

  await assert.rejects(
    validateWebhookDeliveryUrl("http://example.com/hook", {
      resolver: publicResolver
    }),
    (error) =>
      error instanceof WebhookUrlSafetyError &&
      error.code === "WEBHOOK_URL_HTTPS_REQUIRED"
  );
});

test("webhook URL safety blocks private, link-local, metadata, and reserved addresses", async () => {
  const blockedResolvers: WebhookDnsResolver[] = [
    async () => [{ address: "127.0.0.1", family: 4 }],
    async () => [{ address: "10.0.0.12", family: 4 }],
    async () => [{ address: "172.16.0.20", family: 4 }],
    async () => [{ address: "192.168.1.5", family: 4 }],
    async () => [{ address: "169.254.169.254", family: 4 }],
    async () => [{ address: "198.51.100.10", family: 4 }],
    async () => [{ address: "203.0.113.10", family: 4 }],
    async () => [{ address: "0.0.0.0", family: 4 }],
    async () => [{ address: "fc00::1", family: 6 }],
    async () => [{ address: "2001:db8::1", family: 6 }],
    async () => [{ address: "fe80::1", family: 6 }]
  ];

  for (const resolver of blockedResolvers) {
    await assert.rejects(
      validateWebhookDeliveryUrl("https://example.com/hook", {
        resolver,
        allowLocalhost: false
      }),
      (error) =>
        error instanceof WebhookUrlSafetyError &&
        error.code === "WEBHOOK_URL_PRIVATE_ADDRESS_BLOCKED"
    );
  }

  assert.equal(isBlockedAddress("169.254.169.254"), true);
  assert.equal(isBlockedAddress("93.184.216.34"), false);
});

test("webhook URL safety only allows localhost when explicitly enabled", async () => {
  await assert.rejects(
    validateWebhookDeliveryUrl("http://localhost:8787/hook", {
      allowLocalhost: false
    }),
    (error) =>
      error instanceof WebhookUrlSafetyError &&
      error.code === "WEBHOOK_URL_HTTPS_REQUIRED"
  );

  const result = await validateWebhookDeliveryUrl("http://localhost:8787/hook", {
    allowLocalhost: true
  });

  assert.equal(result.normalizedUrl, "http://localhost:8787/hook");
});
