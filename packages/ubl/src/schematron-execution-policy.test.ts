import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_EXECUTION_POLICY_VERSION,
  buildSchematronExecutionPolicy,
  normalizeSchematronEngineId,
  normalizeSchematronExecutionPolicyMode,
  type SchematronEngineId,
  type SchematronExecutionPolicyMode
} from "./index.js";

const rawXmlSentinel =
  "<Invoice><ID>RAW-XML-SENTINEL-STEP-51</ID></Invoice>";
const schematronContentSentinel =
  "SCHEMATRON-FILE-CONTENT-SENTINEL-STEP-51";
const windowsAbsolutePath = "D:\\local\\schematron\\PEPPOL-BIS-Billing.sch";
const unixAbsolutePath = "/tmp/schematron/EN16931-TC434.sch";
const fileUrl = "file:///tmp/schematron/source.sch";
const prohibitedClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

function assertPolicyNeverExecutes(
  policy: ReturnType<typeof buildSchematronExecutionPolicy>
) {
  assert.equal(policy.executionPermitted, false);
  assert.equal(policy.validationExecutionEnabled, false);
  assert.equal(policy.safeSummary.executionPermitted, false);
  assert.equal(policy.safeSummary.validationExecutionEnabled, false);
}

function assertPolicyShape(input: {
  policy: ReturnType<typeof buildSchematronExecutionPolicy>;
  mode: SchematronExecutionPolicyMode;
  engineId: SchematronEngineId;
  reason: string;
}) {
  assert.equal(
    input.policy.policyVersion,
    SCHEMATRON_EXECUTION_POLICY_VERSION
  );
  assert.equal(input.policy.safeSummary.policyVersion, "schematron_policy_v1");
  assert.equal(
    input.policy.safeSummary.diagnosticKind,
    "schematron_execution_policy"
  );
  assert.equal(input.policy.mode, input.mode);
  assert.equal(input.policy.safeSummary.mode, input.mode);
  assert.equal(input.policy.engineId, input.engineId);
  assert.equal(input.policy.safeSummary.engineId, input.engineId);
  assert.equal(input.policy.reason, input.reason);
  assert.equal(input.policy.safeSummary.reason, input.reason);
  assertPolicyNeverExecutes(input.policy);
}

test("default policy is preflight_only with placeholder engine and no execution permission", () => {
  const policy = buildSchematronExecutionPolicy();

  assertPolicyShape({
    policy,
    mode: "preflight_only",
    engineId: "placeholder",
    reason: "schematron_execution_preflight_only"
  });
  assert.equal(policy.requestedMode, null);
  assert.equal(policy.requestedEngine, null);
  assert.equal(policy.allowExperimentalExecution, false);
});

test("disabled requested mode returns disabled policy", () => {
  const policy = buildSchematronExecutionPolicy({
    requestedMode: " disabled ",
    requestedEngine: "none"
  });

  assertPolicyShape({
    policy,
    mode: "disabled",
    engineId: "none",
    reason: "schematron_execution_disabled_by_policy"
  });
  assert.equal(policy.requestedMode, "disabled");
  assert.equal(policy.requestedEngine, "none");
});

test("preflight_only requested mode returns preflight-only policy", () => {
  const policy = buildSchematronExecutionPolicy({
    requestedMode: "preflight_only",
    requestedEngine: "placeholder"
  });

  assertPolicyShape({
    policy,
    mode: "preflight_only",
    engineId: "placeholder",
    reason: "schematron_execution_preflight_only"
  });
  assert.equal(policy.requestedMode, "preflight_only");
  assert.equal(policy.requestedEngine, "placeholder");
});

test("execution-like requested modes are blocked", () => {
  for (const requestedMode of ["enabled", "execute", "real", "production"]) {
    const policy = buildSchematronExecutionPolicy({
      requestedMode,
      requestedEngine: "saxon"
    });

    assertPolicyShape({
      policy,
      mode: "blocked_requested_execution",
      engineId: "future_xslt2",
      reason: "schematron_execution_requested_but_blocked"
    });
    assert.equal(policy.requestedMode, requestedMode);
    assert.equal(policy.requestedEngine, "saxon");
  }
});

test("allowExperimentalExecution true still does not permit execution", () => {
  const policy = buildSchematronExecutionPolicy({
    requestedMode: "enabled",
    requestedEngine: "future_schxslt",
    allowExperimentalExecution: true
  });

  assertPolicyShape({
    policy,
    mode: "blocked_requested_execution",
    engineId: "future_schxslt",
    reason: "schematron_experimental_execution_not_available"
  });
  assert.equal(policy.allowExperimentalExecution, true);
  assert.equal(policy.safeSummary.allowExperimentalExecution, true);
});

test("mode normalization classifies safe and execution-like values", () => {
  assert.equal(normalizeSchematronExecutionPolicyMode(undefined), "preflight_only");
  assert.equal(normalizeSchematronExecutionPolicyMode(""), "preflight_only");
  assert.equal(normalizeSchematronExecutionPolicyMode("disabled"), "disabled");
  assert.equal(
    normalizeSchematronExecutionPolicyMode("preflight_only"),
    "preflight_only"
  );
  assert.equal(
    normalizeSchematronExecutionPolicyMode("enabled"),
    "blocked_requested_execution"
  );
  assert.equal(
    normalizeSchematronExecutionPolicyMode("execute"),
    "blocked_requested_execution"
  );
  assert.equal(
    normalizeSchematronExecutionPolicyMode("production"),
    "blocked_requested_execution"
  );
  assert.equal(
    normalizeSchematronExecutionPolicyMode("unexpected"),
    "preflight_only"
  );
});

test("engine normalization maps known aliases and unknown strings", () => {
  const cases: Array<[unknown, SchematronEngineId]> = [
    [undefined, "placeholder"],
    ["none", "none"],
    ["placeholder", "placeholder"],
    ["xslt2", "future_xslt2"],
    ["saxon", "future_xslt2"],
    ["future_xslt2", "future_xslt2"],
    ["schxslt", "future_schxslt"],
    ["future_schxslt", "future_schxslt"],
    ["xpath", "xpath_engine"],
    ["xpath_engine", "xpath_engine"],
    ["fontoxpath", "xpath_engine"],
    ["custom-engine", "unknown"]
  ];

  for (const [value, expected] of cases) {
    assert.equal(normalizeSchematronEngineId(value), expected);
  }
});

test("policy output does not leak XML, Schematron content, local paths, or file URLs", () => {
  const policy = buildSchematronExecutionPolicy({
    requestedMode: rawXmlSentinel,
    requestedEngine: `${schematronContentSentinel} ${windowsAbsolutePath} ${unixAbsolutePath} ${fileUrl}`,
    allowExperimentalExecution: true
  });
  const serialized = JSON.stringify(policy);

  assert.equal(serialized.includes(rawXmlSentinel), false);
  assert.equal(serialized.includes("RAW-XML-SENTINEL-STEP-51"), false);
  assert.equal(serialized.includes(schematronContentSentinel), false);
  assert.equal(serialized.includes(windowsAbsolutePath), false);
  assert.equal(serialized.includes(unixAbsolutePath), false);
  assert.equal(serialized.includes(fileUrl), false);
  assert.doesNotMatch(serialized, /[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(serialized, /\/tmp\/schematron\/[A-Za-z0-9_.-]+/);
  assert.doesNotMatch(serialized, /file:\/\/\//i);
});

test("policy output does not make certification, compliance, or validation-pass claims", () => {
  const policies = [
    buildSchematronExecutionPolicy(),
    buildSchematronExecutionPolicy({ requestedMode: "enabled" }),
    buildSchematronExecutionPolicy({
      requestedMode: "enabled",
      allowExperimentalExecution: true
    })
  ];

  for (const policy of policies) {
    assert.doesNotMatch(JSON.stringify(policy), prohibitedClaimPattern);
  }
});
