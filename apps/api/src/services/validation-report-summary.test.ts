import assert from "node:assert/strict";
import { test } from "node:test";
import type { ValidationRunRecord } from "../repositories/validation-run-repository.js";
import {
  VALIDATION_REPORT_DISCLAIMER,
  buildValidationReportSummary
} from "./validation-report-summary.js";

function buildValidationRun(
  overrides: Partial<ValidationRunRecord> = {}
): ValidationRunRecord {
  return {
    id: "val_test",
    invoiceNumber: "INV-100",
    buyer: "Buyer GmbH",
    seller: "Seller GmbH",
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
    findings: [],
    disclaimer: "Existing API disclaimer.",
    ...overrides
  };
}

test("validation report summary counts finding severities", () => {
  const summary = buildValidationReportSummary(
    buildValidationRun({
      findings: [
        {
          code: "INFO_RULE",
          severity: "info",
          category: "CANONICAL",
          field: "document.number",
          fieldPath: "document.number",
          message: "Informational finding.",
          legalConfidence: "technical"
        },
        {
          code: "WARNING_RULE",
          severity: "warning",
          category: "CANONICAL",
          field: "buyer.country",
          fieldPath: "buyer.country",
          message: "Warning finding.",
          legalConfidence: "professional_review_required",
          ruleSetCode: "INVOICE_LANTERN_CORE",
          ruleVersion: "2026.04.1",
          sourceLabels: ["Invoice Lantern internal technical validation policy"]
        },
        {
          code: "FATAL_RULE",
          severity: "fatal",
          category: "CALCULATION",
          field: "totals.payableAmount",
          fieldPath: "totals.payableAmount",
          message: "Fatal finding.",
          legalConfidence: "technical"
        },
        {
          code: "BLOCKED_RULE",
          severity: "blocked",
          category: "SCHEMA",
          field: "invoice",
          fieldPath: "invoice",
          message: "Blocked finding.",
          legalConfidence: "technical"
        }
      ]
    })
  );

  assert.deepEqual(summary.findingCounts, {
    info: 1,
    warning: 1,
    fatal: 1,
    blocked: 1
  });
  assert.equal(summary.overallStatus, "technical_issues_found");
  assert.equal(summary.ruleSetsUsed[0]?.code, "INVOICE_LANTERN_CORE");
});

test("validation report summary includes the legally safe disclaimer", () => {
  const summary = buildValidationReportSummary(buildValidationRun());

  assert.equal(summary.disclaimer, VALIDATION_REPORT_DISCLAIMER);
  assert.match(summary.disclaimer, /does not certify legal, tax, accounting/i);
  assert.match(summary.disclaimer, /consult a qualified accountant/i);
});

test("validation report summary recommends safe next actions", () => {
  const noFindingSummary = buildValidationReportSummary(
    buildValidationRun({
      technicalStatus: "passed",
      standardStatus: "ready"
    })
  );

  assert.deepEqual(noFindingSummary.recommendedNextActions, [
    "No selected technical issues were detected by this sandbox rule set. This is not legal/tax certification."
  ]);

  const warningSummary = buildValidationReportSummary(
    buildValidationRun({
      technicalStatus: "passed",
      standardStatus: "warning",
      findings: [
        {
          code: "WARNING_RULE",
          severity: "warning",
          category: "LEGAL_LABEL",
          field: "buyer.country",
          fieldPath: "buyer.country",
          message: "Review warning.",
          legalConfidence: "professional_review_required"
        }
      ]
    })
  );

  assert.deepEqual(warningSummary.recommendedNextActions, [
    "Review warnings and seek professional advice where required."
  ]);
});
