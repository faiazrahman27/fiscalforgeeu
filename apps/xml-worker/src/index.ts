import { readFile } from "node:fs/promises";
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

async function main() {
  const [, , xmlPath, rawChecks] = process.argv;

  if (!xmlPath) {
    console.log(
      "XML worker foundation is ready. Pass an XML file path to run the local validator. Supported checks: worker_readiness, xsd_ubl, schematron_peppol_placeholder."
    );
    return;
  }

  const xml = await readFile(xmlPath, "utf8");
  const result = await runStubXmlValidator({
    xml,
    requestedChecks: normalizeChecks(rawChecks)
  });

  console.log(JSON.stringify(result, null, 2));
}

await main();
