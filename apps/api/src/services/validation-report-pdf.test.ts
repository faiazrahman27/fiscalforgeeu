import assert from "node:assert/strict";
import { test } from "node:test";
import type { ValidationRunRecord } from "../repositories/validation-run-repository.js";
import {
  VALIDATION_REPORT_DISCLAIMER,
  buildValidationReportSummary
} from "./validation-report-summary.js";
import { generateValidationReportPdf } from "./validation-report-pdf.js";

function buildValidationRun(): ValidationRunRecord {
  return {
    id: "val_pdf_test",
    invoiceNumber: "INV-PDF-100",
    buyer: "Buyer GmbH",
    buyerCountry: "DE",
    seller: "Seller GmbH",
    sellerCountry: "DE",
    issueDate: "2026-04-30",
    createdAt: "2026-04-30T08:00:00.000Z",
    technicalStatus: "failed",
    standardStatus: "warning",
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
    findings: [
      {
        code: "DOCUMENT_NUMBER_REQUIRED",
        severity: "fatal",
        category: "CANONICAL",
        field: "document.number",
        fieldPath: "document.number",
        message: "Document number is required for invoice validation readiness.",
        fixSuggestion:
          "Add the invoice document number before validation or export.",
        legalConfidence: "technical",
        ruleSetCode: "INVOICE_LANTERN_CORE",
        ruleVersion: "2026.04.1",
        sourceLabels: ["Invoice Lantern internal technical validation policy"]
      }
    ],
    disclaimer: "Existing API disclaimer."
  };
}

function extractPdfText(pdfBuffer: Buffer) {
  const rawPdf = pdfBuffer.toString("latin1");
  const decodedHexText = [...rawPdf.matchAll(/<([0-9a-fA-F]{2,})>/g)]
    .map((match) => Buffer.from(match[1] ?? "", "hex").toString("latin1"))
    .join("");

  return `${rawPdf}\n${decodedHexText}`;
}

test("validation report PDF service returns a non-empty PDF buffer", async () => {
  const run = buildValidationRun();
  const pdfBuffer = await generateValidationReportPdf({
    run,
    reportSummary: buildValidationReportSummary(run),
    generatedAt: new Date("2026-04-30T10:00:00.000Z")
  });

  assert.equal(Buffer.isBuffer(pdfBuffer), true);
  assert.ok(pdfBuffer.length > 1000);
  assert.equal(pdfBuffer.subarray(0, 4).toString("utf8"), "%PDF");
});

test("validation report PDF includes the required disclaimer text", async () => {
  const run = buildValidationRun();
  const pdfBuffer = await generateValidationReportPdf({
    run,
    reportSummary: buildValidationReportSummary(run),
    generatedAt: new Date("2026-04-30T10:00:00.000Z")
  });
  const pdfText = extractPdfText(pdfBuffer);

  assert.match(pdfText, /Invoice Lantern/);
  assert.match(pdfText, /Non-official technical sandbox report/);
  assert.match(pdfText, /does not certify legal, tax, accounting/i);
  assert.match(pdfText, /consult a qualified accountant/i);
  assert.equal(VALIDATION_REPORT_DISCLAIMER.includes("Peppol"), true);
});

test("validation report PDF includes VAT warning finding text", async () => {
  const run = buildValidationRun();

  run.findings = [
    {
      code: "BUYER_VAT_ID_LOCAL_FORMAT_INVALID",
      severity: "warning",
      category: "VAT_ID",
      field: "buyer.vatId",
      fieldPath: "buyer.vatId",
      message:
        "Buyer VAT ID does not match a supported expected local format pattern for Germany. This is a technical format check only, not a VIES check, does not confirm VAT registration, and is not a legal/tax conclusion.",
      fixSuggestion:
        "Check the country prefix, remove spaces, and verify the VAT number with VIES or a competent authority if needed.",
      legalConfidence: "technical",
      ruleSetCode: "INVOICE_LANTERN_VAT_FORMAT",
      ruleVersion: "2026.04.1",
      sourceLabels: ["Invoice Lantern VAT format rules"]
    }
  ];

  const pdfBuffer = await generateValidationReportPdf({
    run,
    reportSummary: buildValidationReportSummary(run),
    generatedAt: new Date("2026-04-30T10:00:00.000Z")
  });
  const pdfText = extractPdfText(pdfBuffer);

  assert.match(pdfText, /BUYER_VAT_ID_LOCAL_FORMAT_INVALID/);
  assert.match(pdfText, /Buyer VAT ID does not match/i);
  assert.match(pdfText, /Invoice Lantern VAT format rules/);
  assert.match(pdfText, /not a VIES check/i);
});
