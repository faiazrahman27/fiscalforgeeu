import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
  SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
  buildSafeSchematronArtifactDiagnostics,
  buildSchematronArtifactManifestSummary,
  getSchematronArtifactManifestRecordForLayer,
  listSchematronArtifactManifestRecords,
  runSchematronExecutionOrchestrator,
  runSchematronXPathEngine,
  sanitizeSchematronArtifactExpectedSha256,
  sanitizeSchematronArtifactManifestDisplayLabel,
  sanitizeSchematronArtifactManifestReviewStatus,
  sanitizeSchematronArtifactManifestVersionLabel,
  selectSchematronArtifactManifestRecords,
  verifySchematronArtifactAgainstManifest,
  verifySchematronArtifactsAgainstManifest,
  type SchematronArtifactExpectedManifestRecord
} from "./index.js";

const lowercaseSha256 = "a".repeat(64);
const matchingSha256 = "b".repeat(64);
const mismatchingSha256 = "c".repeat(64);
const uppercaseSha256 = "D".repeat(64);
const windowsAbsolutePath = "D:\\secret\\schematron\\artifact.sch";
const unixAbsolutePath = "/home/user/secret/artifact.sch";
const fileUrl = "file:///home/user/secret/artifact.sch";
const rawXmlSentinel = "<Invoice><ID>MANIFEST-RAW</ID></Invoice>";

const forbiddenClaimPhrases = [
  "Schematron passed",
  "Peppol certified",
  "Peppol passed",
  "EN 16931 compliant",
  "EN 16931 passed",
  "authority accepted",
  "accepted by authority",
  "proves compliance",
  "legally valid",
  "tax compliant",
  "official validation",
  "filing ready",
  "guaranteed compliance"
] as const;

const forbiddenClaimPattern = new RegExp(
  forbiddenClaimPhrases
    .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "i"
);

function collectStringValues(value: unknown, strings: string[] = []) {
  if (typeof value === "string") {
    strings.push(value);
    return strings;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, strings);
    }

    return strings;
  }

  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStringValues(item, strings);
    }
  }

  return strings;
}

function assertNoForbiddenClaims(value: unknown) {
  for (const item of collectStringValues(value)) {
    assert.doesNotMatch(item, forbiddenClaimPattern, item);
  }
}

function assertNoUnsafePublicPathLabels(value: unknown) {
  const serialized = JSON.stringify(value);

  assert.equal(serialized.includes(windowsAbsolutePath), false);
  assert.equal(serialized.includes(unixAbsolutePath), false);
  assert.equal(serialized.includes(fileUrl), false);
  assert.doesNotMatch(serialized, /(?:^|["\s])[A-Za-z]:[\\/][^"\\s]+/);
  assert.doesNotMatch(
    serialized,
    /\/(?:Users|home|tmp|var|etc|root|mnt|Volumes)\//i
  );
  assert.doesNotMatch(serialized, /file:\/\//i);
}

function assertNoUndefinedValues(value: unknown, label = "value") {
  assert.notEqual(value, undefined, `${label} should not be undefined`);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoUndefinedValues(item, `${label}[${index}]`);
    });
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      assertNoUndefinedValues(item, `${label}.${key}`);
    }
  }
}

function assertRecordSafetyFlags(
  record: SchematronArtifactExpectedManifestRecord
) {
  assert.equal(record.officialValidationClaimed, false);
  assert.equal(record.certificationClaimed, false);
  assert.equal(record.complianceGuaranteeClaimed, false);
  assert.equal(record.authorityAcceptanceClaimed, false);
  assert.equal(record.remoteFetchingPermitted, false);
  assert.equal(record.rawFileContentsReturned, false);
  assert.equal(record.fullAbsolutePathsReturned, false);
}

function manifestRecordWithExpectedHash(input: {
  layer?: "peppol_bis_billing" | "en16931_tc434";
  expectedSha256: string | null;
  expectedArtifactVersion?: string | null;
}): SchematronArtifactExpectedManifestRecord {
  const base = getSchematronArtifactManifestRecordForLayer(
    input.layer ?? "peppol_bis_billing"
  );

  return {
    ...base,
    expectedArtifactVersion: input.expectedArtifactVersion ?? "reviewed-2026-05",
    expectedSha256: input.expectedSha256,
    reviewStatus: input.expectedSha256
      ? "expected_hash_recorded"
      : "expected_hash_missing",
    sourceLabels: [...base.sourceLabels]
  };
}

test("manifest catalog exports both Schematron artifact slots safely", () => {
  const records = listSchematronArtifactManifestRecords();
  const slotIds = records.map((record) => record.artifactSlotId);

  assert.equal(records.length > 0, true);
  assert.equal(
    records.some((record) => record.layer === "peppol_bis_billing"),
    true
  );
  assert.equal(
    records.some((record) => record.layer === "en16931_tc434"),
    true
  );
  assert.equal(new Set(slotIds).size, slotIds.length);

  for (const record of records) {
    assert.equal(record.manifestVersion, SCHEMATRON_ARTIFACT_MANIFEST_VERSION);
    assert.equal(
      record.sourceRegisterVersion,
      SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION
    );
    assert.equal(record.sourceRecordLayer, record.layer);
    assert.equal(record.expectedRootEnvVar, "PEPPOL_SCHEMATRON_ROOT_DIR");
    assert.match(record.expectedPathEnvVar, /SCHEMATRON_PATH$/);
    assert.equal(record.artifactVersionEnvVar, "SCHEMATRON_ARTIFACT_VERSION");
    assert.equal(record.hashAlgorithm, "sha256");
    assert.equal(record.expectedArtifactVersion, null);
    assert.equal(record.expectedSha256, null);
    assert.equal(record.reviewStatus, "expected_hash_missing");
    assert.equal(record.reviewedBy, null);
    assert.equal(record.reviewedAt, null);
    assert.equal(record.reviewNotes, null);
    assert.equal(record.sourceLabels.length > 0, true);
    assert.equal(record.legalConfidence, "technical");
    assertRecordSafetyFlags(record);
    assertNoForbiddenClaims(record);
    assertNoUnsafePublicPathLabels(record);
    assertNoUndefinedValues(record);
  }
});

test("manifest selectors return defensive copies and validate layer inputs", () => {
  const selected = selectSchematronArtifactManifestRecords({
    layers: ["peppol_bis_billing", "unknown", "en16931_tc434"]
  });

  assert.deepEqual(
    selected.map((record) => record.layer),
    ["peppol_bis_billing", "en16931_tc434"]
  );
  assert.deepEqual(selectSchematronArtifactManifestRecords({ layer: "bad" }), []);

  const mutableRecords = listSchematronArtifactManifestRecords() as Array<
    SchematronArtifactExpectedManifestRecord & {
      sourceLabels: string[];
    }
  >;
  mutableRecords[0]?.sourceLabels.push("mutated label");

  const freshRecord =
    getSchematronArtifactManifestRecordForLayer("peppol_bis_billing");

  assert.equal(freshRecord.sourceLabels.includes("mutated label"), false);
});

test("manifest summary is metadata-only and legal-boundary safe", () => {
  const summary = buildSchematronArtifactManifestSummary();
  const peppolSummary = buildSchematronArtifactManifestSummary({
    layer: "peppol_bis_billing"
  });

  assert.equal(summary.manifestVersion, SCHEMATRON_ARTIFACT_MANIFEST_VERSION);
  assert.equal(
    summary.sourceRegisterVersion,
    SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION
  );
  assert.equal(summary.recordCount, 2);
  assert.deepEqual(summary.selectedLayers, [
    "peppol_bis_billing",
    "en16931_tc434"
  ]);
  assert.equal(peppolSummary.recordCount, 1);
  assert.deepEqual(peppolSummary.selectedLayers, ["peppol_bis_billing"]);
  assert.equal(summary.expectedSha256RecordedCount, 0);
  assert.equal(summary.expectedSha256MissingCount, 2);
  assert.equal(summary.configuredEnvVars.includes("PEPPOL_SCHEMATRON_ROOT_DIR"), true);
  assert.equal(summary.configuredEnvVars.includes("PEPPOL_BIS_SCHEMATRON_PATH"), true);
  assert.equal(summary.configuredEnvVars.includes("EN16931_SCHEMATRON_PATH"), true);
  assert.equal(summary.configuredEnvVars.includes("SCHEMATRON_ARTIFACT_VERSION"), true);
  assert.equal(summary.remoteFetchingPermitted, false);
  assert.equal(summary.rawFileContentsReturned, false);
  assert.equal(summary.fullAbsolutePathsReturned, false);
  assert.equal(summary.officialValidationClaimed, false);
  assert.equal(summary.certificationClaimed, false);
  assert.equal(summary.complianceGuaranteeClaimed, false);
  assert.equal(summary.authorityAcceptanceClaimed, false);
  assertNoForbiddenClaims(summary);
  assertNoUnsafePublicPathLabels(summary);
  assertNoUndefinedValues(summary);
});

test("manifest sanitizers reject unsafe hash, label, version, and status values", () => {
  assert.equal(
    sanitizeSchematronArtifactExpectedSha256(lowercaseSha256),
    lowercaseSha256
  );
  assert.equal(
    sanitizeSchematronArtifactExpectedSha256(uppercaseSha256),
    uppercaseSha256.toLowerCase()
  );
  assert.equal(sanitizeSchematronArtifactExpectedSha256("a".repeat(63)), null);
  assert.equal(sanitizeSchematronArtifactExpectedSha256("g".repeat(64)), null);
  assert.equal(
    sanitizeSchematronArtifactExpectedSha256(`${lowercaseSha256}\n`),
    null
  );
  assert.equal(sanitizeSchematronArtifactExpectedSha256(`/${lowercaseSha256}`), null);
  assert.equal(
    sanitizeSchematronArtifactExpectedSha256(`https://${lowercaseSha256}`),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactExpectedSha256(`file://${lowercaseSha256}`),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactExpectedSha256(`secret-${lowercaseSha256}`),
    null
  );
  assert.equal(sanitizeSchematronArtifactExpectedSha256(""), null);
  assert.equal(sanitizeSchematronArtifactExpectedSha256(null), null);
  assert.equal(sanitizeSchematronArtifactExpectedSha256(undefined), null);
  assert.equal(
    sanitizeSchematronArtifactManifestDisplayLabel("peppol/PEPPOL.sch"),
    "peppol/PEPPOL.sch"
  );
  assert.equal(
    sanitizeSchematronArtifactManifestDisplayLabel(windowsAbsolutePath),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactManifestDisplayLabel(unixAbsolutePath),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactManifestDisplayLabel("../artifact.sch"),
    null
  );
  assert.equal(sanitizeSchematronArtifactManifestDisplayLabel(fileUrl), null);
  assert.equal(
    sanitizeSchematronArtifactManifestVersionLabel("local-reviewed-2026-05"),
    "local-reviewed-2026-05"
  );
  assert.equal(
    sanitizeSchematronArtifactManifestVersionLabel("local/reviewed/2026-05"),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactManifestReviewStatus("local_hash_matched"),
    "local_hash_matched"
  );
  assert.equal(
    sanitizeSchematronArtifactManifestReviewStatus("hash_recorded"),
    null
  );
});

test("verification reports safe not-configured and expected-hash-missing states", () => {
  const notConfigured = verifySchematronArtifactAgainstManifest({
    layer: "peppol_bis_billing",
    diagnostic: {
      artifactKind: "peppol_bis_billing",
      configured: false,
      readable: false,
      usable: false,
      status: "not_configured"
    }
  });
  const expectedMissing = verifySchematronArtifactAgainstManifest({
    layer: "peppol_bis_billing",
    diagnostic: {
      artifactKind: "peppol_bis_billing",
      artifactVersion: "local-2026-05",
      configured: true,
      readable: true,
      usable: true,
      sha256: matchingSha256,
      safeLabel: "peppol/PEPPOL-BIS-Billing.sch",
      basename: "PEPPOL-BIS-Billing.sch",
      relativePathUnderRoot: "peppol/PEPPOL-BIS-Billing.sch",
      status: "available"
    }
  });

  assert.equal(notConfigured.hashStatus, "not_applicable");
  assert.equal(notConfigured.reviewStatus, "not_configured");
  assert.equal(notConfigured.artifactStatus, "not_configured");
  assert.equal(notConfigured.actualSha256, null);
  assert.equal(expectedMissing.hashStatus, "expected_hash_missing");
  assert.equal(expectedMissing.reviewStatus, "expected_hash_missing");
  assert.equal(expectedMissing.actualArtifactVersion, "local-2026-05");
  assert.equal(expectedMissing.actualSha256, matchingSha256);
  assert.equal(expectedMissing.safeLabel, "peppol/PEPPOL-BIS-Billing.sch");
  assert.equal(expectedMissing.basename, "PEPPOL-BIS-Billing.sch");
  assert.equal(
    expectedMissing.relativePathUnderRoot,
    "peppol/PEPPOL-BIS-Billing.sch"
  );
  assert.equal(expectedMissing.safety.artifactExecuted, false);
  assertNoUndefinedValues(notConfigured);
  assertNoUndefinedValues(expectedMissing);
  assertNoUnsafePublicPathLabels(expectedMissing);
});

test("verification compares expected and actual SHA-256 metadata safely", () => {
  const expectedRecord = manifestRecordWithExpectedHash({
    expectedSha256: matchingSha256
  });
  const actualMissing = verifySchematronArtifactAgainstManifest({
    manifestRecord: expectedRecord,
    diagnostic: {
      artifactKind: "peppol_bis_billing",
      configured: true,
      readable: true,
      usable: true,
      status: "available"
    }
  });
  const matched = verifySchematronArtifactAgainstManifest({
    manifestRecord: expectedRecord,
    diagnostic: {
      artifactKind: "peppol_bis_billing",
      artifactVersion: "actual-2026-05",
      configured: true,
      readable: true,
      usable: true,
      sha256: matchingSha256,
      status: "available"
    }
  });
  const mismatched = verifySchematronArtifactAgainstManifest({
    manifestRecord: expectedRecord,
    diagnostic: {
      artifactKind: "peppol_bis_billing",
      configured: true,
      readable: true,
      usable: true,
      sha256: mismatchingSha256,
      status: "available"
    }
  });

  assert.equal(actualMissing.hashStatus, "actual_hash_missing");
  assert.equal(actualMissing.reviewStatus, "expected_hash_recorded");
  assert.equal(matched.hashStatus, "matched");
  assert.equal(matched.reviewStatus, "local_hash_matched");
  assert.equal(matched.expectedSha256, matchingSha256);
  assert.equal(matched.actualSha256, matchingSha256);
  assert.equal(matched.expectedArtifactVersion, "reviewed-2026-05");
  assert.equal(matched.actualArtifactVersion, "actual-2026-05");
  assert.equal(mismatched.hashStatus, "mismatched");
  assert.equal(mismatched.reviewStatus, "local_hash_mismatched");
  assert.equal(mismatched.expectedSha256, matchingSha256);
  assert.equal(mismatched.actualSha256, mismatchingSha256);
});

test("verification maps missing, unreadable, and out-of-root artifact states", () => {
  const expectedRecord = manifestRecordWithExpectedHash({
    expectedSha256: matchingSha256
  });
  const missing = verifySchematronArtifactAgainstManifest({
    manifestRecord: expectedRecord,
    diagnostic: {
      artifactKind: "peppol_bis_billing",
      configured: true,
      readable: false,
      usable: false,
      status: "missing"
    }
  });
  const unreadable = verifySchematronArtifactAgainstManifest({
    manifestRecord: expectedRecord,
    diagnostic: {
      artifactKind: "peppol_bis_billing",
      configured: true,
      readable: false,
      usable: false,
      status: "unreadable"
    }
  });
  const outOfRoot = verifySchematronArtifactAgainstManifest({
    manifestRecord: expectedRecord,
    diagnostic: {
      artifactKind: "peppol_bis_billing",
      configured: true,
      readable: false,
      usable: false,
      status: "out_of_root"
    }
  });

  assert.equal(missing.artifactStatus, "missing");
  assert.equal(missing.reviewStatus, "local_artifact_missing");
  assert.equal(unreadable.artifactStatus, "unreadable");
  assert.equal(unreadable.reviewStatus, "local_artifact_unreadable");
  assert.equal(outOfRoot.artifactStatus, "out_of_root");
  assert.equal(outOfRoot.reviewStatus, "local_artifact_out_of_root");
});

test("verification sanitizes unsafe versions, paths, and source records without mutation", () => {
  const originalRecord =
    getSchematronArtifactManifestRecordForLayer("peppol_bis_billing");
  const record = manifestRecordWithExpectedHash({
    expectedSha256: matchingSha256,
    expectedArtifactVersion: windowsAbsolutePath
  });
  const verification = verifySchematronArtifactAgainstManifest({
    manifestRecord: record,
    diagnostic: {
      artifactKind: "peppol_bis_billing",
      artifactVersion: windowsAbsolutePath,
      configured: true,
      readable: true,
      usable: true,
      sha256: matchingSha256,
      safeLabel: windowsAbsolutePath,
      basename: fileUrl,
      relativePathUnderRoot: "../secret.sch",
      status: "available"
    }
  });
  const freshRecord =
    getSchematronArtifactManifestRecordForLayer("peppol_bis_billing");

  assert.equal(verification.expectedArtifactVersion, null);
  assert.equal(verification.actualArtifactVersion, null);
  assert.equal(verification.safeLabel, null);
  assert.equal(verification.basename, null);
  assert.equal(verification.relativePathUnderRoot, null);
  assert.deepEqual(freshRecord, originalRecord);
  assertNoUnsafePublicPathLabels(verification);
  assertNoUndefinedValues(verification);
});

test("bulk verification supports layer filtering and both local artifact slots", () => {
  const both = verifySchematronArtifactsAgainstManifest({
    peppolBisArtifact: {
      artifactKind: "peppol_bis_billing",
      configured: true,
      readable: true,
      usable: true,
      sha256: matchingSha256,
      status: "available"
    },
    en16931Artifact: {
      artifactKind: "en16931_tc434",
      configured: false,
      readable: false,
      usable: false,
      status: "not_configured"
    }
  });
  const en16931Only = verifySchematronArtifactsAgainstManifest({
    layer: "en16931_tc434",
    peppolBisArtifact: {
      artifactKind: "peppol_bis_billing",
      configured: true,
      readable: true,
      usable: true,
      sha256: matchingSha256,
      status: "available"
    }
  });

  assert.deepEqual(
    both.map((verification) => verification.layer),
    ["peppol_bis_billing", "en16931_tc434"]
  );
  assert.deepEqual(
    en16931Only.map((verification) => verification.layer),
    ["en16931_tc434"]
  );
  assert.equal(both[0]?.hashStatus, "expected_hash_missing");
  assert.equal(both[1]?.hashStatus, "not_applicable");
});

test("safe Schematron diagnostics include manifest verification metadata only", async () => {
  const diagnostics = await buildSafeSchematronArtifactDiagnostics(undefined);
  const peppolManifest =
    diagnostics.peppolBisArtifact.manifestVerification;
  const en16931Manifest =
    diagnostics.en16931Artifact.manifestVerification;

  assert.equal(
    diagnostics.artifactManifestVersion,
    SCHEMATRON_ARTIFACT_MANIFEST_VERSION
  );
  assert.equal(diagnostics.artifactManifestSummary?.recordCount, 2);
  assert.equal(diagnostics.validationExecutionEnabled, false);
  assert.equal(diagnostics.validatorAvailable, false);
  assert.equal(
    diagnostics.peppolBisArtifact.artifactManifestVersion,
    SCHEMATRON_ARTIFACT_MANIFEST_VERSION
  );
  assert.equal(peppolManifest?.layer, "peppol_bis_billing");
  assert.equal(peppolManifest?.hashStatus, "not_applicable");
  assert.equal(peppolManifest?.reviewStatus, "not_configured");
  assert.equal(peppolManifest?.safety.artifactExecuted, false);
  assert.equal(peppolManifest?.safety.remoteFetching, false);
  assert.equal(en16931Manifest?.layer, "en16931_tc434");
  assert.equal(en16931Manifest?.hashStatus, "not_applicable");
  assert.equal(diagnostics.peppolBisArtifact.expectedSha256Recorded, false);
  assert.equal(diagnostics.peppolBisArtifact.actualSha256Recorded, false);
  assert.equal(diagnostics.peppolBisArtifact.manifestHashStatus, "not_applicable");
  assert.equal(diagnostics.peppolBisArtifact.manifestReviewStatus, "not_configured");
  assert.equal(JSON.stringify(diagnostics).includes(rawXmlSentinel), false);
  assertNoUnsafePublicPathLabels(diagnostics);
});

test("manifest verification metadata does not activate Schematron or XPath execution", async () => {
  const artifactDiagnostics = await buildSafeSchematronArtifactDiagnostics(
    undefined
  );
  const preflight = await runSchematronExecutionOrchestrator({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    layers: "both",
    artifactDiagnostics,
    allowInternalXPathExecution: true,
    internalAssertionFixtureIds: ["peppol-required-id"]
  });
  const disabledXPath = await runSchematronXPathEngine({
    xml: rawXmlSentinel,
    mode: "disabled",
    assertions: [
      {
        ruleId: "manifest-boundary-test",
        testExpression: "true()",
        assertionText: "Internal boundary assertion."
      }
    ],
    allowInternalXPathExecution: true
  });

  assert.equal(preflight.mode, "preflight_only");
  assert.equal(preflight.validationExecutionEnabled, false);
  assert.equal(preflight.validationExecuted, false);
  assert.equal(preflight.markedValid, false);
  assert.equal(preflight.internalAssertionFixtureSummary, undefined);
  assert.equal(preflight.safeSummary.internalAssertionFixtureSummary, undefined);
  assert.equal(disabledXPath.validationExecutionEnabled, false);
  assert.equal(disabledXPath.validationExecuted, false);
  assert.equal(disabledXPath.safetyMetadata.remoteFetching, false);
  assert.equal(disabledXPath.safetyMetadata.schematronFileContentsReturned, false);
  assert.equal(JSON.stringify(preflight).includes("<Invoice"), false);
  assert.equal(JSON.stringify(disabledXPath).includes("<Invoice"), false);
  assertNoUnsafePublicPathLabels(preflight);
  assertNoUnsafePublicPathLabels(disabledXPath);
});
