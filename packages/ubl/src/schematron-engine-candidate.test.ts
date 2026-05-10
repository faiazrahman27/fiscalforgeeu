import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_ENGINE_CANDIDATE_VERSION,
  inspectSchematronEngineCandidate,
  normalizeSchematronEngineCandidateId,
  type SchematronEngineCandidateId,
  type SchematronEngineCandidateInfo
} from "./index.js";

const rawXmlSentinel =
  "<Invoice><ID>RAW-XML-SENTINEL-STEP-52</ID></Invoice>";
const schematronContentSentinel =
  "SCHEMATRON-FILE-CONTENT-SENTINEL-STEP-52";
const windowsAbsolutePath = "D:\\local\\schematron\\PEPPOL-BIS-Billing.sch";
const unixAbsolutePath = "/tmp/schematron/EN16931-TC434.sch";
const fileUrl = "file:///tmp/schematron/source.sch";
const prohibitedClaimPattern =
  /\bcertified\b|\bcompliant\b|\baccepted by authority\b|\blegally valid\b|\bPeppol passed\b|\bEN 16931 passed\b/i;

function assertCandidateShape(
  info: SchematronEngineCandidateInfo,
  engineId: SchematronEngineCandidateId
) {
  assert.equal(
    info.engineCandidateVersion,
    SCHEMATRON_ENGINE_CANDIDATE_VERSION
  );
  assert.equal(info.safeSummary.diagnosticKind, "schematron_engine_candidate");
  assert.equal(
    info.safeSummary.engineCandidateVersion,
    "schematron_engine_candidate_v1"
  );
  assert.equal(info.engineId, engineId);
  assert.equal(info.safeSummary.engineId, engineId);
  assert.equal(
    info.safeSummary.availabilityStatus,
    info.availabilityStatus
  );
  assert.equal(info.safeSummary.executionSupported, info.executionSupported);
  assert.equal(info.executionEnabledByDefault, false);
  assert.equal(info.safeSummary.executionEnabledByDefault, false);
  assert.deepEqual(info.safeSummary.capabilities, info.capabilities);
  assert.equal(info.safeSummary.packageName, info.packageName);
  assert.equal(info.safeSummary.packageVersion, info.packageVersion);
  assert.deepEqual(info.safeSummary.detectedPackages, info.detectedPackages);
  assert.equal(info.safeSummary.reason, info.reason);
}

function assertSafeOutput(info: SchematronEngineCandidateInfo) {
  const serialized = JSON.stringify(info);
  const safeSerialized = JSON.stringify(info.safeSummary);

  for (const value of [serialized, safeSerialized]) {
    assert.equal(value.includes(rawXmlSentinel), false);
    assert.equal(value.includes("RAW-XML-SENTINEL-STEP-52"), false);
    assert.equal(value.includes(schematronContentSentinel), false);
    assert.equal(value.includes(windowsAbsolutePath), false);
    assert.equal(value.includes(unixAbsolutePath), false);
    assert.equal(value.includes(fileUrl), false);
    assert.doesNotMatch(value, /[A-Za-z]:[\\/][^"\\s]+/);
    assert.doesNotMatch(value, /\/tmp\/schematron\/[A-Za-z0-9_.-]+/);
    assert.doesNotMatch(value, /file:\/\/\//i);
    assert.doesNotMatch(value, prohibitedClaimPattern);
  }
}

test("normalizes Schematron engine candidate ids and aliases safely", () => {
  const cases: Array<[unknown, SchematronEngineCandidateId]> = [
    [undefined, "placeholder"],
    ["", "placeholder"],
    [" none ", "none"],
    ["placeholder", "placeholder"],
    ["xslt2", "future_xslt2"],
    ["saxon", "future_xslt2"],
    ["future_xslt2", "future_xslt2"],
    ["schxslt", "future_schxslt"],
    ["future_schxslt", "future_schxslt"],
    ["xpath", "xpath_engine"],
    ["xpath_engine", "xpath_engine"],
    ["fontoxpath", "xpath_engine"],
    ["internal_test_candidate", "internal_test_candidate"],
    ["custom-engine", "none"]
  ];

  for (const [value, expected] of cases) {
    assert.equal(normalizeSchematronEngineCandidateId(value), expected);
  }
});

test("none candidate reports not_selected without execution support", async () => {
  const info = await inspectSchematronEngineCandidate({
    engineId: "none"
  });

  assertCandidateShape(info, "none");
  assert.equal(info.availabilityStatus, "not_selected");
  assert.equal(info.executionSupported, false);
  assert.deepEqual(info.capabilities, ["metadata_only"]);
  assert.equal(info.packageName, null);
  assert.equal(info.packageVersion, null);
  assert.equal(info.reason, "schematron_engine_not_selected");
  assertSafeOutput(info);
});

test("placeholder candidate reports placeholder_only without execution support", async () => {
  const info = await inspectSchematronEngineCandidate({
    engineId: "placeholder"
  });

  assertCandidateShape(info, "placeholder");
  assert.equal(info.availabilityStatus, "placeholder_only");
  assert.equal(info.executionSupported, false);
  assert.deepEqual(info.capabilities, ["metadata_only"]);
  assert.equal(info.packageName, null);
  assert.equal(info.packageVersion, null);
  assert.equal(info.reason, "schematron_placeholder_engine_selected");
  assertSafeOutput(info);
});

test("future_xslt2 reports safe unavailable metadata when no local dependency is installed", async () => {
  const info = await inspectSchematronEngineCandidate({
    engineId: "future_xslt2"
  });

  assertCandidateShape(info, "future_xslt2");
  assert.equal(info.availabilityStatus, "unavailable");
  assert.equal(info.executionSupported, false);
  assert.equal(info.reason, "schematron_xslt2_engine_not_installed");
  assert.equal(info.packageName, null);
  assert.equal(info.packageVersion, null);
  assert.equal(info.capabilities.includes("no_remote_fetch"), true);
  assertSafeOutput(info);
});

test("future_schxslt reports safe unavailable metadata when no local dependency is installed", async () => {
  const info = await inspectSchematronEngineCandidate({
    engineId: "future_schxslt"
  });

  assertCandidateShape(info, "future_schxslt");
  assert.equal(info.availabilityStatus, "unavailable");
  assert.equal(info.executionSupported, false);
  assert.equal(info.reason, "schematron_schxslt_engine_not_installed");
  assert.equal(info.packageName, null);
  assert.equal(info.packageVersion, null);
  assert.equal(info.capabilities.includes("no_remote_fetch"), true);
  assertSafeOutput(info);
});

test("internal_test_candidate reports isolated package-level candidate metadata", async () => {
  const info = await inspectSchematronEngineCandidate({
    engineId: "internal_test_candidate"
  });

  assertCandidateShape(info, "internal_test_candidate");
  assert.equal(info.availabilityStatus, "available");
  assert.equal(info.executionSupported, true);
  assert.equal(info.executionEnabledByDefault, false);
  assert.equal(info.packageName, null);
  assert.equal(info.packageVersion, null);
  assert.equal(info.reason, "schematron_internal_test_candidate_available");
  assert.equal(info.capabilities.includes("local_execution_candidate"), true);
  assert.equal(info.capabilities.includes("no_remote_fetch"), true);
  assert.equal(info.capabilities.includes("test_only"), true);
  assertSafeOutput(info);
});

test("xpath_engine reports guarded dependency-backed engine metadata without enabling default execution", async () => {
  const info = await inspectSchematronEngineCandidate({
    engineId: "xpath_engine"
  });

  assertCandidateShape(info, "xpath_engine");
  assert.equal(info.availabilityStatus, "available");
  assert.equal(info.executionSupported, true);
  assert.equal(info.executionEnabledByDefault, false);
  assert.equal(info.packageName, "fontoxpath+slimdom");
  assert.match(String(info.packageVersion), /fontoxpath@/);
  assert.match(String(info.packageVersion), /slimdom/);
  assert.equal(
    info.reason,
    "schematron_xpath_engine_candidate_available_execution_disabled_by_default"
  );
  assert.equal(info.capabilities.includes("metadata_only"), true);
  assert.equal(info.capabilities.includes("local_execution_candidate"), true);
  assert.equal(info.capabilities.includes("no_remote_fetch"), true);
  assert.equal(info.capabilities.includes("windows_compatible"), true);
  assert.equal(info.capabilities.includes("esm_compatible"), true);
  assert.equal(info.capabilities.includes("test_only"), true);
  assert.equal(info.capabilities.includes("xml_dom_execution"), true);
  assert.equal(info.capabilities.includes("xpath_assertion_execution"), true);
  assert.equal(
    info.detectedPackages.some(
      (item) => item.packageName === "fontoxpath" && item.available
    ),
    true
  );
  assert.equal(
    info.detectedPackages.some(
      (item) => item.packageName === "slimdom" && item.available
    ),
    true
  );
  assertSafeOutput(info);
});

test("unsafe candidate input is classified without leaking XML, Schematron content, paths, or file URLs", async () => {
  const info = await inspectSchematronEngineCandidate({
    engineId: `${rawXmlSentinel} ${schematronContentSentinel} ${windowsAbsolutePath} ${unixAbsolutePath} ${fileUrl}`
  });

  assertCandidateShape(info, "none");
  assert.equal(info.availabilityStatus, "not_selected");
  assert.equal(info.executionSupported, false);
  assertSafeOutput(info);
});
