import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import {
  buildPublicReadinessStatus,
  buildWorkspaceSecurityReadiness
} from "../services/security-readiness-service.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSafeReadinessPayload(value: unknown) {
  const serialized = JSON.stringify(value);

  assert.doesNotMatch(serialized, /il_dev_local_key_change_me_32_chars/);
  assert.doesNotMatch(serialized, /test_webhook_secret_encryption_key/i);
  assert.doesNotMatch(serialized, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(serialized, /DATABASE_URL/);
  assert.doesNotMatch(serialized, /[A-Z]:\\/);
  assert.doesNotMatch(serialized, /\/home\//);
  assert.doesNotMatch(serialized, /\/Users\//);
  assert.doesNotMatch(serialized, /<soap/i);
  assert.doesNotMatch(serialized, /<invoice/i);
}

test("public health and readiness responses are minimal and safe", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const health = await app.inject({
    method: "GET",
    url: "/health"
  });

  assert.equal(health.statusCode, 200);
  assert.equal(health.headers["cache-control"], "no-store");
  assert.match(String(health.headers["content-security-policy"]), /default-src 'none'/);
  assert.equal(health.headers["x-content-type-options"], "nosniff");
  assert.equal(health.headers["referrer-policy"], "no-referrer");
  assert.match(String(health.headers["permissions-policy"]), /camera=\(\)/);

  const healthBody = health.json();
  assert.equal(isRecord(healthBody), true);
  assert.equal((healthBody as Record<string, unknown>).status, "ok");
  assert.equal((healthBody as Record<string, unknown>).environment, undefined);
  assertSafeReadinessPayload(healthBody);

  const ready = await app.inject({
    method: "GET",
    url: "/ready"
  });

  assert.equal(ready.statusCode, 200);
  assert.equal(ready.headers["cache-control"], "no-store");
  const readyBody = ready.json();
  assert.equal(isRecord(readyBody), true);
  assert.equal((readyBody as Record<string, unknown>).environment, undefined);
  assertSafeReadinessPayload(readyBody);
});

test("workspace security readiness route is signed-user only", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/workspace/security/readiness"
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.body, /AUTH_TOKEN_REQUIRED/);
});

test("readiness service lists monitoring and incident coverage without sensitive data", () => {
  const publicReadiness = buildPublicReadinessStatus(
    new Date("2026-05-15T00:00:00.000Z")
  );
  const workspaceReadiness = buildWorkspaceSecurityReadiness({
    organizationId: "00000000-0000-4000-8000-000000000001",
    membershipRole: "owner",
    now: new Date("2026-05-15T00:00:00.000Z")
  });

  assertSafeReadinessPayload(publicReadiness);
  assertSafeReadinessPayload(workspaceReadiness);

  const metricKeys = new Set(
    workspaceReadiness.monitoringMetrics.map((metric) => metric.key)
  );

  for (const key of [
    "validation_runs_total",
    "validation_errors_by_rule",
    "ubl_exports_total",
    "xml_uploads_total",
    "xml_rejected_total",
    "xsd_validation_jobs_total",
    "schematron_jobs_total",
    "vies_checks_total",
    "vida_simulations_total",
    "api_requests_total",
    "api_errors_total",
    "rate_limit_blocks",
    "auth_failures_total",
    "webhook_delivery_total",
    "webhook_delivery_failures",
    "webhook_retry_total",
    "country_pack_usage",
    "validation_worker_timeouts",
    "retention_runs_total",
    "deletion_runs_total",
    "privacy_requests_total",
    "legal_acceptances_total",
    "admin_rule_changes_total",
    "suspicious_activity_events_total"
  ]) {
    assert.equal(metricKeys.has(key), true, `Expected metric ${key}`);
  }

  const incidentKeys = new Set(
    workspaceReadiness.incidentChecklist.map((item) => item.key)
  );

  for (const key of [
    "detect",
    "classify",
    "contain",
    "investigate",
    "notify_if_required",
    "fix",
    "document",
    "post_incident_review"
  ]) {
    assert.equal(incidentKeys.has(key), true, `Expected incident step ${key}`);
  }
});
