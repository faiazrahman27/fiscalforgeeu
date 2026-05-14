import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { DELETION_RUN_DATASETS } from "./workspace-deletion-run-repository.js";
import { redactExportRecordForTesting } from "./workspace-export-package-repository.js";
import { RETENTION_RUN_DATASETS } from "./workspace-retention-run-repository.js";

test("export redaction removes secrets, hashes, raw payloads, local paths, stack traces, and personal metadata", () => {
  const redacted = redactExportRecordForTesting({
    id: "export-test",
    service_role_key: "service-role-secret",
    database_url: "postgres://secret",
    key_hash: "hash-secret",
    signing_secret_encrypted: "encrypted-secret",
    signing_secret_iv: "secret-iv",
    signing_secret_tag: "secret-tag",
    raw_xml: "<Invoice>secret</Invoice>",
    raw_soap: "<Envelope>secret</Envelope>",
    stack_trace: "Error at C:\\secret\\file.ts",
    local_path: "C:\\secret\\invoice.xml",
    ip_address: "127.0.0.1",
    user_agent: "RawBrowser/1.0",
    signature_header: "v1=secret",
    nested: {
      private_token: "nested-secret",
      absolute_path: "/srv/secrets/file.xml"
    }
  });

  const serialized = JSON.stringify(redacted);

  assert.doesNotMatch(serialized, /service-role-secret/);
  assert.doesNotMatch(serialized, /postgres:\/\/secret/);
  assert.doesNotMatch(serialized, /hash-secret/);
  assert.doesNotMatch(serialized, /encrypted-secret|secret-iv|secret-tag/);
  assert.doesNotMatch(serialized, /<Invoice>|<Envelope>/);
  assert.doesNotMatch(serialized, /C:\\secret|\/srv\/secrets/);
  assert.doesNotMatch(serialized, /RawBrowser|127\.0\.0\.1|v1=secret/);
  assert.match(serialized, /\[redacted\]/);
  assert.match(serialized, /\[redacted_personal_metadata\]/);
});

test("retention and deletion dataset definitions cover privacy hardening scope and preserve required evidence", () => {
  const retentionTables = new Set(
    RETENTION_RUN_DATASETS.map((dataset) => dataset.tableName as string)
  );
  const deletionTables = new Set(
    DELETION_RUN_DATASETS.map((dataset) => dataset.tableName as string)
  );

  for (const tableName of [
    "api_requests",
    "webhook_deliveries",
    "vies_evidence_checks",
    "xml_validation_jobs",
    "validation_runs",
    "invoice_exports",
    "vida_simulation_runs",
    "workspace_activity_events",
    "workspace_privacy_requests",
    "legal_document_acceptances"
  ]) {
    assert.equal(retentionTables.has(tableName), true, `retention ${tableName}`);
  }

  for (const tableName of [
    "api_keys",
    "api_requests",
    "webhook_endpoints",
    "webhook_deliveries",
    "vies_evidence_checks",
    "xml_validation_jobs",
    "validation_runs",
    "invoice_exports",
    "vida_simulation_runs",
    "workspace_activity_events",
    "legal_document_acceptances",
    "workspace_privacy_audit_events"
  ]) {
    assert.equal(deletionTables.has(tableName), true, `deletion ${tableName}`);
  }

  assert.equal(
    RETENTION_RUN_DATASETS.find(
      (dataset) => dataset.tableName === "legal_document_acceptances"
    )?.preservedByDefault,
    true
  );
  assert.equal(
    DELETION_RUN_DATASETS.find((dataset) => dataset.tableName === "api_keys")
      ?.executionMode,
    "revoke"
  );
  assert.equal(
    DELETION_RUN_DATASETS.find(
      (dataset) => dataset.tableName === "webhook_endpoints"
    )?.executionMode,
    "disable_secrets"
  );
  assert.equal(
    DELETION_RUN_DATASETS.find(
      (dataset) => dataset.tableName === "legal_document_acceptances"
    )?.preservedByDefault,
    true
  );
  assert.equal(deletionTables.has("legal_documents"), false);
  assert.equal(deletionTables.has("country_pack_registry"), false);
  assert.equal(deletionTables.has("validation_rules"), false);
});

test("migration 042 keeps execution tenant-scoped, owner-admin gated, and public legal/platform datasets preserved", async () => {
  const migrationText = await readFile(
    join(
      process.cwd(),
      "..",
      "..",
      "supabase",
      "migrations",
      "042_complete_legal_privacy_retention_deletion_hardening.sql"
    ),
    "utf8"
  );

  assert.match(migrationText, /public\.can_manage_org\(target_run\.organization_id\)/);
  assert.match(migrationText, /status <> 'prepared'/);
  assert.match(migrationText, /status = 'revoked'/);
  assert.match(migrationText, /signing_secret_encrypted = null/);
  assert.match(migrationText, /legal_document_acceptances/);
  assert.match(migrationText, /legal_documents/);
  assert.match(migrationText, /country_pack_registry/);
  assert.match(migrationText, /notGdprComplianceGuarantee/);
  assert.doesNotMatch(migrationText, /delete from public\.legal_documents/i);
  assert.doesNotMatch(migrationText, /delete from public\.country_pack_registry/i);
  assert.doesNotMatch(migrationText, /delete from public\.validation_rules/i);
  assert.doesNotMatch(migrationText, /drop table/i);
});
