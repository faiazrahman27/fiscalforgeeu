import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { test } from "node:test";
import { runStubXmlValidator } from "./stub-validator.js";

const simpleXml = "<Invoice><ID>WORKER-SCHEMATRON-STEP-48</ID></Invoice>";

function readObject(value: unknown, label: string): Record<string, unknown> {
  assert.equal(
    typeof value === "object" && value !== null && !Array.isArray(value),
    true,
    `${label} should be an object`
  );

  return value as Record<string, unknown>;
}

test("stub validator returns safe metadata-only Schematron placeholder diagnostics", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-worker-sch-"));
  const peppolBisPath = join(tempRoot, "peppol", "PEPPOL-BIS-Billing.sch");
  const en16931Path = join(tempRoot, "tc434", "EN16931-TC434.sch");
  const peppolSentinel = "WORKER-PEPPOL-SCHEMATRON-CONTENT-SENTINEL";
  const en16931Sentinel = "WORKER-EN16931-SCHEMATRON-CONTENT-SENTINEL";
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

  try {
    await mkdir(dirname(peppolBisPath), {
      recursive: true
    });
    await mkdir(dirname(en16931Path), {
      recursive: true
    });
    await writeFile(peppolBisPath, `<schema>${peppolSentinel}</schema>`, "utf8");
    await writeFile(en16931Path, `<schema>${en16931Sentinel}</schema>`, "utf8");

    process.env.PEPPOL_SCHEMATRON_ROOT_DIR = tempRoot;
    process.env.PEPPOL_BIS_SCHEMATRON_PATH = peppolBisPath;
    process.env.EN16931_SCHEMATRON_PATH = en16931Path;
    process.env.SCHEMATRON_ARTIFACT_VERSION = "worker-step-48-test";
    delete process.env.SCHEMATRON_EXECUTION_MODE;
    delete process.env.SCHEMATRON_ENGINE;
    delete process.env.SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION;

    const result = await runStubXmlValidator({
      xml: simpleXml,
      requestedChecks: ["schematron_peppol_placeholder"]
    });
    const schematronPeppol = readObject(
      result.resultSummary.schematronPeppol,
      "resultSummary.schematronPeppol"
    );
    const diagnostics = readObject(
      schematronPeppol.artifactDiagnostics,
      "schematronPeppol.artifactDiagnostics"
    );
    const peppolBisArtifact = readObject(
      diagnostics.peppolBisArtifact,
      "diagnostics.peppolBisArtifact"
    );
    const en16931Artifact = readObject(
      diagnostics.en16931Artifact,
      "diagnostics.en16931Artifact"
    );
    const checkResult = result.checkResults.find(
      (item) => item.checkType === "schematron_peppol_placeholder"
    );
    const checkSummary = readObject(
      checkResult?.summary,
      "schematron check summary"
    );
    const serialized = JSON.stringify(result);

    assert.equal(result.status, "completed");
    assert.deepEqual(result.completedChecks, []);
    assert.deepEqual(result.failedChecks, ["schematron_peppol_placeholder"]);
    assert.equal(checkResult?.status, "not_implemented");
    assert.equal(schematronPeppol.requested, true);
    assert.equal(schematronPeppol.implemented, false);
    assert.equal(schematronPeppol.validationExecutionEnabled, false);
    assert.equal(schematronPeppol.validationExecuted, false);
    assert.equal(schematronPeppol.markedValid, false);
    assert.equal(schematronPeppol.policyVersion, "schematron_policy_v1");
    assert.equal(schematronPeppol.policyMode, "preflight_only");
    assert.equal(
      schematronPeppol.policyReason,
      "schematron_execution_preflight_only"
    );
    assert.equal(schematronPeppol.engineId, "placeholder");
    assert.equal(schematronPeppol.executionPermitted, false);
    assert.equal(
      schematronPeppol.adapterVersion,
      "schematron_adapter_preflight_v1"
    );
    assert.equal(
      schematronPeppol.preflightStatus,
      "ready_for_future_execution"
    );
    assert.equal(
      schematronPeppol.preflightReason,
      "schematron_artifacts_ready_but_execution_not_enabled"
    );
    const executionPreflight = readObject(
      schematronPeppol.executionPreflight,
      "schematronPeppol.executionPreflight"
    );
    assert.equal(
      executionPreflight.diagnosticKind,
      "schematron_execution_preflight"
    );
    assert.equal(
      executionPreflight.adapterVersion,
      "schematron_adapter_preflight_v1"
    );
    assert.equal(executionPreflight.mode, "preflight_only");
    assert.equal(
      executionPreflight.status,
      "ready_for_future_execution"
    );
    assert.equal(
      executionPreflight.reason,
      "schematron_artifacts_ready_but_execution_not_enabled"
    );
    assert.equal(executionPreflight.validationExecutionEnabled, false);
    assert.equal(executionPreflight.validationExecuted, false);
    assert.equal(executionPreflight.markedValid, false);
    const executionPolicy = readObject(
      schematronPeppol.executionPolicy,
      "schematronPeppol.executionPolicy"
    );
    assert.equal(executionPolicy.diagnosticKind, "schematron_execution_policy");
    assert.equal(executionPolicy.policyVersion, "schematron_policy_v1");
    assert.equal(executionPolicy.mode, "preflight_only");
    assert.equal(executionPolicy.engineId, "placeholder");
    assert.equal(executionPolicy.reason, "schematron_execution_preflight_only");
    assert.equal(executionPolicy.executionPermitted, false);
    assert.equal(executionPolicy.validationExecutionEnabled, false);
    assert.equal(
      schematronPeppol.findingContractVersion,
      "schematron_contract_v1"
    );
    assert.equal(
      (schematronPeppol.supportedFutureFindingCodes as string[]).includes(
        "SCHEMATRON_EXECUTION_NOT_ENABLED"
      ),
      true
    );
    assert.equal(
      (schematronPeppol.supportedFutureFindingCodes as string[]).includes(
        "SCHEMATRON_ASSERTION_FAILED"
      ),
      true
    );
    assert.equal(
      (schematronPeppol.supportedFutureFindingCodes as string[]).includes(
        "PEPPOL_SCHEMATRON_RULE_FAILED"
      ),
      true
    );
    assert.equal(
      (schematronPeppol.supportedFutureFindingCodes as string[]).includes(
        "EN16931_SCHEMATRON_RULE_FAILED"
      ),
      true
    );
    assert.equal(schematronPeppol.configured, true);
    assert.equal(schematronPeppol.usable, true);
    assert.equal(schematronPeppol.status, "not_implemented");
    assert.equal(checkSummary.validationExecutionEnabled, false);
    assert.equal(checkSummary.validationExecuted, false);
    assert.equal(checkSummary.markedValid, false);
    assert.equal(checkSummary.policyVersion, "schematron_policy_v1");
    assert.equal(checkSummary.policyMode, "preflight_only");
    assert.equal(
      checkSummary.policyReason,
      "schematron_execution_preflight_only"
    );
    assert.equal(checkSummary.engineId, "placeholder");
    assert.equal(checkSummary.executionPermitted, false);
    assert.equal(
      checkSummary.adapterVersion,
      "schematron_adapter_preflight_v1"
    );
    assert.equal(
      checkSummary.preflightStatus,
      "ready_for_future_execution"
    );
    assert.equal(
      checkSummary.preflightReason,
      "schematron_artifacts_ready_but_execution_not_enabled"
    );
    assert.deepEqual(checkSummary.executionPreflight, executionPreflight);
    assert.deepEqual(checkSummary.executionPolicy, executionPolicy);
    assert.equal(checkSummary.findingContractVersion, "schematron_contract_v1");
    assert.equal(
      (checkSummary.supportedFutureFindingCodes as string[]).includes(
        "SCHEMATRON_ASSERTION_FAILED"
      ),
      true
    );
    assert.equal(checkSummary.validatorAvailable, false);
    assert.equal(diagnostics.diagnosticKind, "schematron_artifacts");
    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.usable, true);
    assert.equal(diagnostics.readyArtifactCount, 2);
    assert.equal(diagnostics.requiredArtifactCount, 2);
    assert.equal(diagnostics.artifactVersion, "worker-step-48-test");
    assert.equal(diagnostics.validatorAvailable, false);
    assert.equal(diagnostics.validationExecutionEnabled, false);
    assert.equal(peppolBisArtifact.status, "available");
    assert.match(String(peppolBisArtifact.sha256), /^[a-f0-9]{64}$/);
    assert.equal(peppolBisArtifact.label, "peppol/PEPPOL-BIS-Billing.sch");
    assert.equal(en16931Artifact.status, "available");
    assert.match(String(en16931Artifact.sha256), /^[a-f0-9]{64}$/);
    assert.equal(en16931Artifact.label, "tc434/EN16931-TC434.sch");
    assert.equal(
      result.findings.some(
        (finding) =>
          finding.code === "PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED" &&
          finding.technicalCode === "SCHEMATRON_EXECUTION_NOT_ENABLED" &&
          finding.schematronLayer === "peppol_bis_billing" &&
          finding.status === "not_implemented"
      ),
      true
    );
    assert.equal(serialized.includes(simpleXml), false);
    assert.equal(serialized.includes("<Invoice"), false);
    assert.equal(serialized.includes(peppolSentinel), false);
    assert.equal(serialized.includes(en16931Sentinel), false);
    assert.equal(serialized.includes(peppolBisPath), false);
    assert.equal(serialized.includes(en16931Path), false);
    assert.equal(serialized.includes(basename(tempRoot)), false);
    assert.doesNotMatch(
      serialized,
      /\bSchematron passed\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bofficially valid\b|\blegally compliant\b|\baccepted by authority\b/i
    );
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("stub validator blocks execution-like Schematron policy env without execution", async () => {
  const originalEnv = {
    SCHEMATRON_EXECUTION_MODE: process.env.SCHEMATRON_EXECUTION_MODE,
    SCHEMATRON_ENGINE: process.env.SCHEMATRON_ENGINE,
    SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION:
      process.env.SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION
  };

  try {
    process.env.SCHEMATRON_EXECUTION_MODE = "production";
    process.env.SCHEMATRON_ENGINE = "saxon";
    delete process.env.SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION;

    const result = await runStubXmlValidator({
      xml: simpleXml,
      requestedChecks: ["schematron_peppol_placeholder"]
    });
    const schematronPeppol = readObject(
      result.resultSummary.schematronPeppol,
      "resultSummary.schematronPeppol"
    );
    const executionPolicy = readObject(
      schematronPeppol.executionPolicy,
      "schematronPeppol.executionPolicy"
    );
    const executionPreflight = readObject(
      schematronPeppol.executionPreflight,
      "schematronPeppol.executionPreflight"
    );
    const serialized = JSON.stringify(result);

    assert.equal(result.status, "completed");
    assert.deepEqual(result.completedChecks, []);
    assert.deepEqual(result.failedChecks, ["schematron_peppol_placeholder"]);
    assert.equal(schematronPeppol.status, "not_implemented");
    assert.equal(schematronPeppol.policyVersion, "schematron_policy_v1");
    assert.equal(schematronPeppol.policyMode, "blocked_requested_execution");
    assert.equal(
      schematronPeppol.policyReason,
      "schematron_execution_requested_but_blocked"
    );
    assert.equal(schematronPeppol.engineId, "future_xslt2");
    assert.equal(schematronPeppol.executionPermitted, false);
    assert.equal(schematronPeppol.validationExecutionEnabled, false);
    assert.equal(schematronPeppol.validationExecuted, false);
    assert.equal(schematronPeppol.markedValid, false);
    assert.equal(schematronPeppol.preflightStatus, "unsupported");
    assert.equal(
      schematronPeppol.preflightReason,
      "schematron_execution_engine_not_implemented"
    );
    assert.equal(executionPolicy.mode, "blocked_requested_execution");
    assert.equal(executionPolicy.reason, "schematron_execution_requested_but_blocked");
    assert.equal(executionPolicy.executionPermitted, false);
    assert.equal(executionPolicy.validationExecutionEnabled, false);
    assert.equal(executionPreflight.mode, "enabled");
    assert.equal(executionPreflight.status, "unsupported");
    assert.equal(executionPreflight.validationExecutionEnabled, false);
    assert.equal(executionPreflight.validationExecuted, false);
    assert.equal(executionPreflight.markedValid, false);
    assert.equal(serialized.includes(simpleXml), false);
    assert.equal(serialized.includes("<Invoice"), false);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
