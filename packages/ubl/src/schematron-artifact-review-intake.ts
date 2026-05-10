import {
  SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
  listSchematronArtifactManifestRecords,
  sanitizeSchematronArtifactExpectedSha256,
  sanitizeSchematronArtifactManifestDisplayLabel,
  sanitizeSchematronArtifactManifestVersionLabel,
  type SchematronArtifactExpectedManifestRecord,
  type SchematronArtifactManifestReviewStatus
} from "./schematron-artifact-manifest.js";
import {
  SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
  listSchematronArtifactSourceRecords,
  sanitizeSchematronArtifactDisplayLabel,
  sanitizeSchematronArtifactSourceUrl,
  type SchematronArtifactLayer,
  type SchematronArtifactLegalConfidence,
  type SchematronArtifactReviewStatus,
  type SchematronArtifactSourceKind,
  type SchematronArtifactSourceRecord
} from "./schematron-artifact-source-register.js";

export const SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION =
  "schematron_artifact_review_intake_v1";

export type SchematronArtifactReviewIntakeLayer = SchematronArtifactLayer;

export type SchematronArtifactReviewChecklistItemId =
  | "source_record_selected"
  | "manifest_record_selected"
  | "artifact_version_recorded"
  | "expected_sha256_recorded"
  | "source_url_reviewed"
  | "documentation_url_reviewed"
  | "local_artifact_hash_compared"
  | "no_remote_fetch_confirmed"
  | "no_file_contents_returned_confirmed"
  | "no_full_paths_returned_confirmed"
  | "no_execution_enabled_confirmed"
  | "no_official_claims_confirmed"
  | "professional_review_boundary_confirmed";

export type SchematronArtifactReviewChecklistItem = {
  id: SchematronArtifactReviewChecklistItemId;
  label: string;
  completed: boolean;
  required: boolean;
  blockingIfIncomplete: boolean;
};

export type SchematronArtifactReviewSourceRecordReference = {
  registerVersion: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  layer: SchematronArtifactReviewIntakeLayer;
  artifactKind: SchematronArtifactReviewIntakeLayer;
  artifactSlotId: string;
  displayName: string;
  sourceKind: SchematronArtifactSourceKind;
  sourceLabels: readonly string[];
  sourceUrls: readonly string[];
  documentationUrls: readonly string[];
  reviewStatus: SchematronArtifactReviewStatus;
  legalConfidence: SchematronArtifactLegalConfidence;
};

export type SchematronArtifactReviewManifestRecordReference = {
  manifestVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  layer: SchematronArtifactReviewIntakeLayer;
  artifactSlotId: string;
  displayName: string;
  sourceRecordLayer: SchematronArtifactReviewIntakeLayer;
  expectedArtifactVersion: string | null;
  expectedSha256Recorded: boolean;
  hashAlgorithm: "sha256";
  reviewStatus: SchematronArtifactManifestReviewStatus;
};

export type SchematronArtifactReviewIntakeInput = {
  layer: SchematronArtifactReviewIntakeLayer;
  artifactSlotId: string;
  expectedArtifactVersion?: string | null;
  expectedSha256?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  checklist?: readonly Partial<SchematronArtifactReviewChecklistItem>[];
  sourceRecords?: readonly SchematronArtifactSourceRecord[];
  manifestRecords?: readonly SchematronArtifactExpectedManifestRecord[];
};

export type SchematronArtifactReviewIntakeResult = {
  intakeVersion: typeof SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION;
  layer: SchematronArtifactReviewIntakeLayer;
  artifactSlotId: string;
  sourceRegisterVersion: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  manifestVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  sourceRecord: SchematronArtifactReviewSourceRecordReference | null;
  manifestRecord: SchematronArtifactReviewManifestRecordReference | null;
  expectedArtifactVersion: string | null;
  expectedSha256: string | null;
  hashAlgorithm: "sha256";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  checklist: readonly SchematronArtifactReviewChecklistItem[];
  completedRequiredCount: number;
  requiredCount: number;
  blockingIncompleteCount: number;
  warnings: readonly string[];
  blockers: readonly string[];
  eligibleForManifestHashRecording: boolean;
  eligibleForExecution: false;
  officialValidationClaimed: false;
  certificationClaimed: false;
  complianceGuaranteeClaimed: false;
  authorityAcceptanceClaimed: false;
  remoteFetchingPermitted: false;
  rawFileContentsReturned: false;
  fullAbsolutePathsReturned: false;
  artifactExecuted: false;
  safety: {
    rawXmlReturned: false;
    schematronFileContentsReturned: false;
    fullAbsoluteLocalPathsReturned: false;
    remoteFetching: false;
    artifactDownloaded: false;
    artifactExecuted: false;
    certificationClaimed: false;
    officialValidationClaimed: false;
    complianceGuaranteeClaimed: false;
    authorityAcceptanceClaimed: false;
  };
  disclaimer: string;
};

export type SchematronArtifactReviewIntakeSummary = {
  intakeVersion: typeof SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION;
  layer: SchematronArtifactReviewIntakeLayer;
  artifactSlotId: string;
  sourceRegisterVersion: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  manifestVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  expectedArtifactVersionRecorded: boolean;
  expectedSha256Recorded: boolean;
  completedRequiredCount: number;
  requiredCount: number;
  blockingIncompleteCount: number;
  warningCount: number;
  blockerCount: number;
  warnings: readonly string[];
  blockers: readonly string[];
  eligibleForManifestHashRecording: boolean;
  eligibleForExecution: false;
  remoteFetchingPermitted: false;
  rawFileContentsReturned: false;
  fullAbsolutePathsReturned: false;
  artifactExecuted: false;
  disclaimer: string;
};

export type SchematronArtifactManifestHashRecordingSuggestion = {
  layer: SchematronArtifactReviewIntakeLayer;
  artifactSlotId: string;
  hashAlgorithm: "sha256";
  eligibleForManualManifestUpdate: boolean;
  warning: string;
  expectedArtifactVersion?: string;
  expectedSha256?: string;
};

type SchematronArtifactReviewChecklistTemplateSelectorInput = {
  layer?: unknown;
  layers?: readonly unknown[];
};

const REVIEW_INTAKE_DISCLAIMER =
  "Invoice Lantern Schematron artifact review intake is metadata only for an independent, non-official technical sandbox. A recorded expected hash only means the hash value passed internal intake checks; it is not validation success, certification, filing, legal/tax/accounting advice, or an authority acceptance signal.";

const MANUAL_SUGGESTION_WARNING =
  "Manual manifest update still requires separate professional review; this suggestion is process metadata and does not indicate validation success.";

const ISO_LIKE_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const SECRET_TEXT_PATTERN =
  /(?:secret|token|password|credential|signature|api[-_]?key|access[-_]?key|service[-_]?role)/i;
const SAFE_SLOT_ID_PATTERN = /^[a-z0-9][a-z0-9_]{2,119}$/;

const CHECKLIST_TEMPLATE_ITEMS = [
  {
    id: "source_record_selected",
    label: "Source register record selected",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "manifest_record_selected",
    label: "Manifest record selected",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "artifact_version_recorded",
    label: "Artifact version label recorded",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "expected_sha256_recorded",
    label: "Expected SHA-256 value recorded",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "source_url_reviewed",
    label: "Source URL metadata reviewed",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "documentation_url_reviewed",
    label: "Documentation URL metadata reviewed",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "local_artifact_hash_compared",
    label: "Local artifact hash comparison completed",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "no_remote_fetch_confirmed",
    label: "Remote fetching remains disabled",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "no_file_contents_returned_confirmed",
    label: "File contents are not returned by the process",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "no_full_paths_returned_confirmed",
    label: "Full local paths are not returned",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "no_execution_enabled_confirmed",
    label: "Artifact execution remains disabled",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "no_official_claims_confirmed",
    label: "No authority, certification, filing, or guarantee claim is made",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  },
  {
    id: "professional_review_boundary_confirmed",
    label: "Professional review boundary remains documented",
    completed: false,
    required: true,
    blockingIfIncomplete: true
  }
] as const satisfies readonly SchematronArtifactReviewChecklistItem[];

const CHECKLIST_ITEM_IDS = new Set<SchematronArtifactReviewChecklistItemId>(
  CHECKLIST_TEMPLATE_ITEMS.map((item) => item.id)
);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasPathTraversal(value: string) {
  return value.split(/[\\/]+/).some((segment) => segment === "..");
}

function hasUnsafeLocalPathShape(value: string) {
  return (
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(value) ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    value.startsWith("~") ||
    value.toLowerCase().startsWith("file:") ||
    value.includes("\\") ||
    hasPathTraversal(value)
  );
}

function normalizeLayer(value: unknown): SchematronArtifactReviewIntakeLayer | null {
  if (value === "peppol_bis_billing" || value === "en16931_tc434") {
    return value;
  }

  return null;
}

function requireLayer(value: unknown): SchematronArtifactReviewIntakeLayer {
  const layer = normalizeLayer(value);

  if (!layer) {
    throw new RangeError("Unsupported Schematron artifact review intake layer.");
  }

  return layer;
}

function getSelectedLayers(
  input: SchematronArtifactReviewChecklistTemplateSelectorInput = {}
) {
  if (Array.isArray(input.layers)) {
    return [
      ...new Set(
        input.layers
          .map((layer) => normalizeLayer(layer))
          .filter(
            (layer): layer is SchematronArtifactReviewIntakeLayer =>
              Boolean(layer)
          )
      )
    ];
  }

  if ("layer" in input) {
    const layer = normalizeLayer(input.layer);

    return layer ? [layer] : [];
  }

  return ["peppol_bis_billing", "en16931_tc434"] as const;
}

function cloneChecklistItem(
  item: SchematronArtifactReviewChecklistItem
): SchematronArtifactReviewChecklistItem {
  return {
    ...item
  };
}

function normalizeChecklistItemId(
  value: unknown
): SchematronArtifactReviewChecklistItemId | null {
  return typeof value === "string" &&
    CHECKLIST_ITEM_IDS.has(value as SchematronArtifactReviewChecklistItemId)
    ? (value as SchematronArtifactReviewChecklistItemId)
    : null;
}

function sanitizeArtifactSlotId(value: unknown) {
  if (typeof value !== "string" || value !== value.trim()) {
    return null;
  }

  const normalized = value.trim();

  if (
    !SAFE_SLOT_ID_PATTERN.test(normalized) ||
    URL_SCHEME_PATTERN.test(normalized) ||
    hasUnsafeLocalPathShape(normalized) ||
    SECRET_TEXT_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function sanitizeReviewText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || value !== value.trim()) {
    return null;
  }

  const sanitized = normalizeWhitespace(value).slice(0, maxLength);

  if (
    !sanitized ||
    sanitized.includes("<") ||
    sanitized.includes(">") ||
    sanitized.includes("\u0000") ||
    URL_SCHEME_PATTERN.test(sanitized) ||
    sanitized.startsWith("//") ||
    hasUnsafeLocalPathShape(sanitized) ||
    SECRET_TEXT_PATTERN.test(sanitized)
  ) {
    return null;
  }

  return sanitized;
}

function getSourceRecords(input: SchematronArtifactReviewIntakeInput) {
  return input.sourceRecords
    ? [...input.sourceRecords]
    : listSchematronArtifactSourceRecords();
}

function getManifestRecords(input: SchematronArtifactReviewIntakeInput) {
  return input.manifestRecords
    ? [...input.manifestRecords]
    : listSchematronArtifactManifestRecords();
}

function getSourceRecordReference(
  record: SchematronArtifactSourceRecord | undefined
): SchematronArtifactReviewSourceRecordReference | null {
  if (!record) {
    return null;
  }

  return {
    registerVersion: SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
    layer: record.layer,
    artifactKind: record.artifactKind,
    artifactSlotId: sanitizeArtifactSlotId(record.artifactSlotId) ?? "",
    displayName:
      sanitizeSchematronArtifactDisplayLabel(record.displayName) ??
      "Schematron local artifact slot",
    sourceKind: record.sourceKind,
    sourceLabels: record.sourceLabels
      .map((label) => sanitizeSchematronArtifactDisplayLabel(label))
      .filter((label): label is string => Boolean(label)),
    sourceUrls: record.sourceUrls
      .map((url) => sanitizeSchematronArtifactSourceUrl(url))
      .filter((url): url is string => Boolean(url)),
    documentationUrls: record.documentationUrls
      .map((url) => sanitizeSchematronArtifactSourceUrl(url))
      .filter((url): url is string => Boolean(url)),
    reviewStatus: record.reviewStatus,
    legalConfidence: record.legalConfidence
  };
}

function getManifestRecordReference(
  record: SchematronArtifactExpectedManifestRecord | undefined
): SchematronArtifactReviewManifestRecordReference | null {
  if (!record) {
    return null;
  }

  return {
    manifestVersion: SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
    layer: record.layer,
    artifactSlotId: sanitizeArtifactSlotId(record.artifactSlotId) ?? "",
    displayName:
      sanitizeSchematronArtifactManifestDisplayLabel(record.displayName) ??
      "Schematron local artifact slot",
    sourceRecordLayer: record.sourceRecordLayer,
    expectedArtifactVersion:
      sanitizeSchematronArtifactManifestVersionLabel(
        record.expectedArtifactVersion
      ) ?? null,
    expectedSha256Recorded:
      sanitizeSchematronArtifactExpectedSha256(record.expectedSha256) !== null,
    hashAlgorithm: "sha256",
    reviewStatus: record.reviewStatus
  };
}

function buildSafety(): SchematronArtifactReviewIntakeResult["safety"] {
  return {
    rawXmlReturned: false,
    schematronFileContentsReturned: false,
    fullAbsoluteLocalPathsReturned: false,
    remoteFetching: false,
    artifactDownloaded: false,
    artifactExecuted: false,
    certificationClaimed: false,
    officialValidationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false
  };
}

function getIncompleteBlockingItems(
  checklist: readonly SchematronArtifactReviewChecklistItem[]
) {
  return checklist.filter(
    (item) => item.blockingIfIncomplete && !item.completed
  );
}

function buildChecklistWarnings(
  input: SchematronArtifactReviewIntakeInput
) {
  const unknownItemCount = (input.checklist ?? []).filter(
    (item) => !normalizeChecklistItemId(item.id)
  ).length;

  return unknownItemCount > 0
    ? ["Unknown checklist item IDs were ignored."]
    : [];
}

function buildMetadataWarnings(input: {
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  rawReviewedBy: unknown;
  rawReviewedAt: unknown;
  rawReviewNotes: unknown;
}) {
  const warnings: string[] = [];

  if (input.rawReviewedBy !== null && input.rawReviewedBy !== undefined && !input.reviewedBy) {
    warnings.push("Reviewer label was omitted because it did not pass safe label checks.");
  } else if (!input.reviewedBy) {
    warnings.push("Reviewer label is not recorded.");
  }

  if (input.rawReviewedAt !== null && input.rawReviewedAt !== undefined && !input.reviewedAt) {
    warnings.push("Review timestamp was omitted because it did not pass safe timestamp checks.");
  } else if (!input.reviewedAt) {
    warnings.push("Review timestamp is not recorded.");
  }

  if (
    input.rawReviewNotes !== null &&
    input.rawReviewNotes !== undefined &&
    !input.reviewNotes
  ) {
    warnings.push("Review notes were omitted because they did not pass safe text checks.");
  }

  return warnings;
}

function buildBlockers(input: {
  artifactSlotId: string;
  expectedArtifactVersion: string | null;
  expectedSha256: string | null;
  rawExpectedArtifactVersion: unknown;
  rawExpectedSha256: unknown;
  checklist: readonly SchematronArtifactReviewChecklistItem[];
  sourceRecord: SchematronArtifactReviewSourceRecordReference | null;
  manifestRecord: SchematronArtifactReviewManifestRecordReference | null;
}) {
  const blockers: string[] = [];

  if (!input.artifactSlotId) {
    blockers.push("Artifact slot ID is missing or unsafe.");
  }

  if (!input.sourceRecord) {
    blockers.push("No source register record exists for the selected layer.");
  }

  if (!input.manifestRecord) {
    blockers.push("No manifest record exists for the selected layer.");
  }

  if (input.sourceRecord && input.sourceRecord.artifactSlotId !== input.artifactSlotId) {
    blockers.push("Artifact slot ID does not match the source register record.");
  }

  if (
    input.manifestRecord &&
    input.manifestRecord.artifactSlotId !== input.artifactSlotId
  ) {
    blockers.push("Artifact slot ID does not match the manifest record.");
  }

  if (
    input.sourceRecord &&
    input.manifestRecord &&
    input.sourceRecord.artifactSlotId !== input.manifestRecord.artifactSlotId
  ) {
    blockers.push("Source register and manifest records do not reference the same artifact slot.");
  }

  if (input.sourceRecord && input.sourceRecord.sourceUrls.length === 0) {
    blockers.push("Source URL metadata is missing for the selected source record.");
  }

  if (input.sourceRecord && input.sourceRecord.documentationUrls.length === 0) {
    blockers.push("Documentation URL metadata is missing for the selected source record.");
  }

  if (!input.expectedArtifactVersion) {
    blockers.push(
      input.rawExpectedArtifactVersion === null ||
        input.rawExpectedArtifactVersion === undefined
        ? "Expected artifact version label is missing."
        : "Expected artifact version label is unsafe or invalid."
    );
  }

  if (!input.expectedSha256) {
    blockers.push(
      input.rawExpectedSha256 === null || input.rawExpectedSha256 === undefined
        ? "Expected SHA-256 value is missing."
        : "Expected SHA-256 value is unsafe or invalid."
    );
  }

  for (const item of input.checklist) {
    if (item.required && !item.completed) {
      blockers.push(`Required checklist item is incomplete: ${item.id}.`);
    }
  }

  for (const item of getIncompleteBlockingItems(input.checklist)) {
    if (!item.required) {
      blockers.push(`Blocking checklist item is incomplete: ${item.id}.`);
    }
  }

  return blockers;
}

export function sanitizeSchematronArtifactReviewerLabel(
  value: unknown
): string | null {
  return sanitizeReviewText(value, 120);
}

export function sanitizeSchematronArtifactReviewNotes(
  value: unknown
): string | null {
  return sanitizeReviewText(value, 500);
}

export function sanitizeSchematronArtifactReviewTimestamp(
  value: unknown
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || value !== value.trim() || value.length > 40) {
    return null;
  }

  if (!ISO_LIKE_TIMESTAMP_PATTERN.test(value)) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? value : null;
}

export function sanitizeSchematronArtifactReviewExpectedSha256(
  value: unknown
): string | null {
  return sanitizeSchematronArtifactExpectedSha256(value);
}

export function listSchematronArtifactReviewChecklistTemplateItems(
  input: SchematronArtifactReviewChecklistTemplateSelectorInput = {}
) {
  return getSelectedLayers(input).length > 0
    ? CHECKLIST_TEMPLATE_ITEMS.map((item) => cloneChecklistItem(item))
    : [];
}

export function buildSchematronArtifactReviewChecklist(
  input: {
    layer?: unknown;
    layers?: readonly unknown[];
    checklist?: readonly Partial<SchematronArtifactReviewChecklistItem>[];
  } = {}
) {
  const completedById = new Map<
    SchematronArtifactReviewChecklistItemId,
    boolean
  >();

  for (const item of input.checklist ?? []) {
    const itemId = normalizeChecklistItemId(item.id);

    if (itemId && typeof item.completed === "boolean") {
      completedById.set(itemId, item.completed);
    }
  }

  return listSchematronArtifactReviewChecklistTemplateItems(input).map(
    (item) => ({
      ...item,
      completed: completedById.get(item.id) ?? item.completed
    })
  );
}

export function buildSchematronArtifactReviewIntake(
  input: SchematronArtifactReviewIntakeInput
): SchematronArtifactReviewIntakeResult {
  const layer = requireLayer(input.layer);
  const artifactSlotId = sanitizeArtifactSlotId(input.artifactSlotId) ?? "";
  const expectedArtifactVersion =
    sanitizeSchematronArtifactManifestVersionLabel(
      input.expectedArtifactVersion
    ) ?? null;
  const expectedSha256 = sanitizeSchematronArtifactReviewExpectedSha256(
    input.expectedSha256
  );
  const reviewedBy = sanitizeSchematronArtifactReviewerLabel(input.reviewedBy);
  const reviewedAt = sanitizeSchematronArtifactReviewTimestamp(input.reviewedAt);
  const reviewNotes = sanitizeSchematronArtifactReviewNotes(input.reviewNotes);
  const checklist = buildSchematronArtifactReviewChecklist({
    layer,
    ...(input.checklist ? { checklist: input.checklist } : {})
  });
  const sourceRecord = getSourceRecordReference(
    getSourceRecords(input).find((record) => record.layer === layer)
  );
  const manifestRecord = getManifestRecordReference(
    getManifestRecords(input).find((record) => record.layer === layer)
  );
  const requiredItems = checklist.filter((item) => item.required);
  const completedRequiredCount = requiredItems.filter(
    (item) => item.completed
  ).length;
  const blockingIncompleteCount = getIncompleteBlockingItems(checklist).length;
  const warnings = [
    ...buildChecklistWarnings(input),
    ...buildMetadataWarnings({
      reviewedBy,
      reviewedAt,
      reviewNotes,
      rawReviewedBy: input.reviewedBy,
      rawReviewedAt: input.reviewedAt,
      rawReviewNotes: input.reviewNotes
    })
  ];
  const blockers = buildBlockers({
    artifactSlotId,
    expectedArtifactVersion,
    expectedSha256,
    rawExpectedArtifactVersion: input.expectedArtifactVersion,
    rawExpectedSha256: input.expectedSha256,
    checklist,
    sourceRecord,
    manifestRecord
  });
  const eligibleForManifestHashRecording =
    blockers.length === 0 &&
    expectedArtifactVersion !== null &&
    expectedSha256 !== null &&
    completedRequiredCount === requiredItems.length &&
    blockingIncompleteCount === 0;

  return {
    intakeVersion: SCHEMATRON_ARTIFACT_REVIEW_INTAKE_VERSION,
    layer,
    artifactSlotId,
    sourceRegisterVersion: SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
    manifestVersion: SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
    sourceRecord,
    manifestRecord,
    expectedArtifactVersion,
    expectedSha256,
    hashAlgorithm: "sha256",
    reviewedBy,
    reviewedAt,
    reviewNotes,
    checklist,
    completedRequiredCount,
    requiredCount: requiredItems.length,
    blockingIncompleteCount,
    warnings,
    blockers,
    eligibleForManifestHashRecording,
    eligibleForExecution: false,
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    remoteFetchingPermitted: false,
    rawFileContentsReturned: false,
    fullAbsolutePathsReturned: false,
    artifactExecuted: false,
    safety: buildSafety(),
    disclaimer: REVIEW_INTAKE_DISCLAIMER
  };
}

export function validateSchematronArtifactReviewIntake(
  input: SchematronArtifactReviewIntakeInput
) {
  return buildSchematronArtifactReviewIntake(input);
}

export function buildSchematronArtifactReviewIntakeSummary(
  input: SchematronArtifactReviewIntakeInput
): SchematronArtifactReviewIntakeSummary {
  const intake = buildSchematronArtifactReviewIntake(input);

  return {
    intakeVersion: intake.intakeVersion,
    layer: intake.layer,
    artifactSlotId: intake.artifactSlotId,
    sourceRegisterVersion: intake.sourceRegisterVersion,
    manifestVersion: intake.manifestVersion,
    expectedArtifactVersionRecorded: intake.expectedArtifactVersion !== null,
    expectedSha256Recorded: intake.expectedSha256 !== null,
    completedRequiredCount: intake.completedRequiredCount,
    requiredCount: intake.requiredCount,
    blockingIncompleteCount: intake.blockingIncompleteCount,
    warningCount: intake.warnings.length,
    blockerCount: intake.blockers.length,
    warnings: [...intake.warnings],
    blockers: [...intake.blockers],
    eligibleForManifestHashRecording:
      intake.eligibleForManifestHashRecording,
    eligibleForExecution: false,
    remoteFetchingPermitted: false,
    rawFileContentsReturned: false,
    fullAbsolutePathsReturned: false,
    artifactExecuted: false,
    disclaimer: intake.disclaimer
  };
}

export function buildSchematronArtifactManifestHashRecordingSuggestion(
  input: SchematronArtifactReviewIntakeInput
): SchematronArtifactManifestHashRecordingSuggestion {
  const intake = buildSchematronArtifactReviewIntake(input);
  const eligibleForManualManifestUpdate =
    intake.eligibleForManifestHashRecording &&
    intake.expectedArtifactVersion !== null &&
    intake.expectedSha256 !== null;

  return {
    layer: intake.layer,
    artifactSlotId: intake.artifactSlotId,
    hashAlgorithm: "sha256",
    eligibleForManualManifestUpdate,
    warning: MANUAL_SUGGESTION_WARNING,
    ...(eligibleForManualManifestUpdate && intake.expectedArtifactVersion
      ? { expectedArtifactVersion: intake.expectedArtifactVersion }
      : {}),
    ...(eligibleForManualManifestUpdate && intake.expectedSha256
      ? { expectedSha256: intake.expectedSha256 }
      : {})
  };
}
