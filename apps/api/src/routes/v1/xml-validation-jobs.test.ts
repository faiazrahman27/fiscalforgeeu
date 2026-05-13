import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { inspectXmlSafety } from "@invoice-lantern/ubl";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import {
  buildXmlValidationJobCompletion,
  detectXmlDocumentType,
  detectXmlRootElement
} from "../../services/xml-validation-job-service.js";
import {
  completeJob,
  createXmlValidationJob as createStoredXmlValidationJob
} from "../../repositories/xml-validation-job-repository.js";
import {
  deleteTransientXmlPayload,
  inspectTransientXmlPayloadMetadata,
  type TransientXmlPayloadReference
} from "../../services/transient-xml-payload-store.js";
import { API_KEY_SCOPES } from "../../services/api-key-service.js";

const xmlValidationJobDataPath = join(
  process.cwd(),
  ".data",
  "xml-validation-jobs.json"
);
const apiRootPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const projectRootPath = join(apiRootPath, "..", "..");
const migrationPath = join(
  projectRootPath,
  "supabase",
  "migrations",
  "026_create_xml_validation_jobs.sql"
);

let originalXmlValidationJobData: string | null = null;

const simpleUblInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INV-XML-JOB-001</cbc:ID>
  <cbc:IssueDate>2026-04-30</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
</Invoice>`;

const forbiddenResponseClaimsPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

before(async () => {
  originalXmlValidationJobData = await readOptionalFile(xmlValidationJobDataPath);

  await rm(xmlValidationJobDataPath, {
    force: true
  });
});

after(async () => {
  if (originalXmlValidationJobData === null) {
    await rm(xmlValidationJobDataPath, {
      force: true
    });
    return;
  }

  await mkdir(dirname(xmlValidationJobDataPath), {
    recursive: true
  });
  await writeFile(
    xmlValidationJobDataPath,
    originalXmlValidationJobData,
    "utf8"
  );
});

async function readOptionalFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function writeTestOnlyInvoiceXsdFixture(tempRoot: string) {
  const maindocPath = join(tempRoot, "xsd", "maindoc");
  const invoiceXsdPath = join(maindocPath, "UBL-Invoice-2.1.xsd");

  await mkdir(maindocPath, {
    recursive: true
  });
  await writeFile(
    invoiceXsdPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Invoice">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="ID" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`,
    "utf8"
  );

  return invoiceXsdPath;
}

async function writeTestOnlySchematronFixture(input: {
  tempRoot: string;
  peppol?: string;
  en16931?: string;
}) {
  const peppolPath = join(input.tempRoot, "schematron", "peppol.sch");
  const en16931Path = join(input.tempRoot, "schematron", "en16931.sch");

  await mkdir(dirname(peppolPath), {
    recursive: true
  });
  await writeFile(
    peppolPath,
    input.peppol ??
      `<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xpath3">
  <pattern id="api-peppol">
    <rule context="/ubl:Invoice">
      <assert id="PEPPOL-API-PASS" test="normalize-space(cbc:ID) = 'INV-XML-JOB-001'">Peppol-style API assertion passed.</assert>
    </rule>
  </pattern>
</schema>`,
    "utf8"
  );
  await writeFile(
    en16931Path,
    input.en16931 ??
      `<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xpath3">
  <pattern id="api-en16931">
    <rule context="/ubl:Invoice">
      <assert id="EN16931-API-PASS" test="normalize-space(cbc:ID) = 'INV-XML-JOB-001'">EN 16931-style API assertion passed.</assert>
    </rule>
  </pattern>
</schema>`,
    "utf8"
  );

  return {
    peppolPath,
    en16931Path
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  assert.equal(isPlainObject(value), true, `${label} should be an object`);

  return value as Record<string, unknown>;
}

function assertNoUnsafeXmlValidationResponseContent(
  serialized: string,
  input: {
    rawXmlSentinel?: string;
    windowsPathSentinel?: string;
    unixPathSentinel?: string;
    fileUrlSentinel?: string;
  } = {}
) {
  if (input.rawXmlSentinel) {
    assert.equal(serialized.includes(input.rawXmlSentinel), false);
  }

  if (input.windowsPathSentinel) {
    assert.equal(serialized.includes(input.windowsPathSentinel), false);
  }

  if (input.unixPathSentinel) {
    assert.equal(serialized.includes(input.unixPathSentinel), false);
  }

  if (input.fileUrlSentinel) {
    assert.equal(serialized.includes(input.fileUrlSentinel), false);
  }

  assert.equal(serialized.includes("<Invoice"), false);
  assert.doesNotMatch(serialized, /(?:^|["\s])[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/tmp\/schematron\/[A-Za-z0-9_.-]+/);
  assert.doesNotMatch(serialized, /file:\/\/\//i);
  assert.doesNotMatch(serialized, forbiddenResponseClaimsPattern);
}

function assertWorkerSchematronOrchestrationJobShape(
  job: Record<string, unknown>
) {
  assert.deepEqual(job.failedChecks, ["schematron_peppol_placeholder"]);

  const resultSummary = readObject(job.resultSummary, "job.resultSummary");
  const checkStatuses = readObject(
    resultSummary.checkStatuses,
    "job.resultSummary.checkStatuses"
  );
  const schematronPeppol = readObject(
    resultSummary.schematronPeppol,
    "job.resultSummary.schematronPeppol"
  );
  const orchestration = readObject(
    schematronPeppol.schematronOrchestration,
    "job.resultSummary.schematronPeppol.schematronOrchestration"
  );
  const orchestrator = readObject(
    orchestration.orchestrator,
    "job.resultSummary.schematronPeppol.schematronOrchestration.orchestrator"
  );

  assert.equal(
    checkStatuses.schematron_peppol_placeholder,
    "not_implemented"
  );
  assert.equal(schematronPeppol.requested, true);
  assert.equal(schematronPeppol.implemented, false);
  assert.equal(
    schematronPeppol.workerSchematronOrchestratorVersion,
    "xml_worker_schematron_orchestrator_v1"
  );
  assert.match(
    String(schematronPeppol.orchestrationMode),
    /^(disabled|preflight_only)$/
  );
  assert.match(
    String(schematronPeppol.orchestrationStatus),
    /^(not_configured|engine_unavailable|ready_for_future_execution|disabled|partial)$/
  );
  assert.equal(schematronPeppol.validationExecutionEnabled, false);
  assert.equal(schematronPeppol.validationExecuted, false);
  assert.equal(schematronPeppol.markedValid, false);
  assert.equal(schematronPeppol.status, "not_implemented");
  assert.equal(
    orchestration.workerSchematronOrchestratorVersion,
    "xml_worker_schematron_orchestrator_v1"
  );
  assert.equal(orchestration.validationExecutionEnabled, false);
  assert.equal(orchestration.validationExecuted, false);
  assert.equal(orchestration.markedValid, false);
  assert.equal(
    orchestrator.orchestratorVersion,
    "schematron_execution_orchestrator_v1"
  );
  assert.equal(orchestrator.validationExecutionEnabled, false);
  assert.equal(orchestrator.validationExecuted, false);
  assert.equal(orchestrator.markedValid, false);
}

function assertSchematronEngineCandidate(input: {
  value: unknown;
  label: string;
  engineId: string;
  availabilityStatus: string;
  executionSupported: boolean;
}) {
  const engineCandidate = readObject(input.value, input.label);
  const serialized = JSON.stringify(engineCandidate);

  assert.equal(
    engineCandidate.diagnosticKind,
    "schematron_engine_candidate"
  );
  assert.equal(
    engineCandidate.engineCandidateVersion,
    "schematron_engine_candidate_v1"
  );
  assert.equal(engineCandidate.engineId, input.engineId);
  assert.equal(
    engineCandidate.availabilityStatus,
    input.availabilityStatus
  );
  assert.equal(engineCandidate.executionSupported, input.executionSupported);
  assert.equal(engineCandidate.executionEnabledByDefault, false);
  assert.equal(Array.isArray(engineCandidate.capabilities), true);
  assert.equal(serialized.includes(simpleUblInvoiceXml), false);
  assert.equal(serialized.includes("<Invoice"), false);
  assert.equal(serialized.includes("<schema>"), false);
  assert.doesNotMatch(serialized, /(?:^|["\s])[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/tmp\/schematron\/[A-Za-z0-9_.-]+/);
  assert.doesNotMatch(serialized, /file:\/\/\//i);
  assert.doesNotMatch(
    serialized,
    /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i
  );

  return engineCandidate;
}

function readTransientPayloadReference(
  value: unknown
): TransientXmlPayloadReference {
  const reference = readObject(value, "transientPayload");

  assert.equal(typeof reference.payloadId, "string");
  assert.equal(typeof reference.sha256, "string");
  assert.equal(typeof reference.byteLength, "number");
  assert.equal(typeof reference.createdAt, "string");
  assert.equal(typeof reference.expiresAt, "string");
  assert.equal(reference.storageProvider, "local_file_v1");

  return reference as TransientXmlPayloadReference;
}

async function createXmlValidationJob(requestedChecks = ["worker_readiness"]) {
  const app = await buildApp();

  try {
    return await app.inject({
      method: "POST",
      url: "/api/v1/xml/validation-jobs",
      headers: {
        "x-api-key": env.DEV_API_KEY,
        "content-type": "application/json"
      },
      payload: {
        xml: simpleUblInvoiceXml,
        filename: "job-test.xml",
        sourceType: "api_payload",
        requestedChecks
      }
    });
  } finally {
    await app.close();
  }
}

test("migration 026 creates metadata-only XML validation jobs table", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /create table if not exists public\.xml_validation_jobs/i);
  assert.match(migration, /xml_sha256 text not null/i);
  assert.match(migration, /xml_size_bytes integer not null/i);
  assert.match(
    migration,
    /status in \('queued',\s*'running',\s*'completed',\s*'failed',\s*'cancelled'\)/i
  );
  assert.match(migration, /alter table public\.xml_validation_jobs enable row level security/i);
  assert.doesNotMatch(migration, /\bxml_body\b/i);
  assert.doesNotMatch(migration, /\braw_xml\b/i);
});

test("XML validation job rejects unsafe XML before storage", async (t) => {
  const beforeData = await readOptionalFile(xmlValidationJobDataPath);
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/xml/validation-jobs",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/json"
    },
    payload: {
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Invoice [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<Invoice><ID>&xxe;</ID></Invoice>`,
      requestedChecks: ["worker_readiness"]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /XML_DOCTYPE_BLOCKED/);
  assert.equal(await readOptionalFile(xmlValidationJobDataPath), beforeData);
});

test("XML validation job creation requires the XML validation job API scope", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/xml/validation-jobs",
    headers: {
      "content-type": "application/json"
    },
    payload: {
      xml: simpleUblInvoiceXml,
      filename: "missing-key.xml",
      sourceType: "api_payload",
      requestedChecks: ["xsd_ubl"]
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(
    (API_KEY_SCOPES as readonly string[]).includes("xml:validation_jobs"),
    true
  );
  assert.doesNotMatch(response.body, /UBL_XSD_VALIDATION_PASSED/);
});

test("XML validation job stores metadata, SHA-256, queue lifecycle, and completed worker-readiness result", async () => {
  const response = await createXmlValidationJob();

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(isPlainObject(body.job), true);

  const job = body.job as Record<string, unknown>;

  assert.equal(job.status, "completed");
  assert.equal(job.xmlSha256, sha256(simpleUblInvoiceXml));
  assert.equal(job.xmlSizeBytes, Buffer.byteLength(simpleUblInvoiceXml, "utf8"));
  assert.deepEqual(job.requestedChecks, ["worker_readiness"]);
  assert.deepEqual(job.completedChecks, ["worker_readiness"]);
  assert.deepEqual(job.failedChecks, []);
  assert.match(
    String(job.disclaimer),
    /does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance/i
  );
  assert.equal(response.body.includes(simpleUblInvoiceXml), false);
  assert.equal(response.body.includes("<Invoice"), false);

  const resultSummary = readObject(job.resultSummary, "job.resultSummary");
  const queue = readObject(resultSummary.queue, "job.resultSummary.queue");

  assert.equal(queue.status, "completed");
  assert.equal(typeof queue.queueVersion, "string");
  assert.equal(typeof queue.mode, "string");
  assert.equal(typeof queue.attempt, "number");
  assert.equal(typeof queue.maxAttempts, "number");
  assert.equal(typeof queue.leaseSeconds, "number");
  assert.equal(typeof queue.timeoutSeconds, "number");
  assert.equal(queue.retryable, false);
  assert.match(String(queue.queuedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(queue.startedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(queue.completedAt), /^\d{4}-\d{2}-\d{2}T/);

  const storedData = await readOptionalFile(xmlValidationJobDataPath);

  assert.notEqual(storedData, null);
  assert.equal(storedData?.includes(simpleUblInvoiceXml), false);
  assert.equal(storedData?.includes("<Invoice"), false);
  assert.match(storedData ?? "", /xmlSha256/);
  assert.match(storedData ?? "", /"queue"/);
  assert.match(storedData ?? "", /"status"\s*:\s*"completed"/);
});

test("async XML validation job queues metadata and temporary payload reference only", async (t) => {
  const app = await buildApp();
  let transientPayload: TransientXmlPayloadReference | null = null;

  t.after(async () => {
    await app.close();

    if (transientPayload) {
      await deleteTransientXmlPayload({
        payloadId: transientPayload.payloadId
      });
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/xml/validation-jobs",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/json"
    },
    payload: {
      xml: simpleUblInvoiceXml,
      filename: "async-job-test.xml",
      sourceType: "api_payload",
      processingMode: "async_worker",
      requestedChecks: ["worker_readiness"]
    }
  });

  assert.equal(response.statusCode, 202);
  assert.equal(response.body.includes(simpleUblInvoiceXml), false);
  assert.equal(response.body.includes("<Invoice"), false);

  const body = response.json() as Record<string, unknown>;
  const job = readObject(body.job, "body.job");

  assert.equal(job.status, "queued");
  assert.deepEqual(job.completedChecks, []);
  assert.deepEqual(job.failedChecks, []);
  assert.equal(job.xmlSha256, sha256(simpleUblInvoiceXml));
  assert.equal(job.xmlSizeBytes, Buffer.byteLength(simpleUblInvoiceXml, "utf8"));

  const resultSummary = readObject(job.resultSummary, "job.resultSummary");
  const queue = readObject(resultSummary.queue, "job.resultSummary.queue");

  assert.equal(queue.status, "queued");
  assert.equal(queue.mode, "async_worker");

  transientPayload = readTransientPayloadReference(
    resultSummary.transientPayload
  );

  assert.equal(transientPayload.sha256, sha256(simpleUblInvoiceXml));
  assert.equal(
    transientPayload.byteLength,
    Buffer.byteLength(simpleUblInvoiceXml, "utf8")
  );
  assert.equal(JSON.stringify(transientPayload).includes(simpleUblInvoiceXml), false);
  assert.equal(JSON.stringify(transientPayload).includes("<Invoice"), false);

  const metadata = await inspectTransientXmlPayloadMetadata({
    payloadId: transientPayload.payloadId
  });

  assert.equal(metadata.exists, true);
  assert.equal(metadata.byteLength, Buffer.byteLength(simpleUblInvoiceXml, "utf8"));

  const storedData = await readOptionalFile(xmlValidationJobDataPath);

  assert.notEqual(storedData, null);
  assert.equal(storedData?.includes(simpleUblInvoiceXml), false);
  assert.equal(storedData?.includes("<Invoice"), false);
  assert.match(storedData ?? "", /"status"\s*:\s*"queued"/);
  assert.match(storedData ?? "", /"transientPayload"/);
});

test("API list and read expose completed worker Schematron orchestration metadata safely", async (t) => {
  const app = await buildApp();
  let transientPayload: TransientXmlPayloadReference | null = null;
  const rawXmlSentinel = "STEP59_RAW_XML_SENTINEL";
  const windowsPathSentinel = "C:\\step59\\schematron\\secret.sch";
  const unixPathSentinel = "/tmp/schematron/step59-secret.sch";
  const fileUrlSentinel = "file:///tmp/schematron/step59-secret.sch";
  const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice><ID>${rawXmlSentinel}</ID><Note>${windowsPathSentinel} ${unixPathSentinel} ${fileUrlSentinel} certified compliant accepted by authority legally valid Peppol passed EN 16931 passed</Note></Invoice>`;

  t.after(async () => {
    await app.close();

    if (transientPayload) {
      await deleteTransientXmlPayload({
        payloadId: transientPayload.payloadId
      });
    }
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/v1/xml/validation-jobs",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/json"
    },
    payload: {
      xml: rawXml,
      filename: "step-59-worker-orchestration.xml",
      sourceType: "api_payload",
      processingMode: "async_worker",
      requestedChecks: ["schematron_peppol_placeholder"]
    }
  });

  assert.equal(createResponse.statusCode, 202);
  assertNoUnsafeXmlValidationResponseContent(createResponse.body, {
    rawXmlSentinel,
    windowsPathSentinel,
    unixPathSentinel,
    fileUrlSentinel
  });

  const createBody = createResponse.json() as Record<string, unknown>;
  const createdJob = readObject(createBody.job, "createResponse.job");
  const createdSummary = readObject(
    createdJob.resultSummary,
    "createResponse.job.resultSummary"
  );

  transientPayload = readTransientPayloadReference(
    createdSummary.transientPayload
  );

  const workerFinding = {
    code: "PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED",
    severity: "warning" as const,
    checkType: "schematron_peppol_placeholder" as const,
    field: "xml",
    message:
      "Peppol Schematron execution is not enabled for this technical sandbox job.",
    status: "not_implemented" as const,
    legalConfidence: "technical" as const,
    technicalCode: "SCHEMATRON_EXECUTION_NOT_ENABLED",
    schematronLayer: "peppol_bis_billing" as const,
    sourceLabels: ["SCHEMATRON_EXECUTION_NOT_ENABLED"]
  };
  const workerResultSummary = {
    workerReady: true,
    xmlSha256: sha256(rawXml),
    xmlSizeBytes: Buffer.byteLength(rawXml, "utf8"),
    rootElement: "Invoice",
    documentType: "invoice",
    safetyPolicyPassed: true,
    requestedChecks: ["schematron_peppol_placeholder"],
    completedChecks: [],
    failedChecks: ["schematron_peppol_placeholder"],
    inactiveChecks: ["schematron_peppol_placeholder"],
    checkStatuses: {
      schematron_peppol_placeholder: "not_implemented"
    },
    checkResults: [
      {
        checkType: "schematron_peppol_placeholder",
        status: "not_implemented",
        findings: [workerFinding],
        summary: {
          requested: true,
          implemented: false,
          status: "not_implemented",
          workerSchematronOrchestratorVersion:
            "xml_worker_schematron_orchestrator_v1",
          orchestrationMode: "preflight_only",
          orchestrationStatus: "engine_unavailable",
          orchestrationReason:
            "schematron_execution_orchestrator_preflight_engine_unavailable",
          validationExecutionEnabled: false,
          validationExecuted: false,
          markedValid: false
        }
      }
    ],
    activeValidation: {
      xsd: false,
      schematron: false,
      peppolArtifacts: false,
      en16931Certification: false
    },
    xsdUbl: {
      requested: false,
      configured: false,
      validationExecuted: false,
      markedValid: false
    },
    schematronPeppol: {
      requested: true,
      implemented: false,
      status: "not_implemented",
      adapterVersion: "schematron_adapter_preflight_v1",
      policyVersion: "schematron_policy_v1",
      policyMode: "preflight_only",
      policyReason: "schematron_execution_preflight_only",
      engineId: "placeholder",
      engineCandidateVersion: "schematron_engine_candidate_v1",
      engineAvailabilityStatus: "placeholder_only",
      engineExecutionSupported: false,
      schematronOrchestration: {
        diagnosticKind: "xml_worker_schematron_orchestration",
        workerSchematronOrchestratorVersion:
          "xml_worker_schematron_orchestrator_v1",
        status: "engine_unavailable",
        mode: "preflight_only",
        requested: true,
        validationExecutionEnabled: false,
        validationExecuted: false,
        markedValid: false,
        findingCount: 1,
        fatalCount: 0,
        warningCount: 1,
        infoCount: 0,
        reason: "schematron_execution_orchestrator_preflight_engine_unavailable",
        orchestrator: {
          diagnosticKind: "schematron_execution_orchestrator",
          orchestratorVersion: "schematron_execution_orchestrator_v1",
          mode: "preflight_only",
          status: "engine_unavailable",
          selectedLayers: ["peppol_bis_billing", "en16931_tc434"],
          validationExecutionEnabled: false,
          validationExecuted: false,
          markedValid: false,
          findingCount: 1,
          fatalCount: 0,
          warningCount: 1,
          infoCount: 0,
          layerSummaries: [
            {
              layer: "peppol_bis_billing",
              status: "engine_unavailable",
              validationExecutionEnabled: false,
              validationExecuted: false,
              markedValid: false,
              findingCount: 1,
              fatalCount: 0,
              warningCount: 1,
              infoCount: 0,
              reason: "schematron_placeholder_engine_selected"
            },
            {
              layer: "en16931_tc434",
              status: "engine_unavailable",
              validationExecutionEnabled: false,
              validationExecuted: false,
              markedValid: false,
              findingCount: 0,
              fatalCount: 0,
              warningCount: 0,
              infoCount: 0,
              reason: "schematron_placeholder_engine_selected"
            }
          ],
          reason:
            "schematron_execution_orchestrator_preflight_engine_unavailable"
        }
      },
      workerSchematronOrchestratorVersion:
        "xml_worker_schematron_orchestrator_v1",
      orchestrationMode: "preflight_only",
      orchestrationStatus: "engine_unavailable",
      orchestrationReason:
        "schematron_execution_orchestrator_preflight_engine_unavailable",
      executionPermitted: false,
      validationExecutionEnabled: false,
      validationExecuted: false,
      markedValid: false,
      findingContractVersion: "schematron_contract_v1",
      supportedFutureFindingCodes: [
        "SCHEMATRON_EXECUTION_NOT_ENABLED",
        "PEPPOL_SCHEMATRON_RULE_FAILED",
        "EN16931_SCHEMATRON_RULE_FAILED"
      ],
      configured: false,
      usable: false,
      readyArtifactCount: 0,
      requiredArtifactCount: 2
    }
  };

  const completedJob = await completeJob({
    organizationId: "local_development",
    jobId: String(createdJob.id),
    completedChecks: [],
    failedChecks: ["schematron_peppol_placeholder"],
    workerName: "invoice-lantern-xml-worker",
    workerVersion: "0.2.0",
    resultSummary: workerResultSummary,
    findings: [workerFinding],
    disclaimer:
      "This XML validation job is a technical sandbox worker-readiness and configured-check result. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance."
  });

  assert.ok(completedJob);

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/xml/validation-jobs?limit=10&status=completed",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(listResponse.statusCode, 200);
  assertNoUnsafeXmlValidationResponseContent(listResponse.body, {
    rawXmlSentinel,
    windowsPathSentinel,
    unixPathSentinel,
    fileUrlSentinel
  });

  const listBody = listResponse.json() as Record<string, unknown>;
  const listedJobs = Array.isArray(listBody.jobs) ? listBody.jobs : [];
  const listedJob = listedJobs.find(
    (job) => isPlainObject(job) && job.id === createdJob.id
  );

  assert.equal(isPlainObject(listedJob), true);
  assertWorkerSchematronOrchestrationJobShape(
    listedJob as Record<string, unknown>
  );

  const readResponse = await app.inject({
    method: "GET",
    url: `/api/v1/xml/validation-jobs/${encodeURIComponent(String(createdJob.id))}`,
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(readResponse.statusCode, 200);
  assertNoUnsafeXmlValidationResponseContent(readResponse.body, {
    rawXmlSentinel,
    windowsPathSentinel,
    unixPathSentinel,
    fileUrlSentinel
  });

  const readBody = readResponse.json() as Record<string, unknown>;
  const readJob = readObject(readBody.job, "readResponse.job");

  assertWorkerSchematronOrchestrationJobShape(readJob);
});

test("XML validation job completion builds inline queue lifecycle metadata", async () => {
  const rootElement = detectXmlRootElement(simpleUblInvoiceXml);
  const documentType = detectXmlDocumentType(rootElement);
  const completion = await buildXmlValidationJobCompletion({
    xml: simpleUblInvoiceXml,
    xmlSha256: sha256(simpleUblInvoiceXml),
    xmlSizeBytes: Buffer.byteLength(simpleUblInvoiceXml, "utf8"),
    requestedChecks: ["worker_readiness"],
    safety: inspectXmlSafety(simpleUblInvoiceXml),
    rootElement,
    documentType,
    queueMode: "inline",
    queueAttempt: 2,
    queueClaimedBy: "test-inline-worker"
  });

  const queue = readObject(completion.resultSummary.queue, "completion.queue");

  assert.deepEqual(completion.completedChecks, ["worker_readiness"]);
  assert.deepEqual(completion.failedChecks, []);
  assert.equal(queue.status, "completed");
  assert.equal(queue.mode, "inline");
  assert.equal(queue.attempt, 2);
  assert.equal(queue.maxAttempts, 3);
  assert.equal(queue.retryable, false);
  assert.equal(queue.claimedBy, "test-inline-worker");
  assert.match(String(queue.queuedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(queue.startedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(queue.completedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(JSON.stringify(completion).includes(simpleUblInvoiceXml), false);
  assert.equal(JSON.stringify(completion).includes("<Invoice"), false);
});

test("XML validation job completion executes configured Schematron checks safely", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-api-sch-"));

  try {
    const fixture = await writeTestOnlySchematronFixture({
      tempRoot
    });
    const rootElement = detectXmlRootElement(simpleUblInvoiceXml);
    const documentType = detectXmlDocumentType(rootElement);
    const completion = await buildXmlValidationJobCompletion({
      xml: simpleUblInvoiceXml,
      xmlSha256: sha256(simpleUblInvoiceXml),
      xmlSizeBytes: Buffer.byteLength(simpleUblInvoiceXml, "utf8"),
      requestedChecks: ["schematron_peppol", "schematron_en16931"],
      safety: inspectXmlSafety(simpleUblInvoiceXml),
      rootElement,
      documentType,
      schematronArtifactConfig: {
        rootDir: tempRoot,
        peppolBisSchematronPath: fixture.peppolPath,
        en16931SchematronPath: fixture.en16931Path,
        artifactVersion: "api-step-8-test"
      },
      schematronExecutionPolicyInput: {
        requestedMode: "execute",
        requestedEngine: "xpath_engine",
        allowExperimentalExecution: true
      }
    });
    const checkStatuses = readObject(
      completion.resultSummary.checkStatuses,
      "completion.checkStatuses"
    );
    const schematronPeppol = readObject(
      completion.resultSummary.schematronPeppol,
      "completion.schematronPeppol"
    );
    const schematronEn16931 = readObject(
      completion.resultSummary.schematronEn16931,
      "completion.schematronEn16931"
    );
    const serialized = JSON.stringify(completion);

    assert.deepEqual(completion.completedChecks, [
      "schematron_peppol",
      "schematron_en16931"
    ]);
    assert.deepEqual(completion.failedChecks, []);
    assert.equal(checkStatuses.schematron_peppol, "passed");
    assert.equal(checkStatuses.schematron_en16931, "passed");
    assert.equal(schematronPeppol.implemented, true);
    assert.equal(schematronPeppol.policyMode, "execute");
    assert.equal(schematronPeppol.engineId, "xpath_engine");
    assert.equal(schematronPeppol.validationExecuted, true);
    assert.equal(schematronPeppol.markedValid, true);
    assert.equal(schematronEn16931.implemented, true);
    assert.equal(schematronEn16931.validationExecuted, true);
    assert.equal(schematronEn16931.markedValid, true);
    assert.equal(serialized.includes(simpleUblInvoiceXml), false);
    assert.equal(serialized.includes("<Invoice"), false);
    assert.equal(serialized.includes(fixture.peppolPath), false);
    assert.equal(serialized.includes(fixture.en16931Path), false);
    assert.equal(serialized.includes(basename(tempRoot)), false);
    assertNoUnsafeXmlValidationResponseContent(serialized);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("XML validation job completion keeps unsupported Schematron non-valid", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-api-sch-"));

  try {
    const fixture = await writeTestOnlySchematronFixture({
      tempRoot,
      peppol: `<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xpath3">
  <let name="unsupported" value="true()"/>
  <pattern id="api-unsupported">
    <rule context="/ubl:Invoice">
      <assert id="PEPPOL-API-UNSUPPORTED" test="true()">Unsupported construct should block execution.</assert>
    </rule>
  </pattern>
</schema>`
    });
    const rootElement = detectXmlRootElement(simpleUblInvoiceXml);
    const documentType = detectXmlDocumentType(rootElement);
    const completion = await buildXmlValidationJobCompletion({
      xml: simpleUblInvoiceXml,
      xmlSha256: sha256(simpleUblInvoiceXml),
      xmlSizeBytes: Buffer.byteLength(simpleUblInvoiceXml, "utf8"),
      requestedChecks: ["schematron_peppol"],
      safety: inspectXmlSafety(simpleUblInvoiceXml),
      rootElement,
      documentType,
      schematronArtifactConfig: {
        rootDir: tempRoot,
        peppolBisSchematronPath: fixture.peppolPath,
        en16931SchematronPath: fixture.en16931Path,
        artifactVersion: "api-step-8-test"
      },
      schematronExecutionPolicyInput: {
        requestedMode: "execute",
        requestedEngine: "xpath_engine",
        allowExperimentalExecution: true
      }
    });
    const checkStatuses = readObject(
      completion.resultSummary.checkStatuses,
      "completion.checkStatuses"
    );
    const schematronPeppol = readObject(
      completion.resultSummary.schematronPeppol,
      "completion.schematronPeppol"
    );
    const serialized = JSON.stringify(completion);

    assert.deepEqual(completion.completedChecks, []);
    assert.deepEqual(completion.failedChecks, ["schematron_peppol"]);
    assert.equal(checkStatuses.schematron_peppol, "unsupported");
    assert.equal(schematronPeppol.implemented, true);
    assert.equal(schematronPeppol.validationExecuted, false);
    assert.equal(schematronPeppol.markedValid, false);
    assert.equal(schematronPeppol.status, "unsupported");
    assert.equal(
      completion.findings.some(
        (finding) =>
          finding.checkType === "schematron_peppol" &&
          finding.status === "unsupported"
      ),
      true
    );
    assert.equal(serialized.includes(simpleUblInvoiceXml), false);
    assert.equal(serialized.includes(fixture.peppolPath), false);
    assert.equal(serialized.includes(basename(tempRoot)), false);
    assertNoUnsafeXmlValidationResponseContent(serialized);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("XML validation job marks UBL XSD as not configured without pretending it passed", async () => {
  const response = await createXmlValidationJob([
    "worker_readiness",
    "xsd_ubl",
    "schematron_peppol_placeholder"
  ]);

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const job = body.job as Record<string, unknown>;

  assert.deepEqual(job.completedChecks, ["worker_readiness", "xsd_ubl"]);
  assert.deepEqual(job.failedChecks, ["schematron_peppol_placeholder"]);
  assert.equal(Array.isArray(job.findings), true);

  const findings = job.findings as Record<string, unknown>[];

  assert.equal(
    findings.some(
      (finding) =>
        finding.code === "UBL_XSD_NOT_CONFIGURED" &&
        finding.status === "not_configured"
    ),
    true
  );
  assert.equal(
    findings.some(
      (finding) =>
        finding.code === "PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED" &&
        finding.status === "not_implemented" &&
        finding.technicalCode === "SCHEMATRON_EXECUTION_NOT_ENABLED" &&
        finding.schematronLayer === "peppol_bis_billing" &&
        Array.isArray(finding.sourceLabels) &&
        (finding.sourceLabels as string[]).includes(
          "SCHEMATRON_EXECUTION_NOT_ENABLED"
        )
    ),
    true
  );

  const resultSummary = job.resultSummary as Record<string, unknown>;
  const queue = readObject(resultSummary.queue, "job.resultSummary.queue");
  const checkStatuses = resultSummary.checkStatuses as Record<string, unknown>;
  const xsdUbl = resultSummary.xsdUbl as Record<string, unknown>;
  const schematronPeppol = resultSummary.schematronPeppol as Record<
    string,
    unknown
  >;
  const checkResults = resultSummary.checkResults as Record<string, unknown>[];
  const xsdCheckResult = checkResults.find(
    (result) => result.checkType === "xsd_ubl"
  ) as Record<string, unknown>;
  const schematronCheckResult = checkResults.find(
    (result) => result.checkType === "schematron_peppol_placeholder"
  ) as Record<string, unknown>;
  const artifactInfo = xsdUbl.artifactInfo as Record<string, unknown>;
  const schematronCheckSummary = readObject(
    schematronCheckResult.summary,
    "schematronCheckResult.summary"
  );
  const schematronDiagnostics = readObject(
    schematronPeppol.artifactDiagnostics,
    "schematronPeppol.artifactDiagnostics"
  );

  assert.equal(queue.status, "completed");
  assert.equal(queue.retryable, false);
  assert.equal(checkStatuses.xsd_ubl, "not_configured");
  assert.equal(
    checkStatuses.schematron_peppol_placeholder,
    "not_implemented"
  );
  assert.equal(xsdCheckResult.status, "not_configured");
  assert.equal(schematronCheckResult.status, "not_implemented");
  assert.equal(isPlainObject(xsdCheckResult.artifactInfo), true);
  assert.equal(xsdUbl.configured, false);
  assert.equal(xsdUbl.validationExecuted, false);
  assert.equal(xsdUbl.markedValid, false);
  assert.equal(xsdUbl.status, "not_configured");
  assert.match(String(xsdUbl.disclaimer), /not official validation/i);
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
  assert.equal(
    schematronPeppol.engineCandidateVersion,
    "schematron_engine_candidate_v1"
  );
  assert.equal(schematronPeppol.engineAvailabilityStatus, "placeholder_only");
  assert.equal(schematronPeppol.engineExecutionSupported, false);
  const engineCandidate = assertSchematronEngineCandidate({
    value: schematronPeppol.engineCandidate,
    label: "schematronPeppol.engineCandidate",
    engineId: "placeholder",
    availabilityStatus: "placeholder_only",
    executionSupported: false
  });
  assert.equal(schematronPeppol.executionPermitted, false);
  assert.equal(
    schematronPeppol.adapterVersion,
    "schematron_adapter_preflight_v1"
  );
  assert.equal(schematronPeppol.preflightStatus, "not_configured");
  assert.equal(
    schematronPeppol.preflightReason,
    "schematron_artifacts_not_configured"
  );
  const schematronPreflight = readObject(
    schematronPeppol.executionPreflight,
    "schematronPeppol.executionPreflight"
  );
  assert.equal(
    schematronPreflight.diagnosticKind,
    "schematron_execution_preflight"
  );
  assert.equal(
    schematronPreflight.adapterVersion,
    "schematron_adapter_preflight_v1"
  );
  assert.equal(schematronPreflight.mode, "preflight_only");
  assert.equal(schematronPreflight.status, "not_configured");
  assert.equal(
    schematronPreflight.reason,
    "schematron_artifacts_not_configured"
  );
  assert.equal(schematronPreflight.validationExecutionEnabled, false);
  assert.equal(schematronPreflight.validationExecuted, false);
  assert.equal(schematronPreflight.markedValid, false);
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
  assert.equal(schematronPeppol.configured, false);
  assert.equal(schematronPeppol.usable, false);
  assert.equal(schematronPeppol.readyArtifactCount, 0);
  assert.equal(schematronPeppol.requiredArtifactCount, 2);
  assert.equal(schematronPeppol.status, "not_implemented");
  assert.equal(schematronCheckSummary.validationExecutionEnabled, false);
  assert.equal(schematronCheckSummary.validationExecuted, false);
  assert.equal(schematronCheckSummary.markedValid, false);
  assert.equal(schematronCheckSummary.policyVersion, "schematron_policy_v1");
  assert.equal(schematronCheckSummary.policyMode, "preflight_only");
  assert.equal(
    schematronCheckSummary.policyReason,
    "schematron_execution_preflight_only"
  );
  assert.equal(schematronCheckSummary.engineId, "placeholder");
  assert.equal(
    schematronCheckSummary.engineCandidateVersion,
    "schematron_engine_candidate_v1"
  );
  assert.equal(
    schematronCheckSummary.engineAvailabilityStatus,
    "placeholder_only"
  );
  assert.equal(schematronCheckSummary.engineExecutionSupported, false);
  assert.deepEqual(schematronCheckSummary.engineCandidate, engineCandidate);
  assert.equal(schematronCheckSummary.executionPermitted, false);
  assert.equal(
    schematronCheckSummary.adapterVersion,
    "schematron_adapter_preflight_v1"
  );
  assert.equal(schematronCheckSummary.preflightStatus, "not_configured");
  assert.equal(
    schematronCheckSummary.preflightReason,
    "schematron_artifacts_not_configured"
  );
  assert.deepEqual(
    schematronCheckSummary.executionPreflight,
    schematronPreflight
  );
  assert.deepEqual(schematronCheckSummary.executionPolicy, executionPolicy);
  assert.equal(
    schematronCheckSummary.findingContractVersion,
    "schematron_contract_v1"
  );
  assert.equal(
    (schematronCheckSummary.supportedFutureFindingCodes as string[]).includes(
      "SCHEMATRON_ASSERTION_FAILED"
    ),
    true
  );
  assert.equal(schematronCheckSummary.validatorAvailable, false);
  assert.equal(schematronDiagnostics.diagnosticKind, "schematron_artifacts");
  assert.equal(schematronDiagnostics.configured, false);
  assert.equal(schematronDiagnostics.usable, false);
  assert.equal(schematronDiagnostics.validatorName, "schematron-placeholder");
  assert.equal(schematronDiagnostics.validatorAvailable, false);
  assert.equal(
    schematronDiagnostics.validationExecutionEnabled,
    false
  );
  assert.equal(isPlainObject(artifactInfo), true);
  assert.equal(artifactInfo.configured, false);
  assert.equal(artifactInfo.validatorName, "xmllint-wasm");
  assert.equal(artifactInfo.validatorAvailable, true);
  assert.equal(artifactInfo.artifactVersion, null);
  assert.match(String(artifactInfo.checkedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(
    (artifactInfo.invoiceSchema as Record<string, unknown>).status,
    "not_configured"
  );
  assert.equal(
    (artifactInfo.creditNoteSchema as Record<string, unknown>).status,
    "not_configured"
  );
  assert.equal(
    (artifactInfo.dependencyGraph as Record<string, unknown>).status,
    "not_inspected"
  );

  assert.doesNotMatch(
    JSON.stringify(job),
    /\bXSD valid\b|\bSchematron passed\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bofficially valid\b|\blegally compliant\b|\baccepted by authority\b/i
  );
  assert.equal(response.body.includes(simpleUblInvoiceXml), false);
  assert.equal(response.body.includes("<Invoice"), false);
  assert.equal(response.body.includes("<schema>"), false);

  const storedData = await readOptionalFile(xmlValidationJobDataPath);

  assert.equal(storedData?.includes(simpleUblInvoiceXml), false);
  assert.equal(storedData?.includes("<Invoice"), false);
});

test("Schematron execution-like policy request is blocked without validation execution", async () => {
  const rootElement = detectXmlRootElement(simpleUblInvoiceXml);
  const documentType = detectXmlDocumentType(rootElement);
  const completion = await buildXmlValidationJobCompletion({
    xml: simpleUblInvoiceXml,
    xmlSha256: sha256(simpleUblInvoiceXml),
    xmlSizeBytes: Buffer.byteLength(simpleUblInvoiceXml, "utf8"),
    requestedChecks: ["schematron_peppol_placeholder"],
    safety: inspectXmlSafety(simpleUblInvoiceXml),
    rootElement,
    documentType,
    schematronExecutionPolicyInput: {
      requestedMode: "enabled",
      requestedEngine: "future_xslt2"
    }
  });
  const schematronPeppol = readObject(
    completion.resultSummary.schematronPeppol,
    "completion.schematronPeppol"
  );
  const executionPolicy = readObject(
    schematronPeppol.executionPolicy,
    "schematronPeppol.executionPolicy"
  );

  assert.deepEqual(completion.completedChecks, []);
  assert.deepEqual(completion.failedChecks, [
    "schematron_peppol_placeholder"
  ]);
  assert.equal(schematronPeppol.status, "not_implemented");
  assert.equal(schematronPeppol.policyVersion, "schematron_policy_v1");
  assert.equal(schematronPeppol.policyMode, "blocked_requested_execution");
  assert.equal(
    schematronPeppol.policyReason,
    "schematron_execution_requested_but_blocked"
  );
  assert.equal(schematronPeppol.engineId, "future_xslt2");
  assert.equal(
    schematronPeppol.engineCandidateVersion,
    "schematron_engine_candidate_v1"
  );
  assert.equal(schematronPeppol.engineAvailabilityStatus, "unavailable");
  assert.equal(schematronPeppol.engineExecutionSupported, false);
  const engineCandidate = assertSchematronEngineCandidate({
    value: schematronPeppol.engineCandidate,
    label: "schematronPeppol.engineCandidate",
    engineId: "future_xslt2",
    availabilityStatus: "unavailable",
    executionSupported: false
  });
  assert.equal(
    engineCandidate.reason,
    "schematron_xslt2_engine_not_installed"
  );
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
  assert.equal(executionPolicy.engineId, "future_xslt2");
  assert.equal(executionPolicy.executionPermitted, false);
  assert.equal(executionPolicy.validationExecutionEnabled, false);
  assert.equal(
    JSON.stringify(completion).includes("schematron_xslt2_engine_not_installed"),
    true
  );
  assert.equal(JSON.stringify(completion).includes(simpleUblInvoiceXml), false);
  assert.equal(JSON.stringify(completion).includes("<Invoice"), false);
});

test("Schematron disabled policy reports disabled preflight without execution", async () => {
  const rootElement = detectXmlRootElement(simpleUblInvoiceXml);
  const documentType = detectXmlDocumentType(rootElement);
  const completion = await buildXmlValidationJobCompletion({
    xml: simpleUblInvoiceXml,
    xmlSha256: sha256(simpleUblInvoiceXml),
    xmlSizeBytes: Buffer.byteLength(simpleUblInvoiceXml, "utf8"),
    requestedChecks: ["schematron_peppol_placeholder"],
    safety: inspectXmlSafety(simpleUblInvoiceXml),
    rootElement,
    documentType,
    schematronExecutionPolicyInput: {
      requestedMode: "disabled",
      requestedEngine: "none"
    }
  });
  const schematronPeppol = readObject(
    completion.resultSummary.schematronPeppol,
    "completion.schematronPeppol"
  );
  const executionPolicy = readObject(
    schematronPeppol.executionPolicy,
    "schematronPeppol.executionPolicy"
  );

  assert.deepEqual(completion.completedChecks, []);
  assert.deepEqual(completion.failedChecks, [
    "schematron_peppol_placeholder"
  ]);
  assert.equal(schematronPeppol.status, "not_implemented");
  assert.equal(schematronPeppol.policyMode, "disabled");
  assert.equal(
    schematronPeppol.policyReason,
    "schematron_execution_disabled_by_policy"
  );
  assert.equal(schematronPeppol.engineId, "none");
  assert.equal(
    schematronPeppol.engineCandidateVersion,
    "schematron_engine_candidate_v1"
  );
  assert.equal(schematronPeppol.engineAvailabilityStatus, "not_selected");
  assert.equal(schematronPeppol.engineExecutionSupported, false);
  assertSchematronEngineCandidate({
    value: schematronPeppol.engineCandidate,
    label: "schematronPeppol.engineCandidate",
    engineId: "none",
    availabilityStatus: "not_selected",
    executionSupported: false
  });
  assert.equal(schematronPeppol.executionPermitted, false);
  assert.equal(schematronPeppol.validationExecutionEnabled, false);
  assert.equal(schematronPeppol.validationExecuted, false);
  assert.equal(schematronPeppol.markedValid, false);
  assert.equal(schematronPeppol.preflightStatus, "disabled");
  assert.equal(schematronPeppol.preflightReason, "schematron_execution_disabled");
  assert.equal(executionPolicy.mode, "disabled");
  assert.equal(executionPolicy.engineId, "none");
});

test("configured missing UBL XSD artefact paths produce safe not_configured metadata", async () => {
  const rootElement = detectXmlRootElement(simpleUblInvoiceXml);
  const documentType = detectXmlDocumentType(rootElement);
  const missingInvoiceXsdPath = join(
    process.cwd(),
    ".missing-test-artifacts",
    "UBL-Invoice-2.1.xsd"
  );
  const completion = await buildXmlValidationJobCompletion({
    xml: simpleUblInvoiceXml,
    xmlSha256: sha256(simpleUblInvoiceXml),
    xmlSizeBytes: Buffer.byteLength(simpleUblInvoiceXml, "utf8"),
    requestedChecks: ["xsd_ubl"],
    safety: inspectXmlSafety(simpleUblInvoiceXml),
    rootElement,
    documentType,
    xsdArtifactConfig: {
      invoiceXsdPath: missingInvoiceXsdPath,
      artifactVersion: "2.1"
    }
  });

  assert.deepEqual(completion.completedChecks, ["xsd_ubl"]);
  assert.deepEqual(completion.failedChecks, []);

  const queue = readObject(completion.resultSummary.queue, "completion.queue");
  const xsdUbl = completion.resultSummary.xsdUbl as Record<string, unknown>;
  const checkResults = completion.resultSummary.checkResults as Record<
    string,
    unknown
  >[];
  const xsdCheckResult = checkResults.find(
    (result) => result.checkType === "xsd_ubl"
  ) as Record<string, unknown>;
  const artifactInfo = xsdUbl.artifactInfo as Record<string, unknown>;

  assert.equal(queue.status, "completed");
  assert.equal(queue.mode, "inline");
  assert.equal(queue.retryable, false);
  assert.equal(xsdCheckResult.status, "not_configured");
  assert.equal(xsdUbl.configured, false);
  assert.equal(xsdUbl.validationExecuted, false);
  assert.equal(xsdUbl.markedValid, false);
  assert.equal(artifactInfo.configured, false);
  assert.equal(artifactInfo.invoiceXsdPath, missingInvoiceXsdPath);
  assert.equal(artifactInfo.artifactVersion, "2.1");
  assert.equal(
    (artifactInfo.invoiceSchema as Record<string, unknown>).configured,
    true
  );
  assert.equal(
    (artifactInfo.invoiceSchema as Record<string, unknown>).status,
    "missing"
  );
  assert.equal(
    (artifactInfo.invoiceSchema as Record<string, unknown>).sha256,
    null
  );
  assert.equal(
    (artifactInfo.dependencyGraph as Record<string, unknown>).status,
    "not_inspected"
  );
  assert.equal(
    completion.findings.some(
      (finding) =>
        finding.code === "UBL_XSD_NOT_CONFIGURED" &&
        finding.status === "not_configured"
    ),
    true
  );
  assert.equal(JSON.stringify(completion).includes(simpleUblInvoiceXml), false);
  assert.equal(JSON.stringify(completion).includes("<Invoice"), false);
});

test("configured readable UBL Invoice XSD artefact metadata is returned safely", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-api-xsd-"));
  const tinyInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice><ID>INV-XSD-API-001</ID></Invoice>`;

  try {
    const invoiceXsdPath = await writeTestOnlyInvoiceXsdFixture(tempRoot);
    const rootElement = detectXmlRootElement(tinyInvoiceXml);
    const documentType = detectXmlDocumentType(rootElement);
    const completion = await buildXmlValidationJobCompletion({
      xml: tinyInvoiceXml,
      xmlSha256: sha256(tinyInvoiceXml),
      xmlSizeBytes: Buffer.byteLength(tinyInvoiceXml, "utf8"),
      requestedChecks: ["xsd_ubl"],
      safety: inspectXmlSafety(tinyInvoiceXml),
      rootElement,
      documentType,
      xsdArtifactConfig: {
        rootDir: tempRoot,
        invoiceXsdPath,
        artifactVersion: "test-only"
      }
    });

    assert.deepEqual(completion.completedChecks, ["xsd_ubl"]);
    assert.deepEqual(completion.failedChecks, []);

    const queue = readObject(completion.resultSummary.queue, "completion.queue");
    const xsdUbl = completion.resultSummary.xsdUbl as Record<string, unknown>;
    const artifactInfo = xsdUbl.artifactInfo as Record<string, unknown>;
    const invoiceSchema = artifactInfo.invoiceSchema as Record<string, unknown>;
    const dependencyGraph = artifactInfo.dependencyGraph as Record<string, unknown>;

    assert.equal(queue.status, "completed");
    assert.equal(queue.mode, "inline");
    assert.equal(queue.retryable, false);
    assert.equal(xsdUbl.status, "passed");
    assert.equal(xsdUbl.configured, true);
    assert.equal(xsdUbl.validationExecuted, true);
    assert.equal(xsdUbl.markedValid, true);
    assert.match(String(xsdUbl.disclaimer), /technical schema check only/i);
    assert.equal(artifactInfo.configured, true);
    assert.equal(artifactInfo.validatorName, "xmllint-wasm");
    assert.equal(artifactInfo.validatorAvailable, true);
    assert.equal(artifactInfo.artifactVersion, "test-only");
    assert.equal(invoiceSchema.status, "available");
    assert.equal(invoiceSchema.readable, true);
    assert.match(String(invoiceSchema.sha256), /^[a-f0-9]{64}$/);
    assert.equal(dependencyGraph.status, "ready");
    assert.equal(dependencyGraph.dependencyCount, 0);
    assert.equal(JSON.stringify(completion).includes(tinyInvoiceXml), false);
    assert.equal(JSON.stringify(completion).includes("<Invoice"), false);
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("configured readable UBL Invoice XSD failure returns mapped findings safely", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-api-xsd-"));
  const invalidInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice><Unexpected>INV-XSD-API-RAW-SECRET</Unexpected></Invoice>`;

  try {
    const invoiceXsdPath = await writeTestOnlyInvoiceXsdFixture(tempRoot);
    const rootElement = detectXmlRootElement(invalidInvoiceXml);
    const documentType = detectXmlDocumentType(rootElement);
    const completion = await buildXmlValidationJobCompletion({
      xml: invalidInvoiceXml,
      xmlSha256: sha256(invalidInvoiceXml),
      xmlSizeBytes: Buffer.byteLength(invalidInvoiceXml, "utf8"),
      requestedChecks: ["xsd_ubl"],
      safety: inspectXmlSafety(invalidInvoiceXml),
      rootElement,
      documentType,
      xsdArtifactConfig: {
        rootDir: tempRoot,
        invoiceXsdPath,
        artifactVersion: "test-only"
      }
    });

    assert.deepEqual(completion.completedChecks, []);
    assert.deepEqual(completion.failedChecks, ["xsd_ubl"]);

    const queue = readObject(completion.resultSummary.queue, "completion.queue");
    const xsdUbl = completion.resultSummary.xsdUbl as Record<string, unknown>;
    const checkResults = completion.resultSummary.checkResults as Record<
      string,
      unknown
    >[];
    const xsdCheckResult = checkResults.find(
      (result) => result.checkType === "xsd_ubl"
    ) as Record<string, unknown>;
    const checkFindings = xsdCheckResult.findings as Record<string, unknown>[];
    const mappedFinding = checkFindings[0] as Record<string, unknown>;

    assert.equal(queue.status, "completed");
    assert.equal(queue.mode, "inline");
    assert.equal(queue.retryable, false);
    assert.equal(xsdUbl.status, "failed");
    assert.equal(xsdUbl.configured, true);
    assert.equal(xsdUbl.validationExecuted, true);
    assert.equal(xsdUbl.markedValid, false);
    assert.match(String(xsdUbl.disclaimer), /technical schema check only/i);
    assert.equal(isPlainObject(xsdCheckResult.artifactInfo), true);
    assert.equal(mappedFinding.code, "UBL_XSD_ELEMENT_INVALID");
    assert.equal(mappedFinding.severity, "fatal");
    assert.equal(mappedFinding.checkType, "xsd_ubl");
    assert.equal(mappedFinding.field, "xml");
    assert.equal(mappedFinding.status, "failed");
    assert.equal(mappedFinding.legalConfidence, "technical");
    assert.equal(mappedFinding.technicalCode, "element_invalid");
    assert.equal(typeof mappedFinding.technicalMessage, "string");
    assert.equal(Array.isArray(mappedFinding.sourceLabels), true);
    assert.equal(
      (mappedFinding.sourceLabels as string[]).includes("xmllint-wasm"),
      true
    );
    assert.equal(JSON.stringify(completion).includes(invalidInvoiceXml), false);
    assert.equal(JSON.stringify(completion).includes("<Invoice"), false);
    assert.equal(
      JSON.stringify(completion).includes("INV-XSD-API-RAW-SECRET"),
      false
    );
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("configured readable Schematron artefacts return safe metadata-only placeholder diagnostics", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invoice-lantern-api-sch-"));
  const peppolBisPath = join(tempRoot, "peppol", "PEPPOL-BIS-Billing.sch");
  const en16931Path = join(tempRoot, "tc434", "EN16931-TC434.sch");
  const peppolSentinel = "PEPPOL-SCHEMATRON-CONTENT-SENTINEL-STEP-48";
  const en16931Sentinel = "EN16931-SCHEMATRON-CONTENT-SENTINEL-STEP-48";

  try {
    await mkdir(dirname(peppolBisPath), {
      recursive: true
    });
    await mkdir(dirname(en16931Path), {
      recursive: true
    });
    await writeFile(peppolBisPath, `<schema>${peppolSentinel}</schema>`, "utf8");
    await writeFile(en16931Path, `<schema>${en16931Sentinel}</schema>`, "utf8");

    const rootElement = detectXmlRootElement(simpleUblInvoiceXml);
    const documentType = detectXmlDocumentType(rootElement);
    const completion = await buildXmlValidationJobCompletion({
      xml: simpleUblInvoiceXml,
      xmlSha256: sha256(simpleUblInvoiceXml),
      xmlSizeBytes: Buffer.byteLength(simpleUblInvoiceXml, "utf8"),
      requestedChecks: ["schematron_peppol_placeholder"],
      safety: inspectXmlSafety(simpleUblInvoiceXml),
      rootElement,
      documentType,
      schematronArtifactConfig: {
        rootDir: tempRoot,
        peppolBisSchematronPath: peppolBisPath,
        en16931SchematronPath: en16931Path,
        artifactVersion: "step-48-test"
      }
    });

    assert.deepEqual(completion.completedChecks, []);
    assert.deepEqual(completion.failedChecks, [
      "schematron_peppol_placeholder"
    ]);

    const queue = readObject(completion.resultSummary.queue, "completion.queue");
    const schematronPeppol = readObject(
      completion.resultSummary.schematronPeppol,
      "completion.schematronPeppol"
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
    const checkResults = completion.resultSummary.checkResults as Record<
      string,
      unknown
    >[];
    const schematronCheckResult = checkResults.find(
      (result) => result.checkType === "schematron_peppol_placeholder"
    ) as Record<string, unknown>;
    const schematronCheckSummary = readObject(
      schematronCheckResult.summary,
      "schematronCheckResult.summary"
    );
    const serialized = JSON.stringify(completion);

    assert.equal(queue.status, "completed");
    assert.equal(schematronCheckResult.status, "not_implemented");
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
    assert.equal(
      schematronPeppol.engineCandidateVersion,
      "schematron_engine_candidate_v1"
    );
    assert.equal(schematronPeppol.engineAvailabilityStatus, "placeholder_only");
    assert.equal(schematronPeppol.engineExecutionSupported, false);
    const engineCandidate = assertSchematronEngineCandidate({
      value: schematronPeppol.engineCandidate,
      label: "schematronPeppol.engineCandidate",
      engineId: "placeholder",
      availabilityStatus: "placeholder_only",
      executionSupported: false
    });
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
    assert.equal(
      executionPolicy.reason,
      "schematron_execution_preflight_only"
    );
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
    assert.equal(schematronPeppol.readyArtifactCount, 2);
    assert.equal(schematronPeppol.requiredArtifactCount, 2);
    assert.equal(schematronPeppol.artifactVersion, "step-48-test");
    assert.equal(schematronPeppol.status, "not_implemented");
    assert.equal(schematronCheckSummary.validationExecutionEnabled, false);
    assert.equal(schematronCheckSummary.validationExecuted, false);
    assert.equal(schematronCheckSummary.markedValid, false);
    assert.equal(schematronCheckSummary.policyVersion, "schematron_policy_v1");
    assert.equal(schematronCheckSummary.policyMode, "preflight_only");
    assert.equal(
      schematronCheckSummary.policyReason,
      "schematron_execution_preflight_only"
    );
    assert.equal(schematronCheckSummary.engineId, "placeholder");
    assert.equal(
      schematronCheckSummary.engineCandidateVersion,
      "schematron_engine_candidate_v1"
    );
    assert.equal(
      schematronCheckSummary.engineAvailabilityStatus,
      "placeholder_only"
    );
    assert.equal(schematronCheckSummary.engineExecutionSupported, false);
    assert.deepEqual(schematronCheckSummary.engineCandidate, engineCandidate);
    assert.equal(schematronCheckSummary.executionPermitted, false);
    assert.equal(
      schematronCheckSummary.adapterVersion,
      "schematron_adapter_preflight_v1"
    );
    assert.equal(
      schematronCheckSummary.preflightStatus,
      "ready_for_future_execution"
    );
    assert.equal(
      schematronCheckSummary.preflightReason,
      "schematron_artifacts_ready_but_execution_not_enabled"
    );
    assert.deepEqual(
      schematronCheckSummary.executionPreflight,
      executionPreflight
    );
    assert.deepEqual(schematronCheckSummary.executionPolicy, executionPolicy);
    assert.equal(
      schematronCheckSummary.findingContractVersion,
      "schematron_contract_v1"
    );
    assert.equal(
      (schematronCheckSummary.supportedFutureFindingCodes as string[]).includes(
        "SCHEMATRON_ASSERTION_FAILED"
      ),
      true
    );
    assert.equal(schematronCheckSummary.configured, true);
    assert.equal(schematronCheckSummary.usable, true);
    assert.equal(schematronCheckSummary.readyArtifactCount, 2);
    assert.equal(schematronCheckSummary.requiredArtifactCount, 2);
    assert.equal(schematronCheckSummary.validatorAvailable, false);
    assert.equal(diagnostics.diagnosticKind, "schematron_artifacts");
    assert.equal(diagnostics.configured, true);
    assert.equal(diagnostics.usable, true);
    assert.equal(diagnostics.readyArtifactCount, 2);
    assert.equal(diagnostics.requiredArtifactCount, 2);
    assert.equal(diagnostics.allRequiredArtifactsReadable, true);
    assert.equal(diagnostics.artifactVersion, "step-48-test");
    assert.equal(diagnostics.validatorName, "schematron-placeholder");
    assert.equal(diagnostics.validatorAvailable, false);
    assert.equal(diagnostics.validationExecutionEnabled, false);
    assert.equal(
      diagnostics.artifactManifestVersion,
      "schematron_artifact_manifest_v1"
    );
    assert.match(String(diagnostics.checkedAt), /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(peppolBisArtifact.artifactKind, "peppol_bis_billing");
    assert.equal(peppolBisArtifact.status, "available");
    assert.equal(peppolBisArtifact.readable, true);
    assert.match(String(peppolBisArtifact.sha256), /^[a-f0-9]{64}$/);
    assert.equal(
      peppolBisArtifact.artifactManifestVersion,
      "schematron_artifact_manifest_v1"
    );
    assert.equal(peppolBisArtifact.manifestHashStatus, "expected_hash_missing");
    assert.equal(peppolBisArtifact.expectedSha256Recorded, false);
    assert.equal(peppolBisArtifact.actualSha256Recorded, true);
    const peppolManifest = readObject(
      peppolBisArtifact.manifestVerification,
      "peppolBisArtifact.manifestVerification"
    );
    assert.equal(peppolManifest.hashStatus, "expected_hash_missing");
    assert.equal(peppolManifest.reviewStatus, "expected_hash_missing");
    assert.equal(peppolManifest.safety && typeof peppolManifest.safety, "object");
    assert.equal(peppolBisArtifact.label, "peppol/PEPPOL-BIS-Billing.sch");
    assert.equal(peppolBisArtifact.basename, "PEPPOL-BIS-Billing.sch");
    assert.equal(en16931Artifact.artifactKind, "en16931_tc434");
    assert.equal(en16931Artifact.status, "available");
    assert.equal(en16931Artifact.readable, true);
    assert.match(String(en16931Artifact.sha256), /^[a-f0-9]{64}$/);
    assert.equal(
      en16931Artifact.artifactManifestVersion,
      "schematron_artifact_manifest_v1"
    );
    assert.equal(en16931Artifact.manifestHashStatus, "expected_hash_missing");
    assert.equal(en16931Artifact.label, "tc434/EN16931-TC434.sch");
    assert.equal(en16931Artifact.basename, "EN16931-TC434.sch");
    assert.equal(
      completion.findings.some(
        (finding) =>
          finding.code === "PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED" &&
          finding.technicalCode === "SCHEMATRON_EXECUTION_NOT_ENABLED" &&
          finding.schematronLayer === "peppol_bis_billing" &&
          finding.status === "not_implemented"
      ),
      true
    );
    assert.equal(serialized.includes(simpleUblInvoiceXml), false);
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
    await rm(tempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("legacy XSD placeholder check is rejected by schema instead of silently accepted", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/xml/validation-jobs",
    headers: {
      "x-api-key": env.DEV_API_KEY,
      "content-type": "application/json"
    },
    payload: {
      xml: simpleUblInvoiceXml,
      filename: "legacy-placeholder.xml",
      sourceType: "api_payload",
      requestedChecks: ["xsd_ubl_placeholder"]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body, /XML validation job request failed schema validation/i);
  assert.match(response.body, /VALIDATION_ERROR/);
  assert.match(response.body, /requestedChecks\.0/);
  assert.match(response.body, /worker_readiness/);
  assert.match(response.body, /xsd_ubl/);
  assert.match(response.body, /schematron_peppol_placeholder/);
  assert.doesNotMatch(response.body, /UBL_XSD_NOT_CONFIGURED/);
  assert.doesNotMatch(response.body, /XML_VALIDATION_WORKER_READY/);
});

test("XML validation job reads are tenant scoped", async (t) => {
  const otherOrgJob = await createStoredXmlValidationJob({
    organizationId: "00000000-0000-4000-8000-00000000f007",
    sourceType: "api_payload",
    documentType: "invoice",
    filename: "other-org.xml",
    xmlSha256: "7".repeat(64),
    xmlSizeBytes: 42,
    requestedChecks: ["xsd_ubl"],
    resultSummary: {
      crossOrgSentinel: "OTHER-ORG-XML-JOB-SHOULD-NOT-LEAK"
    },
    disclaimer:
      "This XML validation job is a technical sandbox worker-readiness and configured-check result. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance."
  });
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const readResponse = await app.inject({
    method: "GET",
    url: `/api/v1/xml/validation-jobs/${encodeURIComponent(otherOrgJob.id)}`,
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });
  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/xml/validation-jobs?limit=100",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(readResponse.statusCode, 404);
  assert.equal(readResponse.body.includes(otherOrgJob.id), false);
  assert.equal(
    readResponse.body.includes("OTHER-ORG-XML-JOB-SHOULD-NOT-LEAK"),
    false
  );
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.body.includes(otherOrgJob.id), false);
  assert.equal(
    listResponse.body.includes("OTHER-ORG-XML-JOB-SHOULD-NOT-LEAK"),
    false
  );
});

test("XML validation job list and read endpoints return metadata and queue state only", async (t) => {
  const createdResponse = await createXmlValidationJob();
  const createdJob = (createdResponse.json() as { job: { id: string } }).job;
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/xml/validation-jobs?limit=5&status=completed",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.body.includes(simpleUblInvoiceXml), false);
  assert.equal(listResponse.body.includes("<Invoice"), false);

  const listBody = listResponse.json() as Record<string, unknown>;

  assert.equal(Array.isArray(listBody.jobs), true);

  const jobs = listBody.jobs as Record<string, unknown>[];
  const listedJob = jobs.find((job) => job.id === createdJob.id);

  assert.equal(isPlainObject(listedJob), true);

  const listedResultSummary = readObject(
    (listedJob as Record<string, unknown>).resultSummary,
    "listedJob.resultSummary"
  );
  const listedQueue = readObject(
    listedResultSummary.queue,
    "listedJob.resultSummary.queue"
  );

  assert.equal(listedQueue.status, "completed");
  assert.equal(listedQueue.retryable, false);

  const readResponse = await app.inject({
    method: "GET",
    url: `/api/v1/xml/validation-jobs/${encodeURIComponent(createdJob.id)}`,
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.body.includes(simpleUblInvoiceXml), false);
  assert.equal(readResponse.body.includes("<Invoice"), false);

  const readBody = readResponse.json() as Record<string, unknown>;

  assert.equal(isPlainObject(readBody.job), true);
  assert.equal((readBody.job as Record<string, unknown>).id, createdJob.id);

  const readResultSummary = readObject(
    (readBody.job as Record<string, unknown>).resultSummary,
    "readBody.job.resultSummary"
  );
  const readQueue = readObject(
    readResultSummary.queue,
    "readBody.job.resultSummary.queue"
  );

  assert.equal(readQueue.status, "completed");
  assert.equal(readQueue.retryable, false);
});
