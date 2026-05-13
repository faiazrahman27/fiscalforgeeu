import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
  buildSchematronArtifactProvenance,
  buildSchematronArtifactSourceRegisterSummary,
  type SchematronArtifactLegalConfidence,
  type SchematronArtifactProvenance,
  type SchematronArtifactReviewStatus,
  type SchematronArtifactSourceRegisterSummary
} from "./schematron-artifact-source-register.js";
import {
  SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
  buildSchematronArtifactManifestSummary,
  verifySchematronArtifactAgainstManifest,
  type SchematronArtifactManifestHashStatus,
  type SchematronArtifactManifestReviewStatus,
  type SchematronArtifactManifestSummary,
  type SchematronArtifactManifestVerification
} from "./schematron-artifact-manifest.js";

export const UBL_XSD_VALIDATOR_NAME = "xmllint-wasm";
export const SCHEMATRON_VALIDATOR_NAME = "schematron-placeholder";

const MAX_SCHEMA_DEPENDENCY_FILES = 500;
const SCHEMA_LOCATION_ATTRIBUTE_PATTERN =
  /\bschemaLocation\s*=\s*(["'])([^"']+)\1/gi;

export type UblXsdArtifactConfigInput = {
  rootDir?: string;
  invoiceXsdPath?: string;
  creditNoteXsdPath?: string;
  artifactVersion?: string;
};

export type UblXsdArtifactEnv = {
  UBL_XSD_ROOT_DIR?: string;
  UBL_INVOICE_XSD_PATH?: string;
  UBL_CREDIT_NOTE_XSD_PATH?: string;
  UBL_XSD_ARTIFACT_VERSION?: string;
};

export type SchematronArtifactConfigInput = {
  rootDir?: string;
  peppolBisSchematronPath?: string;
  en16931SchematronPath?: string;
  artifactVersion?: string;
};

export type SchematronArtifactEnv = {
  PEPPOL_SCHEMATRON_ROOT_DIR?: string;
  PEPPOL_BIS_SCHEMATRON_PATH?: string;
  EN16931_SCHEMATRON_PATH?: string;
  SCHEMATRON_ARTIFACT_VERSION?: string;
};

export type ResolvedUblXsdArtifactConfig = {
  rootPath?: string;
  invoiceXsdPath?: string;
  creditNoteXsdPath?: string;
  artifactVersion?: string;
};

export type ResolvedSchematronArtifactConfig = {
  rootPath?: string;
  peppolBisSchematronPath?: string;
  en16931SchematronPath?: string;
  artifactVersion?: string;
};

export type UblXsdSelectedDocumentType =
  | "invoice"
  | "credit_note"
  | "unknown";

export type UblXsdSchemaArtifactStatus =
  | "available"
  | "missing"
  | "unreadable"
  | "out_of_root"
  | "not_configured";

export type SchematronArtifactStatus =
  | "available"
  | "missing"
  | "unreadable"
  | "out_of_root"
  | "not_configured";

export type UblXsdDependencyGraphStatus =
  | "not_inspected"
  | "ready"
  | "missing_dependency"
  | "unreadable_dependency"
  | "external_reference_blocked"
  | "error";

export type SchematronArtifactKind = "peppol_bis_billing" | "en16931_tc434";

export type UblXsdSchemaArtifactInfo = {
  configured: boolean;
  readable: boolean;
  usable: boolean;
  path: string | null;
  sha256: string | null;
  status: UblXsdSchemaArtifactStatus;
  reason?: string;
};

export type SchematronArtifactFileInfo = {
  artifactKind: SchematronArtifactKind;
  configured: boolean;
  readable: boolean;
  usable: boolean;
  path: string | null;
  sha256: string | null;
  status: SchematronArtifactStatus;
  reason?: string;
};

export type UblXsdDependencyGraphInfo = {
  inspected: boolean;
  dependencyCount: number;
  status: UblXsdDependencyGraphStatus;
  schemaResolutionRoot: string | null;
  reason?: string;
};

export type SchematronArtifactRegistryInfo = {
  configured: boolean;
  usable: boolean;
  rootPath: string | null;
  peppolBisSchematronPath: string | null;
  en16931SchematronPath: string | null;
  artifactVersion: string | null;
  validatorName: string;
  validatorAvailable: boolean;
  peppolBisArtifact: SchematronArtifactFileInfo;
  en16931Artifact: SchematronArtifactFileInfo;
  checkedAt: string;
};

export type UblXsdArtifactInfo = {
  configured: boolean;
  usable: boolean;
  rootPath: string | null;
  invoiceXsdPath: string | null;
  creditNoteXsdPath: string | null;
  artifactVersion: string | null;
  validatorName: string;
  validatorAvailable: boolean;
  invoiceSchema: UblXsdSchemaArtifactInfo;
  creditNoteSchema: UblXsdSchemaArtifactInfo;
  dependencyGraph: UblXsdDependencyGraphInfo;
  checkedAt: string;
};

export type UblXsdArtifactInspection = {
  resolvedConfig: ResolvedUblXsdArtifactConfig;
  artifactInfo: UblXsdArtifactInfo;
  invoiceSchema: UblXsdSchemaArtifactInfo;
  creditNoteSchema: UblXsdSchemaArtifactInfo;
};

export type SchematronArtifactInspection = {
  resolvedConfig: ResolvedSchematronArtifactConfig;
  artifactInfo: SchematronArtifactRegistryInfo;
  peppolBisArtifact: SchematronArtifactFileInfo;
  en16931Artifact: SchematronArtifactFileInfo;
};

export const UBL_XSD_ARTIFACT_DIAGNOSTICS_DISCLAIMER =
  "These are technical configuration diagnostics for local UBL XSD artefacts in Invoice Lantern. They are not official validation, Peppol certification, EN 16931 certification, legal, tax, or accounting advice, official filing, or a compliance guarantee.";

export const SCHEMATRON_ARTIFACT_DIAGNOSTICS_DISCLAIMER =
  "These are technical configuration diagnostics for local Schematron artefacts in Invoice Lantern. They do not execute Schematron validation and are not official validation, Peppol certification, EN 16931 certification, legal, tax, or accounting advice, official filing, or a compliance guarantee.";

export type UblXsdSafeSchemaArtifactDiagnostics = {
  configured: boolean;
  status: UblXsdSchemaArtifactStatus;
  readable: boolean;
  usable: boolean;
  sha256: string | null;
  label: string | null;
  basename: string | null;
  relativePathUnderRoot?: string;
  reason?: string;
};

export type SchematronSafeFileArtifactDiagnostics = {
  artifactKind: SchematronArtifactKind;
  configured: boolean;
  status: SchematronArtifactStatus;
  readable: boolean;
  usable: boolean;
  sha256: string | null;
  label: string | null;
  basename: string | null;
  relativePathUnderRoot?: string;
  reason?: string;
  sourceRegisterVersion?: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  artifactSlotId?: string;
  reviewStatus?: SchematronArtifactReviewStatus;
  sourceLabels?: readonly string[];
  sourceUrls?: readonly string[];
  documentationUrls?: readonly string[];
  legalConfidence?: SchematronArtifactLegalConfidence;
  provenanceDisclaimer?: string;
  artifactProvenance?: SchematronArtifactProvenance;
  artifactManifestVersion?: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  manifestVerification?: SchematronArtifactManifestVerification;
  manifestHashStatus?: SchematronArtifactManifestHashStatus;
  expectedSha256Recorded?: boolean;
  actualSha256Recorded?: boolean;
  manifestReviewStatus?: SchematronArtifactManifestReviewStatus;
  manifestDisclaimer?: string;
};

export type UblXsdSafeDependencyGraphDiagnostics = {
  inspected: boolean;
  status: UblXsdDependencyGraphStatus;
  dependencyCount: number;
  inspectedSchemaCount: number;
  blockedDocumentType?: "invoice" | "credit_note";
  blockedCode?: string;
  blockedReason?: string;
};

export type UblXsdSafeArtifactDiagnostics = {
  diagnosticKind: "ubl_xsd_artifacts";
  configured: boolean;
  usable: boolean;
  readySchemaCount: number;
  requiredSchemaCount: 2;
  allRequiredSchemasReadable: boolean;
  validatorName: string;
  validatorAvailable: boolean;
  artifactVersion: string | null;
  checkedAt: string;
  invoiceSchema: UblXsdSafeSchemaArtifactDiagnostics;
  creditNoteSchema: UblXsdSafeSchemaArtifactDiagnostics;
  dependencyGraph: UblXsdSafeDependencyGraphDiagnostics;
  disclaimer: string;
};

export type SchematronSafeArtifactDiagnostics = {
  diagnosticKind: "schematron_artifacts";
  configured: boolean;
  usable: boolean;
  readyArtifactCount: number;
  requiredArtifactCount: 2;
  allRequiredArtifactsReadable: boolean;
  validatorName: string;
  validatorAvailable: boolean;
  validationExecutionEnabled: false;
  artifactVersion: string | null;
  checkedAt: string;
  peppolBisArtifact: SchematronSafeFileArtifactDiagnostics;
  en16931Artifact: SchematronSafeFileArtifactDiagnostics;
  sourceRegisterVersion?: typeof SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION;
  sourceRegisterSummary?: SchematronArtifactSourceRegisterSummary;
  artifactManifestVersion?: typeof SCHEMATRON_ARTIFACT_MANIFEST_VERSION;
  artifactManifestSummary?: SchematronArtifactManifestSummary;
  disclaimer: string;
};

export type UblXsdResolvedSchema = {
  resolvedConfig: ResolvedUblXsdArtifactConfig;
  artifactInfo: UblXsdArtifactInfo;
  selectedDocumentType: UblXsdSelectedDocumentType;
  schema: UblXsdSchemaArtifactInfo | null;
  schemaPath: string | null;
};

function cleanOptionalValue(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function normalizeConfiguredPath(value: string | undefined) {
  const cleaned = cleanOptionalValue(value);

  return cleaned ? resolve(cleaned) : undefined;
}

function normalizeConfiguredSchematronPath(value: string | undefined) {
  return cleanOptionalValue(value);
}

function isBlockedSchematronConfiguredPath(value: string) {
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return false;
  }

  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//");
}

function getDerivableUblVersion(artifactVersion: string | undefined) {
  if (!artifactVersion) {
    return "2.1";
  }

  return /^\d+\.\d+$/.test(artifactVersion) ? artifactVersion : undefined;
}

function errorCode(error: unknown) {
  return error instanceof Error && "code" in error
    ? String(error.code)
    : "not_readable";
}

export function readUblXsdArtifactConfigFromEnv(
  env: UblXsdArtifactEnv = process.env
): UblXsdArtifactConfigInput {
  return {
    ...(env.UBL_XSD_ROOT_DIR ? { rootDir: env.UBL_XSD_ROOT_DIR } : {}),
    ...(env.UBL_INVOICE_XSD_PATH
      ? { invoiceXsdPath: env.UBL_INVOICE_XSD_PATH }
      : {}),
    ...(env.UBL_CREDIT_NOTE_XSD_PATH
      ? { creditNoteXsdPath: env.UBL_CREDIT_NOTE_XSD_PATH }
      : {}),
    ...(env.UBL_XSD_ARTIFACT_VERSION
      ? { artifactVersion: env.UBL_XSD_ARTIFACT_VERSION }
      : {})
  };
}

export function readSchematronArtifactConfigFromEnv(
  env: SchematronArtifactEnv = process.env
): SchematronArtifactConfigInput {
  return {
    ...(env.PEPPOL_SCHEMATRON_ROOT_DIR
      ? { rootDir: env.PEPPOL_SCHEMATRON_ROOT_DIR }
      : {}),
    ...(env.PEPPOL_BIS_SCHEMATRON_PATH
      ? { peppolBisSchematronPath: env.PEPPOL_BIS_SCHEMATRON_PATH }
      : {}),
    ...(env.EN16931_SCHEMATRON_PATH
      ? { en16931SchematronPath: env.EN16931_SCHEMATRON_PATH }
      : {}),
    ...(env.SCHEMATRON_ARTIFACT_VERSION
      ? { artifactVersion: env.SCHEMATRON_ARTIFACT_VERSION }
      : {})
  };
}

export function resolveUblXsdArtifactConfig(
  input: UblXsdArtifactConfigInput | undefined
): ResolvedUblXsdArtifactConfig {
  const rootPath = normalizeConfiguredPath(input?.rootDir);
  const artifactVersion = cleanOptionalValue(input?.artifactVersion);
  const derivableVersion = getDerivableUblVersion(artifactVersion);
  const invoiceXsdPath =
    normalizeConfiguredPath(input?.invoiceXsdPath) ??
    (rootPath && derivableVersion
      ? join(rootPath, "xsd", "maindoc", `UBL-Invoice-${derivableVersion}.xsd`)
      : undefined);
  const creditNoteXsdPath =
    normalizeConfiguredPath(input?.creditNoteXsdPath) ??
    (rootPath && derivableVersion
      ? join(
          rootPath,
          "xsd",
          "maindoc",
          `UBL-CreditNote-${derivableVersion}.xsd`
        )
      : undefined);

  return {
    ...(rootPath ? { rootPath } : {}),
    ...(invoiceXsdPath ? { invoiceXsdPath } : {}),
    ...(creditNoteXsdPath ? { creditNoteXsdPath } : {}),
    ...(artifactVersion ? { artifactVersion } : {})
  };
}

export function resolveSchematronArtifactConfig(
  input: SchematronArtifactConfigInput | undefined
): ResolvedSchematronArtifactConfig {
  const rawRootPath = cleanOptionalValue(input?.rootDir);
  const rootPath =
    rawRootPath && !isBlockedSchematronConfiguredPath(rawRootPath)
      ? resolve(rawRootPath)
      : undefined;
  const artifactVersion = cleanOptionalValue(input?.artifactVersion);
  const peppolBisSchematronPath = normalizeConfiguredSchematronPath(
    input?.peppolBisSchematronPath
  );
  const en16931SchematronPath = normalizeConfiguredSchematronPath(
    input?.en16931SchematronPath
  );

  return {
    ...(rootPath ? { rootPath } : {}),
    ...(peppolBisSchematronPath ? { peppolBisSchematronPath } : {}),
    ...(en16931SchematronPath ? { en16931SchematronPath } : {}),
    ...(artifactVersion ? { artifactVersion } : {})
  };
}

export function isPathInside(parentPath: string, childPath: string) {
  const relativePath = relative(resolve(parentPath), resolve(childPath));

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

async function sha256File(path: string) {
  const contents = await readFile(path);

  return createHash("sha256").update(contents).digest("hex");
}

function notConfiguredSchemaArtifact(): UblXsdSchemaArtifactInfo {
  return {
    configured: false,
    readable: false,
    usable: false,
    path: null,
    sha256: null,
    status: "not_configured",
    reason: "local_ubl_xsd_artifact_path_not_configured"
  };
}

function notConfiguredSchematronArtifact(
  artifactKind: SchematronArtifactKind
): SchematronArtifactFileInfo {
  return {
    artifactKind,
    configured: false,
    readable: false,
    usable: false,
    path: null,
    sha256: null,
    status: "not_configured",
    reason: "local_schematron_artifact_path_not_configured"
  };
}

async function inspectSchemaArtifact(input: {
  schemaPath: string | undefined;
  rootPath: string | undefined;
}): Promise<UblXsdSchemaArtifactInfo> {
  if (!input.schemaPath) {
    return notConfiguredSchemaArtifact();
  }

  const schemaPath = resolve(input.schemaPath);

  if (input.rootPath && !isPathInside(input.rootPath, schemaPath)) {
    return {
      configured: true,
      readable: false,
      usable: false,
      path: schemaPath,
      sha256: null,
      status: "out_of_root",
      reason: "local_ubl_xsd_artifact_outside_configured_root"
    };
  }

  try {
    const schemaStat = await stat(schemaPath);

    if (!schemaStat.isFile()) {
      return {
        configured: true,
        readable: false,
        usable: false,
        path: schemaPath,
        sha256: null,
        status: "unreadable",
        reason: "not_a_file"
      };
    }

    await access(schemaPath, constants.R_OK);

    return {
      configured: true,
      readable: true,
      usable: true,
      path: schemaPath,
      sha256: await sha256File(schemaPath),
      status: "available"
    };
  } catch (error) {
    const code = errorCode(error);

    return {
      configured: true,
      readable: false,
      usable: false,
      path: schemaPath,
      sha256: null,
      status: code === "ENOENT" ? "missing" : "unreadable",
      reason: code
    };
  }
}

async function inspectSchematronArtifact(input: {
  artifactKind: SchematronArtifactKind;
  artifactPath: string | undefined;
  rootPath: string | undefined;
}): Promise<SchematronArtifactFileInfo> {
  if (!input.artifactPath) {
    return notConfiguredSchematronArtifact(input.artifactKind);
  }

  if (isBlockedSchematronConfiguredPath(input.artifactPath)) {
    return {
      artifactKind: input.artifactKind,
      configured: true,
      readable: false,
      usable: false,
      path: null,
      sha256: null,
      status: "unreadable",
      reason: "local_schematron_artifact_remote_path_blocked"
    };
  }

  const artifactPath = resolve(input.artifactPath);

  if (input.rootPath && !isPathInside(input.rootPath, artifactPath)) {
    return {
      artifactKind: input.artifactKind,
      configured: true,
      readable: false,
      usable: false,
      path: artifactPath,
      sha256: null,
      status: "out_of_root",
      reason: "local_schematron_artifact_outside_configured_root"
    };
  }

  try {
    const artifactStat = await stat(artifactPath);

    if (!artifactStat.isFile()) {
      return {
        artifactKind: input.artifactKind,
        configured: true,
        readable: false,
        usable: false,
        path: artifactPath,
        sha256: null,
        status: "unreadable",
        reason: "not_a_file"
      };
    }

    await access(artifactPath, constants.R_OK);

    return {
      artifactKind: input.artifactKind,
      configured: true,
      readable: true,
      usable: true,
      path: artifactPath,
      sha256: await sha256File(artifactPath),
      status: "available"
    };
  } catch (error) {
    const code = errorCode(error);

    return {
      artifactKind: input.artifactKind,
      configured: true,
      readable: false,
      usable: false,
      path: artifactPath,
      sha256: null,
      status: code === "ENOENT" ? "missing" : "unreadable",
      reason: code
    };
  }
}

function defaultDependencyGraph(): UblXsdDependencyGraphInfo {
  return {
    inspected: false,
    dependencyCount: 0,
    status: "not_inspected",
    schemaResolutionRoot: null
  };
}

function buildArtifactInfo(input: {
  resolvedConfig: ResolvedUblXsdArtifactConfig;
  invoiceSchema: UblXsdSchemaArtifactInfo;
  creditNoteSchema: UblXsdSchemaArtifactInfo;
  selectedDocumentType?: UblXsdSelectedDocumentType;
  dependencyGraph?: UblXsdDependencyGraphInfo;
  validatorAvailable?: boolean;
  checkedAt?: string;
}): UblXsdArtifactInfo {
  const selectedUsable =
    input.selectedDocumentType === "invoice"
      ? input.invoiceSchema.usable
      : input.selectedDocumentType === "credit_note"
        ? input.creditNoteSchema.usable
        : input.selectedDocumentType === "unknown"
          ? false
          : input.invoiceSchema.usable || input.creditNoteSchema.usable;

  return {
    configured: selectedUsable,
    usable: selectedUsable,
    rootPath: input.resolvedConfig.rootPath ?? null,
    invoiceXsdPath: input.resolvedConfig.invoiceXsdPath ?? null,
    creditNoteXsdPath: input.resolvedConfig.creditNoteXsdPath ?? null,
    artifactVersion: input.resolvedConfig.artifactVersion ?? null,
    validatorName: UBL_XSD_VALIDATOR_NAME,
    validatorAvailable: input.validatorAvailable ?? true,
    invoiceSchema: input.invoiceSchema,
    creditNoteSchema: input.creditNoteSchema,
    dependencyGraph: input.dependencyGraph ?? defaultDependencyGraph(),
    checkedAt: input.checkedAt ?? new Date().toISOString()
  };
}

function createSchematronArtifactRegistryInfo(input: {
  resolvedConfig: ResolvedSchematronArtifactConfig;
  peppolBisArtifact: SchematronArtifactFileInfo;
  en16931Artifact: SchematronArtifactFileInfo;
  checkedAt?: string;
}): SchematronArtifactRegistryInfo {
  const usable =
    input.peppolBisArtifact.usable || input.en16931Artifact.usable;

  return {
    configured:
      input.peppolBisArtifact.configured || input.en16931Artifact.configured,
    usable,
    rootPath: input.resolvedConfig.rootPath ?? null,
    peppolBisSchematronPath:
      input.resolvedConfig.peppolBisSchematronPath ?? null,
    en16931SchematronPath: input.resolvedConfig.en16931SchematronPath ?? null,
    artifactVersion: input.resolvedConfig.artifactVersion ?? null,
    validatorName: SCHEMATRON_VALIDATOR_NAME,
    validatorAvailable: false,
    peppolBisArtifact: input.peppolBisArtifact,
    en16931Artifact: input.en16931Artifact,
    checkedAt: input.checkedAt ?? new Date().toISOString()
  };
}

export async function inspectUblXsdArtifacts(
  config: UblXsdArtifactConfigInput | undefined
): Promise<UblXsdArtifactInspection> {
  const resolvedConfig = resolveUblXsdArtifactConfig(config);
  const [invoiceSchema, creditNoteSchema] = await Promise.all([
    inspectSchemaArtifact({
      schemaPath: resolvedConfig.invoiceXsdPath,
      rootPath: resolvedConfig.rootPath
    }),
    inspectSchemaArtifact({
      schemaPath: resolvedConfig.creditNoteXsdPath,
      rootPath: resolvedConfig.rootPath
    })
  ]);

  return {
    resolvedConfig,
    invoiceSchema,
    creditNoteSchema,
    artifactInfo: buildArtifactInfo({
      resolvedConfig,
      invoiceSchema,
      creditNoteSchema
    })
  };
}

export async function inspectSchematronArtifacts(
  config: SchematronArtifactConfigInput | undefined
): Promise<SchematronArtifactInspection> {
  const resolvedConfig = resolveSchematronArtifactConfig(config);
  const [peppolBisArtifact, en16931Artifact] = await Promise.all([
    inspectSchematronArtifact({
      artifactKind: "peppol_bis_billing",
      artifactPath: resolvedConfig.peppolBisSchematronPath,
      rootPath: resolvedConfig.rootPath
    }),
    inspectSchematronArtifact({
      artifactKind: "en16931_tc434",
      artifactPath: resolvedConfig.en16931SchematronPath,
      rootPath: resolvedConfig.rootPath
    })
  ]);

  return {
    resolvedConfig,
    peppolBisArtifact,
    en16931Artifact,
    artifactInfo: createSchematronArtifactRegistryInfo({
      resolvedConfig,
      peppolBisArtifact,
      en16931Artifact
    })
  };
}

export async function buildUblXsdArtifactInfo(
  config: UblXsdArtifactConfigInput | undefined
): Promise<UblXsdArtifactInfo> {
  return (await inspectUblXsdArtifacts(config)).artifactInfo;
}

export async function buildSchematronArtifactInfo(
  config: SchematronArtifactConfigInput | undefined
): Promise<SchematronArtifactRegistryInfo> {
  return (await inspectSchematronArtifacts(config)).artifactInfo;
}

function getSelectedDocumentType(input: {
  documentType: string;
  rootElement: string;
}): UblXsdSelectedDocumentType {
  const normalizedDocumentType = input.documentType.toLowerCase();
  const normalizedRoot = input.rootElement.toLowerCase();

  if (
    normalizedDocumentType === "invoice" ||
    normalizedRoot === "invoice" ||
    normalizedRoot.endsWith(":invoice")
  ) {
    return "invoice";
  }

  if (
    normalizedDocumentType === "credit_note" ||
    normalizedRoot === "creditnote" ||
    normalizedRoot.endsWith(":creditnote")
  ) {
    return "credit_note";
  }

  return "unknown";
}

export async function resolveUblSchemaForDocumentType(
  config: UblXsdArtifactConfigInput | undefined,
  documentType: string,
  rootElement: string
): Promise<UblXsdResolvedSchema> {
  const inspection = await inspectUblXsdArtifacts(config);
  const selectedDocumentType = getSelectedDocumentType({
    documentType,
    rootElement
  });
  const schema =
    selectedDocumentType === "invoice"
      ? inspection.invoiceSchema
      : selectedDocumentType === "credit_note"
        ? inspection.creditNoteSchema
        : null;

  return {
    resolvedConfig: inspection.resolvedConfig,
    selectedDocumentType,
    schema,
    schemaPath: schema?.path ?? null,
    artifactInfo: buildArtifactInfo({
      resolvedConfig: inspection.resolvedConfig,
      invoiceSchema: inspection.invoiceSchema,
      creditNoteSchema: inspection.creditNoteSchema,
      selectedDocumentType
    })
  };
}

function isExternalSchemaLocation(schemaLocation: string) {
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(schemaLocation) ||
    schemaLocation.startsWith("//") ||
    isAbsolute(schemaLocation)
  );
}

function getSchemaLocations(contents: string) {
  const locations: string[] = [];

  SCHEMA_LOCATION_ATTRIBUTE_PATTERN.lastIndex = 0;

  for (const match of contents.matchAll(SCHEMA_LOCATION_ATTRIBUTE_PATTERN)) {
    const location = match[2]?.trim();

    if (location) {
      locations.push(location);
    }
  }

  return locations;
}

function inferSchemaResolutionRoot(input: {
  selectedXsdPath: string;
  resolvedConfig: ResolvedUblXsdArtifactConfig;
}) {
  if (
    input.resolvedConfig.rootPath &&
    isPathInside(input.resolvedConfig.rootPath, input.selectedXsdPath)
  ) {
    return input.resolvedConfig.rootPath;
  }

  const selectedDirectory = dirname(input.selectedXsdPath);

  return basename(selectedDirectory).toLowerCase() === "maindoc"
    ? dirname(selectedDirectory)
    : selectedDirectory;
}

function dependencyGraphResult(input: {
  dependencyCount: number;
  status: UblXsdDependencyGraphStatus;
  schemaResolutionRoot: string | null;
  reason?: string;
}): UblXsdDependencyGraphInfo {
  return {
    inspected: true,
    dependencyCount: input.dependencyCount,
    status: input.status,
    schemaResolutionRoot: input.schemaResolutionRoot,
    ...(input.reason ? { reason: input.reason } : {})
  };
}

function resolveDependencyPath(input: {
  currentSchemaPath: string;
  schemaLocation: string;
  schemaResolutionRoot: string;
}) {
  if (isExternalSchemaLocation(input.schemaLocation)) {
    return {
      path: null,
      status: "external_reference_blocked" as const,
      reason: "external_schema_location_not_supported"
    };
  }

  const dependencyPath = resolve(
    dirname(input.currentSchemaPath),
    input.schemaLocation
  );

  if (!isPathInside(input.schemaResolutionRoot, dependencyPath)) {
    return {
      path: null,
      status: "error" as const,
      reason: "schema_dependency_outside_configured_root"
    };
  }

  return {
    path: dependencyPath,
    status: "ready" as const
  };
}

export async function inspectUblSchemaDependencyGraph(input: {
  selectedXsdPath: string;
  resolvedConfig: ResolvedUblXsdArtifactConfig;
}): Promise<UblXsdDependencyGraphInfo> {
  const schemaResolutionRoot = inferSchemaResolutionRoot({
    selectedXsdPath: input.selectedXsdPath,
    resolvedConfig: input.resolvedConfig
  });
  const schemaFiles = new Set<string>();
  const queue = [resolve(input.selectedXsdPath)];

  while (queue.length > 0) {
    const currentSchemaPath = resolve(queue.shift() ?? "");

    if (schemaFiles.has(currentSchemaPath)) {
      continue;
    }

    if (schemaFiles.size >= MAX_SCHEMA_DEPENDENCY_FILES) {
      return dependencyGraphResult({
        dependencyCount: Math.max(schemaFiles.size - 1, 0),
        status: "error",
        schemaResolutionRoot,
        reason: "schema_dependency_limit_exceeded"
      });
    }

    let contents: string;

    try {
      const currentStat = await stat(currentSchemaPath);

      if (!currentStat.isFile()) {
        return dependencyGraphResult({
          dependencyCount: Math.max(schemaFiles.size - 1, 0),
          status: "unreadable_dependency",
          schemaResolutionRoot,
          reason: "not_a_file"
        });
      }

      await access(currentSchemaPath, constants.R_OK);
      contents = await readFile(currentSchemaPath, "utf8");
    } catch (error) {
      const code = errorCode(error);

      return dependencyGraphResult({
        dependencyCount: Math.max(schemaFiles.size - 1, 0),
        status: code === "ENOENT" ? "missing_dependency" : "unreadable_dependency",
        schemaResolutionRoot,
        reason: code
      });
    }

    schemaFiles.add(currentSchemaPath);

    for (const schemaLocation of getSchemaLocations(contents)) {
      const dependency = resolveDependencyPath({
        currentSchemaPath,
        schemaLocation,
        schemaResolutionRoot
      });

      if (!dependency.path) {
        return dependencyGraphResult({
          dependencyCount: Math.max(schemaFiles.size - 1, 0),
          status: dependency.status,
          schemaResolutionRoot,
          ...(dependency.reason ? { reason: dependency.reason } : {})
        });
      }

      queue.push(dependency.path);
    }
  }

  return dependencyGraphResult({
    dependencyCount: Math.max(schemaFiles.size - 1, 0),
    status: "ready",
    schemaResolutionRoot
  });
}

function toPortableRelativePath(path: string) {
  return path.split(/[\\/]+/).filter(Boolean).join("/");
}

type SafeSchemaPathLabels = {
  label: string | null;
  basename: string | null;
  relativePathUnderRoot?: string;
};

function getSafeSchemaPathLabels(input: {
  schemaPath: string | null;
  rootPath: string | null;
}): SafeSchemaPathLabels {
  if (!input.schemaPath) {
    return {
      label: null,
      basename: null
    };
  }

  const safeBasename = basename(input.schemaPath);

  if (input.rootPath && isPathInside(input.rootPath, input.schemaPath)) {
    const relativePath = relative(input.rootPath, input.schemaPath);
    const relativePathUnderRoot = toPortableRelativePath(relativePath);

    return {
      label: relativePathUnderRoot || safeBasename,
      basename: safeBasename,
      ...(relativePathUnderRoot ? { relativePathUnderRoot } : {})
    };
  }

  return {
    label: safeBasename,
    basename: safeBasename
  };
}

function buildSafeSchemaDiagnostics(input: {
  schema: UblXsdSchemaArtifactInfo;
  rootPath: string | null;
}): UblXsdSafeSchemaArtifactDiagnostics {
  const labels = getSafeSchemaPathLabels({
    schemaPath: input.schema.path,
    rootPath: input.rootPath
  });

  return {
    configured: input.schema.configured,
    status: input.schema.status,
    readable: input.schema.readable,
    usable: input.schema.usable,
    sha256: input.schema.sha256,
    label: labels.label,
    basename: labels.basename,
    ...(labels.relativePathUnderRoot
      ? { relativePathUnderRoot: labels.relativePathUnderRoot }
      : {}),
    ...(input.schema.reason ? { reason: input.schema.reason } : {})
  };
}

function buildSafeSchematronFileDiagnostics(input: {
  artifact: SchematronArtifactFileInfo;
  rootPath: string | null;
  artifactVersion: string | null;
}): SchematronSafeFileArtifactDiagnostics {
  const labels = getSafeSchemaPathLabels({
    schemaPath: input.artifact.path,
    rootPath: input.rootPath
  });
  const artifactProvenance = buildSchematronArtifactProvenance({
    layer: input.artifact.artifactKind,
    artifactVersion: input.artifactVersion,
    configured: input.artifact.configured,
    readable: input.artifact.readable,
    usable: input.artifact.usable,
    sha256: input.artifact.sha256,
    safeLabel: labels.label,
    basename: labels.basename,
    ...(labels.relativePathUnderRoot
      ? { relativePathUnderRoot: labels.relativePathUnderRoot }
      : {})
  });
  const manifestVerification = verifySchematronArtifactAgainstManifest({
    layer: input.artifact.artifactKind,
    diagnostic: {
      artifactKind: input.artifact.artifactKind,
      artifactVersion: input.artifactVersion,
      configured: input.artifact.configured,
      readable: input.artifact.readable,
      usable: input.artifact.usable,
      sha256: input.artifact.sha256,
      safeLabel: labels.label,
      basename: labels.basename,
      status: input.artifact.status,
      artifactProvenance,
      ...(labels.relativePathUnderRoot
        ? { relativePathUnderRoot: labels.relativePathUnderRoot }
        : {})
    }
  });

  return {
    artifactKind: input.artifact.artifactKind,
    configured: input.artifact.configured,
    status: input.artifact.status,
    readable: input.artifact.readable,
    usable: input.artifact.usable,
    sha256: input.artifact.sha256,
    label: labels.label,
    basename: labels.basename,
    ...(labels.relativePathUnderRoot
      ? { relativePathUnderRoot: labels.relativePathUnderRoot }
      : {}),
    ...(input.artifact.reason ? { reason: input.artifact.reason } : {}),
    sourceRegisterVersion: artifactProvenance.registerVersion,
    artifactSlotId: artifactProvenance.artifactSlotId,
    reviewStatus: artifactProvenance.reviewStatus,
    sourceLabels: [...artifactProvenance.sourceLabels],
    sourceUrls: [...artifactProvenance.sourceUrls],
    documentationUrls: [...artifactProvenance.documentationUrls],
    legalConfidence: artifactProvenance.legalConfidence,
    provenanceDisclaimer: artifactProvenance.disclaimer,
    artifactProvenance,
    artifactManifestVersion: manifestVerification.manifestVersion,
    manifestVerification,
    manifestHashStatus: manifestVerification.hashStatus,
    expectedSha256Recorded: manifestVerification.expectedSha256 !== null,
    actualSha256Recorded: manifestVerification.actualSha256 !== null,
    manifestReviewStatus: manifestVerification.reviewStatus,
    manifestDisclaimer: manifestVerification.disclaimer
  };
}

function getBlockedDependencyGraphCode(graph: UblXsdDependencyGraphInfo) {
  if (graph.status === "missing_dependency") {
    return "schema_dependency_missing";
  }

  if (graph.status === "unreadable_dependency") {
    return "schema_dependency_unreadable";
  }

  if (graph.status === "external_reference_blocked") {
    return "external_schema_location_not_supported";
  }

  if (graph.status === "error") {
    return graph.reason ?? "schema_dependency_graph_error";
  }

  return undefined;
}

function getBlockedDependencyGraphReason(graph: UblXsdDependencyGraphInfo) {
  if (graph.status === "missing_dependency") {
    return "A referenced local XSD dependency is missing.";
  }

  if (graph.status === "unreadable_dependency") {
    return "A referenced local XSD dependency is unreadable.";
  }

  if (graph.status === "external_reference_blocked") {
    return "A referenced schema location is external and remote schema fetching is blocked.";
  }

  if (graph.status === "error") {
    return "The local XSD dependency graph could not be inspected safely.";
  }

  return undefined;
}

async function inspectUblXsdValidatorAvailability() {
  try {
    await import("xmllint-wasm");
    return true;
  } catch {
    return false;
  }
}

async function buildSafeDependencyGraphDiagnostics(input: {
  resolvedConfig: ResolvedUblXsdArtifactConfig;
  invoiceSchema: UblXsdSchemaArtifactInfo;
  creditNoteSchema: UblXsdSchemaArtifactInfo;
}): Promise<UblXsdSafeDependencyGraphDiagnostics> {
  const inspectableSchemas: Array<{
    documentType: "invoice" | "credit_note";
    schemaPath: string;
  }> = [
    ...(input.invoiceSchema.usable && input.invoiceSchema.path
      ? [
          {
            documentType: "invoice" as const,
            schemaPath: input.invoiceSchema.path
          }
        ]
      : []),
    ...(input.creditNoteSchema.usable && input.creditNoteSchema.path
      ? [
          {
            documentType: "credit_note" as const,
            schemaPath: input.creditNoteSchema.path
          }
        ]
      : [])
  ];

  if (inspectableSchemas.length === 0) {
    return {
      inspected: false,
      status: "not_inspected",
      dependencyCount: 0,
      inspectedSchemaCount: 0
    };
  }

  const inspectedGraphs = await Promise.all(
    inspectableSchemas.map(async (schema) => ({
      documentType: schema.documentType,
      graph: await inspectUblSchemaDependencyGraph({
        selectedXsdPath: schema.schemaPath,
        resolvedConfig: input.resolvedConfig
      })
    }))
  );
  const blockedGraph = inspectedGraphs.find(
    (item) => item.graph.status !== "ready"
  );

  if (blockedGraph) {
    const blockedCode = getBlockedDependencyGraphCode(blockedGraph.graph);
    const blockedReason = getBlockedDependencyGraphReason(blockedGraph.graph);

    return {
      inspected: true,
      status: blockedGraph.graph.status,
      dependencyCount: blockedGraph.graph.dependencyCount,
      inspectedSchemaCount: inspectedGraphs.length,
      blockedDocumentType: blockedGraph.documentType,
      ...(blockedCode ? { blockedCode } : {}),
      ...(blockedReason ? { blockedReason } : {})
    };
  }

  return {
    inspected: true,
    status: "ready",
    dependencyCount: inspectedGraphs.reduce(
      (total, item) => total + item.graph.dependencyCount,
      0
    ),
    inspectedSchemaCount: inspectedGraphs.length
  };
}

export async function buildSafeUblXsdArtifactDiagnostics(
  config: UblXsdArtifactConfigInput | undefined
): Promise<UblXsdSafeArtifactDiagnostics> {
  const inspection = await inspectUblXsdArtifacts(config);
  const validatorAvailable = await inspectUblXsdValidatorAvailability();
  const readySchemaCount = [
    inspection.invoiceSchema.usable,
    inspection.creditNoteSchema.usable
  ].filter(Boolean).length;

  return {
    diagnosticKind: "ubl_xsd_artifacts",
    configured:
      inspection.invoiceSchema.configured || inspection.creditNoteSchema.configured,
    usable: readySchemaCount > 0,
    readySchemaCount,
    requiredSchemaCount: 2,
    allRequiredSchemasReadable:
      inspection.invoiceSchema.readable && inspection.creditNoteSchema.readable,
    validatorName: UBL_XSD_VALIDATOR_NAME,
    validatorAvailable,
    artifactVersion: inspection.artifactInfo.artifactVersion,
    checkedAt: inspection.artifactInfo.checkedAt,
    invoiceSchema: buildSafeSchemaDiagnostics({
      schema: inspection.invoiceSchema,
      rootPath: inspection.artifactInfo.rootPath
    }),
    creditNoteSchema: buildSafeSchemaDiagnostics({
      schema: inspection.creditNoteSchema,
      rootPath: inspection.artifactInfo.rootPath
    }),
    dependencyGraph: await buildSafeDependencyGraphDiagnostics({
      resolvedConfig: inspection.resolvedConfig,
      invoiceSchema: inspection.invoiceSchema,
      creditNoteSchema: inspection.creditNoteSchema
    }),
    disclaimer: UBL_XSD_ARTIFACT_DIAGNOSTICS_DISCLAIMER
  };
}

export async function buildSafeSchematronArtifactDiagnostics(
  config: SchematronArtifactConfigInput | undefined
): Promise<SchematronSafeArtifactDiagnostics> {
  const inspection = await inspectSchematronArtifacts(config);
  const readyArtifactCount = [
    inspection.peppolBisArtifact.usable,
    inspection.en16931Artifact.usable
  ].filter(Boolean).length;

  return {
    diagnosticKind: "schematron_artifacts",
    configured:
      inspection.peppolBisArtifact.configured ||
      inspection.en16931Artifact.configured,
    usable: readyArtifactCount > 0,
    readyArtifactCount,
    requiredArtifactCount: 2,
    allRequiredArtifactsReadable:
      inspection.peppolBisArtifact.readable &&
      inspection.en16931Artifact.readable,
    validatorName: SCHEMATRON_VALIDATOR_NAME,
    validatorAvailable: false,
    validationExecutionEnabled: false,
    artifactVersion: inspection.artifactInfo.artifactVersion,
    checkedAt: inspection.artifactInfo.checkedAt,
    peppolBisArtifact: buildSafeSchematronFileDiagnostics({
      artifact: inspection.peppolBisArtifact,
      rootPath: inspection.artifactInfo.rootPath,
      artifactVersion: inspection.artifactInfo.artifactVersion
    }),
    en16931Artifact: buildSafeSchematronFileDiagnostics({
      artifact: inspection.en16931Artifact,
      rootPath: inspection.artifactInfo.rootPath,
      artifactVersion: inspection.artifactInfo.artifactVersion
    }),
    sourceRegisterVersion: SCHEMATRON_ARTIFACT_SOURCE_REGISTER_VERSION,
    sourceRegisterSummary: buildSchematronArtifactSourceRegisterSummary(),
    artifactManifestVersion: SCHEMATRON_ARTIFACT_MANIFEST_VERSION,
    artifactManifestSummary: buildSchematronArtifactManifestSummary(),
    disclaimer: SCHEMATRON_ARTIFACT_DIAGNOSTICS_DISCLAIMER
  };
}

export function withUblXsdDependencyGraph(
  artifactInfo: UblXsdArtifactInfo,
  dependencyGraph: UblXsdDependencyGraphInfo
): UblXsdArtifactInfo {
  return {
    ...artifactInfo,
    dependencyGraph
  };
}

export function withUblXsdValidatorAvailability(
  artifactInfo: UblXsdArtifactInfo,
  validatorAvailable: boolean
): UblXsdArtifactInfo {
  return {
    ...artifactInfo,
    validatorAvailable
  };
}

export async function getUblXsdArtifactHealth(
  config: UblXsdArtifactConfigInput | undefined
) {
  const inspection = await inspectUblXsdArtifacts(config);
  const readyCount = [
    inspection.invoiceSchema.usable,
    inspection.creditNoteSchema.usable
  ].filter(Boolean).length;

  return {
    status:
      readyCount === 2 ? "ready" : readyCount === 1 ? "partial" : "not_configured",
    readySchemaCount: readyCount,
    artifactInfo: inspection.artifactInfo
  };
}

export async function getSchematronArtifactHealth(
  config: SchematronArtifactConfigInput | undefined
) {
  const inspection = await inspectSchematronArtifacts(config);
  const readyCount = [
    inspection.peppolBisArtifact.usable,
    inspection.en16931Artifact.usable
  ].filter(Boolean).length;

  return {
    status:
      readyCount === 2 ? "ready" : readyCount === 1 ? "partial" : "not_configured",
    readyArtifactCount: readyCount,
    artifactInfo: inspection.artifactInfo
  };
}
