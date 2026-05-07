import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildSafeUblXsdArtifactDiagnostics,
  readUblXsdArtifactConfigFromEnv
} from "@invoice-lantern/ubl";
import { createXmlValidationQueueRepositoryFromEnv } from "./queue-repositories.js";
import { runXmlValidationQueueOnce } from "./queue-runner.js";
import { runStubXmlValidator } from "./stub-validator.js";
import {
  cleanupTransientXmlPayloads,
  DEFAULT_TRANSIENT_XML_PAYLOAD_MAX_BYTES,
  DEFAULT_TRANSIENT_XML_PAYLOAD_TTL_SECONDS,
  getDefaultTransientXmlPayloadRootDir
} from "./transient-xml-payload-store.js";
import type { XmlWorkerCheck } from "./worker-types.js";

const allowedChecks = new Set<XmlWorkerCheck>([
  "worker_readiness",
  "xsd_ubl",
  "schematron_peppol_placeholder"
]);

function normalizeChecks(rawValue: string | undefined): XmlWorkerCheck[] {
  if (!rawValue) {
    return ["worker_readiness"];
  }

  const checks = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is XmlWorkerCheck =>
      allowedChecks.has(item as XmlWorkerCheck)
    );

  return checks.length > 0 ? [...new Set(checks)] : ["worker_readiness"];
}

type QueueRunnerCliStorage = "auto" | "local" | "supabase";

function readCliOption(args: readonly string[], optionName: string) {
  const optionPrefix = `${optionName}=`;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (arg === optionName) {
      return args[index + 1];
    }

    if (arg.startsWith(optionPrefix)) {
      return arg.slice(optionPrefix.length);
    }
  }

  return undefined;
}

function normalizeStorage(value: string | undefined): QueueRunnerCliStorage {
  if (value === "local" || value === "supabase") {
    return value;
  }

  return "auto";
}

function getMonorepoRootFromCwd() {
  const cwd = process.cwd();
  const baseName = path.basename(cwd);

  if (baseName === "api" || baseName === "xml-worker" || baseName === "web") {
    return path.resolve(cwd, "..", "..");
  }

  if (baseName === "apps") {
    return path.resolve(cwd, "..");
  }

  return cwd;
}

function getDefaultXmlValidationJobDataDir() {
  return path.join(getMonorepoRootFromCwd(), "apps", "api", ".data");
}

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

async function runQueueOnce(args: readonly string[]) {
  const storage = normalizeStorage(readCliOption(args, "--storage"));
  const dataDir =
    readCliOption(args, "--data-dir") ??
    process.env.XML_VALIDATION_JOB_DATA_DIR?.trim() ??
    getDefaultXmlValidationJobDataDir();
  const organizationId = readCliOption(args, "--organization-id");
  const transientPayloadRootDir =
    readCliOption(args, "--payload-dir") ?? getDefaultTransientXmlPayloadRootDir();
  const transientPayloadMaxBytes = normalizePositiveInteger(
    process.env.API_BODY_LIMIT_BYTES,
    DEFAULT_TRANSIENT_XML_PAYLOAD_MAX_BYTES
  );
  const transientPayloadTtlSeconds = normalizePositiveInteger(
    process.env.XML_TRANSIENT_PAYLOAD_TTL_SECONDS,
    DEFAULT_TRANSIENT_XML_PAYLOAD_TTL_SECONDS
  );
  const queueRepository = createXmlValidationQueueRepositoryFromEnv({
    env: process.env,
    dataDir,
    storage,
    ...(organizationId ? { organizationId } : {})
  });
  const result = await runXmlValidationQueueOnce({
    repository: queueRepository.repository,
    transientPayloadStore: {
      rootDir: transientPayloadRootDir,
      maxBytes: transientPayloadMaxBytes,
      cleanupTtlSeconds: transientPayloadTtlSeconds
    }
  });

  console.log(
    JSON.stringify(
      {
        ...result,
        ...(organizationId ? { organizationId } : {})
      },
      null,
      2
    )
  );
}

async function runCleanup(args: readonly string[]) {
  const transientPayloadRootDir =
    readCliOption(args, "--payload-dir") ?? getDefaultTransientXmlPayloadRootDir();
  const ttlSeconds = normalizePositiveInteger(
    readCliOption(args, "--ttl-seconds") ??
      process.env.XML_TRANSIENT_PAYLOAD_TTL_SECONDS,
    DEFAULT_TRANSIENT_XML_PAYLOAD_TTL_SECONDS
  );
  const cleanup = await cleanupTransientXmlPayloads({
    rootDir: transientPayloadRootDir,
    ttlSeconds
  });

  console.log(
    JSON.stringify(
      {
        status: "cleanup_completed",
        workerName: "invoice-lantern-xml-worker",
        workerVersion: "0.2.0",
        cleanup
      },
      null,
      2
    )
  );
}

async function runXsdDiagnostics() {
  const diagnostics = await buildSafeUblXsdArtifactDiagnostics(
    readUblXsdArtifactConfigFromEnv(process.env)
  );

  console.log(JSON.stringify(diagnostics, null, 2));
}

async function main() {
  const [, , commandOrXmlPath, rawChecks] = process.argv;

  if (commandOrXmlPath === "run-once") {
    await runQueueOnce(process.argv.slice(3));
    return;
  }

  if (commandOrXmlPath === "cleanup") {
    await runCleanup(process.argv.slice(3));
    return;
  }

  if (
    commandOrXmlPath === "xsd-diagnostics" ||
    commandOrXmlPath === "xsd:diagnostics"
  ) {
    await runXsdDiagnostics();
    return;
  }

  if (!commandOrXmlPath) {
    console.log(
      "XML worker foundation is ready. Pass an XML file path to run the local validator. Supported checks: worker_readiness, xsd_ubl, schematron_peppol_placeholder."
    );
    return;
  }

  const xml = await readFile(commandOrXmlPath, "utf8");
  const result = await runStubXmlValidator({
    xml,
    requestedChecks: normalizeChecks(rawChecks)
  });

  console.log(JSON.stringify(result, null, 2));
}

try {
  await main();
} catch {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        errorCode: "XML_WORKER_CLI_ERROR",
        message:
          "The XML worker command could not complete safely. No raw XML was stored or printed."
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}
