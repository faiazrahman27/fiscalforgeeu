import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";

const validationRunDataPath = join(process.cwd(), ".data", "validation-runs.json");

let originalValidationRunData: string | null = null;

const invoicePayload = {
  document: {
    type: "invoice",
    number: "",
    currency: "EUR",
    issueDate: "2026-04-29"
  },
  seller: {
    name: "Invoice Lantern Seller",
    country: "DE",
    vatId: "DE123456789"
  },
  buyer: {
    name: "Invoice Lantern Buyer",
    country: "DE",
    vatId: ""
  },
  lines: [
    {
      id: "1",
      description: "Technical validation sandbox service",
      quantity: "1",
      unitCode: "EA",
      unitPrice: "100.00",
      vatCategory: "S",
      vatRate: "19"
    }
  ]
};

before(async () => {
  try {
    originalValidationRunData = await readFile(validationRunDataPath, "utf8");
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }

    originalValidationRunData = null;
  }

  await rm(validationRunDataPath, {
    force: true
  });
});

after(async () => {
  if (originalValidationRunData === null) {
    await rm(validationRunDataPath, {
      force: true
    });
    return;
  }

  await mkdir(dirname(validationRunDataPath), {
    recursive: true
  });
  await writeFile(validationRunDataPath, originalValidationRunData, "utf8");
});

function isFileNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getFirstFinding(body: Record<string, unknown>) {
  assert.equal(Array.isArray(body.findings), true);
  const findings = body.findings as unknown[];
  const finding = findings.find(
    (item) =>
      isPlainObject(item) && item.code === "DOCUMENT_NUMBER_REQUIRED"
  );

  assert.ok(finding);
  assert.equal(isPlainObject(finding), true);

  return finding as Record<string, unknown>;
}

test("invoice validation returns richer rule metadata on findings", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/validate",
    headers: {
      "x-api-key": env.DEV_API_KEY
    },
    payload: invoicePayload
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const finding = getFirstFinding(body);

  assert.equal(typeof body.validationRunId, "string");
  assert.equal(finding.severity, "fatal");
  assert.equal(finding.category, "CANONICAL");
  assert.equal(finding.fieldPath, "document.number");
  assert.equal(
    finding.message,
    "Document number is required for invoice validation readiness."
  );
  assert.equal(
    finding.fixSuggestion,
    "Add the invoice document number before validation or export."
  );
  assert.equal(finding.legalConfidence, "technical");
  assert.equal(finding.ruleSetCode, "INVOICE_LANTERN_CORE");
  assert.equal(finding.ruleVersion, "2026.04.1");
  assert.deepEqual(finding.sourceLabels, [
    "Invoice Lantern internal technical validation policy"
  ]);
});

test("validation run detail includes a structured report summary", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const validateResponse = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/validate",
    headers: {
      "x-api-key": env.DEV_API_KEY
    },
    payload: invoicePayload
  });

  assert.equal(validateResponse.statusCode, 200);

  const validateBody = validateResponse.json() as Record<string, unknown>;
  assert.equal(typeof validateBody.validationRunId, "string");
  const validationRunId = validateBody.validationRunId as string;

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/v1/validation-runs/${encodeURIComponent(validationRunId)}`,
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(detailResponse.statusCode, 200);

  const detailBody = detailResponse.json() as Record<string, unknown>;

  assert.equal(isPlainObject(detailBody.record), true);
  assert.equal(isPlainObject(detailBody.reportSummary), true);

  const reportSummary = detailBody.reportSummary as Record<string, unknown>;

  assert.equal(reportSummary.reportTitle, "Validation report");
  assert.equal(reportSummary.validationRunId, validationRunId);
  assert.equal(reportSummary.issueDate, "2026-04-29");
  assert.equal(reportSummary.overallStatus, "technical_issues_found");
  assert.equal(isPlainObject(reportSummary.findingCounts), true);
  assert.equal(
    (reportSummary.findingCounts as Record<string, unknown>).fatal,
    1
  );
  assert.match(
    String(reportSummary.disclaimer),
    /does not certify legal, tax, accounting/i
  );
  assert.equal(Array.isArray(reportSummary.recommendedNextActions), true);
});

test("rule catalog endpoint returns published core technical rules", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/validation/rules",
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;

  assert.equal(Array.isArray(body.ruleSets), true);

  const ruleSets = body.ruleSets as unknown[];
  const coreRuleSet = ruleSets.find(
    (item) =>
      isPlainObject(item) && item.code === "INVOICE_LANTERN_CORE"
  );

  assert.ok(coreRuleSet);
  assert.equal(isPlainObject(coreRuleSet), true);
  const coreRuleSetRecord = coreRuleSet as Record<string, unknown>;
  assert.equal(coreRuleSetRecord.version, "2026.04.1");
  assert.equal(Array.isArray(coreRuleSetRecord.rules), true);

  const rules = coreRuleSetRecord.rules as unknown[];
  const documentNumberRule = rules.find(
    (item) =>
      isPlainObject(item) && item.code === "DOCUMENT_NUMBER_REQUIRED"
  );

  assert.ok(documentNumberRule);
  assert.equal(isPlainObject(documentNumberRule), true);
  const documentNumberRuleRecord = documentNumberRule as Record<string, unknown>;
  assert.equal(documentNumberRuleRecord.category, "CANONICAL");
  assert.equal(documentNumberRuleRecord.severity, "fatal");
  assert.equal(documentNumberRuleRecord.legalConfidence, "technical");
  assert.deepEqual(documentNumberRuleRecord.sourceLabels, [
    "Invoice Lantern internal technical validation policy"
  ]);
});
