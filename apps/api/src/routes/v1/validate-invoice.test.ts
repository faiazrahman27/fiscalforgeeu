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
      "Invoice Lantern VAT format rules"
    ]);
    assert.match(String(finding.message), /not a VIES check/i);
    assert.match(String(finding.message), /does not confirm VAT registration/i);
  }

  assert.equal(sellerFinding.fieldPath, "seller.vatId");
  assert.equal(buyerFinding.fieldPath, "buyer.vatId");
  assert.match(String(sellerFinding.message), /Germany/i);
  assert.match(String(sellerFinding.message), /not legal\/tax advice/i);
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
  assert.equal(
    (reportSummary.findingCounts as Record<string, unknown>).warning,
    1
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
