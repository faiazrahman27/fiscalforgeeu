import {
  SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
  listSchematronArtifactManifestRecords,
  sanitizeSchematronArtifactExpectedSha256,
  sanitizeSchematronArtifactManifestDisplayLabel,
  sanitizeSchematronArtifactManifestReviewStatus,
  sanitizeSchematronArtifactManifestVersionLabel,
  type SchematronArtifactExpectedManifestRecord,
  type SchematronArtifactManifestLayer,
  type SchematronArtifactManifestReviewStatus
} from "./schematron-artifact-manifest.js";
import {
  SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION,
  sanitizeSchematronArtifactReviewNotes,
  sanitizeSchematronArtifactReviewTimestamp,
  sanitizeSchematronArtifactReviewerLabel,
  type SchematronArtifactReviewIntakeResult
} from "./schematron-artifact-review-intake.js";

export const SCHEMATRON_ARTIFACT_MANIFEST_UPDATE_PLAN_VERSION =
  "schematron_artifact_manifest_update_plan_v1";

export type SchematronArtifactManifestUpdatePlanLayer =
  SchematronArtifactManifestLayer;

export type SchematronArtifactManifestUpdatePlanStatus =
  | "ready_for_manual_manifest_update"
  | "blocked"
  | "not_eligible"
  | "no_change_needed";

export type SchematronArtifactManifestUpdatePlanFieldName =
  | "expectedArtifactVersion"
  | "expectedSha256"
  | "reviewStatus"
  | "reviewedBy"
  | "reviewedAt"
  | "reviewNotes";

export type SchematronArtifactManifestUpdatePlanInput = {
  intake: SchematronArtifactReviewIntakeResult;
  manifestRecords?: readonly SchematronArtifactExpectedManifestRecord[];
};

export type SchematronArtifactManifestUpdatePlanFieldChange = {
  field: SchematronArtifactManifestUpdatePlanFieldName;
  before: string | null;
  after: string | null;
  changed: boolean;
};

export type SchematronArtifactManifestUpdatePatchObject = {
  layer: SchematronArtifactManifestUpdatePlanLayer;
  artifactSlotId: string;
  expectedArtifactVersion: string;
  expectedSha256: string;
  hashAlgorithm: "sha256";
  reviewStatus: "expected_hash_recorded";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
};

export type SchematronArtifactManifestUpdatePlanSafety = {
  rawXmlReturned: false;
  schematronFileContentsReturned: false;
  fullAbsoluteLocalPathsReturned: false;
  remoteFetching: false;
  artifactDownloaded: false;
  artifactExecuted: false;
  manifestMutatedAutomatically: false;
  certificationClaimed: false;
  officialValidationClaimed: false;
  complianceGuaranteeClaimed: false;
  authorityAcceptanceClaimed: false;
};

export type SchematronArtifactManifestUpdatePlan = {
  planVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_UPDATE_PLAN_VERSION;
  layer: SchematronArtifactManifestUpdatePlanLayer;
  artifactSlotId: string;
  manifestVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  intakeVersion: typeof SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION;
  status: SchematronArtifactManifestUpdatePlanStatus;
  eligibleForManualManifestUpdate: boolean;
  eligibleForExecution: false;
  manifestRecordFound: boolean;
  targetManifestRecordDisplayName: string | null;
  fieldChanges: readonly SchematronArtifactManifestUpdatePlanFieldChange[];
  patchObject: SchematronArtifactManifestUpdatePatchObject | null;
  copyPastePatchSummary: readonly string[];
  warnings: readonly string[];
  blockers: readonly string[];
  manualReviewRequired: true;
  writesFiles: false;
  mutatesManifestAutomatically: false;
  remoteFetchingPermitted: false;
  artifactDownloaded: false;
  artifactExecuted: false;
  officialValidationClaimed: false;
  certificationClaimed: false;
  complianceGuaranteeClaimed: false;
  authorityAcceptanceClaimed: false;
  safety: SchematronArtifactManifestUpdatePlanSafety;
  disclaimer: string;
};

export type SchematronArtifactManifestUpdatePlanSummary = {
  planVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_UPDATE_PLAN_VERSION;
  layer: SchematronArtifactManifestUpdatePlanLayer;
  artifactSlotId: string;
  manifestVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  intakeVersion: typeof SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION;
  status: SchematronArtifactManifestUpdatePlanStatus;
  eligibleForManualManifestUpdate: boolean;
  eligibleForExecution: false;
  manifestRecordFound: boolean;
  changedFieldCount: number;
  warningCount: number;
  blockerCount: number;
  warnings: readonly string[];
  blockers: readonly string[];
  manualReviewRequired: true;
  writesFiles: false;
  mutatesManifestAutomatically: false;
  remoteFetchingPermitted: false;
  artifactDownloaded: false;
  artifactExecuted: false;
  officialValidationClaimed: false;
  certificationClaimed: false;
  complianceGuaranteeClaimed: false;
  authorityAcceptanceClaimed: false;
  disclaimer: string;
};

type NormalizedManifestRecordForUpdatePlan = {
  manifestVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  layer: SchematronArtifactManifestUpdatePlanLayer;
  artifactSlotId: string;
  displayName: string;
  expectedArtifactVersion: string | null;
  expectedSha256: string | null;
  reviewStatus: SchematronArtifactManifestReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
};

type SchematronArtifactManifestUpdatePlanOrInput =
  | SchematronArtifactManifestUpdatePlan
  | SchematronArtifactManifestUpdatePlanInput;

type SchematronArtifactManifestUpdateFieldChangesInput =
  | readonly SchematronArtifactManifestUpdatePlanFieldChange[]
  | {
      fieldChanges: readonly SchematronArtifactManifestUpdatePlanFieldChange[];
    };

const UPDATE_PLAN_DISCLAIMER =
  "Invoice Lantern Schematron artifact manifest update plans are internal metadata only. A planned hash recording is not validation success, certification, filing, legal/tax/accounting advice, or a public authority signal. The plan does not write files, mutate the manifest, download artifacts, or enable artifact execution.";

const REVIEW_STILL_REQUIRED_WARNING =
  "Manual review is still required before editing the manifest.";

const HASH_NOT_VALIDATION_SUCCESS_WARNING =
  "Hash recording is not validation success.";

const EXECUTION_REMAINS_DISABLED_WARNING =
  "This dry-run does not enable artifact execution.";

const MANUAL_PATCH_ONLY_WARNING =
  "Manifest edits must be applied manually and reviewed separately.";

function buildSafety(): SchematronArtifactManifestUpdatePlanSafety {
  return {
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
  };
}

function dedupeStrings(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function isFieldChangeArray(
  input: SchematronArtifactManifestUpdateFieldChangesInput
): input is readonly SchematronArtifactManifestUpdatePlanFieldChange[] {
  return Array.isArray(input);
}

function getManifestRecords(input: SchematronArtifactManifestUpdatePlanInput) {
  return input.manifestRecords
    ? [...input.manifestRecords]
    : listSchematronArtifactManifestRecords();
}

function normalizeManifestRecordForUpdatePlan(
  record: SchematronArtifactExpectedManifestRecord
): NormalizedManifestRecordForUpdatePlan {
  return {
    manifestVersion: SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
    layer: record.layer,
    artifactSlotId: record.artifactSlotId,
    displayName:
      sanitizeSchematronArtifactManifestDisplayLabel(record.displayName) ??
      "Schematron local artifact slot",
    expectedArtifactVersion:
      sanitizeSchematronArtifactManifestVersionLabel(
        record.expectedArtifactVersion
      ) ?? null,
    expectedSha256: sanitizeSchematronArtifactExpectedSha256(
      record.expectedSha256
    ),
    reviewStatus:
      sanitizeSchematronArtifactManifestReviewStatus(record.reviewStatus) ??
      "review_pending",
    reviewedBy: sanitizeSchematronArtifactReviewerLabel(record.reviewedBy),
    reviewedAt: sanitizeSchematronArtifactReviewTimestamp(record.reviewedAt),
    reviewNotes: sanitizeSchematronArtifactReviewNotes(record.reviewNotes)
  };
}

function findMatchingManifestRecord(
  input: SchematronArtifactManifestUpdatePlanInput
): NormalizedManifestRecordForUpdatePlan | null {
  const rawRecord = getManifestRecords(input).find(
    (record) =>
      record.layer === input.intake.layer &&
      record.artifactSlotId === input.intake.artifactSlotId
  );

  return rawRecord ? normalizeManifestRecordForUpdatePlan(rawRecord) : null;
}

function buildFieldChange(
  field: SchematronArtifactManifestUpdatePlanFieldName,
  before: string | null,
  after: string | null
): SchematronArtifactManifestUpdatePlanFieldChange {
  return {
    field,
    before,
    after,
    changed: before !== after
  };
}

function buildFieldChanges(input: {
  manifestRecord: NormalizedManifestRecordForUpdatePlan | null;
  expectedArtifactVersion: string | null;
  expectedSha256: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}) {
  return [
    buildFieldChange(
      "expectedArtifactVersion",
      input.manifestRecord?.expectedArtifactVersion ?? null,
      input.expectedArtifactVersion
    ),
    buildFieldChange(
      "expectedSha256",
      input.manifestRecord?.expectedSha256 ?? null,
      input.expectedSha256
    ),
    buildFieldChange(
      "reviewStatus",
      input.manifestRecord?.reviewStatus ?? null,
      "expected_hash_recorded"
    ),
    buildFieldChange(
      "reviewedBy",
      input.manifestRecord?.reviewedBy ?? null,
      input.reviewedBy
    ),
    buildFieldChange(
      "reviewedAt",
      input.manifestRecord?.reviewedAt ?? null,
      input.reviewedAt
    ),
    buildFieldChange(
      "reviewNotes",
      input.manifestRecord?.reviewNotes ?? null,
      input.reviewNotes
    )
  ] as const;
}

function intakeHasUnsafeSafetySignal(
  intake: SchematronArtifactReviewIntakeResult
) {
  return (
    intake.eligibleForExecution !== false ||
    intake.remoteFetchingPermitted !== false ||
    intake.rawFileContentsReturned !== false ||
    intake.fullAbsolutePathsReturned !== false ||
    intake.artifactExecuted !== false ||
    intake.officialValidationClaimed !== false ||
    intake.certificationClaimed !== false ||
    intake.complianceGuaranteeClaimed !== false ||
    intake.authorityAcceptanceClaimed !== false ||
    intake.safety.rawXmlReturned !== false ||
    intake.safety.schematronFileContentsReturned !== false ||
    intake.safety.fullAbsoluteLocalPathsReturned !== false ||
    intake.safety.remoteFetching !== false ||
    intake.safety.artifactDownloaded !== false ||
    intake.safety.artifactExecuted !== false ||
    intake.safety.certificationClaimed !== false ||
    intake.safety.officialValidationClaimed !== false ||
    intake.safety.complianceGuaranteeClaimed !== false ||
    intake.safety.authorityAcceptanceClaimed !== false
  );
}

function buildBlockers(input: {
  intake: SchematronArtifactReviewIntakeResult;
  manifestRecord: NormalizedManifestRecordForUpdatePlan | null;
  expectedArtifactVersion: string | null;
  expectedSha256: string | null;
}) {
  const blockers: string[] = [];

  if (input.intake.intakeVersion !== SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION) {
    blockers.push(
      "Review intake version does not match the supported update-plan input version."
    );
  }

  if (!input.intake.artifactSlotId) {
    blockers.push("Artifact slot ID is missing.");
  }

  if (!input.manifestRecord) {
    blockers.push("Matching manifest record was not found.");
  }

  if (!input.intake.eligibleForManifestHashRecording) {
    blockers.push(
      "Review intake is not eligible for manual manifest hash recording."
    );
  }

  if (!input.expectedArtifactVersion) {
    blockers.push("Expected artifact version is missing or unsafe.");
  }

  if (!input.expectedSha256) {
    blockers.push("Expected SHA-256 value is missing or unsafe.");
  }

  if (input.intake.blockers.length > 0) {
    blockers.push(...input.intake.blockers);
  }

  if (intakeHasUnsafeSafetySignal(input.intake)) {
    blockers.push("Review intake reported an unsafe safety signal.");
  }

  return dedupeStrings(blockers);
}

function buildWarnings(status: SchematronArtifactManifestUpdatePlanStatus) {
  const warnings = [
    REVIEW_STILL_REQUIRED_WARNING,
    HASH_NOT_VALIDATION_SUCCESS_WARNING,
    EXECUTION_REMAINS_DISABLED_WARNING,
    MANUAL_PATCH_ONLY_WARNING
  ];

  if (status === "no_change_needed") {
    warnings.push(
      "The manifest already matches the safe intake values for this plan."
    );
  }

  if (status === "blocked" || status === "not_eligible") {
    warnings.push("No manual patch object was produced.");
  }

  return warnings;
}

function buildPatchObject(input: {
  status: SchematronArtifactManifestUpdatePlanStatus;
  layer: SchematronArtifactManifestUpdatePlanLayer;
  artifactSlotId: string;
  expectedArtifactVersion: string | null;
  expectedSha256: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}): SchematronArtifactManifestUpdatePatchObject | null {
  if (
    input.status !== "ready_for_manual_manifest_update" ||
    !input.expectedArtifactVersion ||
    !input.expectedSha256
  ) {
    return null;
  }

  return {
    layer: input.layer,
    artifactSlotId: input.artifactSlotId,
    expectedArtifactVersion: input.expectedArtifactVersion,
    expectedSha256: input.expectedSha256,
    hashAlgorithm: "sha256",
    reviewStatus: "expected_hash_recorded",
    reviewedBy: input.reviewedBy,
    reviewedAt: input.reviewedAt,
    reviewNotes: input.reviewNotes
  };
}

function buildCopyPastePatchSummary(input: {
  status: SchematronArtifactManifestUpdatePlanStatus;
  layer: SchematronArtifactManifestUpdatePlanLayer;
  artifactSlotId: string;
  expectedArtifactVersion: string | null;
  expectedSha256: string | null;
}) {
  if (
    input.status === "ready_for_manual_manifest_update" &&
    input.expectedArtifactVersion &&
    input.expectedSha256
  ) {
    return [
      `Find the manifest record with layer ${input.layer} and artifactSlotId ${input.artifactSlotId}.`,
      `Update expectedArtifactVersion to ${input.expectedArtifactVersion}.`,
      `Update expectedSha256 to ${input.expectedSha256}.`,
      "Update reviewStatus to expected_hash_recorded.",
      "Keep artifact execution disabled.",
      "Run the required package, API, worker, and root checks after the manual edit.",
      "Do not treat hash recording as validation success."
    ];
  }

  if (input.status === "no_change_needed") {
    return [
      `No manual manifest patch is needed for layer ${input.layer} and artifactSlotId ${input.artifactSlotId}.`,
      "Keep artifact execution disabled.",
      "Do not treat the existing hash record as validation success."
    ];
  }

  return [
    `No manual manifest patch can be prepared for layer ${input.layer} and artifactSlotId ${input.artifactSlotId}.`,
    "Resolve blockers through the review-intake process first.",
    "Keep artifact execution disabled.",
    "Do not treat this dry-run as validation success."
  ];
}

function getPlanStatus(input: {
  blockers: readonly string[];
  fieldChanges: readonly SchematronArtifactManifestUpdatePlanFieldChange[];
}): SchematronArtifactManifestUpdatePlanStatus {
  if (input.blockers.length > 0) {
    return "blocked";
  }

  return input.fieldChanges.some((change) => change.changed)
    ? "ready_for_manual_manifest_update"
    : "no_change_needed";
}

function resolvePlan(
  input: SchematronArtifactManifestUpdatePlanOrInput
): SchematronArtifactManifestUpdatePlan {
  return "planVersion" in input
    ? input
    : buildSchematronArtifactManifestUpdatePlan(input);
}

export function buildSchematronArtifactManifestUpdatePlan(
  input: SchematronArtifactManifestUpdatePlanInput
): SchematronArtifactManifestUpdatePlan {
  const manifestRecord = findMatchingManifestRecord(input);
  const expectedArtifactVersion =
    sanitizeSchematronArtifactManifestVersionLabel(
      input.intake.expectedArtifactVersion
    ) ?? null;
  const expectedSha256 = sanitizeSchematronArtifactExpectedSha256(
    input.intake.expectedSha256
  );
  const reviewedBy = sanitizeSchematronArtifactReviewerLabel(
    input.intake.reviewedBy
  );
  const reviewedAt = sanitizeSchematronArtifactReviewTimestamp(
    input.intake.reviewedAt
  );
  const reviewNotes = sanitizeSchematronArtifactReviewNotes(
    input.intake.reviewNotes
  );
  const fieldChanges = buildFieldChanges({
    manifestRecord,
    expectedArtifactVersion,
    expectedSha256,
    reviewedBy,
    reviewedAt,
    reviewNotes
  });
  const blockers = buildBlockers({
    intake: input.intake,
    manifestRecord,
    expectedArtifactVersion,
    expectedSha256
  });
  const status = getPlanStatus({
    blockers,
    fieldChanges
  });
  const patchObject = buildPatchObject({
    status,
    layer: input.intake.layer,
    artifactSlotId: input.intake.artifactSlotId,
    expectedArtifactVersion,
    expectedSha256,
    reviewedBy,
    reviewedAt,
    reviewNotes
  });

  return {
    planVersion: SCHEMATRON_ARTIFACT_MANIFEST_UPDATE_PLAN_VERSION,
    layer: input.intake.layer,
    artifactSlotId: input.intake.artifactSlotId,
    manifestVersion: SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
    intakeVersion: SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION,
    status,
    eligibleForManualManifestUpdate:
      status === "ready_for_manual_manifest_update",
    eligibleForExecution: false,
    manifestRecordFound: manifestRecord !== null,
    targetManifestRecordDisplayName: manifestRecord?.displayName ?? null,
    fieldChanges,
    patchObject,
    copyPastePatchSummary: buildCopyPastePatchSummary({
      status,
      layer: input.intake.layer,
      artifactSlotId: input.intake.artifactSlotId,
      expectedArtifactVersion,
      expectedSha256
    }),
    warnings: buildWarnings(status),
    blockers,
    manualReviewRequired: true,
    writesFiles: false,
    mutatesManifestAutomatically: false,
    remoteFetchingPermitted: false,
    artifactDownloaded: false,
    artifactExecuted: false,
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    safety: buildSafety(),
    disclaimer: UPDATE_PLAN_DISCLAIMER
  };
}

export function validateSchematronArtifactManifestUpdatePlan(
  input: SchematronArtifactManifestUpdatePlanInput
) {
  return buildSchematronArtifactManifestUpdatePlan(input);
}

export function buildSchematronArtifactManifestUpdatePlanSummary(
  input: SchematronArtifactManifestUpdatePlanOrInput
): SchematronArtifactManifestUpdatePlanSummary {
  const plan = resolvePlan(input);

  return {
    planVersion: plan.planVersion,
    layer: plan.layer,
    artifactSlotId: plan.artifactSlotId,
    manifestVersion: plan.manifestVersion,
    intakeVersion: plan.intakeVersion,
    status: plan.status,
    eligibleForManualManifestUpdate: plan.eligibleForManualManifestUpdate,
    eligibleForExecution: false,
    manifestRecordFound: plan.manifestRecordFound,
    changedFieldCount: plan.fieldChanges.filter((change) => change.changed)
      .length,
    warningCount: plan.warnings.length,
    blockerCount: plan.blockers.length,
    warnings: [...plan.warnings],
    blockers: [...plan.blockers],
    manualReviewRequired: true,
    writesFiles: false,
    mutatesManifestAutomatically: false,
    remoteFetchingPermitted: false,
    artifactDownloaded: false,
    artifactExecuted: false,
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    disclaimer: plan.disclaimer
  };
}

export function formatSchematronArtifactManifestUpdateFieldChanges(
  input: SchematronArtifactManifestUpdateFieldChangesInput
) {
  const fieldChanges = isFieldChangeArray(input)
    ? input
    : input.fieldChanges;

  return fieldChanges.map((change) => {
    const before = change.before ?? "null";
    const after = change.after ?? "null";
    const state = change.changed ? "changed" : "unchanged";

    return `${change.field}: ${before} -> ${after} (${state})`;
  });
}

export function buildSchematronArtifactManifestManualPatchInstructions(
  input: SchematronArtifactManifestUpdatePlanOrInput
) {
  const plan = resolvePlan(input);

  return [...plan.copyPastePatchSummary];
}
