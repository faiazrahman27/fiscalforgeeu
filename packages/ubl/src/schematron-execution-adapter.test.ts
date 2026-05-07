import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_EXECUTION_ADAPTER_VERSION,
  buildSchematronExecutionPreflight,
  type SchematronExecutionMode,
  type SchematronLayer,
  type SchematronPreflightStatus,
  type SchematronSafeArtifactDiagnostics
} from "./index.js";

const rawXmlSentinel = "<Invoice><ID>RAW-XML-SENTINEL-STEP-50</ID></Invoice>";
const schematronContentSentinel =
  "SCHEMATRON-FILE-CONTENT-SENTINEL-STEP-50";
const windowsAbsolutePath = "D:\\local\\schematron\\PEPPOL-BIS-Billing.sch";
const unixAbsolutePath = "/tmp/schematron/EN16931-TC434.sch";
const prohibitedClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

function fakeDiagnostics(input: {
  configured: boolean;
  usable: boolean;
  readyArtifactCount: number;
}): SchematronSafeArtifactDiagnostics {
  return {
    diagnosticKind: "schematron_artifacts",
    configured: input.configured,
    usable: input.usable,
    readyArtifactCount: input.readyArtifactCount,
    requiredArtifactCount: 2,
    allRequiredArtifactsReadable: input.readyArtifactCount === 2,
    validatorName: "schematron-placeholder",
    validatorAvailable: false,
    validationExecutionEnabled: false,
    artifactVersion: "step-50-test",
    checkedAt: "2026-05-07T12:00:00.000Z",
    peppolBisArtifact: {
      artifactKind: "peppol_bis_billing",
      configured: input.configured,
      status: input.usable ? "available" : "unreadable",
      readable: input.usable,
      usable: input.usable,
      sha256: input.usable ? "a".repeat(64) : null,
      label: windowsAbsolutePath,
      basename: "PEPPOL-BIS-Billing.sch",
      reason: schematronContentSentinel
    },
    en16931Artifact: {
      artifactKind: "en16931_tc434",
      configured: input.configured,
      status: input.usable ? "available" : "missing",
      readable: input.usable,
      usable: input.usable,
      sha256: input.usable ? "b".repeat(64) : null,
      label: unixAbsolutePath,
      basename: "EN16931-TC434.sch",
      reason: "file:///tmp/schematron/source.sch"
    },
    disclaimer:
      "These are technical configuration diagnostics for local Schematron artefacts in Invoice Lantern. They do not execute Schematron validation."
  };
}

function preflight(input: {
  mode?: SchematronExecutionMode;
  diagnostics?: SchematronSafeArtifactDiagnostics;
  requestedLayer?: SchematronLayer;
}) {
  return buildSchematronExecutionPreflight({
    xml: rawXmlSentinel,
    artifactDiagnostics:
      input.diagnostics ??
      fakeDiagnostics({
        configured: false,
        usable: false,
        readyArtifactCount: 0
      }),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.requestedLayer ? { requestedLayer: input.requestedLayer } : {})
  });
}

function assertNeverExecuted(result: ReturnType<typeof preflight>) {
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.safeSummary.validationExecutionEnabled, false);
  assert.equal(result.safeSummary.validationExecuted, false);
  assert.equal(result.safeSummary.markedValid, false);
}

function assertNoSensitiveLeak(result: ReturnType<typeof preflight>) {
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes(rawXmlSentinel), false);
  assert.equal(serialized.includes("RAW-XML-SENTINEL-STEP-50"), false);
  assert.equal(serialized.includes(schematronContentSentinel), false);
  assert.equal(serialized.includes(windowsAbsolutePath), false);
  assert.equal(serialized.includes(unixAbsolutePath), false);
  assert.doesNotMatch(serialized, /[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/tmp\/schematron\/[A-Za-z0-9_.-]+/);
}

function assertNoFindingAssuranceClaims(result: ReturnType<typeof preflight>) {
  for (const finding of result.findings) {
    assert.doesNotMatch(JSON.stringify(finding), prohibitedClaimPattern);
  }
}

function assertResult(input: {
  result: ReturnType<typeof preflight>;
  mode: SchematronExecutionMode;
  status: SchematronPreflightStatus;
  reason: string;
}) {
  assert.equal(
    input.result.adapterVersion,
    SCHEMATRON_EXECUTION_ADAPTER_VERSION
  );
  assert.equal(input.result.safeSummary.adapterVersion, "schematron_adapter_preflight_v1");
  assert.equal(input.result.mode, input.mode);
  assert.equal(input.result.safeSummary.mode, input.mode);
  assert.equal(input.result.status, input.status);
  assert.equal(input.result.safeSummary.status, input.status);
  assert.equal(input.result.reason, input.reason);
  assert.equal(input.result.safeSummary.reason, input.reason);
  assert.equal(input.result.safeSummary.diagnosticKind, "schematron_execution_preflight");
  assert.equal(input.result.findings.length > 0, true);
  assertNeverExecuted(input.result);
  assertNoSensitiveLeak(input.result);
  assertNoFindingAssuranceClaims(input.result);
}

test("default disabled mode returns disabled result without execution", () => {
  const result = preflight({});

  assertResult({
    result,
    mode: "disabled",
    status: "disabled",
    reason: "schematron_execution_disabled"
  });
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_NOT_ENABLED");
});

test("preflight_only with no configured artefacts returns not_configured", () => {
  const result = preflight({
    mode: "preflight_only",
    diagnostics: fakeDiagnostics({
      configured: false,
      usable: false,
      readyArtifactCount: 0
    })
  });

  assertResult({
    result,
    mode: "preflight_only",
    status: "not_configured",
    reason: "schematron_artifacts_not_configured"
  });
  assert.equal(result.configured, false);
  assert.equal(result.usable, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_ARTIFACT_NOT_CONFIGURED");
});

test("preflight_only with configured but unusable artefacts returns artifact_unreadable", () => {
  const result = preflight({
    mode: "preflight_only",
    diagnostics: fakeDiagnostics({
      configured: true,
      usable: false,
      readyArtifactCount: 0
    })
  });

  assertResult({
    result,
    mode: "preflight_only",
    status: "artifact_unreadable",
    reason: "schematron_artifacts_not_usable"
  });
  assert.equal(result.configured, true);
  assert.equal(result.usable, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_ARTIFACT_UNREADABLE");
});

test("preflight_only with usable artefacts returns ready_for_future_execution without execution", () => {
  const result = preflight({
    mode: "preflight_only",
    diagnostics: fakeDiagnostics({
      configured: true,
      usable: true,
      readyArtifactCount: 2
    })
  });

  assertResult({
    result,
    mode: "preflight_only",
    status: "ready_for_future_execution",
    reason: "schematron_artifacts_ready_but_execution_not_enabled"
  });
  assert.equal(result.configured, true);
  assert.equal(result.usable, true);
  assert.equal(result.readyArtifactCount, 2);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_NOT_ENABLED");
});

test("enabled mode is unsupported and still does not execute validation", () => {
  const result = preflight({
    mode: "enabled",
    diagnostics: fakeDiagnostics({
      configured: true,
      usable: true,
      readyArtifactCount: 2
    })
  });

  assertResult({
    result,
    mode: "enabled",
    status: "unsupported",
    reason: "schematron_execution_engine_not_implemented"
  });
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.findings[0]?.code, "SCHEMATRON_EXECUTION_ERROR");
});

test("selectedLayer normalization supports known layers and unknown", () => {
  assert.equal(
    preflight({ requestedLayer: "peppol_bis_billing" }).selectedLayer,
    "peppol_bis_billing"
  );
  assert.equal(
    preflight({ requestedLayer: "en16931_tc434" }).selectedLayer,
    "en16931_tc434"
  );
  assert.equal(
    buildSchematronExecutionPreflight({
      xml: rawXmlSentinel,
      requestedLayer: "local-custom" as SchematronLayer,
      artifactDiagnostics: fakeDiagnostics({
        configured: false,
        usable: false,
        readyArtifactCount: 0
      })
    }).selectedLayer,
    "unknown"
  );
});
