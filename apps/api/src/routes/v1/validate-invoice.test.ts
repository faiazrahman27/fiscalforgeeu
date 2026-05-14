import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import {
  getOrganizationValidationRunById,
  listOrganizationValidationRuns,
  saveValidationRun,
  type ValidationRunRecord
} from "../../repositories/validation-run-repository.js";
import {
  resetViesServiceTestingOverrides,
  setViesServiceConfigForTesting,
  setViesTransportForTesting
} from "../../services/vies-check-service.js";

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
  resetViesServiceTestingOverrides();

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

function getFindingsFromBody(body: Record<string, unknown>) {
  assert.equal(Array.isArray(body.findings), true);

  return body.findings as Record<string, unknown>[];
}

function getFindingByCode(body: Record<string, unknown>, code: string) {
  const finding = getFindingsFromBody(body).find(
    (item) => isPlainObject(item) && item.code === code
  );

  assert.ok(finding, `Expected finding ${code}`);

  return finding;
}

function extractPdfText(pdfBody: string) {
  const decodedHexText = [...pdfBody.matchAll(/<([0-9a-fA-F]{2,})>/g)]
    .map((match) => Buffer.from(match[1] ?? "", "hex").toString("latin1"))
    .join("");

  return `${pdfBody}\n${decodedHexText}`;
}

function buildInvoicePayload(overrides: {
  documentNumber?: string;
  sellerCountry?: string;
  sellerVatId?: string;
  buyerCountry?: string;
  buyerVatId?: string;
} = {}) {
  const payload = structuredClone(invoicePayload);

  payload.document.number = overrides.documentNumber ?? "INV-VAT-001";
  payload.seller.country = overrides.sellerCountry ?? "DE";
  payload.seller.vatId = overrides.sellerVatId ?? "DE123456789";
  payload.buyer.country = overrides.buyerCountry ?? "DE";
  payload.buyer.vatId = overrides.buyerVatId ?? "DE987654321";

  return payload;
}

function buildStoredValidationRun(
  id: string,
  organizationId: string,
  invoiceNumber: string
): ValidationRunRecord {
  return {
    id,
    organizationId,
    invoiceNumber,
    buyer: "Tenant scoped buyer",
    buyerCountry: "DE",
    seller: "Tenant scoped seller",
    sellerCountry: "DE",
    issueDate: "2026-04-29",
    createdAt: new Date().toISOString(),
    technicalStatus: "passed",
    standardStatus: "ready",
    countrySimulationStatus: "not_relevant",
    vidaReadinessStatus: "not_relevant",
    confidence: "technical_preview",
    profile: "API_VALIDATION",
    currency: "EUR",
    totals: {
      lineExtensionAmount: "100.00",
      taxExclusiveAmount: "100.00",
      taxAmount: "19.00",
      taxInclusiveAmount: "119.00",
      payableAmount: "119.00"
    },
    findings: [],
    disclaimer:
      "Stored validation runs are non-official technical sandbox records and are not legal, tax, accounting, or authority conclusions."
  };
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
  assert.equal(finding.ruleId, "DOCUMENT_NUMBER_REQUIRED");
  assert.equal(finding.checkType, "canonical");
  assert.equal(finding.layer, "canonical");
  assert.equal(finding.ruleSetCode, "INVOICE_LANTERN_CORE");
  assert.equal(finding.ruleVersion, "2026.05.1");
  assert.deepEqual(finding.sourceLabels, [
    "Invoice Lantern internal technical validation policy",
    "Invoice Lantern validation engine mapping policy"
  ]);
  assert.equal(isPlainObject(body.validationSummary), true);
  assert.equal(
    (body.validationSummary as Record<string, unknown>).totalFindings,
    (body.findings as unknown[]).length
  );
});

test("invoice validation includes seller and buyer VAT local format info findings", async (t) => {
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
    payload: buildInvoicePayload({
      sellerVatId: "DE123456789",
      buyerVatId: "DE987654321"
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const checkOnlyFinding = getFindingByCode(body, "VAT_ID_LOCAL_FORMAT_CHECK_ONLY");
  const sellerFinding = getFindingByCode(
    body,
    "SELLER_VAT_ID_LOCAL_FORMAT_VALID"
  );
  const buyerFinding = getFindingByCode(
    body,
    "BUYER_VAT_ID_LOCAL_FORMAT_VALID"
  );

  for (const finding of [checkOnlyFinding, sellerFinding, buyerFinding]) {
    assert.equal(finding.severity, "info");
    assert.equal(finding.category, "VAT_ID");
    assert.equal(finding.legalConfidence, "technical");
    assert.equal(finding.ruleSetCode, "INVOICE_LANTERN_VAT_FORMAT");
    assert.deepEqual(finding.sourceLabels, [
      "Invoice Lantern VAT format rules",
      "Invoice Lantern validation engine mapping policy"
    ]);
    assert.match(String(finding.message), /not a VIES check/i);
    assert.match(String(finding.message), /does not confirm VAT registration/i);
  }

  assert.equal(sellerFinding.fieldPath, "seller.vatId");
  assert.equal(buyerFinding.fieldPath, "buyer.vatId");
  assert.match(String(sellerFinding.message), /Germany/i);
  assert.match(String(sellerFinding.message), /not legal\/tax advice/i);
});

test("invoice validation maps supplied XML worker findings into summary dimensions", async (t) => {
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
    payload: {
      invoice: buildInvoicePayload(),
      xmlFindings: [
        {
          code: "UBL_XSD_VALIDATION_FAILED",
          severity: "fatal",
          checkType: "xsd_ubl",
          field: "Invoice/LegalMonetaryTotal",
          message: "The UBL XML failed local XSD validation.",
          status: "failed",
          legalConfidence: "technical",
          sourceLabels: ["UBL 2.1 local XSD artifact"]
        },
        {
          code: "PEPPOL_SCHEMATRON_RULE_FAILED",
          severity: "warning",
          checkType: "schematron_peppol",
          field: "/Invoice/cbc:CustomizationID",
          message: "A guarded local Schematron assertion failed.",
          status: "failed",
          legalConfidence: "educational_simulation",
          schematronLayer: "peppol_bis_billing",
          businessRuleId: "PEPPOL-EN16931-R001"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const xsdFinding = getFindingByCode(body, "UBL_XSD_VALIDATION_FAILED");
  const schematronFinding = getFindingByCode(
    body,
    "PEPPOL_SCHEMATRON_RULE_FAILED"
  );
  const summary = body.validationSummary as Record<string, unknown>;

  assert.equal(xsdFinding.category, "SCHEMA");
  assert.equal(xsdFinding.checkType, "xsd_ubl");
  assert.equal(schematronFinding.category, "PEPPOL");
  assert.equal(schematronFinding.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(
    (summary.byCheckType as Record<string, unknown>).xsd_ubl,
    1
  );
  assert.equal(
    (summary.byLegalConfidence as Record<string, unknown>)
      .educational_simulation,
    1
  );
});

test("invoice validation keeps live VIES explicit and disabled by default", async (t) => {
  const app = await buildApp();
  let transportCalls = 0;

  t.after(async () => {
    resetViesServiceTestingOverrides();
    await app.close();
  });

  setViesServiceConfigForTesting({
    enabled: false
  });
  setViesTransportForTesting(async () => {
    transportCalls += 1;
    throw new Error("VIES transport should not run while disabled.");
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/invoices/validate",
    headers: {
      "x-api-key": env.DEV_API_KEY
    },
    payload: {
      invoice: buildInvoicePayload({
        sellerVatId: "DE123456789",
        buyerVatId: "DE987654321"
      }),
      viesMode: "live"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transportCalls, 0);

  const body = response.json() as Record<string, unknown>;
  const viesChecks = body.viesChecks as Record<string, unknown>[];
  const viesFinding = getFindingByCode(body, "VIES_EVIDENCE_NOT_CHECKED");

  assert.equal(body.viesMode, "live");
  assert.equal(viesChecks[0]?.status, "not_checked");
  assert.equal(viesChecks[0]?.viesValid, null);
  assert.equal(viesFinding.category, "VIES");
  assert.match(String(body.disclaimer), /VAT format valid does not mean VIES valid/i);
});

test("invoice validation warns when buyer VAT local format is invalid", async (t) => {
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
    payload: buildInvoicePayload({
      buyerVatId: "DE123"
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const finding = getFindingByCode(body, "BUYER_VAT_ID_LOCAL_FORMAT_INVALID");

  assert.equal(finding.severity, "warning");
  assert.equal(finding.category, "VAT_ID");
  assert.equal(finding.fieldPath, "buyer.vatId");
  assert.match(String(finding.message), /technical format check only/i);
  assert.match(String(finding.message), /not a VIES check/i);
  assert.match(String(finding.message), /not a legal\/tax conclusion/i);
  assert.match(String(finding.fixSuggestion), /verify the VAT number with VIES/i);
});

test("invoice validation warns when seller VAT local format is invalid", async (t) => {
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
    payload: buildInvoicePayload({
      sellerCountry: "HU",
      sellerVatId: "HU123",
      buyerCountry: "HU",
      buyerVatId: "HU12345678"
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const finding = getFindingByCode(body, "SELLER_VAT_ID_LOCAL_FORMAT_INVALID");

  assert.equal(finding.severity, "warning");
  assert.equal(finding.category, "VAT_ID");
  assert.equal(finding.fieldPath, "seller.vatId");
  assert.match(String(finding.message), /Hungary/i);
  assert.match(String(finding.sourceLabels), /Invoice Lantern VAT format rules/i);
});

test("invoice validation warns on VAT country hint mismatch", async (t) => {
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
    payload: buildInvoicePayload({
      sellerCountry: "HU",
      sellerVatId: "DE123456789",
      buyerCountry: "HU",
      buyerVatId: "HU12345678"
    })
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  const finding = getFindingByCode(
    body,
    "SELLER_VAT_ID_COUNTRY_HINT_MISMATCH"
  );

  assert.equal(finding.severity, "warning");
  assert.equal(finding.category, "VAT_ID");
  assert.equal(finding.fieldPath, "seller.vatId");
  assert.match(String(finding.message), /prefix DE/i);
  assert.match(String(finding.message), /country hint HU/i);
  assert.match(String(finding.fixSuggestion), /prefix matches the party country/i);
});

test("stored validation run payload includes VAT findings and warning counts", async (t) => {
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
    payload: buildInvoicePayload({
      documentNumber: "INV-STORED-VAT",
      buyerVatId: "DE123"
    })
  });

  assert.equal(validateResponse.statusCode, 200);

  const validateBody = validateResponse.json() as Record<string, unknown>;
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

  const record = detailBody.record as Record<string, unknown>;
  const reportSummary = detailBody.reportSummary as Record<string, unknown>;

  assert.equal(Array.isArray(record.findings), true);
  const storedFindings = record.findings as Record<string, unknown>[];

  assert.ok(
    storedFindings.some(
      (finding) => finding.code === "BUYER_VAT_ID_LOCAL_FORMAT_INVALID"
    )
  );
  assert.ok(
    storedFindings.some(
      (finding) =>
        finding.category === "COUNTRY_PACK" &&
        typeof finding.countryPackVersion === "string" &&
        typeof finding.countryPackStatus === "string"
    )
  );
  assert.equal(record.countrySimulationStatus, "review_required");
  assert.ok(
    (reportSummary.findingCounts as Record<string, unknown>).warning,
    "report summary should include warning findings"
  );
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

test("validation run PDF endpoint returns a downloadable PDF report", async (t) => {
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

  const pdfResponse = await app.inject({
    method: "GET",
    url: `/api/v1/validation-runs/${encodeURIComponent(
      validationRunId
    )}/report.pdf`,
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(pdfResponse.statusCode, 200);
  assert.match(String(pdfResponse.headers["content-type"]), /^application\/pdf/i);
  assert.match(
    String(pdfResponse.headers["content-disposition"]),
    /^attachment; filename="invoice-lantern-validation-report-[a-zA-Z0-9._-]+\.pdf"$/
  );
  assert.equal(pdfResponse.body.slice(0, 4), "%PDF");
  assert.match(
    extractPdfText(pdfResponse.body),
    /Non-official technical sandbox report/
  );
});

test("validation run PDF report includes VAT warning text", async (t) => {
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
    payload: buildInvoicePayload({
      documentNumber: "INV-PDF-VAT",
      buyerVatId: "DE123"
    })
  });

  assert.equal(validateResponse.statusCode, 200);

  const validateBody = validateResponse.json() as Record<string, unknown>;
  const validationRunId = validateBody.validationRunId as string;

  const pdfResponse = await app.inject({
    method: "GET",
    url: `/api/v1/validation-runs/${encodeURIComponent(
      validationRunId
    )}/report.pdf`,
    headers: {
      "x-api-key": env.DEV_API_KEY
    }
  });

  assert.equal(pdfResponse.statusCode, 200);

  const pdfText = extractPdfText(pdfResponse.body);

  assert.match(pdfText, /BUYER_VAT_ID_LOCAL_FORMAT_INVALID/);
  assert.match(pdfText, /Buyer VAT ID does not match/i);
  assert.match(pdfText, /not a VIES check/i);
});

test("validation run PDF endpoint requires authentication", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const pdfResponse = await app.inject({
    method: "GET",
    url: "/api/v1/validation-runs/not-real/report.pdf"
  });

  assert.equal(pdfResponse.statusCode, 401);
});

test("organization validation-run reads are tenant scoped in JSON storage", async () => {
  const organizationA = "00000000-0000-4000-8000-0000000000a1";
  const organizationB = "00000000-0000-4000-8000-0000000000b1";
  const runA = buildStoredValidationRun(
    "validation-run-org-a",
    organizationA,
    "INV-ORG-A"
  );
  const runB = buildStoredValidationRun(
    "validation-run-org-b",
    organizationB,
    "INV-ORG-B"
  );

  await saveValidationRun(runA);
  await saveValidationRun(runB);

  const organizationARuns = await listOrganizationValidationRuns(organizationA);
  const organizationBRunFromA = await getOrganizationValidationRunById(
    organizationA,
    runB.id
  );
  const organizationARunFromA = await getOrganizationValidationRunById(
    organizationA,
    runA.id
  );

  assert.equal(
    organizationARuns.some((run) => run.id === runA.id),
    true
  );
  assert.equal(
    organizationARuns.some((run) => run.id === runB.id),
    false
  );
  assert.equal(organizationBRunFromA, null);
  assert.equal(organizationARunFromA?.id, runA.id);
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
  assert.equal(coreRuleSetRecord.version, "2026.05.1");
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

  const vatRuleSet = ruleSets.find(
    (item) =>
      isPlainObject(item) && item.code === "INVOICE_LANTERN_VAT_FORMAT"
  );

  assert.ok(vatRuleSet);
  assert.equal(isPlainObject(vatRuleSet), true);
  const vatRuleSetRecord = vatRuleSet as Record<string, unknown>;
  assert.equal(vatRuleSetRecord.version, "2026.04.1");
  assert.equal(Array.isArray(vatRuleSetRecord.rules), true);

  const vatRules = vatRuleSetRecord.rules as unknown[];
  const buyerVatInvalidRule = vatRules.find(
    (item) =>
      isPlainObject(item) && item.code === "BUYER_VAT_ID_LOCAL_FORMAT_INVALID"
  );

  assert.ok(buyerVatInvalidRule);
  assert.equal(isPlainObject(buyerVatInvalidRule), true);
  const buyerVatInvalidRuleRecord = buyerVatInvalidRule as Record<
    string,
    unknown
  >;
  assert.equal(buyerVatInvalidRuleRecord.category, "VAT_ID");
  assert.equal(buyerVatInvalidRuleRecord.severity, "warning");
  assert.equal(buyerVatInvalidRuleRecord.legalConfidence, "technical");
  assert.deepEqual(buyerVatInvalidRuleRecord.sourceLabels, [
    "Invoice Lantern VAT format rules"
  ]);
  assert.match(
    String(buyerVatInvalidRuleRecord.messageTemplate),
    /not a VIES check/i
  );
});
