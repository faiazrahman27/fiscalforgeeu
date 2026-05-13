import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EN16931_EXECUTION_PATH_VERSION,
  SCHEMATRON_ENGINE_CANDIDATE_VERSION,
  buildSchematronExecutionPolicy,
  normalizeEn16931ExecutionMode,
  runEn16931ExecutionPath,
  type En16931ExecutionResult,
  type SchematronEngineCandidateInfo,
  type SchematronSafeArtifactDiagnostics,
  type SchematronSvrlInputResult
} from "./index.js";

const rawXmlSentinel = "<Invoice><ID>SECRET</ID></Invoice>";
const tinyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <ID>INV-STEP-56</ID>
</Invoice>`;
const windowsAbsolutePath = "D:\\secret\\file.sch";
const unixAbsolutePath = "/home/user/secret.sch";
const fileUrl = "file:///home/user/secret.sch";
const forbiddenClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

function assertNoRawXml(output: unknown) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(rawXmlSentinel), false);
  assert.equal(serialized.includes("<Invoice"), false);
  assert.equal(serialized.includes("<ID>"), false);
  assert.equal(serialized.includes("</Invoice>"), false);
  assert.equal(serialized.includes("SECRET"), false);
}

function assertNoUnsafePaths(output: unknown) {
  const serialized = JSON.stringify(output);

  assert.equal(serialized.includes(windowsAbsolutePath), false);
  assert.equal(serialized.includes(unixAbsolutePath), false);
  assert.equal(serialized.includes(fileUrl), false);
  assert.doesNotMatch(serialized, /[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/home\/user\/[A-Za-z0-9_.-]+/);
  assert.doesNotMatch(serialized, /file:\/\/\//i);
}

function assertNoForbiddenClaims(output: unknown) {
  assert.doesNotMatch(JSON.stringify(output), forbiddenClaimPattern);
}

function schematronDiagnostics(input: {
  en16931Configured: boolean;
  en16931Usable: boolean;
  en16931Status?: "available" | "missing" | "unreadable" | "not_configured";
}): SchematronSafeArtifactDiagnostics {
  const en16931Status =
    input.en16931Status ??
    (input.en16931Usable
      ? "available"
      : input.en16931Configured
        ? "unreadable"
        : "not_configured");
  const readyArtifactCount = input.en16931Usable ? 1 : 0;

  return {
    diagnosticKind: "schematron_artifacts",
    configured: input.en16931Configured,
    usable: input.en16931Usable,
    readyArtifactCount,
    requiredArtifactCount: 2,
    allRequiredArtifactsReadable: false,
    validatorName: "schematron-placeholder",
    validatorAvailable: false,
    validationExecutionEnabled: false,
    artifactVersion: "step-56-test",
    checkedAt: "2026-05-08T00:00:00.000Z",
    peppolBisArtifact: {
      artifactKind: "peppol_bis_billing",
      configured: false,
      status: "not_configured",
      readable: false,
      usable: false,
      sha256: null,
      label: null,
      basename: null,
      reason: "local_schematron_artifact_path_not_configured"
    },
    en16931Artifact: {
      artifactKind: "en16931_tc434",
      configured: input.en16931Configured,
      status: en16931Status,
      readable: input.en16931Usable,
      usable: input.en16931Usable,
      sha256: input.en16931Usable ? "b".repeat(64) : null,
      label: input.en16931Configured ? "tc434/EN16931-TC434.sch" : null,
      basename: input.en16931Configured ? "EN16931-TC434.sch" : null,
      ...(input.en16931Usable
        ? { relativePathUnderRoot: "tc434/EN16931-TC434.sch" }
        : { reason: "test_artifact_not_usable" })
    },
    disclaimer:
      "Technical Schematron artefact diagnostics only. They do not execute Schematron validation."
  };
}

function engineCandidate(input: {
  availabilityStatus: SchematronEngineCandidateInfo["availabilityStatus"];
  executionSupported: boolean;
}): SchematronEngineCandidateInfo {
  const base = {
    engineCandidateVersion: SCHEMATRON_ENGINE_CANDIDATE_VERSION,
    engineId: input.executionSupported
      ? "internal_test_candidate"
      : "future_xslt2",
    availabilityStatus: input.availabilityStatus,
    executionSupported: input.executionSupported,
    executionEnabledByDefault: false,
    capabilities: input.executionSupported
      ? [
          "metadata_only",
          "local_execution_candidate",
          "no_remote_fetch",
          "windows_compatible",
          "esm_compatible",
          "test_only"
        ]
      : ["metadata_only", "no_remote_fetch"],
    packageName: null,
    packageVersion: null,
    detectedPackages: [],
    reason: input.executionSupported
      ? "schematron_internal_test_candidate_available"
      : "schematron_xslt2_engine_not_installed"
  } satisfies Omit<SchematronEngineCandidateInfo, "safeSummary">;

  return {
    ...base,
    safeSummary: {
      diagnosticKind: "schematron_engine_candidate",
      ...base
    }
  };
}

function failedAssert(
  override: Partial<SchematronSvrlInputResult> = {}
): SchematronSvrlInputResult {
  return {
    kind: "failed_assert",
    id: "EN16931-R001",
    businessRuleId: "BR-CO-10",
    flag: "fatal",
    location: "/Invoice/cbc:ID",
    test: "normalize-space(cbc:ID) != ''",
    text: "BR-CO-10 failed because the document identifier is missing.",
    diagnosticReference: "BR-CO-10",
    ...override
  };
}

test("mode normalization defaults unknown values to disabled", () => {
  assert.equal(normalizeEn16931ExecutionMode(undefined), "disabled");
  assert.equal(normalizeEn16931ExecutionMode("disabled"), "disabled");
  assert.equal(
    normalizeEn16931ExecutionMode("preflight_only"),
    "preflight_only"
  );
  assert.equal(
    normalizeEn16931ExecutionMode("internal_test_only"),
    "internal_test_only"
  );
  assert.equal(normalizeEn16931ExecutionMode("execute"), "execute");
  assert.equal(normalizeEn16931ExecutionMode("enabled"), "disabled");
});

test("disabled mode returns disabled result without parsing or execution", async () => {
  const result = await runEn16931ExecutionPath({
    xml: `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`
  });

  assert.equal(result.executionPathVersion, EN16931_EXECUTION_PATH_VERSION);
  assert.equal(result.safeSummary.executionPathVersion, EN16931_EXECUTION_PATH_VERSION);
  assert.equal(result.safeSummary.diagnosticKind, "en16931_execution_path");
  assert.equal(result.mode, "disabled");
  assert.equal(result.status, "disabled");
  assert.equal(result.schematronLayer, "en16931_tc434");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.reason, "en16931_execution_disabled");
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_NOT_ENABLED");
  assert.equal(result.findings[0]?.schematronLayer, "en16931_tc434");
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("preflight reports not_configured when EN 16931 artefact is missing", async () => {
  const result = await runEn16931ExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      en16931Configured: false,
      en16931Usable: false
    })
  });

  assert.equal(result.status, "not_configured");
  assert.equal(result.reason, "en16931_artifacts_not_configured");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_ARTIFACT_NOT_CONFIGURED");
  assert.equal(result.findings[0]?.schematronLayer, "en16931_tc434");
  assertNoRawXml(result);
});

test("preflight reports artifact_unreadable when EN 16931 artefact is unusable", async () => {
  const result = await runEn16931ExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      en16931Configured: true,
      en16931Usable: false,
      en16931Status: "unreadable"
    })
  });

  assert.equal(result.status, "artifact_unreadable");
  assert.equal(result.reason, "en16931_artifacts_not_usable");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_ARTIFACT_UNREADABLE");
  assert.equal(result.findings[0]?.schematronLayer, "en16931_tc434");
  assertNoRawXml(result);
});

test("preflight reports engine_unavailable when artefact is usable but engine is unavailable", async () => {
  const result = await runEn16931ExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      en16931Configured: true,
      en16931Usable: true
    }),
    engineCandidate: engineCandidate({
      availabilityStatus: "unavailable",
      executionSupported: false
    })
  });

  assert.equal(result.status, "engine_unavailable");
  assert.equal(result.reason, "en16931_engine_unavailable");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
  assert.equal(result.findings[0]?.schematronLayer, "en16931_tc434");
  assertNoRawXml(result);
});

test("preflight reports ready_for_future_execution without executing", async () => {
  const result = await runEn16931ExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      en16931Configured: true,
      en16931Usable: true
    }),
    engineCandidate: engineCandidate({
      availabilityStatus: "available",
      executionSupported: true
    })
  });

  assert.equal(result.status, "ready_for_future_execution");
  assert.equal(result.reason, "en16931_ready_but_execution_not_enabled");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_NOT_ENABLED");
  assert.equal(result.findings[0]?.schematronLayer, "en16931_tc434");
  assertNoRawXml(result);
});

test("preflight blocks execution-like policy requests without execution", async () => {
  const result = await runEn16931ExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    policy: buildSchematronExecutionPolicy({
      requestedMode: "production",
      requestedEngine: "future_xslt2"
    }),
    artifactDiagnostics: schematronDiagnostics({
      en16931Configured: true,
      en16931Usable: true
    }),
    engineCandidate: engineCandidate({
      availabilityStatus: "available",
      executionSupported: true
    })
  });

  assert.equal(result.status, "blocked_by_policy");
  assert.equal(result.reason, "en16931_execution_blocked_by_policy");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
  assertNoRawXml(result);
});

test("internal test-only maps EN 16931 SVRL failed_assert findings safely", async () => {
  const result = await runEn16931ExecutionPath({
    xml: tinyXml,
    mode: "internal_test_only",
    svrlResults: [failedAssert()]
  });
  const finding = result.findings[0];

  assert.equal(result.status, "failed");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.markedValid, false);
  assert.equal(result.safeSummary.findingCount, 1);
  assert.equal(result.safeSummary.fatalCount, 1);
  assert.equal(finding?.code, "EN16931_SCHEMATRON_RULE_FAILED");
  assert.equal(finding?.schematronLayer, "en16931_tc434");
  assert.equal(finding?.ruleId, "EN16931-R001");
  assert.equal(finding?.businessRuleId, "BR-CO-10");
  assert.equal(finding?.ruleLocation, "/Invoice/cbc:ID");
  assert.equal(finding?.testExpression, "normalize-space(cbc:ID) != ''");
  assert.match(finding?.message ?? "", /BR-CO-10 failed/);
  assert.equal(finding?.assertionText, finding?.message);
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("internal test-only maps successful_report as report warning without assurance claims", async () => {
  const result = await runEn16931ExecutionPath({
    xml: tinyXml,
    mode: "internal_test_only",
    svrlResults: [
      {
        kind: "successful_report",
        id: "EN16931-REPORT-R001",
        flag: "warning",
        location: "/Invoice",
        test: "true()",
        text: "A Schematron report item was emitted."
      }
    ]
  });
  const finding = result.findings[0];

  assert.equal(result.status, "executed");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.markedValid, false);
  assert.equal(result.safeSummary.warningCount, 1);
  assert.equal(finding?.code, "SCHEMATRON_REPORT_WARNING");
  assert.equal(finding?.schematronLayer, "en16931_tc434");
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.status, "warning");
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("internal test-only prefers supplied SVRL results over prototype rules", async () => {
  const result = await runEn16931ExecutionPath({
    xml: tinyXml,
    mode: "internal_test_only",
    svrlResults: [
      failedAssert({
        id: "EN16931-R-SVRL"
      })
    ],
    prototypeRules: [
      {
        ruleId: "EN16931-R-PROTOTYPE",
        layer: "en16931_tc434",
        context: "/Invoice",
        test: "false()",
        message: "Prototype rule should not be used."
      }
    ]
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.ruleId, "EN16931-R-SVRL");
  assert.equal(JSON.stringify(result).includes("R-PROTOTYPE"), false);
});

test("internal test-only executes prototype rules through the EN 16931 layer", async () => {
  const result = await runEn16931ExecutionPath({
    xml: tinyXml,
    mode: "internal_test_only",
    prototypeRules: [
      {
        ruleId: "EN16931-R001",
        businessRuleId: "BR-CO-10",
        layer: "en16931_tc434",
        context: "/Invoice",
        test: "ID = 'OTHER'",
        message: "BR-CO-10 failed without echoing XML.",
        field: "document.number"
      }
    ]
  });
  const finding = result.findings[0];

  assert.equal(result.status, "failed");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.markedValid, false);
  assert.equal(finding?.code, "EN16931_SCHEMATRON_RULE_FAILED");
  assert.equal(finding?.schematronLayer, "en16931_tc434");
  assert.equal(finding?.ruleId, "EN16931-R001");
  assert.equal(finding?.businessRuleId, "BR-CO-10");
  assertNoRawXml(result);
});

test("internal test-only rejects unsafe XML before mapping or prototype execution", async () => {
  const cases = [
    {
      xml: `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`,
      reason: "en16931_execution_doctype_blocked"
    },
    {
      xml: `<?xml version="1.0"?><Invoice><!ENTITY xxe "x"></Invoice>`,
      reason: "en16931_execution_entity_blocked"
    },
    {
      xml: `<?xml version="1.0"?><Invoice SYSTEM="file:///x">SECRET</Invoice>`,
      reason: "en16931_execution_external_identifier_blocked"
    },
    {
      xml: `<?xml version="1.0"?><?xml-stylesheet href="file:///x"?><Invoice>SECRET</Invoice>`,
      reason: "en16931_execution_stylesheet_blocked"
    }
  ];

  for (const item of cases) {
    const result = await runEn16931ExecutionPath({
      xml: item.xml,
      mode: "internal_test_only",
      svrlResults: [failedAssert()]
    });

    assert.equal(result.status, "unsafe_input");
    assert.equal(result.reason, item.reason);
    assert.equal(result.validationExecutionEnabled, false);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
    assertNoRawXml(result);
    assertNoUnsafePaths(result);
  }
});

test("internal test-only sanitizes raw XML, paths, and file URLs while preserving safe EN 16931 IDs", async () => {
  const result = await runEn16931ExecutionPath({
    xml: tinyXml,
    mode: "internal_test_only",
    svrlResults: [
      failedAssert({
        id: "EN16931-R001",
        businessRuleId: "BR-CO-10",
        location: `${rawXmlSentinel} ${windowsAbsolutePath}`,
        test: `${rawXmlSentinel} ${unixAbsolutePath}`,
        text: `BR-CO-10 ${rawXmlSentinel} ${windowsAbsolutePath} ${unixAbsolutePath} ${fileUrl}`,
        diagnostics: [`diagnostic ${rawXmlSentinel} ${windowsAbsolutePath}`],
        diagnosticReference: `BR-CO-10 ${unixAbsolutePath}`,
        see: fileUrl
      })
    ]
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.findings[0]?.ruleId, "EN16931-R001");
  assert.equal(result.findings[0]?.businessRuleId, "BR-CO-10");
  assert.equal(serialized.includes("EN16931-R001"), true);
  assert.equal(serialized.includes("BR-CO-10"), true);
  assertNoRawXml(result);
  assertNoUnsafePaths(result);
  assertNoForbiddenClaims(result);
});

test("outputs do not include forbidden assurance claims", async () => {
  const results: En16931ExecutionResult[] = [
    await runEn16931ExecutionPath({
      xml: rawXmlSentinel
    }),
    await runEn16931ExecutionPath({
      xml: rawXmlSentinel,
      mode: "preflight_only",
      artifactDiagnostics: schematronDiagnostics({
        en16931Configured: true,
        en16931Usable: true
      }),
      engineCandidate: engineCandidate({
        availabilityStatus: "available",
        executionSupported: true
      })
    }),
    await runEn16931ExecutionPath({
      xml: tinyXml,
      mode: "internal_test_only",
      svrlResults: [
        failedAssert({
          text:
            "certified compliant accepted by authority legally valid Peppol passed EN 16931 passed"
        })
      ]
    })
  ];

  for (const result of results) {
    assertNoForbiddenClaims(result);
  }
});
