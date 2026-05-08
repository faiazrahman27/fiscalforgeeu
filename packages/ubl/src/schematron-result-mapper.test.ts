import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_RESULT_MAPPER_VERSION,
  mapSchematronSvrlResultsToFindings,
  normalizeSchematronSvrlFlag,
  type SchematronContractFinding,
  type SchematronResultMappingResult,
  type SchematronSvrlInputResult
} from "./index.js";

const rawXml = "<Invoice><ID>SECRET</ID></Invoice>";
const windowsAbsolutePath = "D:\\secret\\file.sch";
const unixAbsolutePath = "/home/user/secret.sch";
const fileUrl = "file:///secret/file.sch";
const forbiddenClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

function assertNoRawXml(output: SchematronResultMappingResult) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes("<Invoice"), false);
  assert.equal(serialized.includes("<ID>"), false);
  assert.equal(serialized.includes("</Invoice>"), false);
  assert.equal(serialized.includes("SECRET"), false);
}

function assertNoUnsafePaths(output: SchematronResultMappingResult) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(windowsAbsolutePath), false);
  assert.equal(serialized.includes(unixAbsolutePath), false);
  assert.equal(serialized.includes(fileUrl), false);
  assert.doesNotMatch(serialized, /[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/home\/user\/[A-Za-z0-9_.-]+/);
  assert.doesNotMatch(serialized, /file:\/\/\//i);
}

function assertNoForbiddenClaims(output: SchematronResultMappingResult) {
  assert.doesNotMatch(JSON.stringify(output), forbiddenClaimPattern);
}

function baseFailedAssert(
  override: Partial<SchematronSvrlInputResult> = {}
): SchematronSvrlInputResult {
  return {
    kind: "failed_assert",
    id: "PEPPOL-EN16931-R001",
    businessRuleId: "BR-CO-10",
    flag: "error",
    location: "/Invoice/cbc:ID",
    test: "normalize-space(cbc:ID) != ''",
    text: "BR-CO-10 failed because the document identifier is missing.",
    diagnosticReference: "BR-CO-10",
    ...override
  };
}

test("empty input returns no findings and zero counts", () => {
  const result = mapSchematronSvrlResultsToFindings({
    results: []
  });

  assert.equal(result.mapperVersion, SCHEMATRON_RESULT_MAPPER_VERSION);
  assert.equal(result.summary.mapperVersion, SCHEMATRON_RESULT_MAPPER_VERSION);
  assert.equal(result.summary.diagnosticKind, "schematron_result_mapping");
  assert.equal(result.summary.layer, "unknown");
  assert.equal(result.summary.inputResultCount, 0);
  assert.equal(result.summary.mappedFindingCount, 0);
  assert.equal(result.summary.failedAssertCount, 0);
  assert.equal(result.summary.successfulReportCount, 0);
  assert.equal(result.summary.fatalCount, 0);
  assert.equal(result.summary.warningCount, 0);
  assert.equal(result.summary.infoCount, 0);
  assert.equal(result.summary.truncated, false);
  assert.deepEqual(result.findings, []);
});

test("Peppol failed assert maps to a sanitized Peppol Schematron finding", () => {
  const result = mapSchematronSvrlResultsToFindings({
    layer: "peppol_bis_billing",
    results: [baseFailedAssert()]
  });
  const finding = result.findings[0] as SchematronContractFinding;

  assert.equal(finding.code, "PEPPOL_SCHEMATRON_RULE_FAILED");
  assert.equal(finding.severity, "fatal");
  assert.equal(finding.status, "failed");
  assert.equal(finding.legalConfidence, "technical");
  assert.equal(finding.checkType, "schematron_peppol_placeholder");
  assert.equal(finding.field, "/Invoice/cbc:ID");
  assert.equal(finding.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(finding.businessRuleId, "BR-CO-10");
  assert.equal(finding.schematronLayer, "peppol_bis_billing");
  assert.equal(finding.ruleLocation, "/Invoice/cbc:ID");
  assert.equal(finding.testExpression, "normalize-space(cbc:ID) != ''");
  assert.match(finding.message, /BR-CO-10 failed/);
  assert.equal(finding.assertionText, finding.message);
  assert.equal(finding.diagnosticReference, "BR-CO-10");
  assert.equal(finding.technicalCode, "PEPPOL_SCHEMATRON_RULE_FAILED");
  assert.equal(result.summary.failedAssertCount, 1);
  assert.equal(result.summary.fatalCount, 1);
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("EN 16931 failed assert maps to EN16931 Schematron rule code", () => {
  const result = mapSchematronSvrlResultsToFindings({
    layer: "en16931_tc434",
    results: [
      baseFailedAssert({
        id: "BR-EN-001",
        flag: "fatal"
      })
    ]
  });

  assert.equal(result.findings[0]?.code, "EN16931_SCHEMATRON_RULE_FAILED");
  assert.equal(result.findings[0]?.severity, "fatal");
  assert.equal(result.findings[0]?.schematronLayer, "en16931_tc434");
});

test("unknown layer failed assert maps to generic Schematron assertion code", () => {
  const result = mapSchematronSvrlResultsToFindings({
    results: [
      baseFailedAssert({
        flag: "warning",
        id: "LOCAL-R001"
      })
    ]
  });

  assert.equal(result.findings[0]?.code, "SCHEMATRON_ASSERTION_FAILED");
  assert.equal(result.findings[0]?.severity, "warning");
  assert.equal(result.findings[0]?.status, "failed");
  assert.equal(result.findings[0]?.schematronLayer, "unknown");
});

test("successful report maps to report warning code with stable info behavior", () => {
  const result = mapSchematronSvrlResultsToFindings({
    layer: "peppol_bis_billing",
    results: [
      {
        kind: "successful_report",
        id: "PEPPOL-REPORT-R001",
        flag: "warning",
        location: "/Invoice",
        test: "true()",
        text: "A Schematron report item was emitted."
      },
      {
        kind: "successful_report",
        id: "PEPPOL-REPORT-R002",
        flag: "info",
        role: "information",
        location: "/Invoice/ProfileID",
        test: "true()",
        text: "Informational report item."
      }
    ]
  });

  assert.equal(result.findings.length, 2);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_REPORT_WARNING");
  assert.equal(result.findings[0]?.severity, "warning");
  assert.equal(result.findings[0]?.status, "warning");
  assert.equal(result.findings[1]?.code, "SCHEMATRON_REPORT_WARNING");
  assert.equal(result.findings[1]?.severity, "info");
  assert.equal(result.findings[1]?.status, "warning");
  assert.equal(result.summary.successfulReportCount, 2);
  assert.equal(result.summary.warningCount, 1);
  assert.equal(result.summary.infoCount, 1);
});

test("maxResults truncates output and summary counts deterministically", () => {
  const results = Array.from({ length: 5 }, (_, index) =>
    index === 1
      ? ({
          kind: "successful_report",
          id: `REPORT-${index}`,
          flag: "warning",
          text: `Report ${index}`
        } satisfies SchematronSvrlInputResult)
      : baseFailedAssert({
          id: `ASSERT-${index}`,
          flag: "error",
          text: `Assert ${index}`
        })
  );
  const result = mapSchematronSvrlResultsToFindings({
    layer: "peppol_bis_billing",
    results,
    maxResults: 2
  });

  assert.equal(result.findings.length, 2);
  assert.equal(result.summary.inputResultCount, 5);
  assert.equal(result.summary.mappedFindingCount, 2);
  assert.equal(result.summary.failedAssertCount, 1);
  assert.equal(result.summary.successfulReportCount, 1);
  assert.equal(result.summary.fatalCount, 1);
  assert.equal(result.summary.warningCount, 1);
  assert.equal(result.summary.truncated, true);
  assert.deepEqual(
    result.findings.map((finding) => finding.ruleId),
    ["ASSERT-0", "REPORT-1"]
  );
});

test("sanitization removes XML, local paths, file URLs, and controls while preserving rule IDs", () => {
  const result = mapSchematronSvrlResultsToFindings({
    layer: "peppol_bis_billing",
    results: [
      baseFailedAssert({
        id: `PEPPOL-EN16931-R001\u0000`,
        businessRuleId: "BR-CO-10",
        location: `${rawXml} ${windowsAbsolutePath}`,
        test: `${rawXml} ${unixAbsolutePath} \u0001`,
        text: `BR-CO-10 ${rawXml} ${windowsAbsolutePath} ${unixAbsolutePath} ${fileUrl} \u0007done`,
        diagnostics: [`diagnostic ${rawXml} ${windowsAbsolutePath}`],
        diagnosticReference: `BR-CO-10 ${unixAbsolutePath}`,
        see: fileUrl
      })
    ]
  });
  const finding = result.findings[0] as SchematronContractFinding;
  const serialized = JSON.stringify(result);

  assert.equal(finding.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(finding.businessRuleId, "BR-CO-10");
  assert.equal(finding.field, "xml");
  assert.match(finding.message, /BR-CO-10/);
  assert.match(finding.message, /done/);
  assert.equal(serialized.includes("BR-CO-10"), true);
  assert.equal(serialized.includes("PEPPOL-EN16931-R001"), true);
  assert.doesNotMatch(serialized, /[\u0000-\u001F\u007F]/);
  assertNoRawXml(result);
  assertNoUnsafePaths(result);
  assertNoForbiddenClaims(result);
});

test("mapper output does not preserve forbidden assurance claims from input text", () => {
  const result = mapSchematronSvrlResultsToFindings({
    layer: "peppol_bis_billing",
    results: [
      baseFailedAssert({
        text:
          "certified compliant accepted by authority legally valid Peppol passed EN 16931 passed"
      })
    ]
  });

  assert.match(result.findings[0]?.message ?? "", /\[assurance-claim\]/);
  assertNoForbiddenClaims(result);
});

test("SVRL flag normalization is conservative", () => {
  assert.equal(normalizeSchematronSvrlFlag("fatal"), "fatal");
  assert.equal(normalizeSchematronSvrlFlag("error"), "error");
  assert.equal(normalizeSchematronSvrlFlag("warning"), "warning");
  assert.equal(normalizeSchematronSvrlFlag("info"), "info");
  assert.equal(normalizeSchematronSvrlFlag("custom"), "unknown");
  assert.equal(normalizeSchematronSvrlFlag(undefined), "unknown");
});
