import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SCHEMATRON_ARTIFACT_MANIFEST_UPDATE_PLAN_VERSION,
  buildSchematronArtifactManifestManualPatchInstructions,
  buildSchematronArtifactManifestUpdatePlan,
  buildSchematronArtifactManifestUpdatePlanSummary,
  formatSchematronArtifactManifestUpdateFieldChanges,
  validateSchematronArtifactManifestUpdatePlan
} from "./schematron-artifact-manifest-update-plan.js";
import {
  listSchematronArtifactManifestRecords,
  type SchematronArtifactExpectedManifestRecord
} from "./schematron-artifact-manifest.js";
import {
  buildSchematronArtifactReviewIntake,
  listSchematronArtifactReviewChecklistTemplateItems,
  type SchematronArtifactReviewIntakeLayer
} from "./schematron-artifact-review-intake.js";

const REVIEWED_SHA_256 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ALTERNATE_SHA_256 =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const REVIEWED_VERSION = "reviewed-artifact-version-2026-05-10";
const REVIEWER = "Invoice Lantern Maintainer";
const REVIEWED_AT = "2026-05-10T10:00:00Z";
const REVIEW_NOTES = "Reviewed source metadata and local hash evidence.";

const FORBIDDEN_CLAIMS = [
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

function getManifestRecordForLayer(layer: SchematronArtifactReviewIntakeLayer) {
  const record = listSchematronArtifactManifestRecords().find(
    (manifestRecord) => manifestRecord.layer === layer
  );

  assert.ok(record, `Expected manifest record for ${layer}.`);

  return record;
}

function buildCompletedChecklist(layer: SchematronArtifactReviewIntakeLayer) {
  return listSchematronArtifactReviewChecklistTemplateItems({ layer }).map(
    (item) => ({
      id: item.id,
      completed: true
    })
  );
}

function buildEligibleIntakeInput(layer: SchematronArtifactReviewIntakeLayer) {
  const manifestRecord = getManifestRecordForLayer(layer);

  return {
    layer,
    artifactSlotId: manifestRecord.artifactSlotId,
    expectedArtifactVersion: REVIEWED_VERSION,
    expectedSha256: REVIEWED_SHA_256,
    reviewedBy: REVIEWER,
    reviewedAt: REVIEWED_AT,
    reviewNotes: REVIEW_NOTES,
    checklist: buildCompletedChecklist(layer)
  };
}

function buildEligibleIntake(layer: SchematronArtifactReviewIntakeLayer) {
  return buildSchematronArtifactReviewIntake(buildEligibleIntakeInput(layer));
}

function cloneManifestRecord(
  record: SchematronArtifactExpectedManifestRecord,
  overrides: Partial<SchematronArtifactExpectedManifestRecord> = {}
): SchematronArtifactExpectedManifestRecord {
  return {
    ...record,
    ...overrides,
    sourceLabels: overrides.sourceLabels
      ? [...overrides.sourceLabels]
      : [...record.sourceLabels]
  };
}

function buildAlreadyMatchingManifestRecords(
  layer: SchematronArtifactReviewIntakeLayer
) {
  return listSchematronArtifactManifestRecords().map((record) => {
    if (record.layer !== layer) {
      return record;
    }

    return cloneManifestRecord(record, {
      expectedArtifactVersion: REVIEWED_VERSION,
      expectedSha256: REVIEWED_SHA_256,
      reviewStatus: "expected_hash_recorded",
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      reviewNotes: REVIEW_NOTES
    });
  });
}

function buildPartiallyDifferentManifestRecords(
  layer: SchematronArtifactReviewIntakeLayer
) {
  return listSchematronArtifactManifestRecords().map((record) => {
    if (record.layer !== layer) {
      return record;
    }

    return cloneManifestRecord(record, {
      expectedArtifactVersion: "older-reviewed-artifact-version",
      expectedSha256: ALTERNATE_SHA_256,
      reviewStatus: "review_pending",
      reviewedBy: "Previous Reviewer",
      reviewedAt: "2026-04-01T00:00:00Z",
      reviewNotes: "Previous review note."
    });
  });
}

function expectNoForbiddenClaims(value: unknown) {
  const serialized = JSON.stringify(value);

  for (const forbiddenClaim of FORBIDDEN_CLAIMS) {
    assert.equal(
      serialized.includes(forbiddenClaim),
      false,
      `Unexpected forbidden claim appeared: ${forbiddenClaim}`
    );
  }
}

function expectSafetyFlags(plan: ReturnType<typeof buildSchematronArtifactManifestUpdatePlan>) {
  assert.equal(plan.writesFiles, false);
  assert.equal(plan.mutatesManifestAutomatically, false);
  assert.equal(plan.remoteFetchingPermitted, false);
  assert.equal(plan.artifactDownloaded, false);
  assert.equal(plan.artifactExecuted, false);
  assert.equal(plan.officialValidationClaimed, false);
  assert.equal(plan.certificationClaimed, false);
  assert.equal(plan.complianceGuaranteeClaimed, false);
  assert.equal(plan.authorityAcceptanceClaimed, false);

  assert.deepEqual(plan.safety, {
    rawXmlReturned: false,
    schematronFileContentsReturned: false,
    fullAbsoluteLocalPathsReturned: false,
    remoteFetching: false,
    artifactDownloaded: false,
    artifactExecuted: false,
    manifestMutatedAutomatically: false,
    certificationClaimed: false,
    officialValidationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false
  });
}

describe("Schematron artifact manifest update-plan", () => {
  it("builds a ready_for_manual_manifest_update plan when intake is eligible and manifest values differ", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const plan = buildSchematronArtifactManifestUpdatePlan({ intake });

    assert.equal(
      plan.planVersion,
      SCHEMATRON_ARTIFACT_MANIFEST_UPDATE_PLAN_VERSION
    );
    assert.equal(plan.layer, "peppol_bis_billing");
    assert.equal(plan.artifactSlotId, intake.artifactSlotId);
    assert.equal(plan.status, "ready_for_manual_manifest_update");
    assert.equal(plan.eligibleForManualManifestUpdate, true);
    assert.equal(plan.eligibleForExecution, false);
    assert.equal(plan.manifestRecordFound, true);
    assert.ok(plan.targetManifestRecordDisplayName);
    assert.ok(plan.fieldChanges.some((change) => change.changed));
    assert.ok(plan.patchObject);
    assert.equal(plan.patchObject.expectedArtifactVersion, REVIEWED_VERSION);
    assert.equal(plan.patchObject.expectedSha256, REVIEWED_SHA_256);
    assert.equal(plan.patchObject.hashAlgorithm, "sha256");
    assert.equal(plan.patchObject.reviewStatus, "expected_hash_recorded");
    assert.equal(plan.patchObject.reviewedBy, REVIEWER);
    assert.equal(plan.patchObject.reviewedAt, REVIEWED_AT);
    assert.equal(plan.patchObject.reviewNotes, REVIEW_NOTES);
    expectSafetyFlags(plan);
    expectNoForbiddenClaims(plan);
  });

  it("validateSchematronArtifactManifestUpdatePlan returns the same dry-run plan shape", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const plan = validateSchematronArtifactManifestUpdatePlan({ intake });

    assert.equal(plan.status, "ready_for_manual_manifest_update");
    assert.equal(plan.eligibleForManualManifestUpdate, true);
    assert.ok(plan.patchObject);
    expectSafetyFlags(plan);
  });

  it("builds a no_change_needed plan when the manifest already matches the intake values", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const plan = buildSchematronArtifactManifestUpdatePlan({
      intake,
      manifestRecords: buildAlreadyMatchingManifestRecords("peppol_bis_billing")
    });

    assert.equal(plan.status, "no_change_needed");
    assert.equal(plan.eligibleForManualManifestUpdate, false);
    assert.equal(plan.patchObject, null);
    assert.equal(
      plan.fieldChanges.every((change) => change.changed === false),
      true
    );
    assert.ok(
      plan.copyPastePatchSummary.some((item) =>
        item.includes("No manual manifest patch is needed")
      )
    );
    expectSafetyFlags(plan);
    expectNoForbiddenClaims(plan);
  });

  it("builds a blocked plan when review intake is not eligible", () => {
    const manifestRecord = getManifestRecordForLayer("peppol_bis_billing");
    const intake = buildSchematronArtifactReviewIntake({
      layer: "peppol_bis_billing",
      artifactSlotId: manifestRecord.artifactSlotId,
      expectedArtifactVersion: REVIEWED_VERSION,
      expectedSha256: REVIEWED_SHA_256,
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      reviewNotes: REVIEW_NOTES
    });
    const plan = buildSchematronArtifactManifestUpdatePlan({ intake });

    assert.equal(intake.eligibleForManifestHashRecording, false);
    assert.equal(plan.status, "blocked");
    assert.equal(plan.eligibleForManualManifestUpdate, false);
    assert.equal(plan.patchObject, null);
    assert.ok(
      plan.blockers.includes(
        "Review intake is not eligible for manual manifest hash recording."
      )
    );
    expectSafetyFlags(plan);
    expectNoForbiddenClaims(plan);
  });

  it("builds a blocked plan when the matching manifest record is missing", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const manifestRecords = listSchematronArtifactManifestRecords().filter(
      (record) => record.layer !== "peppol_bis_billing"
    );
    const plan = buildSchematronArtifactManifestUpdatePlan({
      intake,
      manifestRecords
    });

    assert.equal(plan.status, "blocked");
    assert.equal(plan.manifestRecordFound, false);
    assert.equal(plan.patchObject, null);
    assert.ok(plan.blockers.includes("Matching manifest record was not found."));
    expectSafetyFlags(plan);
  });

  it("builds a blocked plan when expectedSha256 is null", () => {
    const manifestRecord = getManifestRecordForLayer("peppol_bis_billing");
    const intake = buildSchematronArtifactReviewIntake({
      layer: "peppol_bis_billing",
      artifactSlotId: manifestRecord.artifactSlotId,
      expectedArtifactVersion: REVIEWED_VERSION,
      expectedSha256: null,
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      reviewNotes: REVIEW_NOTES,
      checklist: buildCompletedChecklist("peppol_bis_billing")
    });
    const plan = buildSchematronArtifactManifestUpdatePlan({ intake });

    assert.equal(plan.status, "blocked");
    assert.equal(plan.patchObject, null);
    assert.ok(
      plan.blockers.includes(
        "Review intake is not eligible for manual manifest hash recording."
      )
    );
    assert.ok(
      plan.blockers.includes("Expected SHA-256 value is missing or unsafe.")
    );
  });

  it("builds a blocked plan when expectedArtifactVersion is null", () => {
    const manifestRecord = getManifestRecordForLayer("peppol_bis_billing");
    const intake = buildSchematronArtifactReviewIntake({
      layer: "peppol_bis_billing",
      artifactSlotId: manifestRecord.artifactSlotId,
      expectedArtifactVersion: null,
      expectedSha256: REVIEWED_SHA_256,
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      reviewNotes: REVIEW_NOTES,
      checklist: buildCompletedChecklist("peppol_bis_billing")
    });
    const plan = buildSchematronArtifactManifestUpdatePlan({ intake });

    assert.equal(plan.status, "blocked");
    assert.equal(plan.patchObject, null);
    assert.ok(
      plan.blockers.includes(
        "Review intake is not eligible for manual manifest hash recording."
      )
    );
    assert.ok(
      plan.blockers.includes("Expected artifact version is missing or unsafe.")
    );
  });

  it("builds a blocked plan when intake has blockers", () => {
    const manifestRecord = getManifestRecordForLayer("peppol_bis_billing");
    const intake = buildSchematronArtifactReviewIntake({
      layer: "peppol_bis_billing",
      artifactSlotId: manifestRecord.artifactSlotId,
      expectedArtifactVersion: REVIEWED_VERSION,
      expectedSha256: "not-a-sha",
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      reviewNotes: REVIEW_NOTES,
      checklist: buildCompletedChecklist("peppol_bis_billing")
    });
    const plan = buildSchematronArtifactManifestUpdatePlan({ intake });

    assert.equal(intake.blockers.length > 0, true);
    assert.equal(plan.status, "blocked");
    assert.equal(plan.patchObject, null);
    assert.ok(
      plan.blockers.includes("Expected SHA-256 value is missing or unsafe.")
    );
  });

  it("keeps patchObject null unless the plan is ready for manual manifest update", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const blockedPlan = buildSchematronArtifactManifestUpdatePlan({
      intake,
      manifestRecords: []
    });
    const noChangePlan = buildSchematronArtifactManifestUpdatePlan({
      intake,
      manifestRecords: buildAlreadyMatchingManifestRecords("peppol_bis_billing")
    });
    const readyPlan = buildSchematronArtifactManifestUpdatePlan({ intake });

    assert.equal(blockedPlan.status, "blocked");
    assert.equal(blockedPlan.patchObject, null);
    assert.equal(noChangePlan.status, "no_change_needed");
    assert.equal(noChangePlan.patchObject, null);
    assert.equal(readyPlan.status, "ready_for_manual_manifest_update");
    assert.ok(readyPlan.patchObject);
  });

  it("detects deterministic ordered field changes", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const plan = buildSchematronArtifactManifestUpdatePlan({
      intake,
      manifestRecords: buildPartiallyDifferentManifestRecords(
        "peppol_bis_billing"
      )
    });

    assert.deepEqual(
      plan.fieldChanges.map((change) => change.field),
      [
        "expectedArtifactVersion",
        "expectedSha256",
        "reviewStatus",
        "reviewedBy",
        "reviewedAt",
        "reviewNotes"
      ]
    );
    assert.equal(
      plan.fieldChanges.every((change) => change.changed === true),
      true
    );

    const formatted = formatSchematronArtifactManifestUpdateFieldChanges(plan);
    assert.equal(formatted.length, 6);
    assert.equal(
      formatted[0]?.startsWith("expectedArtifactVersion: "),
      true
    );

    const formattedFromArray =
      formatSchematronArtifactManifestUpdateFieldChanges(plan.fieldChanges);
    assert.deepEqual(formattedFromArray, formatted);
  });

  it("does not mutate manifest records or intake results", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const manifestRecords = buildPartiallyDifferentManifestRecords(
      "peppol_bis_billing"
    );
    const intakeBefore = JSON.stringify(intake);
    const manifestBefore = JSON.stringify(manifestRecords);

    buildSchematronArtifactManifestUpdatePlan({
      intake,
      manifestRecords
    });

    assert.equal(JSON.stringify(intake), intakeBefore);
    assert.equal(JSON.stringify(manifestRecords), manifestBefore);
  });

  it("builds manual patch instructions only when the plan is ready", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const readyPlan = buildSchematronArtifactManifestUpdatePlan({ intake });
    const readyInstructions =
      buildSchematronArtifactManifestManualPatchInstructions(readyPlan);

    assert.ok(
      readyInstructions.some((instruction) =>
        instruction.includes(`layer ${intake.layer}`)
      )
    );
    assert.ok(
      readyInstructions.some((instruction) =>
        instruction.includes(`artifactSlotId ${intake.artifactSlotId}`)
      )
    );
    assert.ok(
      readyInstructions.some((instruction) =>
        instruction.includes(REVIEWED_VERSION)
      )
    );
    assert.ok(
      readyInstructions.some((instruction) =>
        instruction.includes(REVIEWED_SHA_256)
      )
    );
    assert.ok(
      readyInstructions.some((instruction) =>
        instruction.includes("Keep artifact execution disabled")
      )
    );
    assert.ok(
      readyInstructions.some((instruction) =>
        instruction.includes("Do not treat hash recording as validation success")
      )
    );
    expectNoForbiddenClaims(readyInstructions);

    const blockedPlan = buildSchematronArtifactManifestUpdatePlan({
      intake,
      manifestRecords: []
    });
    const blockedInstructions =
      buildSchematronArtifactManifestManualPatchInstructions(blockedPlan);

    assert.equal(
      blockedInstructions.some((instruction) =>
        instruction.includes(REVIEWED_SHA_256)
      ),
      false
    );
    assert.ok(
      blockedInstructions.some((instruction) =>
        instruction.includes("Resolve blockers")
      )
    );
  });

  it("builds a compact summary from a plan or input", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const plan = buildSchematronArtifactManifestUpdatePlan({ intake });
    const summaryFromPlan =
      buildSchematronArtifactManifestUpdatePlanSummary(plan);
    const summaryFromInput =
      buildSchematronArtifactManifestUpdatePlanSummary({ intake });

    assert.equal(
      summaryFromPlan.planVersion,
      SCHEMATRON_ARTIFACT_MANIFEST_UPDATE_PLAN_VERSION
    );
    assert.equal(summaryFromPlan.status, "ready_for_manual_manifest_update");
    assert.equal(summaryFromPlan.eligibleForManualManifestUpdate, true);
    assert.equal(summaryFromPlan.eligibleForExecution, false);
    assert.equal(summaryFromPlan.manifestRecordFound, true);
    assert.equal(summaryFromPlan.changedFieldCount, 6);
    assert.equal(summaryFromPlan.writesFiles, false);
    assert.equal(summaryFromPlan.mutatesManifestAutomatically, false);
    assert.equal(summaryFromPlan.remoteFetchingPermitted, false);
    assert.equal(summaryFromPlan.artifactDownloaded, false);
    assert.equal(summaryFromPlan.artifactExecuted, false);
    assert.deepEqual(summaryFromInput, summaryFromPlan);
    expectNoForbiddenClaims(summaryFromPlan);
  });

  it("works for the EN 16931 / TC434-style layer", () => {
    const intake = buildEligibleIntake("en16931_tc434");
    const plan = buildSchematronArtifactManifestUpdatePlan({ intake });

    assert.equal(plan.layer, "en16931_tc434");
    assert.equal(plan.status, "ready_for_manual_manifest_update");
    assert.equal(plan.eligibleForExecution, false);
    assert.ok(plan.patchObject);
    assert.equal(plan.patchObject.layer, "en16931_tc434");
    expectSafetyFlags(plan);
  });

  it("does not change manifest constants automatically", () => {
    const before = listSchematronArtifactManifestRecords();
    const intake = buildEligibleIntake("peppol_bis_billing");

    buildSchematronArtifactManifestUpdatePlan({ intake });

    const after = listSchematronArtifactManifestRecords();

    assert.deepEqual(after, before);
    assert.equal(
      after.every((record) => record.expectedSha256 === null),
      true
    );
  });

  it("keeps all execution and public-behavior safety flags disabled", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const plan = buildSchematronArtifactManifestUpdatePlan({ intake });

    expectSafetyFlags(plan);
    assert.equal(plan.eligibleForExecution, false);
    assert.equal(plan.copyPastePatchSummary.join(" ").includes("execution"), true);
    assert.equal(
      plan.copyPastePatchSummary.join(" ").includes("validation success"),
      true
    );
  });

  it("does not include raw XML, file contents, full absolute paths, or forbidden claims in plan output", () => {
    const intake = buildEligibleIntake("peppol_bis_billing");
    const plan = buildSchematronArtifactManifestUpdatePlan({ intake });
    const serialized = JSON.stringify(plan);

    assert.equal(serialized.includes("<Invoice"), false);
    assert.equal(serialized.includes("<schema"), false);
    assert.equal(serialized.includes("C:\\"), false);
    assert.equal(serialized.includes("D:\\"), false);
    assert.equal(serialized.includes("file://"), false);
    assert.equal(serialized.includes("http://"), false);
    expectNoForbiddenClaims(plan);
  });
});
