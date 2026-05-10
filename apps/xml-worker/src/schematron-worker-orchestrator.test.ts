import assert from "node:assert/strict";
import { test } from "node:test";
import {
  XML_WORKER_SCHEMATRON_ORCHESTRATOR_VERSION,
  normalizeXmlWorkerSchematronMode,
  runXmlWorkerSchematronOrchestration
} from "./schematron-worker-orchestrator.js";

const rawXmlSentinel = "<Invoice><ID>WORKER-SECRET</ID></Invoice>";
const tinyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <ID>INV-WORKER-SCHEMATRON-58</ID>
</Invoice>`;
const windowsAbsolutePath = "D:\\secret\\file.sch";
const unixAbsolutePath = "/home/user/secret.sch";
const fileUrl = "file:///secret/file.sch";
const forbiddenClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

function assertNoRawXml(output: unknown) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(rawXmlSentinel), false);
  assert.equal(serialized.includes("WORKER-SECRET"), false);
  assert.equal(serialized.includes("<Invoice"), false);
  assert.equal(serialized.includes("<ID>"), false);
  assert.equal(serialized.includes("</Invoice>"), false);
}

function assertNoUnsafePaths(output: unknown) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(windowsAbsolutePath), false);
  assert.equal(serialized.includes(unixAbsolutePath), false);
  assert.equal(serialized.includes(fileUrl), false);
  assert.doesNotMatch(serialized, /[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/home\/user\/[A-Za-z0-9_.-]+/);
  assert.doesNotMatch(serialized, /file:\/\/\//i);
}

function assertNoForbiddenClaims(output: unknown) {
  assert.doesNotMatch(JSON.stringify(output), forbiddenClaimPattern);
}

function withCleanSchematronEnv<T>(callback: () => Promise<T>) {
  const originalEnv = {
    PEPPOL_SCHEMATRON_ROOT_DIR: process.env.PEPPOL_SCHEMATRON_ROOT_DIR,
    PEPPOL_BIS_SCHEMATRON_PATH: process.env.PEPPOL_BIS_SCHEMATRON_PATH,
    EN16931_SCHEMATRON_PATH: process.env.EN16931_SCHEMATRON_PATH,
    SCHEMATRON_ARTIFACT_VERSION: process.env.SCHEMATRON_ARTIFACT_VERSION,
    SCHEMATRON_EXECUTION_MODE: process.env.SCHEMATRON_EXECUTION_MODE,
    SCHEMATRON_ENGINE: process.env.SCHEMATRON_ENGINE,
    SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION:
      process.env.SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION
  };

  for (const key of Object.keys(originalEnv)) {
    delete process.env[key];
  }

  return callback().finally(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

test("worker Schematron mode normalization defaults unknown values to disabled", () => {
  assert.equal(normalizeXmlWorkerSchematronMode(undefined), "disabled");
  assert.equal(normalizeXmlWorkerSchematronMode("disabled"), "disabled");
  assert.equal(
    normalizeXmlWorkerSchematronMode("preflight_only"),
    "preflight_only"
  );
  assert.equal(
    normalizeXmlWorkerSchematronMode("internal_test_only"),
    "internal_test_only"
  );
  assert.equal(normalizeXmlWorkerSchematronMode("production"), "disabled");
});

test("worker Schematron orchestration returns not_requested without findings", async () => {
  const result = await runXmlWorkerSchematronOrchestration({
    xml: rawXmlSentinel,
    requestedChecks: ["worker_readiness"],
    mode: "preflight_only"
  });

  assert.equal(
    result.workerSchematronOrchestratorVersion,
    XML_WORKER_SCHEMATRON_ORCHESTRATOR_VERSION
  );
  assert.equal(result.status, "not_requested");
  assert.equal(result.requested, false);
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.deepEqual(result.findings, []);
  assert.equal(result.safeSummary.findingCount, 0);
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("worker Schematron orchestration defaults requested mode to disabled", async () => {
  const result = await runXmlWorkerSchematronOrchestration({
    xml: rawXmlSentinel,
    requestedChecks: ["schematron_peppol_placeholder"]
  });

  assert.equal(result.status, "disabled");
  assert.equal(result.mode, "disabled");
  assert.equal(result.requested, true);
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.deepEqual(result.findings, []);
  assert.equal(result.safeSummary.orchestrator, undefined);
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("worker Schematron orchestration preflight calls package orchestrator safely", async () => {
  await withCleanSchematronEnv(async () => {
    const result = await runXmlWorkerSchematronOrchestration({
      xml: rawXmlSentinel,
      requestedChecks: ["schematron_peppol_placeholder"],
      mode: "preflight_only"
    });
    const orchestrator = result.safeSummary.orchestrator as Record<
      string,
      unknown
    >;

    assert.equal(result.mode, "preflight_only");
    assert.equal(result.status, "not_configured");
    assert.equal(result.validationExecutionEnabled, false);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(
      orchestrator.orchestratorVersion,
      "schematron_execution_orchestrator_v1"
    );
    assert.equal(
      orchestrator.diagnosticKind,
      "schematron_execution_orchestrator"
    );
    assert.equal(orchestrator.mode, "preflight_only");
    assert.equal(orchestrator.validationExecutionEnabled, false);
    assert.equal(orchestrator.validationExecuted, false);
    assertNoRawXml(result);
    assertNoForbiddenClaims(result);
  });
});

test("worker Schematron preflight recognizes xpath_engine metadata without executing normal jobs", async () => {
  await withCleanSchematronEnv(async () => {
    process.env.SCHEMATRON_ENGINE = "xpath_engine";

    const result = await runXmlWorkerSchematronOrchestration({
      xml: rawXmlSentinel,
      requestedChecks: ["schematron_peppol_placeholder"],
      mode: "preflight_only"
    });
    const orchestrator = result.safeSummary.orchestrator as Record<
      string,
      unknown
    >;

    assert.equal(result.mode, "preflight_only");
    assert.equal(result.status, "not_configured");
    assert.equal(result.validationExecutionEnabled, false);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(orchestrator.validationExecutionEnabled, false);
    assert.equal(orchestrator.validationExecuted, false);
    assertNoRawXml(result);
    assertNoForbiddenClaims(result);
  });
});

test("worker Schematron internal test-only mode is blocked unless explicitly allowed", async () => {
  const result = await runXmlWorkerSchematronOrchestration({
    xml: rawXmlSentinel,
    requestedChecks: ["schematron_peppol_placeholder"],
    mode: "internal_test_only",
    allowInternalTestExecution: false
  });

  assert.equal(result.status, "unsupported");
  assert.equal(
    result.reason,
    "xml_worker_schematron_internal_execution_not_allowed"
  );
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.deepEqual(result.findings, []);
  assert.equal(result.safeSummary.orchestrator, undefined);
  assertNoRawXml(result);
});

test("worker Schematron internal test-only mode can map safe test SVRL data", async () => {
  await withCleanSchematronEnv(async () => {
    const result = await runXmlWorkerSchematronOrchestration({
      xml: tinyXml,
      requestedChecks: ["schematron_peppol_placeholder"],
      mode: "internal_test_only",
      allowInternalTestExecution: true,
      peppolSvrlResults: [
        {
          kind: "failed_assert",
          id: "PEPPOL-EN16931-R001",
          businessRuleId: "BR-CO-10",
          flag: "fatal",
          location: "/Invoice/cbc:ID",
          test: "normalize-space(cbc:ID) != ''",
          text: "BR-CO-10 failed because the document identifier is missing."
        }
      ],
      en16931SvrlResults: [
        {
          kind: "successful_report",
          id: "EN16931-REPORT-R001",
          flag: "warning",
          location: "/Invoice",
          test: "true()",
          text: "A Schematron report item was emitted."
        }
      ]
    });

    assert.equal(result.status, "failed");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, false);
    assert.equal(result.safeSummary.findingCount, 2);
    assert.equal(
      result.findings.some(
        (finding) => finding.code === "PEPPOL_SCHEMATRON_RULE_FAILED"
      ),
      true
    );
    assert.equal(
      result.findings.some(
        (finding) => finding.code === "SCHEMATRON_REPORT_WARNING"
      ),
      true
    );
    assertNoRawXml(result);
    assertNoForbiddenClaims(result);
  });
});

test("worker Schematron orchestration sanitizes paths and file URLs from mapped results", async () => {
  const result = await runXmlWorkerSchematronOrchestration({
    xml: tinyXml,
    requestedChecks: ["schematron_peppol_placeholder"],
    mode: "internal_test_only",
    allowInternalTestExecution: true,
    peppolSvrlResults: [
      {
        kind: "failed_assert",
        id: "PEPPOL-PATH-R001",
        flag: "fatal",
        location: `${windowsAbsolutePath} ${unixAbsolutePath}`,
        test: `${fileUrl} true()`,
        text: `certified compliant accepted by authority legally valid Peppol passed EN 16931 passed ${windowsAbsolutePath} ${unixAbsolutePath} ${fileUrl}`,
        diagnostics: [`diagnostic ${windowsAbsolutePath}`],
        diagnosticReference: `${unixAbsolutePath}`,
        see: fileUrl
      }
    ],
    en16931SvrlResults: []
  });

  assert.equal(result.status, "failed");
  assertNoRawXml(result);
  assertNoUnsafePaths(result);
  assertNoForbiddenClaims(result);
});

test("worker Schematron orchestration blocks unsafe XML safely", async () => {
  const unsafeXmlCases = [
    `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`,
    `<?xml version="1.0"?><Invoice><!ENTITY xxe "x"></Invoice>`,
    `<?xml version="1.0"?><Invoice SYSTEM="file:///x">WORKER-SECRET</Invoice>`,
    `<?xml version="1.0"?><Invoice PUBLIC="file:///x">WORKER-SECRET</Invoice>`,
    `<?xml version="1.0"?><?xml-stylesheet href="file:///x"?><Invoice>WORKER-SECRET</Invoice>`
  ];

  for (const xml of unsafeXmlCases) {
    const result = await runXmlWorkerSchematronOrchestration({
      xml,
      requestedChecks: ["schematron_peppol_placeholder"],
      mode: "preflight_only"
    });

    assert.equal(result.status, "unsafe_input");
    assert.equal(result.validationExecutionEnabled, false);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assertNoRawXml(result);
    assertNoUnsafePaths(result);
    assertNoForbiddenClaims(result);
  }
});
