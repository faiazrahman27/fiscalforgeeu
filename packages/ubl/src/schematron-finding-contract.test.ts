import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_FINDING_CONTRACT_VERSION,
  SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES,
  buildSchematronArtifactNotConfiguredFinding,
  buildSchematronArtifactUnreadableFinding,
  buildSchematronExecutionDisabledFinding,
  buildSchematronFutureRuleFinding,
  normalizeSchematronLayer,
  sanitizeSchematronText,
  type SchematronContractFinding
} from "./schematron-finding-contract.js";

const prohibitedClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b/i;

function assertNoProhibitedClaims(finding: SchematronContractFinding) {
  assert.doesNotMatch(JSON.stringify(finding), prohibitedClaimPattern);
}

test("builds execution-disabled Schematron finding shape", () => {
  const finding = buildSchematronExecutionDisabledFinding({
    configured: false,
    usable: false
  });

  assert.equal(SCHEMATRON_FINDING_CONTRACT_VERSION, "schematron_contract_v1");
  assert.equal(finding.code, "SCHEMATRON_EXECUTION_NOT_ENABLED");
  assert.equal(finding.severity, "warning");
  assert.equal(finding.checkType, "schematron_peppol_placeholder");
  assert.equal(finding.field, "xml");
  assert.equal(finding.status, "not_implemented");
  assert.equal(finding.legalConfidence, "educational_simulation");
  assert.equal(finding.schematronLayer, "peppol_bis_billing");
  assert.equal(finding.technicalCode, "SCHEMATRON_EXECUTION_NOT_ENABLED");
  assert.equal(
    finding.sourceLabels?.includes("SCHEMATRON_EXECUTION_NOT_ENABLED"),
    true
  );
  assert.equal(
    SCHEMATRON_SUPPORTED_FUTURE_FINDING_CODES.includes(
      "SCHEMATRON_EXECUTION_NOT_ENABLED"
    ),
    true
  );
  assertNoProhibitedClaims(finding);
});

test("builds artefact-not-configured Schematron finding shape", () => {
  const finding = buildSchematronArtifactNotConfiguredFinding({
    layer: "en16931_tc434"
  });

  assert.equal(finding.code, "SCHEMATRON_ARTIFACT_NOT_CONFIGURED");
  assert.equal(finding.severity, "warning");
  assert.equal(finding.checkType, "schematron_peppol_placeholder");
  assert.equal(finding.field, "xml.schematron");
  assert.equal(finding.status, "not_configured");
  assert.equal(finding.legalConfidence, "technical");
  assert.equal(finding.schematronLayer, "en16931_tc434");
  assert.equal(finding.technicalCode, "SCHEMATRON_ARTIFACT_NOT_CONFIGURED");
  assertNoProhibitedClaims(finding);
});

test("builds unreadable artefact Schematron finding shape safely", () => {
  const finding = buildSchematronArtifactUnreadableFinding({
    layer: "peppol_bis_billing",
    reason:
      "Could not read D:\\local\\schematron\\peppol\\rules.sch with <schema>SECRET</schema>"
  });
  const serialized = JSON.stringify(finding);

  assert.equal(finding.code, "SCHEMATRON_ARTIFACT_UNREADABLE");
  assert.equal(finding.severity, "warning");
  assert.equal(finding.status, "error");
  assert.equal(finding.schematronLayer, "peppol_bis_billing");
  assert.equal(finding.technicalCode, "SCHEMATRON_ARTIFACT_UNREADABLE");
  assert.equal(serialized.includes("D:\\local"), false);
  assert.equal(serialized.includes("<schema>"), false);
  assert.equal(serialized.includes("SECRET"), false);
  assertNoProhibitedClaims(finding);
});

test("builds future Schematron rule finding shape with rule metadata", () => {
  const finding = buildSchematronFutureRuleFinding({
    layer: "peppol_bis_billing",
    ruleId: "PEPPOL-EN16931-R001",
    businessRuleId: "BR-CO-10",
    message:
      "Future rule BR-CO-10 failed for <cbc:ID>RAW-ID</cbc:ID> near /tmp/rules/source.sch",
    field: "document.number",
    ruleLocation: "/Invoice/cbc:ID",
    testExpression: "cbc:ID = 'expected'",
    assertionText: "Document number must be present.",
    diagnosticReference: "BR-CO-10",
    sourceLabels: ["Peppol BIS Billing", "BR-CO-10"],
    xmlLine: 12
  });
  const serialized = JSON.stringify(finding);

  assert.equal(finding.code, "PEPPOL_SCHEMATRON_RULE_FAILED");
  assert.equal(finding.severity, "fatal");
  assert.equal(finding.status, "failed");
  assert.equal(finding.schematronLayer, "peppol_bis_billing");
  assert.equal(finding.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(finding.businessRuleId, "BR-CO-10");
  assert.equal(finding.field, "document.number");
  assert.equal(finding.ruleLocation, "/Invoice/cbc:ID");
  assert.equal(finding.testExpression, "cbc:ID = 'expected'");
  assert.equal(finding.assertionText, "Document number must be present.");
  assert.equal(finding.diagnosticReference, "BR-CO-10");
  assert.equal(finding.xmlLine, 12);
  assert.equal(serialized.includes("<cbc:ID>"), false);
  assert.equal(serialized.includes("RAW-ID"), false);
  assert.equal(serialized.includes("/tmp/rules/source.sch"), false);
  assertNoProhibitedClaims(finding);
});

test("sanitizes raw XML snippets, local paths, file URLs, and controls", () => {
  const sanitized = sanitizeSchematronText(
    "BR-CO-10 <Invoice><cbc:ID>SECRET</cbc:ID></Invoice> " +
      "<anything attr=\"x\">VALUE</anything> " +
      "D:\\private\\schematron\\rules.sch " +
      "file:///tmp/schematron/rules.sch " +
      "/home/user/schematron/rules.sch " +
      "/Users/user/schematron/rules.sch " +
      "/tmp/schematron/rules.sch \u0000 \u0008 done"
  );

  assert.match(sanitized, /BR-CO-10/);
  assert.doesNotMatch(sanitized, /<Invoice|<\/Invoice|cbc:ID|SECRET/);
  assert.doesNotMatch(sanitized, /<anything|VALUE/);
  assert.doesNotMatch(sanitized, /D:\\private/);
  assert.doesNotMatch(sanitized, /file:\/\/\//);
  assert.doesNotMatch(sanitized, /\/home\/user/);
  assert.doesNotMatch(sanitized, /\/Users\/user/);
  assert.doesNotMatch(sanitized, /\/tmp\/schematron/);
  assert.doesNotMatch(sanitized, /[\u0000-\u001F\u007F]/);
  assert.match(sanitized, /done/);
});

test("sanitization preserves safe business rule identifiers and limits length", () => {
  const sanitized = sanitizeSchematronText(
    `BR-CO-10 PEPPOL-EN16931-R001 UBL-CR-001 ${"x".repeat(200)}`,
    40
  );

  assert.match(sanitized, /BR-CO-10/);
  assert.match(sanitized, /PEPPOL-EN16931-R001/);
  assert.equal(sanitized.length, 40);
});

test("normalizes unknown Schematron layers conservatively", () => {
  assert.equal(normalizeSchematronLayer("peppol_bis_billing"), "peppol_bis_billing");
  assert.equal(normalizeSchematronLayer("en16931_tc434"), "en16931_tc434");
  assert.equal(normalizeSchematronLayer("local-custom"), "unknown");
  assert.equal(normalizeSchematronLayer(undefined), "unknown");
});

test("generated Schematron findings avoid prohibited assurance claims", () => {
  const findings = [
    buildSchematronExecutionDisabledFinding(),
    buildSchematronArtifactNotConfiguredFinding(),
    buildSchematronArtifactUnreadableFinding({
      layer: "unknown",
      reason: "EACCES"
    }),
    buildSchematronFutureRuleFinding({
      layer: "en16931_tc434",
      businessRuleId: "BR-CO-10"
    })
  ];

  for (const finding of findings) {
    assertNoProhibitedClaims(finding);
  }
});
