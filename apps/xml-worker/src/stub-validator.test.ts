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
    SCHEMATRON_ARTIFACT_VERSION: process.env.SCHEMATRON_ARTIFACT_VERSION
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
    assert.equal(schematronPeppol.configured, true);
    assert.equal(schematronPeppol.usable, true);
    assert.equal(schematronPeppol.status, "not_implemented");
    assert.equal(checkSummary.validationExecutionEnabled, false);
    assert.equal(checkSummary.validationExecuted, false);
    assert.equal(checkSummary.markedValid, false);
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
