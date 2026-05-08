import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_LOCAL_EXECUTION_PROTOTYPE_VERSION,
  normalizeSchematronLocalPrototypeLayer,
  runSchematronLocalExecutionPrototype,
  sanitizeSchematronPrototypeRule,
  type SchematronLocalPrototypeResult,
  type SchematronLocalPrototypeRule
} from "./index.js";

const rawXmlSentinel =
  "<Invoice><ID>RAW-XML-SENTINEL-STEP-53</ID></Invoice>";
const xmlValueSentinel = "RAW-XML-SENTINEL-STEP-53";
const windowsAbsolutePath = "D:\\secret\\file.sch";
const unixAbsolutePath = "/home/user/secret.sch";
const fileUrl = "file:///tmp/secret.sch";
const prohibitedClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

const tinyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <ID>INV-STEP-53</ID>
  <InvoiceLine>
    <ID>1</ID>
  </InvoiceLine>
</Invoice>`;

function assertNoRawXmlLeak(result: SchematronLocalPrototypeResult) {
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes(rawXmlSentinel), false);
  assert.equal(serialized.includes(xmlValueSentinel), false);
  assert.equal(serialized.includes("<Invoice"), false);
  assert.equal(serialized.includes("<ID>"), false);
  assert.equal(serialized.includes("</Invoice>"), false);
}

function assertNoUnsafePathLeak(result: SchematronLocalPrototypeResult) {
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes(windowsAbsolutePath), false);
  assert.equal(serialized.includes(unixAbsolutePath), false);
  assert.equal(serialized.includes(fileUrl), false);
  assert.doesNotMatch(serialized, /[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/home\/user\/[A-Za-z0-9_.-]+/);
  assert.doesNotMatch(serialized, /file:\/\/\//i);
}

function assertNoForbiddenClaims(result: SchematronLocalPrototypeResult) {
  assert.doesNotMatch(JSON.stringify(result), prohibitedClaimPattern);
}

function passingRule(
  override: Partial<SchematronLocalPrototypeRule> = {}
): SchematronLocalPrototypeRule {
  return {
    ruleId: "PEPPOL-EN16931-R001",
    businessRuleId: "BR-CO-10",
    layer: "peppol_bis_billing",
    context: "/Invoice",
    test: "ID = 'INV-STEP-53'",
    message: "Document identifier must be present.",
    field: "document.number",
    ...override
  };
}

test("disabled mode returns disabled result without parsing or executing XML", async () => {
  const result = await runSchematronLocalExecutionPrototype({
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Invoice [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
${rawXmlSentinel}`,
    rules: [passingRule()]
  });

  assert.equal(
    result.prototypeVersion,
    SCHEMATRON_LOCAL_EXECUTION_PROTOTYPE_VERSION
  );
  assert.equal(result.mode, "disabled");
  assert.equal(result.status, "disabled");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.reason, "schematron_local_execution_prototype_disabled");
  assert.equal(result.executedRuleCount, 0);
  assert.equal(result.failedRuleCount, 0);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_NOT_ENABLED");
  assert.equal(
    result.safeSummary.diagnosticKind,
    "schematron_local_execution_prototype"
  );
  assertNoRawXmlLeak(result);
  assertNoForbiddenClaims(result);
});

test("internal_test_only mode executes a tiny deterministic passing rule", async () => {
  const result = await runSchematronLocalExecutionPrototype({
    xml: tinyXml,
    rules: [passingRule()],
    mode: "internal_test_only"
  });

  assert.equal(result.status, "executed");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.markedValid, false);
  assert.equal(result.selectedLayer, "unknown");
  assert.equal(result.ruleCount, 1);
  assert.equal(result.executedRuleCount, 1);
  assert.equal(result.failedRuleCount, 0);
  assert.equal(result.warningCount, 0);
  assert.equal(result.fatalCount, 0);
  assert.deepEqual(result.findings, []);
  assertNoRawXmlLeak(result);
  assertNoForbiddenClaims(result);
});

test("internal_test_only failure maps Peppol, EN 16931, and unknown layer codes safely", async () => {
  const peppol = await runSchematronLocalExecutionPrototype({
    xml: tinyXml,
    mode: "internal_test_only",
    layer: "peppol_bis_billing",
    rules: [
      passingRule({
        test: "ID = 'OTHER'",
        message: "Rule failed without echoing XML."
      })
    ]
  });
  const en16931 = await runSchematronLocalExecutionPrototype({
    xml: tinyXml,
    mode: "internal_test_only",
    layer: "en16931_tc434",
    rules: [
      passingRule({
        layer: "en16931_tc434",
        test: "ID = 'OTHER'",
        ruleId: "BR-EN-001",
        businessRuleId: "BR-CO-10"
      })
    ]
  });
  const unknown = await runSchematronLocalExecutionPrototype({
    xml: tinyXml,
    mode: "internal_test_only",
    layer: "unknown",
    rules: [
      passingRule({
        layer: "unknown",
        test: "ID = 'OTHER'",
        ruleId: "LOCAL-R001"
      })
    ]
  });

  assert.equal(peppol.status, "failed");
  assert.equal(peppol.failedRuleCount, 1);
  assert.equal(peppol.fatalCount, 1);
  assert.equal(peppol.findings.length, 1);
  assert.equal(peppol.findings[0]?.code, "PEPPOL_SCHEMATRON_RULE_FAILED");
  assert.equal(peppol.findings[0]?.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(peppol.findings[0]?.businessRuleId, "BR-CO-10");
  assert.equal(peppol.findings[0]?.schematronLayer, "peppol_bis_billing");
  assert.equal(peppol.findings[0]?.ruleLocation, "/Invoice");
  assert.equal(peppol.findings[0]?.testExpression, "ID = 'OTHER'");
  assert.equal(
    en16931.findings[0]?.code,
    "EN16931_SCHEMATRON_RULE_FAILED"
  );
  assert.equal(en16931.findings[0]?.schematronLayer, "en16931_tc434");
  assert.equal(unknown.findings[0]?.code, "SCHEMATRON_ASSERTION_FAILED");
  assert.equal(unknown.findings[0]?.schematronLayer, "unknown");

  for (const result of [peppol, en16931, unknown]) {
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, true);
    assert.equal(result.markedValid, false);
    assertNoRawXmlLeak(result);
    assertNoForbiddenClaims(result);
  }
});

test("unsafe XML constructs are rejected before parsing", async () => {
  const cases = [
    {
      xml: `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`,
      reason: "schematron_local_execution_prototype_doctype_blocked"
    },
    {
      xml: `<?xml version="1.0"?><Invoice><!ENTITY xxe "x"></Invoice>`,
      reason: "schematron_local_execution_prototype_entity_blocked"
    },
    {
      xml: `<?xml version="1.0"?><Invoice SYSTEM="file:///x">${xmlValueSentinel}</Invoice>`,
      reason:
        "schematron_local_execution_prototype_external_identifier_blocked"
    },
    {
      xml: `<?xml version="1.0"?><?xml-stylesheet href="file:///x"?><Invoice>${xmlValueSentinel}</Invoice>`,
      reason: "schematron_local_execution_prototype_stylesheet_blocked"
    }
  ];

  for (const item of cases) {
    const result = await runSchematronLocalExecutionPrototype({
      xml: item.xml,
      mode: "internal_test_only",
      rules: [passingRule()]
    });

    assert.equal(result.status, "unsafe_input");
    assert.equal(result.validationExecutionEnabled, true);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.reason, item.reason);
    assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
    assertNoRawXmlLeak(result);
    assertNoUnsafePathLeak(result);
  }
});

test("rule and XML limits are rejected safely", async () => {
  const tooManyRules = await runSchematronLocalExecutionPrototype({
    xml: tinyXml,
    mode: "internal_test_only",
    maxRules: 1,
    rules: [passingRule(), passingRule({ ruleId: "PEPPOL-EN16931-R002" })]
  });
  const oversizedXml = await runSchematronLocalExecutionPrototype({
    xml: tinyXml,
    mode: "internal_test_only",
    maxXmlBytes: 8,
    rules: [passingRule()]
  });

  assert.equal(tooManyRules.status, "unsupported");
  assert.equal(tooManyRules.validationExecutionEnabled, true);
  assert.equal(tooManyRules.validationExecuted, false);
  assert.equal(
    tooManyRules.reason,
    "schematron_local_execution_prototype_rule_limit_exceeded"
  );
  assert.equal(oversizedXml.status, "unsafe_input");
  assert.equal(oversizedXml.validationExecuted, false);
  assert.equal(
    oversizedXml.reason,
    "schematron_local_execution_prototype_xml_too_large"
  );
  assertNoRawXmlLeak(tooManyRules);
  assertNoRawXmlLeak(oversizedXml);
});

test("rule metadata is sanitized while preserving safe rule identifiers", async () => {
  const result = await runSchematronLocalExecutionPrototype({
    xml: tinyXml,
    mode: "internal_test_only",
    rules: [
      passingRule({
        test: "ID = 'OTHER'",
        message:
          "BR-CO-10 failed for <Invoice><ID>SECRET</ID></Invoice> " +
          `${windowsAbsolutePath} ${unixAbsolutePath} ${fileUrl}`,
        ruleId: "PEPPOL-EN16931-R001",
        businessRuleId: "BR-CO-10"
      })
    ]
  });
  const finding = result.findings[0];
  const serialized = JSON.stringify(result);

  assert.equal(finding?.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(finding?.businessRuleId, "BR-CO-10");
  assert.match(finding?.message ?? "", /BR-CO-10/);
  assert.match(finding?.assertionText ?? "", /BR-CO-10/);
  assert.equal(serialized.includes("SECRET"), false);
  assert.equal(serialized.includes("<Invoice>"), false);
  assertNoUnsafePathLeak(result);
  assertNoForbiddenClaims(result);
});

test("normalization and rule sanitizer stay conservative", () => {
  assert.equal(
    normalizeSchematronLocalPrototypeLayer("peppol_bis_billing"),
    "peppol_bis_billing"
  );
  assert.equal(
    normalizeSchematronLocalPrototypeLayer("en16931_tc434"),
    "en16931_tc434"
  );
  assert.equal(normalizeSchematronLocalPrototypeLayer("custom"), "unknown");

  const rule = sanitizeSchematronPrototypeRule({
    ruleId: "PEPPOL-EN16931-R001",
    businessRuleId: "BR-CO-10",
    layer: "peppol_bis_billing",
    context: "/Invoice",
    test: "ID != ''",
    message: `Safe identifier ${rawXmlSentinel} ${windowsAbsolutePath}`
  });

  assert.equal(rule.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(rule.businessRuleId, "BR-CO-10");
  assert.equal(rule.layer, "peppol_bis_billing");
  assert.equal(rule.context, "/Invoice");
  assert.equal(rule.test, "ID != ''");
  assert.equal(rule.message.includes("RAW-XML-SENTINEL-STEP-53"), false);
  assert.equal(rule.message.includes(windowsAbsolutePath), false);
});

test("prototype output does not include forbidden assurance claims", async () => {
  const results = [
    await runSchematronLocalExecutionPrototype({
      xml: tinyXml,
      rules: [passingRule()]
    }),
    await runSchematronLocalExecutionPrototype({
      xml: tinyXml,
      mode: "internal_test_only",
      rules: [passingRule()]
    }),
    await runSchematronLocalExecutionPrototype({
      xml: tinyXml,
      mode: "internal_test_only",
      rules: [passingRule({ test: "false()" })]
    })
  ];

  for (const result of results) {
    assertNoForbiddenClaims(result);
  }
});
