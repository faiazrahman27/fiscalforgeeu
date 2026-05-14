import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("PWA service worker keeps sensitive routes out of runtime caches", () => {
  const serviceWorker = readRepoFile("apps/web/public/sw.js");

  for (const deniedPrefix of [
    "/api/",
    "/api/local/",
    "/api/v1/",
    "/workspace",
    "/auth/callback",
    "/auth/sign-out"
  ]) {
    assert.match(serviceWorker, new RegExp(deniedPrefix.replaceAll("/", "\\/")));
  }

  assert.match(serviceWorker, /networkOnly/);
  assert.match(serviceWorker, /no-store/);
  assert.doesNotMatch(serviceWorker, /FiscalForge/i);
});

test("encrypted offline draft storage does not persist keys or plaintext fallback", () => {
  const secureStore = readRepoFile("apps/web/lib/pwa/secure-local-store.ts");
  const offlineDrafts = readRepoFile("apps/web/lib/pwa/offline-drafts.ts");
  const combined = `${secureStore}\n${offlineDrafts}`;

  assert.match(combined, /AES-GCM/);
  assert.match(combined, /PBKDF2-SHA-256/);
  assert.match(combined, /IndexedDB|indexedDB/);
  assert.match(combined, /localOnly/);
  assert.doesNotMatch(combined, /localStorage\.setItem/);
  assert.doesNotMatch(combined, /sessionStorage\.setItem/);
  assert.doesNotMatch(combined, /store.*passphrase/i);
  assert.doesNotMatch(combined, /FiscalForge/i);
});

test("PWA, monitoring, and incident readiness docs exist with required boundaries", () => {
  const docs = [
    "docs/architecture/pwa-mobile-offline-security.md",
    "docs/architecture/monitoring-security-incident-readiness.md",
    "docs/security/incident-response.md",
    "docs/security/security-readiness-checklist.md",
    "docs/security/pwa-cache-offline-policy.md"
  ].map((path) => readRepoFile(path));
  const combined = docs.join("\n");

  for (const phrase of [
    "offline capability",
    "Encrypted local drafts",
    "Cache Deny List",
    "detect",
    "Classify severity",
    "Contain",
    "Investigate",
    "Notify if required",
    "Post-incident review",
    "validation_runs_total",
    "security_events",
    "professional review"
  ]) {
    assert.match(combined, new RegExp(phrase, "i"));
  }

  assert.doesNotMatch(combined, /FiscalForge/i);
  assert.doesNotMatch(
    combined,
    /\bis official EU software\b|\bprovides official filing\b|\bguarantees uptime\b|\bis security certified\b|\bis GDPR compliant\b|\bproves compliance\b/i
  );
});
