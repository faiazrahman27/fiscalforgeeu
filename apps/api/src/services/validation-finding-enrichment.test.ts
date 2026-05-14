import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildValidationFindingSummary,
  enrichValidationFinding,
  mapXmlValidationFindingToEnriched
} from "./validation-finding-enrichment.js";
import type { XmlValidationJobFinding } from "./xml-validation-job-service.js";

test("validation enrichment preserves rule metadata on calculation findings", () => {
  const finding = enrichValidationFinding({
    code: "PAYABLE_AMOUNT_MISMATCH",
    severity: "fatal",
    category: "CALCULATION",
    field: "totals.payableAmount",
    fieldPath: "totals.payableAmount",
    message: "Payable total does not match the calculated tax-inclusive amount.",
    legalConfidence: "technical",
    ruleSetCode: "INVOICE_LANTERN_CORE",
    ruleVersion: "2026.05.1",
    sourceLabels: ["Invoice Lantern internal technical validation policy"]
  });

  assert.equal(finding.ruleId, "PAYABLE_AMOUNT_MISMATCH");
  assert.equal(finding.category, "CALCULATION");
  assert.equal(finding.layer, "canonical");
  assert.equal(finding.checkType, "canonical");
  assert.equal(finding.ruleVersion, "2026.05.1");
  assert.equal(finding.legalConfidence, "technical");
  assert.deepEqual(finding.sourceLabels, [
    "Invoice Lantern internal technical validation policy",
    "Invoice Lantern validation engine mapping policy"
  ]);
});

test("validation enrichment maps UBL XSD findings into the unified contract", () => {
  const finding = mapXmlValidationFindingToEnriched({
    code: "UBL_XSD_VALIDATION_FAILED",
    severity: "fatal",
    checkType: "xsd_ubl",
    field: "Invoice/LegalMonetaryTotal",
    message: "The UBL XML failed local XSD validation.",
    status: "failed",
    legalConfidence: "technical",
    sourceLabels: ["UBL 2.1 local XSD artifact"]
  });

  assert.equal(finding.category, "SCHEMA");
  assert.equal(finding.layer, "xsd_ubl");
  assert.equal(finding.checkType, "xsd_ubl");
  assert.equal(finding.ruleId, "UBL_XSD_VALIDATION_FAILED");
  assert.equal(finding.legalConfidence, "technical");
  assert.match(finding.sourceLabels?.join(" ") ?? "", /XSD/i);
});

test("validation enrichment maps Schematron failed assertions as style findings", () => {
  const schematronFinding: XmlValidationJobFinding = {
    code: "PEPPOL_SCHEMATRON_RULE_FAILED",
    severity: "fatal",
    checkType: "schematron_peppol",
    field: "/Invoice/cbc:CustomizationID",
    message: "A guarded local Schematron assertion failed.",
    status: "failed",
    legalConfidence: "educational_simulation",
    schematronLayer: "peppol_bis_billing",
    ruleId: "rule-1",
    businessRuleId: "PEPPOL-EN16931-R001",
    sourceLabels: ["Local reviewed Peppol-style Schematron artifact"]
  };
  const finding = mapXmlValidationFindingToEnriched(schematronFinding);

  assert.equal(finding.category, "PEPPOL");
  assert.equal(finding.layer, "peppol_bis_billing");
  assert.equal(finding.checkType, "schematron_peppol");
  assert.equal(finding.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(finding.businessRuleId, "PEPPOL-EN16931-R001");
  assert.equal(finding.legalConfidence, "educational_simulation");
});

test("validation enrichment downgrades legal confidence when source context is absent", () => {
  const finding = enrichValidationFinding(
    {
      code: "UNSOURCED_LEGALISH_RULE",
      severity: "warning",
      category: "LEGAL_LABEL",
      field: "buyer.country",
      fieldPath: "buyer.country",
      message: "This unsourced finding must stay technical.",
      legalConfidence: "official_source_derived"
    },
    {
      sourceReferences: [],
      sourceLabels: []
    }
  );

  assert.equal(finding.legalConfidence, "technical");
  assert.deepEqual(finding.sourceLabels, []);
  assert.deepEqual(finding.sourceReferences, []);
});

test("validation summary groups findings by severity, category, layer, check type, and legal confidence", () => {
  const findings = [
    enrichValidationFinding({
      code: "INFO_RULE",
      severity: "info",
      category: "VAT_ID",
      field: "seller.vatId",
      fieldPath: "seller.vatId",
      message: "Local format check.",
      legalConfidence: "technical"
    }),
    mapXmlValidationFindingToEnriched({
      code: "EN16931_SCHEMATRON_RULE_FAILED",
      severity: "warning",
      checkType: "schematron_en16931",
      field: "/Invoice",
      message: "A guarded EN 16931-style rule failed.",
      status: "failed",
      legalConfidence: "educational_simulation",
      schematronLayer: "en16931_tc434"
    })
  ];
  const summary = buildValidationFindingSummary(findings);

  assert.equal(summary.bySeverity.info, 1);
  assert.equal(summary.bySeverity.warning, 1);
  assert.equal(summary.byCategory.VAT_ID, 1);
  assert.equal(summary.byCategory.EN16931, 1);
  assert.equal(summary.byLayer.canonical, 1);
  assert.equal(summary.byLayer.en16931_tc434, 1);
  assert.equal(summary.byCheckType.schematron_en16931, 1);
  assert.equal(summary.byLegalConfidence.technical, 1);
  assert.equal(summary.byLegalConfidence.educational_simulation, 1);
  assert.doesNotMatch(JSON.stringify(summary), /\b(certified|compliant|accepted)\b/i);
});
