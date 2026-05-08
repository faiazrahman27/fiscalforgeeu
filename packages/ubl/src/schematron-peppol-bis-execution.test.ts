import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PEPPOL_BIS_EXECUTION_PATH_VERSION,
  SCHEMATRON_ENGINE_CANDIDATE_VERSION,
  buildSchematronExecutionPolicy,
  normalizePeppolBisExecutionMode,
  runPeppolBisBillingExecutionPath,
  type PeppolBisExecutionResult,
  type SchematronEngineCandidateInfo,
  type SchematronSafeArtifactDiagnostics,
  type SchematronSvrlInputResult
} from "./index.js";

const rawXmlSentinel = "<Invoice><ID>SECRET</ID></Invoice>";
const tinyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <ID>INV-STEP-55</ID>
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
  peppolConfigured: boolean;
  peppolUsable: boolean;
  peppolStatus?: "available" | "missing" | "unreadable" | "not_configured";
}): SchematronSafeArtifactDiagnostics {
  const peppolStatus =
    input.peppolStatus ??
    (input.peppolUsable
      ? "available"
      : input.peppolConfigured
        ? "unreadable"
        : "not_configured");
  const readyArtifactCount = input.peppolUsable ? 1 : 0;

  return {
    diagnosticKind: "schematron_artifacts",
    configured: input.peppolConfigured,
    usable: input.peppolUsable,
    readyArtifactCount,
    requiredArtifactCount: 2,
    allRequiredArtifactsReadable: false,
    validatorName: "schematron-placeholder",
    validatorAvailable: false,
    validationExecutionEnabled: false,
    artifactVersion: "step-55-test",
    checkedAt: "2026-05-08T00:00:00.000Z",
    peppolBisArtifact: {
      artifactKind: "peppol_bis_billing",
      configured: input.peppolConfigured,
      status: peppolStatus,
      readable: input.peppolUsable,
      usable: input.peppolUsable,
      sha256: input.peppolUsable ? "a".repeat(64) : null,
      label: input.peppolConfigured ? "peppol/PEPPOL-BIS-Billing.sch" : null,
      basename: input.peppolConfigured ? "PEPPOL-BIS-Billing.sch" : null,
      ...(input.peppolUsable
        ? { relativePathUnderRoot: "peppol/PEPPOL-BIS-Billing.sch" }
        : { reason: "test_artifact_not_usable" })
    },
    en16931Artifact: {
      artifactKind: "en16931_tc434",
      configured: false,
      status: "not_configured",
      readable: false,
      usable: false,
      sha256: null,
      label: null,
      basename: null,
      reason: "local_schematron_artifact_path_not_configured"
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
    id: "PEPPOL-EN16931-R001",
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
  assert.equal(normalizePeppolBisExecutionMode(undefined), "disabled");
  assert.equal(normalizePeppolBisExecutionMode("disabled"), "disabled");
  assert.equal(
    normalizePeppolBisExecutionMode("preflight_only"),
    "preflight_only"
  );
  assert.equal(
    normalizePeppolBisExecutionMode("internal_test_only"),
    "internal_test_only"
  );
  assert.equal(normalizePeppolBisExecutionMode("enabled"), "disabled");
});

test("disabled mode returns disabled result without parsing or execution", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`
  });

  assert.equal(result.executionPathVersion, PEPPOL_BIS_EXECUTION_PATH_VERSION);
  assert.equal(result.safeSummary.executionPathVersion, PEPPOL_BIS_EXECUTION_PATH_VERSION);
  assert.equal(result.safeSummary.diagnosticKind, "peppol_bis_execution_path");
  assert.equal(result.mode, "disabled");
  assert.equal(result.status, "disabled");
  assert.equal(result.schematronLayer, "peppol_bis_billing");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.reason, "peppol_bis_execution_disabled");
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_NOT_ENABLED");
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("preflight reports not_configured when Peppol artefact is missing", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      peppolConfigured: false,
      peppolUsable: false
    })
  });

  assert.equal(result.status, "not_configured");
  assert.equal(result.reason, "peppol_bis_artifacts_not_configured");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_ARTIFACT_NOT_CONFIGURED");
  assertNoRawXml(result);
});

test("preflight reports artifact_unreadable when Peppol artefact is unusable", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      peppolConfigured: true,
      peppolUsable: false,
      peppolStatus: "unreadable"
    })
  });

  assert.equal(result.status, "artifact_unreadable");
  assert.equal(result.reason, "peppol_bis_artifacts_not_usable");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_ARTIFACT_UNREADABLE");
  assertNoRawXml(result);
});

test("preflight reports engine_unavailable when artefact is usable but engine is unavailable", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      peppolConfigured: true,
      peppolUsable: true
    }),
    engineCandidate: engineCandidate({
      availabilityStatus: "unavailable",
      executionSupported: false
    })
  });

  assert.equal(result.status, "engine_unavailable");
  assert.equal(result.reason, "peppol_bis_engine_unavailable");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
  assertNoRawXml(result);
});

test("preflight reports ready_for_future_execution without executing", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      peppolConfigured: true,
      peppolUsable: true
    }),
    engineCandidate: engineCandidate({
      availabilityStatus: "available",
      executionSupported: true
    })
  });

  assert.equal(result.status, "ready_for_future_execution");
  assert.equal(result.reason, "peppol_bis_ready_but_execution_not_enabled");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_NOT_ENABLED");
  assertNoRawXml(result);
});

test("preflight blocks execution-like policy requests without execution", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    policy: buildSchematronExecutionPolicy({
      requestedMode: "production",
      requestedEngine: "future_xslt2"
    }),
    artifactDiagnostics: schematronDiagnostics({
      peppolConfigured: true,
      peppolUsable: true
    }),
    engineCandidate: engineCandidate({
      availabilityStatus: "available",
      executionSupported: true
    })
  });

  assert.equal(result.status, "blocked_by_policy");
  assert.equal(result.reason, "peppol_bis_execution_blocked_by_policy");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
  assertNoRawXml(result);
});

test("internal test-only maps Peppol SVRL failed_assert findings safely", async () => {
  const result = await runPeppolBisBillingExecutionPath({
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
  assert.equal(finding?.code, "PEPPOL_SCHEMATRON_RULE_FAILED");
  assert.equal(finding?.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(finding?.businessRuleId, "BR-CO-10");
  assert.equal(finding?.ruleLocation, "/Invoice/cbc:ID");
  assert.equal(finding?.testExpression, "normalize-space(cbc:ID) != ''");
  assert.match(finding?.message ?? "", /BR-CO-10 failed/);
  assert.equal(finding?.assertionText, finding?.message);
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("internal test-only maps successful_report as report warning without pass claims", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: tinyXml,
    mode: "internal_test_only",
    svrlResults: [
      {
        kind: "successful_report",
        id: "PEPPOL-REPORT-R001",
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
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.status, "warning");
  assertNoForbiddenClaims(result);
});

test("internal test-only prefers supplied SVRL results over prototype rules", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: tinyXml,
    mode: "internal_test_only",
    svrlResults: [
      failedAssert({
        id: "PEPPOL-EN16931-R-SVRL"
      })
    ],
    prototypeRules: [
      {
        ruleId: "PEPPOL-EN16931-R-PROTOTYPE",
        layer: "peppol_bis_billing",
        context: "/Invoice",
        test: "false()",
        message: "Prototype rule should not be used."
      }
    ]
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.ruleId, "PEPPOL-EN16931-R-SVRL");
  assert.equal(JSON.stringify(result).includes("R-PROTOTYPE"), false);
});

test("internal test-only executes prototype rules through the Peppol layer", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: tinyXml,
    mode: "internal_test_only",
    prototypeRules: [
      {
        ruleId: "PEPPOL-EN16931-R001",
        businessRuleId: "BR-CO-10",
        layer: "peppol_bis_billing",
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
  assert.equal(finding?.code, "PEPPOL_SCHEMATRON_RULE_FAILED");
  assert.equal(finding?.schematronLayer, "peppol_bis_billing");
  assert.equal(finding?.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(finding?.businessRuleId, "BR-CO-10");
  assertNoRawXml(result);
});

test("internal test-only rejects unsafe XML before mapping or prototype execution", async () => {
  const cases = [
    {
      xml: `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`,
      reason: "peppol_bis_execution_doctype_blocked"
    },
    {
      xml: `<?xml version="1.0"?><Invoice><!ENTITY xxe "x"></Invoice>`,
      reason: "peppol_bis_execution_entity_blocked"
    },
    {
      xml: `<?xml version="1.0"?><Invoice SYSTEM="file:///x">SECRET</Invoice>`,
      reason: "peppol_bis_execution_external_identifier_blocked"
    },
    {
      xml: `<?xml version="1.0"?><?xml-stylesheet href="file:///x"?><Invoice>SECRET</Invoice>`,
      reason: "peppol_bis_execution_stylesheet_blocked"
    }
  ];

  for (const item of cases) {
    const result = await runPeppolBisBillingExecutionPath({
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

test("internal test-only sanitizes raw XML, paths, and file URLs while preserving safe rule IDs", async () => {
  const result = await runPeppolBisBillingExecutionPath({
    xml: tinyXml,
    mode: "internal_test_only",
    svrlResults: [
      failedAssert({
        id: "PEPPOL-EN16931-R001",
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

  assert.equal(result.findings[0]?.ruleId, "PEPPOL-EN16931-R001");
  assert.equal(result.findings[0]?.businessRuleId, "BR-CO-10");
  assert.equal(serialized.includes("PEPPOL-EN16931-R001"), true);
  assert.equal(serialized.includes("BR-CO-10"), true);
  assertNoRawXml(result);
  assertNoUnsafePaths(result);
  assertNoForbiddenClaims(result);
});

test("outputs do not include forbidden assurance claims", async () => {
  const results: PeppolBisExecutionResult[] = [
    await runPeppolBisBillingExecutionPath({
      xml: rawXmlSentinel
    }),
    await runPeppolBisBillingExecutionPath({
      xml: rawXmlSentinel,
      mode: "preflight_only",
      artifactDiagnostics: schematronDiagnostics({
        peppolConfigured: true,
        peppolUsable: true
      }),
      engineCandidate: engineCandidate({
        availabilityStatus: "available",
        executionSupported: true
      })
    }),
    await runPeppolBisBillingExecutionPath({
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
