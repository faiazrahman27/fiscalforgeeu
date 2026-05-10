import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_ENGINE_CANDIDATE_VERSION,
  SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION,
  SCHEMATRON_XPATH_ENGINE_ID,
  SCHEMATRON_XPATH_ENGINE_VERSION,
  buildSchematronExecutionPolicy,
  convertInternalFixtureToXPathAssertion,
  getInternalSchematronAssertionFixturesForLayer,
  listInternalSchematronAssertionFixtures,
  runEn16931ExecutionPath,
  runPeppolBisBillingExecutionPath,
  runSchematronExecutionOrchestrator,
  runSchematronXPathEngine,
  selectInternalSchematronAssertionFixtures,
  type SchematronContractFinding,
  type SchematronEngineCandidateInfo,
  type SchematronInternalAssertionFixtureLayer,
  type SchematronXPathEngineResult
} from "./index.js";

const completeInvoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:invoice-lantern:fixture:customization</cbc:CustomizationID>
  <cbc:ProfileID>urn:invoice-lantern:fixture:profile</cbc:ProfileID>
  <cbc:ID>INV-FIXTURE-COMPLETE</cbc:ID>
  <cbc:IssueDate>2026-05-10</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
  </cac:InvoiceLine>
</Invoice>`;
const invoiceWithoutDocumentIdXml = completeInvoiceXml.replace(
  "  <cbc:ID>INV-FIXTURE-COMPLETE</cbc:ID>\n",
  ""
);
const invoiceWithoutIssueDateXml = completeInvoiceXml.replace(
  "  <cbc:IssueDate>2026-05-10</cbc:IssueDate>\n",
  ""
);
const invoiceWithoutCurrencyXml = completeInvoiceXml.replace(
  "  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n",
  ""
);
const invoiceWithoutLineXml = completeInvoiceXml.replace(
  /  <cac:InvoiceLine>[\s\S]*?  <\/cac:InvoiceLine>\n/,
  ""
);
const invoiceWithoutCustomizationIdXml = completeInvoiceXml.replace(
  "  <cbc:CustomizationID>urn:invoice-lantern:fixture:customization</cbc:CustomizationID>\n",
  ""
);
const invoiceWithoutProfileIdXml = completeInvoiceXml.replace(
  "  <cbc:ProfileID>urn:invoice-lantern:fixture:profile</cbc:ProfileID>\n",
  ""
);
const rawXmlSentinel = "<Invoice><ID>INTERNAL-FIXTURE-SECRET</ID></Invoice>";
const forbiddenClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b|\bproves compliance\b|\bofficial validation\b|\btax compliant\b/i;

function xpathPolicy() {
  return buildSchematronExecutionPolicy({
    requestedMode: "preflight_only",
    requestedEngine: "xpath_engine"
  });
}

function xpathEngineCandidate(): SchematronEngineCandidateInfo {
  const base = {
    engineCandidateVersion: SCHEMATRON_ENGINE_CANDIDATE_VERSION,
    engineId: "xpath_engine",
    availabilityStatus: "available",
    executionSupported: true,
    executionEnabledByDefault: false,
    capabilities: [
      "metadata_only",
      "local_execution_candidate",
      "no_remote_fetch",
      "windows_compatible",
      "esm_compatible",
      "test_only",
      "xml_dom_execution",
      "xpath_assertion_execution"
    ],
    packageName: "fontoxpath+slimdom",
    packageVersion: "test",
    detectedPackages: [],
    reason:
      "schematron_xpath_engine_candidate_available_execution_disabled_by_default"
  } satisfies Omit<SchematronEngineCandidateInfo, "safeSummary">;

  return {
    ...base,
    safeSummary: {
      diagnosticKind: "schematron_engine_candidate",
      ...base
    }
  };
}

function nonXpathEngineCandidate(): SchematronEngineCandidateInfo {
  const base = {
    engineCandidateVersion: SCHEMATRON_ENGINE_CANDIDATE_VERSION,
    engineId: "future_xslt2",
    availabilityStatus: "unavailable",
    executionSupported: false,
    executionEnabledByDefault: false,
    capabilities: ["metadata_only", "no_remote_fetch"],
    packageName: null,
    packageVersion: null,
    detectedPackages: [],
    reason: "schematron_xslt2_engine_not_installed"
  } satisfies Omit<SchematronEngineCandidateInfo, "safeSummary">;

  return {
    ...base,
    safeSummary: {
      diagnosticKind: "schematron_engine_candidate",
      ...base
    }
  };
}

function assertNoRawXml(output: unknown) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(rawXmlSentinel), false);
  assert.equal(serialized.includes("INTERNAL-FIXTURE-SECRET"), false);
  assert.equal(serialized.includes("INV-FIXTURE-COMPLETE"), false);
  assert.equal(serialized.includes("<Invoice"), false);
  assert.equal(serialized.includes("<cbc:ID>"), false);
  assert.equal(serialized.includes("</Invoice>"), false);
}

function assertNoForbiddenClaims(output: unknown) {
  const serialized = JSON.stringify(output).replace(
    /not official validation/gi,
    "not public authority validation"
  );

  assert.doesNotMatch(serialized, forbiddenClaimPattern);
}

function assertXPathSafetyMetadata(result: SchematronXPathEngineResult) {
  assert.deepEqual(result.safetyMetadata, {
    rawXmlReturned: false,
    schematronFileContentsReturned: false,
    fullAbsoluteLocalPathsReturned: false,
    remoteFetching: false,
    localFileLoading: false,
    externalDocumentLoading: false,
    extensionFunctions: false,
    certificationOrAuthorityAcceptanceClaimed: false,
    legalTaxAccountingComplianceClaimed: false,
    normalPublicApiExecutionEnabled: false,
    normalWorkerExecutionEnabled: false
  });
}

function assertFixtureSummarySafety(summary: {
  fixtureSetVersion: string;
  engineVersion: string;
  engineId: string;
  safetyMetadata: Record<string, unknown>;
} | undefined) {
  assert.ok(summary);
  assert.equal(
    summary.fixtureSetVersion,
    SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
  );
  assert.equal(summary.engineVersion, SCHEMATRON_XPATH_ENGINE_VERSION);
  assert.equal(summary.engineId, SCHEMATRON_XPATH_ENGINE_ID);
  assert.deepEqual(summary.safetyMetadata, {
    rawXmlReturned: false,
    schematronFileContentsReturned: false,
    fullAbsoluteLocalPathsReturned: false,
    remoteFetching: false,
    localFileLoading: false,
    externalDocumentLoading: false,
    normalPublicApiExecutionEnabled: false,
    normalWorkerExecutionEnabled: false,
    arbitraryPublicXPathExecution: false,
    publicRuleClaimed: false,
    officialValidationClaimed: false
  });
}

function assertFindingHasFixtureMetadata(
  finding: SchematronContractFinding | undefined,
  input: {
    code: "EN16931_SCHEMATRON_RULE_FAILED" | "PEPPOL_SCHEMATRON_RULE_FAILED";
    layer: SchematronInternalAssertionFixtureLayer;
    ruleId: string;
    businessRuleId: string;
  }
) {
  assert.equal(finding?.code, input.code);
  assert.equal(finding?.schematronLayer, input.layer);
  assert.equal(finding?.ruleId, input.ruleId);
  assert.equal(finding?.businessRuleId, input.businessRuleId);
  assert.equal(finding?.severity, "fatal");
  assert.equal(finding?.status, "failed");
  assert.match(finding?.assertionText ?? "", /Internal .* fixture assertion/);
  assert.match(
    finding?.diagnosticReference ?? "",
    new RegExp(SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION)
  );
  assert.equal(
    finding?.sourceLabels?.includes(
      SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
    ),
    true
  );
}

test("internal assertion fixture catalog is versioned, bounded, and legally safe", () => {
  const fixtures = listInternalSchematronAssertionFixtures();
  const serialized = JSON.stringify(fixtures);

  assert.equal(fixtures.length > 0, true);
  assert.equal(
    fixtures.some((fixture) => fixture.layer === "en16931_tc434"),
    true
  );
  assert.equal(
    fixtures.some((fixture) => fixture.layer === "peppol_bis_billing"),
    true
  );
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixtureId)).size, fixtures.length);

  for (const layer of ["en16931_tc434", "peppol_bis_billing"] as const) {
    const layerFixtures = fixtures.filter((fixture) => fixture.layer === layer);

    assert.equal(
      new Set(layerFixtures.map((fixture) => fixture.ruleId)).size,
      layerFixtures.length
    );
  }

  for (const fixture of fixtures) {
    assert.equal(
      fixture.fixtureVersion,
      SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
    );
    assert.equal(fixture.sourceKind, "internal_engine_fixture");
    assert.equal(fixture.publicRuleClaimed, false);
    assert.equal(fixture.officialValidationClaimed, false);
    assert.match(fixture.legalConfidence, /^(technical|educational_simulation)$/);
    assert.equal(fixture.sourceLabels.length > 0, true);
    assert.equal(
      fixture.sourceLabels.every((label) => label.trim().length > 0),
      true
    );
    assert.doesNotMatch(fixture.assertionText, forbiddenClaimPattern);
  }

  assert.doesNotMatch(serialized, /<sch:schema|<sch:pattern|schematron file content/i);
  assert.doesNotMatch(serialized, /file:\/\//i);
  assert.doesNotMatch(serialized, /https?:\/\//i);
  assert.doesNotMatch(serialized, /[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/(?:home|tmp|Users|etc|var|private)\//);
  assert.doesNotMatch(serialized, /<Invoice|<cbc:/);
  assertNoForbiddenClaims(fixtures);
});

test("fixture selectors return copied arrays and support layer and ID filtering", () => {
  const allFixtures = listInternalSchematronAssertionFixtures();
  const en16931Fixtures =
    getInternalSchematronAssertionFixturesForLayer("en16931_tc434");
  const peppolFixtures = selectInternalSchematronAssertionFixtures({
    layer: "peppol_bis_billing"
  });
  const selected = selectInternalSchematronAssertionFixtures({
    fixtureIds: ["IL_INTERNAL_EN16931_DOCUMENT_ID_PRESENT"],
    maxFixtures: 1
  });

  assert.equal(allFixtures === listInternalSchematronAssertionFixtures(), false);
  assert.equal(en16931Fixtures.every((fixture) => fixture.layer === "en16931_tc434"), true);
  assert.equal(peppolFixtures.every((fixture) => fixture.layer === "peppol_bis_billing"), true);
  assert.deepEqual(
    selected.map((fixture) => fixture.fixtureId),
    ["IL_INTERNAL_EN16931_DOCUMENT_ID_PRESENT"]
  );

  if (selected[0]) {
    selected[0].fixtureId = "MUTATING-CALLER-COPY-ONLY";
  }

  assert.equal(
    listInternalSchematronAssertionFixtures().some(
      (fixture) => fixture.fixtureId === "MUTATING-CALLER-COPY-ONLY"
    ),
    false
  );
});

test("fixture conversion produces safe XPath assertions without mutating fixtures", () => {
  const [fixture] = getInternalSchematronAssertionFixturesForLayer(
    "en16931_tc434"
  );

  assert.ok(fixture);

  const before = JSON.stringify(fixture);
  const assertion = convertInternalFixtureToXPathAssertion(fixture);
  const assertionRecord = assertion as Record<string, unknown>;

  assert.equal(JSON.stringify(fixture), before);
  assert.equal(assertion.ruleId, fixture.ruleId);
  assert.equal(assertion.businessRuleId, fixture.businessRuleId);
  assert.equal(assertion.schematronLayer, fixture.layer);
  assert.equal(assertion.contextXPath, fixture.contextXPath);
  assert.equal(assertion.testExpression, fixture.testExpression);
  assert.equal(assertion.assertionText, fixture.assertionText);
  assert.equal(assertion.severity, fixture.severity);
  assert.equal(
    assertion.sourceLabels?.includes(
      SCHEMATRON_INTERNAL_ASSERTION_FIXTURE_SET_VERSION
    ),
    true
  );
  assert.equal(
    Object.values(assertionRecord).some((value) => value === undefined),
    false
  );
  assertNoForbiddenClaims(assertion);
});

test("guarded XPath engine executes selected internal fixtures for a complete synthetic invoice", async () => {
  const assertions = selectInternalSchematronAssertionFixtures({
    layer: "both"
  }).map((fixture) => convertInternalFixtureToXPathAssertion(fixture));
  const result = await runSchematronXPathEngine({
    xml: completeInvoiceXml,
    assertions,
    mode: "internal_test_only",
    allowInternalXPathExecution: true
  });

  assert.equal(result.engineVersion, SCHEMATRON_XPATH_ENGINE_VERSION);
  assert.equal(result.engineId, SCHEMATRON_XPATH_ENGINE_ID);
  assert.equal(result.status, "executed");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.findingCount, 0);
  assert.equal(result.fatalCount, 0);
  assertXPathSafetyMetadata(result);
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("EN 16931-style fixture failures map to sanitized contract findings", async () => {
  const cases = [
    {
      xml: invoiceWithoutDocumentIdXml,
      fixtureId: "IL_INTERNAL_EN16931_DOCUMENT_ID_PRESENT",
      ruleId: "IL-EN16931-FIXTURE-001",
      businessRuleId: "IL-EN16931-BR-FIXTURE-001"
    },
    {
      xml: invoiceWithoutIssueDateXml,
      fixtureId: "IL_INTERNAL_EN16931_ISSUE_DATE_PRESENT",
      ruleId: "IL-EN16931-FIXTURE-002",
      businessRuleId: "IL-EN16931-BR-FIXTURE-002"
    },
    {
      xml: invoiceWithoutCurrencyXml,
      fixtureId: "IL_INTERNAL_EN16931_CURRENCY_PRESENT",
      ruleId: "IL-EN16931-FIXTURE-003",
      businessRuleId: "IL-EN16931-BR-FIXTURE-003"
    },
    {
      xml: invoiceWithoutLineXml,
      fixtureId: "IL_INTERNAL_EN16931_INVOICE_LINE_PRESENT",
      ruleId: "IL-EN16931-FIXTURE-004",
      businessRuleId: "IL-EN16931-BR-FIXTURE-004"
    }
  ];

  for (const item of cases) {
    const result = await runEn16931ExecutionPath({
      xml: item.xml,
      mode: "internal_test_only",
      allowInternalXPathExecution: true,
      policy: xpathPolicy(),
      engineCandidate: xpathEngineCandidate(),
      internalAssertionFixtureIds: [item.fixtureId]
    });

    assert.equal(result.status, "failed");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, true);
    assert.equal(result.safeSummary.findingCount, 1);
    assertFixtureSummarySafety(result.internalAssertionFixtureSummary);
    assertFindingHasFixtureMetadata(result.findings[0], {
      code: "EN16931_SCHEMATRON_RULE_FAILED",
      layer: "en16931_tc434",
      ruleId: item.ruleId,
      businessRuleId: item.businessRuleId
    });
    assertNoRawXml(result);
    assertNoForbiddenClaims(result);
  }
});

test("Peppol-style fixture failures map to sanitized contract findings", async () => {
  const cases = [
    {
      xml: invoiceWithoutCustomizationIdXml,
      fixtureId: "IL_INTERNAL_PEPPOL_CUSTOMIZATION_ID_PRESENT",
      ruleId: "IL-PEPPOL-FIXTURE-001",
      businessRuleId: "IL-PEPPOL-BR-FIXTURE-001"
    },
    {
      xml: invoiceWithoutProfileIdXml,
      fixtureId: "IL_INTERNAL_PEPPOL_PROFILE_ID_PRESENT",
      ruleId: "IL-PEPPOL-FIXTURE-002",
      businessRuleId: "IL-PEPPOL-BR-FIXTURE-002"
    }
  ];

  for (const item of cases) {
    const result = await runPeppolBisBillingExecutionPath({
      xml: item.xml,
      mode: "internal_test_only",
      allowInternalXPathExecution: true,
      policy: xpathPolicy(),
      engineCandidate: xpathEngineCandidate(),
      internalAssertionFixtureIds: [item.fixtureId]
    });

    assert.equal(result.status, "failed");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, true);
    assert.equal(result.safeSummary.findingCount, 1);
    assertFixtureSummarySafety(result.internalAssertionFixtureSummary);
    assertFindingHasFixtureMetadata(result.findings[0], {
      code: "PEPPOL_SCHEMATRON_RULE_FAILED",
      layer: "peppol_bis_billing",
      ruleId: item.ruleId,
      businessRuleId: item.businessRuleId
    });
    assertNoRawXml(result);
    assertNoForbiddenClaims(result);
  }
});

test("disabled, preflight, missing guard, non-xpath, and blocked policy paths do not execute fixtures", async () => {
  const disabled = await runPeppolBisBillingExecutionPath({
    xml: completeInvoiceXml,
    allowInternalXPathExecution: true,
    internalAssertionFixtureIds: ["IL_INTERNAL_PEPPOL_PROFILE_ID_PRESENT"]
  });
  const preflight = await runPeppolBisBillingExecutionPath({
    xml: completeInvoiceXml,
    mode: "preflight_only",
    allowInternalXPathExecution: true,
    policy: xpathPolicy(),
    engineCandidate: xpathEngineCandidate(),
    internalAssertionFixtureIds: ["IL_INTERNAL_PEPPOL_PROFILE_ID_PRESENT"]
  });
  const missingGuard = await runPeppolBisBillingExecutionPath({
    xml: completeInvoiceXml,
    mode: "internal_test_only",
    policy: xpathPolicy(),
    engineCandidate: xpathEngineCandidate(),
    internalAssertionFixtureIds: ["IL_INTERNAL_PEPPOL_PROFILE_ID_PRESENT"]
  });
  const nonXpath = await runPeppolBisBillingExecutionPath({
    xml: completeInvoiceXml,
    mode: "internal_test_only",
    allowInternalXPathExecution: true,
    policy: buildSchematronExecutionPolicy({
      requestedMode: "preflight_only",
      requestedEngine: "future_xslt2"
    }),
    engineCandidate: nonXpathEngineCandidate(),
    internalAssertionFixtureIds: ["IL_INTERNAL_PEPPOL_PROFILE_ID_PRESENT"]
  });
  const blockedPolicy = await runPeppolBisBillingExecutionPath({
    xml: completeInvoiceXml,
    mode: "internal_test_only",
    allowInternalXPathExecution: true,
    policy: buildSchematronExecutionPolicy({
      requestedMode: "production",
      requestedEngine: "xpath_engine"
    }),
    engineCandidate: xpathEngineCandidate(),
    internalAssertionFixtureIds: ["IL_INTERNAL_PEPPOL_PROFILE_ID_PRESENT"]
  });

  assert.equal(disabled.status, "disabled");
  assert.equal(disabled.validationExecutionEnabled, false);
  assert.equal(disabled.validationExecuted, false);
  assert.equal(disabled.internalAssertionFixtureSummary, undefined);
  assert.equal(preflight.validationExecutionEnabled, false);
  assert.equal(preflight.validationExecuted, false);
  assert.equal(preflight.internalAssertionFixtureSummary, undefined);
  assert.equal(missingGuard.status, "unsupported");
  assert.equal(missingGuard.validationExecutionEnabled, false);
  assert.equal(missingGuard.validationExecuted, false);
  assert.equal(nonXpath.status, "engine_unavailable");
  assert.equal(nonXpath.validationExecutionEnabled, false);
  assert.equal(nonXpath.validationExecuted, false);
  assert.equal(blockedPolicy.status, "blocked_by_policy");
  assert.equal(blockedPolicy.validationExecutionEnabled, false);
  assert.equal(blockedPolicy.validationExecuted, false);

  for (const result of [
    disabled,
    preflight,
    missingGuard,
    nonXpath,
    blockedPolicy
  ]) {
    assert.equal(
      result.findings.some(
        (finding) => finding.ruleId === "IL-PEPPOL-FIXTURE-002"
      ),
      false
    );
    assertNoRawXml(result);
    assertNoForbiddenClaims(result);
  }
});

test("unsafe XML inputs are blocked before fixture execution without raw XML leakage", async () => {
  const unsafeXmlCases = [
    `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`,
    `<?xml version="1.0"?><Invoice><!ENTITY xxe "x"></Invoice>`,
    `<?xml version="1.0"?><Invoice SYSTEM="file:///x">INTERNAL-FIXTURE-SECRET</Invoice>`,
    `<?xml version="1.0"?><Invoice PUBLIC="file:///x">INTERNAL-FIXTURE-SECRET</Invoice>`,
    `<?xml version="1.0"?><?xml-stylesheet href="file:///x"?><Invoice>INTERNAL-FIXTURE-SECRET</Invoice>`
  ];

  for (const xml of unsafeXmlCases) {
    const result = await runEn16931ExecutionPath({
      xml,
      mode: "internal_test_only",
      allowInternalXPathExecution: true,
      policy: xpathPolicy(),
      engineCandidate: xpathEngineCandidate(),
      internalAssertionFixtureIds: ["IL_INTERNAL_EN16931_DOCUMENT_ID_PRESENT"]
    });

    assert.equal(result.status, "unsafe_input");
    assert.equal(result.validationExecutionEnabled, false);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
    assertNoRawXml(result);
    assertNoForbiddenClaims(result);
  }
});

test("unsafe XPath expressions are blocked by the guarded engine", async () => {
  const [fixture] = getInternalSchematronAssertionFixturesForLayer(
    "en16931_tc434"
  );

  assert.ok(fixture);

  const unsafeExpressions = [
    "doc('file:///tmp/private/invoice.xml')",
    "collection('file:///tmp/private')",
    "unparsed-text('file:///tmp/private/source.xml')",
    "'file:///tmp/private/source.xml'",
    "'http://example.test/source.xml'",
    "'https://example.test/source.xml'",
    "'D:\\\\private\\\\source.xml'",
    "'/tmp/private/source.xml'",
    "<cbc:ID>unsafe</cbc:ID>"
  ];

  for (const testExpression of unsafeExpressions) {
    const result = await runSchematronXPathEngine({
      xml: rawXmlSentinel,
      mode: "internal_test_only",
      allowInternalXPathExecution: true,
      assertions: [
        {
          ...convertInternalFixtureToXPathAssertion(fixture),
          testExpression
        }
      ]
    });

    assert.equal(result.status, "unsupported");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
    assertNoRawXml(result);
    assertNoForbiddenClaims(result);
  }
});

test("orchestrator runs both fixture layers only under explicit internal XPath guard", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: completeInvoiceXml,
    mode: "internal_test_only",
    layers: "both",
    allowInternalXPathExecution: true,
    policy: xpathPolicy(),
    engineCandidate: xpathEngineCandidate()
  });

  assert.equal(result.status, "executed");
  assert.deepEqual(result.selectedLayers, [
    "peppol_bis_billing",
    "en16931_tc434"
  ]);
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.safeSummary.findingCount, 0);
  assert.equal(result.layerSummaries.length, 2);
  assert.deepEqual(
    result.layerSummaries.map((summary) => [
      summary.layer,
      summary.findingCount,
      summary.fatalCount,
      summary.warningCount,
      summary.infoCount
    ]),
    [
      ["peppol_bis_billing", 0, 0, 0, 0],
      ["en16931_tc434", 0, 0, 0, 0]
    ]
  );
  assertFixtureSummarySafety(result.internalAssertionFixtureSummary);
  assert.equal(result.internalAssertionFixtureSummary?.selectedFixtureCount, 6);
  assertNoRawXml(result);
  assertNoForbiddenClaims(result.safeSummary);
});

test("orchestrator reports partial fixture status when one layer has findings and another succeeds", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: invoiceWithoutDocumentIdXml,
    mode: "internal_test_only",
    layers: "both",
    allowInternalXPathExecution: true,
    policy: xpathPolicy(),
    engineCandidate: xpathEngineCandidate()
  });

  assert.equal(result.status, "partial");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.layerSummaries.length, 2);
  assert.deepEqual(
    result.layerSummaries.map((summary) => [summary.layer, summary.status]),
    [
      ["peppol_bis_billing", "executed"],
      ["en16931_tc434", "failed"]
    ]
  );
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.code, "EN16931_SCHEMATRON_RULE_FAILED");
  assertNoRawXml(result);
  assertNoForbiddenClaims(result.safeSummary);
});

test("orchestrator disabled and preflight paths remain metadata-only for fixture execution", async () => {
  const disabled = await runSchematronExecutionOrchestrator({
    xml: `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`,
    allowInternalXPathExecution: true
  });
  const preflight = await runSchematronExecutionOrchestrator({
    xml: completeInvoiceXml,
    mode: "preflight_only",
    allowInternalXPathExecution: true,
    policy: xpathPolicy(),
    engineCandidate: xpathEngineCandidate()
  });

  assert.equal(disabled.status, "disabled");
  assert.equal(disabled.validationExecutionEnabled, false);
  assert.equal(disabled.validationExecuted, false);
  assert.equal(disabled.internalAssertionFixtureSummary, undefined);
  assert.equal(preflight.validationExecutionEnabled, false);
  assert.equal(preflight.validationExecuted, false);
  assert.equal(preflight.internalAssertionFixtureSummary, undefined);
  assertNoRawXml(disabled);
  assertNoRawXml(preflight);
  assertNoForbiddenClaims(disabled.safeSummary);
  assertNoForbiddenClaims(preflight.safeSummary);
});
