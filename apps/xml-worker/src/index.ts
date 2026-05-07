import { readFile } from "node:fs/promises";
import path from "node:path";
import { createXmlValidationQueueRepositoryFromEnv } from "./queue-repositories.js";
import { runXmlValidationQueueOnce } from "./queue-runner.js";
import { runStubXmlValidator } from "./stub-validator.js";
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

async function runQueueOnce(args: readonly string[]) {
  const storage = normalizeStorage(readCliOption(args, "--storage"));
  const dataDir =
    readCliOption(args, "--data-dir") ?? path.join(process.cwd(), ".data");
  const organizationId = readCliOption(args, "--organization-id");
  const queueRepository = createXmlValidationQueueRepositoryFromEnv({
    env: process.env,
    dataDir,
    storage,
    ...(organizationId ? { organizationId } : {})
  });
  const result = await runXmlValidationQueueOnce({
    repository: queueRepository.repository
  });

  console.log(
    JSON.stringify(
      {
        ...result,
        storage: queueRepository.storage,
        ...(queueRepository.storage === "local" ? { dataDir } : {}),
        ...(organizationId ? { organizationId } : {})
      },
      null,
      2
    )
  );
}

async function main() {
  const [, , commandOrXmlPath, rawChecks] = process.argv;

  if (commandOrXmlPath === "run-once") {
    await runQueueOnce(process.argv.slice(3));
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
