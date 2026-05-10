import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_ENGINE_CANDIDATE_VERSION,
  SCHEMATRON_EXECUTION_ORCHESTRATOR_VERSION,
  normalizeSchematronExecutionLayerSelection,
  normalizeSchematronExecutionOrchestratorMode,
  runSchematronExecutionOrchestrator,
  type SchematronEngineCandidateInfo,
  type SchematronSafeArtifactDiagnostics,
  type SchematronSvrlInputResult
} from "./index.js";

const rawXmlSentinel = "<Invoice><ID>SECRET</ID></Invoice>";
const tinyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <ID>INV-STEP-57</ID>
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
  en16931Configured: boolean;
  en16931Usable: boolean;
  peppolStatus?: "available" | "missing" | "unreadable" | "not_configured";
  en16931Status?: "available" | "missing" | "unreadable" | "not_configured";
}): SchematronSafeArtifactDiagnostics {
  const peppolStatus =
    input.peppolStatus ??
    (input.peppolUsable
      ? "available"
      : input.peppolConfigured
        ? "unreadable"
        : "not_configured");
  const en16931Status =
    input.en16931Status ??
    (input.en16931Usable
      ? "available"
      : input.en16931Configured
        ? "unreadable"
        : "not_configured");
  const readyArtifactCount = [
    input.peppolUsable,
    input.en16931Usable
  ].filter(Boolean).length;

  return {
    diagnosticKind: "schematron_artifacts",
    configured: input.peppolConfigured || input.en16931Configured,
    usable: readyArtifactCount > 0,
    readyArtifactCount,
    requiredArtifactCount: 2,
    allRequiredArtifactsReadable: input.peppolUsable && input.en16931Usable,
    validatorName: "schematron-placeholder",
    validatorAvailable: false,
    validationExecutionEnabled: false,
    artifactVersion: "step-57-test",
    checkedAt: "2026-05-09T00:00:00.000Z",
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
        : { reason: "test_peppol_artifact_not_usable" })
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
        : { reason: "test_en16931_artifact_not_usable" })
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

function peppolFailedAssert(
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

function en16931FailedAssert(
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
  assert.equal(
    normalizeSchematronExecutionOrchestratorMode(undefined),
    "disabled"
  );
  assert.equal(
    normalizeSchematronExecutionOrchestratorMode("disabled"),
    "disabled"
  );
  assert.equal(
    normalizeSchematronExecutionOrchestratorMode("preflight_only"),
    "preflight_only"
  );
  assert.equal(
    normalizeSchematronExecutionOrchestratorMode("internal_test_only"),
    "internal_test_only"
  );
  assert.equal(
    normalizeSchematronExecutionOrchestratorMode("production"),
    "disabled"
  );
});

test("layer selection normalization defaults unknown values to both", () => {
  assert.equal(normalizeSchematronExecutionLayerSelection(undefined), "both");
  assert.equal(
    normalizeSchematronExecutionLayerSelection("peppol_bis_billing"),
    "peppol_bis_billing"
  );
  assert.equal(
    normalizeSchematronExecutionLayerSelection("en16931_tc434"),
    "en16931_tc434"
  );
  assert.equal(normalizeSchematronExecutionLayerSelection("both"), "both");
  assert.equal(normalizeSchematronExecutionLayerSelection("unknown"), "both");
});

test("disabled mode returns disabled without parsing or execution", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`
  });

  assert.equal(
    result.orchestratorVersion,
    SCHEMATRON_EXECUTION_ORCHESTRATOR_VERSION
  );
  assert.equal(
    result.safeSummary.orchestratorVersion,
    SCHEMATRON_EXECUTION_ORCHESTRATOR_VERSION
  );
  assert.equal(
    result.safeSummary.diagnosticKind,
    "schematron_execution_orchestrator"
  );
  assert.equal(result.mode, "disabled");
  assert.equal(result.status, "disabled");
  assert.deepEqual(result.selectedLayers, [
    "peppol_bis_billing",
    "en16931_tc434"
  ]);
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.reason, "schematron_execution_orchestrator_disabled");
  assert.equal(result.layerSummaries.length, 2);
  assert.equal(
    result.findings.every(
      (finding) => finding.code === "SCHEMATRON_EXECUTION_NOT_ENABLED"
    ),
    true
  );
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("preflight both returns not_configured without execution", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      peppolConfigured: false,
      peppolUsable: false,
      en16931Configured: false,
      en16931Usable: false
    })
  });

  assert.equal(result.status, "not_configured");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.layerSummaries.length, 2);
  assert.deepEqual(
    result.layerSummaries.map((summary) => summary.status),
    ["not_configured", "not_configured"]
  );
  assertNoRawXml(result);
});

test("preflight both returns partial for ready plus not_configured layers", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      peppolConfigured: true,
      peppolUsable: true,
      en16931Configured: false,
      en16931Usable: false
    }),
    engineCandidate: engineCandidate({
      availabilityStatus: "available",
      executionSupported: true
    })
  });

  assert.equal(result.status, "partial");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.deepEqual(
    result.layerSummaries.map((summary) => summary.status),
    ["ready_for_future_execution", "not_configured"]
  );
  assertNoRawXml(result);
});

test("preflight both returns ready_for_future_execution without execution", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    artifactDiagnostics: schematronDiagnostics({
      peppolConfigured: true,
      peppolUsable: true,
      en16931Configured: true,
      en16931Usable: true
    }),
    engineCandidate: engineCandidate({
      availabilityStatus: "available",
      executionSupported: true
    })
  });

  assert.equal(result.status, "ready_for_future_execution");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.deepEqual(
    result.layerSummaries.map((summary) => summary.status),
    ["ready_for_future_execution", "ready_for_future_execution"]
  );
  assertNoRawXml(result);
  assertNoForbiddenClaims(result);
});

test("internal test-only Peppol selection maps only Peppol findings", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: tinyXml,
    mode: "internal_test_only",
    layers: "peppol_bis_billing",
    peppolSvrlResults: [peppolFailedAssert()],
    en16931SvrlResults: [en16931FailedAssert()]
  });
  const finding = result.findings[0];

  assert.equal(result.status, "failed");
  assert.deepEqual(result.selectedLayers, ["peppol_bis_billing"]);
  assert.equal(result.layerSummaries.length, 1);
  assert.equal(result.layerSummaries[0]?.layer, "peppol_bis_billing");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.markedValid, false);
  assert.equal(finding?.code, "PEPPOL_SCHEMATRON_RULE_FAILED");
  assert.equal(finding?.schematronLayer, "peppol_bis_billing");
  assert.equal(
    result.findings.some(
      (item) => item.code === "EN16931_SCHEMATRON_RULE_FAILED"
    ),
    false
  );
  assertNoRawXml(result);
});

test("internal test-only EN 16931 selection maps only EN 16931 findings", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: tinyXml,
    mode: "internal_test_only",
    layers: "en16931_tc434",
    peppolSvrlResults: [peppolFailedAssert()],
    en16931SvrlResults: [en16931FailedAssert()]
  });
  const finding = result.findings[0];

  assert.equal(result.status, "failed");
  assert.deepEqual(result.selectedLayers, ["en16931_tc434"]);
  assert.equal(result.layerSummaries.length, 1);
  assert.equal(result.layerSummaries[0]?.layer, "en16931_tc434");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.markedValid, false);
  assert.equal(finding?.code, "EN16931_SCHEMATRON_RULE_FAILED");
  assert.equal(finding?.schematronLayer, "en16931_tc434");
  assert.equal(
    result.findings.some(
      (item) => item.code === "PEPPOL_SCHEMATRON_RULE_FAILED"
    ),
    false
  );
  assertNoRawXml(result);
});

test("internal test-only both merges findings and safe layer counts", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: tinyXml,
    mode: "internal_test_only",
    layers: "both",
    peppolSvrlResults: [peppolFailedAssert()],
    en16931SvrlResults: [
      {
        kind: "successful_report",
        id: "EN16931-REPORT-WARNING",
        flag: "warning",
        location: "/Invoice",
        test: "true()",
        text: "A warning report was emitted."
      },
      {
        kind: "successful_report",
        id: "EN16931-REPORT-INFO",
        flag: "info",
        location: "/Invoice",
        test: "true()",
        text: "An info report was emitted."
      }
    ]
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(result.selectedLayers, [
    "peppol_bis_billing",
    "en16931_tc434"
  ]);
  assert.equal(result.findings.length, 3);
  assert.equal(result.safeSummary.findingCount, 3);
  assert.equal(result.safeSummary.fatalCount, 1);
  assert.equal(result.safeSummary.warningCount, 1);
  assert.equal(result.safeSummary.infoCount, 1);
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
      ["peppol_bis_billing", 1, 1, 0, 0],
      ["en16931_tc434", 2, 0, 1, 1]
    ]
  );
  assert.equal(result.markedValid, false);
  assertNoRawXml(result);
});

test("successful reports map to SCHEMATRON_REPORT_WARNING without pass claims", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: tinyXml,
    mode: "internal_test_only",
    layers: "both",
    peppolSvrlResults: [
      {
        kind: "successful_report",
        id: "PEPPOL-REPORT-R001",
        flag: "warning",
        location: "/Invoice",
        test: "true()",
        text: "A Schematron report item was emitted."
      }
    ],
    en16931SvrlResults: [
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

  assert.equal(result.status, "executed");
  assert.equal(result.validationExecutionEnabled, true);
  assert.equal(result.validationExecuted, true);
  assert.equal(result.markedValid, false);
  assert.equal(
    result.findings.every(
      (finding) => finding.code === "SCHEMATRON_REPORT_WARNING"
    ),
    true
  );
  assertNoForbiddenClaims(result);
});

test("internal test-only rejects unsafe XML before orchestration output can leak it", async () => {
  const cases = [
    `<?xml version="1.0"?><!DOCTYPE Invoice>${rawXmlSentinel}`,
    `<?xml version="1.0"?><Invoice><!ENTITY xxe "x"></Invoice>`,
    `<?xml version="1.0"?><Invoice SYSTEM="file:///x">SECRET</Invoice>`,
    `<?xml version="1.0"?><Invoice PUBLIC="file:///x">SECRET</Invoice>`,
    `<?xml version="1.0"?><?xml-stylesheet href="file:///x"?><Invoice>SECRET</Invoice>`
  ];

  for (const xml of cases) {
    const result = await runSchematronExecutionOrchestrator({
      xml,
      mode: "internal_test_only",
      peppolSvrlResults: [peppolFailedAssert()],
      en16931SvrlResults: [en16931FailedAssert()]
    });

    assert.equal(result.status, "unsafe_input");
    assert.equal(result.validationExecutionEnabled, false);
    assert.equal(result.validationExecuted, false);
    assert.equal(result.markedValid, false);
    assertNoRawXml(result);
    assertNoUnsafePaths(result);
  }
});

test("orchestrator sanitizes XML fragments and paths while preserving safe IDs", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: tinyXml,
    mode: "internal_test_only",
    layers: "both",
    peppolSvrlResults: [
      peppolFailedAssert({
        id: "PEPPOL-EN16931-R001",
        businessRuleId: "BR-CO-10",
        location: `${rawXmlSentinel} ${windowsAbsolutePath}`,
        test: `${rawXmlSentinel} ${unixAbsolutePath}`,
        text: `BR-CO-10 ${rawXmlSentinel} ${windowsAbsolutePath} ${unixAbsolutePath} ${fileUrl}`,
        diagnostics: [`diagnostic ${rawXmlSentinel} ${windowsAbsolutePath}`],
        diagnosticReference: `BR-CO-10 ${unixAbsolutePath}`,
        see: fileUrl
      })
    ],
    en16931SvrlResults: [
      en16931FailedAssert({
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

  assert.equal(serialized.includes("PEPPOL-EN16931-R001"), true);
  assert.equal(serialized.includes("EN16931-R001"), true);
  assert.equal(serialized.includes("BR-CO-10"), true);
  assertNoRawXml(result);
  assertNoUnsafePaths(result);
  assertNoForbiddenClaims(result);
});

test("orchestrator outputs do not include forbidden assurance claims", async () => {
  const results = [
    await runSchematronExecutionOrchestrator({
      xml: rawXmlSentinel
    }),
    await runSchematronExecutionOrchestrator({
      xml: rawXmlSentinel,
      mode: "preflight_only",
      artifactDiagnostics: schematronDiagnostics({
        peppolConfigured: true,
        peppolUsable: true,
        en16931Configured: true,
        en16931Usable: true
      }),
      engineCandidate: engineCandidate({
        availabilityStatus: "available",
        executionSupported: true
      })
    }),
    await runSchematronExecutionOrchestrator({
      xml: tinyXml,
      mode: "internal_test_only",
      peppolSvrlResults: [
        peppolFailedAssert({
          text:
            "certified compliant accepted by authority legally valid Peppol passed EN 16931 passed"
        })
      ],
      en16931SvrlResults: [
        en16931FailedAssert({
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
