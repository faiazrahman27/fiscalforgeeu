import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_XPATH_ENGINE_ID,
  SCHEMATRON_XPATH_ENGINE_VERSION,
  normalizeSchematronXPathEngineMode,
  runSchematronXPathEngine,
  type SchematronXPathEngineResult
} from "./index.js";

const rawXmlSentinel = "<Invoice><ID>RAW-XPATH-SECRET</ID></Invoice>";
const tinyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <ID>INV-XPATH-001</ID>
</Invoice>`;
const namespacedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INV-XPATH-UBL-001</cbc:ID>
</Invoice>`;
const schematronContentSentinel =
  "SCHEMATRON-FILE-CONTENT-SENTINEL-XPATH";
const schematronXmlContent =
  "<sch:schema><sch:pattern>SCHEMATRON-PRIVATE-CONTENT</sch:pattern></sch:schema>";
const windowsAbsolutePath = "D:\\private\\schematron\\rules.sch";
const unixAbsolutePath = "/tmp/private/schematron/rules.sch";
const fileUrl = "file:///tmp/private/schematron/rules.sch";
const forbiddenClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

function assertNoRawXml(output: unknown) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(rawXmlSentinel), false);
  assert.equal(serialized.includes("RAW-XPATH-SECRET"), false);
  assert.equal(serialized.includes("<Invoice"), false);
  assert.equal(serialized.includes("<ID>"), false);
  assert.equal(serialized.includes("</Invoice>"), false);
}

function assertNoSchematronFileContents(output: unknown) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(schematronContentSentinel), false);
  assert.equal(serialized.includes("SCHEMATRON-PRIVATE-CONTENT"), false);
  assert.equal(serialized.includes("<sch:schema>"), false);
  assert.equal(serialized.includes("<sch:pattern>"), false);
}

function assertNoUnsafePaths(output: unknown) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(windowsAbsolutePath), false);
  assert.equal(serialized.includes(unixAbsolutePath), false);
  assert.equal(serialized.includes(fileUrl), false);
  assert.doesNotMatch(serialized, /[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/tmp\/private\/[A-Za-z0-9/_.-]+/);
  assert.doesNotMatch(serialized, /file:\/\/\//i);
}

function assertNoForbiddenClaims(output: unknown) {
  assert.doesNotMatch(JSON.stringify(output), forbiddenClaimPattern);
}

function assertSafetyMetadata(result: SchematronXPathEngineResult) {
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
  assert.deepEqual(result.safeSummary.safetyMetadata, result.safetyMetadata);
  assert.match(result.disclaimer, /internal\/test-only XPath assertion/i);
  assert.match(result.disclaimer, /not official validation/i);
  assert.match(result.disclaimer, /not authority acceptance/i);
}

test("XPath engine mode normalization keeps normal paths disabled", () => {
  assert.equal(normalizeSchematronXPathEngineMode(undefined), "disabled");
  assert.equal(normalizeSchematronXPathEngineMode("disabled"), "disabled");
  assert.equal(
    normalizeSchematronXPathEngineMode("internal_test_only"),
    "internal_test_only"
  );
  assert.equal(normalizeSchematronXPathEngineMode("production"), "disabled");
});

test("XPath engine stays disabled without explicit internal execution approval", async () => {
  const result = await runSchematronXPathEngine({
    xml: rawXmlSentinel,
    mode: "internal_test_only",
    assertions: [
      {
        ruleId: "XPATH-DISABLED-R001",
        contextXPath: "/Invoice",
        testExpression: "true()",
        assertionText: "This assertion should not execute."
      }
    ]
  });

  assert.equal(result.engineVersion, SCHEMATRON_XPATH_ENGINE_VERSION);
  assert.equal(result.engineId, SCHEMATRON_XPATH_ENGINE_ID);
  assert.equal(result.status, "disabled");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.findingCount, 0);
  assertSafetyMetadata(result);
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("XPath engine rejects empty or unsafe assertion input safely", async () => {
  const cases = [
    {
      testExpression: "",
      expectedReason: "schematron_xpath_assertion_empty_test_expression"
    },
    {
      testExpression: "doc('file:///tmp/private/invoice.xml')",
      expectedReason:
        "schematron_xpath_expression_external_reference_blocked"
    },
    {
      testExpression: "ext:danger()",
      expectedReason:
        "schematron_xpath_expression_extension_function_blocked"
    }
  ];

  for (const item of cases) {
    const result = await runSchematronXPathEngine({
      xml: rawXmlSentinel,
      mode: "internal_test_only",
      allowInternalXPathExecution: true,
      assertions: [
        {
          ruleId: "XPATH-UNSAFE-R001",
          contextXPath: "/Invoice",
          testExpression: item.testExpression,
          assertionText: `${schematronContentSentinel} ${windowsAbsolutePath}`
        }
      ]
    });

    assert.equal(result.status, "unsupported");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(result.reason, item.expectedReason);
    assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
    assertNoRawXml(result);
    assertNoSchematronFileContents(result);
    assertNoUnsafePaths(result);
    assertNoForbiddenClaims(result);
  }
});

test("XPath engine evaluates a simple true assertion against tiny safe XML", async () => {
  const result = await runSchematronXPathEngine({
    xml: tinyXml,
    mode: "internal_test_only",
    allowInternalXPathExecution: true,
    assertions: [
      {
        ruleId: "XPATH-TRUE-R001",
        businessRuleId: "BR-XPATH-TRUE",
        schematronLayer: "unknown",
        contextXPath: "/Invoice",
        testExpression: "normalize-space(ID) = 'INV-XPATH-001'",
        assertionText: "Invoice identifier is present."
      }
    ]
  });

  assert.equal(result.status, "executed");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.markedValid, false);
  assert.equal(result.assertionCount, 1);
  assert.equal(result.executedAssertionCount, 1);
  assert.equal(result.evaluatedContextNodeCount, 1);
  assert.equal(result.findingCount, 0);
  assert.deepEqual(result.findings, []);
  assertSafetyMetadata(result);
  assertNoRawXml(result);
});

test("XPath engine supports fixed UBL namespace prefixes without remote lookup", async () => {
  const result = await runSchematronXPathEngine({
    xml: namespacedXml,
    mode: "internal_test_only",
    allowInternalXPathExecution: true,
    assertions: [
      {
        ruleId: "XPATH-UBL-R001",
        contextXPath: "/ubl:Invoice",
        testExpression: "normalize-space(cbc:ID) = 'INV-XPATH-UBL-001'",
        assertionText: "Namespaced UBL identifier is present."
      }
    ]
  });

  assert.equal(result.status, "executed");
  assert.equal(result.findingCount, 0);
  assert.equal(result.safetyMetadata.remoteFetching, false);
});

test("XPath engine maps a false assertion to a sanitized Schematron finding", async () => {
  const result = await runSchematronXPathEngine({
    xml: tinyXml,
    mode: "internal_test_only",
    allowInternalXPathExecution: true,
    assertions: [
      {
        ruleId: "PEPPOL-XPATH-R001",
        businessRuleId: "BR-XPATH-10",
        schematronLayer: "peppol_bis_billing",
        context: "/Invoice",
        testExpression: "normalize-space(ID) = 'EXPECTED-ID'",
        assertionText:
          "BR-XPATH-10 failed in this guarded technical assertion.",
        severity: "fatal",
        diagnosticReference: "BR-XPATH-10"
      }
    ]
  });
  const finding = result.findings[0];

  assert.equal(result.status, "failed");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.markedValid, false);
  assert.equal(result.findingCount, 1);
  assert.equal(result.fatalCount, 1);
  assert.equal(finding?.code, "PEPPOL_SCHEMATRON_RULE_FAILED");
  assert.equal(finding?.status, "failed");
  assert.equal(finding?.severity, "fatal");
  assert.equal(finding?.schematronLayer, "peppol_bis_billing");
  assert.equal(finding?.ruleId, "PEPPOL-XPATH-R001");
  assert.equal(finding?.businessRuleId, "BR-XPATH-10");
  assert.equal(finding?.ruleLocation, "/Invoice");
  assert.equal(
    finding?.testExpression,
    "normalize-space(ID) = 'EXPECTED-ID'"
  );
  assert.equal(finding?.diagnosticReference, "BR-XPATH-10");
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("XPath engine sanitizes XML fragments, Schematron contents, and paths from findings", async () => {
  const result = await runSchematronXPathEngine({
    xml: tinyXml,
    mode: "internal_test_only",
    allowInternalXPathExecution: true,
    assertions: [
      {
        ruleId: "EN16931-XPATH-R001",
        businessRuleId: `BR-XPATH-PATH ${windowsAbsolutePath}`,
        schematronLayer: "en16931_tc434",
        contextXPath: "/Invoice",
        testExpression: "false()",
        assertionText: `${schematronXmlContent} ${schematronContentSentinel} ${windowsAbsolutePath} ${unixAbsolutePath} ${fileUrl}`,
        severity: "warning",
        diagnosticReference: `${fileUrl} diagnostic`
      }
    ]
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "failed");
  assert.equal(result.warningCount, 1);
  assert.equal(serialized.includes("[xml-fragment]"), true);
  assert.equal(serialized.includes("[schematron-file-content]"), true);
  assertNoRawXml(result);
  assertNoSchematronFileContents(result);
  assertNoUnsafePaths(result);
  assertNoForbiddenClaims(result);
});

test("XPath engine blocks unsafe XML before DOM parsing without returning raw XML", async () => {
  const unsafeXmlCases = [
    `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`,
    `<?xml version="1.0"?><Invoice><!ENTITY xxe "x"></Invoice>`,
    `<?xml version="1.0"?><Invoice SYSTEM="file:///x">RAW-XPATH-SECRET</Invoice>`,
    `<?xml version="1.0"?><?xml-stylesheet href="file:///x"?><Invoice>RAW-XPATH-SECRET</Invoice>`
  ];

  for (const xml of unsafeXmlCases) {
    const result = await runSchematronXPathEngine({
      xml,
      mode: "internal_test_only",
      allowInternalXPathExecution: true,
      assertions: [
        {
          ruleId: "XPATH-XML-SAFETY-R001",
          contextXPath: "/Invoice",
          testExpression: "true()",
          assertionText: "Unsafe XML should be rejected before execution."
        }
      ]
    });

    assert.equal(result.status, "unsafe_input");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
    assertNoRawXml(result);
    assertNoUnsafePaths(result);
    assertNoForbiddenClaims(result);
  }
});
