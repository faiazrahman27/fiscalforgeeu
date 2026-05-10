import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION,
  buildSchematronArtifactManifestHashRecordingSuggestion,
  buildSchematronArtifactReviewChecklist,
  buildSchematronArtifactReviewIntake,
  buildSchematronArtifactReviewIntakeSummary,
  listSchematronArtifactManifestRecords,
  listSchematronArtifactReviewChecklistTemplateItems,
  listSchematronArtifactSourceRecords,
  runSchematronExecutionOrchestrator,
  runSchematronXPathEngine,
  sanitizeSchematronArtifactReviewExpectedSha256,
  sanitizeSchematronArtifactReviewNotes,
  sanitizeSchematronArtifactReviewTimestamp,
  sanitizeSchematronArtifactReviewerLabel,
  validateSchematronArtifactReviewIntake,
  type SchematronArtifactReviewChecklistItem,
  type SchematronArtifactReviewChecklistItemId,
  type SchematronArtifactReviewIntakeInput,
  type SchematronArtifactReviewIntakeLayer
} from "./index.js";

const validSha256 = "a".repeat(64);
const matchingUppercaseSha256 = "B".repeat(64);
const invalidSha256 = "g".repeat(64);
const peppolSlotId = "schematron_slot_peppol_bis_billing_v1";
const en16931SlotId = "schematron_slot_en16931_tc434_v1";
const rawXmlSentinel = "<Invoice><ID>INTAKE-RAW-SENTINEL</ID></Invoice>";
const windowsAbsolutePath = "D:\\secret\\schematron\\artifact.sch";
const unixAbsolutePath = "/home/user/secret/artifact.sch";
const fileUrl = "file:///home/user/secret/artifact.sch";

const requiredChecklistItemIds = [
  "source_record_selected",
  "manifest_record_selected",
  "artifact_version_recorded",
  "expected_sha256_recorded",
  "source_url_reviewed",
  "documentation_url_reviewed",
  "local_artifact_hash_compared",
  "no_remote_fetch_confirmed",
  "no_file_contents_returned_confirmed",
  "no_full_paths_returned_confirmed",
  "no_execution_enabled_confirmed",
  "no_official_claims_confirmed",
  "professional_review_boundary_confirmed"
] as const satisfies readonly SchematronArtifactReviewChecklistItemId[];

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

function completedChecklist() {
  return listSchematronArtifactReviewChecklistTemplateItems().map((item) => ({
    id: item.id,
    completed: true
  }));
}

function validInput(
  overrides: Partial<SchematronArtifactReviewIntakeInput> = {}
): SchematronArtifactReviewIntakeInput {
  return {
    layer: "peppol_bis_billing",
    artifactSlotId: peppolSlotId,
    expectedArtifactVersion: "reviewed-2026-05",
    expectedSha256: validSha256,
    reviewedBy: "Review Team",
    reviewedAt: "2026-05-10T12:00:00Z",
    reviewNotes: "Reviewed source metadata and local hash comparison.",
    checklist: completedChecklist(),
    ...overrides
  };
}

test("intake checklist template exports required blocking metadata safely", () => {
  const template = listSchematronArtifactReviewChecklistTemplateItems();

  assert.equal(template.length > 0, true);
  assert.deepEqual(
    template.map((item) => item.id),
    [...requiredChecklistItemIds]
  );
  assert.deepEqual(
    listSchematronArtifactReviewChecklistTemplateItems({
      layer: "peppol_bis_billing"
    }).map((item) => item.id),
    [...requiredChecklistItemIds]
  );
  assert.deepEqual(
    listSchematronArtifactReviewChecklistTemplateItems({
      layer: "unknown"
    }).map((item) => item.id),
    []
  );

  for (const item of template) {
    assert.equal(item.required, true);
    assert.equal(item.blockingIfIncomplete, true);
    assert.equal(item.completed, false);
    assertNoForbiddenClaims(item.label);
    assertNoUndefinedValues(item);
  }
});

test("intake checklist copies do not mutate the template constants", () => {
  const first = listSchematronArtifactReviewChecklistTemplateItems() as Array<
    SchematronArtifactReviewChecklistItem
  >;
  const mutable = first[0];

  assert.ok(mutable);
  mutable.completed = true;
  mutable.label = "Mutated local copy";

  const fresh = listSchematronArtifactReviewChecklistTemplateItems();

  assert.equal(fresh[0]?.completed, false);
  assert.equal(fresh[0]?.label, "Source register record selected");

  const partial = buildSchematronArtifactReviewChecklist({
    checklist: [
      {
        id: "source_record_selected",
        completed: true,
        required: false,
        blockingIfIncomplete: false
      }
    ]
  });

  assert.equal(partial[0]?.completed, true);
  assert.equal(partial[0]?.required, true);
  assert.equal(partial[0]?.blockingIfIncomplete, true);
  assert.equal(partial.filter((item) => item.completed).length, 1);
});

test("intake sanitizers bound and reject unsafe reviewer metadata", () => {
  const longNotes = Array.from({ length: 120 }, () => "review").join(" ");

  assert.equal(
    sanitizeSchematronArtifactReviewerLabel("Review   Team"),
    "Review Team"
  );
  assert.equal(sanitizeSchematronArtifactReviewerLabel(windowsAbsolutePath), null);
  assert.equal(sanitizeSchematronArtifactReviewerLabel(fileUrl), null);
  assert.equal(sanitizeSchematronArtifactReviewerLabel("token reviewer"), null);
  assert.equal(
    sanitizeSchematronArtifactReviewNotes("Reviewed   source metadata."),
    "Reviewed source metadata."
  );
  assert.equal(
    sanitizeSchematronArtifactReviewNotes(longNotes)?.length,
    500
  );
  assert.equal(sanitizeSchematronArtifactReviewNotes("<xml>unsafe</xml>"), null);
  assert.equal(sanitizeSchematronArtifactReviewNotes(unixAbsolutePath), null);
  assert.equal(
    sanitizeSchematronArtifactReviewTimestamp("2026-05-10T12:00:00Z"),
    "2026-05-10T12:00:00Z"
  );
  assert.equal(
    sanitizeSchematronArtifactReviewTimestamp("2026-05-10T12:00:00+02:00"),
    "2026-05-10T12:00:00+02:00"
  );
  assert.equal(sanitizeSchematronArtifactReviewTimestamp("2026-05-10"), null);
  assert.equal(
    sanitizeSchematronArtifactReviewTimestamp("2026-05-10T12:00:00Z\nx"),
    null
  );
  assert.equal(sanitizeSchematronArtifactReviewTimestamp(fileUrl), null);

  for (const value of [
    sanitizeSchematronArtifactReviewerLabel(undefined),
    sanitizeSchematronArtifactReviewNotes(undefined),
    sanitizeSchematronArtifactReviewTimestamp(undefined)
  ]) {
    assert.notEqual(value, undefined);
  }
});

test("intake expected SHA-256 sanitizer accepts only safe digest metadata", () => {
  assert.equal(
    sanitizeSchematronArtifactReviewExpectedSha256(validSha256),
    validSha256
  );
  assert.equal(
    sanitizeSchematronArtifactReviewExpectedSha256(matchingUppercaseSha256),
    matchingUppercaseSha256.toLowerCase()
  );
  assert.equal(
    sanitizeSchematronArtifactReviewExpectedSha256(invalidSha256),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactReviewExpectedSha256(`${validSha256}\n`),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactReviewExpectedSha256(`https://${validSha256}`),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactReviewExpectedSha256(`/${validSha256}`),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactReviewExpectedSha256(`file://${validSha256}`),
    null
  );
  assert.equal(
    sanitizeSchematronArtifactReviewExpectedSha256(`secret-${validSha256}`),
    null
  );
  assert.notEqual(
    sanitizeSchematronArtifactReviewExpectedSha256(undefined),
    undefined
  );
});

test("valid completed intake is eligible only for manual manifest hash recording", () => {
  const intake = buildSchematronArtifactReviewIntake(validInput());

  assert.equal(
    intake.intakeVersion,
    SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION
  );
  assert.equal(intake.layer, "peppol_bis_billing");
  assert.equal(intake.artifactSlotId, peppolSlotId);
  assert.equal(intake.sourceRecord?.artifactSlotId, peppolSlotId);
  assert.equal(intake.manifestRecord?.artifactSlotId, peppolSlotId);
  assert.equal(intake.expectedArtifactVersion, "reviewed-2026-05");
  assert.equal(intake.expectedSha256, validSha256);
  assert.equal(intake.hashAlgorithm, "sha256");
  assert.equal(intake.completedRequiredCount, intake.requiredCount);
  assert.equal(intake.blockingIncompleteCount, 0);
  assert.deepEqual(intake.blockers, []);
  assert.equal(intake.eligibleForManifestHashRecording, true);
  assert.equal(intake.eligibleForExecution, false);
  assert.equal(intake.artifactExecuted, false);
  assert.equal(intake.remoteFetchingPermitted, false);
  assert.equal(intake.rawFileContentsReturned, false);
  assert.equal(intake.fullAbsolutePathsReturned, false);
  assert.equal(intake.safety.rawXmlReturned, false);
  assert.equal(intake.safety.schematronFileContentsReturned, false);
  assert.equal(intake.safety.fullAbsoluteLocalPathsReturned, false);
  assert.equal(intake.safety.remoteFetching, false);
  assert.equal(intake.safety.artifactDownloaded, false);
  assert.equal(intake.safety.artifactExecuted, false);
  assertNoForbiddenClaims(intake);
  assertNoUnsafePublicPathLabels(intake);
  assertNoUndefinedValues(intake);
});

test("intake validation blocks missing or invalid hash and checklist gaps", () => {
  const missingHash = validateSchematronArtifactReviewIntake(
    validInput({
      expectedSha256: null
    })
  );
  const invalidHash = validateSchematronArtifactReviewIntake(
    validInput({
      expectedSha256: invalidSha256
    })
  );
  const missingVersion = validateSchematronArtifactReviewIntake(
    validInput({
      expectedArtifactVersion: null
    })
  );
  const incompleteChecklist = validateSchematronArtifactReviewIntake(
    validInput({
      checklist: completedChecklist().filter(
        (item) => item.id !== "source_record_selected"
      )
    })
  );
  const explicitIncompleteBlocking = validateSchematronArtifactReviewIntake(
    validInput({
      checklist: completedChecklist().map((item) =>
        item.id === "no_execution_enabled_confirmed"
          ? {
              id: item.id,
              completed: false
            }
          : item
      )
    })
  );

  assert.equal(missingHash.eligibleForManifestHashRecording, false);
  assert.match(missingHash.blockers.join("\n"), /Expected SHA-256 value is missing/);
  assert.equal(invalidHash.eligibleForManifestHashRecording, false);
  assert.match(invalidHash.blockers.join("\n"), /Expected SHA-256 value is unsafe or invalid/);
  assert.equal(missingVersion.eligibleForManifestHashRecording, false);
  assert.match(
    missingVersion.blockers.join("\n"),
    /Expected artifact version label is missing/
  );
  assert.equal(incompleteChecklist.eligibleForManifestHashRecording, false);
  assert.match(
    incompleteChecklist.blockers.join("\n"),
    /source_record_selected/
  );
  assert.equal(
    explicitIncompleteBlocking.eligibleForManifestHashRecording,
    false
  );
  assert.equal(explicitIncompleteBlocking.blockingIncompleteCount, 1);
  assert.match(
    explicitIncompleteBlocking.blockers.join("\n"),
    /no_execution_enabled_confirmed/
  );
});

test("intake validation blocks invalid layers and mismatched records safely", () => {
  assert.throws(
    () =>
      validateSchematronArtifactReviewIntake(
        validInput({
          layer: "unknown" as SchematronArtifactReviewIntakeLayer
        })
      ),
    /Unsupported Schematron artifact review intake layer/
  );

  const mismatchedSlot = validateSchematronArtifactReviewIntake(
    validInput({
      artifactSlotId: en16931SlotId
    })
  );
  const missingSourceRecord = validateSchematronArtifactReviewIntake(
    validInput({
      sourceRecords: []
    })
  );
  const missingManifestRecord = validateSchematronArtifactReviewIntake(
    validInput({
      manifestRecords: []
    })
  );

  assert.equal(mismatchedSlot.eligibleForManifestHashRecording, false);
  assert.match(
    mismatchedSlot.blockers.join("\n"),
    /does not match the source register record/
  );
  assert.match(
    mismatchedSlot.blockers.join("\n"),
    /does not match the manifest record/
  );
  assert.equal(missingSourceRecord.eligibleForManifestHashRecording, false);
  assert.match(
    missingSourceRecord.blockers.join("\n"),
    /No source register record exists/
  );
  assert.equal(missingManifestRecord.eligibleForManifestHashRecording, false);
  assert.match(
    missingManifestRecord.blockers.join("\n"),
    /No manifest record exists/
  );
  assertNoForbiddenClaims(mismatchedSlot);
  assertNoUnsafePublicPathLabels(mismatchedSlot);
});

test("summary and manual suggestion expose safe process metadata only", () => {
  const summary = buildSchematronArtifactReviewIntakeSummary(validInput());
  const suggestion =
    buildSchematronArtifactManifestHashRecordingSuggestion(validInput());
  const incompleteSuggestion =
    buildSchematronArtifactManifestHashRecordingSuggestion(
      validInput({
        expectedSha256: null
      })
    );

  assert.equal(summary.expectedArtifactVersionRecorded, true);
  assert.equal(summary.expectedSha256Recorded, true);
  assert.equal(summary.eligibleForManifestHashRecording, true);
  assert.equal(summary.eligibleForExecution, false);
  assert.equal(summary.remoteFetchingPermitted, false);
  assert.equal(summary.rawFileContentsReturned, false);
  assert.equal(summary.fullAbsolutePathsReturned, false);
  assert.equal(summary.artifactExecuted, false);
  assert.equal(suggestion.eligibleForManualManifestUpdate, true);
  assert.equal(suggestion.expectedArtifactVersion, "reviewed-2026-05");
  assert.equal(suggestion.expectedSha256, validSha256);
  assert.match(suggestion.warning, /Manual manifest update still requires/);
  assert.equal(incompleteSuggestion.eligibleForManualManifestUpdate, false);
  assert.equal("expectedSha256" in incompleteSuggestion, false);
  assert.equal("expectedArtifactVersion" in incompleteSuggestion, false);
  assertNoForbiddenClaims(summary);
  assertNoForbiddenClaims(suggestion);
  assertNoForbiddenClaims(incompleteSuggestion);
  assertNoUndefinedValues(summary);
  assertNoUndefinedValues(suggestion);
  assertNoUndefinedValues(incompleteSuggestion);
});

test("intake helpers do not modify manifest or source register records", () => {
  const manifestBefore = listSchematronArtifactManifestRecords();
  const sourceBefore = listSchematronArtifactSourceRecords();

  buildSchematronArtifactReviewIntake(validInput());
  buildSchematronArtifactReviewIntakeSummary(validInput());
  buildSchematronArtifactManifestHashRecordingSuggestion(validInput());

  assert.deepEqual(listSchematronArtifactManifestRecords(), manifestBefore);
  assert.deepEqual(listSchematronArtifactSourceRecords(), sourceBefore);
});

test("intake boundary fields stay disabled and do not expose request toggles", () => {
  const intake = buildSchematronArtifactReviewIntake(
    validInput({
      reviewedBy: windowsAbsolutePath,
      reviewedAt: fileUrl,
      reviewNotes: unixAbsolutePath,
      checklist: [
        ...completedChecklist(),
        {
          id: "unknown" as SchematronArtifactReviewChecklistItemId,
          completed: true
        }
      ]
    })
  );
  const serialized = JSON.stringify(intake);

  assert.equal(intake.reviewedBy, null);
  assert.equal(intake.reviewedAt, null);
  assert.equal(intake.reviewNotes, null);
  assert.equal(intake.eligibleForExecution, false);
  assert.equal(intake.artifactExecuted, false);
  assert.equal(intake.safety.artifactExecuted, false);
  assert.equal(intake.safety.remoteFetching, false);
  assert.equal(serialized.includes(rawXmlSentinel), false);
  assert.equal(serialized.includes("executionMode"), false);
  assert.equal(serialized.includes("allowExperimentalExecution"), false);
  assert.equal(serialized.includes("manifestMutation"), false);
  assert.equal(serialized.includes("reviewIntakeRequestOption"), false);
  assert.equal(serialized.includes("publicApi"), false);
  assertNoUnsafePublicPathLabels(intake);
});

test("intake module import does not activate XPath or Schematron execution", async () => {
  buildSchematronArtifactReviewIntake(validInput());

  const preflight = await runSchematronExecutionOrchestrator({
    xml: rawXmlSentinel,
    mode: "preflight_only",
    layers: "both",
    allowInternalXPathExecution: true,
    internalAssertionFixtureIds: ["peppol-required-id"]
  });
  const disabledXPath = await runSchematronXPathEngine({
    xml: rawXmlSentinel,
    mode: "disabled",
    assertions: [
      {
        ruleId: "review-intake-boundary-test",
        testExpression: "true()",
        assertionText: "Internal boundary assertion."
      }
    ],
    allowInternalXPathExecution: true
  });

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
});
