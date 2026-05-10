export const SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION =
  "schematron_artifact_source_register_v1";

export type SchematronArtifactLayer =
  | "peppol_bis_billing"
  | "en16931_tc434";

export type SchematronArtifactReviewStatus =
  | "not_configured"
  | "review_pending"
  | "source_metadata_recorded"
  | "locally_configured"
  | "hash_recorded"
  | "reviewed"
  | "deprecated"
  | "blocked";

export type SchematronArtifactSourceKind =
  | "public_standard_artifact_metadata"
  | "public_peppol_artifact_metadata"
  | "internal_metadata_placeholder";

export type SchematronArtifactLegalConfidence =
  | "technical"
  | "standard_based"
  | "educational_simulation";

export type SchematronArtifactSourceRecord = {
  registerVersion: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  layer: SchematronArtifactLayer;
  artifactKind: SchematronArtifactLayer;
  artifactSlotId: string;
  displayName: string;
  sourceKind: SchematronArtifactSourceKind;
  sourceLabels: readonly string[];
  sourceUrls: readonly string[];
  documentationUrls: readonly string[];
  configuredEnvVars: readonly string[];
  artifactVersionEnvVar: string;
  expectedLocalPathEnvVar: string;
  expectedRootEnvVar: string;
  defaultArtifactVersionLabel: string;
  expectedHashAlgorithm: "sha256" | null;
  expectedSha256: string | null;
  reviewStatus: SchematronArtifactReviewStatus;
  legalConfidence: SchematronArtifactLegalConfidence;
  officialValidationClaimed: false;
  certificationClaimed: false;
  complianceGuaranteeClaimed: false;
  authorityAcceptanceClaimed: false;
  remoteFetchingPermitted: false;
  rawFileContentsReturned: false;
  fullAbsolutePathsReturned: false;
};

export type SchematronArtifactProvenanceSafety = {
  rawXmlReturned: false;
  schematronFileContentsReturned: false;
  fullAbsoluteLocalPathsReturned: false;
  remoteFetching: false;
  certificationClaimed: false;
  officialValidationClaimed: false;
  complianceGuaranteeClaimed: false;
  authorityAcceptanceClaimed: false;
};

export type SchematronArtifactProvenance = {
  registerVersion: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  layer: SchematronArtifactLayer;
  artifactSlotId: string;
  displayName: string;
  sourceLabels: readonly string[];
  sourceUrls: readonly string[];
  documentationUrls: readonly string[];
  configuredEnvVars: readonly string[];
  artifactVersion: string | null;
  defaultArtifactVersionLabel: string;
  expectedHashAlgorithm: "sha256" | null;
  expectedSha256: string | null;
  reviewStatus: SchematronArtifactReviewStatus;
  legalConfidence: SchematronArtifactLegalConfidence;
  configured: boolean;
  readable: boolean;
  usable: boolean;
  sha256: string | null;
  safeLabel: string | null;
  basename: string | null;
  relativePathUnderRoot: string | null;
  safety: SchematronArtifactProvenanceSafety;
  disclaimer: string;
};

export type SchematronArtifactProvenanceInput = {
  layer: SchematronArtifactLayer;
  artifactVersion?: string | null;
  configured?: boolean;
  readable?: boolean;
  usable?: boolean;
  sha256?: string | null;
  safeLabel?: string | null;
  basename?: string | null;
  relativePathUnderRoot?: string | null;
  reviewStatus?: SchematronArtifactReviewStatus;
};

export type SchematronArtifactSourceRecordSelectorInput = {
  layer?: unknown;
  layers?: readonly unknown[];
};

export type SchematronArtifactSourceRegisterSummary = {
  registerVersion: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  recordCount: number;
  selectedLayers: readonly SchematronArtifactLayer[];
  artifactSlotIds: readonly string[];
  configuredEnvVars: readonly string[];
  reviewStatuses: readonly SchematronArtifactReviewStatus[];
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

const PROVENANCE_DISCLAIMER =
  "Invoice Lantern Schematron artifact source provenance is technical metadata for an independent, non-official sandbox. It does not run validation, certify Peppol or EN 16931 status, provide legal, tax, or accounting advice, file with an authority, or predict acceptance by an authority.";

const SAFE_ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const SECRET_QUERY_KEY_PATTERN =
  /(?:secret|token|password|credential|signature|api[-_]?key|access[-_]?key|service[-_]?role)/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

const REVIEW_STATUSES = new Set<SchematronArtifactReviewStatus>([
  "not_configured",
  "review_pending",
  "source_metadata_recorded",
  "locally_configured",
  "hash_recorded",
  "reviewed",
  "deprecated",
  "blocked"
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

function hasCredentialLikeText(value: string) {
  return SECRET_QUERY_KEY_PATTERN.test(value);
}

export function sanitizeSchematronArtifactDisplayLabel(
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
    hasCredentialLikeText(sanitized)
  ) {
    return null;
  }

  return sanitized;
}

export function sanitizeSchematronArtifactVersionLabel(
  value: unknown
): string | null {
  const sanitized = sanitizeSchematronArtifactDisplayLabel(value);

  if (!sanitized || sanitized.includes("/")) {
    return null;
  }

  return sanitized.slice(0, 120);
}

function isPrivateNetworkHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("169.254.")
  ) {
    return true;
  }

  const private172Match = normalized.match(/^172\.(\d{1,3})\./);
  const private172Octet = private172Match?.[1]
    ? Number(private172Match[1])
    : Number.NaN;

  return private172Octet >= 16 && private172Octet <= 31;
}

function hasUnsafeUrlPath(url: URL) {
  try {
    return decodeURIComponent(url.pathname)
      .split("/")
      .some((segment) => segment === "..");
  } catch {
    return true;
  }
}

export function sanitizeSchematronArtifactSourceUrl(
  value: unknown
): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const rawValue = value.trim();

  if (rawValue.includes("/../") || /%2e%2e/i.test(rawValue)) {
    return null;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawValue);
  } catch {
    return null;
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    isPrivateNetworkHostname(parsedUrl.hostname) ||
    hasUnsafeUrlPath(parsedUrl)
  ) {
    return null;
  }

  for (const key of parsedUrl.searchParams.keys()) {
    if (SECRET_QUERY_KEY_PATTERN.test(key)) {
      return null;
    }
  }

  return parsedUrl.toString();
}

function sanitizeSourceLabels(labels: readonly string[]) {
  return [
    ...new Set(
      labels
        .map((label) => sanitizeSchematronArtifactDisplayLabel(label))
        .filter((label): label is string => Boolean(label))
    )
  ];
}

function sanitizeUrls(urls: readonly string[]) {
  return [
    ...new Set(
      urls
        .map((url) => sanitizeSchematronArtifactSourceUrl(url))
        .filter((url): url is string => Boolean(url))
    )
  ];
}

function sanitizeConfiguredEnvVars(envVars: readonly string[]) {
  return [
    ...new Set(
      envVars
        .map((envVar) => envVar.trim())
        .filter((envVar) => SAFE_ENV_VAR_PATTERN.test(envVar))
    )
  ];
}

function sanitizeSha256(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return SHA256_PATTERN.test(normalized) ? normalized : null;
}

function normalizeReviewStatus(
  value: SchematronArtifactReviewStatus | undefined
) {
  return value && REVIEW_STATUSES.has(value) ? value : undefined;
}

function buildSafety(): SchematronArtifactProvenanceSafety {
  return {
    rawXmlReturned: false,
    schematronFileContentsReturned: false,
    fullAbsoluteLocalPathsReturned: false,
    remoteFetching: false,
    certificationClaimed: false,
    officialValidationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false
  };
}

function createSourceRecord(
  input: Omit<SchematronArtifactSourceRecord, "registerVersion">
): SchematronArtifactSourceRecord {
  const sourceLabels = sanitizeSourceLabels(input.sourceLabels);
  const sourceUrls = sanitizeUrls(input.sourceUrls);
  const documentationUrls = sanitizeUrls(input.documentationUrls);
  const configuredEnvVars = sanitizeConfiguredEnvVars(input.configuredEnvVars);
  const displayName =
    sanitizeSchematronArtifactDisplayLabel(input.displayName) ??
    "Schematron local artifact slot";
  const defaultArtifactVersionLabel =
    sanitizeSchematronArtifactVersionLabel(input.defaultArtifactVersionLabel) ??
    "not_configured";
  const expectedSha256 = sanitizeSha256(input.expectedSha256);

  return {
    registerVersion: SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
    layer: input.layer,
    artifactKind: input.artifactKind,
    artifactSlotId: input.artifactSlotId,
    displayName,
    sourceKind: input.sourceKind,
    sourceLabels,
    sourceUrls,
    documentationUrls,
    configuredEnvVars,
    artifactVersionEnvVar: input.artifactVersionEnvVar,
    expectedLocalPathEnvVar: input.expectedLocalPathEnvVar,
    expectedRootEnvVar: input.expectedRootEnvVar,
    defaultArtifactVersionLabel,
    expectedHashAlgorithm: expectedSha256 ? "sha256" : null,
    expectedSha256,
    reviewStatus: input.reviewStatus,
    legalConfidence: input.legalConfidence,
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    remoteFetchingPermitted: false,
    rawFileContentsReturned: false,
    fullAbsolutePathsReturned: false
  };
}

const SCHEMATRON_ARTIFACT_SOURCE_RECORDS = [
  createSourceRecord({
    layer: "peppol_bis_billing",
    artifactKind: "peppol_bis_billing",
    artifactSlotId: "schematron_slot_peppol_bis_billing_v1",
    displayName: "Peppol BIS Billing local Schematron artifact slot",
    sourceKind: "public_peppol_artifact_metadata",
    sourceLabels: [
      "Peppol BIS Billing public artifact metadata",
      "Invoice Lantern local artifact slot",
      "technical provenance metadata",
      "non-official technical metadata"
    ],
    sourceUrls: ["https://docs.peppol.eu/poacc/billing/3.0/"],
    documentationUrls: [
      "https://docs.peppol.eu/poacc/billing/3.0/",
      "https://peppol.org/"
    ],
    configuredEnvVars: [
      "PEPPOL_SCHEMATRON_ROOT_DIR",
      "PEPPOL_BIS_SCHEMATRON_PATH",
      "SCHEMATRON_ARTIFACT_VERSION"
    ],
    artifactVersionEnvVar: "SCHEMATRON_ARTIFACT_VERSION",
    expectedLocalPathEnvVar: "PEPPOL_BIS_SCHEMATRON_PATH",
    expectedRootEnvVar: "PEPPOL_SCHEMATRON_ROOT_DIR",
    defaultArtifactVersionLabel: "not_configured",
    expectedHashAlgorithm: null,
    expectedSha256: null,
    reviewStatus: "source_metadata_recorded",
    legalConfidence: "technical",
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    remoteFetchingPermitted: false,
    rawFileContentsReturned: false,
    fullAbsolutePathsReturned: false
  }),
  createSourceRecord({
    layer: "en16931_tc434",
    artifactKind: "en16931_tc434",
    artifactSlotId: "schematron_slot_en16931_tc434_v1",
    displayName: "EN 16931 / TC434 local Schematron artifact slot",
    sourceKind: "public_standard_artifact_metadata",
    sourceLabels: [
      "EN 16931 / TC434 public artifact metadata",
      "Invoice Lantern local artifact slot",
      "technical provenance metadata",
      "non-official technical metadata"
    ],
    sourceUrls: [
      "https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/eInvoicing"
    ],
    documentationUrls: [
      "https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/eInvoicing",
      "https://www.cencenelec.eu/areas-of-work/cen-cenelec-topics/e-invoicing/"
    ],
    configuredEnvVars: [
      "PEPPOL_SCHEMATRON_ROOT_DIR",
      "EN16931_SCHEMATRON_PATH",
      "SCHEMATRON_ARTIFACT_VERSION"
    ],
    artifactVersionEnvVar: "SCHEMATRON_ARTIFACT_VERSION",
    expectedLocalPathEnvVar: "EN16931_SCHEMATRON_PATH",
    expectedRootEnvVar: "PEPPOL_SCHEMATRON_ROOT_DIR",
    defaultArtifactVersionLabel: "not_configured",
    expectedHashAlgorithm: null,
    expectedSha256: null,
    reviewStatus: "source_metadata_recorded",
    legalConfidence: "technical",
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    remoteFetchingPermitted: false,
    rawFileContentsReturned: false,
    fullAbsolutePathsReturned: false
  })
] as const;

const SOURCE_RECORD_BY_LAYER: Record<
  SchematronArtifactLayer,
  SchematronArtifactSourceRecord
> = {
  peppol_bis_billing: SCHEMATRON_ARTIFACT_SOURCE_RECORDS[0],
  en16931_tc434: SCHEMATRON_ARTIFACT_SOURCE_RECORDS[1]
};

function cloneSourceRecord(
  record: SchematronArtifactSourceRecord
): SchematronArtifactSourceRecord {
  return {
    ...record,
    sourceLabels: [...record.sourceLabels],
    sourceUrls: [...record.sourceUrls],
    documentationUrls: [...record.documentationUrls],
    configuredEnvVars: [...record.configuredEnvVars]
  };
}

function normalizeLayer(value: unknown): SchematronArtifactLayer | null {
  if (value === "peppol_bis_billing" || value === "en16931_tc434") {
    return value;
  }

  return null;
}

function getSelectedLayers(
  input: SchematronArtifactSourceRecordSelectorInput | undefined
) {
  if (Array.isArray(input?.layers)) {
    return [
      ...new Set(
        input.layers
          .map((layer) => normalizeLayer(layer))
          .filter((layer): layer is SchematronArtifactLayer => Boolean(layer))
      )
    ];
  }

  const layer = normalizeLayer(input?.layer);

  if (input && "layer" in input) {
    return layer ? [layer] : [];
  }

  return layer ? [layer] : (["peppol_bis_billing", "en16931_tc434"] as const);
}

export function listSchematronArtifactSourceRecords() {
  return SCHEMATRON_ARTIFACT_SOURCE_RECORDS.map((record) =>
    cloneSourceRecord(record)
  );
}

export function getSchematronArtifactSourceRecordForLayer(
  layer: SchematronArtifactLayer
) {
  return cloneSourceRecord(SOURCE_RECORD_BY_LAYER[layer]);
}

export function selectSchematronArtifactSourceRecords(
  input: SchematronArtifactSourceRecordSelectorInput = {}
) {
  return getSelectedLayers(input).map((layer) =>
    getSchematronArtifactSourceRecordForLayer(layer)
  );
}

function deriveReviewStatus(input: {
  record: SchematronArtifactSourceRecord;
  requestedStatus?: SchematronArtifactReviewStatus;
  configured: boolean;
  sha256: string | null;
}) {
  const requestedStatus = normalizeReviewStatus(input.requestedStatus);

  if (requestedStatus) {
    return requestedStatus;
  }

  if (!input.configured) {
    return "not_configured";
  }

  if (input.sha256) {
    return "hash_recorded";
  }

  if (input.record.reviewStatus === "reviewed") {
    return "reviewed";
  }

  return "locally_configured";
}

export function buildSchematronArtifactProvenance(
  input: SchematronArtifactProvenanceInput
): SchematronArtifactProvenance {
  const record = SOURCE_RECORD_BY_LAYER[input.layer];
  const artifactVersion = sanitizeSchematronArtifactVersionLabel(
    input.artifactVersion
  );
  const sha256 = sanitizeSha256(input.sha256);
  const configured = input.configured === true;
  const readable = input.readable === true;
  const usable = input.usable === true;
  const safeLabel = sanitizeSchematronArtifactDisplayLabel(input.safeLabel);
  const safeBasename = sanitizeSchematronArtifactDisplayLabel(input.basename);
  const relativePathUnderRoot = sanitizeSchematronArtifactDisplayLabel(
    input.relativePathUnderRoot
  );

  return {
    registerVersion: SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
    layer: input.layer,
    artifactSlotId: record.artifactSlotId,
    displayName: record.displayName,
    sourceLabels: [...record.sourceLabels],
    sourceUrls: [...record.sourceUrls],
    documentationUrls: [...record.documentationUrls],
    configuredEnvVars: [...record.configuredEnvVars],
    artifactVersion,
    defaultArtifactVersionLabel: record.defaultArtifactVersionLabel,
    expectedHashAlgorithm: record.expectedHashAlgorithm,
    expectedSha256: record.expectedSha256,
    reviewStatus: deriveReviewStatus({
      record,
      ...(input.reviewStatus ? { requestedStatus: input.reviewStatus } : {}),
      configured,
      sha256
    }),
    legalConfidence: record.legalConfidence,
    configured,
    readable,
    usable,
    sha256,
    safeLabel,
    basename: safeBasename,
    relativePathUnderRoot,
    safety: buildSafety(),
    disclaimer: PROVENANCE_DISCLAIMER
  };
}

export function buildSchematronArtifactSourceRegisterSummary(
  input: SchematronArtifactSourceRecordSelectorInput = {}
): SchematronArtifactSourceRegisterSummary {
  const records = selectSchematronArtifactSourceRecords(input);

  return {
    registerVersion: SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
    recordCount: records.length,
    selectedLayers: records.map((record) => record.layer),
    artifactSlotIds: records.map((record) => record.artifactSlotId),
    configuredEnvVars: [
      ...new Set(records.flatMap((record) => record.configuredEnvVars))
    ],
    reviewStatuses: [...new Set(records.map((record) => record.reviewStatus))],
    sourceLabels: [...new Set(records.flatMap((record) => record.sourceLabels))],
    remoteFetchingPermitted: false,
    rawFileContentsReturned: false,
    fullAbsolutePathsReturned: false,
    officialValidationClaimed: false,
    certificationClaimed: false,
    complianceGuaranteeClaimed: false,
    authorityAcceptanceClaimed: false,
    disclaimer: PROVENANCE_DISCLAIMER
  };
}
