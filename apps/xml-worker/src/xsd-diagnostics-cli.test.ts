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

async function runXsdDiagnosticsCli() {
  const childEnv = {
    ...process.env
  };

  delete childEnv.UBL_XSD_ROOT_DIR;
  delete childEnv.UBL_INVOICE_XSD_PATH;
  delete childEnv.UBL_CREDIT_NOTE_XSD_PATH;
  delete childEnv.UBL_XSD_ARTIFACT_VERSION;

  return new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [getTsxCliPath(), "src/index.ts", "xsd-diagnostics"],
      {
        cwd: getWorkerRoot(),
        env: childEnv,
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
  const result = await runXsdDiagnosticsCli();

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
