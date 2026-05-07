import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

function getWorkerRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function getTsxCliPath() {
  return resolve(getWorkerRoot(), "node_modules", "tsx", "dist", "cli.cjs");
}

function buildCleanDiagnosticsEnv() {
  const childEnv = {
    ...process.env
  };

  delete childEnv.UBL_XSD_ROOT_DIR;
  delete childEnv.UBL_INVOICE_XSD_PATH;
  delete childEnv.UBL_CREDIT_NOTE_XSD_PATH;
  delete childEnv.UBL_XSD_ARTIFACT_VERSION;
  delete childEnv.PEPPOL_SCHEMATRON_ROOT_DIR;
  delete childEnv.PEPPOL_BIS_SCHEMATRON_PATH;
  delete childEnv.EN16931_SCHEMATRON_PATH;
  delete childEnv.SCHEMATRON_ARTIFACT_VERSION;

  return childEnv;
}

async function runDiagnosticsCli(command: string) {
  return new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [getTsxCliPath(), "src/index.ts", command],
      {
        cwd: getWorkerRoot(),
        env: buildCleanDiagnosticsEnv(),
        windowsHide: true
      }
    );
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolvePromise({
        exitCode,
        stdout,
        stderr
      });
    });
  });
}

test("xsd diagnostics CLI prints metadata-only JSON", async () => {
  const rawXmlSentinel = "<Invoice><ID>CLI-RAW-XML-SENTINEL</ID></Invoice>";
  const schemaContentSentinel = "CLI-SCHEMA-CONTENT-SENTINEL";
  const result = await runDiagnosticsCli("xsd-diagnostics");

  assert.equal(result.exitCode, 0);

  const diagnostics = JSON.parse(result.stdout) as Record<string, unknown>;
  const invoiceSchema = diagnostics.invoiceSchema as Record<string, unknown>;
  const dependencyGraph = diagnostics.dependencyGraph as Record<string, unknown>;

  assert.equal(diagnostics.diagnosticKind, "ubl_xsd_artifacts");
  assert.equal(diagnostics.configured, false);
  assert.equal(diagnostics.usable, false);
  assert.equal(diagnostics.validatorName, "xmllint-wasm");
  assert.equal(typeof diagnostics.validatorAvailable, "boolean");
  assert.equal(invoiceSchema.status, "not_configured");
  assert.equal(invoiceSchema.sha256, null);
  assert.equal(dependencyGraph.status, "not_inspected");
  assert.match(String(diagnostics.disclaimer), /not official validation/i);
  assert.equal(result.stdout.includes(rawXmlSentinel), false);
  assert.equal(result.stdout.includes(schemaContentSentinel), false);
  assert.equal(result.stdout.includes("UBL_INVOICE_XSD_PATH="), false);
});

test("schematron diagnostics CLI prints metadata-only JSON without executing validation", async () => {
  const rawXmlSentinel = "<Invoice><ID>CLI-RAW-XML-SENTINEL</ID></Invoice>";
  const schematronContentSentinel = "CLI-SCHEMATRON-CONTENT-SENTINEL";
  const result = await runDiagnosticsCli("schematron-diagnostics");

  assert.equal(result.exitCode, 0);

  const diagnostics = JSON.parse(result.stdout) as Record<string, unknown>;
  const peppolBisArtifact = diagnostics.peppolBisArtifact as Record<
    string,
    unknown
  >;
  const en16931Artifact = diagnostics.en16931Artifact as Record<string, unknown>;

  assert.equal(diagnostics.diagnosticKind, "schematron_artifacts");
  assert.equal(diagnostics.configured, false);
  assert.equal(diagnostics.usable, false);
  assert.equal(diagnostics.readyArtifactCount, 0);
  assert.equal(diagnostics.requiredArtifactCount, 2);
  assert.equal(diagnostics.allRequiredArtifactsReadable, false);
  assert.equal(diagnostics.validatorName, "schematron-placeholder");
  assert.equal(diagnostics.validatorAvailable, false);
  assert.equal(diagnostics.validationExecutionEnabled, false);
  assert.equal(peppolBisArtifact.artifactKind, "peppol_bis_billing");
  assert.equal(peppolBisArtifact.status, "not_configured");
  assert.equal(peppolBisArtifact.sha256, null);
  assert.equal(en16931Artifact.artifactKind, "en16931_tc434");
  assert.equal(en16931Artifact.status, "not_configured");
  assert.match(String(diagnostics.disclaimer), /do not execute Schematron validation/i);
  assert.match(String(diagnostics.disclaimer), /not official validation/i);
  assert.equal(result.stdout.includes(rawXmlSentinel), false);
  assert.equal(result.stdout.includes(schematronContentSentinel), false);
  assert.equal(result.stdout.includes("PEPPOL_BIS_SCHEMATRON_PATH="), false);
  assert.equal(result.stdout.includes("EN16931_SCHEMATRON_PATH="), false);
});
