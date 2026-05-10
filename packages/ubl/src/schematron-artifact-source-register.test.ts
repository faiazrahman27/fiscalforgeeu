import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
  buildSafeSchematronArtifactDiagnostics,
  buildSchematronArtifactProvenance,
  buildSchematronArtifactSourceRegisterSummary,
  getSchematronArtifactSourceRecordForLayer,
  listSchematronArtifactSourceRecords,
  runSchematronExecutionOrchestrator,
  sanitizeSchematronArtifactDisplayLabel,
  sanitizeSchematronArtifactSourceUrl,
  sanitizeSchematronArtifactVersionLabel,
  selectSchematronArtifactSourceRecords,
  type SchematronArtifactLayer,
  type SchematronArtifactSourceRecord
} from "./index.js";

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

const windowsAbsolutePath = "D:\\secret\\schematron\\artifact.sch";
const unixAbsolutePath = "/home/user/secret/artifact.sch";
const fileUrl = "file:///home/user/secret/artifact.sch";
const rawXmlSentinel = "<Invoice><ID>SOURCE-REGISTER-RAW</ID></Invoice>";

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

function assertRecordSafetyFlags(record: SchematronArtifactSourceRecord) {
  assert.equal(record.officialValidationClaimed, false);
  assert.equal(record.certificationClaimed, false);
  assert.equal(record.complianceGuaranteeClaimed, false);
  assert.equal(record.authorityAcceptanceClaimed, false);
  assert.equal(record.remoteFetchingPermitted, false);
  assert.equal(record.rawFileContentsReturned, false);
  assert.equal(record.fullAbsolutePathsReturned, false);
}

function assertHttpsUrlSafety(url: string) {
  const parsedUrl = new URL(url);

  assert.equal(parsedUrl.protocol, "https:");
  assert.equal(parsedUrl.username, "");
  assert.equal(parsedUrl.password, "");
  assert.notEqual(parsedUrl.hostname, "localhost");
  assert.equal(parsedUrl.hostname.startsWith("127."), false);
  assert.equal(parsedUrl.pathname.includes(".."), false);

  for (const key of parsedUrl.searchParams.keys()) {
    assert.doesNotMatch(key, /secret|token|password|credential|signature/i);
  }
}

test("source register exports both Schematron artifact slots safely", () => {
  const records = listSchematronArtifactSourceRecords();
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
    assert.equal(
      record.registerVersion,
      SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION
    );
    assert.equal(record.artifactKind, record.layer);
    assert.equal(record.sourceLabels.length > 0, true);
    assert.equal(record.legalConfidence, "technical");
    assert.equal(record.artifactVersionEnvVar, "SCHEMATRON_ARTIFACT_VERSION");
    assert.equal(record.expectedRootEnvVar, "PEPPOL_SCHEMATRON_ROOT_DIR");
    assert.match(record.expectedLocalPathEnvVar, /SCHEMATRON_PATH$/);
    assert.equal(
      record.configuredEnvVars.includes(record.expectedLocalPathEnvVar),
      true
    );
    assert.equal(
      record.configuredEnvVars.includes(record.expectedRootEnvVar),
      true
    );
    assert.equal(
      record.configuredEnvVars.includes(record.artifactVersionEnvVar),
      true
    );
    assert.equal(record.expectedHashAlgorithm, null);
    assert.equal(record.expectedSha256, null);
    assertRecordSafetyFlags(record);
    assertNoForbiddenClaims(record);
    assertNoUnsafePublicPathLabels(record);

    for (const url of [...record.sourceUrls, ...record.documentationUrls]) {
      assertHttpsUrlSafety(url);
    }
  }
});

test("source register selectors return defensive copies and validate layers", () => {
  const selected = selectSchematronArtifactSourceRecords({
    layers: ["peppol_bis_billing", "unknown", "en16931_tc434"]
  });

  assert.deepEqual(
    selected.map((record) => record.layer),
    ["peppol_bis_billing", "en16931_tc434"]
  );
  assert.deepEqual(selectSchematronArtifactSourceRecords({ layer: "bad" }), []);

  const mutableRecords = listSchematronArtifactSourceRecords() as Array<
    SchematronArtifactSourceRecord & {
      sourceLabels: string[];
      sourceUrls: string[];
    }
  >;
  mutableRecords[0]?.sourceLabels.push("mutated label");
  mutableRecords[0]?.sourceUrls.push("https://mutated.example.invalid/");

  const freshRecord =
    getSchematronArtifactSourceRecordForLayer("peppol_bis_billing");

  assert.equal(freshRecord.sourceLabels.includes("mutated label"), false);
  assert.equal(
    freshRecord.sourceUrls.includes("https://mutated.example.invalid/"),
    false
  );
});

test("source URL and label sanitizers reject unsafe URL and local path forms", () => {
  assert.equal(
    sanitizeSchematronArtifactSourceUrl("https://docs.peppol.eu/poacc/billing/3.0/"),
    "https://docs.peppol.eu/poacc/billing/3.0/"
  );
  assert.equal(sanitizeSchematronArtifactSourceUrl("http://example.com"), null);
  assert.equal(sanitizeSchematronArtifactSourceUrl(fileUrl), null);
  assert.equal(
    sanitizeSchematronArtifactSourceUrl("https://user:pass@example.com/doc"),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactSourceUrl("https://localhost/artifact.sch"),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactSourceUrl("https://127.0.0.1/artifact.sch"),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactSourceUrl("https://10.0.0.1/artifact.sch"),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactSourceUrl("https://example.com/../secret.sch"),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactSourceUrl("https://example.com/doc?token=secret"),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactDisplayLabel("schematron/peppol/artifact.sch"),
    "schematron/peppol/artifact.sch"
  );
  assert.equal(sanitizeSchematronArtifactDisplayLabel(windowsAbsolutePath), null);
  assert.equal(sanitizeSchematronArtifactDisplayLabel(unixAbsolutePath), null);
  assert.equal(sanitizeSchematronArtifactDisplayLabel("../artifact.sch"), null);
  assert.equal(sanitizeSchematronArtifactDisplayLabel(fileUrl), null);
  assert.equal(
    sanitizeSchematronArtifactVersionLabel("local-reviewed-2026-05"),
    "local-reviewed-2026-05"
  );
  assert.equal(
    sanitizeSchematronArtifactVersionLabel("local/reviewed/2026-05"),
    null
  );
});

test("provenance builder preserves safe diagnostics metadata", () => {
  const sha256 = "a".repeat(64);
  const provenance = buildSchematronArtifactProvenance({
    layer: "peppol_bis_billing",
    artifactVersion: "local-reviewed-2026-05",
    configured: true,
    readable: true,
    usable: true,
    sha256,
    safeLabel: "peppol/PEPPOL-BIS-Billing.sch",
    basename: "PEPPOL-BIS-Billing.sch",
    relativePathUnderRoot: "peppol/PEPPOL-BIS-Billing.sch"
  });

  assert.equal(
    provenance.registerVersion,
    SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION
  );
  assert.equal(provenance.layer, "peppol_bis_billing");
  assert.equal(
    provenance.artifactSlotId,
    "schematron_slot_peppol_bis_billing_v1"
  );
  assert.equal(provenance.artifactVersion, "local-reviewed-2026-05");
  assert.equal(provenance.configured, true);
  assert.equal(provenance.readable, true);
  assert.equal(provenance.usable, true);
  assert.equal(provenance.sha256, sha256);
  assert.equal(provenance.basename, "PEPPOL-BIS-Billing.sch");
  assert.equal(
    provenance.relativePathUnderRoot,
    "peppol/PEPPOL-BIS-Billing.sch"
  );
  assert.equal(provenance.reviewStatus, "hash_recorded");
  assert.equal(provenance.safety.rawXmlReturned, false);
  assert.equal(provenance.safety.schematronFileContentsReturned, false);
  assert.equal(provenance.safety.fullAbsoluteLocalPathsReturned, false);
  assert.equal(provenance.safety.remoteFetching, false);
  assert.equal(provenance.safety.certificationClaimed, false);
  assert.equal(provenance.safety.officialValidationClaimed, false);
  assert.equal(provenance.safety.complianceGuaranteeClaimed, false);
  assert.equal(provenance.safety.authorityAcceptanceClaimed, false);
  assertNoUndefinedValues(provenance);
  assertNoForbiddenClaims(provenance);
  assertNoUnsafePublicPathLabels(provenance);
});

test("provenance builder supports both layers and drops unsafe optional inputs", () => {
  const provenance = buildSchematronArtifactProvenance({
    layer: "en16931_tc434",
    artifactVersion: windowsAbsolutePath,
    configured: true,
    readable: false,
    usable: false,
    sha256: "not-a-hash",
    safeLabel: windowsAbsolutePath,
    basename: fileUrl,
    relativePathUnderRoot: "../secret.sch"
  });

  assert.equal(provenance.layer, "en16931_tc434");
  assert.equal(provenance.artifactSlotId, "schematron_slot_en16931_tc434_v1");
  assert.equal(provenance.artifactVersion, null);
  assert.equal(provenance.configured, true);
  assert.equal(provenance.readable, false);
  assert.equal(provenance.usable, false);
  assert.equal(provenance.sha256, null);
  assert.equal(provenance.safeLabel, null);
  assert.equal(provenance.basename, null);
  assert.equal(provenance.relativePathUnderRoot, null);
  assert.equal(provenance.reviewStatus, "locally_configured");
  assertNoUndefinedValues(provenance);
  assertNoUnsafePublicPathLabels(provenance);
});

test("source register summary is metadata-only and legal-boundary safe", () => {
  const summary = buildSchematronArtifactSourceRegisterSummary();
  const peppolSummary = buildSchematronArtifactSourceRegisterSummary({
    layer: "peppol_bis_billing"
  });

  assert.equal(
    summary.registerVersion,
    SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION
  );
  assert.equal(summary.recordCount, 2);
  assert.deepEqual(summary.selectedLayers, [
    "peppol_bis_billing",
    "en16931_tc434"
  ]);
  assert.equal(peppolSummary.recordCount, 1);
  assert.deepEqual(peppolSummary.selectedLayers, ["peppol_bis_billing"]);
  assert.equal(summary.remoteFetchingPermitted, false);
  assert.equal(summary.rawFileContentsReturned, false);
  assert.equal(summary.fullAbsolutePathsReturned, false);
  assert.equal(summary.officialValidationClaimed, false);
  assert.equal(summary.certificationClaimed, false);
  assert.equal(summary.complianceGuaranteeClaimed, false);
  assert.equal(summary.authorityAcceptanceClaimed, false);
  assert.equal(summary.configuredEnvVars.includes("PEPPOL_SCHEMATRON_ROOT_DIR"), true);
  assert.equal(summary.configuredEnvVars.includes("PEPPOL_BIS_SCHEMATRON_PATH"), true);
  assert.equal(summary.configuredEnvVars.includes("EN16931_SCHEMATRON_PATH"), true);
  assert.equal(summary.configuredEnvVars.includes("SCHEMATRON_ARTIFACT_VERSION"), true);
  assertNoForbiddenClaims(summary);
  assertNoUnsafePublicPathLabels(summary);
});

test("safe Schematron diagnostics include source provenance without enabling execution", async () => {
  const diagnostics = await buildSafeSchematronArtifactDiagnostics(undefined);
  const peppolProvenance = diagnostics.peppolBisArtifact.artifactProvenance;
  const en16931Provenance = diagnostics.en16931Artifact.artifactProvenance;

  assert.equal(diagnostics.sourceRegisterVersion, SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION);
  assert.equal(diagnostics.sourceRegisterSummary?.recordCount, 2);
  assert.equal(diagnostics.validationExecutionEnabled, false);
  assert.equal(diagnostics.validatorAvailable, false);
  assert.equal(peppolProvenance?.layer, "peppol_bis_billing");
  assert.equal(en16931Provenance?.layer, "en16931_tc434");
  assert.equal(peppolProvenance?.configured, false);
  assert.equal(en16931Provenance?.configured, false);
  assert.equal(peppolProvenance?.sha256, null);
  assert.equal(en16931Provenance?.sha256, null);
  assert.equal(peppolProvenance?.safety.remoteFetching, false);
  assert.equal(en16931Provenance?.safety.schematronFileContentsReturned, false);
  assertNoForbiddenClaims(diagnostics.sourceRegisterSummary);
  assertNoForbiddenClaims(peppolProvenance);
  assertNoForbiddenClaims(en16931Provenance);
  assertNoUnsafePublicPathLabels(diagnostics);
  assert.equal(JSON.stringify(diagnostics).includes(rawXmlSentinel), false);
});

test("source provenance does not activate public-style execution or internal fixtures", async () => {
  const result = await runSchematronExecutionOrchestrator({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    layers: "both",
    allowInternalXPathExecution: true,
    internalAssertionFixtureIds: ["peppol-required-id"]
  });

  assert.equal(result.mode, "preflight_only");
  assert.equal(result.validationExecutionEnabled, false);
  assert.equal(result.validationExecuted, false);
  assert.equal(result.markedValid, false);
  assert.equal(result.internalAssertionFixtureSummary, undefined);
  assert.equal(result.safeSummary.internalAssertionFixtureSummary, undefined);
  assert.equal(JSON.stringify(result).includes("<Invoice"), false);
  assertNoForbiddenClaims(result);
  assertNoUnsafePublicPathLabels(result);
});

test("layer type is compatible with both source register records", () => {
  const layers: SchematronArtifactLayer[] = [
    "peppol_bis_billing",
    "en16931_tc434"
  ];

  for (const layer of layers) {
    assert.equal(getSchematronArtifactSourceRecordForLayer(layer).layer, layer);
  }
});
