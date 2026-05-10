import {
  SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
  getSchematronArtifactSourceRecordForLayer,
  type SchematronArtifactLayer,
  type SchematronArtifactLegalConfidence
} from "./schematron-artifact-source-register.js";

export const SCHEMATRON_ARTIFACT_MANIFEST_VERSION =
  "schematron_artifact_manifest_v1";

export type SchematronArtifactManifestLayer = SchematronArtifactLayer;

export type SchematronArtifactManifestReviewStatus =
  | "not_configured"
  | "review_pending"
  | "source_metadata_recorded"
  | "expected_hash_missing"
  | "expected_hash_recorded"
  | "local_hash_matched"
  | "local_hash_mismatched"
  | "local_artifact_unreadable"
  | "local_artifact_out_of_root"
  | "local_artifact_missing"
  | "reviewed"
  | "deprecated"
  | "blocked";

export type SchematronArtifactManifestHashStatus =
  | "not_applicable"
  | "expected_hash_missing"
  | "actual_hash_missing"
  | "matched"
  | "mismatched";

export type SchematronArtifactManifestArtifactStatus =
  | "not_configured"
  | "missing"
  | "unreadable"
  | "out_of_root"
  | "available"
  | "error";

export type SchematronArtifactExpectedManifestRecord = {
  manifestVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  layer: SchematronArtifactManifestLayer;
  artifactSlotId: string;
  displayName: string;
  sourceRegisterVersion: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  sourceRecordLayer: SchematronArtifactManifestLayer;
  expectedArtifactVersion: string | null;
  expectedSha256: string | null;
  hashAlgorithm: "sha256";
  expectedRootEnvVar: string;
  expectedPathEnvVar: string;
  artifactVersionEnvVar: string;
  reviewStatus: SchematronArtifactManifestReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  sourceLabels: readonly string[];
  legalConfidence: SchematronArtifactLegalConfidence;
  officialValidationClaimed: false;
  certificationClaimed: false;
  complianceGuaranteeClaimed: false;
  authorityAcceptanceClaimed: false;
  remoteFetchingPermitted: false;
  rawFileContentsReturned: false;
  fullAbsolutePathsReturned: false;
};

export type SchematronArtifactManifestSafety = {
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

export type SchematronArtifactManifestVerification = {
  manifestVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  sourceRegisterVersion: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  layer: SchematronArtifactManifestLayer;
  artifactSlotId: string;
  displayName: string;
  expectedArtifactVersion: string | null;
  actualArtifactVersion: string | null;
  expectedSha256: string | null;
  actualSha256: string | null;
  hashAlgorithm: "sha256";
  hashStatus: SchematronArtifactManifestHashStatus;
  configured: boolean;
  readable: boolean;
  usable: boolean;
  artifactStatus: SchematronArtifactManifestArtifactStatus;
  reviewStatus: SchematronArtifactManifestReviewStatus;
  safeLabel: string | null;
  basename: string | null;
  relativePathUnderRoot: string | null;
  sourceLabels: readonly string[];
  legalConfidence: SchematronArtifactLegalConfidence;
  safety: SchematronArtifactManifestSafety;
  disclaimer: string;
};

export type SchematronArtifactManifestSummary = {
  manifestVersion: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  sourceRegisterVersion: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  recordCount: number;
  selectedLayers: readonly SchematronArtifactManifestLayer[];
  artifactSlotIds: readonly string[];
  configuredEnvVars: readonly string[];
  expectedSha256RecordedCount: number;
  expectedSha256MissingCount: number;
  reviewStatuses: readonly SchematronArtifactManifestReviewStatus[];
  sourceLabels: readonly string[];
  remoteFetchingPermitted: false;
  rawFileContentsReturned: false;
  fullAbsolutePathsReturned: false;
  officialValidationClaimed: false;
  certificationClaimed: false;
  complianceGuaranteeClaimed: false;
  authorityAcceptanceClaimed: false;
  disclaimer: string;
};

export type SchematronArtifactManifestSelectorInput = {
  layer?: unknown;
  layers?: readonly unknown[];
};

export type SchematronArtifactManifestSafeDiagnosticInput = {
  layer?: unknown;
  artifactKind?: unknown;
  artifactVersion?: unknown;
  actualArtifactVersion?: unknown;
  configured?: boolean;
  readable?: boolean;
  usable?: boolean;
  sha256?: unknown;
  actualSha256?: unknown;
  safeLabel?: unknown;
  label?: unknown;
  basename?: unknown;
  relativePathUnderRoot?: unknown;
  status?: unknown;
  artifactStatus?: unknown;
  reviewStatus?: unknown;
  artifactProvenance?: {
    artifactVersion?: unknown;
    configured?: boolean;
    readable?: boolean;
    usable?: boolean;
    sha256?: unknown;
    safeLabel?: unknown;
    basename?: unknown;
    relativePathUnderRoot?: unknown;
    reviewStatus?: unknown;
  } | null;
};

export type SchematronArtifactManifestVerificationInput = {
  layer?: unknown;
  manifestRecord?: SchematronArtifactExpectedManifestRecord;
  diagnostic?: SchematronArtifactManifestSafeDiagnosticInput | null;
};

export type SchematronArtifactsManifestVerificationInput =
  SchematronArtifactManifestSelectorInput & {
    diagnostics?: readonly SchematronArtifactManifestSafeDiagnosticInput[];
    peppolBisArtifact?: SchematronArtifactManifestSafeDiagnosticInput | null;
    en16931Artifact?: SchematronArtifactManifestSafeDiagnosticInput | null;
  };

const MANIFEST_DISCLAIMER =
  "Invoice Lantern Schematron artifact manifest verification is metadata only for an independent, non-official technical sandbox. A hash match only means the inspected local artifact hash equals the recorded expected hash; it is not validation success, certification, filing, legal/tax/accounting advice, or an authority acceptance signal.";

const SAFE_ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const SECRET_TEXT_PATTERN =
  /(?:secret|token|password|credential|signature|api[-_]?key|access[-_]?key|service[-_]?role)/i;

const REVIEW_STATUSES = new Set<SchematronArtifactManifestReviewStatus>([
  "not_configured",
  "review_pending",
  "source_metadata_recorded",
  "expected_hash_missing",
  "expected_hash_recorded",
  "local_hash_matched",
  "local_hash_mismatched",
  "local_artifact_unreadable",
  "local_artifact_out_of_root",
  "local_artifact_missing",
  "reviewed",
  "deprecated",
  "blocked"
]);

const ARTIFACT_STATUSES = new Set<SchematronArtifactManifestArtifactStatus>([
  "not_configured",
  "missing",
  "unreadable",
  "out_of_root",
  "available",
  "error"
]);

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

export function sanitizeSchematronArtifactExpectedSha256(
  value: unknown
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (
    value !== value.trim() ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes(":") ||
    URL_SCHEME_PATTERN.test(value) ||
    SECRET_TEXT_PATTERN.test(value)
  ) {
    return null;
  }

  const normalized = value.toLowerCase();

  return SHA256_PATTERN.test(normalized) ? normalized : null;
}

export function sanitizeSchematronArtifactManifestDisplayLabel(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const sanitized = normalizeWhitespace(value).slice(0, 180);

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

export function sanitizeSchematronArtifactManifestVersionLabel(
  value: unknown
): string | null {
  const sanitized = sanitizeSchematronArtifactManifestDisplayLabel(value);

  if (!sanitized || sanitized.includes("/")) {
    return null;
  }

  return sanitized.slice(0, 120);
}

export function sanitizeSchematronArtifactManifestReviewStatus(
  value: unknown
): SchematronArtifactManifestReviewStatus | null {
  return typeof value === "string" &&
    REVIEW_STATUSES.has(value as SchematronArtifactManifestReviewStatus)
    ? (value as SchematronArtifactManifestReviewStatus)
    : null;
}

function sanitizeBasename(value: unknown) {
  const sanitized = sanitizeSchematronArtifactManifestDisplayLabel(value);

  if (!sanitized || sanitized.includes("/")) {
    return null;
  }

  return sanitized;
}

function sanitizeEnvVar(value: string) {
  const trimmed = value.trim();

  return SAFE_ENV_VAR_PATTERN.test(trimmed) ? trimmed : null;
}

function sanitizeSourceLabels(labels: readonly string[]) {
  return [
    ...new Set(
      labels
        .map((label) => sanitizeSchematronArtifactManifestDisplayLabel(label))
        .filter((label): label is string => Boolean(label))
    )
  ];
}

function normalizeLayer(value: unknown): SchematronArtifactManifestLayer | null {
  if (value === "peppol_bis_billing" || value === "en16931_tc434") {
    return value;
  }

  return null;
}

function getSelectedLayers(input: SchematronArtifactManifestSelectorInput = {}) {
  if (Array.isArray(input.layers)) {
    return [
      ...new Set(
        input.layers
          .map((layer) => normalizeLayer(layer))
          .filter(
            (layer): layer is SchematronArtifactManifestLayer => Boolean(layer)
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

function createManifestRecord(input: {
  layer: SchematronArtifactManifestLayer;
  reviewStatus: SchematronArtifactManifestReviewStatus;
}): SchematronArtifactExpectedManifestRecord {
  const sourceRecord = getSchematronArtifactSourceRecordForLayer(input.layer);
  const displayName =
    sanitizeSchematronArtifactManifestDisplayLabel(sourceRecord.displayName) ??
    "Schematron local artifact slot";
  const expectedRootEnvVar =
    sanitizeEnvVar(sourceRecord.expectedRootEnvVar) ??
    "PEPPOL_SCHEMATRON_ROOT_DIR";
  const expectedPathEnvVar =
    sanitizeEnvVar(sourceRecord.expectedLocalPathEnvVar) ??
    sourceRecord.expectedLocalPathEnvVar;
  const artifactVersionEnvVar =
    sanitizeEnvVar(sourceRecord.artifactVersionEnvVar) ??
    "SCHEMATRON_ARTIFACT_VERSION";

  return {
    manifestVersion: SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
    layer: sourceRecord.layer,
    artifactSlotId: sourceRecord.artifactSlotId,
    displayName,
    sourceRegisterVersion: sourceRecord.registerVersion,
    sourceRecordLayer: sourceRecord.layer,
    expectedArtifactVersion: null,
    expectedSha256: null,
    hashAlgorithm: "sha256",
    expectedRootEnvVar,
    expectedPathEnvVar,
    artifactVersionEnvVar,
    reviewStatus: input.reviewStatus,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    sourceLabels: sanitizeSourceLabels(sourceRecord.sourceLabels),
    legalConfidence: sourceRecord.legalConfidence,
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    remoteFetchingPermitted: false,
    rawFileContentsReturned: false,
    fullAbsolutePathsReturned: false
  };
}

const SCHEMATRON_ARTIFACT_MANIFEST_RECORDS = [
  createManifestRecord({
    layer: "peppol_bis_billing",
    reviewStatus: "expected_hash_missing"
  }),
  createManifestRecord({
    layer: "en16931_tc434",
    reviewStatus: "expected_hash_missing"
  })
] as const;

const MANIFEST_RECORD_BY_LAYER: Record<
  SchematronArtifactManifestLayer,
  SchematronArtifactExpectedManifestRecord
> = {
  peppol_bis_billing: SCHEMATRON_ARTIFACT_MANIFEST_RECORDS[0],
  en16931_tc434: SCHEMATRON_ARTIFACT_MANIFEST_RECORDS[1]
};

function cloneManifestRecord(
  record: SchematronArtifactExpectedManifestRecord
): SchematronArtifactExpectedManifestRecord {
  return {
    ...record,
    sourceLabels: [...record.sourceLabels]
  };
}

function normalizeManifestRecord(
  record: SchematronArtifactExpectedManifestRecord
) {
  return cloneManifestRecord({
    ...record,
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
    reviewedBy:
      sanitizeSchematronArtifactManifestDisplayLabel(record.reviewedBy) ?? null,
    reviewedAt:
      sanitizeSchematronArtifactManifestDisplayLabel(record.reviewedAt) ?? null,
    reviewNotes:
      sanitizeSchematronArtifactManifestDisplayLabel(record.reviewNotes) ?? null,
    sourceLabels: sanitizeSourceLabels(record.sourceLabels),
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    remoteFetchingPermitted: false,
    rawFileContentsReturned: false,
    fullAbsolutePathsReturned: false
  });
}

export function listSchematronArtifactManifestRecords() {
  return SCHEMATRON_ARTIFACT_MANIFEST_RECORDS.map((record) =>
    cloneManifestRecord(record)
  );
}

export function getSchematronArtifactManifestRecordForLayer(
  layer: SchematronArtifactManifestLayer
) {
  return cloneManifestRecord(MANIFEST_RECORD_BY_LAYER[layer]);
}

export function selectSchematronArtifactManifestRecords(
  input: SchematronArtifactManifestSelectorInput = {}
) {
  return getSelectedLayers(input).map((layer) =>
    getSchematronArtifactManifestRecordForLayer(layer)
  );
}

export function buildSchematronArtifactManifestSummary(
  input: SchematronArtifactManifestSelectorInput = {}
): SchematronArtifactManifestSummary {
  const records = selectSchematronArtifactManifestRecords(input);
  const configuredEnvVars = [
    ...new Set(
      records.flatMap((record) => [
        record.expectedRootEnvVar,
        record.expectedPathEnvVar,
        record.artifactVersionEnvVar
      ])
    )
  ];
  const expectedSha256RecordedCount = records.filter((record) =>
    Boolean(record.expectedSha256)
  ).length;

  return {
    manifestVersion: SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
    sourceRegisterVersion: SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
    recordCount: records.length,
    selectedLayers: records.map((record) => record.layer),
    artifactSlotIds: records.map((record) => record.artifactSlotId),
    configuredEnvVars,
    expectedSha256RecordedCount,
    expectedSha256MissingCount: records.length - expectedSha256RecordedCount,
    reviewStatuses: [...new Set(records.map((record) => record.reviewStatus))],
    sourceLabels: [...new Set(records.flatMap((record) => record.sourceLabels))],
    remoteFetchingPermitted: false,
    rawFileContentsReturned: false,
    fullAbsolutePathsReturned: false,
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    disclaimer: MANIFEST_DISCLAIMER
  };
}

function buildSafety(): SchematronArtifactManifestSafety {
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

function getDiagnosticLayer(
  diagnostic: SchematronArtifactManifestSafeDiagnosticInput | null | undefined
) {
  return normalizeLayer(diagnostic?.layer) ?? normalizeLayer(diagnostic?.artifactKind);
}

function getDiagnosticVersion(
  diagnostic: SchematronArtifactManifestSafeDiagnosticInput | null | undefined
) {
  return (
    sanitizeSchematronArtifactManifestVersionLabel(
      diagnostic?.actualArtifactVersion
    ) ??
    sanitizeSchematronArtifactManifestVersionLabel(diagnostic?.artifactVersion) ??
    sanitizeSchematronArtifactManifestVersionLabel(
      diagnostic?.artifactProvenance?.artifactVersion
    )
  );
}

function getDiagnosticSha256(
  diagnostic: SchematronArtifactManifestSafeDiagnosticInput | null | undefined
) {
  return (
    sanitizeSchematronArtifactExpectedSha256(diagnostic?.actualSha256) ??
    sanitizeSchematronArtifactExpectedSha256(diagnostic?.sha256) ??
    sanitizeSchematronArtifactExpectedSha256(
      diagnostic?.artifactProvenance?.sha256
    )
  );
}

function getDiagnosticSafeLabel(
  diagnostic: SchematronArtifactManifestSafeDiagnosticInput | null | undefined
) {
  return (
    sanitizeSchematronArtifactManifestDisplayLabel(diagnostic?.safeLabel) ??
    sanitizeSchematronArtifactManifestDisplayLabel(diagnostic?.label) ??
    sanitizeSchematronArtifactManifestDisplayLabel(
      diagnostic?.artifactProvenance?.safeLabel
    )
  );
}

function getDiagnosticBasename(
  diagnostic: SchematronArtifactManifestSafeDiagnosticInput | null | undefined
) {
  return (
    sanitizeBasename(diagnostic?.basename) ??
    sanitizeBasename(diagnostic?.artifactProvenance?.basename)
  );
}

function getDiagnosticRelativePath(
  diagnostic: SchematronArtifactManifestSafeDiagnosticInput | null | undefined
) {
  return (
    sanitizeSchematronArtifactManifestDisplayLabel(
      diagnostic?.relativePathUnderRoot
    ) ??
    sanitizeSchematronArtifactManifestDisplayLabel(
      diagnostic?.artifactProvenance?.relativePathUnderRoot
    )
  );
}

function getDiagnosticArtifactStatus(
  diagnostic: SchematronArtifactManifestSafeDiagnosticInput | null | undefined,
  configured: boolean,
  readable: boolean
): SchematronArtifactManifestArtifactStatus {
  const rawStatus =
    typeof diagnostic?.artifactStatus === "string"
      ? diagnostic.artifactStatus
      : typeof diagnostic?.status === "string"
        ? diagnostic.status
        : "";

  if (ARTIFACT_STATUSES.has(rawStatus as SchematronArtifactManifestArtifactStatus)) {
    return rawStatus as SchematronArtifactManifestArtifactStatus;
  }

  if (!configured) {
    return "not_configured";
  }

  return readable ? "available" : "error";
}

function getBooleanDiagnosticValue(
  diagnostic: SchematronArtifactManifestSafeDiagnosticInput | null | undefined,
  key: "configured" | "readable" | "usable"
) {
  return diagnostic?.[key] === true || diagnostic?.artifactProvenance?.[key] === true;
}

function getHashStatus(input: {
  configured: boolean;
  expectedSha256: string | null;
  actualSha256: string | null;
}): SchematronArtifactManifestHashStatus {
  if (!input.configured) {
    return "not_applicable";
  }

  if (!input.expectedSha256) {
    return "expected_hash_missing";
  }

  if (!input.actualSha256) {
    return "actual_hash_missing";
  }

  return input.expectedSha256 === input.actualSha256 ? "matched" : "mismatched";
}

function getReviewStatus(input: {
  record: SchematronArtifactExpectedManifestRecord;
  configured: boolean;
  artifactStatus: SchematronArtifactManifestArtifactStatus;
  hashStatus: SchematronArtifactManifestHashStatus;
}) {
  if (
    input.record.reviewStatus === "blocked" ||
    input.record.reviewStatus === "deprecated"
  ) {
    return input.record.reviewStatus;
  }

  if (!input.configured) {
    return "not_configured";
  }

  if (input.artifactStatus === "missing") {
    return "local_artifact_missing";
  }

  if (input.artifactStatus === "unreadable") {
    return "local_artifact_unreadable";
  }

  if (input.artifactStatus === "out_of_root") {
    return "local_artifact_out_of_root";
  }

  if (input.hashStatus === "matched") {
    return "local_hash_matched";
  }

  if (input.hashStatus === "mismatched") {
    return "local_hash_mismatched";
  }

  if (input.hashStatus === "actual_hash_missing") {
    return "expected_hash_recorded";
  }

  if (input.hashStatus === "expected_hash_missing") {
    return "expected_hash_missing";
  }

  return input.record.reviewStatus;
}

function getManifestRecordForVerification(
  input: SchematronArtifactManifestVerificationInput
) {
  if (input.manifestRecord) {
    return normalizeManifestRecord(input.manifestRecord);
  }

  const layer =
    normalizeLayer(input.layer) ?? getDiagnosticLayer(input.diagnostic) ??
    "peppol_bis_billing";

  return getSchematronArtifactManifestRecordForLayer(layer);
}

export function verifySchematronArtifactAgainstManifest(
  input: SchematronArtifactManifestVerificationInput
): SchematronArtifactManifestVerification {
  const record = getManifestRecordForVerification(input);
  const diagnostic = input.diagnostic ?? null;
  const configured = getBooleanDiagnosticValue(diagnostic, "configured");
  const readable = getBooleanDiagnosticValue(diagnostic, "readable");
  const usable = getBooleanDiagnosticValue(diagnostic, "usable");
  const expectedSha256 = sanitizeSchematronArtifactExpectedSha256(
    record.expectedSha256
  );
  const actualSha256 = getDiagnosticSha256(diagnostic);
  const artifactStatus = getDiagnosticArtifactStatus(
    diagnostic,
    configured,
    readable
  );
  const hashStatus = getHashStatus({
    configured,
    expectedSha256,
    actualSha256
  });
  const reviewStatus = getReviewStatus({
    record,
    configured,
    artifactStatus,
    hashStatus
  });

  return {
    manifestVersion: SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
    sourceRegisterVersion: record.sourceRegisterVersion,
    layer: record.layer,
    artifactSlotId: record.artifactSlotId,
    displayName: record.displayName,
    expectedArtifactVersion: record.expectedArtifactVersion,
    actualArtifactVersion: getDiagnosticVersion(diagnostic),
    expectedSha256,
    actualSha256,
    hashAlgorithm: "sha256",
    hashStatus,
    configured,
    readable,
    usable,
    artifactStatus,
    reviewStatus,
    safeLabel: getDiagnosticSafeLabel(diagnostic),
    basename: getDiagnosticBasename(diagnostic),
    relativePathUnderRoot: getDiagnosticRelativePath(diagnostic),
    sourceLabels: [...record.sourceLabels],
    legalConfidence: record.legalConfidence,
    safety: buildSafety(),
    disclaimer: MANIFEST_DISCLAIMER
  };
}

function getDiagnosticsByLayer(
  input: SchematronArtifactsManifestVerificationInput
) {
  const diagnostics = new Map<
    SchematronArtifactManifestLayer,
    SchematronArtifactManifestSafeDiagnosticInput
  >();

  if (input.peppolBisArtifact) {
    diagnostics.set("peppol_bis_billing", input.peppolBisArtifact);
  }

  if (input.en16931Artifact) {
    diagnostics.set("en16931_tc434", input.en16931Artifact);
  }

  for (const diagnostic of input.diagnostics ?? []) {
    const layer = getDiagnosticLayer(diagnostic);

    if (layer) {
      diagnostics.set(layer, diagnostic);
    }
  }

  return diagnostics;
}

export function verifySchematronArtifactsAgainstManifest(
  input: SchematronArtifactsManifestVerificationInput = {}
) {
  const records = selectSchematronArtifactManifestRecords(input);
  const diagnosticsByLayer = getDiagnosticsByLayer(input);

  return records.map((record) =>
    verifySchematronArtifactAgainstManifest({
      manifestRecord: record,
      diagnostic: diagnosticsByLayer.get(record.layer) ?? null
    })
  );
}
