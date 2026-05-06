import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

export const UBL_XSD_VALIDATOR_NAME = "xmllint-wasm";

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

export type ResolvedUblXsdArtifactConfig = {
  rootPath?: string;
  invoiceXsdPath?: string;
  creditNoteXsdPath?: string;
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

export type UblXsdDependencyGraphStatus =
  | "not_inspected"
  | "ready"
  | "missing_dependency"
  | "unreadable_dependency"
  | "external_reference_blocked"
  | "error";

export type UblXsdSchemaArtifactInfo = {
  configured: boolean;
  readable: boolean;
  usable: boolean;
  path: string | null;
  sha256: string | null;
  status: UblXsdSchemaArtifactStatus;
  reason?: string;
};

export type UblXsdDependencyGraphInfo = {
  inspected: boolean;
  dependencyCount: number;
  status: UblXsdDependencyGraphStatus;
  schemaResolutionRoot: string | null;
  reason?: string;
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

export async function buildUblXsdArtifactInfo(
  config: UblXsdArtifactConfigInput | undefined
): Promise<UblXsdArtifactInfo> {
  return (await inspectUblXsdArtifacts(config)).artifactInfo;
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
